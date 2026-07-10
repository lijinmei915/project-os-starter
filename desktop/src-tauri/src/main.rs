#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use notify::{Config as NotifyConfig, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, State};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TreeItem {
    label: String,
    depth: usize,
    kind: String,
}

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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectProfile {
    overview: String,
    phase_summary: String,
    architecture_summary: String,
    check_commands: String,
    collaboration_rules: String,
    intro: String,
    long_term_goal: String,
    target_users: String,
    use_cases: String,
    user_preferences: String,
    missing_fields: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RegistryProject {
    id: String,
    name: String,
    path: String,
    phase: String,
    is_current: bool,
    health: String,
    status_label: String,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RegistryFileProject {
    id: String,
    name: String,
    path: String,
    phase: String,
    #[serde(default)]
    name_locked: bool,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct RegistryFile {
    schema_version: String,
    current_project_id: String,
    projects: Vec<RegistryFileProject>,
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
    projects: Vec<RegistryProject>,
    tree: Vec<TreeItem>,
    queue: Vec<QueueItem>,
    memory: Vec<MemoryItem>,
    project_profile: ProjectProfile,
    workspace_facts: Value,
    goal_validation: Value,
    goal_validation_report: Value,
    goal_signoff_history: Value,
    goals: Value,
    trace: Vec<String>,
}

#[derive(Default)]
struct TerminalState {
    generation: Mutex<u64>,
    sessions: Mutex<HashMap<String, TerminalSession>>,
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

struct TerminalSession {
    child: Box<dyn Child + Send>,
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReadonlyPlan {
    task: String,
    project_name: String,
    mode: String,
    summary: String,
    steps: Vec<String>,
    files_to_read: Vec<String>,
    candidate_changes: Vec<String>,
    checks: Vec<String>,
    guardrails: Vec<String>,
    trace: Vec<String>,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct PlanAttachment {
    name: String,
    mime_type: String,
    data_url: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GeneratePlanInput {
    task: String,
    #[serde(default)]
    attachments: Vec<PlanAttachment>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChatWithModelInput {
    message: String,
    #[serde(default)]
    attachments: Vec<PlanAttachment>,
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
struct SwitchGoalInput {
    id: String,
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

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ProviderConfig {
    schema_version: String,
    provider: String,
    model: String,
    api_base: String,
    api_key_env: String,
    enabled: bool,
    #[serde(default)]
    active_profile_id: String,
    #[serde(default)]
    profiles: Vec<ProviderProfile>,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ProviderProfile {
    id: String,
    name: String,
    note: String,
    website: String,
    provider: String,
    model: String,
    api_base: String,
    api_key_env: String,
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

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ModelCatalog {
    schema_version: String,
    providers: Vec<ModelCatalogProvider>,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ModelCatalogProvider {
    id: String,
    label: String,
    #[serde(default)]
    note: String,
    #[serde(default)]
    website: String,
    provider: String,
    api_base: String,
    api_key_env: String,
    models: Vec<String>,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DesktopThemeAccent {
    id: String,
    label: String,
    h: u16,
    s: String,
    l: String,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DesktopThemeConfig {
    schema_version: String,
    mode: String,
    accent: DesktopThemeAccent,
    #[serde(default)]
    accents: Vec<DesktopThemeAccent>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RunGuardedCheckInput {
    check_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RunProjectOsActionInput {
    action_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RunTerminalCommandInput {
    command: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct StartTerminalSessionInput {
    #[serde(default = "default_terminal_session_id")]
    session_id: String,
    #[serde(default = "default_terminal_cols")]
    cols: u16,
    #[serde(default = "default_terminal_rows")]
    rows: u16,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WriteTerminalSessionInput {
    #[serde(default = "default_terminal_session_id")]
    session_id: String,
    data: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ResizeTerminalSessionInput {
    #[serde(default = "default_terminal_session_id")]
    session_id: String,
    #[serde(default = "default_terminal_cols")]
    cols: u16,
    #[serde(default = "default_terminal_rows")]
    rows: u16,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct StopTerminalSessionInput {
    #[serde(default = "default_terminal_session_id")]
    session_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopTaskInput {
    task: Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProfileFieldPatch {
    key: String,
    value: Value,
    status: String,
    source: String,
    confidence: f64,
    #[serde(default)]
    notes: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct NaturalProfileUpdateInput {
    patches: Vec<ProfileFieldPatch>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GeneratePatchDraftInput {
    task: Value,
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

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct PatchDraft {
    summary: String,
    diff: String,
    files: Vec<String>,
    guardrails: Vec<String>,
    trace: Vec<String>,
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
struct ProjectOsActionResult {
    id: String,
    label: String,
    command: String,
    success: bool,
    code: Option<i32>,
    output: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TerminalCommandResult {
    id: String,
    label: String,
    command: String,
    cwd: String,
    success: bool,
    code: Option<i32>,
    output: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TerminalSessionResult {
    session_id: String,
    cwd: String,
    generation: u64,
    shell: String,
    running: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TerminalOutputEvent {
    session_id: String,
    generation: u64,
    data: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct WorkspaceFilesChangedEvent {
    path: String,
    root: String,
}

fn default_terminal_session_id() -> String {
    "main".to_string()
}

fn default_terminal_cols() -> u16 {
    100
}

fn default_terminal_rows() -> u16 {
    28
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

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ModelHealthCache {
    schema_version: String,
    #[serde(default)]
    entries: Vec<ModelHealthEntry>,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ModelHealthEntry {
    api_base: String,
    api_key_env: String,
    model: String,
    status: String,
    message: String,
    checked_at: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChatWithModelResult {
    reply: String,
    should_create_plan: bool,
    intent: String,
    #[serde(default)]
    provider_status: String,
    #[serde(default)]
    provider_model: String,
    #[serde(default)]
    provider_error: String,
}

#[derive(Deserialize)]
struct ModelsListResponse {
    data: Vec<ModelItem>,
}

#[derive(Deserialize)]
struct ModelItem {
    id: String,
}

#[derive(Deserialize)]
struct ChatCompletionsResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: ChatResponseMessage,
}

#[derive(Deserialize)]
struct ChatResponseMessage {
    content: String,
}

#[tauri::command]
fn get_workspace_snapshot() -> Result<WorkspaceSnapshot, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    let state = read_json(root.join(".project-os/state.json"));
    let recommendations = read_json(root.join(".project-os/recommendations/recommend-next.json"));
    let task_backlog = read_json(root.join(".project-os/task-backlog.json"));
    let goal_validation = read_json(root.join(".project-os/goal-validation.json"))
        .unwrap_or_else(|| json!({ "criteria": [] }));
    let goal_validation_report = read_json(root.join(".project-os/goal-validation-report.json"))
        .unwrap_or_else(|| json!({ "status": "missing", "checks": [] }));
    let goal_signoff_history = read_json(root.join(".project-os/goal-signoff-history.json"))
        .unwrap_or_else(|| json!({ "entries": [] }));
    let workspace_facts = read_json(root.join(".project-os/workspace-facts.json"))
        .unwrap_or_else(|| json!(null));
    let run_count = count_run_records(&root);
    let (file_count, docs_count) = count_workspace_files(&root);

    let project_name = current_project.name.clone();
    let goals = read_json(root.join(".project-os/goals.json"))
        .unwrap_or_else(|| goal_stack_from_validation(&goal_validation, &goal_validation_report, &goal_signoff_history, &project_name));
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
        projects: registry_projects(&registry),
        tree: build_tree_preview(&root),
        queue,
        memory: vec![
            MemoryItem {
                marker: "Δ".to_string(),
                title: "已学习方向".to_string(),
                body: "用户希望 Project OS 成为长期使用的本地 AI 桌面工作台。".to_string(),
                muted: false,
            },
            MemoryItem {
                marker: "Σ".to_string(),
                title: "执行边界".to_string(),
                body: "Tauri + Local Agent Core；模型密钥、文件读取和命令执行留在本地 core。".to_string(),
                muted: true,
            },
        ],
        project_profile: build_project_profile(&root, &project_name),
        workspace_facts,
        goal_validation,
        goal_validation_report,
        goal_signoff_history,
        goals,
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
    Ok(build_workspace_facts_preview(&root, &current_project.name))
}

fn should_ignore_watch_path(path: &Path) -> bool {
    if !path
        .components()
        .any(|component| component.as_os_str() == ".project-os")
    {
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
        .map(|name| name.starts_with(".env") || name.ends_with(".lock") || name == "desktop-theme.json")
        .unwrap_or(false)
}

fn watch_event_should_refresh(event: &Event) -> bool {
    matches!(
        event.kind,
        EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_) | EventKind::Any
    ) && event.paths.iter().any(|path| !should_ignore_watch_path(path))
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
        "schemaVersion": "project-os.goals.v0.1",
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

fn update_active_goal_status(
    root: &Path,
    status: &str,
    validation_status: &str,
    timestamp: &str,
) -> Result<(), String> {
    let goals_path = root.join(".project-os/goals.json");
    let Some(mut goals) = read_json(goals_path.clone()) else {
        return Ok(());
    };
    let active_goal_id = goals
        .get("activeGoalId")
        .and_then(Value::as_str)
        .map(str::to_string);
    if let Some(object) = goals.as_object_mut() {
        object.insert("updatedAt".to_string(), Value::String(timestamp.to_string()));
        if let Some(items) = object.get_mut("goals").and_then(Value::as_array_mut) {
            for item in items {
                let is_active = active_goal_id
                    .as_deref()
                    .map(|id| item.get("id").and_then(Value::as_str) == Some(id))
                    .unwrap_or(false);
                if !is_active {
                    continue;
                }
                if let Some(goal) = item.as_object_mut() {
                    goal.insert("status".to_string(), Value::String(status.to_string()));
                    goal.insert("updatedAt".to_string(), Value::String(timestamp.to_string()));
                    goal.insert("validationStatus".to_string(), Value::String(validation_status.to_string()));
                    if status == "done" {
                        goal.insert("completedAt".to_string(), Value::String(timestamp.to_string()));
                    }
                }
            }
        }
    }
    let content = serde_json::to_string_pretty(&goals).map_err(|err| err.to_string())?;
    fs::write(goals_path, format!("{content}\n")).map_err(|err| err.to_string())
}

fn load_or_seed_goals(root: &Path, project_name: &str) -> Value {
    read_json(root.join(".project-os/goals.json")).unwrap_or_else(|| json!({
        "schemaVersion": "project-os.goals.v0.1",
        "activeGoalId": "current-goal",
        "goals": [{
            "id": "current-goal",
            "title": "当前目标",
            "projectName": project_name,
            "status": "active",
            "summary": "当前推进中的目标。",
            "taskIds": []
        }]
    }))
}

fn write_goals(root: &Path, goals: &Value) -> Result<(), String> {
    let path = root.join(".project-os/goals.json");
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    let content = serde_json::to_string_pretty(goals).map_err(|err| err.to_string())?;
    fs::write(path, format!("{content}\n")).map_err(|err| err.to_string())
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
    format!("{}-{}", id, current_timestamp_string().replace([':', '.'], "-"))
}

fn compact_goal_title(title: &str) -> String {
    let normalized = title
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .replace(" / ", "/")
        .replace('/', " / ");
    let trimmed = normalized.trim();
    if trimmed.chars().count() <= 18 {
        return trimmed.to_string();
    }
    let parts: Vec<&str> = trimmed
        .split('/')
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .collect();
    if let Some(part) = parts.iter().find(|part| part.chars().count() <= 18) {
        return (*part).to_string();
    }
    let mut short = trimmed.chars().take(16).collect::<String>();
    short.push_str("...");
    short
}

#[tauri::command]
fn create_goal(input: CreateGoalInput) -> Result<WorkspaceSnapshot, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    let title = input.title.trim();
    if title.is_empty() {
        return Err("目标名称不能为空。".to_string());
    }
    let now = current_timestamp_string();
    let id = goal_id_from_title(title);
    let mut goals = load_or_seed_goals(&root, &current_project.name);
    if let Some(object) = goals.as_object_mut() {
        object.insert("activeGoalId".to_string(), Value::String(id.clone()));
        object.insert("updatedAt".to_string(), Value::String(now.clone()));
        let items = object
            .entry("goals".to_string())
            .or_insert_with(|| Value::Array(Vec::new()));
        if let Some(items) = items.as_array_mut() {
            items.insert(0, json!({
                "id": id,
                "title": title,
                "shortTitle": compact_goal_title(title),
                "projectName": current_project.name,
                "status": "draft",
                "createdAt": now,
                "summary": if input.summary.trim().is_empty() { "目标草案，等待确认。" } else { input.summary.trim() },
                "taskIds": []
            }));
        }
    }
    write_goals(&root, &goals)?;
    get_workspace_snapshot()
}

#[tauri::command]
fn switch_active_goal(input: SwitchGoalInput) -> Result<WorkspaceSnapshot, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    let mut goals = load_or_seed_goals(&root, &current_project.name);
    let exists = goals
        .get("goals")
        .and_then(Value::as_array)
        .map(|items| items.iter().any(|item| item.get("id").and_then(Value::as_str) == Some(input.id.as_str())))
        .unwrap_or(false);
    if !exists {
        return Err("没有找到这个目标。".to_string());
    }
    if let Some(object) = goals.as_object_mut() {
        object.insert("activeGoalId".to_string(), Value::String(input.id));
        object.insert("updatedAt".to_string(), Value::String(current_timestamp_string()));
    }
    write_goals(&root, &goals)?;
    get_workspace_snapshot()
}

#[tauri::command]
fn confirm_goal(input: SwitchGoalInput) -> Result<WorkspaceSnapshot, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    let mut goals = load_or_seed_goals(&root, &current_project.name);
    let now = current_timestamp_string();
    let mut found = false;
    if let Some(object) = goals.as_object_mut() {
        object.insert("activeGoalId".to_string(), Value::String(input.id.clone()));
        object.insert("updatedAt".to_string(), Value::String(now.clone()));
        if let Some(items) = object.get_mut("goals").and_then(Value::as_array_mut) {
            for item in items {
                if item.get("id").and_then(Value::as_str) != Some(input.id.as_str()) {
                    continue;
                }
                found = true;
                if let Some(goal) = item.as_object_mut() {
                    goal.insert("status".to_string(), Value::String("planned".to_string()));
                    goal.insert("confirmedAt".to_string(), Value::String(now.clone()));
                    goal.insert("updatedAt".to_string(), Value::String(now.clone()));
                }
            }
        }
    }
    if !found {
        return Err("没有找到这个目标。".to_string());
    }
    write_goals(&root, &goals)?;
    get_workspace_snapshot()
}

#[tauri::command]
fn add_registry_project(path: String) -> Result<WorkspaceSnapshot, String> {
    let app_root = find_workspace_root()?;
    let project_root = normalize_project_path(&path)?;
    if !project_root.exists() || !project_root.is_dir() {
        return Err("项目路径不存在或不是目录".to_string());
    }

    let mut registry = load_or_seed_registry(&app_root)?;
    let project_path = project_root.display().to_string();
    let state = read_json(project_root.join(".project-os/state.json"));
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

    if let Some(project) = registry.projects.iter_mut().find(|project| project.id == id) {
        if !project.name_locked {
            project.name = name;
        }
        project.path = project_path;
        project.phase = phase;
    } else {
        registry.projects.push(RegistryFileProject {
            id: id.clone(),
            name,
            path: project_path,
            phase,
            name_locked: false,
        });
    }
    registry.current_project_id = id;
    save_registry(&app_root, &registry)?;
    get_workspace_snapshot()
}

#[tauri::command]
fn switch_registry_project(id: String) -> Result<WorkspaceSnapshot, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    if !registry.projects.iter().any(|project| project.id == id) {
        return Err("未找到这个项目".to_string());
    }
    registry.current_project_id = id;
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
fn relocate_registry_project(input: RelocateRegistryProjectInput) -> Result<WorkspaceSnapshot, String> {
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

    let state = read_json(next_root.join(".project-os/state.json"));
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
fn read_engineering_file(input: ReadEngineeringFileInput) -> Result<EngineeringFilePreview, String> {
    const MAX_PREVIEW_BYTES: usize = 80 * 1024;

    let relative = input.path.trim();
    if relative.is_empty() {
        return Err("请选择一个工程文件".to_string());
    }
    if !is_safe_engineering_preview_path(relative) {
        return Err("这个文件暂不支持预览：只能查看项目内的普通文本文件。".to_string());
    }

    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path)
        .canonicalize()
        .map_err(|err| format!("项目目录不可访问: {}", err))?;
    let path = root.join(relative);
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
        language: preview_language(relative),
        truncated,
        size: metadata.len(),
    })
}

#[tauri::command]
async fn chat_with_model(input: ChatWithModelInput) -> Result<ChatWithModelResult, String> {
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
    let provider = load_or_seed_provider_config(&app_root)?;
    let state = read_json(root.join(".project-os/state.json"));
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

    if provider.enabled {
        match generate_provider_chat(&provider, &root, &project_name, &stage, &message, &attachments).await {
            Ok(mut result) => {
                result.provider_status = "available".to_string();
                result.provider_model = provider.model.clone();
                result.provider_error = String::new();
                if result.should_create_plan && !should_create_plan_for_message(&message, !attachments.is_empty()) {
                    result.should_create_plan = false;
                    if result.intent.trim().is_empty() || result.intent == "task" {
                        result.intent = "question".to_string();
                    }
                }
                return Ok(result);
            }
            Err(err) => {
                let mut fallback = local_chat_result(&message, !attachments.is_empty());
                fallback.provider_status = "unavailable".to_string();
                fallback.provider_model = provider.model.clone();
                fallback.provider_error = err;
                return Ok(fallback);
            }
        }
    }

    Ok(local_chat_result(&message, !attachments.is_empty()))
}

#[tauri::command]
async fn generate_readonly_plan(input: GeneratePlanInput) -> Result<ReadonlyPlan, String> {
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
    let provider = load_or_seed_provider_config(&app_root)?;
    let root = PathBuf::from(&current_project.path);
    let state = read_json(root.join(".project-os/state.json"));
    let recommendations = read_json(root.join(".project-os/recommendations/recommend-next.json"));

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

    let fallback_context = PlanContext {
        task: task.clone(),
        attachments,
        project_name: project_name.clone(),
        stage: stage.clone(),
        root: root.clone(),
        recommendations,
        provider: provider.clone(),
    };

    if provider.enabled {
        match generate_provider_plan(&fallback_context).await {
            Ok(plan) => return Ok(plan),
            Err(err) => {
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
    let task_dir = desktop_tasks_dir(&root);
    if !task_dir.exists() {
        return Ok(Vec::new());
    }

    let mut tasks = Vec::new();
    for entry in fs::read_dir(task_dir).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
        if path.file_name().and_then(|value| value.to_str()) == Some("manifest.json") {
            continue;
        }
        if let Some(task) = read_json(path) {
            tasks.push(task);
        }
    }

    tasks.sort_by(|a, b| {
        let a_time = a
            .get("updatedAt")
            .and_then(Value::as_str)
            .or_else(|| a.get("createdAt").and_then(Value::as_str))
            .unwrap_or("");
        let b_time = b
            .get("updatedAt")
            .and_then(Value::as_str)
            .or_else(|| b.get("createdAt").and_then(Value::as_str))
            .unwrap_or("");
        b_time.cmp(a_time)
    });
    tasks.truncate(30);
    Ok(tasks)
}

#[tauri::command]
fn save_desktop_task(input: DesktopTaskInput) -> Result<Value, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    let mut task = input.task;
    let id = task
        .get("id")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "任务缺少 id".to_string())?
        .to_string();

    let object = task
        .as_object_mut()
        .ok_or_else(|| "任务记录必须是 JSON object".to_string())?;
    object.insert(
        "schemaVersion".to_string(),
        Value::String("project-os.desktop-task.v0.1".to_string()),
    );
    object.insert(
        "updatedAt".to_string(),
        Value::String(current_timestamp_string()),
    );
    object.insert(
        "projectPath".to_string(),
        Value::String(current_project.path.clone()),
    );

    let task_dir = desktop_tasks_dir(&root);
    fs::create_dir_all(&task_dir).map_err(|err| err.to_string())?;
    let path = task_dir.join(format!("{}.json", safe_task_file_stem(&id)));
    let content = serde_json::to_string_pretty(&task).map_err(|err| err.to_string())?;
    fs::write(path, format!("{content}\n")).map_err(|err| err.to_string())?;
    Ok(task)
}

#[tauri::command]
fn run_goal_validation() -> Result<WorkspaceSnapshot, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    if !root.exists() || !root.is_dir() {
        return Err("当前项目路径不存在或不是目录".to_string());
    }

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

    let passed = checks
        .iter()
        .all(|check| check.get("success").and_then(Value::as_bool).unwrap_or(false));
    let now = current_timestamp_string();
    let report = json!({
        "schemaVersion": "project-os.goal-validation-report.v0.1",
        "generatedAt": now,
        "status": if passed { "passed" } else { "failed" },
        "checks": checks,
    });
    let report_path = root.join(".project-os/goal-validation-report.json");
    if let Some(parent) = report_path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    let report_content = serde_json::to_string_pretty(&report).map_err(|err| err.to_string())?;
    fs::write(report_path, format!("{report_content}\n")).map_err(|err| err.to_string())?;

    let validation_path = root.join(".project-os/goal-validation.json");
    if let Some(mut validation) = read_json(validation_path.clone()) {
        if let Some(object) = validation.as_object_mut() {
            object.insert("updatedAt".to_string(), Value::String(now.clone()));
            if let Some(goal) = object.get_mut("goal").and_then(Value::as_object_mut) {
                goal.insert(
                    "status".to_string(),
                    Value::String(if passed { "verified" } else { "validation-failed" }.to_string()),
                );
            }
        }
        let validation_content = serde_json::to_string_pretty(&validation).map_err(|err| err.to_string())?;
        fs::write(validation_path, format!("{validation_content}\n")).map_err(|err| err.to_string())?;
    }
    update_active_goal_status(
        &root,
        if passed { "pending-confirm" } else { "failed" },
        if passed { "passed" } else { "failed" },
        &now,
    )?;

    get_workspace_snapshot()
}

#[tauri::command]
fn sign_off_goal_validation() -> Result<WorkspaceSnapshot, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    if !root.exists() || !root.is_dir() {
        return Err("当前项目路径不存在或不是目录".to_string());
    }

    let validation_path = root.join(".project-os/goal-validation.json");
    let mut validation = read_json(validation_path.clone())
        .ok_or_else(|| "未找到目标验收标准文件".to_string())?;
    let goal_id = validation
        .pointer("/goal/id")
        .and_then(Value::as_str)
        .unwrap_or("current-goal")
        .to_string();
    let goal_title = validation
        .pointer("/goal/title")
        .and_then(Value::as_str)
        .unwrap_or("当前目标")
        .to_string();
    let report_status = read_json(root.join(".project-os/goal-validation-report.json"))
        .and_then(|report| report.get("status").and_then(Value::as_str).map(str::to_string))
        .unwrap_or_else(|| "missing".to_string());
    if report_status != "passed" {
        return Err("目标还没有通过验收，不能签收。".to_string());
    }

    let now = current_timestamp_string();
    if let Some(object) = validation.as_object_mut() {
        object.insert("updatedAt".to_string(), Value::String(now.clone()));
        if let Some(goal) = object.get_mut("goal").and_then(Value::as_object_mut) {
            goal.insert("status".to_string(), Value::String("signed-off".to_string()));
        }
    }
    let validation_content = serde_json::to_string_pretty(&validation).map_err(|err| err.to_string())?;
    fs::write(validation_path, format!("{validation_content}\n")).map_err(|err| err.to_string())?;

    let history_path = root.join(".project-os/goal-signoff-history.json");
    let mut history = read_json(history_path.clone()).unwrap_or_else(|| json!({
        "schemaVersion": "project-os.goal-signoff-history.v0.1",
        "entries": []
    }));
    if let Some(object) = history.as_object_mut() {
        object.insert("updatedAt".to_string(), Value::String(now.clone()));
        let entries = object
            .entry("entries".to_string())
            .or_insert_with(|| Value::Array(Vec::new()));
        if let Some(entries) = entries.as_array_mut() {
            entries.insert(0, json!({
                "goalId": goal_id,
                "goalTitle": goal_title,
                "signedOffAt": now,
                "reportStatus": report_status,
                "source": "OmniDesk"
            }));
        }
    }
    if let Some(parent) = history_path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    let history_content = serde_json::to_string_pretty(&history).map_err(|err| err.to_string())?;
    fs::write(history_path, format!("{history_content}\n")).map_err(|err| err.to_string())?;
    update_active_goal_status(&root, "done", &report_status, &now)?;

    get_workspace_snapshot()
}

#[tauri::command]
fn update_task_backlog_item(input: UpdateBacklogItemInput) -> Result<WorkspaceSnapshot, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    let path = root.join(".project-os/task-backlog.json");
    let mut backlog = read_json(path.clone()).ok_or_else(|| "未找到任务池文件 .project-os/task-backlog.json".to_string())?;
    let id = input.id.trim();
    let status = normalize_backlog_status(&input.status);
    if id.is_empty() {
        return Err("任务 id 不能为空".to_string());
    }
    if status.is_empty() {
        return Err("不支持这个任务状态".to_string());
    }

    let items = backlog
        .get_mut("items")
        .and_then(Value::as_array_mut)
        .ok_or_else(|| "任务池 items 必须是数组".to_string())?;
    let mut found = false;
    for item in items {
        if item.get("id").and_then(Value::as_str) == Some(id) {
            if let Some(object) = item.as_object_mut() {
                object.insert("status".to_string(), Value::String(status.clone()));
                found = true;
            }
        }
    }
    if !found {
        return Err(format!("没有找到任务：{}", id));
    }
    if let Some(object) = backlog.as_object_mut() {
        object.insert("updatedAt".to_string(), Value::String(current_timestamp_string()));
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    let content = serde_json::to_string_pretty(&backlog).map_err(|err| err.to_string())?;
    fs::write(path, format!("{content}\n")).map_err(|err| err.to_string())?;
    get_workspace_snapshot()
}

#[tauri::command]
fn update_project_profile_from_conversation(input: NaturalProfileUpdateInput) -> Result<WorkspaceSnapshot, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    let patches: Vec<ProfileFieldPatch> = input
        .patches
        .into_iter()
        .filter(|patch| is_profile_field_allowed(&patch.key))
        .collect();
    if patches.is_empty() {
        return get_workspace_snapshot();
    }

    let path = root.join(".project-os/project-profile.json");
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    let mut profile = read_json(path.clone()).unwrap_or_else(|| {
        json!({
            "schemaVersion": "project-os.project-profile.v0.1",
            "projectId": current_project.id,
            "updatedAt": "",
            "fields": {}
        })
    });
    let updated_at = current_timestamp_string();
    profile["schemaVersion"] = json!("project-os.project-profile.v0.1");
    profile["projectId"] = json!(current_project.id);
    profile["updatedAt"] = json!(updated_at.clone());
    if !profile.get("fields").is_some_and(Value::is_object) {
        profile["fields"] = json!({});
    }
    let fields = profile
        .get_mut("fields")
        .and_then(Value::as_object_mut)
        .ok_or_else(|| "project-profile fields 格式异常".to_string())?;

    for patch in patches {
        fields.insert(
            patch.key,
            json!({
                "value": patch.value,
                "status": normalize_profile_status(&patch.status),
                "source": patch.source,
                "updatedAt": updated_at,
                "confidence": patch.confidence.clamp(0.0, 1.0),
                "notes": patch.notes
            }),
        );
    }

    let content = serde_json::to_string_pretty(&profile).map_err(|err| err.to_string())?;
    fs::write(path, format!("{content}\n")).map_err(|err| err.to_string())?;
    get_workspace_snapshot()
}

#[tauri::command]
async fn generate_patch_draft(input: GeneratePatchDraftInput) -> Result<PatchDraft, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    let provider = load_or_seed_provider_config(&app_root)?;
    let task = input.task;
    let title = task
        .get("title")
        .and_then(Value::as_str)
        .unwrap_or("未命名任务")
        .to_string();
    let plan = task
        .get("plan")
        .ok_or_else(|| "任务缺少 plan，无法生成 patch 草案".to_string())?;
    let files = extract_plan_files(plan, &root);
    let contexts = read_patch_context_files(&root, &files)?;

    if provider.enabled {
        match generate_provider_patch_draft(&provider, &root, &title, plan, &contexts).await {
            Ok(draft) => return Ok(draft),
            Err(err) => {
                let mut draft = build_local_patch_draft(&title, &files, &contexts);
                draft.trace.push(format!("PROVIDER_FALLBACK: {}", err));
                return Ok(draft);
            }
        }
    }

    Ok(build_local_patch_draft(&title, &files, &contexts))
}

#[tauri::command]
fn apply_patch_draft(input: ApplyPatchDraftInput) -> Result<ApplyPatchResult, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    let draft = input
        .task
        .get("patchDraft")
        .cloned()
        .ok_or_else(|| "任务还没有 patch 草案".to_string())?;
    let diff = draft
        .get("diff")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "patch 草案为空".to_string())?;

    if diff.contains("PATCH_DRAFT_PENDING") {
        return Err("当前还是占位草案，不能应用。请先生成真实 patch。".to_string());
    }
    if !diff.contains("@@") || !diff.contains("--- ") || !diff.contains("+++ ") {
        return Err("patch 草案不是可应用的 unified diff".to_string());
    }

    let check = run_git_apply(&root, diff, true)?;
    if !check.status.success() {
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
        return Err(format!("patch 应用失败：{}", output));
    }

    Ok(ApplyPatchResult {
        success: true,
        message: "patch 已应用到当前项目文件".to_string(),
        output,
    })
}

#[tauri::command]
fn write_run_summary(input: WriteRunSummaryInput) -> Result<RunSummaryResult, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    let task = input.task;
    let summary = build_run_summary_markdown(&task);
    let path = root.join(".project-os/runs/desktop-summary.md");
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }

    let existing = fs::read_to_string(&path).unwrap_or_else(|_| {
        "# Desktop Run Summary\n\n> OmniDesk 自动生成的任务摘要。\n\n".to_string()
    });
    let content = format!("{}{}\n", existing.trim_end(), summary);
    fs::write(&path, content).map_err(|err| err.to_string())?;

    Ok(RunSummaryResult {
        path: ".project-os/runs/desktop-summary.md".to_string(),
        message: "任务摘要已写入本地 run summary".to_string(),
        summary,
    })
}

#[tauri::command]
fn merge_run_summary_to_handoff(input: MergeRunSummaryToHandoffInput) -> Result<HandoffMergeResult, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    let handoff_path = root.join("HANDOFF.md");
    if !handoff_path.is_file() {
        return Err("当前项目没有 HANDOFF.md，不能自动合并交接。".to_string());
    }

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
    let existing = fs::read_to_string(&handoff_path).map_err(|err| err.to_string())?;
    let block = format!(
        r#"

## Desktop 合并记录 - {}

> 来源：OmniDesk 用户确认合并。

{}
"#,
        title, summary
    );
    let content = format!("{}{}\n", existing.trim_end(), block);
    fs::write(&handoff_path, content).map_err(|err| err.to_string())?;

    Ok(HandoffMergeResult {
        path: "HANDOFF.md".to_string(),
        message: "任务摘要已合并到 HANDOFF.md".to_string(),
        merged_at,
    })
}

struct PlanContext {
    task: String,
    attachments: Vec<PlanAttachment>,
    project_name: String,
    stage: String,
    root: PathBuf,
    recommendations: Option<Value>,
    provider: ProviderConfig,
}

fn build_local_readonly_plan(context: PlanContext) -> ReadonlyPlan {
    let mut files_to_read = vec![
        "AGENTS.md".to_string(),
        "PROJECT.md".to_string(),
        "HANDOFF.md".to_string(),
    ];
    for path in [
        "docs/DESKTOP_APP.md",
        "docs/ARCHITECTURE.md",
        "docs/PRODUCT_PLAN.md",
        ".project-os/recommendations/recommend-next.json",
    ] {
        if context.root.join(path).exists() {
            files_to_read.push(path.to_string());
        }
    }

    let lower_task = context.task.to_lowercase();
    let mut candidate_changes = vec!["先不改文件；只形成计划和确认点。".to_string()];
    let mut checks = vec![
        "bash scripts/check-runtime.sh .".to_string(),
        "bash scripts/check-doc-structure.sh .".to_string(),
    ];

    if lower_task.contains("ui")
        || lower_task.contains("页面")
        || lower_task.contains("组件")
        || lower_task.contains("桌面")
    {
        candidate_changes.push("可能涉及 desktop/src/main.jsx 和 desktop/src/styles.css。".to_string());
        checks.push("cd desktop && npm run web:build".to_string());
    }

    if lower_task.contains("rust")
        || lower_task.contains("tauri")
        || lower_task.contains("core")
        || lower_task.contains("命令")
        || lower_task.contains("本地")
    {
        candidate_changes.push("可能涉及 desktop/src-tauri/src/main.rs 和 Tauri capability。".to_string());
        checks.push("cd desktop/src-tauri && cargo check".to_string());
    }

    if context
        .recommendations
        .as_ref()
        .and_then(|json| json.pointer("/summary/recommendationCount"))
        .and_then(Value::as_u64)
        .unwrap_or(0)
        > 0
    {
        files_to_read.push(".project-os/reports/ai-project-report.json".to_string());
    }

    checks.sort();
    checks.dedup();
    files_to_read.sort();
    files_to_read.dedup();
    candidate_changes.sort();
    candidate_changes.dedup();

    let attachment_count = context.attachments.len();
    let attachment_names = context
        .attachments
        .iter()
        .map(|attachment| attachment.name.clone())
        .collect::<Vec<_>>();
    let mut steps = vec![
        "读取入口规则和当前交接，确认任务边界。".to_string(),
        "读取项目状态、推荐结果和相关实现文件，形成最小改动范围。".to_string(),
        "列出候选改动、风险点和需要用户确认的执行步骤。".to_string(),
        "用户确认后，再进入受控执行、diff review 和检查。".to_string(),
    ];
    if attachment_count > 0 {
        steps.insert(
            0,
            format!("结合用户附带截图确认问题位置：{}", attachment_names.join("、")),
        );
    }
    let mut trace = vec![
        format!("ROOT: {}", context.root.display()),
        format!("PROJECT: {}", context.project_name),
        format!(
            "PROVIDER: {} / {} ({})",
            context.provider.provider,
            context.provider.model,
            if context.provider.enabled {
                "configured"
            } else {
                "disabled"
            }
        ),
        "PLANNER: local heuristic planner; external model call not enabled yet".to_string(),
    ];
    if attachment_count > 0 {
        trace.push(format!("IMAGE_ATTACHMENTS: {}", attachment_count));
    }

    ReadonlyPlan {
        task: context.task.clone(),
        project_name: context.project_name.clone(),
        mode: "plan".to_string(),
        summary: format!(
            "我会先围绕「{}」理清范围，再给出最小下一步。当前项目为 {}，阶段为 {}。{}",
            context.task,
            context.project_name,
            context.stage,
            if attachment_count > 0 {
                "已收到图片附件，支持视觉的模型会结合截图判断。"
            } else {
                ""
            }
        ),
        steps,
        files_to_read,
        candidate_changes,
        checks,
        guardrails: vec![
            "不自动写文件。".to_string(),
            "不自动运行命令。".to_string(),
            "模型 API key 不进入前端。".to_string(),
            "继续动手前需要用户确认改动范围。".to_string(),
        ],
        trace,
    }
}

async fn generate_provider_plan(context: &PlanContext) -> Result<ReadonlyPlan, String> {
    let api_key = read_secret_from_env_or_dotenv(&context.root, &context.provider.api_key_env)
        .ok_or_else(|| format!("环境变量或 .env.local 中未设置 {}", context.provider.api_key_env))?;
    if api_key.trim().is_empty() {
        return Err(format!("环境变量 {} 为空", context.provider.api_key_env));
    }

    let endpoint = chat_completions_endpoint(&context.provider.api_base);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(45))
        .build()
        .map_err(|err| err.to_string())?;

    let prompt = provider_prompt(context);
    let user_content = if context.attachments.is_empty() {
        Value::String(prompt)
    } else {
        let mut parts = vec![json!({
            "type": "text",
            "text": prompt
        })];
        for attachment in &context.attachments {
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
    let response = client
        .post(endpoint)
        .bearer_auth(api_key)
        .json(&json!({
            "model": context.provider.model,
            "messages": [
                {
                    "role": "system",
                    "content": "You are OmniDesk Local Agent Core. Return only strict JSON matching the requested schema. Do not include markdown."
                },
                {
                    "role": "user",
                    "content": user_content
                }
            ],
            "temperature": 0.2
        }))
        .send()
        .await
        .map_err(|err| err.to_string())?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("provider HTTP {}: {}", status, trim_for_trace(&body)));
    }

    let chat: ChatCompletionsResponse = response.json().await.map_err(|err| err.to_string())?;
    let content = chat
        .choices
        .first()
        .map(|choice| choice.message.content.trim())
        .filter(|content| !content.is_empty())
        .ok_or_else(|| "provider 返回空内容".to_string())?;
    let mut plan: ReadonlyPlan = serde_json::from_str(content)
        .map_err(|err| format!("provider JSON 解析失败: {}", err))?;

    plan.mode = "plan".to_string();
    plan.task = context.task.clone();
    plan.project_name = context.project_name.clone();
    plan.guardrails.push("真实 provider 已调用，但仍只生成计划，不执行写入。".to_string());
    plan.trace.push(format!(
        "PROVIDER_CALL: {} / {}",
        context.provider.provider, context.provider.model
    ));
    if !context.attachments.is_empty() {
        plan.trace.push(format!("VISION_ATTACHMENTS: {}", context.attachments.len()));
    }
    plan.trace.push(format!("ROOT: {}", context.root.display()));
    Ok(plan)
}

async fn generate_provider_patch_draft(
    provider: &ProviderConfig,
    root: &Path,
    title: &str,
    plan: &Value,
    contexts: &[(String, String)],
) -> Result<PatchDraft, String> {
    let api_key = read_secret_from_env_or_dotenv(root, &provider.api_key_env)
        .ok_or_else(|| format!("环境变量或 .env.local 中未设置 {}", provider.api_key_env))?;
    if api_key.trim().is_empty() {
        return Err(format!("环境变量 {} 为空", provider.api_key_env));
    }

    let endpoint = chat_completions_endpoint(&provider.api_base);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|err| err.to_string())?;
    let prompt = patch_draft_prompt(title, plan, contexts);
    let response = client
        .post(endpoint)
        .bearer_auth(api_key)
        .json(&json!({
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
        }))
        .send()
        .await
        .map_err(|err| err.to_string())?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("provider HTTP {}: {}", status, trim_for_trace(&body)));
    }

    let chat: ChatCompletionsResponse = response.json().await.map_err(|err| err.to_string())?;
    let content = chat
        .choices
        .first()
        .map(|choice| choice.message.content.trim())
        .filter(|content| !content.is_empty())
        .ok_or_else(|| "provider 返回空内容".to_string())?;
    let mut draft: PatchDraft = serde_json::from_str(content)
        .map_err(|err| format!("patch draft JSON 解析失败: {}", err))?;
    draft.guardrails.push("当前只是 patch 草案，尚未写入文件。".to_string());
    draft.trace.push(format!("PROVIDER_PATCH: {}", provider.model));
    Ok(draft)
}

async fn generate_provider_chat(
    provider: &ProviderConfig,
    root: &Path,
    project_name: &str,
    stage: &str,
    message: &str,
    attachments: &[PlanAttachment],
) -> Result<ChatWithModelResult, String> {
    let api_key = read_secret_from_env_or_dotenv(root, &provider.api_key_env)
        .ok_or_else(|| format!("环境变量或 .env.local 中未设置 {}", provider.api_key_env))?;
    if api_key.trim().is_empty() {
        return Err(format!("环境变量 {} 为空", provider.api_key_env));
    }

    let endpoint = chat_completions_endpoint(&provider.api_base);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(45))
        .build()
        .map_err(|err| err.to_string())?;
    let router_prompt = chat_router_prompt(project_name, stage, &provider.model, message, attachments);
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
    let response = client
        .post(endpoint)
        .bearer_auth(api_key)
        .json(&json!({
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
            "temperature": 0.45
        }))
        .send()
        .await
        .map_err(|err| err.to_string())?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("provider HTTP {}: {}", status, trim_for_trace(&body)));
    }

    let chat: ChatCompletionsResponse = response.json().await.map_err(|err| err.to_string())?;
    let content = chat
        .choices
        .first()
        .map(|choice| choice.message.content.trim())
        .filter(|content| !content.is_empty())
        .ok_or_else(|| "provider 返回空内容".to_string())?;
    let mut result: ChatWithModelResult = serde_json::from_str(content)
        .map_err(|err| format!("chat JSON 解析失败: {}", err))?;
    if result.reply.trim().is_empty() {
        result.reply = "我在。你可以直接说想做什么，我会先判断是普通对话还是需要创建计划。".to_string();
    }
    if result.intent.trim().is_empty() {
        result.intent = if result.should_create_plan { "task" } else { "chat" }.to_string();
    }
    Ok(result)
}

fn chat_router_prompt(project_name: &str, stage: &str, current_model: &str, message: &str, attachments: &[PlanAttachment]) -> String {
    let attachment_note = if attachments.is_empty() {
        "No image attachments.".to_string()
    } else {
        format!(
            "Image attachments: {}.",
            attachments
                .iter()
                .map(|attachment| attachment.name.clone())
                .collect::<Vec<_>>()
                .join(", ")
        )
    };
    format!(
        r#"Current project: {project_name}
Current stage: {stage}
Current configured model: {current_model}
{attachment_note}

User message:
{message}

Decide whether this is normal conversation or a concrete project task.

Return strict JSON only:
{{
  "reply": "Chinese, natural, concise assistant reply shown in chat",
  "shouldCreatePlan": false,
  "intent": "chat | question | inspect | task"
}}

Rules:
- Greetings, small talk, broad questions, or "what is X" shouldCreatePlan=false.
- Questions that ask "why", "how", "what risks", "what happened", "is this ok", or "look at this" shouldCreatePlan=false and should receive a natural answer.
- Set shouldCreatePlan=true when the user clearly asks OmniDesk to solve, handle, organize, clean up, make a plan, create a task, apply a patch, run commands/checks, or implement/fix code.
- Phrases like "帮我处理", "处理一下", "看看解决", "整理一下", "制定方案", "侧边栏这么多待办你看看解决呢" are action requests even if they contain question-like words.
- If the user asks what model you are, mention the current configured model exactly.
- If shouldCreatePlan=true, reply should briefly acknowledge that you will create a plan.
- If shouldCreatePlan=false, do not suggest generating a plan, clicking buttons, or asking for confirmation unless the user's request is ambiguous.
- Do not invent completed work.
- Do not mention internal JSON or routing.
"#
    )
}

fn local_chat_result(message: &str, has_attachments: bool) -> ChatWithModelResult {
    let should_create_plan = should_create_plan_for_message(message, has_attachments);
    ChatWithModelResult {
        reply: if should_create_plan {
            "可以，我整理成一个可执行计划。".to_string()
        } else if is_greeting_message(message) {
            "你好，我在。".to_string()
        } else if is_question_like_message(message) {
            if message.contains("风险") {
                "主要风险有三类：交接记录可能继续膨胀；对话和执行状态容易混在一起；模型或检查失败时反馈还不够像人话。建议先把普通问答和执行任务分开，再打磨失败提示。".to_string()
            } else {
                "可以，我直接看当前上下文来回答。".to_string()
            }
        } else {
            "可以，继续说。".to_string()
        },
        should_create_plan,
        intent: if should_create_plan { "task" } else { "chat" }.to_string(),
        provider_status: "local".to_string(),
        provider_model: String::new(),
        provider_error: String::new(),
    }
}

fn is_greeting_message(message: &str) -> bool {
    let normalized = message
        .trim()
        .trim_matches(|ch: char| ch.is_ascii_punctuation() || ch.is_whitespace() || "。！？!，,".contains(ch))
        .to_lowercase();
    matches!(
        normalized.as_str(),
        "hi" | "hello" | "hey" | "你好" | "您好" | "哈喽" | "嗨" | "在吗" | "在么"
    )
}

fn should_create_plan_for_message(message: &str, has_attachments: bool) -> bool {
    if is_task_like_message(message) {
        return true;
    }
    if is_question_like_message(message) {
        return false;
    }
    has_attachments
}

fn is_question_like_message(message: &str) -> bool {
    let text = message.trim().to_lowercase();
    [
        "为什么", "怎么", "哪些", "还有哪些", "是什么", "吗", "呢", "咋回事",
        "看一下", "看看", "风险", "问题在哪", "自然吗", "正常吗",
        "why", "how", "what", "which", "risk", "risks",
    ]
    .iter()
    .any(|keyword| text.contains(keyword))
}

fn is_task_like_message(message: &str) -> bool {
    let text = message.trim().to_lowercase();
    [
        "帮我改", "帮我修", "帮我优化", "帮我生成", "帮我创建", "帮我新增", "帮我删除",
        "帮我执行", "帮我跑", "开始执行", "生成计划", "创建任务", "改代码", "修复",
        "实现", "接入", "配置", "做成", "设计", "重构", "提交", "推送",
        "帮我处理", "处理一下", "解决一下", "看看解决", "看下解决", "整理一下",
        "梳理一下", "制定方案", "出个方案", "给个方案", "整理待办", "处理方案",
        "commit", "push", "build", "apply patch",
    ]
    .iter()
    .any(|keyword| text.contains(keyword))
}

fn extract_plan_files(plan: &Value, root: &Path) -> Vec<String> {
    let mut files = plan
        .get("filesToRead")
        .or_else(|| plan.get("files_to_read"))
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .map(str::trim)
        .filter(|path| !path.is_empty())
        .filter(|path| is_patch_context_path(path))
        .filter(|path| root.join(path).is_file())
        .map(ToString::to_string)
        .collect::<Vec<_>>();

    files.sort();
    files.dedup();
    files.truncate(8);
    files
}

fn is_patch_context_path(path: &str) -> bool {
    if path.starts_with('/')
        || path.contains("..")
        || path.starts_with(".env")
        || path.contains("/.env")
        || path.contains(".project-os/desktop-provider")
    {
        return false;
    }
    matches!(
        Path::new(path).extension().and_then(|value| value.to_str()),
        Some("js" | "jsx" | "ts" | "tsx" | "css" | "rs" | "md" | "json" | "toml")
    )
}

fn is_safe_engineering_preview_path(path: &str) -> bool {
    let relative = Path::new(path);
    if relative.is_absolute()
        || path.starts_with(".env")
        || path.contains("/.env")
        || path.contains(".project-os/desktop-provider")
    {
        return false;
    }
    if relative.components().any(|component| {
        matches!(
            component,
            Component::ParentDir | Component::RootDir | Component::Prefix(_)
        )
    }) {
        return false;
    }
    matches!(
        relative.extension().and_then(|value| value.to_str()),
        Some(
            "md" | "mdx"
                | "txt"
                | "json"
                | "jsonc"
                | "yaml"
                | "yml"
                | "toml"
                | "js"
                | "jsx"
                | "ts"
                | "tsx"
                | "css"
                | "scss"
                | "html"
                | "rs"
                | "sh"
                | "py"
                | "sql"
        )
    )
}

fn preview_language(path: &str) -> String {
    match Path::new(path).extension().and_then(|value| value.to_str()) {
        Some("md" | "mdx") => "markdown",
        Some("json" | "jsonc") => "json",
        Some("yaml" | "yml") => "yaml",
        Some("toml") => "toml",
        Some("js" | "jsx") => "javascript",
        Some("ts" | "tsx") => "typescript",
        Some("css" | "scss") => "css",
        Some("html") => "html",
        Some("rs") => "rust",
        Some("sh") => "shell",
        Some("py") => "python",
        Some("sql") => "sql",
        _ => "text",
    }
    .to_string()
}

fn read_patch_context_files(root: &Path, files: &[String]) -> Result<Vec<(String, String)>, String> {
    let mut contexts = Vec::new();
    for relative in files {
        let path = root.join(relative);
        let content = fs::read_to_string(&path).map_err(|err| format!("读取 {} 失败: {}", relative, err))?;
        let trimmed = content.chars().take(12000).collect::<String>();
        contexts.push((relative.clone(), trimmed));
    }
    Ok(contexts)
}

fn build_local_patch_draft(title: &str, files: &[String], contexts: &[(String, String)]) -> PatchDraft {
    let file_list = if files.is_empty() {
        "暂无可安全读取的候选文件".to_string()
    } else {
        files.join(", ")
    };
    PatchDraft {
        summary: format!("已为「{}」准备 patch 草案入口；需要模型生成具体 diff。", title),
        diff: format!(
            "--- /dev/null\n+++ PATCH_DRAFT_PENDING\n@@\n+任务：{}\n+候选文件：{}\n+当前步骤只生成审阅草案，不写入文件。\n",
            title, file_list
        ),
        files: files.to_vec(),
        guardrails: vec![
            "只生成 diff 草案，不写入文件。".to_string(),
            "不读取 .env 或 provider key 配置。".to_string(),
            "Apply 前必须经过用户确认。".to_string(),
        ],
        trace: vec![
            format!("PATCH_CONTEXT_FILES: {}", contexts.len()),
            "PATCH_MODE: local placeholder".to_string(),
        ],
    }
}

fn patch_draft_prompt(title: &str, plan: &Value, contexts: &[(String, String)]) -> String {
    let context_text = contexts
        .iter()
        .map(|(path, content)| format!("--- FILE: {} ---\n{}", path, content))
        .collect::<Vec<_>>()
        .join("\n\n");
    format!(
        r#"Generate a safe unified diff draft for this local coding task.

Return strict JSON with this exact shape:
{{
  "summary": "Chinese one-sentence summary",
  "diff": "unified diff text only",
  "files": ["relative/path"],
  "guardrails": ["string"],
  "trace": ["string"]
}}

Rules:
- Return a unified diff draft, but do not claim it has been applied.
- Only modify files included in FILE CONTEXT.
- If the context is insufficient, return a small placeholder diff and explain the missing context in summary.
- Do not include secrets, API keys, or .env content.
- Prefer small, reviewable changes.

Task title: {}
Plan JSON:
{}

FILE CONTEXT:
{}
"#,
        title,
        serde_json::to_string_pretty(plan).unwrap_or_else(|_| "{}".to_string()),
        context_text
    )
}

fn chat_completions_endpoint(api_base: &str) -> String {
    let base = api_base.trim_end_matches('/');
    if base.ends_with("/chat/completions") {
        base.to_string()
    } else {
        format!("{}/chat/completions", base)
    }
}

fn models_endpoint(api_base: &str) -> String {
    let base = api_base.trim_end_matches('/');
    if base.ends_with("/models") {
        base.to_string()
    } else if base.ends_with("/chat/completions") {
        format!("{}/models", base.trim_end_matches("/chat/completions"))
    } else {
        format!("{}/models", base)
    }
}

fn provider_prompt(context: &PlanContext) -> String {
    format!(
        r#"Generate a readonly execution plan for this local desktop AI workbench task.

Return strict JSON with this exact shape:
{{
  "task": "string",
  "projectName": "string",
  "mode": "readonly-plan",
  "summary": "string",
  "steps": ["string"],
  "filesToRead": ["string"],
  "candidateChanges": ["string"],
  "checks": ["string"],
  "guardrails": ["string"],
  "trace": ["string"]
}}

Constraints:
- Do not propose automatic file writes.
- Do not propose arbitrary shell commands.
- Prefer Project OS checks: bash scripts/check-runtime.sh ., bash scripts/check-doc-structure.sh ., cd desktop && npm run web:build, cd desktop/src-tauri && cargo check.
- Keep the plan concise and actionable.
- Use Chinese for user-facing plan text.

Project: {}
Stage: {}
Root: {}
Task: {}
"#,
        context.project_name,
        context.stage,
        context.root.display(),
        context.task
    )
}

fn trim_for_trace(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.chars().count() > 240 {
        format!("{}...", trimmed.chars().take(240).collect::<String>())
    } else {
        trimmed.to_string()
    }
}

#[tauri::command]
fn get_provider_status() -> Result<ProviderStatus, String> {
    let app_root = find_workspace_root()?;
    let config = load_or_seed_provider_config(&app_root)?;
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
        schema_version: "project-os.desktop-provider.v0.1".to_string(),
        provider: provider.to_string(),
        model: model.to_string(),
        api_base: api_base.to_string(),
        api_key_env: api_key_env.to_string(),
        enabled: input.enabled,
        active_profile_id: profile_id,
        profiles: existing.profiles,
    };
    save_provider_config_file(&app_root, &config)?;
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

    let Some(removed) = config.profiles.iter().find(|profile| profile.id == profile_id).cloned() else {
        return Err("没有找到要删除的连接".to_string());
    };

    config.profiles.retain(|profile| profile.id != profile_id);

    if !removed.api_key_env.trim().is_empty()
        && !config.profiles.iter().any(|profile| profile.api_key_env == removed.api_key_env)
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
    Ok(provider_status(&config))
}

#[tauri::command]
fn get_model_health() -> Result<ModelHealthCache, String> {
    let app_root = find_workspace_root()?;
    load_or_seed_model_health(&app_root)
}

#[tauri::command]
async fn probe_provider_models(input: ProbeProviderModelsInput) -> Result<ProviderModelsProbeResult, String> {
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

    let endpoint = models_endpoint(api_base);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|err| err.to_string())?;
    let response = client
        .get(endpoint)
        .bearer_auth(api_key)
        .send()
        .await
        .map_err(|err| err.to_string())?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("模型列表请求失败 HTTP {}: {}", status, trim_for_trace(&body)));
    }

    let payload: ModelsListResponse = response.json().await.map_err(|err| err.to_string())?;
    let mut models = payload
        .data
        .into_iter()
        .map(|item| item.id.trim().to_string())
        .filter(|id| !id.is_empty())
        .collect::<Vec<_>>();
    models.sort();
    models.dedup();

    if models.is_empty() {
        return Err("接口返回成功，但没有拿到模型列表".to_string());
    }

    Ok(ProviderModelsProbeResult {
        models,
        source: "/models".to_string(),
    })
}

#[tauri::command]
async fn test_provider_model(input: TestProviderModelInput) -> Result<ProviderModelTestResult, String> {
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

    let api_key = if !inline_api_key.is_empty() {
        inline_api_key.to_string()
    } else {
        read_secret_from_env_or_dotenv(&app_root, api_key_env)
            .ok_or_else(|| format!("环境变量或 .env.local 中未设置 {}", api_key_env))?
    };

    let endpoint = chat_completions_endpoint(api_base);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(45))
        .build()
        .map_err(|err| err.to_string())?;
    let response = client
        .post(endpoint)
        .bearer_auth(api_key)
        .json(&json!({
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": "Reply with OK only."
                }
            ],
            "temperature": 0
        }))
        .send()
        .await
        .map_err(|err| err.to_string())?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("模型测试失败 HTTP {}: {}", status, trim_for_trace(&body)));
    }

    let chat: ChatCompletionsResponse = response.json().await.map_err(|err| err.to_string())?;
    let content = chat
        .choices
        .first()
        .map(|choice| choice.message.content.trim())
        .filter(|content| !content.is_empty())
        .ok_or_else(|| "模型返回为空".to_string())?;

    Ok(ProviderModelTestResult {
        model: model.to_string(),
        success: true,
        message: format!("{} 可用：{}", model, trim_for_trace(content)),
    })
}

#[tauri::command]
async fn test_provider_model_with_cache(input: TestProviderModelInput) -> Result<ProviderModelTestResult, String> {
    let app_root = find_workspace_root()?;
    let api_base = input.api_base.trim().to_string();
    let api_key_env = input.api_key_env.trim().to_string();
    let model = input.model.trim().to_string();
    let mut cache = load_or_seed_model_health(&app_root)?;

    match test_provider_model(input).await {
        Ok(result) => {
            upsert_model_health_entry(
                &mut cache,
                ModelHealthEntry {
                    api_base,
                    api_key_env,
                    model: model.clone(),
                    status: "available".to_string(),
                    message: result.message.clone(),
                    checked_at: current_unix_timestamp(),
                },
            );
            save_model_health_file(&app_root, &cache)?;
            Ok(result)
        }
        Err(err) => {
            upsert_model_health_entry(
                &mut cache,
                ModelHealthEntry {
                    api_base,
                    api_key_env,
                    model,
                    status: "unavailable".to_string(),
                    message: err.clone(),
                    checked_at: current_unix_timestamp(),
                },
            );
            save_model_health_file(&app_root, &cache)?;
            Err(err)
        }
    }
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

    Ok(GuardedCheckResult {
        id: spec.id.to_string(),
        label: spec.label.to_string(),
        command: spec.command.to_string(),
        success: output.status.success(),
        code: output.status.code(),
        output: combined,
    })
}

#[tauri::command]
fn run_project_os_action(input: RunProjectOsActionInput) -> Result<ProjectOsActionResult, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    if !root.exists() || !root.is_dir() {
        return Err("当前项目路径不存在或不是目录".to_string());
    }

    let spec = project_os_action_spec(&input.action_id, &app_root)
        .ok_or_else(|| format!("不允许执行这个治理动作：{}", input.action_id))?;
    for relative in &spec.required_paths {
        if !app_root.join(relative).exists() && !root.join(relative).exists() {
            return Err(format!("缺少治理动作所需文件：{}", relative));
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

    Ok(ProjectOsActionResult {
        id: spec.id.to_string(),
        label: spec.label.to_string(),
        command: spec.command,
        success: output.status.success(),
        code: output.status.code(),
        output: combined,
    })
}

#[tauri::command]
fn run_terminal_command(input: RunTerminalCommandInput) -> Result<TerminalCommandResult, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    if !root.exists() || !root.is_dir() {
        return Err("当前项目路径不存在或不是目录".to_string());
    }

    let command = input.command.trim();
    validate_terminal_command(command)?;

    let mut child = Command::new("zsh")
        .args(["-lc", command])
        .current_dir(&root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|err| err.to_string())?;

    let started_at = Instant::now();
    let timeout = Duration::from_secs(30);
    let mut timed_out = false;

    loop {
        match child.try_wait().map_err(|err| err.to_string())? {
            Some(_) => break,
            None if started_at.elapsed() >= timeout => {
                timed_out = true;
                let _ = child.kill();
                break;
            }
            None => std::thread::sleep(Duration::from_millis(80)),
        }
    }

    let output = child.wait_with_output().map_err(|err| err.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let mut combined = format!("{}{}", stdout, stderr);
    if timed_out {
        combined.push_str("\nCommand timed out after 30s.");
    }

    Ok(TerminalCommandResult {
        id: "terminal".to_string(),
        label: "Terminal".to_string(),
        command: command.to_string(),
        cwd: root.to_string_lossy().to_string(),
        success: output.status.success() && !timed_out,
        code: output.status.code(),
        output: trim_runner_output(&combined),
    })
}

#[tauri::command]
fn start_terminal_session(
    app: AppHandle,
    state: State<TerminalState>,
    input: StartTerminalSessionInput,
) -> Result<TerminalSessionResult, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    if !root.exists() || !root.is_dir() {
        return Err("当前项目路径不存在或不是目录".to_string());
    }

    let session_id = if input.session_id.trim().is_empty() {
        default_terminal_session_id()
    } else {
        input.session_id.trim().to_string()
    };
    let generation = {
        let mut next_generation = state.generation.lock().map_err(|err| err.to_string())?;
        *next_generation += 1;
        *next_generation
    };

    {
        let mut sessions = state.sessions.lock().map_err(|err| err.to_string())?;
        if let Some(mut existing) = sessions.remove(&session_id) {
            let _ = existing.child.kill();
        }
    }

    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    let pty_system = native_pty_system();
    let cols = input.cols.clamp(20, 400);
    let rows = input.rows.clamp(8, 200);
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|err| err.to_string())?;

    let mut command = CommandBuilder::new(shell.clone());
    command.cwd(root.clone());
    command.env("TERM", "xterm-256color");
    command.env("COLORTERM", "truecolor");
    command.env("PROMPT_EOL_MARK", "");

    let child = pair
        .slave
        .spawn_command(command)
        .map_err(|err| err.to_string())?;
    let mut reader = pair.master.try_clone_reader().map_err(|err| err.to_string())?;
    let writer = pair.master.take_writer().map_err(|err| err.to_string())?;
    let reader_session_id = session_id.clone();
    let reader_app = app.clone();
    let reader_generation = generation;

    std::thread::spawn(move || {
        let mut buffer = [0_u8; 4096];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(size) => {
                    let data = String::from_utf8_lossy(&buffer[..size]).to_string();
                    let _ = reader_app.emit(
                        "terminal://output",
                        TerminalOutputEvent {
                            session_id: reader_session_id.clone(),
                            generation: reader_generation,
                            data,
                        },
                    );
                }
                Err(_) => break,
            }
        }
    });

    let mut sessions = state.sessions.lock().map_err(|err| err.to_string())?;
    sessions.insert(
        session_id.clone(),
        TerminalSession {
            child,
            master: pair.master,
            writer,
        },
    );

    Ok(TerminalSessionResult {
        session_id,
        cwd: root.to_string_lossy().to_string(),
        generation,
        shell,
        running: true,
    })
}

#[tauri::command]
fn write_terminal_session(
    state: State<TerminalState>,
    input: WriteTerminalSessionInput,
) -> Result<(), String> {
    let session_id = if input.session_id.trim().is_empty() {
        default_terminal_session_id()
    } else {
        input.session_id.trim().to_string()
    };
    let mut sessions = state.sessions.lock().map_err(|err| err.to_string())?;
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| "终端还没有启动".to_string())?;
    session
        .writer
        .write_all(input.data.as_bytes())
        .map_err(|err| err.to_string())?;
    session.writer.flush().map_err(|err| err.to_string())
}

