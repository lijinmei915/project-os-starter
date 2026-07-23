use crate::runtime::agent_runs::PersistedAgentRun;
use crate::runtime::chat_content::{
    local_chat_result, project_evidence, references_for_message, ChatTurnInput,
    ChatWithModelResult, DialogueContextInput,
};
use crate::runtime::chat_routing::should_create_plan_for_message;
use crate::runtime::chat_runtime::{emit_conversation_event, RuntimeRequestState};
use crate::runtime::chat_stream::generate_provider_chat;
use crate::runtime::execution::build_run_summary_markdown;
#[cfg(test)]
use crate::runtime::execution::run_git_apply;
use crate::runtime::hermes_execution::{run_structured_loop, HermesAgentLoopResult};
#[cfg(test)]
use crate::runtime::hermes_protocol::custom_provider_key_env as hermes_custom_provider_key_env;
use crate::runtime::hermes_protocol::executor_status as hermes_executor_status;
#[cfg(test)]
use crate::runtime::hermes_protocol::extract_structured_envelope as extract_structured_hermes_envelope;
use crate::runtime::patch::PatchDraft;
use crate::runtime::planning::{
    sanitize_image_attachments, GeneratePlanInput as PlanningGeneratePlanInput, PlanAttachment,
    PlanContext, ReadonlyPlan,
};
#[cfg(test)]
use crate::runtime::provider::ProviderProfile;
use crate::runtime::provider::{
    delete_profile as delete_provider_config_profile, isolate_duplicate_provider_secrets,
    profile_from_input, save_profile as save_provider_config_profile,
    status as provider_status_projection, status_source as provider_status_source, trim_for_trace,
    ModelCatalog, ModelHealthCache, ModelHealthEntry, ProviderConfig, ProviderModelTestResult,
    ProviderStatus,
};
use crate::runtime::terminal::TerminalState;
use crate::runtime::theme::{
    load_or_seed as load_or_seed_desktop_theme, normalize as normalize_desktop_theme,
    save as save_desktop_theme_file, DesktopThemeConfig,
};
use crate::runtime::workspace::{
    build_workspace_snapshot, current_registry_project, default_project_access_mode,
    load_or_seed_registry, normalize_project_access_mode, register_project,
    relocate_registry_project as relocate_workspace_project,
    remove_registry_project as remove_workspace_project,
    rename_registry_project as rename_workspace_project,
    switch_registry_project as switch_workspace_project, WorkspaceSnapshot,
};
use crate::runtime::workspace_watcher::WorkspaceWatcherState;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashSet;
#[cfg(any(test, feature = "webdriver"))]
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
#[cfg(test)]
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, State};

