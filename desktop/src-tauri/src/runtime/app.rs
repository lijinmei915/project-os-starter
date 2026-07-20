use crate::runtime::agent_runs::PersistedAgentRun;
use crate::runtime::patch::PatchDraft;
use crate::runtime::provider::{
    ModelCatalog, ModelHealthCache, ModelHealthEntry, ProviderConfig, ProviderProfile,
};
use base64::Engine;
use futures_util::StreamExt;
use notify::{
    Config as NotifyConfig, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher,
};
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Component, Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{mpsc, Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, State};
use tokio_util::sync::CancellationToken;

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
    access_mode: String,
    is_current: bool,
    health: String,
    status_label: String,
    task_count: usize,
    active_task_count: usize,
    failed_task_count: usize,
    completed_task_count: usize,
    latest_activity_at: String,
    latest_activity_title: String,
}

#[derive(Default)]
struct ProjectTaskSummary {
    task_count: usize,
    active_task_count: usize,
    failed_task_count: usize,
    completed_task_count: usize,
    latest_activity_at: String,
    latest_activity_title: String,
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
    #[serde(default = "default_project_access_mode")]
    access_mode: String,
}

fn default_project_access_mode() -> String {
    "browse".to_string()
}

fn normalize_project_access_mode(value: &str) -> String {
    match value.trim() {
        "governed" => "governed".to_string(),
        "controlled" => "controlled".to_string(),
        _ => "browse".to_string(),
    }
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
    runbook_commands: Value,
    project_capabilities: Value,
    fact_freshness: Value,
    goal_validation: Value,
    goal_validation_report: Value,
    goal_signoff_history: Value,
    goals: Value,
    project_goals: Value,
    trace: Vec<String>,
}

#[derive(Default)]
struct TerminalState {
    generation: Mutex<u64>,
    sessions: Mutex<HashMap<String, TerminalSession>>,
}

/// In-flight request ownership only. Conversations and task records stay persistent.
#[derive(Default)]
struct RuntimeRequestState {
    requests: Mutex<HashMap<String, CancellationToken>>,
}

fn emit_runtime_conversation_event(
    app: &AppHandle,
    request_id: &str,
    event_type: &str,
    phase: &str,
    status: &str,
    payload: Value,
) {
    if request_id.is_empty() {
        return;
    }
    let _ = app.emit(
        "runtime://conversation-event",
        json!({
            "schemaVersion": "omnidesk.conversation-event.v0.1",
            "id": format!("{}:{}:{}", request_id, event_type, current_timestamp_string()),
            "type": event_type,
            "phase": phase,
            "status": status,
            "actor": "assistant",
            "requestId": request_id,
            "timestamp": current_timestamp_string(),
            "payload": payload,
        }),
    );
}

impl RuntimeRequestState {
    fn start(&self, request_id: &str) -> CancellationToken {
        let token = CancellationToken::new();
        self.requests
            .lock()
            .unwrap()
            .insert(request_id.to_string(), token.clone());
        token
    }

    fn finish(&self, request_id: &str) {
        self.requests.lock().unwrap().remove(request_id);
    }