#[tauri::command]
fn resize_terminal_session(
    state: State<TerminalState>,
    input: ResizeTerminalSessionInput,
) -> Result<(), String> {
    let session_id = if input.session_id.trim().is_empty() {
        default_terminal_session_id()
    } else {
        input.session_id.trim().to_string()
    };
    let sessions = state.sessions.lock().map_err(|err| err.to_string())?;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| "终端还没有启动".to_string())?;
    session
        .master
        .resize(PtySize {
            rows: input.rows.clamp(8, 200),
            cols: input.cols.clamp(20, 400),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|err| err.to_string())
}

#[tauri::command]
fn stop_terminal_session(
    state: State<TerminalState>,
    input: StopTerminalSessionInput,
) -> Result<(), String> {
    let session_id = if input.session_id.trim().is_empty() {
        default_terminal_session_id()
    } else {
        input.session_id.trim().to_string()
    };
    let mut sessions = state.sessions.lock().map_err(|err| err.to_string())?;
    if let Some(mut session) = sessions.remove(&session_id) {
        let _ = session.child.kill();
    }
    Ok(())
}

fn validate_terminal_command(command: &str) -> Result<(), String> {
    if command.is_empty() {
        return Err("请输入要运行的命令".to_string());
    }
    if command.len() > 1000 {
        return Err("命令太长，请拆成更小的步骤".to_string());
    }
    if command.contains('\0') {
        return Err("命令包含非法字符".to_string());
    }

    let normalized = command.to_lowercase();
    let blocked_patterns = [
        "rm -rf /",
        "rm -rf ~",
        "sudo ",
        "su -",
        "mkfs",
        "diskutil erase",
        ":(){",
        "chmod -r 777 /",
        "chown -r ",
    ];
    if blocked_patterns.iter().any(|pattern| normalized.contains(pattern)) {
        return Err("这个命令看起来风险过高，已被终端保护拦截。".to_string());
    }

    Ok(())
}

