use crate::runtime::agent_runs::PersistedAgentRun;
use crate::runtime::chat_content::{
    chat_router_prompt, local_chat_result, project_evidence, references_for_message, ChatTurnInput,
    ChatWithModelResult, DialogueContextInput,
};
use crate::runtime::chat_routing::should_create_plan_for_message;
use crate::runtime::chat_runtime::{emit_conversation_event, RuntimeRequestState};
use crate::runtime::chat_stream::{consume_openai_sse_deltas, streaming_reply_prefix};
use crate::runtime::execution::{
    build_run_summary_markdown, guarded_check_spec, run_git_apply, trim_runner_output,
};
use crate::runtime::hermes_protocol::{
    acp_program as hermes_acp_program, custom_provider_key_env as hermes_custom_provider_key_env,
    executor_status as hermes_executor_status,
    extract_structured_envelope as extract_structured_hermes_envelope,
    wait_for_response as hermes_wait_for_response, write_request as hermes_write_request,
};
use crate::runtime::patch::PatchDraft;
use crate::runtime::planning::{
    build_local_readonly_plan, generate_provider_plan, PlanAttachment, PlanContext, ReadonlyPlan,
};
use crate::runtime::provider::{
    chat_completion_content, get_models, health_entry as provider_health_entry,
    health_is_fresh as provider_health_is_fresh, isolate_duplicate_provider_secrets, listed_models,
    ordered_profile_candidates, post_chat_completion, provider_profile_id, provider_profile_name,
    require_success as require_provider_success, trim_for_trace, upsert_provider_profile,
    ModelCatalog, ModelHealthCache, ModelHealthEntry, ProviderConfig, ProviderProfile,
    PROVIDER_SCHEMA_VERSION,
};
use crate::runtime::terminal::TerminalState;
use crate::runtime::theme::{DesktopThemeConfig, load_or_seed as load_or_seed_desktop_theme, normalize as normalize_desktop_theme, save as save_desktop_theme_file};
use crate::runtime::workspace::{
    build_project_profile, runbook_commands, ProjectProfile, TreeEntry,
    RegistryProjectRecord, current_registry_project,
    default_project_access_mode, load_or_seed_registry, normalize_project_access_mode,
    normalize_project_path, project_id_from_path, registry_project_summaries, save_registry,
    RegistryProjectSummary,
};
use futures_util::StreamExt;
use notify::{
    Config as NotifyConfig, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashSet;
use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{mpsc, Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, State};
use tokio_util::sync::CancellationToken;

const STATE_PATH: &str = ".omnidesk/data/state.json";
const GOALS_PATH: &str = ".omnidesk/data/goals.json";
const RUN_SUMMARY_PATH: &str = ".omnidesk/evidence/desktop-summary.md";
const PROVIDER_PATH: &str = ".omnidesk/data/desktop-provider.json";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct QueueItem {
    id: String,
    title: String,
    status: String,
    body: String,
    tone: String,
    goal_id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MemoryItem {
    marker: String,
    title: String,
    body: String,
    muted: bool,
}

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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceSnapshot {
    project_name: String,
    current_project_id: String,
    current_project_path: String,
    phase: String,
    stage: String,
    file_count: usize,
    docs_count: usize,
    recommendation_count: usize,
    run_count: usize,
    projects: Vec<RegistryProjectSummary>,
    tree: Vec<TreeEntry>,
    queue: Vec<QueueItem>,
    memory: Vec<MemoryItem>,
    project_profile: ProjectProfile,
    workspace_facts: Value,
    runbook_commands: Value,
    project_capabilities: Value,
    fact_freshness: Value,
    goal_validation: Value,
    goal_validation_report: Value,
    goal_signoff_history: Value,
    goals: Value,
    project_goals: Value,
    state_retirement: Value,
    trace: Vec<String>,
}

struct WorkspaceWatcherState {
    watcher: Mutex<Option<RecommendedWatcher>>,
    root: Mutex<String>,
}

impl Default for WorkspaceWatcherState {
    fn default() -> Self {
        Self {
            watcher: Mutex::new(None),
            root: Mutex::new(String::new()),
        }
    }
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProviderStatus {
    provider: String,
    model: String,
    api_base: String,
    api_key_env: String,
    enabled: bool,
    has_api_key: bool,
    active_profile_id: String,
    profiles: Vec<ProviderProfileStatus>,
    source: String,
    workspace_root: String,
    revision: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProviderProfileStatus {
    id: String,
    name: String,
    note: String,
    website: String,
    provider: String,
    model: String,
    api_base: String,
    api_key_env: String,
    has_api_key: bool,
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HermesAgentLoopResult {
    status: String,
    summary: String,
    step: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    approval: Option<Value>,
    observations: Vec<Value>,
    trace: Vec<String>,
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
struct EngineeringFilePreview {
    path: String,
    name: String,
    content: String,
    language: String,
    truncated: bool,
    size: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ApplyPatchResult {
    success: bool,
    message: String,
    output: String,
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

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct GuardedCheckResult {
    id: String,
    label: String,
    command: String,
    success: bool,
    code: Option<i32>,
    output: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct WorkspaceFilesChangedEvent {
    path: String,
    root: String,
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProviderModelTestResult {
    model: String,
    success: bool,
    message: String,
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
    let projection = crate::runtime::workspace::load_projection_state(&root);
    let state = projection.state;
    let recommendations = projection.recommendations;
    let task_backlog = projection.task_backlog;
    let goal_validation = projection.goal_validation;
    let goal_validation_report = projection.goal_validation_report;
    let goal_signoff_history = projection.goal_signoff_history;
    let workspace_facts = projection.workspace_facts;
    let project_capabilities = crate::runtime::workspace::detected_capabilities(&root);
    let fact_freshness = crate::runtime::workspace::fact_freshness(&root);
    let state_retirement =
        serde_json::to_value(crate::runtime::state_namespace::legacy_retirement_readiness(&root)?)
            .map_err(|error| error.to_string())?;
    let run_count = count_run_records(&root);
    let (file_count, docs_count) = crate::runtime::workspace::count_visible_files(&root);

    let project_name = current_project.name.clone();
    let goals = projection.goals.unwrap_or_else(|| {
        goal_stack_from_validation(
            &goal_validation,
            &goal_validation_report,
            &goal_signoff_history,
            &project_name,
        )
    });
    let project_goals = projection.project_goals;
    let phase = state
        .as_ref()
        .and_then(|json| json.get("phase"))
        .and_then(Value::as_str)
        .unwrap_or(&current_project.phase)
        .to_string();
    let stage = state
        .as_ref()
        .and_then(|json| json.get("stage"))
        .and_then(Value::as_str)
        .unwrap_or("未读取到阶段信息")
        .to_string();

    let recommendation_count = recommendations
        .as_ref()
        .and_then(|json| json.pointer("/summary/recommendationCount"))
        .and_then(Value::as_u64)
        .unwrap_or(0) as usize;

    let mut queue = task_backlog_queue(&task_backlog);
    queue.extend(recommendation_queue(&recommendations));
    if queue.is_empty() {
        queue.push(QueueItem {
            id: "registry-next-step".to_string(),
            title: "接入本地项目 registry".to_string(),
            status: "建议下一步".to_string(),
            body: "让桌面工作台记住已接入项目，并作为后续模型计划层的入口。".to_string(),
            tone: "blue".to_string(),
            goal_id: String::new(),
        });
    }

    Ok(WorkspaceSnapshot {
        project_name: project_name.clone(),
        current_project_id: current_project.id.clone(),
        current_project_path: current_project.path.clone(),
        phase: phase.clone(),
        stage: stage.clone(),
        file_count,
        docs_count,
        recommendation_count,
        run_count,
        projects: registry_project_summaries(&registry),
        tree: crate::runtime::workspace::build_tree_preview(&root),
        queue,
        memory: vec![
            MemoryItem {
                marker: "Δ".to_string(),
                title: "已学习方向".to_string(),
                body: "用户希望 OmniDesk 成为长期使用的本地 AI 工程工作台。".to_string(),
                muted: false,
            },
            MemoryItem {
                marker: "Σ".to_string(),
                title: "执行边界".to_string(),
                body: "Tauri + Local Agent Core；模型密钥、文件读取和命令执行留在本地 core。"
                    .to_string(),
                muted: true,
            },
        ],
        project_profile: build_project_profile(&root, &project_name),
        workspace_facts,
        runbook_commands: runbook_commands(&root),
        project_capabilities,
        fact_freshness,
        goal_validation,
        goal_validation_report,
        goal_signoff_history,
        goals,
        project_goals,
        state_retirement,
        trace: vec![
            format!("ROOT: {}", root.display()),
            format!("REGISTRY: {} project(s)", registry.projects.len()),
            format!("STATE: {} / {}", project_name, phase),
            format!("STAGE: {}", stage),
            format!(
                "INDEX: {} files, {} docs, {} run records",
                file_count, docs_count, run_count
            ),
        ],
    })
}

#[tauri::command]
fn refresh_workspace_facts_preview() -> Result<Value, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    let report = crate::runtime::workspace::build_workspace_facts_preview(&root, &current_project.name);
    crate::runtime::workspace::record_fact_freshness(&root, &current_timestamp_string())?;
    Ok(report)
}

fn should_ignore_watch_path(path: &Path) -> bool {
    let in_runtime_state = path.components().any(|component| {
        matches!(
            component.as_os_str().to_string_lossy().as_ref(),
            ".project-os" | ".omnidesk"
        )
    });
    let fact_file = path
        .file_name()
        .and_then(|value| value.to_str())
        .map(|name| {
            matches!(
                name,
                "README.md"
                    | "PROJECT.md"
                    | "HANDOFF.md"
                    | "AGENTS.md"
                    | "package.json"
                    | "Cargo.toml"
                    | "schema.sql"
            )
        })
        .unwrap_or(false);
    let fact_directory = path.components().any(|component| {
        matches!(
            component.as_os_str().to_string_lossy().as_ref(),
            "src"
                | "src-tauri"
                | "server"
                | "backend"
                | "api"
                | "prisma"
                | "migrations"
                | "tests"
                | "workflows"
        )
    });
    if !in_runtime_state && !fact_file && !fact_directory {
        return true;
    }
    path.components().any(|component| {
        let name = component.as_os_str().to_string_lossy();
        matches!(
            name.as_ref(),
            ".git"
                | "node_modules"
                | "target"
                | "dist"
                | "build"
                | ".next"
                | ".nuxt"
                | ".vite"
                | ".turbo"
                | ".cache"
                | "coverage"
                | ".DS_Store"
                | "entry-contexts"
                | "locks"
        )
    }) || path
        .file_name()
        .and_then(|value| value.to_str())
        .map(|name| {
            name.starts_with(".env") || name.ends_with(".lock") || name == "desktop-theme.json"
        })
        .unwrap_or(false)
}

fn watch_event_should_refresh(event: &Event) -> bool {
    matches!(
        event.kind,
        EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_) | EventKind::Any
    ) && event
        .paths
        .iter()
        .any(|path| !should_ignore_watch_path(path))
}

#[tauri::command]
fn start_workspace_file_watcher(
    app: AppHandle,
    state: State<WorkspaceWatcherState>,
) -> Result<String, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path)
        .canonicalize()
        .map_err(|err| format!("项目目录不可访问: {}", err))?;
    let root_text = root.to_string_lossy().to_string();

    {
        let current_root = state.root.lock().map_err(|err| err.to_string())?;
        if *current_root == root_text {
            return Ok(root_text);
        }
    }

    let last_emit = Arc::new(Mutex::new(Instant::now() - Duration::from_secs(10)));
    let emit_root = root.clone();
    let emit_root_text = root_text.clone();
    let emit_app = app.clone();
    let emit_guard = Arc::clone(&last_emit);
    let mut watcher = RecommendedWatcher::new(
        move |result: Result<Event, notify::Error>| {
            let Ok(event) = result else {
                return;
            };
            if !watch_event_should_refresh(&event) {
                return;
            }
            let Ok(mut last) = emit_guard.lock() else {
                return;
            };
            if last.elapsed() < Duration::from_millis(1200) {
                return;
            }
            *last = Instant::now();
            let relative = event
                .paths
                .iter()
                .find(|path| !should_ignore_watch_path(path))
                .and_then(|path| path.strip_prefix(&emit_root).ok())
                .map(|path| path.to_string_lossy().replace('\\', "/"))
                .unwrap_or_else(|| "project".to_string());
            let _ = emit_app.emit(
                "workspace://files-changed",
                WorkspaceFilesChangedEvent {
                    path: relative,
                    root: emit_root_text.clone(),
                },
            );
        },
        NotifyConfig::default(),
    )
    .map_err(|err| format!("无法启动工程文件监听: {}", err))?;
    watcher
        .watch(&root, RecursiveMode::Recursive)
        .map_err(|err| format!("无法监听项目目录: {}", err))?;

    {
        let mut watcher_slot = state.watcher.lock().map_err(|err| err.to_string())?;
        *watcher_slot = Some(watcher);
    }
    {
        let mut current_root = state.root.lock().map_err(|err| err.to_string())?;
        *current_root = root_text.clone();
    }

    Ok(root_text)
}

fn goal_stack_from_validation(
    validation: &Value,
    report: &Value,
    history: &Value,
    project_name: &str,
) -> Value {
    let goal_id = validation
        .pointer("/goal/id")
        .and_then(Value::as_str)
        .unwrap_or("current-goal");
    let goal_title = validation
        .pointer("/goal/title")
        .and_then(Value::as_str)
        .unwrap_or("当前目标");
    let goal_status = validation
        .pointer("/goal/status")
        .and_then(Value::as_str)
        .unwrap_or("active");
    let report_status = report
        .get("status")
        .and_then(Value::as_str)
        .unwrap_or("missing");
    let completed_at = history
        .pointer("/entries/0/signedOffAt")
        .and_then(Value::as_str)
        .unwrap_or("");
    let stack_status = match goal_status {
        "signed-off" => "done",
        "verified" => "pending-confirm",
        "validation-failed" => "active",
        other => other,
    };

    json!({
        "schemaVersion": "omnidesk.goals.v0.1",
        "activeGoalId": goal_id,
        "goals": [{
            "id": goal_id,
            "title": goal_title,
            "projectName": project_name,
            "status": stack_status,
            "completedAt": completed_at,
            "validationStatus": report_status,
            "summary": if stack_status == "done" { "目标已确认完成。" } else { "当前目标。" },
            "taskIds": []
        }]
    })
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

fn goal_id_from_title(title: &str) -> String {
    let mut id = title
        .chars()
        .filter_map(|ch| {
            if ch.is_ascii_alphanumeric() {
                Some(ch.to_ascii_lowercase())
            } else if ch.is_whitespace() || ch == '-' || ch == '_' {
                Some('-')
            } else {
                None
            }
        })
        .collect::<String>();
    while id.contains("--") {
        id = id.replace("--", "-");
    }
    id = id.trim_matches('-').to_string();
    if id.is_empty() {
        id = "goal".to_string();
    }
    format!(
        "{}-{}",
        id,
        current_timestamp_string().replace([':', '.'], "-")
    )
}

#[tauri::command]
fn create_goal(input: CreateGoalInput) -> Result<WorkspaceSnapshot, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    let now = current_timestamp_string();
    let id = goal_id_from_title(input.title.trim());
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
    let project_root = normalize_project_path(&input.path)?;
    if !project_root.exists() || !project_root.is_dir() {
        return Err("项目路径不存在或不是目录".to_string());
    }

    let mut registry = load_or_seed_registry(&app_root)?;
    let project_path = project_root.display().to_string();
    let state = read_json(project_root.join(STATE_PATH));
    let name = project_root
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("workspace")
        .to_string();
    let phase = state
        .as_ref()
        .and_then(|json| json.get("phase"))
        .and_then(Value::as_str)
        .unwrap_or("external")
        .to_string();
    let id = project_id_from_path(&project_path);

    let matches_project = |project: &RegistryProjectRecord| {
        project.id == id
            || PathBuf::from(&project.path)
                .canonicalize()
                .map(|path| path == project_root)
                .unwrap_or(false)
    };
    if let Some(project) = registry
        .projects
        .iter_mut()
        .find(|project| matches_project(project))
    {
        project.id = id.clone();
        if !project.name_locked {
            project.name = name;
        }
        project.path = project_path;
        project.phase = phase;
        project.access_mode = normalize_project_access_mode(&input.access_mode);
    } else {
        registry.projects.push(RegistryProjectRecord {
            id: id.clone(),
            name,
            path: project_path,
            phase,
            name_locked: false,
            access_mode: normalize_project_access_mode(&input.access_mode),
        });
    }
    let mut kept_primary = false;
    registry.projects.retain(|project| {
        if !matches_project(project) {
            return true;
        }
        if kept_primary {
            return false;
        }
        kept_primary = true;
        true
    });
    registry.current_project_id = id;
    save_registry(&app_root, &registry)?;
    get_workspace_snapshot()
}

#[tauri::command]
fn preview_project_path(input: PreviewProjectInput) -> Result<Value, String> {
    let root = normalize_project_path(&input.path)?;
    if !root.exists() || !root.is_dir() {
        return Err("项目路径不存在或不是目录".to_string());
    }
    let name = root
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("workspace");
    let has = |file_name: &str| root.join(file_name).exists();
    let has_omnidesk_state = runtime_state_exists(&root, ".omnidesk");
    let has_project_manifest = has("package.json") || has("pyproject.toml") || has("Cargo.toml");
    let mut risks = Vec::new();
    if !has(".git") {
        risks.push("未发现 Git 仓库");
    }
    if !has_project_manifest {
        risks.push("未找到常见项目文件");
    }
    Ok(json!({
        "path": root.display().to_string(),
        "project": {
            "name": name,
            "hasGit": has(".git"),
            "hasProjectOs": has_omnidesk_state
        },
        "detected": {
            "packageJson": has("package.json"),
            "pyproject": has("pyproject.toml"),
            "cargo": has("Cargo.toml"),
            "readme": has("README.md")
        },
        "risks": risks
    }))
}

#[tauri::command]
fn switch_registry_project(input: SwitchRegistryProjectInput) -> Result<WorkspaceSnapshot, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    if !registry
        .projects
        .iter()
        .any(|project| project.id == input.id)
    {
        return Err("未找到这个项目".to_string());
    }
    registry.current_project_id = input.id;
    save_registry(&app_root, &registry)?;
    get_workspace_snapshot()
}

#[tauri::command]
fn rename_registry_project(input: RenameRegistryProjectInput) -> Result<WorkspaceSnapshot, String> {
    let next_name = input.name.trim();
    if next_name.is_empty() {
        return Err("项目名称不能为空。".to_string());
    }
    if next_name.chars().count() > 60 {
        return Err("项目名称太长了，建议控制在 60 个字以内。".to_string());
    }

    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let project = registry
        .projects
        .iter_mut()
        .find(|project| project.id == input.id)
        .ok_or_else(|| "未找到这个项目".to_string())?;
    project.name = next_name.to_string();
    project.name_locked = true;
    save_registry(&app_root, &registry)?;
    get_workspace_snapshot()
}

#[tauri::command]
fn relocate_registry_project(
    input: RelocateRegistryProjectInput,
) -> Result<WorkspaceSnapshot, String> {
    let next_path = input.path.trim();
    if next_path.is_empty() {
        return Err("请选择新的项目文件夹。".to_string());
    }

    let next_root = PathBuf::from(next_path)
        .canonicalize()
        .map_err(|err| format!("无法访问新的项目路径: {}", err))?;
    if !next_root.is_dir() {
        return Err("请选择一个文件夹作为项目路径。".to_string());
    }

    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let project = registry
        .projects
        .iter_mut()
        .find(|project| project.id == input.id)
        .ok_or_else(|| "未找到这个项目".to_string())?;

    let state = read_json(next_root.join(STATE_PATH));
    project.path = next_root.display().to_string();
    if !project.name_locked {
        project.name = next_root
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or(&project.name)
            .to_string();
    }
    project.phase = state
        .as_ref()
        .and_then(|json| json.get("phase"))
        .and_then(Value::as_str)
        .unwrap_or(&project.phase)
        .to_string();
    registry.current_project_id = input.id;
    save_registry(&app_root, &registry)?;
    get_workspace_snapshot()
}

#[tauri::command]
fn remove_registry_project(id: String) -> Result<WorkspaceSnapshot, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    if registry.projects.len() <= 1 {
        return Err("至少保留一个工作台项目；这个项目不能移除。".to_string());
    }
    let original_len = registry.projects.len();
    registry.projects.retain(|project| project.id != id);
    if registry.projects.len() == original_len {
        return Err("未找到这个项目".to_string());
    }
    if registry.current_project_id == id {
        registry.current_project_id = registry
            .projects
            .first()
            .map(|project| project.id.clone())
            .ok_or_else(|| "registry 中没有项目".to_string())?;
    }
    save_registry(&app_root, &registry)?;
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
    let project_path = PathBuf::from(&project.path);
    if !project_path.exists() {
        return Err("这个项目路径已经不存在，无法查看本地文件。".to_string());
    }
    if !project_path.is_dir() {
        return Err("这个项目不是文件夹，无法查看本地文件。".to_string());
    }

    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.arg(&project_path);
        command
    };

    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("explorer");
        command.arg(&project_path);
        command
    };

    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = {
        let mut command = Command::new("xdg-open");
        command.arg(&project_path);
        command
    };

    command
        .spawn()
        .map_err(|err| format!("无法打开本地文件：{}", err))?;
    Ok(())
}

#[tauri::command]
fn open_native_terminal() -> Result<(), String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    if !root.exists() || !root.is_dir() {
        return Err("当前项目路径不存在或不是目录".to_string());
    }

    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.args(["-a", "Terminal"]);
        command.arg(&root);
        command
    };

    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("cmd");
        command.args(["/C", "start", "wt", "-d"]);
        command.arg(&root);
        command
    };

    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = {
        let mut command = Command::new("x-terminal-emulator");
        command.current_dir(&root);
        command
    };

    command
        .spawn()
        .map_err(|err| format!("无法打开原生终端：{}", err))?;
    Ok(())
}