const STATE_PATH: &str = ".omnidesk/data/state.json";
#[cfg(test)]
const GOALS_PATH: &str = ".omnidesk/data/goals.json";
const RUN_SUMMARY_PATH: &str = ".omnidesk/evidence/desktop-summary.md";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AddRegistryProjectInput {
    path: String,
    #[serde(default = "default_project_access_mode")]
    access_mode: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SwitchRegistryProjectInput {
    id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PreviewProjectInput {
    path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveTerminalImageInput {
    name: String,
    data_url: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GeneratePlanInput {
    task: String,
    #[serde(default)]
    attachments: Vec<PlanAttachment>,
    #[serde(default)]
    request_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChatWithModelInput {
    message: String,
    #[serde(default)]
    attachments: Vec<PlanAttachment>,
    #[serde(default)]
    recent_turns: Vec<ChatTurnInput>,
    #[serde(default)]
    context_state: DialogueContextInput,
    #[serde(default)]
    summary: Value,
    #[serde(default)]
    project_memory: Vec<Value>,
    #[serde(default)]
    request_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateBacklogItemInput {
    id: String,
    status: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateGoalInput {
    title: String,
    #[serde(default)]
    summary: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateGoalInput {
    id: String,
    title: String,
    #[serde(default)]
    summary: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SwitchGoalInput {
    id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MergeGoalInput {
    source_id: String,
    target_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConfirmGoalDecompositionInput {
    id: String,
    task_ids: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GoalValidationInput {
    goal_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RenameRegistryProjectInput {
    id: String,
    name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RelocateRegistryProjectInput {
    id: String,
    path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RunGuardedCheckInput {
    check_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopTaskInput {
    task: Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeleteDesktopTaskInput {
    id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopConversationInput {
    conversation: Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectMemoryInput {
    memory: Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeleteDesktopConversationInput {
    id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct NaturalProfileUpdateInput {
    patches: Vec<crate::runtime::workspace::ProfileFieldPatch>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GeneratePatchDraftInput {
    task: Value,
    #[serde(default)]
    request_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ApplyPatchDraftInput {
    task: Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WriteRunSummaryInput {
    task: Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MergeRunSummaryToHandoffInput {
    task: Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReadEngineeringFileInput {
    path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RunHermesAgentInput {
    #[serde(default)]
    request_id: String,
    prompt: String,
    #[serde(default = "default_agent_max_steps")]
    max_steps: usize,
    #[serde(default)]
    approval_token: String,
    #[serde(default)]
    run_id: String,
}

fn default_agent_max_steps() -> usize {
    20
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExecuteAgentReadToolInput {
    name: String,
    #[serde(default)]
    arguments: Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ResumeAgentRunInput {
    id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ApproveAgentRunInput {
    id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExecuteApprovedAgentToolInput {
    id: String,
    token: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ContinueAgentRunInput {
    id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RunSummaryResult {
    path: String,
    message: String,
    summary: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HandoffMergeResult {
    path: String,
    message: String,
    merged_at: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProviderConfigInput {
    #[serde(default)]
    profile_id: String,
    #[serde(default)]
    profile_name: String,
    #[serde(default)]
    profile_note: String,
    #[serde(default)]
    profile_website: String,
    provider: String,
    model: String,
    api_base: String,
    api_key_env: String,
    enabled: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProviderSecretInput {
    api_key_env: String,
    api_key: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeleteProviderProfileInput {
    profile_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProbeProviderModelsInput {
    api_base: String,
    api_key_env: String,
    #[serde(default)]
    api_key: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TestProviderModelInput {
    api_base: String,
    api_key_env: String,
    model: String,
    #[serde(default)]
    api_key: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProviderModelsProbeResult {
    models: Vec<String>,
    source: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateProjectCapabilityInput {
    capability_id: String,
    status: String,
    #[serde(default)]
    modules: Vec<String>,
    #[serde(default)]
    candidate_modules: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ArchiveLegacyStateInput {
    confirmation: String,
}

#[tauri::command]
fn update_project_capability(input: UpdateProjectCapabilityInput) -> Result<Value, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(current_project.path);
    let updated_at = Command::new("date")
        .arg("+%Y-%m-%d")
        .output()
        .ok()
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|text| text.trim().to_string())
        .unwrap_or_default();
    crate::runtime::workspace::update_capability(
        &root,
        &input.capability_id,
        &input.status,
        &input.modules,
        &input.candidate_modules,
        &updated_at,
    )
}

#[tauri::command]
fn archive_legacy_state_for_retirement(
    input: ArchiveLegacyStateInput,
) -> Result<crate::runtime::state_namespace::LegacyRetentionArchive, String> {
    if input.confirmation.trim() != "ARCHIVE_LEGACY_STATE" {
        return Err("归档 legacy 差异需要明确确认".to_string());
    }
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let project = current_registry_project(&mut registry, &app_root)?;
    crate::runtime::state_namespace::archive_legacy_retirement_differences(&PathBuf::from(
        project.path,
    ))
}

#[tauri::command]
fn cleanup_legacy_state_for_retirement(
    input: ArchiveLegacyStateInput,
) -> Result<crate::runtime::state_namespace::LegacyRetirementCleanup, String> {
    if input.confirmation.trim() != "DELETE_LEGACY_PROJECT_OS" {
        return Err("清理 legacy 状态需要独立的明确确认".to_string());
    }
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let project = current_registry_project(&mut registry, &app_root)?;
    crate::runtime::state_namespace::cleanup_legacy_state_for_retirement(&PathBuf::from(
        project.path,
    ))
}

#[tauri::command]
fn get_workspace_snapshot() -> Result<WorkspaceSnapshot, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    build_workspace_snapshot(&root, &current_project, &registry)
}

#[tauri::command]
fn refresh_workspace_facts_preview() -> Result<Value, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    let report =
        crate::runtime::workspace::build_workspace_facts_preview(&root, &current_project.name);
    crate::runtime::workspace::record_fact_freshness(&root, &current_timestamp_string())?;
    Ok(report)
}

#[tauri::command]
fn start_workspace_file_watcher(
    app: AppHandle,
    state: State<WorkspaceWatcherState>,
) -> Result<String, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    crate::runtime::workspace_watcher::start(app, state, PathBuf::from(&current_project.path))
}

#[cfg(test)]
fn sync_task_goal_index(
    root: &Path,
    task_id: &str,
    goal_id: &str,
    timestamp: &str,
) -> Result<(), String> {
    let goals_path = root.join(GOALS_PATH);
    let Some(mut goals) = read_json(goals_path.clone()) else {
        return Ok(());
    };
    crate::runtime::goals::rebind_task(&mut goals, task_id, goal_id, timestamp);
    crate::runtime::repository::Repository::new(root).transaction(
        "sync-task-goal-index",
        &[crate::runtime::repository::JsonMutation::upsert(
            GOALS_PATH, goals,
        )],
    )?;
    Ok(())
}

#[tauri::command]
fn create_goal(input: CreateGoalInput) -> Result<WorkspaceSnapshot, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    let now = current_timestamp_string();
    let id = crate::runtime::goals::id_from_title(input.title.trim(), &now);
    crate::runtime::goals::create(
        &root,
        &current_project.name,
        id,
        &input.title,
        &input.summary,
        &now,
    )?;
    get_workspace_snapshot()
}

#[tauri::command]
fn update_goal(input: UpdateGoalInput) -> Result<WorkspaceSnapshot, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    crate::runtime::goals::update(
        &root,
        &current_project.name,
        &input.id,
        &input.title,
        &input.summary,
        &current_timestamp_string(),
    )?;
    get_workspace_snapshot()
}

#[tauri::command]
fn archive_goal(input: SwitchGoalInput) -> Result<WorkspaceSnapshot, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    crate::runtime::goals::archive(
        &root,
        &current_project.name,
        &input.id,
        &current_timestamp_string(),
    )?;
    get_workspace_snapshot()
}

#[tauri::command]
fn restore_goal(input: SwitchGoalInput) -> Result<WorkspaceSnapshot, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    crate::runtime::goals::restore(
        &root,
        &current_project.name,
        &input.id,
        &current_timestamp_string(),
    )?;
    get_workspace_snapshot()
}

#[tauri::command]
fn merge_goal(input: MergeGoalInput) -> Result<WorkspaceSnapshot, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    crate::runtime::goals::merge(
        &PathBuf::from(&current_project.path),
        &current_project.name,
        &input.source_id,
        &input.target_id,
        &current_timestamp_string(),
    )?;
    get_workspace_snapshot()
}

#[tauri::command]
fn switch_active_goal(input: SwitchGoalInput) -> Result<WorkspaceSnapshot, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    crate::runtime::goals::switch_active(
        &root,
        &current_project.name,
        &input.id,
        &current_timestamp_string(),
    )?;
    get_workspace_snapshot()
}

#[tauri::command]
fn confirm_goal(input: SwitchGoalInput) -> Result<WorkspaceSnapshot, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    crate::runtime::goals::confirm(
        &root,
        &current_project.name,
        &input.id,
        &current_timestamp_string(),
    )?;
    get_workspace_snapshot()
}

#[tauri::command]
fn confirm_goal_decomposition(
    input: ConfirmGoalDecompositionInput,
) -> Result<WorkspaceSnapshot, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    crate::runtime::goals::confirm_decomposition(
        &root,
        &current_project.name,
        &input.id,
        &input.task_ids,
        &current_timestamp_string(),
    )?;
    get_workspace_snapshot()
}

#[tauri::command]
fn add_registry_project(input: AddRegistryProjectInput) -> Result<WorkspaceSnapshot, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    register_project(&app_root, &mut registry, &input.path, &input.access_mode)?;
    get_workspace_snapshot()
}

#[tauri::command]
fn preview_project_path(input: PreviewProjectInput) -> Result<Value, String> {
    crate::runtime::workspace::preview_project_path(&input.path)
}

#[tauri::command]
fn switch_registry_project(input: SwitchRegistryProjectInput) -> Result<WorkspaceSnapshot, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    switch_workspace_project(&app_root, &mut registry, &input.id)?;
    get_workspace_snapshot()
}

#[tauri::command]
fn rename_registry_project(input: RenameRegistryProjectInput) -> Result<WorkspaceSnapshot, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    rename_workspace_project(&app_root, &mut registry, &input.id, &input.name)?;
    get_workspace_snapshot()
}

#[tauri::command]
fn relocate_registry_project(
    input: RelocateRegistryProjectInput,
) -> Result<WorkspaceSnapshot, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    relocate_workspace_project(&app_root, &mut registry, &input.id, &input.path)?;
    get_workspace_snapshot()
}

#[tauri::command]
fn remove_registry_project(id: String) -> Result<WorkspaceSnapshot, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    remove_workspace_project(&app_root, &mut registry, &id)?;
    get_workspace_snapshot()
}

#[tauri::command]
fn open_project_folder(id: String) -> Result<(), String> {
    let app_root = find_workspace_root()?;
    let registry = load_or_seed_registry(&app_root)?;
    let project = registry
        .projects
        .iter()
        .find(|project| project.id == id)
        .ok_or_else(|| "未找到这个项目".to_string())?;
    crate::runtime::system_integration::open_project_folder(&PathBuf::from(&project.path))
}

#[tauri::command]
fn open_native_terminal() -> Result<(), String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    crate::runtime::system_integration::open_native_terminal(&PathBuf::from(&current_project.path))
}

#[tauri::command]
fn read_engineering_file(
    input: ReadEngineeringFileInput,
) -> Result<crate::runtime::workspace::EngineeringFilePreview, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    crate::runtime::workspace::read_engineering_file(
        &PathBuf::from(&current_project.path),
        &input.path,
    )
}

fn agent_tool_root() -> Result<PathBuf, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    PathBuf::from(&current_project.path)
        .canonicalize()
        .map_err(|err| format!("项目目录不可访问: {}", err))
}

#[tauri::command]
fn execute_agent_read_tool(input: ExecuteAgentReadToolInput) -> Result<Value, String> {
    let root = agent_tool_root()?;
    crate::runtime::agent_tools::execute_read_tool(&root, &input.name, &input.arguments)
}

#[tauri::command]
async fn chat_with_model(
    input: ChatWithModelInput,
    runtime_requests: State<'_, RuntimeRequestState>,
    app: AppHandle,
) -> Result<ChatWithModelResult, String> {
    let message = input.message.trim().to_string();
    if message.is_empty() && input.attachments.is_empty() {
        return Err("请输入内容".to_string());
    }

    let attachments = sanitize_image_attachments(input.attachments);

    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    let configured_provider = load_or_seed_provider_config(&app_root)?;
    let project_context =
        crate::runtime::workspace::project_runtime_context(&root, &current_project.name);
    let project_name = project_context.name;
    let stage = project_context.stage;
    let state = crate::runtime::repository::Repository::new(&root).read_json(STATE_PATH);
    let (project_evidence, all_evidence_references) = project_evidence(&root, state.as_ref());
    let evidence_references =
        references_for_message(&message, &input.context_state, all_evidence_references);

    if configured_provider.enabled {
        let (provider, provider_switch_note) =
            match prepare_provider_for_request(&app_root, &configured_provider, &HashSet::new())
                .await
            {
                Ok(result) => result,
                Err(err) => {
                    let mut fallback = local_chat_result(
                        &message,
                        !attachments.is_empty(),
                        &input.context_state,
                        &project_evidence,
                    );
                    fallback.provider_status =
                        crate::runtime::provider::classify_failure(&err).to_string();
                    fallback.provider_model = configured_provider.model.clone();
                    fallback.provider_error = err;
                    fallback.references = evidence_references;
                    return Ok(fallback);
                }
            };
        let request_id = input.request_id.trim().to_string();
        let token = if request_id.is_empty() {
            None
        } else {
            Some(runtime_requests.start(&request_id))
        };
        emit_conversation_event(
            &app,
            &request_id,
            "model.started",
            "thinking",
            "running",
            json!({}),
        );
        let provider_result = if let Some(token) = token {
            tokio::select! {
                _ = token.cancelled() => Err("请求已取消".to_string()),
                result = generate_provider_chat(
                    &provider,
                    &root,
                    &project_name,
                    &stage,
                    &message,
                    &attachments,
                    &input.recent_turns,
                    &input.context_state,
                    &input.summary,
                    &input.project_memory,
                    &project_evidence,
                    |text, chars| emit_conversation_event(
                        &app, &request_id, "model.delta", "thinking", "running",
                        json!({ "chars": chars, "text": text }),
                    ),
                ) => result,
            }
        } else {
            generate_provider_chat(
                &provider,
                &root,
                &project_name,
                &stage,
                &message,
                &attachments,
                &input.recent_turns,
                &input.context_state,
                &input.summary,
                &input.project_memory,
                &project_evidence,
                |text, chars| {
                    emit_conversation_event(
                        &app,
                        &request_id,
                        "model.delta",
                        "thinking",
                        "running",
                        json!({ "chars": chars, "text": text }),
                    )
                },
            )
            .await
        };
        if !request_id.is_empty() {
            runtime_requests.finish(&request_id);
        }
        match provider_result {
            Ok(mut result) => {
                emit_conversation_event(
                    &app,
                    &request_id,
                    "request.completed",
                    "result",
                    "completed",
                    json!({ "provider": provider.provider, "model": provider.model }),
                );
                result.provider_status = "available".to_string();
                result.provider_model = provider.model.clone();
                result.provider_error = String::new();
                if !provider_switch_note.is_empty() {
                    result.reply = format!("{}\n\n{}", provider_switch_note, result.reply);
                }
                if result.should_create_plan
                    && !should_create_plan_for_message(&message, !attachments.is_empty())
                {
                    result.should_create_plan = false;
                    if result.intent.trim().is_empty() || result.intent == "task" {
                        result.intent = "question".to_string();
                    }
                }
                result.references = evidence_references;
                return Ok(result);
            }
            Err(err) if err == "请求已取消" => {
                emit_conversation_event(
                    &app,
                    &request_id,
                    "request.cancelled",
                    "result",
                    "cancelled",
                    json!({}),
                );
                return Err(err);
            }
            Err(err) => {
                crate::runtime::provider::record_failure(&app_root, &provider, &err)?;
                emit_conversation_event(
                    &app,
                    &request_id,
                    "request.failed",
                    "result",
                    "failed",
                    json!({ "message": trim_for_trace(&err) }),
                );
                let mut fallback = local_chat_result(
                    &message,
                    !attachments.is_empty(),
                    &input.context_state,
                    &project_evidence,
                );
                fallback.provider_status =
                    crate::runtime::provider::classify_failure(&err).to_string();
                fallback.provider_model = provider.model.clone();
                fallback.provider_error = err;
                fallback.references = evidence_references;
                return Ok(fallback);
            }
        }
    }

    let mut result = local_chat_result(
        &message,
        !attachments.is_empty(),
        &input.context_state,
        &project_evidence,
    );
    result.references = evidence_references;
    Ok(result)
}

#[tauri::command]
fn cancel_runtime_request(
    request_id: String,
    runtime_requests: State<'_, RuntimeRequestState>,
) -> bool {
    runtime_requests.cancel(request_id.trim())
}

#[tauri::command]
async fn generate_readonly_plan(
    input: GeneratePlanInput,
    runtime_requests: State<'_, RuntimeRequestState>,
) -> Result<ReadonlyPlan, String> {
    let task = input.task.trim().to_string();
    if task.is_empty() {
        return Err("请输入任务描述".to_string());
    }
    let attachments = sanitize_image_attachments(input.attachments);

    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let configured_provider = load_or_seed_provider_config(&app_root)?;
    let root = PathBuf::from(&current_project.path);
    let project_context =
        crate::runtime::workspace::project_runtime_context(&root, &current_project.name);
    let project_name = project_context.name;
    let stage = project_context.stage;

    let context = PlanContext {
        task: task.clone(),
        attachments,
        project_name: project_name.clone(),
        stage: stage.clone(),
        root: root.clone(),
        provider: configured_provider.clone(),
    };
    let request_id = input.request_id.trim().to_string();
    let token = if request_id.is_empty() {
        None
    } else {
        Some(runtime_requests.start(&request_id))
    };
    let result = crate::runtime::planning::generate_plan(PlanningGeneratePlanInput {
        app_root: &app_root,
        context,
        cancellation: token,
    })
    .await;
    if !request_id.is_empty() {
        runtime_requests.finish(&request_id);
    }
    result
}

#[tauri::command]
fn list_desktop_tasks() -> Result<Vec<Value>, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    crate::runtime::tasks::recover_storage(&crate::runtime::tasks::directory(&root))?;
    crate::runtime::tasks::list(&root)
}

#[tauri::command]
fn save_desktop_task(input: DesktopTaskInput) -> Result<Value, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    crate::runtime::tasks::save(
        &root,
        &current_project.path,
        input.task,
        &current_timestamp_string(),
    )
}

#[tauri::command]
fn delete_desktop_task(input: DeleteDesktopTaskInput) -> Result<(), String> {
    let id = input.id.trim();
    if id.is_empty() {
        return Err("任务 id 不能为空".to_string());
    }
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    crate::runtime::tasks::delete(&root, id, &current_timestamp_string())
}

#[tauri::command]
fn list_desktop_conversations() -> Result<Vec<Value>, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    crate::runtime::conversations::list(Path::new(&current_project.path))
}

#[tauri::command]
fn save_desktop_conversation(input: DesktopConversationInput) -> Result<Value, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    crate::runtime::conversations::save(
        Path::new(&current_project.path),
        &current_project.path,
        input.conversation,
        &current_timestamp_string(),
    )
}

#[tauri::command]
fn delete_desktop_conversation(input: DeleteDesktopConversationInput) -> Result<(), String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    crate::runtime::conversations::delete(Path::new(&current_project.path), &input.id)
}

#[tauri::command]
fn get_project_memory() -> Result<Value, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    Ok(crate::runtime::workspace::load_memory(
        &root,
        &current_project.id,
    ))
}

#[tauri::command]
fn save_project_memory(input: ProjectMemoryInput) -> Result<Value, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    crate::runtime::workspace::save_memory(
        &root,
        &current_project.id,
        &current_timestamp_string(),
        input.memory,
    )
}

#[tauri::command]
fn run_goal_validation(input: GoalValidationInput) -> Result<WorkspaceSnapshot, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    crate::runtime::goals::run_validation(
        &root,
        input.goal_id.trim(),
        &current_timestamp_string(),
    )?;

    get_workspace_snapshot()
}

#[tauri::command]
fn sign_off_goal_validation(input: GoalValidationInput) -> Result<WorkspaceSnapshot, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    crate::runtime::goals::sign_off_validation(
        &root,
        input.goal_id.trim(),
        &current_timestamp_string(),
    )?;

    get_workspace_snapshot()
}

#[tauri::command]
fn update_task_backlog_item(input: UpdateBacklogItemInput) -> Result<WorkspaceSnapshot, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    crate::runtime::workspace::update_backlog_item(
        &root,
        &input.id,
        &input.status,
        &current_timestamp_string(),
    )?;
    get_workspace_snapshot()
}

#[tauri::command]
fn update_project_profile_from_conversation(
    input: NaturalProfileUpdateInput,
) -> Result<WorkspaceSnapshot, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    crate::runtime::workspace::update_profile(
        &root,
        &current_project.id,
        &current_timestamp_string(),
        input.patches,
    )?;
    get_workspace_snapshot()
}

#[tauri::command]
async fn generate_patch_draft(
    input: GeneratePatchDraftInput,
    runtime_requests: State<'_, RuntimeRequestState>,
) -> Result<PatchDraft, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    let configured_provider = load_or_seed_provider_config(&app_root)?;
    let request_id = input.request_id.trim().to_string();
    let token = if request_id.is_empty() {
        None
    } else {
        Some(runtime_requests.start(&request_id))
    };
    let result = crate::runtime::patch_draft::generate_draft(
        crate::runtime::patch_draft::GenerateDraftInput {
            app_root: &app_root,
            project_root: &root,
            configured_provider: &configured_provider,
            task: &input.task,
            cancellation: token,
        },
    )
    .await;
    if !request_id.is_empty() {
        runtime_requests.finish(&request_id);
    }
    result
}

#[tauri::command]
fn apply_patch_draft(
    input: ApplyPatchDraftInput,
) -> Result<crate::runtime::execution::ApplyPatchResult, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    if normalize_project_access_mode(&current_project.access_mode) != "controlled" {
        return Err(
            "当前项目未授权受控修改。请在接入设置中选择“允许受控修改”后再应用 Patch。".to_string(),
        );
    }
    let root = PathBuf::from(&current_project.path);
    let draft = input
        .task
        .get("patchDraft")
        .cloned()
        .ok_or_else(|| "任务还没有 patch 草案".to_string())?;
    crate::runtime::execution::apply_patch_draft(&root, &draft, &current_timestamp_string())
}

#[tauri::command]
fn write_run_summary(input: WriteRunSummaryInput) -> Result<RunSummaryResult, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    let task = input.task;
    let summary = build_run_summary_markdown(&task, &current_timestamp_string());
    crate::runtime::execution::append_run_summary(&root, &summary)?;

    Ok(RunSummaryResult {
        path: RUN_SUMMARY_PATH.to_string(),
        message: "任务摘要已写入本地 run summary".to_string(),
        summary,
    })
}

#[tauri::command]
fn merge_run_summary_to_handoff(
    input: MergeRunSummaryToHandoffInput,
) -> Result<HandoffMergeResult, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    let task = input.task;
    let summary = task
        .pointer("/runSummary/summary")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "任务还没有 run summary，请先完成 Apply + Verify。".to_string())?;
    let title = task
        .get("title")
        .and_then(Value::as_str)
        .unwrap_or("未命名任务");
    let merged_at = current_timestamp_string();
    let block = format!(
        r#"

## Desktop 合并记录 - {}

> 来源：OmniDesk 用户确认合并。

{}
"#,
        title, summary
    );
    crate::runtime::execution::append_handoff(&root, &block)?;

    Ok(HandoffMergeResult {
        path: "HANDOFF.md".to_string(),
        message: "任务摘要已合并到 HANDOFF.md".to_string(),
        merged_at,
    })
}

#[tauri::command]
fn list_agent_runs() -> Result<Vec<PersistedAgentRun>, String> {
    let app_root = find_workspace_root()?;
    crate::runtime::agent_runs::list(&app_root)
}

#[tauri::command]
fn resume_agent_run(input: ResumeAgentRunInput) -> Result<PersistedAgentRun, String> {
    let app_root = find_workspace_root()?;
    crate::runtime::agent_runs::resume(&app_root, &input.id, &current_timestamp_string())
}

#[tauri::command]
fn approve_agent_run(input: ApproveAgentRunInput) -> Result<PersistedAgentRun, String> {
    let app_root = find_workspace_root()?;
    crate::runtime::agent_runs::approve(&app_root, &input.id, &current_timestamp_string())
}

#[tauri::command]
fn execute_approved_agent_tool(input: ExecuteApprovedAgentToolInput) -> Result<Value, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let project = current_registry_project(&mut registry, &app_root)?;
    let access_mode = normalize_project_access_mode(&project.access_mode);
    crate::runtime::execution::execute_approved_agent_tool(
        &app_root,
        Path::new(&project.path),
        &project.id,
        &access_mode,
        &input.id,
        &input.token,
        &current_timestamp_string(),
    )
}

#[tauri::command]
async fn continue_agent_run(
    input: ContinueAgentRunInput,
    runtime_requests: State<'_, RuntimeRequestState>,
) -> Result<HermesAgentLoopResult, String> {
    let app_root = find_workspace_root()?;
    let run = crate::runtime::agent_runs::load(&app_root, &input.id)?;
    if run.status != "queued"
        || !matches!(
            run.checkpoint.next_action.as_str(),
            "resume-model" | "resume-repair-draft" | "resume-stage"
        )
    {
        return Err(format!(
            "当前恢复点为 {}，不能继续模型阶段。",
            run.checkpoint.next_action
        ));
    }
    run_hermes_agent(
        RunHermesAgentInput {
            request_id: run.request_id.clone(),
            prompt: run.prompt.clone(),
            max_steps: run.max_steps,
            approval_token: String::new(),
            run_id: run.id.clone(),
        },
        runtime_requests,
    )
    .await
}

#[tauri::command]
async fn run_hermes_agent(
    input: RunHermesAgentInput,
    runtime_requests: State<'_, RuntimeRequestState>,
) -> Result<HermesAgentLoopResult, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    let provider = load_or_seed_provider_config(&app_root)?;
    sync_hermes_runtime_config(&provider)?;
    let api_key = read_secret_from_env_or_dotenv(&root, &provider.api_key_env)
        .ok_or_else(|| format!("环境变量或 .env.local 中未设置 {}", provider.api_key_env))?;
    let request_id = input.request_id.trim().to_string();
    let run_id = if !input.run_id.trim().is_empty() {
        input.run_id.trim().to_string()
    } else if request_id.is_empty() {
        format!(
            "agent-{}",
            crate::runtime::provider::current_unix_timestamp()
        )
    } else {
        format!("agent-{request_id}")
    };
    let now = current_timestamp_string();
    let prepared = crate::runtime::agent_runs::prepare_model_run(
        &app_root,
        crate::runtime::agent_runs::PrepareModelRunInput {
            run_id,
            request_id: request_id.clone(),
            project_id: current_project.id.clone(),
            prompt: input.prompt.clone(),
            max_steps: input.max_steps,
            approval_token: input.approval_token.clone(),
            resume_existing: !input.run_id.trim().is_empty(),
        },
        &now,
    )?;
    let execution_prompt = prepared.execution_prompt;
    let running_run = prepared.run;
    let token = if request_id.is_empty() {
        None
    } else {
        Some(runtime_requests.start(&request_id))
    };
    let cancellation = token.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        run_structured_loop(
            &root,
            &api_key,
            &provider.api_base,
            &provider.api_key_env,
            &execution_prompt,
            input.max_steps,
            cancellation.as_ref(),
        )
    })
    .await
    .map_err(|err| format!("Hermes worker 中断: {err}"))?;
    let status = match result.as_ref() {
        Ok(value) if value.status == "awaiting-approval" => "awaiting-approval",
        Ok(value) if value.status == "succeeded" => "succeeded",
        Ok(_) => "failed",
        Err(error) if error.contains("取消") => "cancelled",
        Err(_) => "failed",
    }
    .to_string();
    let step = result.as_ref().ok().map(|value| value.step);
    let summary = result
        .as_ref()
        .map(|value| value.summary.clone())
        .unwrap_or_else(|error| error.to_string());
    let approval = result
        .as_ref()
        .ok()
        .and_then(|value| value.approval.clone());
    let evidence_details = result
        .as_ref()
        .map(|value| {
            json!({
                "step": value.step,
                "trace": value.trace,
                "observations": value.observations,
            })
        })
        .unwrap_or_else(|error| json!({ "error": error.to_string() }));
    crate::runtime::agent_runs::settle_model_run(
        &app_root,
        running_run,
        crate::runtime::agent_runs::ModelRunCompletion {
            status,
            summary,
            step,
            approval,
            evidence_details,
        },
        &current_timestamp_string(),
    )?;
    if !request_id.is_empty() {
        runtime_requests.finish(&request_id);
    }
    result
}

#[tauri::command]
fn get_provider_status() -> Result<ProviderStatus, String> {
    let app_root = find_workspace_root()?;
    let config = load_or_seed_provider_config(&app_root)?;
    sync_hermes_runtime_config(&config)?;
    Ok(provider_status(&app_root, &config))
}

#[tauri::command]
fn get_model_catalog() -> Result<ModelCatalog, String> {
    let app_root = find_workspace_root()?;
    load_or_seed_model_catalog(&app_root)
}

#[tauri::command]
fn get_desktop_theme() -> Result<DesktopThemeConfig, String> {
    let app_root = find_workspace_root()?;
    load_or_seed_desktop_theme(&app_root)
}

#[tauri::command]
fn save_desktop_theme(input: DesktopThemeConfig) -> Result<DesktopThemeConfig, String> {
    let app_root = find_workspace_root()?;
    let config = normalize_desktop_theme(input);
    save_desktop_theme_file(&app_root, &config)?;
    Ok(config)
}

#[tauri::command]
fn save_provider_config(input: ProviderConfigInput) -> Result<ProviderStatus, String> {
    let app_root = find_workspace_root()?;
    let existing = load_or_seed_provider_config(&app_root)?;
    let profile = profile_from_input(
        &input.provider,
        &input.model,
        &input.api_base,
        &input.api_key_env,
        &input.profile_id,
        &input.profile_name,
        &input.profile_note,
        &input.profile_website,
    )?;
    let config = save_provider_config_profile(&existing, profile, input.enabled)?;
    save_provider_config_file(&app_root, &config)?;
    sync_hermes_runtime_config(&config)?;
    Ok(provider_status(&app_root, &config))
}

#[tauri::command]
fn save_provider_secret(input: ProviderSecretInput) -> Result<ProviderStatus, String> {
    let app_root = find_workspace_root()?;
    let existing = load_or_seed_provider_config(&app_root)?;
    let config = crate::runtime::provider::save_secret_and_enable(
        &app_root,
        &existing,
        &input.api_key_env,
        &input.api_key,
    )?;
    sync_hermes_runtime_config(&config)?;
    Ok(provider_status(&app_root, &config))
}

#[tauri::command]
fn delete_provider_profile(input: DeleteProviderProfileInput) -> Result<ProviderStatus, String> {
    let app_root = find_workspace_root()?;
    let existing = load_or_seed_provider_config(&app_root)?;
    let (config, unused_key_env) = delete_provider_config_profile(&existing, &input.profile_id)?;
    if let Some(api_key_env) = unused_key_env {
        crate::runtime::provider::remove_secret(&app_root, &api_key_env)?;
    }

    save_provider_config_file(&app_root, &config)?;
    sync_hermes_runtime_config(&config)?;
    Ok(provider_status(&app_root, &config))
}

#[tauri::command]
fn get_model_health() -> Result<ModelHealthCache, String> {
    let app_root = find_workspace_root()?;
    load_or_seed_model_health(&app_root)
}

#[tauri::command]
async fn probe_provider_models(
    input: ProbeProviderModelsInput,
) -> Result<ProviderModelsProbeResult, String> {
    let app_root = find_workspace_root()?;
    let models = crate::runtime::provider::probe_catalog_with_credential(
        &app_root,
        &input.api_base,
        &input.api_key_env,
        &input.api_key,
    )
    .await?;

    Ok(ProviderModelsProbeResult {
        models,
        source: "/models".to_string(),
    })
}

#[tauri::command]
async fn test_provider_model(
    input: TestProviderModelInput,
) -> Result<ProviderModelTestResult, String> {
    let app_root = find_workspace_root()?;
    let provider = crate::runtime::provider::model_test_config(
        &input.api_base,
        &input.api_key_env,
        &input.model,
    )?;
    crate::runtime::provider::test_connection_with_credential(&app_root, &provider, &input.api_key)
        .await
}

#[tauri::command]
async fn test_provider_model_with_cache(
    input: TestProviderModelInput,
) -> Result<ProviderModelTestResult, String> {
    let app_root = find_workspace_root()?;
    let api_base = input.api_base.trim().to_string();
    let api_key_env = input.api_key_env.trim().to_string();
    let model = input.model.trim().to_string();
    match test_provider_model(input).await {
        Ok(result) => {
            crate::runtime::provider::record_health(
                &app_root,
                ModelHealthEntry {
                    api_base,
                    api_key_env,
                    model: model.clone(),
                    status: "available".to_string(),
                    message: result.message.clone(),
                    checked_at: crate::runtime::provider::current_unix_timestamp(),
                },
            )?;
            Ok(result)
        }
        Err(err) => {
            crate::runtime::provider::record_health(
                &app_root,
                ModelHealthEntry {
                    api_base,
                    api_key_env,
                    model,
                    status: crate::runtime::provider::classify_failure(&err).to_string(),
                    message: err.clone(),
                    checked_at: crate::runtime::provider::current_unix_timestamp(),
                },
            )?;
            Err(err)
        }
    }
}

async fn prepare_provider_for_request(
    app_root: &Path,
    configured: &ProviderConfig,
    excluded_profile_ids: &HashSet<String>,
) -> Result<(ProviderConfig, String), String> {
    let result =
        crate::runtime::provider::prepare_for_request(app_root, configured, excluded_profile_ids)
            .await?;
    #[cfg(not(test))]
    if result.0.active_profile_id != configured.active_profile_id {
        sync_hermes_runtime_config(&result.0)?;
    }
    Ok(result)
}

#[tauri::command]
fn run_guarded_check(
    input: RunGuardedCheckInput,
) -> Result<crate::runtime::execution::GuardedCheckResult, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    crate::runtime::execution::run_guarded_check(
        &root,
        &input.check_id,
        &current_timestamp_string(),
    )
}