struct GuardedCheckSpec {
    id: &'static str,
    label: &'static str,
    command: &'static str,
    program: String,
    args: Vec<String>,
    required_paths: Vec<&'static str>,
}

struct ProjectOsActionSpec {
    id: &'static str,
    label: &'static str,
    command: String,
    program: String,
    args: Vec<String>,
    required_paths: Vec<&'static str>,
}

fn guarded_check_spec(id: &str) -> Option<GuardedCheckSpec> {
    match id {
        "runtime" => Some(GuardedCheckSpec {
            id: "runtime",
            label: "Runtime",
            command: "bash scripts/check-runtime.sh .",
            program: "bash".to_string(),
            args: vec!["scripts/check-runtime.sh".to_string(), ".".to_string()],
            required_paths: vec!["scripts/check-runtime.sh"],
        }),
        "doc-structure" => Some(GuardedCheckSpec {
            id: "doc-structure",
            label: "Docs",
            command: "bash scripts/check-doc-structure.sh .",
            program: "bash".to_string(),
            args: vec!["scripts/check-doc-structure.sh".to_string(), ".".to_string()],
            required_paths: vec!["scripts/check-doc-structure.sh"],
        }),
        "recommend" => Some(GuardedCheckSpec {
            id: "recommend",
            label: "Recommend",
            command: "bash scripts/recommend-next.sh .",
            program: "bash".to_string(),
            args: vec!["scripts/recommend-next.sh".to_string(), ".".to_string()],
            required_paths: vec!["scripts/recommend-next.sh"],
        }),
        "ai-project" => Some(GuardedCheckSpec {
            id: "ai-project",
            label: "AI Project",
            command: "bash scripts/check-ai-project.sh . --write-report",
            program: "bash".to_string(),
            args: vec![
                "scripts/check-ai-project.sh".to_string(),
                ".".to_string(),
                "--write-report".to_string(),
            ],
            required_paths: vec!["scripts/check-ai-project.sh"],
        }),
        "web-build" => Some(GuardedCheckSpec {
            id: "web-build",
            label: "Web Build",
            command: "cd desktop && npm run web:build",
            program: "npm".to_string(),
            args: vec![
                "--prefix".to_string(),
                "desktop".to_string(),
                "run".to_string(),
                "web:build".to_string(),
            ],
            required_paths: vec!["desktop/package.json"],
        }),
        "cargo-check" => Some(GuardedCheckSpec {
            id: "cargo-check",
            label: "Cargo",
            command: "cd desktop/src-tauri && cargo check",
            program: "cargo".to_string(),
            args: vec![
                "check".to_string(),
                "--manifest-path".to_string(),
                "desktop/src-tauri/Cargo.toml".to_string(),
            ],
            required_paths: vec!["desktop/src-tauri/Cargo.toml"],
        }),
        _ => None,
    }
}