#[tauri::command]
fn read_engineering_file(
    input: ReadEngineeringFileInput,
) -> Result<EngineeringFilePreview, String> {
    const MAX_PREVIEW_BYTES: usize = 80 * 1024;

    let relative = input.path.trim();
    if relative.is_empty() {
        return Err("请选择一个工程文件".to_string());
    }
    if !crate::runtime::workspace::is_safe_text_preview_path(relative) {
        return Err("这个文件暂不支持预览：只能查看项目内的普通文本文件。".to_string());
    }

    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path)
        .canonicalize()
        .map_err(|err| format!("项目目录不可访问: {}", err))?;
    let path = crate::runtime::state_namespace::state_path_for_read(&root, relative)?;
    let canonical = path
        .canonicalize()
        .map_err(|_| format!("没有找到这个文件：{}", relative))?;

    if !canonical.starts_with(&root) {
        return Err("只能预览当前项目内的文件".to_string());
    }
    if !canonical.is_file() {
        return Err("请选择一个具体文件，文件夹暂不预览".to_string());
    }

    let metadata = fs::metadata(&canonical).map_err(|err| err.to_string())?;
    let bytes = fs::read(&canonical).map_err(|err| format!("读取 {} 失败: {}", relative, err))?;
    if bytes.iter().take(512).any(|byte| *byte == 0) {
        return Err("这个文件看起来不是文本文件，暂不预览。".to_string());
    }

    let truncated = bytes.len() > MAX_PREVIEW_BYTES;
    let preview_bytes = if truncated {
        &bytes[..MAX_PREVIEW_BYTES]
    } else {
        &bytes
    };
    let content = String::from_utf8(preview_bytes.to_vec())
        .map_err(|_| "这个文件不是 UTF-8 文本，暂不预览。".to_string())?;
    let name = canonical
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(relative)
        .to_string();

    Ok(EngineeringFilePreview {
        path: relative.to_string(),
        name,
        content,
        language: crate::runtime::workspace::preview_language(relative),
        truncated,
        size: metadata.len(),
    })
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
    let arguments = input
        .arguments
        .as_object()
        .ok_or_else(|| "工具参数格式错误".to_string())?;
    let path = arguments.get("path").and_then(Value::as_str).unwrap_or(".");
    match input.name.trim() {
        "list_files" => crate::runtime::agent_tools::list_files(&root, path),
        "read_file" => crate::runtime::agent_tools::read_file(&root, path),
        "search_project" => crate::runtime::agent_tools::search_project(
            &root,
            path,
            arguments.get("query").and_then(Value::as_str).unwrap_or(""),
        ),
        "git_status" => crate::runtime::agent_tools::git_status(&root),
        _ => Err("Native Core 只接受已登记的只读 Agent Tool".to_string()),
    }
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

    let attachments = input
        .attachments
        .into_iter()
        .filter(|attachment| {
            attachment.mime_type.starts_with("image/")
                && attachment.data_url.starts_with("data:image/")
                && attachment.data_url.len() < 4_000_000
        })
        .take(4)
        .collect::<Vec<_>>();

    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    let configured_provider = load_or_seed_provider_config(&app_root)?;
    let state = read_json(root.join(STATE_PATH));
    let project_name = state
        .as_ref()
        .and_then(|json| json.get("name"))
        .and_then(Value::as_str)
        .unwrap_or(&current_project.name)
        .to_string();
    let stage = state
        .as_ref()
        .and_then(|json| json.get("stage"))
        .and_then(Value::as_str)
        .unwrap_or("未读取到阶段信息")
        .to_string();
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
                    &app,
                    &request_id,
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
                &app,
                &request_id,
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
                record_provider_failure(&app_root, &provider, &err)?;
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
    let attachments = input
        .attachments
        .into_iter()
        .filter(|attachment| {
            attachment.mime_type.starts_with("image/")
                && attachment.data_url.starts_with("data:image/")
                && attachment.data_url.len() < 4_000_000
        })
        .take(4)
        .collect::<Vec<_>>();

    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let configured_provider = load_or_seed_provider_config(&app_root)?;
    let root = PathBuf::from(&current_project.path);
    let state = read_json(root.join(STATE_PATH));

    let project_name = state
        .as_ref()
        .and_then(|json| json.get("name"))
        .and_then(Value::as_str)
        .unwrap_or(&current_project.name)
        .to_string();
    let stage = state
        .as_ref()
        .and_then(|json| json.get("stage"))
        .and_then(Value::as_str)
        .unwrap_or("未读取到阶段信息")
        .to_string();

    let mut fallback_context = PlanContext {
        task: task.clone(),
        attachments,
        project_name: project_name.clone(),
        stage: stage.clone(),
        root: root.clone(),
        provider: configured_provider.clone(),
    };

    if configured_provider.enabled {
        let (provider, provider_switch_note) =
            match prepare_provider_for_request(&app_root, &configured_provider, &HashSet::new())
                .await
            {
                Ok(result) => result,
                Err(err) => {
                    let mut plan = build_local_readonly_plan(fallback_context);
                    plan.trace
                        .push(format!("PROVIDER_PRECHECK_FAILED: {}", err));
                    return Ok(plan);
                }
            };
        fallback_context.provider = provider;
        let request_id = input.request_id.trim().to_string();
        let token = if request_id.is_empty() {
            None
        } else {
            Some(runtime_requests.start(&request_id))
        };
        let provider_result = if let Some(token) = token {
            tokio::select! {
                _ = token.cancelled() => Err("请求已取消".to_string()),
                result = generate_provider_plan(&fallback_context) => result,
            }
        } else {
            generate_provider_plan(&fallback_context).await
        };
        if !request_id.is_empty() {
            runtime_requests.finish(&request_id);
        }
        match provider_result {
            Ok(mut plan) => {
                if !provider_switch_note.is_empty() {
                    plan.trace
                        .push(format!("PROVIDER_SWITCH: {}", provider_switch_note));
                }
                return Ok(plan);
            }
            Err(err) if err == "请求已取消" => return Err(err),
            Err(err) => {
                record_provider_failure(&app_root, &fallback_context.provider, &err)?;
                let mut plan = build_local_readonly_plan(fallback_context);
                plan.trace.push(format!("PROVIDER_FALLBACK: {}", err));
                return Ok(plan);
            }
        }
    }

    Ok(build_local_readonly_plan(fallback_context))
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
    if !root.exists() || !root.is_dir() {
        return Err("当前项目路径不存在或不是目录".to_string());
    }
    let goal_id = input.goal_id.trim();
    if goal_id.is_empty() {
        return Err("验收必须绑定当前目标。".to_string());
    }
    let goals = read_json(root.join(GOALS_PATH)).ok_or_else(|| "未找到目标列表".to_string())?;
    let goal = goals
        .get("goals")
        .and_then(Value::as_array)
        .and_then(|items| {
            items
                .iter()
                .find(|item| item.get("id").and_then(Value::as_str) == Some(goal_id))
        })
        .ok_or_else(|| "当前目标不存在，无法运行验收。".to_string())?;
    let goal_title = goal
        .get("title")
        .and_then(Value::as_str)
        .or_else(|| goal.get("shortTitle").and_then(Value::as_str))
        .unwrap_or("当前目标");

    let check_ids = ["web-build", "cargo-check", "runtime"];
    let mut checks = Vec::new();
    for check_id in check_ids {
        let spec = guarded_check_spec(check_id)
            .ok_or_else(|| format!("不允许执行这个检查：{}", check_id))?;
        for relative in &spec.required_paths {
            if !root.join(relative).exists() {
                return Err(format!("当前项目缺少检查所需文件：{}", relative));
            }
        }

        let output = Command::new(&spec.program)
            .args(&spec.args)
            .current_dir(&root)
            .output()
            .map_err(|err| err.to_string())?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        checks.push(json!({
            "id": spec.id,
            "label": spec.label,
            "command": spec.command,
            "success": output.status.success(),
            "code": output.status.code(),
            "output": trim_runner_output(&format!("{}{}", stdout, stderr)),
        }));
    }

    let passed = checks.iter().all(|check| {
        check
            .get("success")
            .and_then(Value::as_bool)
            .unwrap_or(false)
    });
    let now = current_timestamp_string();
    let report = json!({
        "schemaVersion": "omnidesk.goal-validation-report.v0.1",
        "generatedAt": now,
        "goalId": goal_id,
        "goalTitle": goal_title,
        "status": if passed { "passed" } else { "failed" },
        "checks": checks,
    });
    crate::runtime::goals::record_validation(&root, goal_id, goal_title, passed, report, &now)?;

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
    let task = input.task;
    let title = task
        .get("title")
        .and_then(Value::as_str)
        .unwrap_or("未命名任务")
        .to_string();
    let plan = task
        .get("plan")
        .ok_or_else(|| "任务缺少 plan，无法生成 patch 草案".to_string())?;
    let files = crate::runtime::patch::plan_context_files(plan, &root);
    if let Some(reason) = crate::runtime::patch::draft_ineligibility_reason(plan, &files) {
        if !request_id.is_empty() {
            runtime_requests.finish(&request_id);
        }
        return Ok(crate::runtime::patch::not_applicable_draft(
            &title, &files, &reason,
        ));
    }
    let contexts = crate::runtime::patch::read_context_files(&root, &files)?;

    if configured_provider.enabled {
        let (provider, provider_switch_note) =
            match prepare_provider_for_request(&app_root, &configured_provider, &HashSet::new())
                .await
            {
                Ok(result) => result,
                Err(err) => {
                    if !request_id.is_empty() {
                        runtime_requests.finish(&request_id);
                    }
                    let mut draft = crate::runtime::patch::local_placeholder_draft(
                        &title,
                        &files,
                        &contexts,
                        &format!("Provider precheck: {}", err),
                    );
                    draft
                        .trace
                        .push(format!("PROVIDER_PRECHECK_FAILED: {}", err));
                    return Ok(draft);
                }
            };
        let hermes_result = if let Some(token) = token.clone() {
            let cancellation = token.clone();
            tokio::select! {
                _ = cancellation.cancelled() => Err("请求已取消".to_string()),
                result = generate_hermes_structured_patch_draft(&provider, &root, &title, plan, &contexts, None, Some(token)) => result,
            }
        } else {
            generate_hermes_structured_patch_draft(
                &provider, &root, &title, plan, &contexts, None, None,
            )
            .await
        };
        let hermes_error = match hermes_result {
            Ok(mut draft) => {
                if !provider_switch_note.is_empty() {
                    draft
                        .trace
                        .push(format!("PROVIDER_SWITCH: {}", provider_switch_note));
                }
                if !request_id.is_empty() {
                    runtime_requests.finish(&request_id);
                }
                return Ok(draft);
            }
            Err(err) if err == "请求已取消" => {
                if !request_id.is_empty() {
                    runtime_requests.finish(&request_id);
                }
                return Err(err);
            }
            Err(err) => {
                // A malformed or stale hunk gets one bounded regeneration attempt
                // with the rejection reason. The allowed file set remains fixed.
                match generate_hermes_structured_patch_draft(
                    &provider,
                    &root,
                    &title,
                    plan,
                    &contexts,
                    Some(&err),
                    None,
                )
                .await
                {
                    Ok(mut draft) => {
                        draft
                            .trace
                            .push("DRAFT_RETRY: Hermes accepted the regenerated draft".to_string());
                        if !provider_switch_note.is_empty() {
                            draft
                                .trace
                                .push(format!("PROVIDER_SWITCH: {}", provider_switch_note));
                        }
                        if !request_id.is_empty() {
                            runtime_requests.finish(&request_id);
                        }
                        return Ok(draft);
                    }
                    Err(retry_err) => format!("{}；重试失败：{}", err, retry_err),
                }
            }
        };
        let provider_result = if let Some(token) = token {
            tokio::select! {
                _ = token.cancelled() => Err("请求已取消".to_string()),
                result = generate_provider_patch_draft(&provider, &root, &title, plan, &contexts, Some(&hermes_error)) => result,
            }
        } else {
            generate_provider_patch_draft(
                &provider,
                &root,
                &title,
                plan,
                &contexts,
                Some(&hermes_error),
            )
            .await
        };
        if !request_id.is_empty() {
            runtime_requests.finish(&request_id);
        }
        match provider_result {
            Ok(mut draft) => {
                if !provider_switch_note.is_empty() {
                    draft
                        .trace
                        .push(format!("PROVIDER_SWITCH: {}", provider_switch_note));
                }
                draft.trace.push(format!(
                    "HERMES_FALLBACK: {}",
                    trim_for_trace(&hermes_error)
                ));
                return Ok(draft);
            }
            Err(err) if err == "请求已取消" => return Err(err),
            Err(err) => {
                record_provider_failure(&app_root, &provider, &err)?;
                let mut draft = crate::runtime::patch::local_placeholder_draft(
                    &title,
                    &files,
                    &contexts,
                    &format!("Hermes: {}; Provider: {}", hermes_error, err),
                );
                draft.trace.push(format!(
                    "HERMES_FALLBACK: {}",
                    trim_for_trace(&hermes_error)
                ));
                draft.trace.push(format!("PROVIDER_FALLBACK: {}", err));
                return Ok(draft);
            }
        }
    }

    if !request_id.is_empty() {
        runtime_requests.finish(&request_id);
    }
    Ok(crate::runtime::patch::local_placeholder_draft(
        &title,
        &files,
        &contexts,
        "未配置可用模型；这是不可应用的占位草稿。",
    ))
}