#[tauri::command]
fn get_hermes_executor_status() -> crate::runtime::hermes_protocol::ExecutorStatus {
    hermes_executor_status()
}

#[tauri::command]
fn save_terminal_image(input: SaveTerminalImageInput) -> Result<String, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    crate::runtime::terminal::save_image(&root, &input.name, &input.data_url)
}

#[tauri::command]
fn start_terminal_session(
    app: AppHandle,
    state: State<TerminalState>,
    input: crate::runtime::terminal::StartTerminalSessionInput,
) -> Result<crate::runtime::terminal::TerminalSessionResult, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    crate::runtime::terminal::start_session(app, &state, root, input)
}

#[tauri::command]
fn write_terminal_session(
    state: State<TerminalState>,
    input: crate::runtime::terminal::WriteTerminalSessionInput,
) -> Result<(), String> {
    crate::runtime::terminal::write_session(&state, input)
}

#[tauri::command]
fn resize_terminal_session(
    state: State<TerminalState>,
    input: crate::runtime::terminal::ResizeTerminalSessionInput,
) -> Result<(), String> {
    crate::runtime::terminal::resize_session(&state, input)
}

#[tauri::command]
fn stop_terminal_session(
    state: State<TerminalState>,
    input: crate::runtime::terminal::StopTerminalSessionInput,
) -> Result<(), String> {
    crate::runtime::terminal::stop_session(&state, input)
}

