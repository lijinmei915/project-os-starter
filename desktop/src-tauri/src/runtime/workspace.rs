use crate::runtime::repository::{JsonMutation, Repository};
use serde::Deserialize;
use serde_json::{json, Value};
use std::fs;
use std::path::Path;
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
        json!({ "schemaVersion": "project-os.fact-freshness.v0.1", "updatedAt": timestamp, "fingerprints": source_fingerprints(root) }),
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
            vec![
                PROVIDER_PATH,
                MODEL_CATALOG_PATH,
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
            crate::runtime::state_namespace::state_path_exists(root, MODEL_CATALOG_PATH) || package_text.contains("openai"),
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
    json!({ "schemaVersion": "project-os.project-capabilities.v0.1", "updatedAt": saved.as_ref().and_then(|value| value.get("updatedAt")).and_then(Value::as_str).unwrap_or(""), "capabilities": capabilities.clone(), "workspaceCapabilities": capabilities, "domainCapabilities": domain_capabilities })
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
        let mut manifest = repository.read_json(CAPABILITIES_PATH).unwrap_or_else(|| {
            json!({ "schemaVersion": "project-os.project-capabilities.v0.1", "capabilities": [] })
        });
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
    Repository::new(root)
        .read_json(MEMORY_PATH)
        .unwrap_or_else(|| {
            json!({
                "schemaVersion": "project-os.memory.v0.1",
                "projectId": project_id,
                "updatedAt": "",
                "items": []
            })
        })
}

/// Loads the persisted state consumed by the Workspace snapshot projection.
/// The Tauri adapter owns presentation DTO composition, while this operation
/// keeps all project-state paths and default documents in one domain module.
pub fn load_projection_state(root: &Path) -> WorkspaceProjectionState {
    let repository = Repository::new(root);
    WorkspaceProjectionState {
        state: repository.read_json(STATE_PATH),
        recommendations: repository.read_json(".omnidesk/cache/recommendations/recommend-next.json"),
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
        Value::String("project-os.memory.v0.1".to_string()),
    );
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
            json!({ "schemaVersion": "project-os.project-profile.v0.1", "projectId": project_id, "updatedAt": "", "fields": {} })
        });
        profile["schemaVersion"] = json!("project-os.project-profile.v0.1");
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
        assert_eq!(memory["schemaVersion"], "project-os.memory.v0.1");
        assert_eq!(load_memory(&root, "project-b")["projectId"], "project-a");
        assert!(root.join(".omnidesk/runtime/events").is_dir());
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
}