#[tauri::command]
fn apply_patch_draft(input: ApplyPatchDraftInput) -> Result<ApplyPatchResult, String> {
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
    if draft
        .get("notApplicable")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        return Err(
            "当前任务没有已确认的工程改动，不能应用 Patch。请先运行检查或调整计划范围。"
                .to_string(),
        );
    }
    let diff = patch_diff_from_draft(&draft)?;
    if diff.contains("PATCH_DRAFT_PENDING") {
        return Err("当前还是占位草案，不能应用。请先生成真实 patch。".to_string());
    }
    if !diff.contains("@@") || !diff.contains("--- ") || !diff.contains("+++ ") {
        return Err("patch 草案不是可应用的 unified diff".to_string());
    }
    crate::runtime::patch::validate_apply_diff_paths(diff)?;
    let allowed_files = draft
        .get("allowedFiles")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(ToString::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    crate::runtime::patch::validate_unified_diff_authorized(diff, &allowed_files)?;

    let check = run_git_apply(&root, diff, true)?;
    if !check.status.success() {
        let _ = crate::runtime::execution::append_audit(
            &root,
            "patch-apply",
            false,
            json!({ "stage": "validate" }),
            &current_timestamp_string(),
        );
        return Err(format!(
            "patch 验证失败：{}",
            trim_runner_output(&format!(
                "{}{}",
                String::from_utf8_lossy(&check.stdout),
                String::from_utf8_lossy(&check.stderr)
            ))
        ));
    }

    let applied = run_git_apply(&root, diff, false)?;
    let output = trim_runner_output(&format!(
        "{}{}",
        String::from_utf8_lossy(&applied.stdout),
        String::from_utf8_lossy(&applied.stderr)
    ));
    if !applied.status.success() {
        let _ = crate::runtime::execution::append_audit(
            &root,
            "patch-apply",
            false,
            json!({ "stage": "apply" }),
            &current_timestamp_string(),
        );
        return Err(format!("patch 应用失败：{}", output));
    }

    let _ = crate::runtime::execution::append_audit(
        &root,
        "patch-apply",
        true,
        json!({ "stage": "apply" }),
        &current_timestamp_string(),
    );

    Ok(ApplyPatchResult {
        success: true,
        message: "patch 已应用到当前项目文件".to_string(),
        output,
    })
}