#[cfg(feature = "webdriver")]
#[tauri::command]
fn record_native_terminal_trace(stage: String) -> Result<(), String> {
    let root = find_workspace_root()?;
    crate::runtime::terminal::record_native_trace(&root, &stage, &current_timestamp_string())
}

#[cfg(feature = "webdriver")]
#[tauri::command]
fn seed_native_agent_run_for_recovery(
) -> Result<crate::runtime::agent_runs::PersistedAgentRun, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let project = current_registry_project(&mut registry, &app_root)?;
    let timestamp = current_timestamp_string();
    crate::runtime::agent_runs::seed_native_recovery_run(&app_root, project.id, &timestamp)
}

#[cfg(feature = "webdriver")]
#[tauri::command]
fn read_native_agent_run_for_recovery(
) -> Result<crate::runtime::agent_runs::PersistedAgentRun, String> {
    let app_root = find_workspace_root()?;
    crate::runtime::agent_runs::load(&app_root, "native-recovery-run")
}

fn find_workspace_root() -> Result<PathBuf, String> {
    #[cfg(feature = "webdriver")]
    if let Some(test_root) = std::env::var_os("OMNIDESK_WEBDRIVER_WORKSPACE_ROOT") {
        let root = fs::canonicalize(PathBuf::from(test_root))
            .map_err(|err| format!("WebDriver 测试工作区不可用：{err}"))?;
        if root.join("AGENTS.md").exists() && root.join("PROJECT.md").exists() {
            return Ok(root);
        }
        return Err("WebDriver 测试工作区缺少 AGENTS.md 或 PROJECT.md".to_string());
    }

    let mut current = std::env::current_dir().map_err(|err| err.to_string())?;

    loop {
        if current.join("AGENTS.md").exists() && current.join("PROJECT.md").exists() {
            return Ok(current);
        }
        if !current.pop() {
            break;
        }
    }

    let mut build_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    loop {
        if build_root.join("AGENTS.md").exists() && build_root.join("PROJECT.md").exists() {
            return Ok(build_root);
        }
        if !build_root.pop() {
            break;
        }
    }

    Err("未找到 OmniDesk 工作区根目录".to_string())
}

