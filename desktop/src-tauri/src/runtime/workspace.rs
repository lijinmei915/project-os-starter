use crate::runtime::repository::{JsonMutation, Repository};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::UNIX_EPOCH;

const STATE_PATH: &str = ".omnidesk/data/state.json";
const CAPABILITIES_PATH: &str = ".omnidesk/data/project-capabilities.json";
const MEMORY_PATH: &str = ".omnidesk/data/memory.json";
const PROFILE_PATH: &str = ".omnidesk/data/project-profile.json";
const BACKLOG_PATH: &str = ".omnidesk/data/task-backlog.json";
const FACT_FRESHNESS_PATH: &str = ".omnidesk/cache/fact-freshness.json";
const GOALS_PATH: &str = ".omnidesk/data/goals.json";
const PROVIDER_PATH: &str = ".omnidesk/data/desktop-provider.json";
const MODEL_CATALOG_PATH: &str = ".omnidesk/data/model-catalog.json";
const REGISTRY_PATH: &str = ".omnidesk/data/desktop-registry.json";
const FACT_FRESHNESS_SCHEMA_VERSION: &str = "omnidesk.fact-freshness.v0.1";
const CAPABILITIES_SCHEMA_VERSION: &str = "omnidesk.project-capabilities.v0.1";
const MEMORY_SCHEMA_VERSION: &str = "omnidesk.memory.v0.1";
const PROFILE_SCHEMA_VERSION: &str = "omnidesk.project-profile.v0.1";
const REGISTRY_SCHEMA_VERSION: &str = "omnidesk.desktop-registry.v0.1";
const LEGACY_REGISTRY_SCHEMA_VERSION: &str = "project-os.desktop-registry.v0.1";

fn project_legacy_schema(
    mut document: Value,
    legacy_version: &str,
    current_version: &str,
) -> Value {
    if document.get("schemaVersion").and_then(Value::as_str) == Some(legacy_version) {
        document["schemaVersion"] = json!(current_version);
        document["schemaMigration"] = json!({
            "from": legacy_version,
            "mode": "read-projection",
        });
    }
    document
}