fn patch_diff_from_draft(draft: &Value) -> Result<&str, String> {
    draft
        .get("diff")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "patch 草案为空".to_string())
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

async fn generate_provider_patch_draft(
    provider: &ProviderConfig,
    root: &Path,
    title: &str,
    plan: &Value,
    contexts: &[(String, String)],
    retry_reason: Option<&str>,
) -> Result<PatchDraft, String> {
    let api_key = read_secret_from_env_or_dotenv(root, &provider.api_key_env)
        .ok_or_else(|| format!("环境变量或 .env.local 中未设置 {}", provider.api_key_env))?;
    if api_key.trim().is_empty() {
        return Err(format!("环境变量 {} 为空", provider.api_key_env));
    }

    let prompt = crate::runtime::patch::provider_draft_prompt(title, plan, contexts, retry_reason);
    let response = post_chat_completion(
        provider,
        &api_key,
        &json!({
            "model": provider.model,
            "messages": [
                {
                    "role": "system",
                    "content": "You are OmniDesk Local Agent Core. Return only strict JSON. Do not include markdown fences."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.15
        }),
        Duration::from_secs(60),
    )
    .await?;
    let content =
        chat_completion_content(require_provider_success(response, "provider").await?).await?;
    let mut draft: PatchDraft = serde_json::from_str(&content)
        .map_err(|err| format!("patch draft JSON 解析失败: {}", err))?;
    draft.diff = crate::runtime::patch::normalize_hermes_unified_diff(&draft.diff, contexts)?;
    draft.files = crate::runtime::patch::files_from_unified_diff(&draft.diff);
    draft.allowed_files = contexts.iter().map(|(path, _)| path.clone()).collect();
    draft.context_files = draft.allowed_files.clone();
    draft.draft_attempt = usize::from(retry_reason.is_some()) + 1;
    draft.failure_reason = retry_reason.unwrap_or("").to_string();
    draft.not_applicable = false;
    draft
        .guardrails
        .push("当前只是 patch 草案，尚未写入文件。".to_string());
    draft
        .trace
        .push(format!("PROVIDER_PATCH: {}", provider.model));
    Ok(draft)
}

const HERMES_ACP_TIMEOUT: Duration = Duration::from_secs(75);

#[allow(dead_code)]
async fn generate_hermes_patch_draft(
    provider: &ProviderConfig,
    root: &Path,
    title: &str,
    plan: &Value,
    contexts: &[(String, String)],
    cancellation: Option<CancellationToken>,
) -> Result<PatchDraft, String> {
    let api_key = read_secret_from_env_or_dotenv(root, &provider.api_key_env)
        .ok_or_else(|| format!("环境变量或 .env.local 中未设置 {}", provider.api_key_env))?;
    if api_key.trim().is_empty() {
        return Err(format!("环境变量 {} 为空", provider.api_key_env));
    }

    let root = root.to_path_buf();
    let api_base = provider.api_base.clone();
    let api_key_env = provider.api_key_env.clone();
    let prompt = crate::runtime::patch::hermes_draft_prompt(title, plan, contexts);
    let context_files = contexts.to_vec();
    tauri::async_runtime::spawn_blocking(move || {
        run_hermes_acp_prompt(
            &root,
            &api_key,
            &api_base,
            &api_key_env,
            &prompt,
            &context_files,
            cancellation.as_ref(),
        )
    })
    .await
    .map_err(|err| format!("Hermes ACP worker 中断: {err}"))?
}

async fn generate_hermes_structured_patch_draft(
    provider: &ProviderConfig,
    root: &Path,
    title: &str,
    plan: &Value,
    contexts: &[(String, String)],
    retry_reason: Option<&str>,
    cancellation: Option<CancellationToken>,
) -> Result<PatchDraft, String> {
    let api_key = read_secret_from_env_or_dotenv(root, &provider.api_key_env)
        .ok_or_else(|| format!("环境变量或 .env.local 中未设置 {}", provider.api_key_env))?;
    if api_key.trim().is_empty() {
        return Err(format!("环境变量 {} 为空", provider.api_key_env));
    }
    let allowed = contexts
        .iter()
        .map(|(path, _)| path.as_str())
        .collect::<Vec<_>>()
        .join(", ");
    let retry_instruction = retry_reason.map(|reason| format!(" The previous draft was rejected: {reason}. Regenerate a corrected diff; do not change the allowed file list.")).unwrap_or_default();
    let prompt = format!(
        "Implement the coding task `{title}` according to this plan: {plan}. You are in a governed project. First use only read_file, list_files, search_project, or git_status tool calls to inspect the minimum context. Then return ONLY a final JSON envelope: {{\"type\":\"final\",\"result\":{{\"summary\":\"...\",\"diff\":\"unified diff\",\"files\":[\"...\"]}}}}. Never apply changes or run checks. Only these planned context files may appear in the final diff: {allowed}.{retry_instruction}",
        title = title, plan = plan, allowed = allowed, retry_instruction = retry_instruction
    );
    let root = root.to_path_buf();
    let api_base = provider.api_base.clone();
    let api_key_env = provider.api_key_env.clone();
    let max_steps = 20;
    let result = tauri::async_runtime::spawn_blocking(move || {
        run_hermes_acp_structured_loop(
            &root,
            &api_key,
            &api_base,
            &api_key_env,
            &prompt,
            max_steps,
            cancellation.as_ref(),
        )
    })
    .await
    .map_err(|err| format!("Hermes structured worker 中断: {err}"))??;
    if result.status != "succeeded" {
        return Err(result.summary);
    }
    let payload = result
        .result
        .ok_or_else(|| "Hermes structured final 缺少 result".to_string())?;
    let summary = payload
        .get("summary")
        .and_then(Value::as_str)
        .unwrap_or("Hermes 已生成结构化改动草稿")
        .to_string();
    let diff = payload
        .get("diff")
        .and_then(Value::as_str)
        .ok_or_else(|| "Hermes structured final 缺少 diff".to_string())?;
    let diff = crate::runtime::patch::normalize_hermes_unified_diff(diff, contexts)?;
    let files = crate::runtime::patch::files_from_unified_diff(&diff);
    Ok(PatchDraft {
        summary,
        diff,
        files,
        allowed_files: contexts.iter().map(|(path, _)| path.clone()).collect(),
        context_files: contexts.iter().map(|(path, _)| path.clone()).collect(),
        draft_attempt: usize::from(retry_reason.is_some()) + 1,
        failure_reason: retry_reason.unwrap_or("").to_string(),
        not_applicable: false,
        guardrails: vec![
            "Hermes 只读取上下文并生成草案，不会写入文件。".to_string(),
            "Apply 前必须经过用户确认。".to_string(),
        ],
        trace: vec![
            "PATCH_MODE: hermes-acp governed structured loop".to_string(),
            format!("HERMES_STEPS: {}", result.step),
        ],
    })
}

#[allow(dead_code)]
fn run_hermes_acp_prompt(
    root: &Path,
    api_key: &str,
    api_base: &str,
    api_key_env: &str,
    prompt: &str,
    contexts: &[(String, String)],
    cancellation: Option<&CancellationToken>,
) -> Result<PatchDraft, String> {
    let program = hermes_acp_program().ok_or_else(|| "未检测到 hermes-acp".to_string())?;
    let mut command = Command::new(program);
    command
        .current_dir(root)
        .env("OPENAI_API_KEY", api_key)
        .env("OPENAI_BASE_URL", api_base)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if !api_key_env.trim().is_empty() {
        command.env(api_key_env.trim(), api_key);
    }
    if let Some(key_env) = hermes_custom_provider_key_env(api_base) {
        command.env(key_env, api_key);
    }
    let mut child = command
        .spawn()
        .map_err(|err| format!("启动 Hermes ACP 失败: {err}"))?;
    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| "Hermes ACP stdin 不可用".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Hermes ACP stdout 不可用".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Hermes ACP stderr 不可用".to_string())?;
    let (lines_tx, lines_rx) = mpsc::channel::<Result<String, String>>();
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            let result = line.map_err(|err| err.to_string());
            let should_stop = result.is_err();
            if lines_tx.send(result).is_err() || should_stop {
                break;
            }
        }
    });
    let (stderr_tx, stderr_rx) = mpsc::channel::<String>();
    std::thread::spawn(move || {
        let mut output = String::new();
        let _ = BufReader::new(stderr)
            .take(8192)
            .read_to_string(&mut output);
        let _ = stderr_tx.send(output);
    });

    let deadline = Instant::now() + HERMES_ACP_TIMEOUT;
    let mut agent_text = String::new();
    let result = (|| -> Result<(), String> {
        hermes_write_request(
            &mut stdin,
            1,
            "initialize",
            json!({
                "protocolVersion": 1,
                "clientCapabilities": {},
                "clientInfo": { "name": "OmniDesk", "version": "0.1.0" }
            }),
        )?;
        hermes_wait_for_response(
            &lines_rx,
            &mut stdin,
            1,
            deadline,
            &mut agent_text,
            cancellation,
        )?;

        hermes_write_request(
            &mut stdin,
            2,
            "session/new",
            json!({
                "cwd": root.to_string_lossy(),
                "mcpServers": []
            }),
        )?;
        let session = hermes_wait_for_response(
            &lines_rx,
            &mut stdin,
            2,
            deadline,
            &mut agent_text,
            cancellation,
        )?;
        let session_id = session
            .pointer("/result/sessionId")
            .and_then(Value::as_str)
            .ok_or_else(|| "Hermes ACP 没有返回 sessionId".to_string())?;

        hermes_write_request(
            &mut stdin,
            3,
            "session/prompt",
            json!({
                "sessionId": session_id,
                "prompt": [{ "type": "text", "text": prompt }]
            }),
        )?;
        hermes_wait_for_response(
            &lines_rx,
            &mut stdin,
            3,
            deadline,
            &mut agent_text,
            cancellation,
        )?;
        Ok(())
    })();
    let _ = child.kill();
    let _ = child.wait();
    let stderr = stderr_rx
        .recv_timeout(Duration::from_secs(1))
        .unwrap_or_default();
    result.map_err(|err| {
        if stderr.trim().is_empty() {
            err
        } else {
            format!("{}；Hermes: {}", err, trim_for_trace(&stderr))
        }
    })?;

    let diff = crate::runtime::patch::normalize_hermes_unified_diff(&agent_text, contexts)?;
    let files = crate::runtime::patch::files_from_unified_diff(&diff);
    Ok(PatchDraft {
        summary: "Hermes 已生成只读改动草案，等待你确认应用。".to_string(),
        diff,
        files,
        allowed_files: contexts.iter().map(|(path, _)| path.clone()).collect(),
        context_files: contexts.iter().map(|(path, _)| path.clone()).collect(),
        draft_attempt: 1,
        failure_reason: String::new(),
        not_applicable: false,
        guardrails: vec![
            "Hermes 只作为草案生成器，不会通过此流程写入文件。".to_string(),
            "所有工具和权限请求都会被 OmniDesk 拒绝。".to_string(),
            "Apply 前必须经过用户确认。".to_string(),
        ],
        trace: vec![
            "PATCH_MODE: hermes-acp read-only bridge".to_string(),
            "HERMES_ACP: initialized/session/new/session/prompt".to_string(),
        ],
    })
}