fn project_os_action_spec(id: &str, app_root: &Path) -> Option<ProjectOsActionSpec> {
    let cli_bin = app_root.join("bin").join("project-os");
    let runtime_root = app_root.to_string_lossy().to_string();
    let cli_program = cli_bin.to_string_lossy().to_string();
    let cli_command = |command: &str, extra: &[&str]| {
        let mut args = vec![
            command.to_string(),
            ".".to_string(),
            "--runtime-root".to_string(),
            runtime_root.clone(),
            "--trigger-source".to_string(),
            "desktop".to_string(),
        ];
        args.extend(extra.iter().map(|item| item.to_string()));
        args
    };

    match id {
        "scan" => Some(ProjectOsActionSpec {
            id: "scan",
            label: "一键扫描",
            command: format!(
                "{} scan . --runtime-root {} --trigger-source desktop --persist full --output json",
                cli_program, runtime_root
            ),
            program: cli_program,
            args: cli_command("scan", &["--persist", "full", "--output", "json"]),
            required_paths: vec!["bin/project-os"],
        }),
        "recommend" => Some(ProjectOsActionSpec {
            id: "recommend",
            label: "生成优化建议",
            command: format!(
                "{} recommend . --runtime-root {} --trigger-source desktop --persist full --output json",
                cli_program, runtime_root
            ),
            program: cli_program,
            args: cli_command("recommend", &["--persist", "full", "--output", "json"]),
            required_paths: vec!["bin/project-os"],
        }),
        "report" => Some(ProjectOsActionSpec {
            id: "report",
            label: "批量生成修复草案",
            command: format!(
                "{} report . --runtime-root {} --trigger-source desktop --output report --persist full",
                cli_program, runtime_root
            ),
            program: cli_program,
            args: cli_command("report", &["--output", "report", "--persist", "full"]),
            required_paths: vec!["bin/project-os"],
        }),
        "prune" => Some(ProjectOsActionSpec {
            id: "prune",
            label: "清理过期骨架产物",
            command: "bash scripts/prune-project-os-artifacts.sh .".to_string(),
            program: "bash".to_string(),
            args: vec![
                app_root
                    .join("scripts")
                    .join("prune-project-os-artifacts.sh")
                    .to_string_lossy()
                    .to_string(),
                ".".to_string(),
            ],
            required_paths: vec!["scripts/prune-project-os-artifacts.sh"],
        }),
        "sync" => Some(ProjectOsActionSpec {
            id: "sync",
            label: "同步治理状态",
            command: format!("{} state sync . --output json", cli_program),
            program: cli_program,
            args: vec![
                "state".to_string(),
                "sync".to_string(),
                ".".to_string(),
                "--output".to_string(),
                "json".to_string(),
            ],
            required_paths: vec!["bin/project-os"],
        }),
        _ => None,
    }
}