#[cfg(test)]
fn read_json(path: PathBuf) -> Option<Value> {
    fs::read_to_string(path)
        .ok()
        .and_then(|content| serde_json::from_str(&content).ok())
}

#[cfg(test)]
fn write_file_atomic(path: &Path, content: &[u8]) -> Result<(), String> {
    crate::runtime::repository::write_atomic(path, content)
}

fn current_timestamp_string() -> String {
    Command::new("date")
        .arg("-u")
        .arg("+%Y-%m-%dT%H:%M:%SZ")
        .output()
        .ok()
        .and_then(|output| {
            output
                .status
                .success()
                .then(|| String::from_utf8_lossy(&output.stdout).trim().to_string())
        })
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "unknown".to_string())
}

fn load_or_seed_model_catalog(app_root: &Path) -> Result<ModelCatalog, String> {
    crate::runtime::provider::load_or_seed_catalog(app_root)
}

fn load_or_seed_provider_config(app_root: &Path) -> Result<ProviderConfig, String> {
    let mut config = crate::runtime::provider::load_or_seed_config(app_root)?;
    if isolate_duplicate_provider_secrets(app_root, &mut config)? {
        crate::runtime::provider::save_config(app_root, &config)?;
    }
    Ok(config)
}

fn save_provider_config_file(app_root: &Path, config: &ProviderConfig) -> Result<(), String> {
    crate::runtime::provider::save_config(app_root, config)
}