fn hermes_read_tool_observation(
    root: &Path,
    name: &str,
    arguments: &Value,
) -> Result<Value, String> {
    let object = arguments
        .as_object()
        .ok_or_else(|| "Hermes tool arguments 格式错误".to_string())?;
    let path = object.get("path").and_then(Value::as_str).unwrap_or(".");
    match name {
        "list_files" => crate::runtime::agent_tools::list_files(root, path),
        "read_file" => crate::runtime::agent_tools::read_file(root, path),
        "search_project" => crate::runtime::agent_tools::search_project(
            root,
            path,
            object.get("query").and_then(Value::as_str).unwrap_or(""),
        ),
        "git_status" => crate::runtime::agent_tools::git_status(root),
        _ => Err(format!("Hermes 请求了不允许的工具：{name}")),
    }
}

fn run_hermes_acp_structured_loop(
    root: &Path,
    api_key: &str,
    api_base: &str,
    api_key_env: &str,
    prompt: &str,
    max_steps: usize,
    cancellation: Option<&CancellationToken>,
) -> Result<HermesAgentLoopResult, String> {
    let program = hermes_acp_program().ok_or_else(|| "未检测到 hermes-acp".to_string())?;
    let mut command = Command::new(program);
    command
        .current_dir(root)
        .env("OPENAI_API_KEY", api_key)
        .env("OPENAI_BASE_URL", api_base)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if !api_key_env.trim().is_empty() {
        command.env(api_key_env.trim(), api_key);
    }
    if let Some(key_env) = hermes_custom_provider_key_env(api_base) {
        command.env(key_env, api_key);
    }
    let mut child = command
        .spawn()
        .map_err(|err| format!("启动 Hermes ACP 失败: {err}"))?;
    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| "Hermes ACP stdin 不可用".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Hermes ACP stdout 不可用".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Hermes ACP stderr 不可用".to_string())?;
    let (lines_tx, lines_rx) = mpsc::channel::<Result<String, String>>();
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines() {
            let result = line.map_err(|err| err.to_string());
            let should_stop = result.is_err();
            if lines_tx.send(result).is_err() || should_stop {
                break;
            }
        }
    });
    let (stderr_tx, stderr_rx) = mpsc::channel::<String>();
    std::thread::spawn(move || {
        let mut output = String::new();
        let _ = BufReader::new(stderr)
            .take(8192)
            .read_to_string(&mut output);
        let _ = stderr_tx.send(output);
    });
    let deadline = Instant::now() + HERMES_ACP_TIMEOUT;
    let mut trace = vec!["HERMES_ACP: structured tool loop".to_string()];
    let mut observations = Vec::new();
    let mut authorized_patch_files = std::collections::HashSet::<String>::new();
    let mut result = (|| -> Result<HermesAgentLoopResult, String> {
        hermes_write_request(
            &mut stdin,
            1,
            "initialize",
            json!({ "protocolVersion": 1, "clientCapabilities": {}, "clientInfo": { "name": "OmniDesk", "version": "0.1.0" } }),
        )?;
        let mut ignored = String::new();
        hermes_wait_for_response(
            &lines_rx,
            &mut stdin,
            1,
            deadline,
            &mut ignored,
            cancellation,
        )?;
        hermes_write_request(
            &mut stdin,
            2,
            "session/new",
            json!({ "cwd": root.to_string_lossy(), "mcpServers": [] }),
        )?;
        let session = hermes_wait_for_response(
            &lines_rx,
            &mut stdin,
            2,
            deadline,
            &mut ignored,
            cancellation,
        )?;
        let session_id = session
            .pointer("/result/sessionId")
            .and_then(Value::as_str)
            .ok_or_else(|| "Hermes ACP 没有返回 sessionId".to_string())?
            .to_string();
        let instruction = format!("{}\n\nYou are a governed executor. Return ONLY JSON. For project context use {{\"type\":\"tool_call\",\"name\":\"read_file|list_files|search_project|git_status\",\"arguments\":{{...}}}}. To request a project modification or an allowlisted check, return apply_patch or run_check with arguments; OmniDesk will pause for independent approval before executing it. When enough context is available return {{\"type\":\"final\",\"result\":{{...}}}}. Never call tools directly.", prompt);
        let mut next_prompt = instruction;
        for step in 0..max_steps.max(1) {
            if cancellation.is_some_and(CancellationToken::is_cancelled) {
                return Err("请求已取消".to_string());
            }
            let request_id = 3 + (step as u64 * 2);
            hermes_write_request(
                &mut stdin,
                request_id,
                "session/prompt",
                json!({ "sessionId": session_id, "prompt": [{ "type": "text", "text": next_prompt }] }),
            )?;
            let mut agent_text = String::new();
            hermes_wait_for_response(
                &lines_rx,
                &mut stdin,
                request_id,
                deadline,
                &mut agent_text,
                cancellation,
            )?;
            let envelope = extract_structured_hermes_envelope(&agent_text)?;
            let kind = envelope.get("type").and_then(Value::as_str).unwrap_or("");
            if kind == "final" {
                trace.push(format!("HERMES_STEP: {} final", step + 1));
                return Ok(HermesAgentLoopResult {
                    status: "succeeded".to_string(),
                    summary: "Hermes 已完成结构化推理。".to_string(),
                    step: step + 1,
                    result: envelope.get("result").cloned(),
                    approval: None,
                    observations,
                    trace,
                });
            }
            if kind != "tool_call" {
                return Err("Hermes 返回未知 envelope 类型".to_string());
            }
            let name = envelope.get("name").and_then(Value::as_str).unwrap_or("");
            let mut args = envelope
                .get("arguments")
                .cloned()
                .unwrap_or_else(|| json!({}));
            trace.push(format!("HERMES_STEP: {} tool {}", step + 1, name));
            if matches!(name, "apply_patch" | "run_check") {
                if name == "apply_patch" {
                    let diff = args
                        .get("diff")
                        .and_then(Value::as_str)
                        .ok_or_else(|| "Hermes Patch 请求缺少 diff。".to_string())?;
                    crate::runtime::patch::validate_apply_diff_paths(diff)?;
                    let allowed_files = authorized_patch_files.iter().cloned().collect::<Vec<_>>();
                    crate::runtime::patch::validate_unified_diff_authorized(diff, &allowed_files)?;
                    args["allowedFiles"] = json!(allowed_files);
                }
                let approval = json!({ "id": format!("hermes:{}:approval", step), "name": name, "arguments": args, "reason": if name == "apply_patch" { "修改项目文件" } else { "运行项目检查" }, "toolCallId": format!("hermes:{}:tool", step), "status": "pending", "token": format!("hermes-approval-{}-{}", step, current_unix_timestamp()) });
                return Ok(HermesAgentLoopResult {
                    status: "awaiting-approval".to_string(),
                    summary: "Hermes 请求了需要确认的操作。".to_string(),
                    step: step + 1,
                    result: None,
                    approval: Some(approval),
                    observations,
                    trace,
                });
            }
            let observation = hermes_read_tool_observation(root, name, &args)
                .map_err(|err| format!("Hermes 读取工具失败：{err}"))?;
            if name == "read_file" {
                if let Some(path) = args
                    .get("path")
                    .and_then(Value::as_str)
                    .filter(|path| crate::runtime::patch::is_context_path(path))
                {
                    authorized_patch_files.insert(path.to_string());
                }
            }
            observations.push(json!({ "name": name, "success": true, "data": observation }));
            next_prompt = format!(
                "Tool observation (do not repeat the tool call unless needed): {}",
                observations.last().unwrap()
            );
        }
        Ok(HermesAgentLoopResult {
            status: "budget-exceeded".to_string(),
            summary: format!("Hermes 工具步数超过上限（{}）", max_steps.max(1)),
            step: max_steps.max(1),
            result: None,
            approval: None,
            observations,
            trace,
        })
    })();
    let _ = child.kill();
    let _ = child.wait();
    if let Err(error) = &result {
        let stderr = stderr_rx
            .recv_timeout(Duration::from_secs(1))
            .unwrap_or_default();
        if !stderr.trim().is_empty() {
            result = Err(format!("{}；Hermes: {}", error, trim_for_trace(&stderr)));
        }
    }
    result
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
    let mut run = crate::runtime::agent_runs::load(&app_root, &input.id)
        .map_err(|_| "没有找到待执行的 Agent Run。".to_string())?;
    if run.status != "awaiting-approval" {
        return Err(format!("当前状态为 {}，不能执行审批工具。", run.status));
    }
    let approval = run
        .approval
        .clone()
        .ok_or_else(|| "没有待审批工具请求。".to_string())?;
    if approval.get("status").and_then(Value::as_str) != Some("approved") {
        return Err("审批请求尚未批准。".to_string());
    }
    let expected = approval.get("token").and_then(Value::as_str).unwrap_or("");
    if expected.is_empty() || expected != input.token {
        return Err("审批 token 不匹配，拒绝执行。".to_string());
    }
    let name = approval.get("name").and_then(Value::as_str).unwrap_or("");
    let arguments = approval
        .get("arguments")
        .cloned()
        .unwrap_or_else(|| json!({}));
    let timestamp = current_timestamp_string();
    run.status = if name == "apply_patch" {
        "applying"
    } else {
        "verifying"
    }
    .to_string();
    run.revision += 1;
    run.updated_at = timestamp.clone();
    run.summary = format!("正在执行已批准工具：{name}");
    run.checkpoint.phase = run.status.clone();
    run.checkpoint.context_summary = run.summary.clone();
    run.checkpoint.last_confirmation = Some(approval.clone());
    run.checkpoint.next_action = if name == "apply_patch" {
        "resume-apply-approval".to_string()
    } else {
        "resume-check-approval".to_string()
    };
    run.checkpoint.tool_name = name.to_string();
    run.checkpoint.tool_arguments = arguments.clone();
    run.checkpoint.tool_result = None;
    run.checkpoint.allowed_files = arguments
        .get("allowedFiles")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(ToString::to_string)
                .collect()
        })
        .unwrap_or_default();
    let execution_phase = run.status.clone();
    crate::runtime::agent_runs::append_evidence(
        &mut run,
        &execution_phase,
        format!("开始执行已批准工具：{name}"),
        json!({ "arguments": arguments }),
        &timestamp,
    );
    crate::runtime::agent_runs::persist(&app_root, &run)?;
    let result = (|| -> Result<Value, String> {
        match name {
            "apply_patch" => {
                if normalize_project_access_mode(
                    &current_registry_project(&mut load_or_seed_registry(&app_root)?, &app_root)?
                        .access_mode,
                ) != "controlled"
                {
                    return Err("当前项目未授权受控修改。".to_string());
                }
                let diff = arguments
                    .get("diff")
                    .and_then(Value::as_str)
                    .ok_or_else(|| "审批 Patch 缺少 diff。".to_string())?;
                let allowed_files = arguments
                    .get("allowedFiles")
                    .and_then(Value::as_array)
                    .map(|items| {
                        items
                            .iter()
                            .filter_map(Value::as_str)
                            .map(ToString::to_string)
                            .collect::<Vec<_>>()
                    })
                    .unwrap_or_default();
                crate::runtime::patch::validate_unified_diff_authorized(diff, &allowed_files)?;
                Ok(serde_json::to_value(apply_patch_draft(ApplyPatchDraftInput {
                task: json!({ "patchDraft": { "diff": diff, "allowedFiles": allowed_files } }),
            })?)
            .map_err(|err| err.to_string())?)
            }
            "run_check" => {
                if normalize_project_access_mode(
                    &current_registry_project(&mut load_or_seed_registry(&app_root)?, &app_root)?
                        .access_mode,
                ) != "controlled"
                {
                    return Err("当前项目未授权执行检查。".to_string());
                }
                let check_id = arguments
                    .get("checkId")
                    .and_then(Value::as_str)
                    .ok_or_else(|| "审批检查缺少 checkId。".to_string())?;
                Ok(
                    serde_json::to_value(run_guarded_check(RunGuardedCheckInput {
                        check_id: check_id.to_string(),
                    })?)
                    .map_err(|err| err.to_string())?,
                )
            }
            _ => return Err(format!("不允许执行审批工具：{name}")),
        }
    })();
    let result = match result {
        Ok(result) => result,
        Err(error) => {
            run.status = "failed".to_string();
            run.revision += 1;
            run.updated_at = current_timestamp_string();
            run.summary = format!("已批准工具执行失败：{error}");
            run.checkpoint.phase = "failed".to_string();
            run.checkpoint.context_summary = run.summary.clone();
            run.checkpoint.next_action = "none".to_string();
            run.checkpoint.tool_result = Some(json!({ "error": error.clone() }));
            let evidence_at = run.updated_at.clone();
            let failure_summary = run.summary.clone();
            crate::runtime::agent_runs::append_evidence(
                &mut run,
                "tool-failed",
                failure_summary,
                json!({ "name": name, "error": error.clone() }),
                &evidence_at,
            );
            crate::runtime::agent_runs::persist(&app_root, &run)?;
            return Err(error);
        }
    };
    let check_failed =
        name == "run_check" && result.get("success").and_then(Value::as_bool) == Some(false);
    if name == "run_check" {
        if let Some(check_id) = arguments.get("checkId").and_then(Value::as_str) {
            if !run
                .checkpoint
                .completed_check_ids
                .iter()
                .any(|id| id == check_id)
            {
                run.checkpoint
                    .completed_check_ids
                    .push(check_id.to_string());
            }
        }
    }
    if check_failed && run.checkpoint.remaining_repair_budget == 0 {
        run.status = "failed".to_string();
        run.checkpoint.next_action = "none".to_string();
        run.summary = "检查仍未通过，已达到两轮修复上限。".to_string();
    } else {
        if check_failed {
            run.checkpoint.remaining_repair_budget -= 1;
            run.repair_attempt += 1;
            run.checkpoint.next_action = "resume-repair-draft".to_string();
            run.summary = format!(
                "检查未通过，剩余 {} 轮受控修复。",
                run.checkpoint.remaining_repair_budget
            );
        } else {
            run.checkpoint.next_action = "resume-model".to_string();
            run.summary = format!("已执行审批工具：{name}；等待模型根据结果继续。");
        }
        run.status = "queued".to_string();
    }
    run.step += 1;
    run.revision += 1;
    run.updated_at = current_timestamp_string();
    run.checkpoint.phase = run.status.clone();
    run.checkpoint.context_summary = run.summary.clone();
    run.checkpoint.tool_result = Some(result.clone());
    run.approval = None;
    run.approval_token.clear();
    let evidence_at = run.updated_at.clone();
    let completed_summary = run.summary.clone();
    crate::runtime::agent_runs::append_evidence(
        &mut run,
        if check_failed { "check" } else { "tool-result" },
        completed_summary,
        json!({ "name": name, "result": result }),
        &evidence_at,
    );
    crate::runtime::agent_runs::persist(&app_root, &run)?;
    Ok(result)
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
        format!("agent-{}", current_unix_timestamp())
    } else {
        format!("agent-{request_id}")
    };
    if !input.approval_token.trim().is_empty() {
        let existing_run = crate::runtime::agent_runs::load(&app_root, &run_id)
            .map_err(|_| "审批凭证没有对应的 Agent Run。".to_string())?;
        if existing_run.approval_token != input.approval_token {
            return Err("审批凭证不匹配，拒绝继续执行。".to_string());
        }
    }
    let now = current_timestamp_string();
    let base_run = if input.run_id.trim().is_empty() {
        let run = crate::runtime::agent_runs::new_hermes_run(
            run_id.clone(),
            request_id.clone(),
            current_project.id.clone(),
            input.prompt.clone(),
            input.max_steps,
            input.approval_token.clone(),
            &now,
        );
        crate::runtime::agent_runs::persist(&app_root, &run)?;
        run
    } else {
        let run = crate::runtime::agent_runs::load(&app_root, &run_id)?;
        if run.project_id != current_project.id {
            return Err("Agent Run 不属于当前项目，拒绝继续。".to_string());
        }
        if run.status != "queued" {
            return Err(format!("当前状态为 {}，不能继续模型阶段。", run.status));
        }
        run
    };
    let continuation = base_run.checkpoint.tool_result.as_ref().map(|result| {
        format!(
            "\n\nOmniDesk 已执行上一受控工具，结果如下。不要重复这个操作；保留授权文件范围，若仍需写入或检查，先请求新的独立审批。\n{}",
            serde_json::to_string(result).unwrap_or_else(|_| "null".to_string())
        )
    }).unwrap_or_default();
    let execution_prompt = format!("{}{}", base_run.prompt, continuation);
    let mut running_run = base_run;
    running_run.status = "running".to_string();
    running_run.revision += 1;
    running_run.updated_at = current_timestamp_string();
    running_run.summary = "Hermes 正在读取上下文并形成结果。".to_string();
    running_run.checkpoint.phase = "running".to_string();
    running_run.checkpoint.context_summary = running_run.summary.clone();
    running_run.checkpoint.last_confirmation = None;
    running_run.checkpoint.next_action = "resume-model".to_string();
    let running_evidence_at = running_run.updated_at.clone();
    crate::runtime::agent_runs::append_evidence(
        &mut running_run,
        "draft",
        "Hermes 开始生成受控草稿。",
        json!({ "maxSteps": input.max_steps, "resumed": !input.run_id.trim().is_empty() }),
        &running_evidence_at,
    );
    crate::runtime::agent_runs::persist(&app_root, &running_run)?;
    let token = if request_id.is_empty() {
        None
    } else {
        Some(runtime_requests.start(&request_id))
    };
    let cancellation = token.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        run_hermes_acp_structured_loop(
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
    let mut finished_run = running_run;
    finished_run.status = match result.as_ref() {
        Ok(value) if value.status == "awaiting-approval" => "awaiting-approval",
        Ok(value) if value.status == "succeeded" => "succeeded",
        Ok(_) => "failed",
        Err(error) if error.contains("取消") => "cancelled",
        Err(_) => "failed",
    }
    .to_string();
    finished_run.step = result
        .as_ref()
        .ok()
        .map(|value| value.step)
        .unwrap_or(finished_run.step);
    finished_run.revision += 1;
    finished_run.updated_at = current_timestamp_string();
    finished_run.summary = result
        .as_ref()
        .map(|value| value.summary.clone())
        .unwrap_or_else(|error| error.to_string());
    finished_run.approval = result
        .as_ref()
        .ok()
        .and_then(|value| value.approval.clone());
    finished_run.checkpoint.phase = finished_run.status.clone();
    finished_run.checkpoint.context_summary = finished_run.summary.clone();
    finished_run.checkpoint.last_confirmation = finished_run.approval.clone();
    finished_run.checkpoint.next_action = if finished_run.status == "awaiting-approval" {
        "resume-approval".to_string()
    } else if matches!(
        finished_run.status.as_str(),
        "failed" | "cancelled" | "succeeded"
    ) {
        "none".to_string()
    } else {
        "resume-stage".to_string()
    };
    let evidence_phase = if finished_run.status == "awaiting-approval" {
        "approval"
    } else {
        "result"
    };
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
    let finished_summary = finished_run.summary.clone();
    let finished_evidence_at = finished_run.updated_at.clone();
    crate::runtime::agent_runs::append_evidence(
        &mut finished_run,
        evidence_phase,
        finished_summary,
        evidence_details,
        &finished_evidence_at,
    );
    crate::runtime::agent_runs::persist(&app_root, &finished_run)?;
    if !request_id.is_empty() {
        runtime_requests.finish(&request_id);
    }
    result
}