fn trim_runner_output(value: &str) -> String {
    let trimmed = value.trim();
    let mut result: String = trimmed.chars().take(6000).collect();
    if trimmed.chars().count() > 6000 {
        result.push_str("\n...output trimmed...");
    }
    result
}

fn run_git_apply(root: &Path, diff: &str, check_only: bool) -> Result<std::process::Output, String> {
    let mut args = vec!["apply"];
    if check_only {
        args.push("--check");
    }

    let mut child = Command::new("git")
        .args(args)
        .current_dir(root)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|err| err.to_string())?;

    if let Some(stdin) = child.stdin.as_mut() {
        stdin
            .write_all(diff.as_bytes())
            .map_err(|err| err.to_string())?;
    }

    child.wait_with_output().map_err(|err| err.to_string())
}

fn build_run_summary_markdown(task: &Value) -> String {
    let title = task
        .get("title")
        .and_then(Value::as_str)
        .unwrap_or("未命名任务");
    let status = task
        .get("status")
        .and_then(Value::as_str)
        .unwrap_or("unknown");
    let finished_at = current_timestamp_string();
    let files = task
        .pointer("/patchDraft/files")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(|item| format!("- `{}`", item))
                .collect::<Vec<_>>()
                .join("\n")
        })
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "- 未记录文件".to_string());
    let runs = task
        .get("runs")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .map(|run| {
                    let label = run.get("label").and_then(Value::as_str).unwrap_or("Check");
                    let success = run.get("success").and_then(Value::as_bool).unwrap_or(false);
                    format!("- {}: {}", label, if success { "passed" } else { "failed" })
                })
                .collect::<Vec<_>>()
                .join("\n")
        })
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "- 未运行验证".to_string());
    let apply_message = task
        .pointer("/applyResult/message")
        .and_then(Value::as_str)
        .unwrap_or("未应用 patch");
    let verification = task
        .get("verificationSummary")
        .and_then(Value::as_str)
        .unwrap_or("未生成验证摘要");

    format!(
        r#"

## {}

- 时间：{}
- 状态：{}
- Apply：{}
- 验证：{}

### 文件

{}

### 检查

{}
"#,
        title, finished_at, status, apply_message, verification, files, runs
    )
}

fn find_workspace_root() -> Result<PathBuf, String> {
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

    Err("未找到 Project OS 工作区根目录".to_string())
}

fn read_json(path: PathBuf) -> Option<Value> {
    fs::read_to_string(path)
        .ok()
        .and_then(|content| serde_json::from_str(&content).ok())
}

fn read_text(root: &Path, relative: &str) -> String {
    fs::read_to_string(root.join(relative)).unwrap_or_default()
}

fn clean_markdown_line(line: &str) -> String {
    line.trim()
        .trim_start_matches(['-', '*', '>', ' '])
        .trim()
        .trim_matches('`')
        .trim()
        .to_string()
}

fn markdown_section(content: &str, headings: &[&str]) -> String {
    let mut collecting = false;
    let mut lines: Vec<String> = Vec::new();

    for line in content.lines() {
        let trimmed = line.trim();
        let is_heading = trimmed.starts_with('#');
        if is_heading {
            let title = trimmed.trim_start_matches('#').trim();
            if collecting {
                break;
            }
            collecting = headings.iter().any(|heading| title.contains(heading));
            continue;
        }
        if collecting {
            let cleaned = clean_markdown_line(trimmed);
            if !cleaned.is_empty() {
                lines.push(cleaned);
            }
            if lines.len() >= 3 {
                break;
            }
        }
    }

    lines.join(" ")
}

fn first_non_empty(values: Vec<String>) -> String {
    values
        .into_iter()
        .map(|value| value.trim().to_string())
        .find(|value| !value.is_empty())
        .unwrap_or_default()
}

fn profile_field_value(profile: &Option<Value>, key: &str) -> String {
    profile
        .as_ref()
        .and_then(|json| json.pointer(&format!("/fields/{}/value", key.replace('.', "/"))))
        .or_else(|| {
            profile
                .as_ref()
                .and_then(|json| json.get("fields"))
                .and_then(|fields| fields.get(key))
                .and_then(|field| field.get("value"))
        })
        .map(value_to_profile_text)
        .unwrap_or_default()
}

fn json_string_value(json: &Option<Value>, pointer: &str) -> String {
    json.as_ref()
        .and_then(|value| value.pointer(pointer))
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string()
}

fn value_to_profile_text(value: &Value) -> String {
    match value {
        Value::String(text) => text.trim().to_string(),
        Value::Array(items) => items
            .iter()
            .map(value_to_profile_text)
            .filter(|text| !text.is_empty())
            .collect::<Vec<_>>()
            .join("、"),
        Value::Object(_) => serde_json::to_string(value).unwrap_or_default(),
        _ => String::new(),
    }
}

fn project_checks_from_agents(agents_md: &str) -> String {
    let commands = markdown_section(agents_md, &["Commands"]);
    let checks = commands
        .split_whitespace()
        .collect::<Vec<_>>()
        .windows(2)
        .filter_map(|window| {
            if window[0] == "bash" {
                Some(format!("bash {}", window[1].trim_matches('`')))
            } else {
                None
            }
        })
        .take(4)
        .collect::<Vec<_>>();
    if checks.is_empty() {
        return String::new();
    }
    checks.join("、")
}

fn project_intro_from_project_md(project_md: &str, project_name: &str) -> String {
    let section = markdown_section(project_md, &["项目简介", "项目介绍", "概览", "Overview", "Summary"]);
    if !section.is_empty() {
        return section;
    }

    project_md
        .lines()
        .map(clean_markdown_line)
        .find(|line| {
            !line.is_empty()
                && !line.starts_with('#')
                && !line.contains("什么时候更新")
                && !line.contains("不要写什么")
                && !line.contains(project_name)
        })
        .unwrap_or_default()
}

fn build_project_profile(root: &Path, project_name: &str) -> ProjectProfile {
    let project_md = read_text(root, "PROJECT.md");
    let product_plan = read_text(root, "docs/PRODUCT_PLAN.md");
    let handoff = read_text(root, "HANDOFF.md");
    let agents_md = read_text(root, "AGENTS.md");
    let state_json = read_json(root.join(".project-os/state.json"));
    let profile_json = read_json(root.join(".project-os/project-profile.json"));

    let intro = first_non_empty(vec![
            profile_field_value(&profile_json, "identity.summary"),
            profile_field_value(&profile_json, "identity.uniqueDescription"),
            json_string_value(&state_json, "/description"),
            project_intro_from_project_md(&project_md, project_name),
            markdown_section(&product_plan, &["项目简介", "产品简介", "Project", "Overview"]),
        ]);
    let phase_summary = first_non_empty(vec![
            profile_field_value(&profile_json, "identity.lifecycle"),
            json_string_value(&state_json, "/stage"),
            json_string_value(&state_json, "/phase"),
            markdown_section(&project_md, &["当前阶段", "当前进度"]),
        ]);
    let architecture_summary = first_non_empty(vec![
            profile_field_value(&profile_json, "engineering.architecture"),
            format!(
                "{} / {} / {}",
                json_string_value(&state_json, "/architecture/desktop"),
                json_string_value(&state_json, "/architecture/entry"),
                json_string_value(&state_json, "/architecture/rules")
            )
            .trim_matches([' ', '/'])
            .trim()
            .to_string(),
            markdown_section(&project_md, &["当前架构", "技术架构", "Architecture"]),
        ]);
    let check_commands = first_non_empty(vec![
            profile_field_value(&profile_json, "engineering.testing"),
            project_checks_from_agents(&agents_md),
            markdown_section(&project_md, &["当前验证", "验证", "检查"]),
        ]);
    let collaboration_rules = first_non_empty(vec![
            profile_field_value(&profile_json, "governance.permissions"),
            profile_field_value(&profile_json, "user.communicationStyle"),
            markdown_section(&agents_md, &["协作规则", "Working Boundaries"]),
            markdown_section(&handoff, &["风险与注意"]),
        ]);
    let long_term_goal = first_non_empty(vec![
            profile_field_value(&profile_json, "product.longTermGoal"),
            markdown_section(&product_plan, &["长期目标", "目标", "愿景", "Vision"]),
            markdown_section(&project_md, &["目标", "当前目标", "项目目标"]),
        ]);
    let target_users = first_non_empty(vec![
            profile_field_value(&profile_json, "product.targetUsers"),
            markdown_section(&product_plan, &["目标用户", "用户画像", "用户", "Audience"]),
            markdown_section(&project_md, &["目标用户", "用户画像"]),
        ]);
    let use_cases = first_non_empty(vec![
            profile_field_value(&profile_json, "product.useCases"),
            markdown_section(&product_plan, &["使用场景", "场景", "Use Cases"]),
            markdown_section(&project_md, &["使用场景", "场景"]),
        ]);
    let user_preferences = first_non_empty(vec![
            profile_field_value(&profile_json, "user.globalPreferences"),
            profile_field_value(&profile_json, "user.communicationStyle"),
            markdown_section(&handoff, &["用户偏好", "偏好", "User Preferences"]),
            markdown_section(&project_md, &["用户偏好", "偏好"]),
        ]);
    let mut missing_fields = Vec::new();
    for (label, value) in [
        ("项目概览", &intro),
        ("当前阶段", &phase_summary),
        ("技术架构", &architecture_summary),
        ("检查命令", &check_commands),
        ("协作规则", &collaboration_rules),
    ] {
        if value.trim().is_empty() {
            missing_fields.push(label.to_string());
        }
    }

    ProjectProfile {
        overview: intro.clone(),
        phase_summary,
        architecture_summary,
        check_commands,
        collaboration_rules,
        intro,
        long_term_goal,
        target_users,
        use_cases,
        user_preferences,
        missing_fields,
    }
}

fn package_scripts_summary(root: &Path) -> String {
    let package_paths = ["package.json", "desktop/package.json"];
    let mut scripts = Vec::new();
    for relative in package_paths {
        let Some(package_json) = read_json(root.join(relative)) else {
            continue;
        };
        if let Some(script_map) = package_json.get("scripts").and_then(Value::as_object) {
            for key in ["dev", "web:dev", "web:build", "build", "test", "lint"] {
                if let Some(value) = script_map.get(key).and_then(Value::as_str) {
                    scripts.push(format!("{}: {}", key, value));
                }
            }
        }
    }
    scripts.join("；")
}

fn detected_stack(root: &Path) -> Vec<String> {
    let mut stack = Vec::new();
    if root.join("desktop/src-tauri/Cargo.toml").exists() || root.join("src-tauri/Cargo.toml").exists() {
        stack.push("Tauri".to_string());
        stack.push("Rust".to_string());
    }
    for relative in ["package.json", "desktop/package.json"] {
        let Some(package_json) = read_json(root.join(relative)) else {
            continue;
        };
        let deps = ["dependencies", "devDependencies"]
            .iter()
            .filter_map(|key| package_json.get(key).and_then(Value::as_object))
            .flat_map(|deps| deps.keys().cloned())
            .collect::<Vec<_>>();
        if deps.iter().any(|name| name == "react" || name == "react-dom") {
            stack.push("React".to_string());
        }
        if deps.iter().any(|name| name == "vite" || name == "@vitejs/plugin-react") {
            stack.push("Vite".to_string());
        }
    }
    if root.join(".project-os").exists() {
        stack.push("Project OS".to_string());
    }
    stack.sort();
    stack.dedup();
    stack
}

