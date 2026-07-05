#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};
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
    title: String,
    status: String,
    body: String,
    tone: String,
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
    trace: Vec<String>,
}

#[derive(Default)]
struct TerminalState {
    sessions: Mutex<HashMap<String, TerminalSession>>,
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
struct RenameRegistryProjectInput {
    id: String,
    name: String,
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
    shell: String,
    running: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TerminalOutputEvent {
    session_id: String,
    data: String,
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
    let run_count = count_run_records(&root);
    let (file_count, docs_count) = count_workspace_files(&root);

    let project_name = current_project.name.clone();
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

    let mut queue = recommendation_queue(&recommendations);
    if queue.is_empty() {
        queue.push(QueueItem {
            title: "接入本地项目 registry".to_string(),
            status: "建议下一步".to_string(),
            body: "让桌面工作台记住已接入项目，并作为后续模型计划层的入口。".to_string(),
            tone: "blue".to_string(),
        });
    }

    Ok(WorkspaceSnapshot {
        project_name: project_name.clone(),
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
fn add_registry_project(path: String) -> Result<WorkspaceSnapshot, String> {
    let app_root = find_workspace_root()?;
    let project_root = normalize_project_path(&path)?;
    if !project_root.exists() || !project_root.is_dir() {
        return Err("项目路径不存在或不是目录".to_string());
    }

    let mut registry = load_or_seed_registry(&app_root)?;
    let project_path = project_root.display().to_string();
    let state = read_json(project_root.join(".project-os/state.json"));
    let name = state
        .as_ref()
        .and_then(|json| json.get("name"))
        .and_then(Value::as_str)
        .or_else(|| project_root.file_name().and_then(|name| name.to_str()))
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
        project.name = name;
        project.path = project_path;
        project.phase = phase;
    } else {
        registry.projects.push(RegistryFileProject {
            id: id.clone(),
            name,
            path: project_path,
            phase,
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
                fallback.reply = format!("{}（模型暂时不可用：{}）", fallback.reply, err);
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
        "# Desktop Run Summary\n\n> Project OS Desktop 自动生成的任务摘要。\n\n".to_string()
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

> 来源：Project OS Desktop 用户确认合并。

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
                    "content": "You are Project OS Desktop Local Agent Core. Return only strict JSON matching the requested schema. Do not include markdown."
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
                    "content": "You are Project OS Desktop Local Agent Core. Return only strict JSON. Do not include markdown fences."
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
    let router_prompt = chat_router_prompt(project_name, stage, message, attachments);
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

fn chat_router_prompt(project_name: &str, stage: &str, message: &str, attachments: &[PlanAttachment]) -> String {
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
- Only set shouldCreatePlan=true when the user clearly asks OmniDesk to modify files, generate a plan, create a task, apply a patch, run commands/checks, or implement/fix code.
- If shouldCreatePlan=true, reply should briefly acknowledge that you will create a plan.
- Do not invent completed work.
- Do not mention internal JSON or routing.
"#
    )
}

fn local_chat_result(message: &str, has_attachments: bool) -> ChatWithModelResult {
    let should_create_plan = should_create_plan_for_message(message, has_attachments);
    ChatWithModelResult {
        reply: if should_create_plan {
            "可以。我先整理下一步，等你确认后再动手。".to_string()
        } else if is_greeting_message(message) {
            "你好，我在。你可以直接问项目情况，也可以说想改哪里。".to_string()
        } else if is_question_like_message(message) {
            if message.contains("风险") {
                "主要风险有三类：交接记录可能继续膨胀；对话和执行状态容易混在一起；模型或检查失败时反馈还不够像人话。建议先把普通问答和执行任务分开，再打磨失败提示。".to_string()
            } else {
                "我先直接回答这个问题；需要我动手时，再说“生成计划”或“帮我改”。".to_string()
            }
        } else {
            "我在。你可以继续问，也可以直接说想让我改哪里。".to_string()
        },
        should_create_plan,
        intent: if should_create_plan { "task" } else { "chat" }.to_string(),
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
    if is_question_like_message(message) {
        return false;
    }
    is_task_like_message(message) || has_attachments
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

fn provider_config_path(app_root: &Path) -> PathBuf {
    app_root.join(".project-os/desktop-provider.json")
}

fn model_catalog_path(app_root: &Path) -> PathBuf {
    app_root.join(".project-os/model-catalog.json")
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
    let preferred = [
        ("docs", "folder", 1),
        ("docs/DESKTOP_APP.md", "file", 2),
        ("desktop", "folder", 1),
        ("desktop/src", "folder", 2),
        ("desktop/src/main.jsx", "file", 3),
        ("desktop/src-tauri", "folder", 2),
        ("PROJECT.md", "file", 1),
        ("HANDOFF.md", "file", 1),
    ];

    let mut tree = vec![TreeItem {
        label: root
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("workspace")
            .to_string(),
        depth: 0,
        kind: "folder".to_string(),
    }];

    for (relative, kind, depth) in preferred {
        if root.join(relative).exists() {
            tree.push(TreeItem {
                label: Path::new(relative)
                    .file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or(relative)
                    .to_string(),
                depth,
                kind: kind.to_string(),
            });
        }
    }

    tree
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
                .map(|item| QueueItem {
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
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_workspace_snapshot,
            add_registry_project,
            switch_registry_project,
            rename_registry_project,
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
            get_model_catalog,
            get_desktop_theme,
            save_desktop_theme,
            get_provider_status,
            save_provider_config,
            save_provider_secret,
            probe_provider_models,
            test_provider_model,
            read_engineering_file,
            run_guarded_check,
            run_terminal_command,
            start_terminal_session,
            write_terminal_session,
            resize_terminal_session,
            stop_terminal_session
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Project OS Desktop");
}