async fn generate_provider_chat(
    provider: &ProviderConfig,
    root: &Path,
    project_name: &str,
    stage: &str,
    message: &str,
    attachments: &[PlanAttachment],
    recent_turns: &[ChatTurnInput],
    context_state: &DialogueContextInput,
    summary: &Value,
    project_memory: &[Value],
    project_evidence: &Value,
    app: &AppHandle,
    request_id: &str,
) -> Result<ChatWithModelResult, String> {
    let api_key = read_secret_from_env_or_dotenv(root, &provider.api_key_env)
        .ok_or_else(|| format!("环境变量或 .env.local 中未设置 {}", provider.api_key_env))?;
    if api_key.trim().is_empty() {
        return Err(format!("环境变量 {} 为空", provider.api_key_env));
    }

    let router_prompt = chat_router_prompt(
        project_name,
        stage,
        &provider.model,
        message,
        attachments,
        recent_turns,
        context_state,
        summary,
        project_memory,
        project_evidence,
    );
    let user_content = if attachments.is_empty() {
        Value::String(router_prompt)
    } else {
        let mut parts = vec![json!({
            "type": "text",
            "text": router_prompt
        })];
        for attachment in attachments {
            parts.push(json!({
                "type": "image_url",
                "image_url": {
                    "url": attachment.data_url,
                    "detail": "auto"
                }
            }));
        }
        Value::Array(parts)
    };
    let response = post_chat_completion(
        provider,
        &api_key,
        &json!({
            "model": provider.model,
            "messages": [
                {
                    "role": "system",
                    "content": "You are OmniDesk, a local AI project workbench assistant. Return only strict JSON with keys reply, shouldCreatePlan, intent. Do not include markdown fences."
                },
                {
                    "role": "user",
                    "content": user_content
                }
            ],
            "temperature": 0.45,
            "stream": true
        }),
        Duration::from_secs(45),
    )
    .await?;
    let response = require_provider_success(response, "provider").await?;

    let is_sse = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.contains("text/event-stream"))
        .unwrap_or(false);
    let content = if !is_sse {
        chat_completion_content(response).await?
    } else {
        let mut content = String::new();
        let mut pending = String::new();
        let mut emitted_reply_chars = 0usize;
        let mut stream = response.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|err| err.to_string())?;
            let chunk = String::from_utf8_lossy(&chunk);
            for delta in consume_openai_sse_deltas(&mut pending, &chunk) {
                content.push_str(&delta);
                let reply = streaming_reply_prefix(&content);
                let reply_delta = reply.chars().skip(emitted_reply_chars).collect::<String>();
                emitted_reply_chars += reply_delta.chars().count();
                emit_conversation_event(
                    app,
                    request_id,
                    "model.delta",
                    "thinking",
                    "running",
                    json!({ "chars": delta.chars().count(), "text": reply_delta }),
                );
            }
        }
        if content.trim().is_empty() {
            return Err("provider 流式返回空内容".to_string());
        }
        content
    };
    let mut result: ChatWithModelResult =
        serde_json::from_str(&content).map_err(|err| format!("chat JSON 解析失败: {}", err))?;
    if result.reply.trim().is_empty() {
        result.reply =
            "我在。你可以直接说想做什么，我会先判断是普通对话还是需要创建计划。".to_string();
    }
    if result.intent.trim().is_empty() {
        result.intent = if result.should_create_plan {
            "task"
        } else {
            "chat"
        }
        .to_string();
    }
    Ok(result)
}

#[tauri::command]
fn get_provider_status() -> Result<ProviderStatus, String> {
    let app_root = find_workspace_root()?;
    let config = load_or_seed_provider_config(&app_root)?;
    sync_hermes_runtime_config(&config)?;
    Ok(provider_status(&config))
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
    let mut existing = load_or_seed_provider_config(&app_root)?;
    let provider = input.provider.trim();
    let model = input.model.trim();
    let api_base = input.api_base.trim();
    let api_key_env = input.api_key_env.trim();

    if provider.is_empty() {
        return Err("请输入 provider".to_string());
    }
    if model.is_empty() {
        return Err("请输入 model".to_string());
    }
    if api_base.is_empty() {
        return Err("请输入 apiBase".to_string());
    }
    if api_key_env.is_empty() {
        return Err("请输入 apiKeyEnv".to_string());
    }

    let profile_id = if input.profile_id.trim().is_empty() {
        provider_profile_id(api_key_env)
    } else {
        input.profile_id.trim().to_string()
    };
    let profile_name = if input.profile_name.trim().is_empty() {
        provider_profile_name(api_key_env, model)
    } else {
        input.profile_name.trim().to_string()
    };
    let profile_note = input.profile_note.trim().to_string();
    let profile_website = input.profile_website.trim().to_string();
    if existing
        .profiles
        .iter()
        .any(|item| item.id != profile_id && item.api_key_env == api_key_env)
    {
        return Err("每个连接必须使用独立的 Key 保存变量，请重新保存连接。".to_string());
    }
    let profile = ProviderProfile {
        id: profile_id.clone(),
        name: profile_name,
        note: profile_note,
        website: profile_website,
        provider: provider.to_string(),
        model: model.to_string(),
        api_base: api_base.to_string(),
        api_key_env: api_key_env.to_string(),
    };
    upsert_provider_profile(&mut existing.profiles, profile);

    let config = ProviderConfig {
        schema_version: PROVIDER_SCHEMA_VERSION.to_string(),
        provider: provider.to_string(),
        model: model.to_string(),
        api_base: api_base.to_string(),
        api_key_env: api_key_env.to_string(),
        enabled: input.enabled,
        active_profile_id: profile_id,
        profiles: existing.profiles,
    };
    save_provider_config_file(&app_root, &config)?;
    sync_hermes_runtime_config(&config)?;
    Ok(provider_status(&config))
}