fn git_status_summary(root: &Path) -> String {
    let Ok(output) = Command::new("git")
        .arg("-C")
        .arg(root)
        .arg("status")
        .arg("--short")
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
    else {
        return "未读取到 git 状态。".to_string();
    };
    if !output.status.success() {
        return "当前目录可能不是 git 仓库。".to_string();
    }
    let text = String::from_utf8_lossy(&output.stdout);
    let count = text.lines().filter(|line| !line.trim().is_empty()).count();
    if count == 0 {
        "git 工作区干净。".to_string()
    } else {
        format!("git 工作区有 {} 个变更项。", count)
    }
}

fn should_skip_governance_dir(name: &str) -> bool {
    matches!(
        name,
        "node_modules"
            | "target"
            | "dist"
            | "build"
            | ".git"
            | ".next"
            | ".nuxt"
            | ".vite"
            | ".turbo"
            | ".cache"
            | "coverage"
    )
}

fn is_governance_text_file(path: &Path) -> bool {
    let file_name = path.file_name().and_then(|value| value.to_str()).unwrap_or("");
    if file_name.starts_with(".env") || file_name.ends_with(".lock") {
        return false;
    }
    matches!(
        path.extension().and_then(|value| value.to_str()),
        Some(
            "md" | "mdx"
                | "txt"
                | "json"
                | "jsonc"
                | "yaml"
                | "yml"
                | "toml"
                | "js"
                | "jsx"
                | "ts"
                | "tsx"
                | "css"
                | "scss"
                | "html"
                | "rs"
                | "sh"
                | "py"
                | "sql"
        )
    )
}

fn collect_governance_files(root: &Path) -> Vec<String> {
    const MAX_FILES: usize = 360;
    const MAX_DEPTH: usize = 5;
    let mut files = Vec::new();
    let mut stack = vec![(root.to_path_buf(), 0usize)];

    while let Some((dir, depth)) = stack.pop() {
        if files.len() >= MAX_FILES || depth > MAX_DEPTH {
            continue;
        }
        let Ok(entries) = fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if path.is_dir() {
                if should_skip_governance_dir(&name) {
                    continue;
                }
                stack.push((path, depth + 1));
                continue;
            }
            if !is_governance_text_file(&path) {
                continue;
            }
            let Ok(relative) = path.strip_prefix(root) else {
                continue;
            };
            let relative = relative.to_string_lossy().replace('\\', "/");
            if relative.contains(".project-os/desktop-provider") {
                continue;
            }
            files.push(relative);
            if files.len() >= MAX_FILES {
                break;
            }
        }
    }

    files.sort();
    files
}

fn push_domain_file(domains: &mut HashMap<&'static str, Vec<String>>, domain: &'static str, file: &str) {
    domains.entry(domain).or_default().push(file.to_string());
}

fn classify_governance_file(file: &str, domains: &mut HashMap<&'static str, Vec<String>>) {
    let lower = file.to_lowercase();
    if matches!(file, "PROJECT.md" | "README.md" | "HANDOFF.md")
        || lower.contains("project-profile")
        || lower.ends_with("state.json")
    {
        push_domain_file(domains, "project-identity", file);
    }
    if file == "HANDOFF.md" || lower.contains("goals") || lower.contains("/runs/") {
        push_domain_file(domains, "current-progress", file);
    }
    if lower.ends_with("package.json")
        || lower.contains("runbook")
        || lower.contains("readme")
        || lower.starts_with("scripts/")
    {
        push_domain_file(domains, "runbook", file);
    }
    if file == "AGENTS.md"
        || lower.contains("routing")
        || lower.contains("security")
        || lower.contains("lesson")
        || lower.contains("risk")
    {
        push_domain_file(domains, "risk-boundary", file);
    }
    if lower.starts_with(".project-os/") {
        push_domain_file(domains, "local-state", file);
    }
    if lower.starts_with("docs/")
        || lower.contains("architecture")
        || lower.contains("design")
        || lower.contains("code_structure")
        || lower.starts_with("schemas/")
    {
        push_domain_file(domains, "design-implementation", file);
    }
    if lower.starts_with("desktop/src")
        || lower.starts_with("desktop/src-tauri")
        || lower.starts_with("scripts/")
        || lower.starts_with("adapters/")
        || lower.starts_with("templates/")
    {
        push_domain_file(domains, "engineering-assets", file);
    }
}

fn domain_files(
    domains: &HashMap<&'static str, Vec<String>>,
    id: &'static str,
    fallback: Vec<&str>,
) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut files = domains
        .get(id)
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter(|file| seen.insert(file.clone()))
        .collect::<Vec<_>>();
    if files.is_empty() {
        files = fallback.into_iter().map(String::from).collect();
    }
    files.truncate(12);
    files
}

fn git_changed_files(root: &Path) -> HashSet<String> {
    let Ok(output) = Command::new("git")
        .arg("-C")
        .arg(root)
        .arg("status")
        .arg("--porcelain")
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
    else {
        return HashSet::new();
    };
    if !output.status.success() {
        return HashSet::new();
    }
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(|line| {
            let path = line.get(3..)?.trim();
            let path = path.split(" -> ").last().unwrap_or(path);
            if path.is_empty() {
                None
            } else {
                Some(path.to_string())
            }
        })
        .collect()
}

fn governance_file_status(root: &Path, changed: &HashSet<String>, file: &str) -> &'static str {
    if file.contains('*') || file.ends_with('/') {
        return "ignored";
    }
    if file.starts_with(".project-os/runs/") {
        return "generated";
    }
    if changed.contains(file) {
        return "changed";
    }
    if root.join(file).exists() {
        return "found";
    }
    "missing"
}

fn governance_file_statuses(root: &Path, changed: &HashSet<String>, files: &[String]) -> Vec<Value> {
    files
        .iter()
        .map(|file| {
            let status = governance_file_status(root, changed, file);
            json!({
                "path": file,
                "status": status,
                "previewable": status != "ignored" && root.join(file).is_file()
            })
        })
        .collect()
}

fn governance_status_summary(file_statuses: &[Value]) -> Value {
    let mut counts: HashMap<&str, usize> = HashMap::new();
    for item in file_statuses {
        let status = item.get("status").and_then(Value::as_str).unwrap_or("found");
        *counts.entry(status).or_insert(0) += 1;
    }
    json!({
        "found": counts.get("found").copied().unwrap_or(0),
        "missing": counts.get("missing").copied().unwrap_or(0),
        "changed": counts.get("changed").copied().unwrap_or(0),
        "stale": counts.get("stale").copied().unwrap_or(0),
        "generated": counts.get("generated").copied().unwrap_or(0),
        "ignored": counts.get("ignored").copied().unwrap_or(0)
    })
}

fn governance_domain_json(
    root: &Path,
    changed: &HashSet<String>,
    classified: &HashMap<&'static str, Vec<String>>,
    id: &'static str,
    title: &'static str,
    description: &'static str,
    fallback: Vec<&str>,
    updates_when: &'static str,
) -> Value {
    let files = domain_files(classified, id, fallback);
    let file_statuses = governance_file_statuses(root, changed, &files);
    let status_summary = governance_status_summary(&file_statuses);
    json!({
        "id": id,
        "title": title,
        "description": description,
        "files": files,
        "fileStatuses": file_statuses,
        "statusSummary": status_summary,
        "updatesWhen": updates_when
    })
}

fn governance_domains_from_files(root: &Path) -> Vec<Value> {
    let files = collect_governance_files(root);
    let mut classified: HashMap<&'static str, Vec<String>> = HashMap::new();
    for file in &files {
        classify_governance_file(file, &mut classified);
    }
    let changed = git_changed_files(root);

    vec![
        governance_domain_json(root, &changed, &classified, "project-identity", "项目概览", "项目身份、定位、类型和生命周期。", vec!["PROJECT.md", "README.md", ".project-os/project-profile.json", ".project-os/state.json"], "项目定位、类型、阶段或工作区状态变化时自动刷新。"),
        governance_domain_json(root, &changed, &classified, "current-progress", "当前进度", "最近完成、当前推进和下一步。", vec!["HANDOFF.md", "PROJECT.md", ".project-os/goals.json", ".project-os/state.json"], "目标任务、交接记录或 git 状态变化时自动刷新。"),
        governance_domain_json(root, &changed, &classified, "runbook", "启动方式", "启动、构建、验证和常用脚本。", vec!["package.json", "desktop/package.json", "docs/RUNBOOK.md", "desktop/README.md"], "package scripts、运行说明或桌面端配置变化时自动刷新。"),
        governance_domain_json(root, &changed, &classified, "risk-boundary", "风险边界", "不可随意改动的约束、风险和协作边界。", vec!["HANDOFF.md", "PROJECT.md", ".project-os/project-profile.json"], "协作规则、风险说明或项目档案变化时自动刷新。"),
        governance_domain_json(root, &changed, &classified, "local-state", "本地状态", "Git、本地工作区、运行状态和 Project OS 状态。", vec![".project-os/state.json", ".project-os/runs/", ".project-os/desktop-registry.json"], "文件变更、git 状态或 Project OS 运行状态变化时自动刷新。"),
        governance_domain_json(root, &changed, &classified, "design-implementation", "设计实现", "架构、界面规范、数据契约和实现结构。", vec!["docs/ARCHITECTURE.md", "docs/DESIGN_STANDARDS.md", "schemas/*", "desktop/src/*"], "架构、设计 token、schema 或源码入口变化时自动刷新。"),
        governance_domain_json(root, &changed, &classified, "engineering-assets", "工程资产", "源码、脚本、模板和适配器。", vec!["desktop/src/*", "desktop/src-tauri/*", "scripts/*", "templates/*"], "源码、脚本、模板或适配器文件变化时自动刷新。"),
    ]
}

fn score_from_checks(checks: &[bool]) -> i32 {
    if checks.is_empty() {
        return 0;
    }
    let passed = checks.iter().filter(|value| **value).count() as f32;
    ((passed / checks.len() as f32) * 100.0).round() as i32
}

fn health_status(score: i32) -> &'static str {
    if score >= 85 {
        "healthy"
    } else if score >= 70 {
        "good"
    } else if score >= 50 {
        "watch"
    } else {
        "risk"
    }
}

fn build_health_score(
    root: &Path,
    profile: &ProjectProfile,
    overview: &str,
    scripts: &str,
    risk_boundary: &str,
    governance_domains: &[Value],
) -> Value {
    let project_identity = score_from_checks(&[
        !overview.trim().is_empty(),
        !profile.phase_summary.trim().is_empty(),
        !profile.architecture_summary.trim().is_empty(),
        root.join(".project-os/project-profile.json").exists(),
    ]);
    let governed_file_count = governance_domains
        .iter()
        .filter_map(|domain| domain.get("files").and_then(Value::as_array))
        .map(|files| files.len())
        .sum::<usize>();
    let engineering_files = score_from_checks(&[
        governed_file_count >= 8,
        root.join("PROJECT.md").exists() || root.join("README.md").exists(),
        root.join("HANDOFF.md").exists(),
        root.join(".project-os/state.json").exists(),
    ]);
    let run_validation = score_from_checks(&[
        !scripts.trim().is_empty(),
        scripts.contains("dev"),
        scripts.contains("build") || !profile.check_commands.trim().is_empty(),
        scripts.contains("test") || scripts.contains("lint") || !profile.check_commands.trim().is_empty(),
    ]);
    let risk_boundary_score = score_from_checks(&[
        !risk_boundary.trim().is_empty(),
        !profile.collaboration_rules.trim().is_empty(),
        root.join("AGENTS.md").exists(),
        root.join("HANDOFF.md").exists(),
    ]);
    let continuous_governance = score_from_checks(&[
        root.join(".project-os").exists(),
        root.join(".project-os/runs").exists(),
        root.join(".project-os/workspace-facts.json").exists(),
        root.join(".github/workflows").exists() || root.join(".gitlab-ci.yml").exists(),
    ]);
    let dimensions = vec![
        ("projectIdentity", "项目身份", project_identity, "项目名、定位、生命周期和项目档案完整度。"),
        ("engineeringFiles", "工程文件", engineering_files, "关键文件识别和治理域覆盖情况。"),
        ("runValidation", "启动验证", run_validation, "启动、构建、测试或检查命令识别情况。"),
        ("riskBoundary", "风险边界", risk_boundary_score, "风险说明、权限边界和协作规则完整度。"),
        ("continuousGovernance", "持续治理", continuous_governance, "本地状态、运行记录和 CI/定期扫描入口。"),
    ];
    let total = (dimensions.iter().map(|(_, _, score, _)| *score).sum::<i32>() as f32
        / dimensions.len() as f32)
        .round() as i32;

    json!({
        "score": total,
        "status": health_status(total),
        "label": format!("{} / 100", total),
        "summary": if total >= 85 {
            "项目治理基础扎实，可以推进持续治理。"
        } else if total >= 70 {
            "项目已具备治理基础，建议补齐关键短板。"
        } else if total >= 50 {
            "项目已有部分治理信号，需要继续补齐事实源。"
        } else {
            "项目治理信号较弱，建议从只读体检和基础档案开始。"
        },
        "dimensions": dimensions.into_iter().map(|(id, label, score, reason)| json!({
            "id": id,
            "label": label,
            "score": score,
            "status": health_status(score),
            "reason": reason
        })).collect::<Vec<_>>()
    })
}