fn sync_hermes_runtime_config(config: &ProviderConfig) -> Result<(), String> {
    crate::runtime::provider::sync_hermes_runtime_config(config)
}

fn load_or_seed_model_health(app_root: &Path) -> Result<ModelHealthCache, String> {
    crate::runtime::provider::load_or_seed_health(app_root)
}

fn provider_status(app_root: &Path, config: &ProviderConfig) -> ProviderStatus {
    let (workspace_root, revision) = provider_status_source(app_root);
    provider_status_projection(config, workspace_root, revision, |api_key_env| {
        read_secret_from_env_or_dotenv(app_root, api_key_env)
            .is_some_and(|value| !value.trim().is_empty())
    })
}

fn read_secret_from_env_or_dotenv(root: &Path, key: &str) -> Option<String> {
    crate::runtime::provider::read_secret(root, key)
}

#[tauri::command]
fn copy_text_to_clipboard(text: String) -> Result<(), String> {
    crate::runtime::system_integration::copy_text_to_clipboard(&text)
}

#[cfg(test)]
mod task_storage_tests {
    use super::*;

    fn test_directory(label: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        std::env::temp_dir().join(format!("project-os-{label}-{}-{nonce}", std::process::id()))
    }

    #[test]
    fn atomic_write_replaces_task_without_temp_residue() {
        let dir = test_directory("atomic-task");
        fs::create_dir_all(&dir).unwrap();
        let target = dir.join("task.json");
        write_file_atomic(&target, br#"{"id":"task-1"}\n"#).unwrap();
        assert_eq!(fs::read_to_string(&target).unwrap(), r#"{"id":"task-1"}\n"#);
        let files = fs::read_dir(&dir).unwrap().count();
        assert_eq!(files, 1);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn legacy_theme_is_projected_without_startup_rewrite() {
        let root = test_directory("legacy-desktop-records");
        fs::create_dir_all(root.join(".omnidesk/data")).unwrap();
        fs::write(
            root.join(crate::runtime::theme::THEME_PATH),
            r#"{"schemaVersion":"project-os.desktop-theme.v0.1","mode":"dark","accent":{"id":"mint","label":"Mint","h":160,"s":"80%","l":"47%"}}"#,
        )
        .unwrap();
        let theme = load_or_seed_desktop_theme(&root).unwrap();
        assert_eq!(theme.schema_version, crate::runtime::theme::SCHEMA_VERSION);
        assert!(
            fs::read_to_string(root.join(crate::runtime::theme::THEME_PATH))
                .unwrap()
                .contains(crate::runtime::theme::LEGACY_SCHEMA_VERSION)
        );

        save_desktop_theme_file(&root, &theme).unwrap();
        assert!(
            fs::read_to_string(root.join(crate::runtime::theme::THEME_PATH))
                .unwrap()
                .contains(crate::runtime::theme::SCHEMA_VERSION)
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn workspace_tree_hides_runtime_and_generated_assets() {
        let dir = test_directory("tree-asset-policy");
        fs::create_dir_all(dir.join("src")).unwrap();
        fs::create_dir_all(dir.join(".omnidesk/runtime/events")).unwrap();
        fs::create_dir_all(dir.join(".omnidesk/data")).unwrap();
        fs::create_dir_all(dir.join("tmp")).unwrap();
        fs::create_dir_all(dir.join("target")).unwrap();
        fs::write(dir.join("src/main.rs"), "fn main() {}\n").unwrap();
        fs::write(dir.join(".env.local"), "SECRET=local\n").unwrap();
        fs::write(dir.join(".env.example"), "SECRET=\n").unwrap();

        let labels = crate::runtime::workspace::build_tree_preview(&dir)
            .into_iter()
            .map(|item| item.label)
            .collect::<Vec<_>>();

        assert!(labels.contains(&"src".to_string()));
        assert!(labels.contains(&".env.example".to_string()));
        assert!(!labels.contains(&".omnidesk".to_string()));
        assert!(!labels.contains(&"tmp".to_string()));
        assert!(!labels.contains(&"target".to_string()));
        assert!(!labels.contains(&".env.local".to_string()));
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn hermes_diff_rejects_unapproved_files_and_keeps_approved_paths() {
        let context = vec![(
            "desktop/src/example.js".to_string(),
            "export const value = 1;".to_string(),
        )];
        let safe = "--- a/desktop/src/example.js\n+++ b/desktop/src/example.js\n@@ -1 +1 @@\n-export const value = 1;\n+export const value = 2;\n";
        assert_eq!(
            crate::runtime::patch::normalize_hermes_unified_diff(safe, &context).unwrap(),
            safe.to_string()
        );

        let unsafe_diff = "--- a/.env.local\n+++ b/.env.local\n@@ -1 +1 @@\n-OLD\n+NEW\n";
        assert!(
            crate::runtime::patch::normalize_hermes_unified_diff(unsafe_diff, &context).is_err()
        );
    }

    #[test]
    fn native_patch_validation_rejects_secret_and_escape_paths_before_approval() {
        let safe = "--- a/README.md\n+++ b/README.md\n@@ -1 +1 @@\n-old\n+new\n";
        assert!(crate::runtime::patch::validate_apply_diff_paths(safe).is_ok());

        let env = "--- a/.env.local\n+++ b/.env.local\n@@ -1 +1 @@\n-old\n+new\n";
        assert!(crate::runtime::patch::validate_apply_diff_paths(env).is_err());

        let escape = "--- a/README.md\n+++ ../outside.md\n@@ -1 +1 @@\n-old\n+new\n";
        assert!(crate::runtime::patch::validate_apply_diff_paths(escape).is_err());
    }

    #[test]
    fn hermes_diff_repairs_only_inconsistent_hunk_counts_for_authorized_context() {
        let context = vec![(
            "README.md".to_string(),
            "# Demo\n\nRun the project checks with:\n\n```sh\nnpm run old-check\n```\n".to_string(),
        )];
        let malformed = "--- a/README.md\n+++ b/README.md\n@@ -2,5 +2,5 @@\n \n Run the project checks with:\n \n ```sh\n-npm run old-check\n+npm test\n ```\n";
        let normalized =
            crate::runtime::patch::normalize_hermes_unified_diff(malformed, &context).unwrap();
        assert!(normalized.contains("@@ -2,6 +2,6 @@"));
        assert!(!normalized.contains("@@ -2,5 +2,5 @@"));
    }

    #[test]
    fn hermes_diff_relocates_a_uniquely_matched_authorized_hunk() {
        let context = vec![(
            "README.md".to_string(),
            "# Eval Fixture\n\nRun the project checks with:\n\n```sh\nnpm run old-check\n```\n"
                .to_string(),
        )];
        let misplaced =
            "--- a/README.md\n+++ b/README.md\n@@ -1,1 +1,1 @@\n-npm run old-check\n+npm test\n";
        let normalized =
            crate::runtime::patch::normalize_hermes_unified_diff(misplaced, &context).unwrap();
        assert!(normalized.contains("@@ -5,3 +5,3 @@"));
    }

    #[test]
    fn normalized_hermes_readme_fixture_passes_git_apply_check() {
        let dir = test_directory("hermes-readme-apply");
        fs::create_dir_all(&dir).unwrap();
        let init = Command::new("git")
            .args(["init", "-q"])
            .current_dir(&dir)
            .output()
            .unwrap();
        assert!(init.status.success());
        let readme =
            "# Eval Fixture\n\nRun the project checks with:\n\n```sh\nnpm run old-check\n```\n";
        fs::write(dir.join("README.md"), readme).unwrap();
        let add = Command::new("git")
            .args(["add", "README.md"])
            .current_dir(&dir)
            .output()
            .unwrap();
        assert!(add.status.success());
        let commit = Command::new("git")
            .args([
                "-c",
                "user.name=OmniDesk Eval",
                "-c",
                "user.email=eval@omnidesk.local",
                "commit",
                "-qm",
                "seed README fixture",
            ])
            .current_dir(&dir)
            .output()
            .unwrap();
        assert!(commit.status.success());
        let contexts = vec![("README.md".to_string(), readme.to_string())];
        let historical_model_output =
            "--- README.md\n+++ README.md\n@@ -1,1 +1,1 @@\n-npm run old-check\n+npm test\n";
        let normalized = crate::runtime::patch::normalize_hermes_unified_diff(
            historical_model_output,
            &contexts,
        )
        .unwrap();
        let check = run_git_apply(&dir, &normalized, true).unwrap();
        assert!(
            check.status.success(),
            "{}\n{}\n{}",
            normalized,
            String::from_utf8_lossy(&check.stdout),
            String::from_utf8_lossy(&check.stderr)
        );
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn hermes_diff_rejects_malformed_hunks_and_non_matching_header_paths() {
        let context = vec![("README.md".to_string(), "# Demo\n".to_string())];
        let malformed_hunk = "--- a/README.md\n+++ b/README.md\n@@ -1 +1 @@\nnot a diff line\n";
        assert!(
            crate::runtime::patch::normalize_hermes_unified_diff(malformed_hunk, &context).is_err()
        );

        let mismatched_paths = "--- a/README.md\n+++ b/.env.local\n@@ -1 +1 @@\n-OLD\n+NEW\n";
        assert!(
            crate::runtime::patch::normalize_hermes_unified_diff(mismatched_paths, &context)
                .is_err()
        );
    }

    #[test]
    fn hermes_permission_rejection_uses_acp_cancelled_outcome() {
        let rejection = crate::runtime::hermes_protocol::rejection_response(42);
        assert_eq!(rejection.get("id").and_then(Value::as_u64), Some(42));
        assert_eq!(
            rejection
                .pointer("/result/outcome/outcome")
                .and_then(Value::as_str),
            Some("cancelled")
        );
    }

    #[test]
    fn structured_hermes_envelope_accepts_json_wrappers_and_rejects_unknown_shape() {
        let value = extract_structured_hermes_envelope(
            "```json\n{\"type\":\"tool_call\",\"name\":\"read_file\"}\n```",
        )
        .unwrap();
        assert_eq!(value.get("type").and_then(Value::as_str), Some("tool_call"));
        assert!(extract_structured_hermes_envelope("plain text without json").is_err());
    }

    #[test]
    fn hermes_custom_provider_key_matches_the_gateway_host() {
        assert_eq!(
            hermes_custom_provider_key_env("https://aihub.firstshare.cn/v1"),
            Some("FIRSTSHARE_API_KEY".to_string())
        );
        assert_eq!(
            hermes_custom_provider_key_env("https://api.openai.com/v1"),
            None
        );
    }

    #[test]
    fn provider_profile_candidate_keeps_credentials_isolated_and_switchable() {
        let primary = ProviderProfile {
            id: "tw".to_string(),
            name: "TW Gateway".to_string(),
            note: String::new(),
            website: String::new(),
            provider: "openai-compatible".to_string(),
            model: "gpt-5.6-terra".to_string(),
            api_base: "https://gateway.example/v1".to_string(),
            api_key_env: "TW_KEY".to_string(),
        };
        let fallback = ProviderProfile {
            id: "qy".to_string(),
            name: "QY".to_string(),
            note: String::new(),
            website: String::new(),
            provider: "openai-compatible".to_string(),
            model: "gpt-5.5".to_string(),
            api_base: "https://gateway.example/v1".to_string(),
            api_key_env: "QY_KEY".to_string(),
        };
        let config = ProviderConfig {
            schema_version: "project-os.desktop-provider.v0.1".to_string(),
            provider: primary.provider.clone(),
            model: primary.model.clone(),
            api_base: primary.api_base.clone(),
            api_key_env: primary.api_key_env.clone(),
            enabled: true,
            active_profile_id: primary.id.clone(),
            profiles: vec![primary, fallback.clone()],
        };
        let candidate = crate::runtime::provider::profile_config(&config, &fallback);
        assert_eq!(candidate.active_profile_id, "qy");
        assert_eq!(candidate.api_key_env, "QY_KEY");
        assert_eq!(candidate.model, "gpt-5.5");
        assert_eq!(candidate.profiles.len(), 2);
    }

    #[test]
    fn hermes_runtime_sync_replaces_only_the_shared_model_fields() {
        let config = ProviderConfig {
            schema_version: "project-os.desktop-provider.v0.1".to_string(),
            provider: "openai-compatible".to_string(),
            model: "gpt-5.6-terra".to_string(),
            api_base: "https://aihub.firstshare.cn/v1".to_string(),
            api_key_env: "LLM_GATEWAY_API_KEY".to_string(),
            enabled: true,
            active_profile_id: "gateway".to_string(),
            profiles: Vec::new(),
        };
        let current = "model:\n  provider: custom\n  default: gpt-5.5\n  max_tokens: 4096\ndisplay:\n  tool_progress: all\n";
        let rendered =
            crate::runtime::provider::render_hermes_runtime_config(current, &config).unwrap();
        assert!(rendered.contains("default: \"gpt-5.6-terra\""));
        assert!(rendered.contains("provider: \"omnidesk-gateway\""));
        assert!(rendered.contains("base_url: \"https://aihub.firstshare.cn/v1\""));
        assert!(rendered.contains("key_env: \"LLM_GATEWAY_API_KEY\""));
        assert!(rendered.contains("providers:\n  omnidesk-gateway:"));
        assert!(rendered.contains("default_model: \"gpt-5.6-terra\""));
        assert!(rendered.contains("max_tokens: 4096"));
        assert!(rendered.contains("display:\n  tool_progress: all"));
        assert!(!rendered.contains("default: gpt-5.5"));
    }

    #[test]
    fn hermes_runtime_sync_updates_the_existing_gateway_provider() {
        let config = ProviderConfig {
            schema_version: "project-os.desktop-provider.v0.1".to_string(),
            provider: "openai-compatible".to_string(),
            model: "gpt-5.6-terra".to_string(),
            api_base: "https://aihub.firstshare.cn/v1".to_string(),
            api_key_env: "LLM_GATEWAY_API_KEY".to_string(),
            enabled: true,
            active_profile_id: "gateway".to_string(),
            profiles: Vec::new(),
        };
        let current = "providers:\n  omnidesk-gateway:\n    base_url: \"https://old.example/v1\"\n    default_model: \"old-model\"\n    timeout: 30\n  another-provider:\n    base_url: \"https://other.example/v1\"\n";
        let rendered =
            crate::runtime::provider::render_hermes_runtime_config(current, &config).unwrap();
        assert!(rendered.contains("base_url: \"https://aihub.firstshare.cn/v1\""));
        assert!(rendered.contains("default_model: \"gpt-5.6-terra\""));
        assert!(rendered.contains("key_env: \"LLM_GATEWAY_API_KEY\""));
        assert!(rendered.contains("    timeout: 30"));
        assert!(
            rendered.contains("  another-provider:\n    base_url: \"https://other.example/v1\"")
        );
        assert!(!rendered.contains("https://old.example/v1"));
    }

    #[test]
    fn runtime_request_cancellation_is_scoped_and_cleaned_up() {
        let state = RuntimeRequestState::default();
        let token = state.start("request-1");
        assert!(state.cancel("request-1"));
        assert!(token.is_cancelled());
        state.finish("request-1");
        assert!(!state.cancel("request-1"));
    }

    #[test]
    fn task_goal_index_moves_a_task_to_its_current_goal() {
        let root = test_directory("task-goal-index");
        let omnidesk = root.join(".omnidesk/data");
        fs::create_dir_all(&omnidesk).unwrap();
        fs::write(
            omnidesk.join("goals.json"),
            serde_json::to_string_pretty(&json!({
                "schemaVersion": "project-os.goals.v0.1",
                "goals": [
                    { "id": "goal-a", "taskIds": ["task-1", "legacy-task"] },
                    { "id": "goal-b", "taskIds": ["task-1"] }
                ]
            }))
            .unwrap(),
        )
        .unwrap();

        sync_task_goal_index(&root, "task-1", "goal-b", "2026-07-18T00:00:00Z").unwrap();

        let goals = read_json(omnidesk.join("goals.json")).unwrap();
        let items = goals.get("goals").and_then(Value::as_array).unwrap();
        assert_eq!(items[0].get("taskIds").unwrap(), &json!(["legacy-task"]));
        assert_eq!(items[1].get("taskIds").unwrap(), &json!(["task-1"]));
        fs::remove_dir_all(root).unwrap();
    }
}

pub fn run() {
    recover_runtime_transactions_on_start();
    let builder = tauri::Builder::default()
        .manage(TerminalState::default())
        .manage(RuntimeRequestState::default())
        .manage(WorkspaceWatcherState::default())
        .plugin(tauri_plugin_dialog::init());
    // The embedded WebDriver is opt-in for dedicated test builds only.
    // Release and ordinary development builds never expose this HTTP endpoint.
    #[cfg(feature = "webdriver")]
    let builder = builder.plugin(tauri_plugin_wdio_webdriver::init());
    builder
        .invoke_handler(tauri::generate_handler![
            get_workspace_snapshot,
            update_project_capability,
            archive_legacy_state_for_retirement,
            cleanup_legacy_state_for_retirement,
            refresh_workspace_facts_preview,
            start_workspace_file_watcher,
            add_registry_project,
            preview_project_path,
            switch_registry_project,
            rename_registry_project,
            relocate_registry_project,
            remove_registry_project,
            open_project_folder,
            chat_with_model,
            cancel_runtime_request,
            generate_readonly_plan,
            generate_patch_draft,
            apply_patch_draft,
            write_run_summary,
            merge_run_summary_to_handoff,
            list_desktop_tasks,
            save_desktop_task,
            delete_desktop_task,
            list_desktop_conversations,
            save_desktop_conversation,
            delete_desktop_conversation,
            get_project_memory,
            save_project_memory,
            run_goal_validation,
            sign_off_goal_validation,
            create_goal,
            update_goal,
            archive_goal,
            restore_goal,
            merge_goal,
            switch_active_goal,
            confirm_goal,
            confirm_goal_decomposition,
            update_task_backlog_item,
            update_project_profile_from_conversation,
            copy_text_to_clipboard,
            get_model_catalog,
            get_desktop_theme,
            save_desktop_theme,
            get_provider_status,
            save_provider_config,
            save_provider_secret,
            delete_provider_profile,
            get_model_health,
            probe_provider_models,
            test_provider_model,
            test_provider_model_with_cache,
            open_native_terminal,
            read_engineering_file,
            execute_agent_read_tool,
            run_hermes_agent,
            list_agent_runs,
            resume_agent_run,
            continue_agent_run,
            approve_agent_run,
            execute_approved_agent_tool,
            run_guarded_check,
            get_hermes_executor_status,
            start_terminal_session,
            save_terminal_image,
            write_terminal_session,
            resize_terminal_session,
            stop_terminal_session,
            #[cfg(feature = "webdriver")]
            record_native_terminal_trace,
            #[cfg(feature = "webdriver")]
            seed_native_agent_run_for_recovery,
            #[cfg(feature = "webdriver")]
            read_native_agent_run_for_recovery
        ])
        .run(tauri::generate_context!())
        .expect("failed to run OmniDesk");
}

/// Recovery belongs to process startup, not the next state mutation. A crash
/// between files must be repaired before the UI reads any project snapshot.
fn recover_runtime_transactions_on_start() {
    let Ok(app_root) = find_workspace_root() else {
        return;
    };
    prepare_state_namespace(&app_root);
    let mut roots = vec![app_root.clone()];
    if let Ok(registry) = load_or_seed_registry(&app_root) {
        for project in registry.projects {
            let root = PathBuf::from(project.path);
            if !roots.contains(&root) {
                roots.push(root);
            }
        }
    }
    for root in roots {
        prepare_state_namespace(&root);
    }
    if let Err(error) =
        crate::runtime::agent_runs::recover_stale(&app_root, &current_timestamp_string())
    {
        eprintln!("OmniDesk Agent Run 恢复失败：{error}");
    }
}

fn prepare_state_namespace(root: &Path) {
    match crate::runtime::state_namespace::recover_and_activate_runtime_state(root) {
        Ok(outcome) if !outcome.conflicts.is_empty() => {
            eprintln!(
                "OmniDesk 状态迁移存在 {} 个冲突，继续使用旧命名空间（{}）",
                outcome.conflicts.len(),
                root.display()
            );
        }
        Ok(_) => {}
        Err(error) => {
            eprintln!("OmniDesk 状态初始化失败（{}）：{}", root.display(), error);
        }
    }
}