#[tauri::command]
fn save_provider_secret(input: ProviderSecretInput) -> Result<ProviderStatus, String> {
    let app_root = find_workspace_root()?;
    let mut config = load_or_seed_provider_config(&app_root)?;
    let api_key_env = input.api_key_env.trim();
    let api_key = input.api_key.trim();

    if api_key_env.is_empty() {
        return Err("缺少 API Key Env".to_string());
    }
    if api_key.is_empty() {
        return Err("请先粘贴 API Key".to_string());
    }
    if !api_key_env
        .chars()
        .all(|ch| ch.is_ascii_uppercase() || ch.is_ascii_digit() || ch == '_')
    {
        return Err("API Key Env 只能使用大写字母、数字和下划线".to_string());
    }

    write_dotenv_value(&app_root, api_key_env, api_key)?;
    config.api_key_env = api_key_env.to_string();
    config.enabled = true;
    save_provider_config_file(&app_root, &config)?;
    sync_hermes_runtime_config(&config)?;
    Ok(provider_status(&config))
}

#[tauri::command]
fn delete_provider_profile(input: DeleteProviderProfileInput) -> Result<ProviderStatus, String> {
    let app_root = find_workspace_root()?;
    let mut config = load_or_seed_provider_config(&app_root)?;
    let profile_id = input.profile_id.trim();

    if profile_id.is_empty() {
        return Err("缺少连接 ID".to_string());
    }

    let Some(removed) = config
        .profiles
        .iter()
        .find(|profile| profile.id == profile_id)
        .cloned()
    else {
        return Err("没有找到要删除的连接".to_string());
    };

    config.profiles.retain(|profile| profile.id != profile_id);

    if !removed.api_key_env.trim().is_empty()
        && !config
            .profiles
            .iter()
            .any(|profile| profile.api_key_env == removed.api_key_env)
    {
        remove_dotenv_value(&app_root, &removed.api_key_env)?;
    }

    if config.active_profile_id == profile_id {
        if let Some(next) = config.profiles.first().cloned() {
            config.provider = next.provider;
            config.model = next.model;
            config.api_base = next.api_base;
            config.api_key_env = next.api_key_env;
            config.active_profile_id = next.id;
        } else {
            config.provider = "openai-compatible".to_string();
            config.model.clear();
            config.api_base.clear();
            config.api_key_env.clear();
            config.enabled = false;
            config.active_profile_id.clear();
        }
    }

    save_provider_config_file(&app_root, &config)?;
    sync_hermes_runtime_config(&config)?;
    Ok(provider_status(&config))
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
    let api_base = input.api_base.trim();
    let api_key_env = input.api_key_env.trim();
    let inline_api_key = input.api_key.trim();

    if api_base.is_empty() {
        return Err("请先填写 API 请求地址".to_string());
    }
    if api_key_env.is_empty() && inline_api_key.is_empty() {
        return Err("请先填写 Key 保存变量名或粘贴 API Key".to_string());
    }

    let api_key = if !inline_api_key.is_empty() {
        inline_api_key.to_string()
    } else {
        read_secret_from_env_or_dotenv(&app_root, api_key_env)
            .ok_or_else(|| format!("环境变量或 .env.local 中未设置 {}", api_key_env))?
    };

    let response = get_models(api_base, &api_key, Duration::from_secs(30)).await?;
    let models =
        listed_models(require_provider_success(response, "模型列表请求失败").await?).await?;

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
    let api_base = input.api_base.trim();
    let api_key_env = input.api_key_env.trim();
    let model = input.model.trim();
    let inline_api_key = input.api_key.trim();

    if api_base.is_empty() {
        return Err("请先填写 API 请求地址".to_string());
    }
    if model.is_empty() {
        return Err("请先选择或填写模型名称".to_string());
    }
    if api_key_env.is_empty() && inline_api_key.is_empty() {
        return Err("请先填写 Key 保存变量名或粘贴 API Key".to_string());
    }

    let provider = ProviderConfig {
        schema_version: PROVIDER_SCHEMA_VERSION.to_string(),
        provider: "openai-compatible".to_string(),
        model: model.to_string(),
        api_base: api_base.to_string(),
        api_key_env: api_key_env.to_string(),
        enabled: true,
        active_profile_id: String::new(),
        profiles: Vec::new(),
    };
    test_provider_config(&app_root, &provider, inline_api_key).await
}

async fn test_provider_config(
    app_root: &Path,
    provider: &ProviderConfig,
    inline_api_key: &str,
) -> Result<ProviderModelTestResult, String> {
    let api_key = if !inline_api_key.trim().is_empty() {
        inline_api_key.trim().to_string()
    } else {
        read_secret_from_env_or_dotenv(app_root, &provider.api_key_env)
            .ok_or_else(|| format!("环境变量或 .env.local 中未设置 {}", provider.api_key_env))?
    };

    let response = post_chat_completion(
        provider,
        &api_key,
        &json!({
            "model": provider.model,
            "messages": [
                {
                    "role": "user",
                    "content": "Reply with OK only."
                }
            ],
            "temperature": 0
        }),
        Duration::from_secs(45),
    )
    .await?;
    let content =
        chat_completion_content(require_provider_success(response, "模型测试失败").await?)
            .await
            .map_err(|error| {
                if error == "provider 返回空内容" {
                    "模型返回为空".to_string()
                } else {
                    error
                }
            })?;

    Ok(ProviderModelTestResult {
        model: provider.model.clone(),
        success: true,
        message: format!("{} 可用：{}", provider.model, trim_for_trace(&content)),
    })
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
                    checked_at: current_unix_timestamp(),
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
                    checked_at: current_unix_timestamp(),
                },
            )?;
            Err(err)
        }
    }
}

fn record_provider_failure(
    app_root: &Path,
    provider: &ProviderConfig,
    message: &str,
) -> Result<(), String> {
    crate::runtime::provider::record_health(
        app_root,
        ModelHealthEntry {
            api_base: provider.api_base.clone(),
            api_key_env: provider.api_key_env.clone(),
            model: provider.model.clone(),
            status: crate::runtime::provider::classify_failure(message).to_string(),
            message: trim_for_trace(message),
            checked_at: current_unix_timestamp(),
        },
    )
}

fn persist_selected_provider(app_root: &Path, provider: &ProviderConfig) -> Result<(), String> {
    save_provider_config_file(app_root, provider)?;
    #[cfg(not(test))]
    sync_hermes_runtime_config(provider)?;
    Ok(())
}

async fn prepare_provider_for_request(
    app_root: &Path,
    configured: &ProviderConfig,
    excluded_profile_ids: &HashSet<String>,
) -> Result<(ProviderConfig, String), String> {
    let health = load_or_seed_model_health(app_root)?;
    let candidates = ordered_profile_candidates(configured);
    let mut failures = Vec::new();
    for (profile_id, candidate) in candidates {
        if excluded_profile_ids.contains(&profile_id) {
            continue;
        }
        let label = configured
            .profiles
            .iter()
            .find(|profile| profile.id == profile_id)
            .map(|profile| profile.name.clone())
            .filter(|name| !name.trim().is_empty())
            .unwrap_or_else(|| candidate.model.clone());
        if read_secret_from_env_or_dotenv(app_root, &candidate.api_key_env).is_none() {
            let message = "未配置 API Key";
            record_provider_failure(app_root, &candidate, message)?;
            failures.push(format!("{}（认证失败）", label));
            continue;
        }
        if let Some(entry) = provider_health_entry(&health, &candidate) {
            if provider_health_is_fresh(entry, current_unix_timestamp().parse::<u64>().unwrap_or(0))
            {
                if entry.status == "available" {
                    let switch_note = if profile_id != configured.active_profile_id {
                        format!("已自动切换到可用连接「{}」。", label)
                    } else {
                        String::new()
                    };
                    if profile_id != configured.active_profile_id {
                        persist_selected_provider(app_root, &candidate)?;
                    }
                    return Ok((candidate, switch_note));
                }
                failures.push(format!("{}（{}）", label, entry.status));
                continue;
            }
        }
        match test_provider_config(app_root, &candidate, "").await {
            Ok(result) => {
                crate::runtime::provider::record_health(
                    app_root,
                    ModelHealthEntry {
                        api_base: candidate.api_base.clone(),
                        api_key_env: candidate.api_key_env.clone(),
                        model: candidate.model.clone(),
                        status: "available".to_string(),
                        message: result.message,
                        checked_at: current_unix_timestamp(),
                    },
                )?;
                let switch_note = if profile_id != configured.active_profile_id {
                    format!("已自动切换到可用连接「{}」。", label)
                } else {
                    String::new()
                };
                if profile_id != configured.active_profile_id {
                    persist_selected_provider(app_root, &candidate)?;
                }
                return Ok((candidate, switch_note));
            }
            Err(error) => {
                record_provider_failure(app_root, &candidate, &error)?;
                failures.push(format!(
                    "{}（{}）",
                    label,
                    crate::runtime::provider::classify_failure(&error)
                ));
            }
        }
    }
    Err(format!(
        "没有可用模型连接：{}",
        if failures.is_empty() {
            "未找到可用 profile".to_string()
        } else {
            failures.join("；")
        }
    ))
}

#[tauri::command]
fn run_guarded_check(input: RunGuardedCheckInput) -> Result<GuardedCheckResult, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    if !root.exists() || !root.is_dir() {
        return Err("当前项目路径不存在或不是目录".to_string());
    }

    let spec = guarded_check_spec(&input.check_id)
        .ok_or_else(|| format!("不允许执行这个检查：{}", input.check_id))?;
    for relative in &spec.required_paths {
        if !root.join(relative).exists() {
            return Err(format!("当前项目缺少检查所需文件：{}", relative));
        }
    }

    let output = Command::new(&spec.program)
        .args(&spec.args)
        .current_dir(&root)
        .output()
        .map_err(|err| err.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = trim_runner_output(&format!("{}{}", stdout, stderr));

    let result = GuardedCheckResult {
        id: spec.id.to_string(),
        label: spec.label.to_string(),
        command: spec.command.to_string(),
        success: output.status.success(),
        code: output.status.code(),
        output: combined,
    };
    let _ = crate::runtime::execution::append_audit(
        &root,
        "guarded-check",
        result.success,
        json!({ "checkId": result.id }),
        &current_timestamp_string(),
    );
    Ok(result)
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
    let mut run = crate::runtime::agent_runs::new_hermes_run(
        "native-recovery-run".to_string(),
        "native-recovery-request".to_string(),
        project.id,
        "Native WebDriver multi-file recovery fixture. Do not execute tools.".to_string(),
        1,
        String::new(),
        &timestamp,
    );
    let approval = json!({
        "token": "native-recovery-approval",
        "status": "pending",
        "name": "apply_patch",
        "arguments": {
            "allowedFiles": ["README.md", "AGENTS.md", "PROJECT.md", "docs/TESTING.md"],
            "diff": "diff --git a/README.md b/README.md\n--- a/README.md\n+++ b/README.md\n@@ -1 +1 @@\n-# Native WebDriver fixture\n+# Native WebDriver fixture\ndiff --git a/AGENTS.md b/AGENTS.md\n--- a/AGENTS.md\n+++ b/AGENTS.md\n@@ -1 +1 @@\n-# Native WebDriver fixture\n+# Native WebDriver fixture\n"
        }
    });
    run.status = "awaiting-approval".to_string();
    run.summary = "原生多文件恢复夹具正在等待 Patch 审批。".to_string();
    run.approval = Some(approval.clone());
    run.checkpoint.phase = "awaiting-approval".to_string();
    run.checkpoint.context_summary = run.summary.clone();
    run.checkpoint.last_confirmation = Some(approval);
    run.checkpoint.next_action = "resume-approval".to_string();
    run.checkpoint.tool_name = "apply_patch".to_string();
    run.checkpoint.allowed_files = vec![
        "README.md".to_string(),
        "AGENTS.md".to_string(),
        "PROJECT.md".to_string(),
        "docs/TESTING.md".to_string(),
    ];
    let authorized_files = run.checkpoint.allowed_files.clone();
    crate::runtime::agent_runs::append_evidence(
        &mut run,
        "approval",
        "Native WebDriver multi-file recovery fixture created.",
        json!({ "fixture": true, "authorizedFiles": authorized_files }),
        &timestamp,
    );
    crate::runtime::agent_runs::persist(&app_root, &run)?;
    Ok(run)
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

fn read_json(path: PathBuf) -> Option<Value> {
    let resolved = crate::runtime::state_namespace::state_path_from_absolute(&path).ok()?;
    fs::read_to_string(resolved)
        .ok()
        .and_then(|content| serde_json::from_str(&content).ok())
}

fn runtime_state_exists(root: &Path, relative_path: &str) -> bool {
    crate::runtime::state_namespace::state_path_exists(root, relative_path)
}

fn runtime_state_path(root: &Path, relative_path: &str) -> Option<PathBuf> {
    crate::runtime::state_namespace::state_path_for_read(root, relative_path).ok()
}

fn provider_config_path(app_root: &Path) -> PathBuf {
    crate::runtime::state_namespace::state_path_for_read(app_root, PROVIDER_PATH)
        .unwrap_or_else(|_| app_root.join(PROVIDER_PATH))
}

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
            output.status.success().then(|| String::from_utf8_lossy(&output.stdout).trim().to_string())
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
    if !config.enabled || config.model.trim().is_empty() || config.api_base.trim().is_empty() {
        return Ok(());
    }
    let Some(home) = std::env::var_os("HOME") else {
        return Ok(());
    };
    let path = PathBuf::from(home).join(".hermes/config.yaml");
    if !path.is_file() {
        return Ok(());
    }
    let current =
        fs::read_to_string(&path).map_err(|err| format!("读取 Hermes 配置失败: {err}"))?;
    let next = crate::runtime::provider::render_hermes_runtime_config(&current, config)?;
    if next != current {
        write_file_atomic(&path, next.as_bytes())
            .map_err(|err| format!("同步 Hermes 配置失败: {err}"))?;
    }
    Ok(())
}