fn build_workspace_facts_preview(root: &Path, project_name: &str) -> Value {
    let state_json = read_json(root.join(".project-os/state.json"));
    let profile = build_project_profile(root, project_name);
    let project_md = read_text(root, "PROJECT.md");
    let handoff = read_text(root, "HANDOFF.md");
    let runbook = read_text(root, "docs/RUNBOOK.md");
    let stack = detected_stack(root);
    let scripts = package_scripts_summary(root);
    let git_status = git_status_summary(root);
    let governance_domains = governance_domains_from_files(root);
    let overview = first_non_empty(vec![
        profile.overview.clone(),
        json_string_value(&state_json, "/description"),
        project_intro_from_project_md(&project_md, project_name),
    ]);
    let current_progress = first_non_empty(vec![
        markdown_section(&handoff, &["最近完成", "当前验证", "下一步建议"]),
        markdown_section(&project_md, &["当前进度", "下一步重点"]),
        git_status.clone(),
    ]);
    let runbook_summary = first_non_empty(vec![
        scripts.clone(),
        markdown_section(&runbook, &["启动", "运行", "Commands"]),
        profile.check_commands.clone(),
    ]);
    let risk_boundary = first_non_empty(vec![
        markdown_section(&handoff, &["风险与注意", "风险"]),
        profile_field_value(&read_json(root.join(".project-os/project-profile.json")), "memory.risks"),
        "老项目默认只读扫描，用户确认前不修改工程文件。".to_string(),
    ]);
    let local_state = format!(
        "{} {}",
        git_status,
        if root.join(".project-os").exists() { "已发现 .project-os 工作区状态。" } else { "未发现 .project-os 工作区状态。" }
    );
    let health_score = build_health_score(root, &profile, &overview, &scripts, &risk_boundary, &governance_domains);
    let now = Command::new("date")
        .arg("+%Y-%m-%dT%H:%M:%S%z")
        .output()
        .ok()
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|text| text.trim().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    json!({
        "schemaVersion": "project-os.workspace-facts.v0.1",
        "generatedAt": now,
        "mode": if root.join(".project-os").exists() { "existing-project" } else { "temporary-readonly" },
        "status": "connected",
        "healthScore": health_score,
        "governanceLevel": {
            "current": "L1",
            "name": "治理索引",
            "description": "项目已零侵入接入，工程文件会被自动扫描、归类和只读预览。",
            "next": "L2",
            "nextName": "建议修复",
            "levels": [
                { "id": "L0", "name": "只读体检", "description": "扫描、识别、健康检查，不改工程文件。" },
                { "id": "L1", "name": "治理索引", "description": "建立项目档案、治理域、工程文件索引和上下文记忆。" },
                { "id": "L2", "name": "建议修复", "description": "生成问题解释、修复建议和变更提案草稿。" },
                { "id": "L3", "name": "受控修复", "description": "用户确认后自动改文件、运行检查并沉淀记录。" },
                { "id": "L4", "name": "持续治理", "description": "接入 CI 或定期任务，持续扫描、提醒和复审豁免。" }
            ]
        },
        "project": {
            "name": project_name,
            "path": root.display().to_string(),
            "kind": profile_field_value(&read_json(root.join(".project-os/project-profile.json")), "identity.type"),
            "detectedStack": stack,
            "lifecycle": json_string_value(&state_json, "/phase"),
            "description": overview
        },
        "summary": {
            "overview": {
                "status": if overview.is_empty() { "missing" } else { "confirmed" },
                "title": "项目概览",
                "body": if overview.is_empty() { "尚未识别到项目概览。".to_string() } else { overview.clone() },
                "sources": ["PROJECT.md", ".project-os/state.json", ".project-os/project-profile.json"],
                "confidence": 0.82
            },
            "currentProgress": {
                "status": if current_progress.is_empty() { "missing" } else { "inferred" },
                "title": "当前进度",
                "body": if current_progress.is_empty() { "尚未识别到当前进度。".to_string() } else { current_progress.clone() },
                "sources": ["HANDOFF.md", "PROJECT.md", "git status"],
                "confidence": 0.72
            },
            "runbook": {
                "status": if runbook_summary.is_empty() { "missing" } else { "confirmed" },
                "title": "启动方式",
                "body": if runbook_summary.is_empty() { "尚未识别到启动方式。".to_string() } else { runbook_summary.clone() },
                "sources": ["package.json", "desktop/package.json", "docs/RUNBOOK.md"],
                "confidence": 0.78
            },
            "riskBoundary": {
                "status": if risk_boundary.is_empty() { "missing" } else { "inferred" },
                "title": "风险边界",
                "body": if risk_boundary.is_empty() { "尚未识别到风险边界。".to_string() } else { risk_boundary.clone() },
                "sources": ["HANDOFF.md", ".project-os/project-profile.json"],
                "confidence": 0.68
            },
            "localState": {
                "status": "confirmed",
                "title": "本地状态",
                "body": local_state,
                "sources": ["git status", ".project-os/"],
                "confidence": 0.82
            }
        },
        "evidence": [
            { "source": "PROJECT.md", "kind": "project-status", "status": if root.join("PROJECT.md").exists() { "found" } else { "missing" }, "note": "项目状态展示层。" },
            { "source": "HANDOFF.md", "kind": "handoff", "status": if root.join("HANDOFF.md").exists() { "found" } else { "missing" }, "note": "当前交接和风险来源。" },
            { "source": "desktop/package.json", "kind": "run-config", "status": if root.join("desktop/package.json").exists() { "found" } else { "missing" }, "note": "桌面端启动脚本来源。" },
            { "source": ".project-os/state.json", "kind": "project-state", "status": if root.join(".project-os/state.json").exists() { "found" } else { "missing" }, "note": "机器可读项目状态。" },
            { "source": ".project-os/project-profile.json", "kind": "project-profile", "status": if root.join(".project-os/project-profile.json").exists() { "found" } else { "missing" }, "note": "结构化项目档案。" }
        ],
        "governanceDomains": governance_domains,
        "recommendations": [
            {
                "id": "rec-health-score",
                "domain": "项目概览",
                "title": "补齐项目健康评分",
                "problem": "当前已建立治理索引，但缺少统一健康分，用户还难以判断项目整体治理水平。",
                "impact": "后续无法稳定比较新老项目，也难以跟踪治理改善效果。",
                "action": "基于文档完整度、启动方式、风险边界、本地状态和验证记录生成健康分。",
                "severity": "medium",
                "files": ["schemas/workspace-facts.schema.json", ".project-os/workspace-facts.json"],
                "canPromoteToL3": false
            },
            {
                "id": "rec-file-status",
                "domain": "工程资产",
                "title": "为治理文件增加状态",
                "problem": "工程文件已经纳入治理域，但还没有区分已识别、缺失、过期和本地变更。",
                "impact": "用户能看到文件列表，但无法快速判断哪些文件需要处理。",
                "action": "为每个治理文件补充 status、lastSeen、changeKind 和 sourceType。",
                "severity": "medium",
                "files": ["desktop/src-tauri/src/main.rs", "desktop/src/main.jsx"],
                "canPromoteToL3": false
            },
            {
                "id": "rec-ci-governance",
                "domain": "验证交付",
                "title": "设计持续治理入口",
                "problem": "当前联动更新只发生在本地工作台，尚未和 CI 或定期扫描形成闭环。",
                "impact": "项目离开本地工作台后，治理状态可能无法持续更新。",
                "action": "增加 CI/定时扫描适配入口，先生成建议和检查清单，不直接修改流水线。",
                "severity": "low",
                "files": ["docs/RUNBOOK.md", "desktop/package.json"],
                "canPromoteToL3": false
            },
            {
                "id": "rec-controlled-fix-entry",
                "domain": "受控修复",
                "title": "准备 L3 受控修复入口",
                "problem": "L2 建议可以解释问题，但还没有把建议转成可审核的变更提案。",
                "impact": "用户仍需要手动判断哪些建议可以进入自动修复。",
                "action": "为建议增加生成 patch draft 的入口，只有用户确认后才进入 L3。",
                "severity": "low",
                "files": ["desktop/src/main.jsx", "desktop/src-tauri/src/main.rs"],
                "canPromoteToL3": true
            }
        ],
        "findings": {
            "confirmed": [],
            "missing": profile.missing_fields.iter().map(|field| json!({
                "title": format!("{}待补齐", field),
                "body": "该字段尚未从当前事实源中稳定识别。",
                "severity": "low",
                "sources": [".project-os/project-profile.json"]
            })).collect::<Vec<_>>(),
            "risks": [
                {
                    "title": "默认不修改工程文件",
                    "body": "工程文件自动纳入治理索引，但当前只做预览和归类，不在这里直接编辑或改写原工程文件。",
                    "severity": "info",
                    "sources": ["OmniDesk workspace"]
                }
            ]
        },
        "recommendation": {
            "action": "auto-managed",
            "confidence": 0.74,
            "reason": "当前项目处于 L1 治理索引，可继续升级到 L2 建议修复。",
            "nextSteps": ["自动维护治理索引", "在工程文件区预览来源", "生成 L2 修复建议草稿"]
        }
    })
}

fn is_profile_field_allowed(key: &str) -> bool {
    matches!(
        key,
        "identity.summary"
            | "identity.type"
            | "identity.lifecycle"
            | "identity.uniqueDescription"
            | "product.longTermGoal"
            | "product.coreValue"
            | "product.targetUsers"
            | "product.useCases"
            | "product.successCriteria"
            | "product.scope"
            | "product.nonGoals"
            | "user.globalPreferences"
            | "user.skillLevel"
            | "user.communicationStyle"
            | "governance.routing"
            | "governance.permissions"
            | "governance.documentation"
            | "engineering.architecture"
            | "engineering.dataModel"
            | "engineering.designSystem"
            | "engineering.testing"
            | "engineering.delivery"
            | "memory.risks"
            | "memory.decisions"
            | "memory.lessons"
    )
}

fn normalize_profile_status(status: &str) -> String {
    match status {
        "inferred" | "user_confirmed" | "document_confirmed" | "outdated" => status.to_string(),
        _ => "unknown".to_string(),
    }
}

fn normalize_backlog_status(status: &str) -> String {
    match status.trim() {
        "planned" | "running" | "done" | "failed" | "waiting approval" => status.trim().to_string(),
        _ => String::new(),
    }
}

fn provider_config_path(app_root: &Path) -> PathBuf {
    app_root.join(".project-os/desktop-provider.json")
}

fn model_catalog_path(app_root: &Path) -> PathBuf {
    app_root.join(".project-os/model-catalog.json")
}

fn model_health_path(app_root: &Path) -> PathBuf {
    app_root.join(".project-os/model-health.json")
}

fn desktop_theme_path(app_root: &Path) -> PathBuf {
    app_root.join(".project-os/desktop-theme.json")
}

fn desktop_tasks_dir(root: &Path) -> PathBuf {
    root.join(".project-os/runs/desktop-tasks")
}

fn safe_task_file_stem(id: &str) -> String {
    let stem = id
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '-'
            }
        })
        .collect::<String>();
    if stem.is_empty() {
        "task".to_string()
    } else {
        stem
    }
}

fn current_timestamp_string() -> String {
    let output = Command::new("date")
        .arg("-u")
        .arg("+%Y-%m-%dT%H:%M:%SZ")
        .output();
    output
        .ok()
        .and_then(|output| {
            if output.status.success() {
                Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
            } else {
                None
            }
        })
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "unknown".to_string())
}

fn default_model_catalog() -> ModelCatalog {
    ModelCatalog {
        schema_version: "project-os.model-catalog.v0.1".to_string(),
        providers: vec![
            ModelCatalogProvider {
                id: "openai".to_string(),
                label: "OpenAI".to_string(),
                note: "OpenAI 官方账号".to_string(),
                website: "https://platform.openai.com".to_string(),
                provider: "openai-compatible".to_string(),
                api_base: "https://api.openai.com/v1".to_string(),
                api_key_env: "OPENAI_API_KEY".to_string(),
                models: vec![
                    "gpt-5.5".to_string(),
                    "gpt-5.4".to_string(),
                    "gpt-5.4-mini".to_string(),
                    "gpt-5.4-nano".to_string(),
                    "gpt-4.1-mini".to_string(),
                ],
            },
            ModelCatalogProvider {
                id: "deepseek".to_string(),
                label: "DeepSeek".to_string(),
                note: "DeepSeek 官方账号".to_string(),
                website: "https://platform.deepseek.com".to_string(),
                provider: "openai-compatible".to_string(),
                api_base: "https://api.deepseek.com/v1".to_string(),
                api_key_env: "DEEPSEEK_API_KEY".to_string(),
                models: vec![
                    "deepseek-v4-flash".to_string(),
                    "deepseek-chat".to_string(),
                    "deepseek-reasoner".to_string(),
                ],
            },
            ModelCatalogProvider {
                id: "qwen".to_string(),
                label: "Qwen".to_string(),
                note: "阿里百炼 / DashScope".to_string(),
                website: "https://dashscope.aliyun.com".to_string(),
                provider: "openai-compatible".to_string(),
                api_base: "https://dashscope.aliyuncs.com/compatible-mode/v1".to_string(),
                api_key_env: "DASHSCOPE_API_KEY".to_string(),
                models: vec![
                    "qwen3.7-max".to_string(),
                    "qwen3.7-plus".to_string(),
                    "qwen3.6-flash".to_string(),
                    "qwen-plus".to_string(),
                ],
            },
            ModelCatalogProvider {
                id: "gateway".to_string(),
                label: "Gateway".to_string(),
                note: "公司或团队统一中转".to_string(),
                website: "https://your-gateway.example".to_string(),
                provider: "openai-compatible".to_string(),
                api_base: "https://your-gateway.example/v1".to_string(),
                api_key_env: "LLM_GATEWAY_API_KEY".to_string(),
                models: vec!["your-model".to_string()],
            },
        ],
    }
}

fn load_or_seed_model_catalog(app_root: &Path) -> Result<ModelCatalog, String> {
    let path = model_catalog_path(app_root);
    if path.exists() {
        let content = fs::read_to_string(&path).map_err(|err| err.to_string())?;
        let catalog: ModelCatalog = serde_json::from_str(&content).map_err(|err| err.to_string())?;
        if !catalog.providers.is_empty() {
            return Ok(catalog);
        }
    }

    let catalog = default_model_catalog();
    save_model_catalog(app_root, &catalog)?;
    Ok(catalog)
}

fn save_model_catalog(app_root: &Path, catalog: &ModelCatalog) -> Result<(), String> {
    let path = model_catalog_path(app_root);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    let content = serde_json::to_string_pretty(catalog).map_err(|err| err.to_string())?;
    fs::write(path, format!("{content}\n")).map_err(|err| err.to_string())
}

fn default_desktop_theme() -> DesktopThemeConfig {
    let accent = DesktopThemeAccent {
        id: "mint".to_string(),
        label: "Mint".to_string(),
        h: 160,
        s: "80%".to_string(),
        l: "47%".to_string(),
    };
    DesktopThemeConfig {
        schema_version: "project-os.desktop-theme.v0.1".to_string(),
        mode: "dark".to_string(),
        accent,
        accents: Vec::new(),
    }
}

fn load_or_seed_desktop_theme(app_root: &Path) -> Result<DesktopThemeConfig, String> {
    let path = desktop_theme_path(app_root);
    if path.exists() {
        let content = fs::read_to_string(&path).map_err(|err| err.to_string())?;
        let config: DesktopThemeConfig = serde_json::from_str(&content).map_err(|err| err.to_string())?;
        let normalized = normalize_desktop_theme(config);
        save_desktop_theme_file(app_root, &normalized)?;
        return Ok(normalized);
    }

    let config = default_desktop_theme();
    save_desktop_theme_file(app_root, &config)?;
    Ok(config)
}

fn save_desktop_theme_file(app_root: &Path, config: &DesktopThemeConfig) -> Result<(), String> {
    let path = desktop_theme_path(app_root);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    let content = serde_json::to_string_pretty(config).map_err(|err| err.to_string())?;
    fs::write(path, format!("{content}\n")).map_err(|err| err.to_string())
}

fn normalize_desktop_theme(mut config: DesktopThemeConfig) -> DesktopThemeConfig {
    config.schema_version = "project-os.desktop-theme.v0.1".to_string();
    if config.mode != "light" {
        config.mode = "dark".to_string();
    }
    if config.accent.id.trim().is_empty() {
        config.accent.id = "custom".to_string();
    }
    if config.accent.label.trim().is_empty() {
        config.accent.label = config.accent.id.clone();
    }
    if config.accent.h > 360 {
        config.accent.h = 160;
    }
    if !config.accent.s.ends_with('%') {
        config.accent.s = "80%".to_string();
    }
    if !config.accent.l.ends_with('%') {
        config.accent.l = "47%".to_string();
    }
    config.accents = config
        .accents
        .into_iter()
        .map(normalize_desktop_theme_accent)
        .filter(|accent| !accent.id.trim().is_empty())
        .fold(Vec::<DesktopThemeAccent>::new(), |mut acc, accent| {
            if !acc.iter().any(|item| item.id == accent.id) {
                acc.push(accent);
            }
            acc
        });
    if config.accent.id.starts_with("custom-")
        && !config.accents.iter().any(|item| item.id == config.accent.id)
    {
        config.accents.push(config.accent.clone());
    }
    config
}

fn normalize_desktop_theme_accent(mut accent: DesktopThemeAccent) -> DesktopThemeAccent {
    accent.id = accent.id.trim().to_string();
    if accent.label.trim().is_empty() {
        accent.label = accent.id.clone();
    }
    if accent.h > 360 {
        accent.h = 160;
    }
    if !accent.s.ends_with('%') {
        accent.s = "80%".to_string();
    }
    if !accent.l.ends_with('%') {
        accent.l = "47%".to_string();
    }
    accent
}

fn default_provider_config() -> ProviderConfig {
    let profile = ProviderProfile {
        id: "deepseek".to_string(),
        name: "DeepSeek".to_string(),
        note: "DeepSeek 官方账号".to_string(),
        website: "https://platform.deepseek.com".to_string(),
        provider: "openai-compatible".to_string(),
        model: "deepseek-v4-flash".to_string(),
        api_base: "https://api.deepseek.com/v1".to_string(),
        api_key_env: "DEEPSEEK_API_KEY".to_string(),
    };
    ProviderConfig {
        schema_version: "project-os.desktop-provider.v0.1".to_string(),
        provider: profile.provider.clone(),
        model: profile.model.clone(),
        api_base: profile.api_base.clone(),
        api_key_env: profile.api_key_env.clone(),
        enabled: false,
        active_profile_id: profile.id.clone(),
        profiles: vec![profile],
    }
}