pub struct WorkspaceProjectionState {
    pub state: Option<Value>,
    pub recommendations: Option<Value>,
    pub task_backlog: Option<Value>,
    pub goal_validation: Value,
    pub goal_validation_report: Value,
    pub goal_signoff_history: Value,
    pub workspace_facts: Value,
    pub goals: Option<Value>,
    pub project_goals: Value,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectProfile {
    pub overview: String,
    pub phase_summary: String,
    pub architecture_summary: String,
    pub check_commands: String,
    pub collaboration_rules: String,
    pub intro: String,
    pub long_term_goal: String,
    pub target_users: String,
    pub use_cases: String,
    pub user_preferences: String,
    pub missing_fields: Vec<String>,
}

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TreeEntry {
    pub label: String,
    pub depth: usize,
    pub kind: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineeringFilePreview {
    pub path: String,
    pub name: String,
    pub content: String,
    pub language: String,
    pub truncated: bool,
    pub size: u64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ProjectRuntimeContext {
    pub name: String,
    pub stage: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueueItem {
    pub id: String,
    pub title: String,
    pub status: String,
    pub body: String,
    pub tone: String,
    pub goal_id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryItem {
    pub marker: String,
    pub title: String,
    pub body: String,
    pub muted: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSnapshot {
    pub project_name: String,
    pub current_project_id: String,
    pub current_project_path: String,
    pub phase: String,
    pub stage: String,
    pub file_count: usize,
    pub docs_count: usize,
    pub recommendation_count: usize,
    pub run_count: usize,
    pub projects: Vec<RegistryProjectSummary>,
    pub tree: Vec<TreeEntry>,
    pub queue: Vec<QueueItem>,
    pub memory: Vec<MemoryItem>,
    pub project_profile: ProjectProfile,
    pub workspace_facts: Value,
    pub runbook_commands: Value,
    pub project_capabilities: Value,
    pub fact_freshness: Value,
    pub goal_validation: Value,
    pub goal_validation_report: Value,
    pub goal_signoff_history: Value,
    pub goals: Value,
    pub project_goals: Value,
    pub state_retirement: Value,
    pub trace: Vec<String>,
}

pub fn count_run_records(root: &Path) -> usize {
    let Ok(runs_dir) =
        crate::runtime::state_namespace::state_path_for_read(root, ".omnidesk/evidence/runs")
    else {
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

pub fn workspace_queue(
    task_backlog: &Option<Value>,
    recommendations: &Option<Value>,
) -> Vec<QueueItem> {
    let mut queue = task_backlog_queue(task_backlog);
    queue.extend(recommendation_queue(recommendations));
    queue
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

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RegistryProjectRecord {
    pub id: String,
    pub name: String,
    pub path: String,
    pub phase: String,
    #[serde(default)]
    pub name_locked: bool,
    #[serde(default = "default_project_access_mode")]
    pub access_mode: String,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceRegistry {
    pub schema_version: String,
    pub current_project_id: String,
    pub projects: Vec<RegistryProjectRecord>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistryProjectSummary {
    pub id: String,
    pub name: String,
    pub path: String,
    pub phase: String,
    pub access_mode: String,
    pub is_current: bool,
    pub health: String,
    pub status_label: String,
    pub task_count: usize,
    pub active_task_count: usize,
    pub failed_task_count: usize,
    pub completed_task_count: usize,
    pub latest_activity_at: String,
    pub latest_activity_title: String,
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

pub fn default_project_access_mode() -> String {
    "browse".to_string()
}

pub fn normalize_project_access_mode(value: &str) -> String {
    match value.trim() {
        "governed" => "governed".to_string(),
        "controlled" => "controlled".to_string(),
        _ => "browse".to_string(),
    }
}

pub fn normalize_project_path(path: &str) -> Result<PathBuf, String> {
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

pub fn project_id_from_path(path: &str) -> String {
    let mut id = String::from("project");
    for byte in path.as_bytes() {
        id.push_str(&format!("{:02x}", byte));
    }
    id
}

pub fn load_or_seed_registry(app_root: &Path) -> Result<WorkspaceRegistry, String> {
    let path = crate::runtime::state_namespace::state_path_for_read(app_root, REGISTRY_PATH)
        .unwrap_or_else(|_| app_root.join(REGISTRY_PATH));
    if path.exists() {
        let content = fs::read_to_string(&path).map_err(|err| err.to_string())?;
        let mut registry: WorkspaceRegistry =
            serde_json::from_str(&content).map_err(|err| err.to_string())?;
        if !registry.projects.is_empty() {
            if registry.schema_version == LEGACY_REGISTRY_SCHEMA_VERSION {
                registry.schema_version = REGISTRY_SCHEMA_VERSION.to_string();
            }
            return Ok(registry);
        }
    }

    let state = Repository::new(app_root).read_json(STATE_PATH);
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
    let registry = WorkspaceRegistry {
        schema_version: REGISTRY_SCHEMA_VERSION.to_string(),
        current_project_id: "current".to_string(),
        projects: vec![RegistryProjectRecord {
            id: "current".to_string(),
            name,
            path: app_root.display().to_string(),
            phase,
            name_locked: false,
            access_mode: default_project_access_mode(),
        }],
    };
    save_registry(app_root, &registry)?;
    Ok(registry)
}

pub fn save_registry(app_root: &Path, registry: &WorkspaceRegistry) -> Result<(), String> {
    let mut registry = registry.clone();
    registry.schema_version = REGISTRY_SCHEMA_VERSION.to_string();
    Repository::new(app_root).transaction(
        "save-registry",
        &[JsonMutation::upsert(
            REGISTRY_PATH,
            serde_json::to_value(registry).map_err(|err| err.to_string())?,
        )],
    )?;
    Ok(())
}

pub fn current_registry_project(
    registry: &mut WorkspaceRegistry,
    app_root: &Path,
) -> Result<RegistryProjectRecord, String> {
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

/// Registers a project by canonical path. The canonical path is the stable
/// identity; display names remain editable metadata and never define identity.
pub fn register_project(
    app_root: &Path,
    registry: &mut WorkspaceRegistry,
    path: &str,
    access_mode: &str,
) -> Result<(), String> {
    let project_root = normalize_project_path(path)?;
    if !project_root.is_dir() {
        return Err("项目路径不存在或不是目录".to_string());
    }
    let project_path = project_root.display().to_string();
    let state = Repository::new(&project_root).read_json(STATE_PATH);
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
                .map(|candidate| candidate == project_root)
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
        project.access_mode = normalize_project_access_mode(access_mode);
    } else {
        registry.projects.push(RegistryProjectRecord {
            id: id.clone(),
            name,
            path: project_path,
            phase,
            name_locked: false,
            access_mode: normalize_project_access_mode(access_mode),
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
    save_registry(app_root, registry)
}

pub fn preview_project_path(path: &str) -> Result<Value, String> {
    let root = normalize_project_path(path)?;
    if !root.is_dir() {
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
            "hasProjectOs": crate::runtime::state_namespace::state_path_exists(&root, ".omnidesk")
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

pub fn switch_registry_project(
    app_root: &Path,
    registry: &mut WorkspaceRegistry,
    id: &str,
) -> Result<(), String> {
    if !registry.projects.iter().any(|project| project.id == id) {
        return Err("未找到这个项目".to_string());
    }
    registry.current_project_id = id.to_string();
    save_registry(app_root, registry)
}

pub fn rename_registry_project(
    app_root: &Path,
    registry: &mut WorkspaceRegistry,
    id: &str,
    name: &str,
) -> Result<(), String> {
    let next_name = name.trim();
    if next_name.is_empty() {
        return Err("项目名称不能为空。".to_string());
    }
    if next_name.chars().count() > 60 {
        return Err("项目名称太长了，建议控制在 60 个字以内。".to_string());
    }
    let project = registry
        .projects
        .iter_mut()
        .find(|project| project.id == id)
        .ok_or_else(|| "未找到这个项目".to_string())?;
    project.name = next_name.to_string();
    project.name_locked = true;
    save_registry(app_root, registry)
}

pub fn relocate_registry_project(
    app_root: &Path,
    registry: &mut WorkspaceRegistry,
    id: &str,
    path: &str,
) -> Result<(), String> {
    let next_path = path.trim();
    if next_path.is_empty() {
        return Err("请选择新的项目文件夹。".to_string());
    }
    let next_root = normalize_project_path(next_path)
        .map_err(|error| format!("无法访问新的项目路径: {}", error))?;
    if !next_root.is_dir() {
        return Err("请选择一个文件夹作为项目路径。".to_string());
    }
    let state = Repository::new(&next_root).read_json(STATE_PATH);
    let project = registry
        .projects
        .iter_mut()
        .find(|project| project.id == id)
        .ok_or_else(|| "未找到这个项目".to_string())?;
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
    registry.current_project_id = id.to_string();
    save_registry(app_root, registry)
}

pub fn remove_registry_project(
    app_root: &Path,
    registry: &mut WorkspaceRegistry,
    id: &str,
) -> Result<(), String> {
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
    save_registry(app_root, registry)
}

pub fn registry_project_summaries(registry: &WorkspaceRegistry) -> Vec<RegistryProjectSummary> {
    registry
        .projects
        .iter()
        .map(|project| {
            let (health, status_label) = registry_project_health(project);
            let summary = project_task_summary(Path::new(&project.path));
            RegistryProjectSummary {
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
        let Some(task) = fs::read_to_string(&path)
            .ok()
            .and_then(|text| serde_json::from_str::<Value>(&text).ok())
        else {
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

fn registry_project_health(project: &RegistryProjectRecord) -> (String, String) {
    let root = PathBuf::from(&project.path);
    if !root.exists() || !root.is_dir() {
        return ("missing".to_string(), "路径失效".to_string());
    }
    let has_state = crate::runtime::state_namespace::state_path_for_read(&root, STATE_PATH)
        .map(|path| path.exists())
        .unwrap_or(false);
    let has_project = root.join("PROJECT.md").is_file();
    let has_handoff = root.join("HANDOFF.md").is_file();
    if has_state && has_project && has_handoff {
        return ("ready".to_string(), "已接入 · OmniDesk".to_string());
    }
    if has_state || has_project || has_handoff || root.join("AGENTS.md").is_file() {
        return ("partial".to_string(), "缺少关键文件".to_string());
    }
    ("external".to_string(), "未初始化 · 普通项目".to_string())
}

pub fn build_workspace_facts_preview(root: &Path, project_name: &str) -> Value {
    let state_json = read_json(root, STATE_PATH);
    let profile_json = read_json(root, PROFILE_PATH);
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
    let governance_domains =
        crate::runtime::workspace_governance::governance_domains_from_files(root);
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
        profile_field_value(&profile_json, "memory.risks"),
        "老项目默认只读扫描，用户确认前不修改工程文件。".to_string(),
    ]);
    let has_state = crate::runtime::state_namespace::state_path_exists(root, ".omnidesk");
    let local_state = format!(
        "{} {}",
        git_status,
        if has_state {
            "已发现 OmniDesk 工作区状态。"
        } else {
            "未发现 OmniDesk 工作区状态。"
        }
    );
    let health_score = crate::runtime::workspace_governance::build_health_score(
        root,
        &profile,
        &overview,
        &scripts,
        &risk_boundary,
        &governance_domains,
    );
    let generated_at = Command::new("date")
        .arg("+%Y-%m-%dT%H:%M:%S%z")
        .output()
        .ok()
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|text| text.trim().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    json!({
        "schemaVersion": "omnidesk.workspace-facts.v0.1",
        "generatedAt": generated_at,
        "mode": if has_state { "existing-project" } else { "temporary-readonly" },
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
            "kind": profile_field_value(&profile_json, "identity.type"),
            "version": package_version,
            "createdAt": created_at,
            "detectedStack": stack,
            "dependencies": dependencies,
            "directories": directories,
            "coreCapabilities": profile_field_value(&profile_json, "product.coreValue"),
            "owner": profile_field_value(&profile_json, "project.owner"),
            "milestone": json_string_value(&state_json, "/stage"),
            "lifecycle": json_string_value(&state_json, "/phase"),
            "description": overview
        },
        "summary": {
            "overview": { "status": if overview.is_empty() { "missing" } else { "confirmed" }, "title": "项目概览", "body": if overview.is_empty() { "尚未识别到项目概览。".to_string() } else { overview.clone() }, "sources": ["PROJECT.md", STATE_PATH, PROFILE_PATH], "confidence": 0.82 },
            "currentProgress": { "status": if current_progress.is_empty() { "missing" } else { "inferred" }, "title": "当前进度", "body": if current_progress.is_empty() { "尚未识别到当前进度。".to_string() } else { current_progress.clone() }, "sources": ["HANDOFF.md", "PROJECT.md", "git status"], "confidence": 0.72 },
            "runbook": { "status": if runbook_summary.is_empty() { "missing" } else { "confirmed" }, "title": "启动方式", "body": if runbook_summary.is_empty() { "尚未识别到启动方式。".to_string() } else { runbook_summary.clone() }, "sources": ["package.json", "desktop/package.json", "docs/RUNBOOK.md"], "confidence": 0.78 },
            "riskBoundary": { "status": if risk_boundary.is_empty() { "missing" } else { "inferred" }, "title": "风险边界", "body": if risk_boundary.is_empty() { "尚未识别到风险边界。".to_string() } else { risk_boundary.clone() }, "sources": ["HANDOFF.md", PROFILE_PATH], "confidence": 0.68 },
            "localState": { "status": "confirmed", "title": "本地状态", "body": local_state, "sources": ["git status", ".omnidesk/"], "confidence": 0.82 }
        },
        "evidence": [
            { "source": "PROJECT.md", "kind": "project-status", "status": if root.join("PROJECT.md").exists() { "found" } else { "missing" }, "note": "项目状态展示层。" },
            { "source": "HANDOFF.md", "kind": "handoff", "status": if root.join("HANDOFF.md").exists() { "found" } else { "missing" }, "note": "当前交接和风险来源。" },
            { "source": "desktop/package.json", "kind": "run-config", "status": if root.join("desktop/package.json").exists() { "found" } else { "missing" }, "note": "桌面端启动脚本来源。" },
            { "source": STATE_PATH, "kind": "project-state", "status": if crate::runtime::state_namespace::state_path_exists(root, STATE_PATH) { "found" } else { "missing" }, "note": "机器可读项目状态。" },
            { "source": PROFILE_PATH, "kind": "project-profile", "status": if crate::runtime::state_namespace::state_path_exists(root, PROFILE_PATH) { "found" } else { "missing" }, "note": "结构化项目档案。" }
        ],
        "governanceDomains": governance_domains,
        "recommendations": [
            { "id": "rec-health-score", "domain": "项目概览", "title": "补齐项目健康评分", "problem": "当前已建立治理索引，但缺少统一健康分，用户还难以判断项目整体治理水平。", "impact": "后续无法稳定比较新老项目，也难以跟踪治理改善效果。", "action": "基于文档完整度、启动方式、风险边界、本地状态和验证记录生成健康分。", "severity": "medium", "files": ["schemas/workspace-facts.schema.json", ".omnidesk/cache/workspace-facts.json"], "canPromoteToL3": false },
            { "id": "rec-file-status", "domain": "工程资产", "title": "为治理文件增加状态", "problem": "工程文件已经纳入治理域，但还没有区分已识别、缺失、过期和本地变更。", "impact": "用户能看到文件列表，但无法快速判断哪些文件需要处理。", "action": "为每个治理文件补充 status、lastSeen、changeKind 和 sourceType。", "severity": "medium", "files": ["desktop/src-tauri/src/main.rs", "desktop/src/main.jsx"], "canPromoteToL3": false },
            { "id": "rec-ci-governance", "domain": "验证交付", "title": "设计持续治理入口", "problem": "当前联动更新只发生在本地工作台，尚未和 CI 或定期扫描形成闭环。", "impact": "项目离开本地工作台后，治理状态可能无法持续更新。", "action": "增加 CI/定时扫描适配入口，先生成建议和检查清单，不直接修改流水线。", "severity": "low", "files": ["docs/RUNBOOK.md", "desktop/package.json"], "canPromoteToL3": false },
            { "id": "rec-controlled-fix-entry", "domain": "受控修复", "title": "准备 L3 受控修复入口", "problem": "L2 建议可以解释问题，但还没有把建议转成可审核的变更提案。", "impact": "用户仍需要手动判断哪些建议可以进入自动修复。", "action": "为建议增加生成 patch draft 的入口，只有用户确认后才进入 L3。", "severity": "low", "files": ["desktop/src/main.jsx", "desktop/src-tauri/src/main.rs"], "canPromoteToL3": true }
        ],
        "findings": {
            "confirmed": [],
            "missing": profile.missing_fields.iter().map(|field| json!({ "title": format!("{}待补齐", field), "body": "该字段尚未从当前事实源中稳定识别。", "severity": "low", "sources": [PROFILE_PATH] })).collect::<Vec<_>>(),
            "risks": [{ "title": "默认不修改工程文件", "body": "工程文件自动纳入治理索引，但当前只做预览和归类，不在这里直接编辑或改写原工程文件。", "severity": "info", "sources": ["OmniDesk workspace"] }]
        },
        "recommendation": { "action": "auto-managed", "confidence": 0.74, "reason": "当前项目处于 L1 治理索引，可继续升级到 L2 建议修复。", "nextSteps": ["自动维护治理索引", "在工程文件区预览来源", "生成 L2 修复建议草稿"] }
    })
}

#[derive(Deserialize)]
pub struct ProfileFieldPatch {
    pub key: String,
    pub value: Value,
    pub status: String,
    pub source: String,
    pub confidence: f64,
    #[serde(default)]
    pub notes: String,
}

fn read_json(root: &Path, relative: &str) -> Option<Value> {
    Repository::new(root).read_json(relative)
}

fn read_text(root: &Path, relative: &str) -> String {
    Repository::new(root)
        .read_text(relative)
        .unwrap_or_default()
}

/// Workspace facts use short, source-attributed excerpts rather than complete
/// Markdown documents so the Runtime never treats prose as an unbounded prompt.
pub fn clean_markdown_line(line: &str) -> String {
    line.trim()
        .trim_start_matches(['-', '*', '>', ' '])
        .trim()
        .trim_matches('`')
        .trim()
        .to_string()
}

pub fn markdown_section(content: &str, headings: &[&str]) -> String {
    let mut collecting = false;
    let mut lines: Vec<String> = Vec::new();
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('#') {
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

pub fn first_non_empty(values: Vec<String>) -> String {
    values
        .into_iter()
        .map(|value| value.trim().to_string())
        .find(|value| !value.is_empty())
        .unwrap_or_default()
}

pub fn profile_field_value(profile: &Option<Value>, key: &str) -> String {
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

pub fn json_string_value(json: &Option<Value>, pointer: &str) -> String {
    json.as_ref()
        .and_then(|value| value.pointer(pointer))
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string()
}

pub fn is_safe_text_preview_path(path: &str) -> bool {
    let relative = Path::new(path);
    if relative.is_absolute()
        || path.starts_with(".env")
        || path.contains("/.env")
        || path == ".omnidesk"
        || path.starts_with(".omnidesk/")
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

pub fn preview_language(path: &str) -> String {
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

/// Reads a bounded text preview after enforcing the same workspace path policy
/// used by the file tree. State directories, environment files, symlink escapes,
/// binary data, and folders are never exposed through this read-only surface.
pub fn read_engineering_file(
    root: &Path,
    requested_path: &str,
) -> Result<EngineeringFilePreview, String> {
    const MAX_PREVIEW_BYTES: usize = 80 * 1024;
    let relative = requested_path.trim();
    if relative.is_empty() {
        return Err("请选择一个工程文件".to_string());
    }
    if !is_safe_text_preview_path(relative) {
        return Err("这个文件暂不支持预览：只能查看项目内的普通文本文件。".to_string());
    }
    let root = root
        .canonicalize()
        .map_err(|error| format!("项目目录不可访问: {}", error))?;
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
    let metadata = fs::metadata(&canonical).map_err(|error| error.to_string())?;
    let bytes =
        fs::read(&canonical).map_err(|error| format!("读取 {} 失败: {}", relative, error))?;
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
    Ok(EngineeringFilePreview {
        path: relative.to_string(),
        name: canonical
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or(relative)
            .to_string(),
        content,
        language: preview_language(relative),
        truncated,
        size: metadata.len(),
    })
}

pub fn count_visible_files(root: &Path) -> (usize, usize) {
    let mut file_count = 0;
    let mut docs_count = 0;
    count_visible_files_at(root, 0, &mut file_count, &mut docs_count);
    (file_count, docs_count)
}

pub fn build_tree_preview(root: &Path) -> Vec<TreeEntry> {
    let mut tree = vec![TreeEntry {
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

fn count_visible_files_at(
    path: &Path,
    depth: usize,
    file_count: &mut usize,
    docs_count: &mut usize,
) {
    if depth > 6 || is_ignored_workspace_path(path) {
        return;
    }
    let Ok(entries) = fs::read_dir(path) else {
        return;
    };
    for entry in entries.flatten() {
        let child = entry.path();
        if is_ignored_workspace_path(&child) {
            continue;
        }
        if child.is_dir() {
            count_visible_files_at(&child, depth + 1, file_count, docs_count);
        } else {
            *file_count += 1;
            if child.extension().and_then(|ext| ext.to_str()) == Some("md") {
                *docs_count += 1;
            }
        }
    }
}

fn append_tree_preview(path: &Path, depth: usize, tree: &mut Vec<TreeEntry>) {
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
        .filter(|entry| !is_ignored_workspace_path(&entry.path()))
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
        tree.push(TreeEntry {
            label: label.to_string(),
            depth,
            kind: if is_dir { "folder" } else { "file" }.to_string(),
        });
        if is_dir {
            append_tree_preview(&child, depth + 1, tree);
        }
    }
}

fn is_ignored_workspace_path(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| {
            matches!(
                name,
                ".git"
                    | ".project-os"
                    | ".omnidesk"
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
            ) || (name.starts_with(".env") && name != ".env.example")
        })
        .unwrap_or(false)
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

pub fn project_checks_from_agents(agents_md: &str) -> String {
    let checks = markdown_section(agents_md, &["Commands"])
        .split_whitespace()
        .collect::<Vec<_>>()
        .windows(2)
        .filter_map(|window| {
            (window[0] == "bash").then(|| format!("bash {}", window[1].trim_matches('`')))
        })
        .take(4)
        .collect::<Vec<_>>();
    if checks.is_empty() {
        String::new()
    } else {
        checks.join("、")
    }
}

pub fn project_intro_from_project_md(project_md: &str, project_name: &str) -> String {
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

pub fn build_project_profile(root: &Path, project_name: &str) -> ProjectProfile {
    let project_md = read_text(root, "PROJECT.md");
    let product_plan = read_text(root, "docs/PRODUCT_PLAN.md");
    let handoff = read_text(root, "HANDOFF.md");
    let agents_md = read_text(root, "AGENTS.md");
    let state_json = read_json(root, STATE_PATH);
    let profile_json = read_json(root, PROFILE_PATH);
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
    let missing_fields = [
        ("项目概览", &intro),
        ("当前阶段", &phase_summary),
        ("技术架构", &architecture_summary),
        ("检查命令", &check_commands),
        ("协作规则", &collaboration_rules),
    ]
    .into_iter()
    .filter_map(|(label, value)| value.trim().is_empty().then(|| label.to_string()))
    .collect();
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

pub fn package_scripts_summary(root: &Path) -> String {
    let mut scripts = Vec::new();
    for relative in ["package.json", "desktop/package.json"] {
        let Some(package_json) = read_json(root, relative) else {
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

pub fn runbook_commands(root: &Path) -> Value {
    let mut commands = Vec::new();
    for relative in ["package.json", "desktop/package.json"] {
        let Some(package_json) = read_json(root, relative) else {
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
    json!(commands)
}

pub fn package_identity(root: &Path) -> (String, String) {
    for relative in ["package.json", "desktop/package.json"] {
        let Some(package_json) = read_json(root, relative) else {
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

pub fn dependency_summary(root: &Path) -> Vec<String> {
    let mut dependencies = Vec::new();
    for relative in ["package.json", "desktop/package.json"] {
        let Some(package_json) = read_json(root, relative) else {
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

pub fn project_directory_summary(root: &Path) -> Vec<String> {
    [
        "src",
        "desktop",
        "cli",
        "assets",
        "docs",
        "schemas",
        "scripts",
        "tests",
        "templates",
    ]
    .into_iter()
    .filter(|name| root.join(name).exists())
    .map(str::to_string)
    .collect()
}

pub fn project_created_at(root: &Path) -> String {
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

pub fn detected_stack(root: &Path) -> Vec<String> {
    let mut stack = Vec::new();
    if root.join("desktop/src-tauri/Cargo.toml").exists()
        || root.join("src-tauri/Cargo.toml").exists()
    {
        stack.extend(["Tauri".to_string(), "Rust".to_string()]);
    }
    for relative in ["package.json", "desktop/package.json"] {
        let Some(package_json) = read_json(root, relative) else {
            continue;
        };
        let dependencies = ["dependencies", "devDependencies"]
            .iter()
            .filter_map(|key| package_json.get(key).and_then(Value::as_object))
            .flat_map(|items| items.keys())
            .collect::<Vec<_>>();
        if dependencies
            .iter()
            .any(|name| name.as_str() == "react" || name.as_str() == "react-dom")
        {
            stack.push("React".to_string());
        }
        if dependencies
            .iter()
            .any(|name| name.as_str() == "vite" || name.as_str() == "@vitejs/plugin-react")
        {
            stack.push("Vite".to_string());
        }
    }
    if crate::runtime::state_namespace::state_path_exists(root, ".omnidesk") {
        stack.push("OmniDesk".to_string());
    }
    stack.sort();
    stack.dedup();
    stack
}

pub fn git_status_summary(root: &Path) -> String {
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
    let count = String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter(|line| !line.trim().is_empty())
        .count();
    if count == 0 {
        "git 工作区干净。".to_string()
    } else {
        format!("git 工作区有 {} 个变更项。", count)
    }
}

fn source_paths() -> [&'static str; 19] {
    [
        "README.md",
        "PROJECT.md",
        "HANDOFF.md",
        "AGENTS.md",
        "package.json",
        "desktop/package.json",
        "Cargo.toml",
        "desktop/src-tauri/Cargo.toml",
        STATE_PATH,
        PROFILE_PATH,
        "src",
        "desktop/src",
        "server",
        "backend",
        "api",
        "prisma",
        "migrations",
        "tests",
        ".github/workflows",
    ]
}

fn source_fingerprints(root: &Path) -> serde_json::Map<String, Value> {
    source_paths()
        .into_iter()
        .filter_map(|relative| {
            let path = crate::runtime::state_namespace::state_path_for_read(root, relative).ok()?;
            let metadata = fs::metadata(path).ok()?;
            let modified = metadata
                .modified()
                .ok()?
                .duration_since(UNIX_EPOCH)
                .ok()?
                .as_millis();
            Some((
                relative.to_string(),
                json!(format!("{}:{}", modified, metadata.len())),
            ))
        })
        .collect()
}

pub fn fact_freshness(root: &Path) -> Value {
    let current = source_fingerprints(root);
    let saved = read_json(root, FACT_FRESHNESS_PATH);
    let saved_fingerprints = saved
        .as_ref()
        .and_then(|value| value.get("fingerprints"))
        .and_then(Value::as_object);
    let changed_sources = current
        .iter()
        .filter_map(|(path, fingerprint)| {
            (saved_fingerprints.and_then(|items| items.get(path)) != Some(fingerprint))
                .then(|| path.clone())
        })
        .collect::<Vec<_>>();
    json!({
        "status": if saved_fingerprints.is_some() && changed_sources.is_empty() { "fresh" } else { "stale" },
        "updatedAt": saved.as_ref().and_then(|value| value.get("updatedAt")).and_then(Value::as_str).unwrap_or(""),
        "changedSources": changed_sources
    })
}

pub fn record_fact_freshness(root: &Path, timestamp: &str) -> Result<(), String> {
    Repository::new(root).transaction("record-fact-freshness", &[JsonMutation::upsert(
        FACT_FRESHNESS_PATH,
        json!({ "schemaVersion": FACT_FRESHNESS_SCHEMA_VERSION, "updatedAt": timestamp, "fingerprints": source_fingerprints(root) }),
    )])?;
    Ok(())
}

pub fn detected_capabilities(root: &Path) -> Value {
    let saved = read_json(root, CAPABILITIES_PATH);
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
            if crate::runtime::state_namespace::state_path_exists(root, GOALS_PATH) {
                "detected"
            } else {
                "available"
            },
            vec![GOALS_PATH],
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
            if crate::runtime::state_namespace::state_path_exists(root, PROVIDER_PATH)
                || crate::runtime::state_namespace::state_path_exists(root, MODEL_CATALOG_PATH)
            {
                "detected"
            } else {
                "available"
            },
            vec![PROVIDER_PATH, MODEL_CATALOG_PATH],
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
        if saved_status == "dismissed" || rank(saved_status) >= rank(detected_status) { return saved_item.cloned().unwrap_or_else(|| json!({ "id": id, "status": saved_status, "source": "migration" })); }
        let found_signals = signals.into_iter().filter(|signal| *signal == "core" || crate::runtime::state_namespace::state_path_exists(root, signal)).collect::<Vec<_>>();
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
            crate::runtime::state_namespace::state_path_exists(root, MODEL_CATALOG_PATH)
                || package_text.contains("openai"),
            vec![MODEL_CATALOG_PATH],
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
        "id": id, "status": if detected { "detected" } else { "available" }, "source": "scan",
        "signals": signals.into_iter().filter(|signal| crate::runtime::state_namespace::state_path_exists(root, signal)).collect::<Vec<_>>()
    })).collect::<Vec<_>>();
    let mut projection = json!({ "schemaVersion": CAPABILITIES_SCHEMA_VERSION, "updatedAt": saved.as_ref().and_then(|value| value.get("updatedAt")).and_then(Value::as_str).unwrap_or(""), "capabilities": capabilities.clone(), "workspaceCapabilities": capabilities, "domainCapabilities": domain_capabilities });
    if saved
        .as_ref()
        .and_then(|value| value.get("schemaVersion"))
        .and_then(Value::as_str)
        == Some("project-os.project-capabilities.v0.1")
    {
        projection["schemaMigration"] =
            json!({ "from": "project-os.project-capabilities.v0.1", "mode": "read-projection" });
    }
    projection
}

/// Updates a user-selected workspace capability while the Repository lock is
/// held so concurrent UI actions cannot overwrite one another's modules.
pub fn update_capability(
    root: &Path,
    capability_id: &str,
    status: &str,
    modules: &[String],
    candidate_modules: &[String],
    updated_at: &str,
) -> Result<Value, String> {
    let allowed_statuses = [
        "available",
        "detected",
        "recommended",
        "enabled",
        "dismissed",
    ];
    if !allowed_statuses.contains(&status) {
        return Err("不支持的能力状态".to_string());
    }
    Repository::new(root).transaction_with("update-project-capability", |repository| {
        let mut manifest = repository.read_json(CAPABILITIES_PATH).unwrap_or_else(
            || json!({ "schemaVersion": CAPABILITIES_SCHEMA_VERSION, "capabilities": [] }),
        );
        manifest = project_legacy_schema(
            manifest,
            "project-os.project-capabilities.v0.1",
            CAPABILITIES_SCHEMA_VERSION,
        );
        if let Some(object) = manifest.as_object_mut() {
            object.remove("schemaMigration");
        }
        manifest["schemaVersion"] = json!(CAPABILITIES_SCHEMA_VERSION);
        if manifest.get("workspaceCapabilities").is_none() {
            manifest["workspaceCapabilities"] = manifest
                .get("capabilities")
                .cloned()
                .unwrap_or_else(|| json!([]));
        }
        let capabilities = manifest
            .get_mut("workspaceCapabilities")
            .and_then(Value::as_array_mut)
            .ok_or_else(|| "项目能力清单格式异常".to_string())?;
        if let Some(capability) = capabilities
            .iter_mut()
            .find(|item| item.get("id").and_then(Value::as_str) == Some(capability_id))
        {
            capability["status"] = json!(status);
            capability["source"] = json!("user");
            if !candidate_modules.is_empty() {
                capability["modules"] = json!(candidate_modules
                    .iter()
                    .map(|id| json!({
                        "id": id,
                        "status": if modules.contains(id) { "enabled" } else { "recommended" },
                        "source": "user"
                    }))
                    .collect::<Vec<_>>());
            }
        } else {
            capabilities.push(json!({ "id": capability_id, "status": status, "source": "user" }));
        }
        manifest["updatedAt"] = json!(updated_at);
        manifest["capabilities"] = manifest["workspaceCapabilities"].clone();
        Ok((
            manifest.clone(),
            vec![JsonMutation::upsert(CAPABILITIES_PATH, manifest)],
        ))
    })
}

pub fn load_memory(root: &Path, project_id: &str) -> Value {
    let memory = Repository::new(root)
        .read_json(MEMORY_PATH)
        .unwrap_or_else(|| {
            json!({
                "schemaVersion": MEMORY_SCHEMA_VERSION,
                "projectId": project_id,
                "updatedAt": "",
                "items": []
            })
        });
    project_legacy_schema(memory, "project-os.memory.v0.1", MEMORY_SCHEMA_VERSION)
}

/// Loads the persisted state consumed by the Workspace snapshot projection.
/// The Tauri adapter owns presentation DTO composition, while this operation
/// keeps all project-state paths and default documents in one domain module.
pub fn load_projection_state(root: &Path) -> WorkspaceProjectionState {
    let repository = Repository::new(root);
    WorkspaceProjectionState {
        state: repository.read_json(STATE_PATH),
        recommendations: repository
            .read_json(".omnidesk/cache/recommendations/recommend-next.json"),
        task_backlog: repository.read_json(BACKLOG_PATH),
        goal_validation: repository
            .read_json(".omnidesk/data/goal-validation.json")
            .unwrap_or_else(|| json!({ "criteria": [] })),
        goal_validation_report: repository
            .read_json(".omnidesk/evidence/goal-validation-report.json")
            .unwrap_or_else(|| json!({ "status": "missing", "checks": [] })),
        goal_signoff_history: repository
            .read_json(".omnidesk/data/goal-signoff-history.json")
            .unwrap_or_else(|| json!({ "entries": [] })),
        workspace_facts: repository
            .read_json(".omnidesk/cache/workspace-facts.json")
            .unwrap_or_else(|| json!(null)),
        goals: repository.read_json(GOALS_PATH),
        project_goals: repository
            .read_json(".omnidesk/data/project-goals.json")
            .unwrap_or_else(|| json!({ "activeProjectGoalId": "", "projectGoals": [] })),
    }
}

/// Resolves the small, user-visible state slice shared by chat and planning.
/// Callers provide the registry name as the safe fallback for projects that do
/// not yet have an OmniDesk state document.
pub fn project_runtime_context(root: &Path, fallback_name: &str) -> ProjectRuntimeContext {
    let state = Repository::new(root).read_json(STATE_PATH);
    ProjectRuntimeContext {
        name: state
            .as_ref()
            .and_then(|json| json.get("name"))
            .and_then(Value::as_str)
            .unwrap_or(fallback_name)
            .to_string(),
        stage: state
            .as_ref()
            .and_then(|json| json.get("stage"))
            .and_then(Value::as_str)
            .unwrap_or("未读取到阶段信息")
            .to_string(),
    }
}

/// Builds the complete read-only workbench snapshot from the registered
/// workspace state. Tauri commands intentionally only resolve the active
/// project and delegate DTO composition here.
pub fn build_workspace_snapshot(
    root: &Path,
    current_project: &RegistryProjectRecord,
    registry: &WorkspaceRegistry,
) -> Result<WorkspaceSnapshot, String> {
    let projection = load_projection_state(root);
    let project_name = current_project.name.clone();
    let phase = projection
        .state
        .as_ref()
        .and_then(|json| json.get("phase"))
        .and_then(Value::as_str)
        .unwrap_or(&current_project.phase)
        .to_string();
    let stage = projection
        .state
        .as_ref()
        .and_then(|json| json.get("stage"))
        .and_then(Value::as_str)
        .unwrap_or("未读取到阶段信息")
        .to_string();
    let recommendation_count = projection
        .recommendations
        .as_ref()
        .and_then(|json| json.pointer("/summary/recommendationCount"))
        .and_then(Value::as_u64)
        .unwrap_or(0) as usize;
    let mut queue = workspace_queue(&projection.task_backlog, &projection.recommendations);
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
    let goals = projection.goals.unwrap_or_else(|| {
        goal_stack_from_validation(
            &projection.goal_validation,
            &projection.goal_validation_report,
            &projection.goal_signoff_history,
            &project_name,
        )
    });
    let (file_count, docs_count) = count_visible_files(root);
    let run_count = count_run_records(root);
    let state_retirement =
        serde_json::to_value(crate::runtime::state_namespace::legacy_retirement_readiness(root)?)
            .map_err(|error| error.to_string())?;

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
        projects: registry_project_summaries(registry),
        tree: build_tree_preview(root),
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
        project_profile: build_project_profile(root, &project_name),
        workspace_facts: projection.workspace_facts,
        runbook_commands: runbook_commands(root),
        project_capabilities: detected_capabilities(root),
        fact_freshness: fact_freshness(root),
        goal_validation: projection.goal_validation,
        goal_validation_report: projection.goal_validation_report,
        goal_signoff_history: projection.goal_signoff_history,
        goals,
        project_goals: projection.project_goals,
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

/// Validates and persists project memory through the same Repository boundary
/// as the rest of workspace state. The caller supplies the project identity
/// and timestamp; this service owns its storage shape and path.
pub fn save_memory(
    root: &Path,
    project_id: &str,
    timestamp: &str,
    mut memory: Value,
) -> Result<Value, String> {
    let object = memory
        .as_object_mut()
        .ok_or_else(|| "项目记忆必须是 JSON object".to_string())?;
    object.insert(
        "schemaVersion".to_string(),
        Value::String(MEMORY_SCHEMA_VERSION.to_string()),
    );
    object.remove("schemaMigration");
    object.insert(
        "projectId".to_string(),
        Value::String(project_id.to_string()),
    );
    object.insert(
        "updatedAt".to_string(),
        Value::String(timestamp.to_string()),
    );
    object
        .entry("items".to_string())
        .or_insert_with(|| Value::Array(Vec::new()));
    Repository::new(root).transaction(
        "save-project-memory",
        &[JsonMutation::upsert(MEMORY_PATH, memory.clone())],
    )?;
    Ok(memory)
}

pub fn update_profile(
    root: &Path,
    project_id: &str,
    timestamp: &str,
    patches: Vec<ProfileFieldPatch>,
) -> Result<bool, String> {
    let patches = patches
        .into_iter()
        .filter(|patch| is_profile_field_allowed(&patch.key))
        .collect::<Vec<_>>();
    if patches.is_empty() {
        return Ok(false);
    }
    Repository::new(root).transaction_with("update-project-profile", |repository| {
        let mut profile = repository.read_json(PROFILE_PATH).unwrap_or_else(|| {
            json!({ "schemaVersion": PROFILE_SCHEMA_VERSION, "projectId": project_id, "updatedAt": "", "fields": {} })
        });
        profile = project_legacy_schema(
            profile,
            "project-os.project-profile.v0.1",
            PROFILE_SCHEMA_VERSION,
        );
        if let Some(object) = profile.as_object_mut() {
            object.remove("schemaMigration");
        }
        profile["schemaVersion"] = json!(PROFILE_SCHEMA_VERSION);
        profile["projectId"] = json!(project_id);
        profile["updatedAt"] = json!(timestamp);
        if !profile.get("fields").is_some_and(Value::is_object) {
            profile["fields"] = json!({});
        }
        let fields = profile.get_mut("fields").and_then(Value::as_object_mut)
            .ok_or_else(|| "project-profile fields 格式异常".to_string())?;
        for patch in patches {
            fields.insert(patch.key, json!({
                "value": patch.value,
                "status": normalize_profile_status(&patch.status),
                "source": patch.source,
                "updatedAt": timestamp,
                "confidence": patch.confidence.clamp(0.0, 1.0),
                "notes": patch.notes
            }));
        }
        Ok((true, vec![JsonMutation::upsert(PROFILE_PATH, profile)]))
    })
}

pub fn update_backlog_item(
    root: &Path,
    id: &str,
    status: &str,
    timestamp: &str,
) -> Result<(), String> {
    let id = id.trim();
    if id.is_empty() {
        return Err("任务 id 不能为空".to_string());
    }
    let status = normalize_backlog_status(status);
    if status.is_empty() {
        return Err("不支持这个任务状态".to_string());
    }
    Repository::new(root).transaction_with("update-task-backlog-item", |repository| {
        let mut backlog = repository
            .read_json(BACKLOG_PATH)
            .ok_or_else(|| "未找到任务池文件 .omnidesk/data/task-backlog.json".to_string())?;
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
            return Err(format!("没有找到任务：{id}"));
        }
        if let Some(object) = backlog.as_object_mut() {
            object.insert(
                "updatedAt".to_string(),
                Value::String(timestamp.to_string()),
            );
        }
        Ok(((), vec![JsonMutation::upsert(BACKLOG_PATH, backlog)]))
    })
}

fn normalize_backlog_status(status: &str) -> String {
    match status.trim() {
        "planned" | "running" | "done" | "failed" | "waiting approval" => status.trim().to_string(),
        _ => String::new(),
    }
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_root(label: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!(
            "omnidesk-workspace-{label}-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ))
    }

    #[test]
    fn engineering_file_preview_rules_reject_runtime_and_secret_paths() {
        assert!(is_safe_text_preview_path("desktop/src/main.jsx"));
        assert!(is_safe_text_preview_path("docs/ARCHITECTURE.md"));
        assert!(!is_safe_text_preview_path(".env.local"));
        assert!(!is_safe_text_preview_path(".omnidesk/data/state.json"));
        assert!(!is_safe_text_preview_path("../outside.rs"));
        assert!(!is_safe_text_preview_path("assets/image.png"));
        assert_eq!(preview_language("desktop/src/main.jsx"), "javascript");
        assert_eq!(preview_language("desktop/src-tauri/src/main.rs"), "rust");
        assert_eq!(preview_language("unknown.extension"), "text");
    }

    #[test]
    fn engineering_file_preview_is_bounded_and_rejects_binary_content() {
        let root = test_root("engineering-preview");
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("README.md"), "# Preview\n").unwrap();
        fs::write(root.join("binary.txt"), [b'a', 0, b'b']).unwrap();

        let preview = read_engineering_file(&root, "README.md").unwrap();
        assert_eq!(preview.name, "README.md");
        assert_eq!(preview.language, "markdown");
        assert_eq!(preview.content, "# Preview\n");
        assert!(!preview.truncated);
        assert!(read_engineering_file(&root, "binary.txt").is_err());
        assert!(read_engineering_file(&root, ".env.local").is_err());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn project_runtime_context_uses_state_then_registry_fallback() {
        let root = test_root("runtime-context");
        fs::create_dir_all(root.join(".omnidesk/data")).unwrap();
        assert_eq!(
            project_runtime_context(&root, "Registry Project"),
            ProjectRuntimeContext {
                name: "Registry Project".to_string(),
                stage: "未读取到阶段信息".to_string(),
            }
        );
        fs::write(
            root.join(STATE_PATH),
            r#"{"name":"State Project","stage":"验证中"}"#,
        )
        .unwrap();
        assert_eq!(
            project_runtime_context(&root, "Registry Project"),
            ProjectRuntimeContext {
                name: "State Project".to_string(),
                stage: "验证中".to_string(),
            }
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn registry_projects_legacy_schema_without_startup_rewrite() {
        let root = test_root("legacy-registry");
        fs::create_dir_all(root.join(".omnidesk/data")).unwrap();
        fs::write(
            root.join(REGISTRY_PATH),
            r#"{"schemaVersion":"project-os.desktop-registry.v0.1","currentProjectId":"one","projects":[{"id":"one","name":"One","path":"/tmp/one","phase":"active"}]}"#,
        )
        .unwrap();

        let registry = load_or_seed_registry(&root).unwrap();
        assert_eq!(registry.schema_version, REGISTRY_SCHEMA_VERSION);
        assert!(fs::read_to_string(root.join(REGISTRY_PATH))
            .unwrap()
            .contains(LEGACY_REGISTRY_SCHEMA_VERSION));

        save_registry(&root, &registry).unwrap();
        assert!(fs::read_to_string(root.join(REGISTRY_PATH))
            .unwrap()
            .contains(REGISTRY_SCHEMA_VERSION));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn registry_repairs_a_missing_current_project_once() {
        let root = test_root("registry-current-project");
        fs::create_dir_all(root.join(".omnidesk/data")).unwrap();
        fs::write(
            root.join(REGISTRY_PATH),
            r#"{"schemaVersion":"omnidesk.desktop-registry.v0.1","currentProjectId":"missing","projects":[{"id":"one","name":"One","path":"/tmp/one","phase":"active"}]}"#,
        )
        .unwrap();

        let mut registry = load_or_seed_registry(&root).unwrap();
        let project = current_registry_project(&mut registry, &root).unwrap();
        assert_eq!(project.id, "one");
        assert_eq!(registry.current_project_id, "one");
        let persisted = Repository::new(&root).read_json(REGISTRY_PATH).unwrap();
        assert_eq!(persisted["currentProjectId"], "one");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn registry_domain_owns_project_registration_preview_and_removal() {
        let root = test_root("registry-mutations");
        let external = root.join("external-project");
        fs::create_dir_all(root.join(".omnidesk/data")).unwrap();
        fs::create_dir_all(external.join(".git")).unwrap();
        fs::write(external.join("package.json"), r#"{"name":"external"}"#).unwrap();

        let mut registry = load_or_seed_registry(&root).unwrap();
        register_project(
            &root,
            &mut registry,
            external.to_str().unwrap(),
            "controlled",
        )
        .unwrap();
        let external_id = project_id_from_path(external.canonicalize().unwrap().to_str().unwrap());
        assert_eq!(registry.current_project_id, external_id);
        assert_eq!(registry.projects.len(), 2);
        assert_eq!(registry.projects.last().unwrap().access_mode, "controlled");

        let preview = preview_project_path(external.to_str().unwrap()).unwrap();
        assert_eq!(preview["project"]["hasGit"], true);
        assert_eq!(preview["detected"]["packageJson"], true);

        rename_registry_project(&root, &mut registry, &external_id, "已接入项目").unwrap();
        assert!(registry.projects.iter().any(|project| project.name_locked));
        remove_registry_project(&root, &mut registry, &external_id).unwrap();
        assert_eq!(registry.projects.len(), 1);
        assert_ne!(registry.current_project_id, external_id);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn registry_summary_uses_task_statuses_and_omits_manifest() {
        let root = test_root("registry-summary");
        let tasks = root.join(".omnidesk/data/tasks");
        fs::create_dir_all(&tasks).unwrap();
        fs::write(tasks.join("manifest.json"), r#"{"tasks":["ignored"]}"#).unwrap();
        fs::write(
            tasks.join("active.json"),
            r#"{"title":"进行中的任务","status":"running","updatedAt":"2026-07-22T10:00:00Z"}"#,
        )
        .unwrap();
        fs::write(
            tasks.join("failed.json"),
            r#"{"title":"失败任务","status":"failed","updatedAt":"2026-07-22T11:00:00Z"}"#,
        )
        .unwrap();
        fs::write(
            tasks.join("done.json"),
            r#"{"title":"完成任务","status":"done","updatedAt":"2026-07-22T09:00:00Z"}"#,
        )
        .unwrap();
        let registry = WorkspaceRegistry {
            schema_version: REGISTRY_SCHEMA_VERSION.to_string(),
            current_project_id: "one".to_string(),
            projects: vec![RegistryProjectRecord {
                id: "one".to_string(),
                name: "One".to_string(),
                path: root.display().to_string(),
                phase: "active".to_string(),
                name_locked: false,
                access_mode: "controlled".to_string(),
            }],
        };

        let summary = registry_project_summaries(&registry);
        assert_eq!(summary[0].task_count, 3);
        assert_eq!(summary[0].active_task_count, 1);
        assert_eq!(summary[0].failed_task_count, 1);
        assert_eq!(summary[0].completed_task_count, 1);
        assert_eq!(summary[0].latest_activity_title, "失败任务");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn workspace_facts_preview_is_read_only_and_keeps_the_contract() {
        let root = test_root("facts-preview");
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("PROJECT.md"), "# 示例项目\n项目概览。\n").unwrap();
        fs::write(
            root.join("HANDOFF.md"),
            "# 当前交接\n\n## 风险\n默认只读。\n",
        )
        .unwrap();

        let preview = build_workspace_facts_preview(&root, "示例项目");
        assert_eq!(preview["schemaVersion"], "omnidesk.workspace-facts.v0.1");
        assert_eq!(preview["mode"], "temporary-readonly");
        assert_eq!(preview["status"], "connected");
        assert_eq!(preview["project"]["name"], "示例项目");
        assert_eq!(preview["governanceLevel"]["current"], "L1");
        assert_eq!(preview["recommendations"].as_array().unwrap().len(), 4);
        assert!(!root.join(".omnidesk").exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn freshness_round_trip_uses_repository_state() {
        let root = test_root("freshness");
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("README.md"), "workspace").unwrap();
        assert_eq!(fact_freshness(&root)["status"], "stale");
        record_fact_freshness(&root, "now").unwrap();
        assert_eq!(fact_freshness(&root)["status"], "fresh");
        assert!(root.join(".omnidesk/runtime/events").exists());
    }

    #[test]
    fn capability_scan_preserves_user_dismissal() {
        let root = test_root("capability");
        fs::create_dir_all(root.join(".omnidesk/data")).unwrap();
        fs::write(root.join("AGENTS.md"), "rules").unwrap();
        fs::write(
            root.join(CAPABILITIES_PATH),
            r#"{ "workspaceCapabilities": [{ "id": "rules", "status": "dismissed" }] }"#,
        )
        .unwrap();
        let capabilities = detected_capabilities(&root);
        let rules = capabilities["workspaceCapabilities"]
            .as_array()
            .unwrap()
            .iter()
            .find(|item| item["id"] == "rules")
            .unwrap();
        assert_eq!(rules["status"], "dismissed");
    }

    #[test]
    fn capability_update_preserves_prior_entries_under_repository_transaction() {
        let root = test_root("capability-update");
        update_capability(&root, "rules", "dismissed", &[], &[], "first").unwrap();
        update_capability(&root, "tasks", "recommended", &[], &[], "second").unwrap();
        update_capability(
            &root,
            "tasks",
            "enabled",
            &["planning".to_string()],
            &["planning".to_string(), "review".to_string()],
            "third",
        )
        .unwrap();
        let manifest = Repository::new(&root).read_json(CAPABILITIES_PATH).unwrap();
        assert_eq!(
            manifest["workspaceCapabilities"].as_array().unwrap().len(),
            2
        );
        assert_eq!(manifest["updatedAt"], "third");
        assert_eq!(
            manifest["workspaceCapabilities"][1]["modules"][0]["status"],
            "enabled"
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn project_memory_has_a_single_workspace_owner() {
        let root = test_root("memory");
        assert_eq!(load_memory(&root, "project-a")["projectId"], "project-a");
        let memory = save_memory(
            &root,
            "project-a",
            "now",
            json!({ "items": [{ "id": "one" }] }),
        )
        .unwrap();
        assert_eq!(memory["schemaVersion"], MEMORY_SCHEMA_VERSION);
        assert_eq!(load_memory(&root, "project-b")["projectId"], "project-a");
        assert!(root.join(".omnidesk/runtime/events").is_dir());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn legacy_workspace_documents_are_projected_and_rewritten_on_save() {
        let root = test_root("legacy-workspace-documents");
        fs::create_dir_all(root.join(".omnidesk/data")).unwrap();
        fs::write(
            root.join(MEMORY_PATH),
            r#"{"schemaVersion":"project-os.memory.v0.1","projectId":"project-a","items":[]}"#,
        )
        .unwrap();
        fs::write(
            root.join(CAPABILITIES_PATH),
            r#"{"schemaVersion":"project-os.project-capabilities.v0.1","workspaceCapabilities":[]}"#,
        )
        .unwrap();
        let memory = load_memory(&root, "project-a");
        assert_eq!(memory["schemaVersion"], MEMORY_SCHEMA_VERSION);
        assert_eq!(memory["schemaMigration"]["mode"], "read-projection");
        let capabilities = detected_capabilities(&root);
        assert_eq!(capabilities["schemaVersion"], CAPABILITIES_SCHEMA_VERSION);
        assert_eq!(capabilities["schemaMigration"]["mode"], "read-projection");

        save_memory(&root, "project-a", "now", memory).unwrap();
        update_capability(&root, "tasks", "enabled", &[], &[], "now").unwrap();
        let saved_memory = Repository::new(&root).read_json(MEMORY_PATH).unwrap();
        let saved_capabilities = Repository::new(&root).read_json(CAPABILITIES_PATH).unwrap();
        assert_eq!(saved_memory["schemaVersion"], MEMORY_SCHEMA_VERSION);
        assert_eq!(
            saved_capabilities["schemaVersion"],
            CAPABILITIES_SCHEMA_VERSION
        );
        assert!(saved_memory.get("schemaMigration").is_none());
        assert!(saved_capabilities.get("schemaMigration").is_none());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn profile_updates_filter_untrusted_fields_and_emit_one_event() {
        let root = test_root("profile");
        let updated = update_profile(
            &root,
            "project-a",
            "now",
            vec![
                ProfileFieldPatch {
                    key: "product.coreValue".to_string(),
                    value: json!("runtime"),
                    status: "user_confirmed".to_string(),
                    source: "conversation".to_string(),
                    confidence: 2.0,
                    notes: String::new(),
                },
                ProfileFieldPatch {
                    key: "unsafe.path".to_string(),
                    value: json!(true),
                    status: "user_confirmed".to_string(),
                    source: "conversation".to_string(),
                    confidence: 1.0,
                    notes: String::new(),
                },
            ],
        )
        .unwrap();
        assert!(updated);
        let profile = Repository::new(&root).read_json(PROFILE_PATH).unwrap();
        assert_eq!(profile["fields"]["product.coreValue"]["confidence"], 1.0);
        assert!(profile["fields"].get("unsafe.path").is_none());
        assert_eq!(
            fs::read_dir(root.join(".omnidesk/runtime/events"))
                .unwrap()
                .count(),
            1
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn projection_state_centralizes_default_runtime_documents() {
        let root = test_root("projection");
        let state = load_projection_state(&root);
        assert!(state.state.is_none());
        assert_eq!(state.goal_validation_report["status"], "missing");
        assert_eq!(state.project_goals["projectGoals"], json!([]));
    }

    #[test]
    fn project_profile_prefers_confirmed_state_over_markdown_fallbacks() {
        let root = test_root("project-profile");
        fs::create_dir_all(root.join(".omnidesk/data")).unwrap();
        fs::write(
            root.join(STATE_PATH),
            r#"{"description":"已确认的项目概览","stage":"交付中","phase":"active"}"#,
        )
        .unwrap();
        fs::write(
            root.join("PROJECT.md"),
            "# 项目简介\n不应覆盖已确认状态。\n",
        )
        .unwrap();
        fs::write(
            root.join("AGENTS.md"),
            "# Commands\n`bash tests/run-tests.sh`\n",
        )
        .unwrap();

        let profile = build_project_profile(&root, "示例项目");

        assert_eq!(profile.overview, "已确认的项目概览");
        assert_eq!(profile.phase_summary, "交付中");
        assert_eq!(profile.check_commands, "bash tests/run-tests.sh");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn runbook_projection_uses_only_registered_project_commands() {
        let root = test_root("runbook");
        fs::create_dir_all(&root).unwrap();
        fs::write(
            root.join("package.json"),
            r#"{"scripts":{"dev":"vite","test":"node --test","custom":"ignored"}}"#,
        )
        .unwrap();

        let commands = runbook_commands(&root);

        assert_eq!(commands.as_array().unwrap().len(), 2);
        assert_eq!(commands[0]["command"], "npm run dev");
        assert_eq!(
            package_scripts_summary(&root),
            "dev: vite；test: node --test"
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn backlog_update_is_locked_and_emits_one_event() {
        let root = test_root("backlog");
        fs::create_dir_all(root.join(".omnidesk/data")).unwrap();
        fs::write(
            root.join(BACKLOG_PATH),
            r#"{"items":[{"id":"task-1","status":"planned"}]}"#,
        )
        .unwrap();
        update_backlog_item(&root, "task-1", "running", "now").unwrap();
        let backlog = Repository::new(&root).read_json(BACKLOG_PATH).unwrap();
        assert_eq!(backlog["items"][0]["status"], "running");
        assert_eq!(backlog["updatedAt"], "now");
        assert_eq!(
            fs::read_dir(root.join(".omnidesk/runtime/events"))
                .unwrap()
                .count(),
            1
        );
    }

    #[test]
    fn workspace_queue_projects_backlog_before_bounded_recommendations() {
        let queue = workspace_queue(
            &Some(
                json!({ "items": [{ "id": "task-1", "title": "修复", "status": "planned", "goalId": "goal-1" }] }),
            ),
            &Some(
                json!({ "recommendations": [{ "id": "recommendation-1", "title": "检查", "priority": "high", "reason": "需要验证" }] }),
            ),
        );
        assert_eq!(queue.len(), 2);
        assert_eq!(queue[0].id, "task-1");
        assert_eq!(queue[0].goal_id, "goal-1");
        assert_eq!(queue[1].id, "recommendation-1");
        assert_eq!(queue[1].tone, "blue");
    }
}