fn load_or_seed_model_health(app_root: &Path) -> Result<ModelHealthCache, String> {
    crate::runtime::provider::load_or_seed_health(app_root)
}

fn current_unix_timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

fn provider_status(config: &ProviderConfig) -> ProviderStatus {
    let app_root = find_workspace_root().ok();
    let (workspace_root, revision) = app_root
        .as_deref()
        .map(provider_status_source)
        .unwrap_or_else(|| (String::new(), "unknown".to_string()));
    let profiles = config
        .profiles
        .iter()
        .map(|profile| ProviderProfileStatus {
            id: profile.id.clone(),
            name: profile.name.clone(),
            note: profile.note.clone(),
            website: profile.website.clone(),
            provider: profile.provider.clone(),
            model: profile.model.clone(),
            api_base: profile.api_base.clone(),
            api_key_env: profile.api_key_env.clone(),
            has_api_key: app_root
                .as_deref()
                .and_then(|root| read_secret_from_env_or_dotenv(root, &profile.api_key_env))
                .map(|value| !value.trim().is_empty())
                .unwrap_or(false),
        })
        .collect();
    ProviderStatus {
        provider: config.provider.clone(),
        model: config.model.clone(),
        api_base: config.api_base.clone(),
        api_key_env: config.api_key_env.clone(),
        enabled: config.enabled,
        has_api_key: app_root
            .as_deref()
            .and_then(|root| read_secret_from_env_or_dotenv(root, &config.api_key_env))
            .map(|value| !value.trim().is_empty())
            .unwrap_or(false),
        active_profile_id: config.active_profile_id.clone(),
        profiles,
        source: "tauri".to_string(),
        workspace_root,
        revision,
    }
}

fn provider_status_source(app_root: &Path) -> (String, String) {
    let path = provider_config_path(app_root);
    let revision = fs::metadata(&path)
        .ok()
        .and_then(|metadata| {
            let modified = metadata.modified().ok()?.duration_since(UNIX_EPOCH).ok()?;
            Some(format!("{}-{}", modified.as_millis(), metadata.len()))
        })
        .unwrap_or_else(|| "missing".to_string());
    (app_root.to_string_lossy().to_string(), revision)
}

fn read_secret_from_env_or_dotenv(root: &Path, key: &str) -> Option<String> {
    crate::runtime::provider::read_secret(root, key)
}

fn write_dotenv_value(root: &Path, key: &str, value: &str) -> Result<(), String> {
    crate::runtime::provider::write_secret(root, key, value)
}

fn remove_dotenv_value(root: &Path, key: &str) -> Result<(), String> {
    crate::runtime::provider::remove_secret(root, key)
}

#[tauri::command]
fn copy_text_to_clipboard(text: String) -> Result<(), String> {
    if text.trim().is_empty() {
        return Err("没有可复制的内容。".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        let mut child = Command::new("pbcopy")
            .stdin(Stdio::piped())
            .spawn()
            .map_err(|err| format!("复制失败：{err}"))?;
        if let Some(stdin) = child.stdin.as_mut() {
            stdin
                .write_all(text.as_bytes())
                .map_err(|err| format!("复制失败：{err}"))?;
        }
        let status = child.wait().map_err(|err| format!("复制失败：{err}"))?;
        if status.success() {
            Ok(())
        } else {
            Err("复制失败：系统剪贴板不可用。".to_string())
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("当前桌面端复制路径暂只支持 macOS。".to_string())
    }
}

fn count_run_records(root: &Path) -> usize {
    let Some(runs_dir) = runtime_state_path(root, ".omnidesk/evidence/runs") else {
        return 0;
    };
    fs::read_dir(runs_dir)
        .ok()
        .into_iter()
        .flatten()
        .filter_map(Result::ok)
        .filter(|entry| entry.path().extension().and_then(|ext| ext.to_str()) == Some("json"))
        .count()
}

fn recommendation_queue(recommendations: &Option<Value>) -> Vec<QueueItem> {
    recommendations
        .as_ref()
        .and_then(|json| json.get("recommendations"))
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .take(5)
                .enumerate()
                .map(|(index, item)| QueueItem {
                    id: item
                        .get("id")
                        .and_then(Value::as_str)
                        .map(ToString::to_string)
                        .unwrap_or_else(|| format!("recommendation-{}", index + 1)),
                    title: item
                        .get("title")
                        .or_else(|| item.get("id"))
                        .and_then(Value::as_str)
                        .unwrap_or("推荐补齐项")
                        .to_string(),
                    status: item
                        .get("priority")
                        .and_then(Value::as_str)
                        .unwrap_or("排队中")
                        .to_string(),
                    body: item
                        .get("reason")
                        .or_else(|| item.get("body"))
                        .and_then(Value::as_str)
                        .unwrap_or("来自 OmniDesk 建议缓存。")
                        .to_string(),
                    tone: "blue".to_string(),
                    goal_id: String::new(),
                })
                .collect()
        })
        .unwrap_or_default()
}

fn task_backlog_queue(backlog: &Option<Value>) -> Vec<QueueItem> {
    backlog
        .as_ref()
        .and_then(|json| json.get("items"))
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .take(12)
                .map(|item| QueueItem {
                    id: item
                        .get("id")
                        .and_then(Value::as_str)
                        .unwrap_or("backlog-item")
                        .to_string(),
                    title: item
                        .get("title")
                        .and_then(Value::as_str)
                        .unwrap_or("未命名任务")
                        .to_string(),
                    status: item
                        .get("status")
                        .and_then(Value::as_str)
                        .unwrap_or("planned")
                        .to_string(),
                    body: item
                        .get("body")
                        .and_then(Value::as_str)
                        .unwrap_or("来自 OmniDesk 任务池。")
                        .to_string(),
                    tone: item
                        .get("tone")
                        .and_then(Value::as_str)
                        .unwrap_or("neutral")
                        .to_string(),
                    goal_id: item
                        .get("goalId")
                        .and_then(Value::as_str)
                        .unwrap_or("")
                        .to_string(),
                })
                .collect()
        })
        .unwrap_or_default()
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
        assert!(fs::read_to_string(root.join(crate::runtime::theme::THEME_PATH))
            .unwrap()
            .contains(crate::runtime::theme::LEGACY_SCHEMA_VERSION));

        save_desktop_theme_file(&root, &theme).unwrap();
        assert!(fs::read_to_string(root.join(crate::runtime::theme::THEME_PATH))
            .unwrap()
            .contains(crate::runtime::theme::SCHEMA_VERSION));
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
    fn patch_diff_preserves_terminal_newline_for_git_apply() {
        let dir = test_directory("patch-newline");
        fs::create_dir_all(&dir).unwrap();
        let init = Command::new("git")
            .args(["init", "-q"])
            .current_dir(&dir)
            .output()
            .unwrap();
        assert!(init.status.success());
        let draft = json!({
            "diff": "--- /dev/null\n+++ b/action-smoke.txt\n@@ -0,0 +1 @@\n+ok\n"
        });
        let diff = patch_diff_from_draft(&draft).unwrap();
        assert!(diff.ends_with('\n'));
        assert!(run_git_apply(&dir, diff, true).unwrap().status.success());
        assert!(run_git_apply(&dir, diff, false).unwrap().status.success());
        assert_eq!(
            fs::read_to_string(dir.join("action-smoke.txt")).unwrap(),
            "ok\n"
        );
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
    fn hermes_read_tool_observation_uses_the_same_root_and_rejects_unknown_tools() {
        let dir = test_directory("hermes-read-tool");
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("README.md"), "omnidesk\n").unwrap();
        let value =
            hermes_read_tool_observation(&dir, "read_file", &json!({ "path": "README.md" }))
                .unwrap();
        assert_eq!(
            value.get("content").and_then(Value::as_str),
            Some("omnidesk\n")
        );
        assert!(hermes_read_tool_observation(&dir, "shell", &json!({})).is_err());
        fs::remove_dir_all(dir).unwrap();
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
    fn provider_preflight_switches_after_a_quota_failure_and_records_both_profiles() {
        use std::io::{Read as _, Write as _};
        use std::net::TcpListener;

        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = std::thread::spawn(move || {
            for (status, body) in [
                (
                    "403 Forbidden",
                    r#"{"error":{"message":"subscription quota insufficient"}}"#,
                ),
                ("200 OK", r#"{"choices":[{"message":{"content":"OK"}}]}"#),
            ] {
                let (mut stream, _) = listener.accept().unwrap();
                let mut request = [0_u8; 4096];
                let _ = stream.read(&mut request);
                write!(
                    stream,
                    "HTTP/1.1 {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    status,
                    body.len(),
                    body
                )
                .unwrap();
            }
        });
        let root = test_directory("provider-preflight");
        fs::create_dir_all(&root).unwrap();
        crate::runtime::provider::write_secret(&root, "TW_KEY", "test-primary").unwrap();
        crate::runtime::provider::write_secret(&root, "QY_KEY", "test-fallback").unwrap();
        let primary = ProviderProfile {
            id: "tw".to_string(),
            name: "TW Gateway".to_string(),
            note: String::new(),
            website: String::new(),
            provider: "openai-compatible".to_string(),
            model: "primary".to_string(),
            api_base: format!("http://{}", address),
            api_key_env: "TW_KEY".to_string(),
        };
        let fallback = ProviderProfile {
            id: "qy".to_string(),
            name: "QY".to_string(),
            note: String::new(),
            website: String::new(),
            provider: "openai-compatible".to_string(),
            model: "fallback".to_string(),
            api_base: format!("http://{}", address),
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
            profiles: vec![primary, fallback],
        };
        let (selected, note) = tauri::async_runtime::block_on(prepare_provider_for_request(
            &root,
            &config,
            &HashSet::new(),
        ))
        .unwrap();
        assert_eq!(selected.active_profile_id, "qy");
        assert!(note.contains("QY"));
        let persisted = load_or_seed_provider_config(&root).unwrap();
        assert_eq!(persisted.active_profile_id, "qy");
        let health = load_or_seed_model_health(&root).unwrap();
        assert_eq!(health.entries.len(), 2);
        assert!(health
            .entries
            .iter()
            .any(|entry| entry.status == "quota-exhausted"));
        assert!(health
            .entries
            .iter()
            .any(|entry| entry.status == "available"));
        server.join().unwrap();
        fs::remove_dir_all(root).unwrap();
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