fn load_or_seed_provider_config(app_root: &Path) -> Result<ProviderConfig, String> {
    let path = provider_config_path(app_root);
    if path.exists() {
        let content = fs::read_to_string(&path).map_err(|err| err.to_string())?;
        let mut config: ProviderConfig = serde_json::from_str(&content).map_err(|err| err.to_string())?;
        if normalize_provider_config(&mut config) {
            save_provider_config_file(app_root, &config)?;
        }
        return Ok(config);
    }

    let config = default_provider_config();
    save_provider_config_file(app_root, &config)?;
    Ok(config)
}

fn save_provider_config_file(app_root: &Path, config: &ProviderConfig) -> Result<(), String> {
    let path = provider_config_path(app_root);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    let content = serde_json::to_string_pretty(config).map_err(|err| err.to_string())?;
    fs::write(path, format!("{content}\n")).map_err(|err| err.to_string())
}

fn default_model_health_cache() -> ModelHealthCache {
    ModelHealthCache {
        schema_version: "project-os.model-health.v0.1".to_string(),
        entries: Vec::new(),
    }
}

fn load_or_seed_model_health(app_root: &Path) -> Result<ModelHealthCache, String> {
    let path = model_health_path(app_root);
    if path.exists() {
        let content = fs::read_to_string(&path).map_err(|err| err.to_string())?;
        let mut cache: ModelHealthCache = serde_json::from_str(&content).map_err(|err| err.to_string())?;
        cache.schema_version = "project-os.model-health.v0.1".to_string();
        save_model_health_file(app_root, &cache)?;
        return Ok(cache);
    }

    let cache = default_model_health_cache();
    save_model_health_file(app_root, &cache)?;
    Ok(cache)
}

fn save_model_health_file(app_root: &Path, cache: &ModelHealthCache) -> Result<(), String> {
    let path = model_health_path(app_root);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    let content = serde_json::to_string_pretty(cache).map_err(|err| err.to_string())?;
    fs::write(path, format!("{content}\n")).map_err(|err| err.to_string())
}

fn upsert_model_health_entry(cache: &mut ModelHealthCache, entry: ModelHealthEntry) {
    if let Some(existing) = cache.entries.iter_mut().find(|item| {
        item.api_base == entry.api_base
            && item.api_key_env == entry.api_key_env
            && item.model == entry.model
    }) {
        *existing = entry;
    } else {
        cache.entries.push(entry);
    }
}

fn current_unix_timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

fn provider_status(config: &ProviderConfig) -> ProviderStatus {
    let app_root = find_workspace_root().ok();
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
    }
}

fn normalize_provider_config(config: &mut ProviderConfig) -> bool {
    let mut changed = false;
    if config.active_profile_id.trim().is_empty() {
        config.active_profile_id = provider_profile_id(&config.api_key_env);
        changed = true;
    }
    if config.profiles.is_empty() {
        config.profiles.push(ProviderProfile {
            id: config.active_profile_id.clone(),
            name: provider_profile_name(&config.api_key_env, &config.model),
            note: provider_profile_note(&config.api_key_env),
            website: provider_profile_website(&config.api_key_env),
            provider: config.provider.clone(),
            model: config.model.clone(),
            api_base: config.api_base.clone(),
            api_key_env: config.api_key_env.clone(),
        });
        changed = true;
    }
    changed
}

fn upsert_provider_profile(profiles: &mut Vec<ProviderProfile>, profile: ProviderProfile) {
    if let Some(existing) = profiles.iter_mut().find(|item| item.id == profile.id) {
        *existing = profile;
    } else {
        profiles.push(profile);
    }
}

fn provider_profile_id(api_key_env: &str) -> String {
    api_key_env
        .trim()
        .to_lowercase()
        .trim_end_matches("_api_key")
        .replace('_', "-")
}

fn provider_profile_name(api_key_env: &str, model: &str) -> String {
    let name = api_key_env
        .trim()
        .trim_end_matches("_API_KEY")
        .replace('_', " ");
    if name.is_empty() {
        model.to_string()
    } else {
        name.split_whitespace()
            .map(|part| {
                let mut chars = part.chars();
                match chars.next() {
                    Some(first) => format!("{}{}", first.to_uppercase(), chars.as_str().to_lowercase()),
                    None => String::new(),
                }
            })
            .collect::<Vec<_>>()
            .join(" ")
    }
}

fn provider_profile_note(api_key_env: &str) -> String {
    match provider_profile_id(api_key_env).as_str() {
        "openai" => "OpenAI 官方账号".to_string(),
        "deepseek" => "DeepSeek 官方账号".to_string(),
        "dashscope" | "qwen" => "阿里百炼 / DashScope".to_string(),
        "gateway" => "公司或团队统一中转".to_string(),
        _ => String::new(),
    }
}

fn provider_profile_website(api_key_env: &str) -> String {
    match provider_profile_id(api_key_env).as_str() {
        "openai" => "https://platform.openai.com".to_string(),
        "deepseek" => "https://platform.deepseek.com".to_string(),
        "dashscope" | "qwen" => "https://dashscope.aliyun.com".to_string(),
        "gateway" => "https://your-gateway.example".to_string(),
        _ => String::new(),
    }
}

fn read_secret_from_env_or_dotenv(root: &Path, key: &str) -> Option<String> {
    if let Ok(value) = std::env::var(key) {
        if !value.trim().is_empty() {
            return Some(value);
        }
    }

    read_dotenv_value(root.join(".env.local"), key)
        .or_else(|| read_dotenv_value(root.join(".env"), key))
        .or_else(|| read_launchctl_env_value(key))
}

fn read_dotenv_value(path: PathBuf, key: &str) -> Option<String> {
    let content = fs::read_to_string(path).ok()?;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let Some((name, value)) = trimmed.split_once('=') else {
            continue;
        };
        if name.trim() == key {
            return Some(clean_dotenv_value(value));
        }
    }
    None
}

fn write_dotenv_value(root: &Path, key: &str, value: &str) -> Result<(), String> {
    let path = root.join(".env.local");
    let mut lines = fs::read_to_string(&path)
        .unwrap_or_else(|_| "# Local secrets only. This file is ignored by git.\n".to_string())
        .lines()
        .map(ToString::to_string)
        .collect::<Vec<_>>();
    let next_line = format!("{key}={}", escape_dotenv_value(value));
    let mut replaced = false;

    for line in &mut lines {
        let trimmed = line.trim_start();
        if trimmed.starts_with('#') {
            continue;
        }
        if let Some((name, _)) = trimmed.split_once('=') {
            if name.trim() == key {
                *line = next_line.clone();
                replaced = true;
                break;
            }
        }
    }

    if !replaced {
        if !lines.last().map(|line| line.is_empty()).unwrap_or(false) {
            lines.push(String::new());
        }
        lines.push(next_line);
    }

    fs::write(path, format!("{}\n", lines.join("\n"))).map_err(|err| err.to_string())
}

fn remove_dotenv_value(root: &Path, key: &str) -> Result<(), String> {
    let path = root.join(".env.local");
    let Ok(content) = fs::read_to_string(&path) else {
        return Ok(());
    };
    let lines = content
        .lines()
        .filter(|line| {
            let trimmed = line.trim_start();
            if trimmed.starts_with('#') {
                return true;
            }
            trimmed
                .split_once('=')
                .map(|(name, _)| name.trim() != key)
                .unwrap_or(true)
        })
        .map(ToString::to_string)
        .collect::<Vec<_>>();

    fs::write(path, format!("{}\n", lines.join("\n"))).map_err(|err| err.to_string())
}

fn escape_dotenv_value(value: &str) -> String {
    if value
        .chars()
        .any(|ch| ch.is_whitespace() || ch == '"' || ch == '\'' || ch == '#')
    {
        format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\""))
    } else {
        value.to_string()
    }
}

fn clean_dotenv_value(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.len() >= 2 {
        let first = trimmed.as_bytes()[0] as char;
        let last = trimmed.as_bytes()[trimmed.len() - 1] as char;
        if (first == '"' && last == '"') || (first == '\'' && last == '\'') {
            return trimmed[1..trimmed.len() - 1].to_string();
        }
    }
    trimmed.to_string()
}

fn read_launchctl_env_value(key: &str) -> Option<String> {
    let output = Command::new("launchctl")
        .args(["getenv", key])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

fn registry_path(app_root: &Path) -> PathBuf {
    app_root.join(".project-os/desktop-registry.json")
}

fn load_or_seed_registry(app_root: &Path) -> Result<RegistryFile, String> {
    let path = registry_path(app_root);
    if path.exists() {
        let content = fs::read_to_string(&path).map_err(|err| err.to_string())?;
        let registry: RegistryFile = serde_json::from_str(&content).map_err(|err| err.to_string())?;
        if !registry.projects.is_empty() {
            return Ok(registry);
        }
    }

    let state = read_json(app_root.join(".project-os/state.json"));
    let name = state
        .as_ref()
        .and_then(|json| json.get("name"))
        .and_then(Value::as_str)
        .or_else(|| app_root.file_name().and_then(|name| name.to_str()))
        .unwrap_or("workspace")
        .to_string();
    let phase = state
        .as_ref()
        .and_then(|json| json.get("phase"))
        .and_then(Value::as_str)
        .unwrap_or("unknown")
        .to_string();
    let current_path = app_root.display().to_string();
    let registry = RegistryFile {
        schema_version: "project-os.desktop-registry.v0.1".to_string(),
        current_project_id: "current".to_string(),
        projects: vec![RegistryFileProject {
            id: "current".to_string(),
            name,
            path: current_path,
            phase,
            name_locked: false,
        }],
    };
    save_registry(app_root, &registry)?;
    Ok(registry)
}

fn save_registry(app_root: &Path, registry: &RegistryFile) -> Result<(), String> {
    let path = registry_path(app_root);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    let content = serde_json::to_string_pretty(registry).map_err(|err| err.to_string())?;
    fs::write(path, format!("{content}\n")).map_err(|err| err.to_string())
}

fn current_registry_project(
    registry: &mut RegistryFile,
    app_root: &Path,
) -> Result<RegistryFileProject, String> {
    if let Some(project) = registry
        .projects
        .iter()
        .find(|project| project.id == registry.current_project_id)
    {
        return Ok(project.clone());
    }

    let fallback = registry
        .projects
        .first()
        .cloned()
        .ok_or_else(|| "registry 中没有项目".to_string())?;
    registry.current_project_id = fallback.id.clone();
    save_registry(app_root, registry)?;
    Ok(fallback)
}

fn registry_projects(registry: &RegistryFile) -> Vec<RegistryProject> {
    registry
        .projects
        .iter()
        .map(|project| {
            let (health, status_label) = project_health(project);
            RegistryProject {
                id: project.id.clone(),
                name: project.name.clone(),
                path: project.path.clone(),
                phase: project.phase.clone(),
                is_current: project.id == registry.current_project_id,
                health,
                status_label,
            }
        })
        .collect()
}

fn project_health(project: &RegistryFileProject) -> (String, String) {
    let root = PathBuf::from(&project.path);
    if !root.exists() || !root.is_dir() {
        return ("missing".to_string(), "路径失效".to_string());
    }
    let has_state = root.join(".project-os/state.json").is_file();
    let has_project = root.join("PROJECT.md").is_file();
    let has_handoff = root.join("HANDOFF.md").is_file();
    if has_state && has_project && has_handoff {
        return ("ready".to_string(), "已接入 · Project OS".to_string());
    }
    if has_state || has_project || has_handoff || root.join("AGENTS.md").is_file() {
        return ("partial".to_string(), "缺少关键文件".to_string());
    }
    ("external".to_string(), "未初始化 · 普通项目".to_string())
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

fn normalize_project_path(path: &str) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("请输入项目路径".to_string());
    }

    let expanded = if trimmed == "~" {
        std::env::var("HOME").map(PathBuf::from).map_err(|err| err.to_string())?
    } else if let Some(rest) = trimmed.strip_prefix("~/") {
        std::env::var("HOME")
            .map(|home| PathBuf::from(home).join(rest))
            .map_err(|err| err.to_string())?
    } else {
        PathBuf::from(trimmed)
    };

    expanded.canonicalize().map_err(|err| err.to_string())
}

fn project_id_from_path(path: &str) -> String {
    let mut id = String::from("project");
    for byte in path.as_bytes() {
        id.push_str(&format!("{:02x}", byte));
    }
    id
}

fn count_run_records(root: &Path) -> usize {
    let runs_dir = root.join(".project-os/runs");
    fs::read_dir(runs_dir)
        .ok()
        .into_iter()
        .flatten()
        .filter_map(Result::ok)
        .filter(|entry| {
            entry.path().extension().and_then(|ext| ext.to_str()) == Some("json")
        })
        .count()
}

fn count_workspace_files(root: &Path) -> (usize, usize) {
    let mut file_count = 0;
    let mut docs_count = 0;
    walk_counts(root, 0, &mut file_count, &mut docs_count);
    (file_count, docs_count)
}

fn walk_counts(path: &Path, depth: usize, file_count: &mut usize, docs_count: &mut usize) {
    if depth > 6 || is_ignored_path(path) {
        return;
    }

    let Ok(entries) = fs::read_dir(path) else {
        return;
    };

    for entry in entries.flatten() {
        let child = entry.path();
        if is_ignored_path(&child) {
            continue;
        }
        if child.is_dir() {
            walk_counts(&child, depth + 1, file_count, docs_count);
        } else {
            *file_count += 1;
            if child.extension().and_then(|ext| ext.to_str()) == Some("md") {
                *docs_count += 1;
            }
        }
    }
}

fn build_tree_preview(root: &Path) -> Vec<TreeItem> {
    let mut tree = vec![TreeItem {
        label: root
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("workspace")
            .to_string(),
        depth: 0,
        kind: "folder".to_string(),
    }];
    append_tree_preview(root, 1, &mut tree);
    tree
}

fn append_tree_preview(path: &Path, depth: usize, tree: &mut Vec<TreeItem>) {
    const MAX_TREE_ITEMS: usize = 180;
    const MAX_TREE_DEPTH: usize = 4;

    if depth > MAX_TREE_DEPTH || tree.len() >= MAX_TREE_ITEMS {
        return;
    }

    let Ok(entries) = fs::read_dir(path) else {
        return;
    };

    let mut entries = entries
        .flatten()
        .filter(|entry| !is_ignored_path(&entry.path()))
        .collect::<Vec<_>>();

    entries.sort_by(|a, b| {
        let a_is_dir = a.path().is_dir();
        let b_is_dir = b.path().is_dir();
        b_is_dir
            .cmp(&a_is_dir)
            .then_with(|| a.file_name().cmp(&b.file_name()))
    });

    for entry in entries {
        if tree.len() >= MAX_TREE_ITEMS {
            break;
        }
        let child = entry.path();
        let is_dir = child.is_dir();
        let Some(label) = child.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        tree.push(TreeItem {
            label: label.to_string(),
            depth,
            kind: if is_dir { "folder" } else { "file" }.to_string(),
        });
        if is_dir {
            append_tree_preview(&child, depth + 1, tree);
        }
    }
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
                        .unwrap_or("来自 Project OS 推荐引擎。")
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
                        .unwrap_or("来自 Project OS 任务池。")
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

fn is_ignored_path(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| {
            matches!(
                name,
                ".git" | "node_modules" | "target" | "dist" | ".DS_Store" | "__pycache__"
            )
        })
        .unwrap_or(false)
}

fn main() {
    tauri::Builder::default()
        .manage(TerminalState::default())
        .manage(WorkspaceWatcherState::default())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_workspace_snapshot,
            refresh_workspace_facts_preview,
            start_workspace_file_watcher,
            add_registry_project,
            switch_registry_project,
            rename_registry_project,
            relocate_registry_project,
            remove_registry_project,
            open_project_folder,
            chat_with_model,
            generate_readonly_plan,
            generate_patch_draft,
            apply_patch_draft,
            write_run_summary,
            merge_run_summary_to_handoff,
            list_desktop_tasks,
            save_desktop_task,
            run_goal_validation,
            sign_off_goal_validation,
            create_goal,
            switch_active_goal,
            confirm_goal,
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
            run_guarded_check,
            run_project_os_action,
            run_terminal_command,
            start_terminal_session,
            write_terminal_session,
            resize_terminal_session,
            stop_terminal_session
        ])
        .run(tauri::generate_context!())
        .expect("failed to run OmniDesk");
}