    fn cancel(&self, request_id: &str) -> bool {
        if let Some(token) = self.requests.lock().unwrap().get(request_id).cloned() {
            token.cancel();
            true
        } else {
            false
        }
    }
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

// portable-pty creates an isolated Unix session for each terminal. Killing
// only its shell leaves foreground tools (such as Codex) and their children
// alive, so closing a tab must terminate the PTY's whole foreground group.
fn terminate_terminal_session(session: &mut TerminalSession) {
    #[cfg(unix)]
    if let Some(group_leader) = session.master.process_group_leader() {
        if group_leader > 0 {
            // A negative PID targets the process group, which is isolated by
            // portable-pty's setsid call when the terminal was created.
            unsafe {
                libc::kill(-group_leader, libc::SIGKILL);
            }
        }
    }
    let _ = session.child.kill();
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

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ChatTurnInput {
    role: String,
    text: String,
}

#[derive(Default, Deserialize, Serialize, Clone)]
#[serde(default, rename_all = "camelCase")]
struct DialogueContextInput {
    current_topic: String,
    expected_next_action: String,
    last_intent: String,
    pending_question: String,
    previous_conclusion: String,
    user_delegation: String,
    task_id: String,
    task_title: String,
    task_status: String,
    task_goal: String,
    task_summary: String,
    task_next_action: String,
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
struct HermesExecutorStatus {
    id: String,
    protocol: String,
    status: String,
    version: String,
    message: String,
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
    #[serde(default)]
    references: Vec<MessageReference>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct MessageReference {
    kind: String,
    label: String,
    target: String,
    #[serde(default)]
    detail: String,
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

#[allow(dead_code)]
fn detected_project_capabilities(root: &Path) -> Value {
    let saved = read_json(root.join(".project-os/project-capabilities.json"));
    let saved_items = saved
        .as_ref()
        .and_then(|value| {
            value
                .get("workspaceCapabilities")
                .or_else(|| value.get("capabilities"))
        })
        .and_then(Value::as_array);
    let specs = [
        ("project-overview", "enabled", vec!["core"]),
        ("tasks", "enabled", vec!["core"]),
        ("files", "enabled", vec!["core"]),
        (
            "goals",
            if root.join(".project-os/goals.json").exists() {
                "detected"
            } else {
                "available"
            },
            vec![".project-os/goals.json"],
        ),
        (
            "rules",
            if root.join("AGENTS.md").exists() {
                "detected"
            } else {
                "available"
            },
            vec!["AGENTS.md"],
        ),
        (
            "design-implementation",
            if root.join("src").exists()
                || root.join("desktop").exists()
                || root.join("docs/ARCHITECTURE.md").exists()
            {
                "recommended"
            } else {
                "available"
            },
            vec!["src", "desktop", "docs/ARCHITECTURE.md"],
        ),
        (
            "validation-delivery",
            if root.join("tests").exists() || root.join("docs/TESTING.md").exists() {
                "recommended"
            } else {
                "available"
            },
            vec!["tests", "docs/TESTING.md"],
        ),
        (
            "knowledge-memory",
            if root.join("HANDOFF.md").exists() || root.join("docs/DECISIONS.md").exists() {
                "detected"
            } else {
                "available"
            },
            vec!["HANDOFF.md", "docs/DECISIONS.md"],
        ),
        (
            "agent-configuration",
            if root.join(".project-os/desktop-provider.json").exists()
                || root.join(".project-os/model-catalog.json").exists()
            {
                "detected"
            } else {
                "available"
            },
            vec![
                ".project-os/desktop-provider.json",
                ".project-os/model-catalog.json",
            ],
        ),
    ];
    let rank = |status: &str| match status {
        "enabled" => 3,
        "recommended" => 2,
        "detected" => 1,
        _ => 0,
    };
    let capabilities = specs.into_iter().map(|(id, detected_status, signals)| {
        let saved_item = saved_items.and_then(|items| items.iter().find(|item| item.get("id").and_then(Value::as_str) == Some(id)));
        let saved_status = saved_item.and_then(|item| item.get("status")).and_then(Value::as_str).unwrap_or("available");
        if saved_status == "dismissed" {
            return saved_item.cloned().unwrap();
        }
        if rank(saved_status) >= rank(detected_status) {
            return saved_item.cloned().unwrap_or_else(|| json!({ "id": id, "status": saved_status, "source": "migration" }));
        }
        let found_signals = signals.into_iter().filter(|signal| *signal == "core" || root.join(signal).exists()).collect::<Vec<_>>();
        json!({ "id": id, "status": detected_status, "source": if detected_status == "enabled" { "core" } else { "scan" }, "signals": found_signals })
    }).collect::<Vec<_>>();
    let package_text = read_text(root, "package.json") + &read_text(root, "desktop/package.json");
    let domain_specs = [
        (
            "frontend",
            root.join("src").exists()
                || package_text.contains("react")
                || package_text.contains("vue"),
            vec!["src", "desktop/package.json"],
        ),
        (
            "backend",
            root.join("server").exists()
                || root.join("backend").exists()
                || root.join("api").exists(),
            vec!["server", "backend", "api"],
        ),
        (
            "database",
            root.join("prisma").exists()
                || root.join("migrations").exists()
                || root.join("schema.sql").exists(),
            vec!["prisma", "migrations", "schema.sql"],
        ),
        (
            "desktop",
            root.join("desktop/src-tauri").exists() || root.join("src-tauri").exists(),
            vec!["desktop/src-tauri", "src-tauri"],
        ),
        ("cli", root.join("cli").exists(), vec!["cli"]),
        (
            "ai",
            root.join(".project-os/model-catalog.json").exists() || package_text.contains("openai"),
            vec![".project-os/model-catalog.json"],
        ),
        (
            "testing",
            root.join("tests").exists() || root.join("test").exists(),
            vec!["tests", "test"],
        ),
        (
            "deployment",
            root.join(".github/workflows").exists() || root.join("Dockerfile").exists(),
            vec![".github/workflows", "Dockerfile"],
        ),
    ];
    let domain_capabilities = domain_specs.into_iter().map(|(id, detected, signals)| json!({
        "id": id,
        "status": if detected { "detected" } else { "available" },
        "source": "scan",
        "signals": signals.into_iter().filter(|signal| root.join(signal).exists()).collect::<Vec<_>>()
    })).collect::<Vec<_>>();
    json!({
        "schemaVersion": "project-os.project-capabilities.v0.1",
        "updatedAt": saved.as_ref().and_then(|value| value.get("updatedAt")).and_then(Value::as_str).unwrap_or(""),
        "capabilities": capabilities.clone(),
        "workspaceCapabilities": capabilities,
        "domainCapabilities": domain_capabilities
    })
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
    let run_count = count_run_records(&root);
    let (file_count, docs_count) = count_workspace_files(&root);

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
    let report = build_workspace_facts_preview(&root, &current_project.name);
    crate::runtime::workspace::record_fact_freshness(&root, &current_timestamp_string())?;
    Ok(report)
}

fn should_ignore_watch_path(path: &Path) -> bool {
    let in_project_os = path
        .components()
        .any(|component| component.as_os_str() == ".project-os");
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
    if !in_project_os && !fact_file && !fact_directory {
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

#[cfg(test)]
fn sync_task_goal_index(
    root: &Path,
    task_id: &str,
    goal_id: &str,
    timestamp: &str,
) -> Result<(), String> {
    let goals_path = root.join(".project-os/goals.json");
    let Some(mut goals) = read_json(goals_path.clone()) else {
        return Ok(());
    };
    crate::runtime::goals::rebind_task(&mut goals, task_id, goal_id, timestamp);
    crate::runtime::repository::Repository::new(root).transaction(
        "sync-task-goal-index",
        &[crate::runtime::repository::JsonMutation::upsert(
            ".project-os/goals.json",
            goals,
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

    let matches_project = |project: &RegistryFileProject| {
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
        registry.projects.push(RegistryFileProject {
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
            "hasProjectOs": has(".project-os")
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
fn read_engineering_file(
    input: ReadEngineeringFileInput,
) -> Result<EngineeringFilePreview, String> {
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

fn compact_json_items(value: Option<&Value>, key: &str, limit: usize) -> Vec<String> {
    value
        .and_then(|item| item.get(key))
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(str::trim).filter(|text| !text.is_empty()))
                .take(limit)
                .map(String::from)
                .collect()
        })
        .unwrap_or_default()
}

fn chat_project_evidence(root: &Path, state: Option<&Value>) -> (Value, Vec<MessageReference>) {
    let project_status = state.and_then(|value| value.get("status")).or(state);
    let goals = read_json(root.join(".project-os/goals.json"));
    let active_goal_id = goals
        .as_ref()
        .and_then(|value| value.get("activeGoalId"))
        .and_then(Value::as_str)
        .unwrap_or("");
    let active_goal = goals
        .as_ref()
        .and_then(|value| value.get("goals"))
        .and_then(Value::as_array)
        .and_then(|items| {
            items
                .iter()
                .find(|item| item.get("id").and_then(Value::as_str) == Some(active_goal_id))
        });

    let mut task_items = Vec::new();
    if let Ok(entries) = fs::read_dir(crate::runtime::tasks::directory(root)) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|value| value.to_str()) != Some("json")
                || path.file_name().and_then(|value| value.to_str()) == Some("manifest.json")
            {
                continue;
            }
            if let Some(task) = read_json(path) {
                let status = task
                    .get("status")
                    .and_then(Value::as_str)
                    .unwrap_or("planned");
                if status != "done" {
                    task_items.push(json!({
                        "id": task.get("id").and_then(Value::as_str).unwrap_or(""),
                        "title": task.get("title").and_then(Value::as_str).unwrap_or("未命名任务"),
                        "status": status,
                        "updatedAt": task.get("updatedAt").and_then(Value::as_str).unwrap_or("")
                    }));
                }
            }
        }
    }
    task_items.sort_by(|a, b| {
        b.get("updatedAt")
            .and_then(Value::as_str)
            .unwrap_or("")
            .cmp(a.get("updatedAt").and_then(Value::as_str).unwrap_or(""))
    });
    task_items.truncate(8);

    let mut changed_files = git_changed_files(root).into_iter().collect::<Vec<_>>();
    changed_files.sort();
    changed_files.truncate(12);
    let validation = read_json(root.join(".project-os/goal-validation-report.json"));
    let validation_status = validation
        .as_ref()
        .and_then(|value| value.get("status"))
        .and_then(Value::as_str)
        .unwrap_or("not-run");

    let mut references = Vec::new();
    for (path, label) in [
        ("PROJECT.md", "项目状态"),
        ("HANDOFF.md", "当前交接"),
        (".project-os/task-backlog.json", "任务清单"),
        (".project-os/goal-validation-report.json", "验收报告"),
    ] {
        if root.join(path).is_file() {
            references.push(MessageReference {
                kind: "file".to_string(),
                label: label.to_string(),
                target: path.to_string(),
                detail: String::new(),
            });
        }
    }
    if let Some(task) = task_items.first() {
        if let (Some(id), Some(title)) = (
            task.get("id").and_then(Value::as_str),
            task.get("title").and_then(Value::as_str),
        ) {
            references.push(MessageReference {
                kind: "task".to_string(),
                label: title.to_string(),
                target: id.to_string(),
                detail: task
                    .get("status")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string(),
            });
        }
    }

    let evidence = json!({
        "phase": state.and_then(|value| value.get("phase")).and_then(Value::as_str).unwrap_or("unknown"),
        "stage": state.and_then(|value| value.get("stage")).and_then(Value::as_str).unwrap_or("unknown"),
        "doing": compact_json_items(project_status, "doing", 6),
        "blocked": compact_json_items(project_status, "blocked", 6),
        "activeGoal": active_goal.map(|goal| json!({
            "id": goal.get("id").and_then(Value::as_str).unwrap_or(""),
            "title": goal.get("shortTitle").and_then(Value::as_str)
                .or_else(|| goal.get("title").and_then(Value::as_str)).unwrap_or(""),
            "status": goal.get("status").and_then(Value::as_str).unwrap_or("")
        })),
        "activeTasks": task_items,
        "changedFiles": changed_files,
        "validationStatus": validation_status
    });
    (evidence, references)
}

fn chat_references_for_message(
    message: &str,
    context_state: &DialogueContextInput,
    references: Vec<MessageReference>,
) -> Vec<MessageReference> {
    if is_greeting_message(message) {
        return Vec::new();
    }
    let topic = format!("{} {}", context_state.current_topic, message);
    let preferred_labels: &[&str] = if topic.contains("风险") || topic.contains("验收") {
        &["当前交接", "任务清单", "验收报告"]
    } else if topic.contains("状态") || topic.contains("进度") || topic.contains("下一步") {
        &["项目状态", "当前交接", "任务清单"]
    } else if context_state.expected_next_action == "apply-fix" {
        &["任务清单", "当前交接"]
    } else {
        &["项目状态", "当前交接"]
    };
    let mut selected = references
        .iter()
        .filter(|reference| preferred_labels.contains(&reference.label.as_str()))
        .cloned()
        .collect::<Vec<_>>();
    if topic.contains("任务") || context_state.expected_next_action == "apply-fix" {
        if let Some(task) = references.iter().find(|reference| reference.kind == "task") {
            selected.push(task.clone());
        }
    }
    selected.truncate(4);
    selected
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
    let (project_evidence, all_evidence_references) = chat_project_evidence(&root, state.as_ref());
    let evidence_references =
        chat_references_for_message(&message, &input.context_state, all_evidence_references);

    if configured_provider.enabled {
        let (provider, provider_switch_note) = match prepare_provider_for_request(
            &app_root,
            &configured_provider,
            &HashSet::new(),
        )
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
                fallback.provider_status = crate::runtime::provider::classify_failure(&err).to_string();
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
        emit_runtime_conversation_event(
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
                emit_runtime_conversation_event(
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
                emit_runtime_conversation_event(
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
                emit_runtime_conversation_event(
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
                fallback.provider_status = crate::runtime::provider::classify_failure(&err).to_string();
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

    let mut fallback_context = PlanContext {
        task: task.clone(),
        attachments,
        project_name: project_name.clone(),
        stage: stage.clone(),
        root: root.clone(),
        recommendations,
        provider: configured_provider.clone(),
    };

    if configured_provider.enabled {
        let (provider, provider_switch_note) = match prepare_provider_for_request(
            &app_root,
            &configured_provider,
            &HashSet::new(),
        )
        .await
        {
            Ok(result) => result,
            Err(err) => {
                let mut plan = build_local_readonly_plan(fallback_context);
                plan.trace.push(format!("PROVIDER_PRECHECK_FAILED: {}", err));
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
                    plan.trace.push(format!("PROVIDER_SWITCH: {}", provider_switch_note));
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
    let goals = read_json(root.join(".project-os/goals.json"))
        .ok_or_else(|| "未找到目标列表".to_string())?;
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
        "schemaVersion": "project-os.goal-validation-report.v0.1",
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
    let files = extract_plan_files(plan, &root);
    if let Some(reason) = crate::runtime::patch::draft_ineligibility_reason(plan, &files) {
        if !request_id.is_empty() {
            runtime_requests.finish(&request_id);
        }
        return Ok(build_not_applicable_patch_draft(&title, &files, &reason));
    }
    let contexts = read_patch_context_files(&root, &files)?;

    if configured_provider.enabled {
        let (provider, provider_switch_note) = match prepare_provider_for_request(
            &app_root,
            &configured_provider,
            &HashSet::new(),
        )
        .await
        {
            Ok(result) => result,
            Err(err) => {
                if !request_id.is_empty() {
                    runtime_requests.finish(&request_id);
                }
                let mut draft = build_local_patch_draft(&title, &files, &contexts, &format!("Provider precheck: {}", err));
                draft.trace.push(format!("PROVIDER_PRECHECK_FAILED: {}", err));
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
            generate_hermes_structured_patch_draft(&provider, &root, &title, plan, &contexts, None, None)
                .await
        };
        let hermes_error = match hermes_result {
            Ok(mut draft) => {
                if !provider_switch_note.is_empty() {
                    draft.trace.push(format!("PROVIDER_SWITCH: {}", provider_switch_note));
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
                match generate_hermes_structured_patch_draft(&provider, &root, &title, plan, &contexts, Some(&err), None).await {
                    Ok(mut draft) => {
                        draft.trace.push("DRAFT_RETRY: Hermes accepted the regenerated draft".to_string());
                        if !provider_switch_note.is_empty() {
                            draft.trace.push(format!("PROVIDER_SWITCH: {}", provider_switch_note));
                        }
                        if !request_id.is_empty() { runtime_requests.finish(&request_id); }
                        return Ok(draft);
                    }
                    Err(retry_err) => format!("{}；重试失败：{}", err, retry_err),
                }
            },
        };
        let provider_result = if let Some(token) = token {
            tokio::select! {
                _ = token.cancelled() => Err("请求已取消".to_string()),
                result = generate_provider_patch_draft(&provider, &root, &title, plan, &contexts, Some(&hermes_error)) => result,
            }
        } else {
            generate_provider_patch_draft(&provider, &root, &title, plan, &contexts, Some(&hermes_error)).await
        };
        if !request_id.is_empty() {
            runtime_requests.finish(&request_id);
        }
        match provider_result {
            Ok(mut draft) => {
                if !provider_switch_note.is_empty() {
                    draft.trace.push(format!("PROVIDER_SWITCH: {}", provider_switch_note));
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
                let mut draft = build_local_patch_draft(&title, &files, &contexts, &format!("Hermes: {}; Provider: {}", hermes_error, err));
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
    Ok(build_local_patch_draft(&title, &files, &contexts, "未配置可用模型；这是不可应用的占位草稿。"))
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
        .map(|items| items.iter().filter_map(Value::as_str).map(ToString::to_string).collect::<Vec<_>>())
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
    let summary = build_run_summary_markdown(&task);
    crate::runtime::execution::append_run_summary(&root, &summary)?;

    Ok(RunSummaryResult {
        path: ".project-os/runs/desktop-summary.md".to_string(),
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
        candidate_changes
            .push("可能涉及 desktop/src/main.jsx 和 desktop/src/styles.css。".to_string());
        checks.push("cd desktop && npm run web:build".to_string());
    }

    if lower_task.contains("rust")
        || lower_task.contains("tauri")
        || lower_task.contains("core")
        || lower_task.contains("命令")
        || lower_task.contains("本地")
    {
        candidate_changes
            .push("可能涉及 desktop/src-tauri/src/main.rs 和 Tauri capability。".to_string());
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
            format!(
                "结合用户附带截图确认问题位置：{}",
                attachment_names.join("、")
            ),
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
        .ok_or_else(|| {
            format!(
                "环境变量或 .env.local 中未设置 {}",
                context.provider.api_key_env
            )
        })?;
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
        return Err(format!(
            "provider HTTP {}: {}",
            status,
            trim_for_trace(&body)
        ));
    }

    let chat: ChatCompletionsResponse = response.json().await.map_err(|err| err.to_string())?;
    let content = chat
        .choices
        .first()
        .map(|choice| choice.message.content.trim())
        .filter(|content| !content.is_empty())
        .ok_or_else(|| "provider 返回空内容".to_string())?;
    let mut plan: ReadonlyPlan =
        serde_json::from_str(content).map_err(|err| format!("provider JSON 解析失败: {}", err))?;

    plan.mode = "plan".to_string();
    plan.task = context.task.clone();
    plan.project_name = context.project_name.clone();
    plan.guardrails
        .push("真实 provider 已调用，但仍只生成计划，不执行写入。".to_string());
    plan.trace.push(format!(
        "PROVIDER_CALL: {} / {}",
        context.provider.provider, context.provider.model
    ));
    if !context.attachments.is_empty() {
        plan.trace
            .push(format!("VISION_ATTACHMENTS: {}", context.attachments.len()));
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
    retry_reason: Option<&str>,
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
    let prompt = patch_draft_prompt(title, plan, contexts, retry_reason);
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
        return Err(format!(
            "provider HTTP {}: {}",
            status,
            trim_for_trace(&body)
        ));
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
const HERMES_ACP_MAX_LINE_BYTES: usize = 1024 * 1024;

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
    let prompt = hermes_patch_draft_prompt(title, plan, contexts);
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

fn hermes_acp_program() -> Option<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(home) = std::env::var("HOME") {
        candidates.push(PathBuf::from(home).join(".local/bin/hermes-acp"));
    }
    candidates.push(PathBuf::from("hermes-acp"));
    candidates
        .into_iter()
        .find(|candidate| candidate.components().count() == 1 || candidate.is_file())
}

fn hermes_custom_provider_key_env(api_base: &str) -> Option<String> {
    let authority = api_base
        .trim()
        .split_once("://")
        .map(|(_, value)| value)
        .unwrap_or(api_base)
        .split('/')
        .next()
        .unwrap_or("")
        .split('@')
        .last()
        .unwrap_or("")
        .split(':')
        .next()
        .unwrap_or("");
    let mut labels = authority
        .split('.')
        .filter(|label| !label.is_empty())
        .collect::<Vec<_>>();
    while matches!(labels.first(), Some(&"api" | &"www")) {
        labels.remove(0);
    }
    let vendor = *labels.get(labels.len().checked_sub(2)?)?;
    let normalized = vendor
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() {
                ch.to_ascii_uppercase()
            } else {
                '_'
            }
        })
        .collect::<String>();
    if normalized.is_empty()
        || !normalized.starts_with(|ch: char| ch.is_ascii_alphabetic())
        || matches!(normalized.as_str(), "OPENAI" | "OPENROUTER" | "OLLAMA")
    {
        return None;
    }
    Some(format!("{}_API_KEY", normalized))
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

fn extract_structured_hermes_envelope(output: &str) -> Result<Value, String> {
    let normalized = output.replace("```json", "").replace("```", "");
    let start = normalized
        .find('{')
        .ok_or_else(|| "Hermes 未返回结构化 JSON envelope".to_string())?;
    let end = normalized
        .rfind('}')
        .ok_or_else(|| "Hermes JSON envelope 不完整".to_string())?;
    serde_json::from_str::<Value>(&normalized[start..=end])
        .map_err(|err| format!("Hermes envelope JSON 解析失败: {err}"))
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
                if let Some(path) = args.get("path").and_then(Value::as_str).filter(|path| is_patch_context_path(path)) {
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
    let result = match name {
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
                .map(|items| items.iter().filter_map(Value::as_str).map(ToString::to_string).collect::<Vec<_>>())
                .unwrap_or_default();
            crate::runtime::patch::validate_unified_diff_authorized(diff, &allowed_files)?;
            serde_json::to_value(apply_patch_draft(ApplyPatchDraftInput {
                task: json!({ "patchDraft": { "diff": diff, "allowedFiles": allowed_files } }),
            })?)
            .map_err(|err| err.to_string())?
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
            serde_json::to_value(run_guarded_check(RunGuardedCheckInput {
                check_id: check_id.to_string(),
            })?)
            .map_err(|err| err.to_string())?
        }
        _ => return Err(format!("不允许执行审批工具：{name}")),
    };
    run.status =
        if name == "run_check" && result.get("success").and_then(Value::as_bool) == Some(false) {
            "failed".to_string()
        } else {
            "succeeded".to_string()
        };
    run.step += 1;
    run.revision += 1;
    run.updated_at = current_timestamp_string();
    run.summary = format!("已执行审批工具：{name}");
    run.approval = None;
    run.approval_token.clear();
    crate::runtime::agent_runs::persist(&app_root, &run)?;
    Ok(result)
}

#[tauri::command]
async fn run_hermes_agent(
    input: RunHermesAgentInput,
    runtime_requests: State<'_, RuntimeRequestState>,
) -> Result<HermesAgentLoopResult, String> {
    let app_root = find_workspace_root()?;
    crate::runtime::agent_runs::recover_stale(&app_root, &current_timestamp_string())?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    let provider = load_or_seed_provider_config(&app_root)?;
    sync_hermes_runtime_config(&provider)?;
    let api_key = read_secret_from_env_or_dotenv(&root, &provider.api_key_env)
        .ok_or_else(|| format!("环境变量或 .env.local 中未设置 {}", provider.api_key_env))?;
    let request_id = input.request_id.trim().to_string();
    let run_id = if request_id.is_empty() {
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
    let base_run = crate::runtime::agent_runs::new_hermes_run(
        run_id.clone(),
        request_id.clone(),
        current_project.id.clone(),
        input.prompt.clone(),
        input.max_steps,
        input.approval_token.clone(),
        &now,
    );
    crate::runtime::agent_runs::persist(&app_root, &base_run)?;
    let mut running_run = base_run;
    running_run.status = "running".to_string();
    running_run.revision = 1;
    running_run.updated_at = current_timestamp_string();
    running_run.summary = "Hermes 正在读取上下文并形成结果。".to_string();
    let running_evidence_at = running_run.updated_at.clone();
    crate::runtime::agent_runs::append_evidence(
        &mut running_run,
        "draft",
        "Hermes 开始生成受控草稿。",
        json!({ "maxSteps": input.max_steps }),
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
            &input.prompt,
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
    let evidence_phase = if finished_run.status == "awaiting-approval" { "approval" } else { "result" };
    let evidence_details = result.as_ref().map(|value| json!({
        "step": value.step,
        "trace": value.trace,
        "observations": value.observations,
    })).unwrap_or_else(|error| json!({ "error": error.to_string() }));
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

fn hermes_write_request(
    stdin: &mut impl Write,
    id: u64,
    method: &str,
    params: Value,
) -> Result<(), String> {
    let message = json!({ "jsonrpc": "2.0", "id": id, "method": method, "params": params });
    serde_json::to_writer(&mut *stdin, &message).map_err(|err| err.to_string())?;
    stdin.write_all(b"\n").map_err(|err| err.to_string())?;
    stdin.flush().map_err(|err| err.to_string())
}

fn hermes_wait_for_response(
    receiver: &mpsc::Receiver<Result<String, String>>,
    stdin: &mut impl Write,
    expected_id: u64,
    deadline: Instant,
    agent_text: &mut String,
    cancellation: Option<&CancellationToken>,
) -> Result<Value, String> {
    loop {
        if cancellation.is_some_and(CancellationToken::is_cancelled) {
            return Err("请求已取消".to_string());
        }
        let remaining = deadline
            .checked_duration_since(Instant::now())
            .ok_or_else(|| "Hermes ACP 请求超时".to_string())?;
        let wait = remaining.min(Duration::from_millis(200));
        let line = match receiver.recv_timeout(wait) {
            Ok(line) => line?,
            Err(mpsc::RecvTimeoutError::Timeout) => continue,
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                return Err("Hermes ACP 请求超时或连接已关闭".to_string())
            }
        };
        if line.len() > HERMES_ACP_MAX_LINE_BYTES {
            return Err("Hermes ACP 返回行超出安全上限".to_string());
        }
        let message: Value = serde_json::from_str(&line)
            .map_err(|err| format!("Hermes ACP 返回无效 JSON-RPC: {err}"))?;
        if let Some(id) = message.get("id").and_then(Value::as_u64) {
            if message.get("method").is_some() {
                let rejection = hermes_rejection_response(id);
                serde_json::to_writer(&mut *stdin, &rejection).map_err(|err| err.to_string())?;
                stdin.write_all(b"\n").map_err(|err| err.to_string())?;
                stdin.flush().map_err(|err| err.to_string())?;
                continue;
            }
            if id == expected_id {
                if let Some(error) = message.get("error") {
                    return Err(format!(
                        "Hermes ACP RPC 错误: {}",
                        trim_for_trace(&error.to_string())
                    ));
                }
                return Ok(message);
            }
        }
        if message.get("method").and_then(Value::as_str) == Some("session/update") {
            if let Some(text) = message
                .pointer("/params/update/content/text")
                .and_then(Value::as_str)
            {
                agent_text.push_str(text);
            }
        }
    }
}

fn hermes_rejection_response(id: u64) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "result": { "outcome": { "outcome": "cancelled" } }
    })
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

    let endpoint = chat_completions_endpoint(&provider.api_base);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(45))
        .build()
        .map_err(|err| err.to_string())?;
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
            "temperature": 0.45,
            "stream": true
        }))
        .send()
        .await
        .map_err(|err| err.to_string())?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!(
            "provider HTTP {}: {}",
            status,
            trim_for_trace(&body)
        ));
    }

    let is_sse = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.contains("text/event-stream"))
        .unwrap_or(false);
    let content = if !is_sse {
        let chat: ChatCompletionsResponse = response.json().await.map_err(|err| err.to_string())?;
        chat.choices
            .first()
            .map(|choice| choice.message.content.trim().to_string())
            .filter(|content| !content.is_empty())
            .ok_or_else(|| "provider 返回空内容".to_string())?
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
                emit_runtime_conversation_event(
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

/// Consumes only complete SSE lines so transport chunk boundaries cannot corrupt model JSON.
fn consume_openai_sse_deltas(pending: &mut String, chunk: &str) -> Vec<String> {
    pending.push_str(chunk);
    let mut deltas = Vec::new();
    while let Some(index) = pending.find('\n') {
        let line = pending[..index].trim().to_string();
        pending.drain(..=index);
        let Some(data) = line.strip_prefix("data:") else {
            continue;
        };
        let data = data.trim();
        if data == "[DONE]" {
            continue;
        }
        let event: Value = match serde_json::from_str(data) {
            Ok(event) => event,
            Err(_) => continue,
        };
        let delta = event
            .pointer("/choices/0/delta/content")
            .and_then(Value::as_str)
            .unwrap_or("");
        if !delta.is_empty() {
            deltas.push(delta.to_string());
        }
    }
    deltas
}

/// Extracts the visible `reply` string from an incomplete model JSON envelope.
/// The model still has to return valid JSON before its final result is accepted.
fn streaming_reply_prefix(content: &str) -> String {
    let Some(key_index) = content.find("\"reply\"") else {
        return String::new();
    };
    let Some((_, value)) = content[key_index + "\"reply\"".len()..].split_once(':') else {
        return String::new();
    };
    let Some(value) = value.trim_start().strip_prefix('"') else {
        return String::new();
    };

    let mut reply = String::new();
    let mut escaped = false;
    for character in value.chars() {
        if escaped {
            match character {
                'n' => reply.push('\n'),
                'r' => reply.push('\r'),
                't' => reply.push('\t'),
                '"' => reply.push('"'),
                '\\' => reply.push('\\'),
                other => reply.push(other),
            }
            escaped = false;
        } else if character == '\\' {
            escaped = true;
        } else if character == '"' {
            break;
        } else {
            reply.push(character);
        }
    }
    reply
}

fn chat_router_prompt(
    project_name: &str,
    stage: &str,
    current_model: &str,
    message: &str,
    attachments: &[PlanAttachment],
    recent_turns: &[ChatTurnInput],
    context_state: &DialogueContextInput,
    summary: &Value,
    project_memory: &[Value],
    project_evidence: &Value,
) -> String {
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
    let history = recent_turns
        .iter()
        .take(8)
        .map(|turn| format!("{}: {}", turn.role, trim_for_trace(&turn.text)))
        .collect::<Vec<_>>()
        .join("\n");
    let context_json = serde_json::to_string(context_state).unwrap_or_else(|_| "{}".to_string());
    let summary_json = serde_json::to_string(summary).unwrap_or_else(|_| "{}".to_string());
    let memory_json = serde_json::to_string(project_memory).unwrap_or_else(|_| "[]".to_string());
    let evidence_json =
        serde_json::to_string_pretty(project_evidence).unwrap_or_else(|_| "{}".to_string());
    format!(
        r#"Current project: {project_name}
Current stage: {stage}
Current configured model: {current_model}
{attachment_note}

Dialogue context state:
{context_json}

Earlier conversation summary:
{summary_json}

Confirmed project memory (may guide collaboration constraints; do not treat it as live file evidence):
{memory_json}

Recent conversation:
{history}

Verified local project evidence:
{evidence_json}

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
- Treat short follow-ups such as "那怎么办", "你判断", "直接告诉我", and "直接修" as continuations of currentTopic and previousConclusion. Do not ask the user to repeat the subject when contextState identifies it.
- For project questions, answer from verified local project evidence. State the conclusion first, then cite concrete evidence in the prose, then give the smallest useful next action.
- If evidence is insufficient for a claim, label it as an inference instead of presenting it as fact.
- Greetings, small talk, broad questions, or "what is X" shouldCreatePlan=false.
- Questions that ask "why", "how", "what risks", "what happened", "is this ok", or "look at this" shouldCreatePlan=false and should receive a natural answer.
- Set shouldCreatePlan=true when the user clearly asks OmniDesk to solve, handle, organize, clean up, make a plan, create a task, apply a patch, run commands/checks, or implement/fix code.
- Phrases like "帮我处理", "处理一下", "看看解决", "整理一下", "制定方案", "侧边栏这么多待办你看看解决呢" are action requests even if they contain question-like words.
- If the user asks what model you are, mention the current configured model exactly.
- If shouldCreatePlan=true, reply should briefly acknowledge that you will create a plan.
- If shouldCreatePlan=false, do not suggest generating a plan, clicking buttons, or asking for confirmation unless the user's request is ambiguous.
- Do not tell the user to inspect another page instead of answering when the evidence above already supports an answer.
- Do not invent completed work.
- Do not mention internal JSON or routing.
"#
    )
}

fn local_chat_result(
    message: &str,
    has_attachments: bool,
    context_state: &DialogueContextInput,
    project_evidence: &Value,
) -> ChatWithModelResult {
    let should_create_plan = should_create_plan_for_message(message, has_attachments);
    let topic = if context_state.current_topic.trim().is_empty() {
        message
    } else {
        context_state.current_topic.as_str()
    };
    let risk_question = message.contains("风险") || topic.contains("风险");
    let active_task_count = project_evidence
        .get("activeTasks")
        .and_then(Value::as_array)
        .map(Vec::len)
        .unwrap_or(0);
    let changed_file_count = project_evidence
        .get("changedFiles")
        .and_then(Value::as_array)
        .map(Vec::len)
        .unwrap_or(0);
    let validation_status = project_evidence
        .get("validationStatus")
        .and_then(Value::as_str)
        .unwrap_or("not-run");
    let current_focus = project_evidence
        .get("activeTasks")
        .and_then(Value::as_array)
        .and_then(|tasks| tasks.first())
        .and_then(|task| task.get("title"))
        .and_then(Value::as_str)
        .unwrap_or("当前最高优先级任务");
    ChatWithModelResult {
        reply: if should_create_plan {
            "可以，我整理成一个可执行计划。".to_string()
        } else if is_greeting_message(message) {
            "你好，我在。".to_string()
        } else if context_state.expected_next_action == "recommend-next" {
            format!(
                "建议按这个顺序处理：先推进「{}」；然后运行目标验收并处理失败项；最后审阅剩余 Git 变更，确认是否可以交付。",
                current_focus
            )
        } else if context_state.expected_next_action == "decide-next" {
            format!(
                "我判断先推进「{}」。它是当前最直接的阻塞点，完成后立即运行目标验收，再决定是否处理其他风险。",
                current_focus
            )
        } else if is_question_like_message(message) || !context_state.current_topic.is_empty() {
            if risk_question {
                format!(
                    "当前可确认的风险有三项：还有 {} 个活跃或待确认任务；Git 工作区有 {} 个变更文件；目标验收状态为 {}。建议先处理失败或进行中的任务，再运行目标验收，最后确认剩余 Git 变更是否属于本轮交付。",
                    active_task_count, changed_file_count, validation_status
                )
            } else {
                format!(
                    "继续回答「{}」：{}",
                    topic,
                    if context_state.previous_conclusion.is_empty() {
                        "当前本地证据还不足以给出更具体结论。"
                    } else {
                        context_state.previous_conclusion.as_str()
                    }
                )
            }
        } else {
            "可以，继续说。".to_string()
        },
        should_create_plan,
        intent: if should_create_plan { "task" } else { "chat" }.to_string(),
        provider_status: "local".to_string(),
        provider_model: String::new(),
        provider_error: String::new(),
        references: Vec::new(),
    }
}

fn is_greeting_message(message: &str) -> bool {
    let normalized = message
        .trim()
        .trim_matches(|ch: char| {
            ch.is_ascii_punctuation() || ch.is_whitespace() || "。！？!，,".contains(ch)
        })
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
        "为什么",
        "怎么",
        "哪些",
        "还有哪些",
        "是什么",
        "吗",
        "呢",
        "咋回事",
        "看一下",
        "看看",
        "风险",
        "问题在哪",
        "自然吗",
        "正常吗",
        "why",
        "how",
        "what",
        "which",
        "risk",
        "risks",
    ]
    .iter()
    .any(|keyword| text.contains(keyword))
}

fn is_task_like_message(message: &str) -> bool {
    let text = message.trim().to_lowercase();
    [
        "帮我改",
        "帮我修",
        "帮我优化",
        "帮我生成",
        "帮我创建",
        "帮我新增",
        "帮我删除",
        "帮我执行",
        "帮我跑",
        "开始执行",
        "生成计划",
        "创建任务",
        "改代码",
        "修复",
        "实现",
        "接入",
        "配置",
        "做成",
        "设计",
        "重构",
        "提交",
        "推送",
        "帮我处理",
        "处理一下",
        "解决一下",
        "看看解决",
        "看下解决",
        "整理一下",
        "梳理一下",
        "制定方案",
        "出个方案",
        "给个方案",
        "整理待办",
        "处理方案",
        "commit",
        "push",
        "build",
        "apply patch",
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

fn read_patch_context_files(
    root: &Path,
    files: &[String],
) -> Result<Vec<(String, String)>, String> {
    let mut contexts = Vec::new();
    for relative in files {
        let path = root.join(relative);
        let content =
            fs::read_to_string(&path).map_err(|err| format!("读取 {} 失败: {}", relative, err))?;
        let trimmed = content.chars().take(12000).collect::<String>();
        contexts.push((relative.clone(), trimmed));
    }
    Ok(contexts)
}

fn build_local_patch_draft(
    title: &str,
    files: &[String],
    contexts: &[(String, String)],
    failure_reason: &str,
) -> PatchDraft {
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
        allowed_files: files.to_vec(),
        context_files: contexts.iter().map(|(path, _)| path.clone()).collect(),
        draft_attempt: 1,
        failure_reason: failure_reason.to_string(),
        not_applicable: false,
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

fn build_not_applicable_patch_draft(title: &str, files: &[String], reason: &str) -> PatchDraft {
    PatchDraft {
        summary: format!("「{}」暂不生成文件改动：{}", title, reason),
        diff: String::new(),
        files: files.to_vec(),
        allowed_files: files.to_vec(),
        context_files: Vec::new(),
        draft_attempt: 0,
        failure_reason: reason.to_string(),
        not_applicable: true,
        guardrails: vec![
            "该任务当前不具备可应用的工程改动，不会调用模型生成占位 diff。".to_string(),
            "先运行检查或调整计划后，才可能生成受控 Patch。".to_string(),
        ],
        trace: vec!["PATCH_SEMANTIC_GATE: not-applicable".to_string()],
    }
}

fn patch_draft_prompt(
    title: &str,
    plan: &Value,
    contexts: &[(String, String)],
    retry_reason: Option<&str>,
) -> String {
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
  "allowedFiles": ["relative/path"],
  "contextFiles": ["relative/path"],
  "guardrails": ["string"],
  "trace": ["string"]
}}

Rules:
- Return a unified diff draft, but do not claim it has been applied.
- Only modify files included in FILE CONTEXT.
- If the context is insufficient, return a small placeholder diff and explain the missing context in summary.
- Do not include secrets, API keys, or .env content.
- Prefer small, reviewable changes.
- Every changed file requires a complete --- a/path / +++ b/path header and at least one context line.
- Do not create, delete, or rename files.

Task title: {}
Plan JSON:
{}

FILE CONTEXT:
{}

{} 
"#,
        title,
        serde_json::to_string_pretty(plan).unwrap_or_else(|_| "{}".to_string()),
        context_text,
        retry_reason.map(|reason| format!("REGENERATION REASON (fix it without expanding scope): {reason}")).unwrap_or_default()
    )
}

#[allow(dead_code)]
fn hermes_patch_draft_prompt(title: &str, plan: &Value, contexts: &[(String, String)]) -> String {
    let context_text = contexts
        .iter()
        .map(|(path, content)| format!("--- FILE: {} ---\n{}", path, content))
        .collect::<Vec<_>>()
        .join("\n\n");
    format!(
        r#"You are a read-only patch-draft generator inside OmniDesk.

Return exactly one unified diff and no markdown fence or explanation.

Hard boundaries:
- Do not write, delete, rename, or create files.
- Do not run commands, open a terminal, call external tools, browse, or make network requests.
- Use only the supplied FILE CONTEXT. Do not read any other project file.
- Modify only files listed in FILE CONTEXT. Never output .env, credentials, provider config, or secret values.
- If no safe diff is possible, return no diff. OmniDesk will treat that as a failed draft.

Task title: {}
Plan JSON:
{}

FILE CONTEXT:
{}"#,
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
        return Err(format!(
            "模型列表请求失败 HTTP {}: {}",
            status,
            trim_for_trace(&body)
        ));
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
        schema_version: "project-os.desktop-provider.v0.1".to_string(),
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

    let endpoint = chat_completions_endpoint(&provider.api_base);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(45))
        .build()
        .map_err(|err| err.to_string())?;
    let response = client
        .post(endpoint)
        .bearer_auth(api_key)
        .json(&json!({
            "model": provider.model,
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
        return Err(format!(
            "模型测试失败 HTTP {}: {}",
            status,
            trim_for_trace(&body)
        ));
    }

    let chat: ChatCompletionsResponse = response.json().await.map_err(|err| err.to_string())?;
    let content = chat
        .choices
        .first()
        .map(|choice| choice.message.content.trim())
        .filter(|content| !content.is_empty())
        .ok_or_else(|| "模型返回为空".to_string())?;

    Ok(ProviderModelTestResult {
        model: provider.model.clone(),
        success: true,
        message: format!("{} 可用：{}", provider.model, trim_for_trace(content)),
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

fn provider_for_profile(config: &ProviderConfig, profile: &ProviderProfile) -> ProviderConfig {
    ProviderConfig {
        schema_version: config.schema_version.clone(),
        provider: profile.provider.clone(),
        model: profile.model.clone(),
        api_base: profile.api_base.clone(),
        api_key_env: profile.api_key_env.clone(),
        enabled: config.enabled,
        active_profile_id: profile.id.clone(),
        profiles: config.profiles.clone(),
    }
}

fn model_health_is_fresh(entry: &ModelHealthEntry) -> bool {
    let Ok(checked_at) = entry.checked_at.parse::<u64>() else {
        return false;
    };
    let now = current_unix_timestamp().parse::<u64>().unwrap_or(0);
    now >= checked_at && now - checked_at <= 60
}

fn health_entry_for<'a>(health: &'a ModelHealthCache, provider: &ProviderConfig) -> Option<&'a ModelHealthEntry> {
    health.entries.iter().find(|entry| {
        entry.api_base == provider.api_base
            && entry.api_key_env == provider.api_key_env
            && entry.model == provider.model
    })
}

fn record_provider_failure(app_root: &Path, provider: &ProviderConfig, message: &str) -> Result<(), String> {
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
    let mut candidates = vec![(configured.active_profile_id.clone(), configured.clone())];
    candidates.extend(
        configured
            .profiles
            .iter()
            .filter(|profile| profile.id != configured.active_profile_id)
            .map(|profile| (profile.id.clone(), provider_for_profile(configured, profile))),
    );
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
        if let Some(entry) = health_entry_for(&health, &candidate) {
            if model_health_is_fresh(entry) {
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
        if failures.is_empty() { "未找到可用 profile".to_string() } else { failures.join("；") }
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
fn get_hermes_executor_status() -> HermesExecutorStatus {
    let candidate_paths = |program: &str| {
        let mut paths = Vec::new();
        if let Ok(home) = std::env::var("HOME") {
            paths.push(PathBuf::from(home).join(".local/bin").join(program));
        }
        paths.push(PathBuf::from(program));
        paths
    };

    for program in candidate_paths("hermes-acp") {
        match Command::new(&program).arg("--check").output() {
            Ok(output) if output.status.success() => {
                let version_output = Command::new(&program).arg("--version").output().ok();
                let version = version_output
                    .map(|value| {
                        trim_runner_output(&format!(
                            "{}{}",
                            String::from_utf8_lossy(&value.stdout),
                            String::from_utf8_lossy(&value.stderr)
                        ))
                    })
                    .unwrap_or_default();
                return HermesExecutorStatus {
                    id: "hermes".to_string(),
                    protocol: "acp".to_string(),
                    status: "ready".to_string(),
                    version,
                    message: "Hermes ACP 通道检查通过；模型凭据仍需通过实际请求验证。".to_string(),
                };
            }
            Ok(output) => {
                let detail = trim_runner_output(&format!(
                    "{}{}",
                    String::from_utf8_lossy(&output.stdout),
                    String::from_utf8_lossy(&output.stderr)
                ));
                return HermesExecutorStatus {
                    id: "hermes".to_string(),
                    protocol: "acp".to_string(),
                    status: "unavailable".to_string(),
                    version: String::new(),
                    message: format!("检测到 Hermes ACP，但健康检查未通过：{}", detail),
                };
            }
            Err(_) => continue,
        }
    }

    for program in candidate_paths("hermes") {
        let output = Command::new(&program).arg("--version").output();
        if let Ok(output) = output {
            let version = trim_runner_output(&format!(
                "{}{}",
                String::from_utf8_lossy(&output.stdout),
                String::from_utf8_lossy(&output.stderr)
            ));
            return HermesExecutorStatus {
                id: "hermes".to_string(),
                protocol: "cli".to_string(),
                status: "cli-only".to_string(),
                version,
                message: "已检测到 Hermes CLI；ACP 健康检查通过前不能接入受控执行。".to_string(),
            };
        }
    }
    HermesExecutorStatus {
        id: "hermes".to_string(),
        protocol: "acp".to_string(),
        status: "not-installed".to_string(),
        version: String::new(),
        message: "未检测到 Hermes。安装并完成模型配置后，OmniDesk 才能将它作为可选执行器使用。"
            .to_string(),
    }
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

    if matches!(
        input.action_id.as_str(),
        "scan" | "recommend" | "report" | "prune"
    ) {
        let action = crate::runtime::governance::execute(&root, &app_root, &input.action_id, &[])?;
        let result = ProjectOsActionResult {
            id: action.id,
            label: action.label,
            command: action.command,
            success: action.success,
            code: action.code,
            output: action.output,
        };
        let _ = crate::runtime::execution::append_audit(
            &root,
            "governance-action",
            result.success,
            json!({ "actionId": result.id }),
            &current_timestamp_string(),
        );
        return Ok(result);
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

    let result = ProjectOsActionResult {
        id: spec.id.to_string(),
        label: spec.label.to_string(),
        command: spec.command,
        success: output.status.success(),
        code: output.status.code(),
        output: combined,
    };
    let _ = crate::runtime::execution::append_audit(
        &root,
        "governance-action",
        result.success,
        json!({ "actionId": result.id }),
        &current_timestamp_string(),
    );
    Ok(result)
}

#[tauri::command]
fn save_terminal_image(input: SaveTerminalImageInput) -> Result<String, String> {
    let app_root = find_workspace_root()?;
    let mut registry = load_or_seed_registry(&app_root)?;
    let current_project = current_registry_project(&mut registry, &app_root)?;
    let root = PathBuf::from(&current_project.path);
    let extension = Path::new(&input.name)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("png")
        .to_ascii_lowercase();
    if !matches!(
        extension.as_str(),
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg"
    ) {
        return Err("终端图片只支持 PNG、JPG、GIF、WebP 或 SVG".to_string());
    }
    let (mime, encoded) = input
        .data_url
        .split_once(",")
        .ok_or_else(|| "图片数据格式无效".to_string())?;
    if !mime.starts_with("data:image/") {
        return Err("终端只接受图片数据".to_string());
    }
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .map_err(|err| format!("图片解码失败：{err}"))?;
    if bytes.len() > 8 * 1024 * 1024 {
        return Err("终端图片不能超过 8 MB".to_string());
    }
    let dir = crate::runtime::state_namespace::state_path_for_write(
        &root,
        ".project-os/tmp/terminal-images",
    )?;
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    let safe_name: String = input
        .name
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '.' | '-' | '_'))
        .collect();
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|err| err.to_string())?
        .as_millis();
    let file_name = format!(
        "omnidesk-image-{stamp}.{}",
        if safe_name.is_empty() {
            extension.clone()
        } else {
            extension
        }
    );
    let path = dir.join(file_name);
    fs::write(&path, bytes).map_err(|err| err.to_string())?;
    Ok(path.to_string_lossy().to_string())
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
            terminate_terminal_session(&mut existing);
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
    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|err| err.to_string())?;
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
        terminate_terminal_session(&mut session);
    }
    Ok(())
}

#[cfg(feature = "webdriver")]
#[tauri::command]
fn record_native_terminal_trace(stage: String) -> Result<(), String> {
    const ALLOWED_STAGES: &[&str] = &[
        "terminal-session.start-before",
        "terminal-session.start-complete",
        "terminal-session.start-error",
        "terminal-session.effect-start",
        "terminal-session.output-subscribed",
        "terminal-session.effect-error",
        "terminal-session.effect-cleanup",
        "terminal-dock.mount",
        "terminal-dock.xterm-created",
        "terminal-dock.xterm-opened",
        "terminal-dock.initial-focus-start",
        "terminal-dock.initial-focus-complete",
        "terminal-dock.initial-focus-error",
        "terminal-dock.fit-start",
        "terminal-dock.fit-complete",
        "terminal-dock.fit-error",
        "terminal-dock.active-effect",
        "terminal-dock.active-focus-start",
        "terminal-dock.active-focus-complete",
        "terminal-dock.active-focus-error",
        "terminal-dock.cleanup",
    ];
    if !ALLOWED_STAGES.contains(&stage.as_str()) {
        return Err("WebDriver terminal trace stage is not allowed".to_string());
    }

    let root = find_workspace_root()?;
    let path = crate::runtime::state_namespace::state_path_for_write(
        &root,
        ".project-os/native-terminal-trace.json",
    )?;
    let mut entries = fs::read_to_string(&path)
        .ok()
        .and_then(|content| serde_json::from_str::<Vec<Value>>(&content).ok())
        .unwrap_or_default();
    if entries
        .iter()
        .any(|entry| entry.get("stage").and_then(Value::as_str) == Some(stage.as_str()))
    {
        return Ok(());
    }
    entries.push(json!({ "at": current_timestamp_string(), "stage": stage }));
    if entries.len() > 30 {
        entries.drain(..entries.len() - 30);
    }
    fs::write(
        &path,
        serde_json::to_vec(&entries).map_err(|err| err.to_string())?,
    )
    .map_err(|err| err.to_string())
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
            args: vec![
                "scripts/check-doc-structure.sh".to_string(),
                ".".to_string(),
            ],
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

fn run_git_apply(
    root: &Path,
    diff: &str,
    check_only: bool,
) -> Result<std::process::Output, String> {
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

    Err("未找到 Project OS 工作区根目录".to_string())
}

fn read_json(path: PathBuf) -> Option<Value> {
    let resolved = crate::runtime::state_namespace::state_path_from_absolute(&path).ok()?;
    fs::read_to_string(resolved)
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
    let section = markdown_section(
        project_md,
        &["项目简介", "项目介绍", "概览", "Overview", "Summary"],
    );
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
        markdown_section(
            &product_plan,
            &["项目简介", "产品简介", "Project", "Overview"],
        ),
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

fn runbook_commands(root: &Path) -> Value {
    let mut commands = Vec::new();
    for relative in ["package.json", "desktop/package.json"] {
        let Some(package_json) = read_json(root.join(relative)) else {
            continue;
        };
        let Some(script_map) = package_json.get("scripts").and_then(Value::as_object) else {
            continue;
        };
        for key in ["dev", "web:dev", "web:build", "build", "test", "lint"] {
            if !script_map.contains_key(key) {
                continue;
            }
            let command = if relative == "package.json" {
                format!("npm run {}", key)
            } else {
                format!("npm --prefix desktop run {}", key)
            };
            let (label, kind) = match key {
                "dev" | "web:dev" => (
                    if key == "web:dev" {
                        "Web 开发预览"
                    } else {
                        "开发启动"
                    },
                    "start",
                ),
                "build" | "web:build" => (
                    if key == "web:build" {
                        "Web 构建"
                    } else {
                        "项目构建"
                    },
                    "check",
                ),
                "test" => ("测试", "check"),
                "lint" => ("代码检查", "check"),
                _ => (key, "check"),
            };
            commands.push(json!({ "id": format!("{}:{}", relative, key), "label": label, "command": command, "kind": kind, "source": relative }));
        }
    }
    if root.join("desktop/src-tauri/Cargo.toml").exists() {
        commands.push(json!({ "id": "desktop:cargo-check", "label": "桌面壳检查", "command": "cargo check --manifest-path desktop/src-tauri/Cargo.toml", "kind": "check", "source": "desktop/src-tauri/Cargo.toml" }));
    }
    if root.join("scripts/check-runtime.sh").exists() {
        commands.push(json!({ "id": "governance:runtime", "label": "治理检查", "command": "bash scripts/check-runtime.sh .", "kind": "check", "source": "scripts/check-runtime.sh" }));
    }
    json!(commands)
}

fn package_identity(root: &Path) -> (String, String) {
    for relative in ["package.json", "desktop/package.json"] {
        let Some(package_json) = read_json(root.join(relative)) else {
            continue;
        };
        let name = package_json
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .trim()
            .to_string();
        let version = package_json
            .get("version")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .trim()
            .to_string();
        if !name.is_empty() || !version.is_empty() {
            return (name, version);
        }
    }
    (String::new(), String::new())
}

fn dependency_summary(root: &Path) -> Vec<String> {
    let mut dependencies = Vec::new();
    for relative in ["package.json", "desktop/package.json"] {
        let Some(package_json) = read_json(root.join(relative)) else {
            continue;
        };
        for key in ["dependencies", "devDependencies"] {
            if let Some(items) = package_json.get(key).and_then(Value::as_object) {
                dependencies.extend(items.keys().cloned());
            }
        }
    }
    if root.join("desktop/src-tauri/Cargo.toml").exists() || root.join("Cargo.toml").exists() {
        dependencies.push("Rust crates".to_string());
    }
    dependencies.sort();
    dependencies.dedup();
    dependencies.truncate(10);
    dependencies
}

fn project_directory_summary(root: &Path) -> Vec<String> {
    let candidates = [
        ".project-os",
        "src",
        "desktop",
        "cli",
        "assets",
        "docs",
        "schemas",
        "scripts",
        "tests",
        "templates",
    ];
    candidates
        .iter()
        .filter(|name| root.join(name).exists())
        .map(|name| (*name).to_string())
        .collect()
}

fn project_created_at(root: &Path) -> String {
    Command::new("git")
        .arg("-C")
        .arg(root)
        .args(["log", "--reverse", "--format=%cs"])
        .output()
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .and_then(|text| text.lines().next().map(str::trim).map(str::to_string))
        .unwrap_or_default()
}

fn detected_stack(root: &Path) -> Vec<String> {
    let mut stack = Vec::new();
    if root.join("desktop/src-tauri/Cargo.toml").exists()
        || root.join("src-tauri/Cargo.toml").exists()
    {
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
        if deps
            .iter()
            .any(|name| name == "react" || name == "react-dom")
        {
            stack.push("React".to_string());
        }
        if deps
            .iter()
            .any(|name| name == "vite" || name == "@vitejs/plugin-react")
        {
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
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("");
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

fn push_domain_file(
    domains: &mut HashMap<&'static str, Vec<String>>,
    domain: &'static str,
    file: &str,
) {
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

fn governance_file_statuses(
    root: &Path,
    changed: &HashSet<String>,
    files: &[String],
) -> Vec<Value> {
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
        let status = item
            .get("status")
            .and_then(Value::as_str)
            .unwrap_or("found");
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
        governance_domain_json(
            root,
            &changed,
            &classified,
            "project-identity",
            "项目概览",
            "项目身份、定位、类型和生命周期。",
            vec![
                "PROJECT.md",
                "README.md",
                ".project-os/project-profile.json",
                ".project-os/state.json",
            ],
            "项目定位、类型、阶段或工作区状态变化时自动刷新。",
        ),
        governance_domain_json(
            root,
            &changed,
            &classified,
            "current-progress",
            "当前进度",
            "最近完成、当前推进和下一步。",
            vec![
                "HANDOFF.md",
                "PROJECT.md",
                ".project-os/goals.json",
                ".project-os/state.json",
            ],
            "目标任务、交接记录或 git 状态变化时自动刷新。",
        ),
        governance_domain_json(
            root,
            &changed,
            &classified,
            "runbook",
            "启动方式",
            "启动、构建、验证和常用脚本。",
            vec![
                "package.json",
                "desktop/package.json",
                "docs/RUNBOOK.md",
                "desktop/README.md",
            ],
            "package scripts、运行说明或桌面端配置变化时自动刷新。",
        ),
        governance_domain_json(
            root,
            &changed,
            &classified,
            "risk-boundary",
            "风险边界",
            "不可随意改动的约束、风险和协作边界。",
            vec![
                "HANDOFF.md",
                "PROJECT.md",
                ".project-os/project-profile.json",
            ],
            "协作规则、风险说明或项目档案变化时自动刷新。",
        ),
        governance_domain_json(
            root,
            &changed,
            &classified,
            "local-state",
            "本地状态",
            "Git、本地工作区、运行状态和 Project OS 状态。",
            vec![
                ".project-os/state.json",
                ".project-os/runs/",
                ".project-os/desktop-registry.json",
            ],
            "文件变更、git 状态或 Project OS 运行状态变化时自动刷新。",
        ),
        governance_domain_json(
            root,
            &changed,
            &classified,
            "design-implementation",
            "设计实现",
            "架构、界面规范、数据契约和实现结构。",
            vec![
                "docs/ARCHITECTURE.md",
                "docs/DESIGN_STANDARDS.md",
                "schemas/*",
                "desktop/src/*",
            ],
            "架构、设计 token、schema 或源码入口变化时自动刷新。",
        ),
        governance_domain_json(
            root,
            &changed,
            &classified,
            "engineering-assets",
            "工程资产",
            "源码、脚本、模板和适配器。",
            vec![
                "desktop/src/*",
                "desktop/src-tauri/*",
                "scripts/*",
                "templates/*",
            ],
            "源码、脚本、模板或适配器文件变化时自动刷新。",
        ),
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
        scripts.contains("test")
            || scripts.contains("lint")
            || !profile.check_commands.trim().is_empty(),
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
        (
            "projectIdentity",
            "项目身份",
            project_identity,
            "项目名、定位、生命周期和项目档案完整度。",
        ),
        (
            "engineeringFiles",
            "工程文件",
            engineering_files,
            "关键文件识别和治理域覆盖情况。",
        ),
        (
            "runValidation",
            "启动验证",
            run_validation,
            "启动、构建、测试或检查命令识别情况。",
        ),
        (
            "riskBoundary",
            "风险边界",
            risk_boundary_score,
            "风险说明、权限边界和协作规则完整度。",
        ),
        (
            "continuousGovernance",
            "持续治理",
            continuous_governance,
            "本地状态、运行记录和 CI/定期扫描入口。",
        ),
    ];
    let total = (dimensions
        .iter()
        .map(|(_, _, score, _)| *score)
        .sum::<i32>() as f32
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
    let (package_name, package_version) = package_identity(root);
    let dependencies = dependency_summary(root);
    let directories = project_directory_summary(root);
    let created_at = project_created_at(root);
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
        profile_field_value(
            &read_json(root.join(".project-os/project-profile.json")),
            "memory.risks",
        ),
        "老项目默认只读扫描，用户确认前不修改工程文件。".to_string(),
    ]);
    let local_state = format!(
        "{} {}",
        git_status,
        if root.join(".project-os").exists() {
            "已发现 .project-os 工作区状态。"
        } else {
            "未发现 .project-os 工作区状态。"
        }
    );
    let health_score = build_health_score(
        root,
        &profile,
        &overview,
        &scripts,
        &risk_boundary,
        &governance_domains,
    );
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
            "id": if package_name.is_empty() { project_name } else { &package_name },
            "path": root.display().to_string(),
            "kind": profile_field_value(&read_json(root.join(".project-os/project-profile.json")), "identity.type"),
            "version": package_version,
            "createdAt": created_at,
            "detectedStack": stack,
            "dependencies": dependencies,
            "directories": directories,
            "coreCapabilities": profile_field_value(&read_json(root.join(".project-os/project-profile.json")), "product.coreValue"),
            "owner": profile_field_value(&read_json(root.join(".project-os/project-profile.json")), "project.owner"),
            "milestone": json_string_value(&state_json, "/stage"),
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

fn provider_config_path(app_root: &Path) -> PathBuf {
    crate::runtime::state_namespace::state_path_for_read(
        app_root,
        ".project-os/desktop-provider.json",
    )
    .unwrap_or_else(|_| app_root.join(".project-os/desktop-provider.json"))
}

fn desktop_theme_path(app_root: &Path) -> PathBuf {
    crate::runtime::state_namespace::state_path_for_read(app_root, ".project-os/desktop-theme.json")
        .unwrap_or_else(|_| app_root.join(".project-os/desktop-theme.json"))
}

fn write_file_atomic(path: &Path, content: &[u8]) -> Result<(), String> {
    crate::runtime::repository::write_atomic(path, content)
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

fn load_or_seed_model_catalog(app_root: &Path) -> Result<ModelCatalog, String> {
    crate::runtime::provider::load_or_seed_catalog(app_root)
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
        let config: DesktopThemeConfig =
            serde_json::from_str(&content).map_err(|err| err.to_string())?;
        let normalized = normalize_desktop_theme(config);
        save_desktop_theme_file(app_root, &normalized)?;
        return Ok(normalized);
    }

    let config = default_desktop_theme();
    save_desktop_theme_file(app_root, &config)?;
    Ok(config)
}

fn save_desktop_theme_file(app_root: &Path, config: &DesktopThemeConfig) -> Result<(), String> {
    crate::runtime::repository::Repository::new(app_root).transaction(
        "save-desktop-theme",
        &[crate::runtime::repository::JsonMutation::upsert(
            ".project-os/desktop-theme.json",
            serde_json::to_value(config).map_err(|err| err.to_string())?,
        )],
    )?;
    Ok(())
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
        && !config
            .accents
            .iter()
            .any(|item| item.id == config.accent.id)
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
    let next = render_hermes_runtime_config(&current, config)?;
    if next != current {
        write_file_atomic(&path, next.as_bytes())
            .map_err(|err| format!("同步 Hermes 配置失败: {err}"))?;
    }
    Ok(())
}

fn render_hermes_runtime_config(current: &str, config: &ProviderConfig) -> Result<String, String> {
    // Hermes resolves custom-endpoint credentials through its named provider
    // registry. The registry entry holds only `key_env`, never the key itself.
    let provider = serde_json::to_string("omnidesk-gateway").map_err(|err| err.to_string())?;
    let base_url = serde_json::to_string(config.api_base.trim()).map_err(|err| err.to_string())?;
    let api_mode = serde_json::to_string("chat_completions").map_err(|err| err.to_string())?;
    let model = serde_json::to_string(config.model.trim()).map_err(|err| err.to_string())?;
    let key_env =
        serde_json::to_string(config.api_key_env.trim()).map_err(|err| err.to_string())?;
    let runtime_fields = vec![
        format!("  provider: {provider}"),
        format!("  base_url: {base_url}"),
        format!("  api_mode: {api_mode}"),
        format!("  default: {model}"),
        format!("  key_env: {key_env}"),
    ];
    let mut lines = current.lines().map(ToString::to_string).collect::<Vec<_>>();
    let section_start = lines.iter().position(|line| line.trim() == "model:");
    match section_start {
        Some(start) => {
            let end = lines
                .iter()
                .enumerate()
                .skip(start + 1)
                .find_map(|(index, line)| {
                    let trimmed = line.trim();
                    (!trimmed.is_empty()
                        && !line.chars().next().is_some_and(char::is_whitespace)
                        && !trimmed.starts_with('#'))
                    .then_some(index)
                })
                .unwrap_or(lines.len());
            let mut preserved = lines[start + 1..end]
                .iter()
                .filter(|line| {
                    let key = line.trim_start();
                    ![
                        "provider:",
                        "base_url:",
                        "api_mode:",
                        "default:",
                        "key_env:",
                        "api_key_env:",
                    ]
                    .iter()
                    .any(|prefix| key.starts_with(prefix))
                })
                .cloned()
                .collect::<Vec<_>>();
            lines.splice(
                start + 1..end,
                runtime_fields.into_iter().chain(preserved.drain(..)),
            );
        }
        None => {
            let mut section = vec!["model:".to_string()];
            section.extend(runtime_fields);
            section.push(String::new());
            section.extend(lines);
            lines = section;
        }
    }
    upsert_hermes_gateway_provider(&mut lines, &base_url, &model, &api_mode, &key_env);
    Ok(format!("{}\n", lines.join("\n").trim_end()))
}

fn upsert_hermes_gateway_provider(
    lines: &mut Vec<String>,
    base_url: &str,
    model: &str,
    api_mode: &str,
    key_env: &str,
) {
    let provider_fields = vec![
        format!("    base_url: {base_url}"),
        format!("    default_model: {model}"),
        format!("    api_mode: {api_mode}"),
        format!("    key_env: {key_env}"),
    ];
    let providers_start = match lines.iter().position(|line| line.trim() == "providers:") {
        Some(index) => index,
        None => {
            if !lines.is_empty() && !lines.last().is_some_and(|line| line.trim().is_empty()) {
                lines.push(String::new());
            }
            lines.push("providers:".to_string());
            lines.push("  omnidesk-gateway:".to_string());
            lines.extend(provider_fields);
            return;
        }
    };
    let providers_end = lines
        .iter()
        .enumerate()
        .skip(providers_start + 1)
        .find_map(|(index, line)| {
            let trimmed = line.trim();
            (!trimmed.is_empty()
                && !trimmed.starts_with('#')
                && !line.chars().next().is_some_and(char::is_whitespace))
            .then_some(index)
        })
        .unwrap_or(lines.len());
    let gateway_start = (providers_start + 1..providers_end).find(|index| {
        let line = &lines[*index];
        line.starts_with("  ") && !line.starts_with("   ") && line.trim() == "omnidesk-gateway:"
    });
    let Some(gateway_start) = gateway_start else {
        let mut entry = vec!["  omnidesk-gateway:".to_string()];
        entry.extend(provider_fields);
        lines.splice(providers_end..providers_end, entry);
        return;
    };
    let gateway_end = (gateway_start + 1..providers_end)
        .find(|index| {
            let line = &lines[*index];
            !line.trim().is_empty()
                && !line.trim().starts_with('#')
                && line.starts_with("  ")
                && !line.starts_with("   ")
        })
        .unwrap_or(providers_end);
    let mut preserved = lines[gateway_start + 1..gateway_end]
        .iter()
        .filter(|line| {
            let key = line.trim_start();
            ![
                "base_url:",
                "default_model:",
                "api_mode:",
                "key_env:",
                "api_key_env:",
            ]
            .iter()
            .any(|prefix| key.starts_with(prefix))
        })
        .cloned()
        .collect::<Vec<_>>();
    lines.splice(
        gateway_start + 1..gateway_end,
        provider_fields.into_iter().chain(preserved.drain(..)),
    );
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

fn isolated_provider_key_env(base: &str, profile_id: &str) -> String {
    let suffix = profile_id
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() {
                ch.to_ascii_uppercase()
            } else {
                '_'
            }
        })
        .collect::<String>()
        .trim_matches('_')
        .to_string();
    let base = base.trim().trim_end_matches('_');
    format!(
        "{}_{}",
        if base.is_empty() {
            "OMNIDESK_API_KEY"
        } else {
            base
        },
        if suffix.is_empty() {
            "PROFILE"
        } else {
            suffix.as_str()
        }
    )
}

fn isolate_duplicate_provider_secrets(
    app_root: &Path,
    config: &mut ProviderConfig,
) -> Result<bool, String> {
    let mut used = std::collections::HashSet::new();
    let mut changed = false;
    for profile in &mut config.profiles {
        if used.insert(profile.api_key_env.clone()) {
            continue;
        }
        let previous_env = profile.api_key_env.clone();
        let mut next_env = isolated_provider_key_env(&previous_env, &profile.id);
        let mut index = 2;
        while used.contains(&next_env) {
            next_env = format!(
                "{}_{}",
                isolated_provider_key_env(&previous_env, &profile.id),
                index
            );
            index += 1;
        }
        crate::runtime::provider::migrate_secret(app_root, &previous_env, &next_env)?;
        if config.active_profile_id == profile.id {
            config.api_key_env = next_env.clone();
        }
        profile.api_key_env = next_env.clone();
        used.insert(next_env);
        changed = true;
    }
    Ok(changed)
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
                    Some(first) => {
                        format!("{}{}", first.to_uppercase(), chars.as_str().to_lowercase())
                    }
                    None => String::new(),
                }
            })
            .collect::<Vec<_>>()
            .join(" ")
    }
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

fn registry_path(app_root: &Path) -> PathBuf {
    crate::runtime::state_namespace::state_path_for_read(
        app_root,
        ".project-os/desktop-registry.json",
    )
    .unwrap_or_else(|_| app_root.join(".project-os/desktop-registry.json"))
}

fn load_or_seed_registry(app_root: &Path) -> Result<RegistryFile, String> {
    let path = registry_path(app_root);
    if path.exists() {
        let content = fs::read_to_string(&path).map_err(|err| err.to_string())?;
        let registry: RegistryFile =
            serde_json::from_str(&content).map_err(|err| err.to_string())?;
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
            access_mode: default_project_access_mode(),
        }],
    };
    save_registry(app_root, &registry)?;
    Ok(registry)
}

fn save_registry(app_root: &Path, registry: &RegistryFile) -> Result<(), String> {
    crate::runtime::repository::Repository::new(app_root).transaction(
        "save-registry",
        &[crate::runtime::repository::JsonMutation::upsert(
            ".project-os/desktop-registry.json",
            serde_json::to_value(registry).map_err(|err| err.to_string())?,
        )],
    )?;
    Ok(())
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
            let summary = project_task_summary(&PathBuf::from(&project.path));
            RegistryProject {
                id: project.id.clone(),
                name: project.name.clone(),
                path: project.path.clone(),
                phase: project.phase.clone(),
                access_mode: normalize_project_access_mode(&project.access_mode),
                is_current: project.id == registry.current_project_id,
                health,
                status_label,
                task_count: summary.task_count,
                active_task_count: summary.active_task_count,
                failed_task_count: summary.failed_task_count,
                completed_task_count: summary.completed_task_count,
                latest_activity_at: summary.latest_activity_at,
                latest_activity_title: summary.latest_activity_title,
            }
        })
        .collect()
}

fn project_task_summary(root: &Path) -> ProjectTaskSummary {
    let task_dir = crate::runtime::tasks::directory(root);
    let Ok(entries) = fs::read_dir(task_dir) else {
        return ProjectTaskSummary::default();
    };
    let mut summary = ProjectTaskSummary::default();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) != Some("json")
            || path.file_name().and_then(|value| value.to_str()) == Some("manifest.json")
        {
            continue;
        }
        let Some(task) = read_json(path) else {
            continue;
        };
        summary.task_count += 1;
        match task.get("status").and_then(Value::as_str).unwrap_or("") {
            "done" => summary.completed_task_count += 1,
            "failed" => summary.failed_task_count += 1,
            _ => summary.active_task_count += 1,
        }
        let activity_at = task
            .get("updatedAt")
            .and_then(Value::as_str)
            .or_else(|| task.get("createdAt").and_then(Value::as_str))
            .unwrap_or("");
        if activity_at > summary.latest_activity_at.as_str() {
            summary.latest_activity_at = activity_at.to_string();
            summary.latest_activity_title = task
                .get("title")
                .and_then(Value::as_str)
                .unwrap_or("任务更新")
                .to_string();
        }
    }
    summary
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
        std::env::var("HOME")
            .map(PathBuf::from)
            .map_err(|err| err.to_string())?
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
        .filter(|entry| entry.path().extension().and_then(|ext| ext.to_str()) == Some("json"))
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
                ".git"
                    | ".project-os"
                    | "node_modules"
                    | "target"
                    | "dist"
                    | "build"
                    | "tmp"
                    | ".cache"
                    | ".next"
                    | ".nuxt"
                    | ".vite"
                    | ".turbo"
                    | "coverage"
                    | ".DS_Store"
                    | "__pycache__"
            )
                || (name.starts_with(".env") && name != ".env.example")
        })
        .unwrap_or(false)
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
    fn workspace_tree_hides_runtime_and_generated_assets() {
        let dir = test_directory("tree-asset-policy");
        fs::create_dir_all(dir.join("src")).unwrap();
        fs::create_dir_all(dir.join(".project-os/events")).unwrap();
        fs::create_dir_all(dir.join("tmp")).unwrap();
        fs::create_dir_all(dir.join("target")).unwrap();
        fs::write(dir.join("src/main.rs"), "fn main() {}\n").unwrap();
        fs::write(dir.join(".env.local"), "SECRET=local\n").unwrap();
        fs::write(dir.join(".env.example"), "SECRET=\n").unwrap();

        let labels = build_tree_preview(&dir)
            .into_iter()
            .map(|item| item.label)
            .collect::<Vec<_>>();

        assert!(labels.contains(&"src".to_string()));
        assert!(labels.contains(&".env.example".to_string()));
        assert!(!labels.contains(&".project-os".to_string()));
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
        let rejection = hermes_rejection_response(42);
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
        let candidate = provider_for_profile(&config, &fallback);
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
                ("403 Forbidden", r#"{"error":{"message":"subscription quota insufficient"}}"#),
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
            id: "tw".to_string(), name: "TW Gateway".to_string(), note: String::new(), website: String::new(),
            provider: "openai-compatible".to_string(), model: "primary".to_string(),
            api_base: format!("http://{}", address), api_key_env: "TW_KEY".to_string(),
        };
        let fallback = ProviderProfile {
            id: "qy".to_string(), name: "QY".to_string(), note: String::new(), website: String::new(),
            provider: "openai-compatible".to_string(), model: "fallback".to_string(),
            api_base: format!("http://{}", address), api_key_env: "QY_KEY".to_string(),
        };
        let config = ProviderConfig {
            schema_version: "project-os.desktop-provider.v0.1".to_string(),
            provider: primary.provider.clone(), model: primary.model.clone(), api_base: primary.api_base.clone(),
            api_key_env: primary.api_key_env.clone(), enabled: true, active_profile_id: primary.id.clone(),
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
        assert!(health.entries.iter().any(|entry| entry.status == "quota-exhausted"));
        assert!(health.entries.iter().any(|entry| entry.status == "available"));
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
        let rendered = render_hermes_runtime_config(current, &config).unwrap();
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
        let rendered = render_hermes_runtime_config(current, &config).unwrap();
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
    fn sse_delta_parser_handles_transport_splits_and_completion_marker() {
        let mut pending = String::new();
        assert!(consume_openai_sse_deltas(
            &mut pending,
            "data: {\"choices\":[{\"delta\":{\"content\":\"hel"
        )
        .is_empty());
        assert_eq!(
            consume_openai_sse_deltas(&mut pending, "lo\"}}]}\n\ndata: {\"choices\":[{\"delta\":{\"content\":\" world\"}}]}\n\ndata: [DONE]\n\n"),
            vec!["hello".to_string(), " world".to_string()]
        );
        assert!(pending.is_empty());
    }

    #[test]
    fn extracts_reply_prefix_from_partial_model_json() {
        assert_eq!(streaming_reply_prefix(r#"{"reply": "正在生成"#), "正在生成");
        assert_eq!(
            streaming_reply_prefix(r#"{"reply": "第一行\n第二行", "intent": "chat"}"#),
            "第一行\n第二行"
        );
        assert_eq!(streaming_reply_prefix(r#"{"intent": "chat"}"#), "");
    }

    #[test]
    fn task_goal_index_moves_a_task_to_its_current_goal() {
        let root = test_directory("task-goal-index");
        let project_os = root.join(".project-os");
        fs::create_dir_all(&project_os).unwrap();
        fs::write(
            project_os.join("goals.json"),
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

        let goals = read_json(project_os.join("goals.json")).unwrap();
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
            approve_agent_run,
            execute_approved_agent_tool,
            run_guarded_check,
            get_hermes_executor_status,
            run_project_os_action,
            start_terminal_session,
            save_terminal_image,
            write_terminal_session,
            resize_terminal_session,
            stop_terminal_session,
            #[cfg(feature = "webdriver")]
            record_native_terminal_trace
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
    let repository = crate::runtime::repository::Repository::new(root);
    if let Err(error) = repository.recover_incomplete_transactions() {
        eprintln!("OmniDesk 状态事务恢复失败（{}）：{}", root.display(), error);
        return;
    }
    match crate::runtime::state_namespace::ensure_active_state_namespace(root) {
        Ok(outcome) if !outcome.conflicts.is_empty() => {
            eprintln!(
                "OmniDesk 状态迁移存在 {} 个冲突，继续使用旧命名空间（{}）",
                outcome.conflicts.len(),
                root.display()
            );
        }
        Ok(_) => {
            if let Err(error) =
                crate::runtime::repository::Repository::new(root).recover_incomplete_transactions()
            {
                eprintln!(
                    "OmniDesk 新状态事务恢复失败（{}）：{}",
                    root.display(),
                    error
                );
            }
        }
        Err(error) => {
            eprintln!("OmniDesk 状态迁移失败（{}）：{}", root.display(), error);
        }
    }
}
