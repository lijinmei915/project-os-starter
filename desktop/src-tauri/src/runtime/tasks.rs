use crate::runtime::repository::{JsonMutation, Repository};
use serde_json::Value;
use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

const TASK_SCHEMA_VERSION: &str = "omnidesk.desktop-task.v0.1";
const LEGACY_TASK_SCHEMA_VERSION: &str = "project-os.desktop-task.v0.1";
const TASK_DIRECTORY: &str = ".omnidesk/data/tasks";
const CONVERSATION_DIRECTORY: &str = ".omnidesk/data/conversations";
const GOALS_PATH: &str = ".omnidesk/data/goals.json";
const BACKLOG_PATH: &str = ".omnidesk/data/task-backlog.json";

pub fn directory(root: &Path) -> std::path::PathBuf {
    crate::runtime::state_namespace::state_path_for_read(root, TASK_DIRECTORY)
        .unwrap_or_else(|_| root.join(TASK_DIRECTORY))
}

pub fn list_repository_records(repository: &Repository) -> Result<Vec<(String, Value)>, String> {
    Ok(repository
        .list_json_records(TASK_DIRECTORY)?
        .into_iter()
        .filter(|(relative, _)| !relative.ends_with("/manifest.json"))
        .collect())
}

/// Query-side task service. Mutation migration follows separately because it
/// also owns goal indexes, linked conversations, and backlog cleanup.
pub fn list(root: &Path) -> Result<Vec<Value>, String> {
    let mut tasks = list_repository_records(&Repository::new(root))?
        .into_iter()
        .map(|(_, task)| {
            project_confirmation_title(project_legacy_execution_state(project_task_schema(task)))
        })
        .collect::<Vec<_>>();
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
    Ok(tasks)
}

fn project_confirmation_title(mut task: Value) -> Value {
    let title = task
        .get("title")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .trim_matches(&['。', '！', '!', '，', ',', ' '][..])
        .to_string();
    if ![
        "好",
        "好的",
        "可以",
        "行",
        "继续",
        "开始",
        "执行",
        "就这样",
        "按这个来",
    ]
    .contains(&title.as_str())
    {
        return task;
    }
    let replacement = task
        .pointer("/plan/task")
        .and_then(Value::as_str)
        .or_else(|| task.pointer("/plan/summary").and_then(Value::as_str))
        .map(str::trim)
        .filter(|value| !value.is_empty() && !["好", "好的", "可以", "行", "继续"].contains(value))
        .map(str::to_string);
    let Some(replacement) = replacement else {
        return task;
    };
    let Some(object) = task.as_object_mut() else {
        return task;
    };
    object.insert("title".to_string(), Value::String(replacement));
    object.insert(
        "runtimeMigration".to_string(),
        serde_json::json!({
            "fromTitle": title,
            "reason": "历史确认词标题已按现有计划摘要恢复。",
            "version": "confirmation-title-v1"
        }),
    );
    task
}

// Reading legacy records is non-destructive. The next explicit task write
// persists the OmniDesk identity through save(), while list() remains able to
// project existing user history without a bulk rewrite.
fn project_task_schema(mut task: Value) -> Value {
    if task.get("schemaVersion").and_then(Value::as_str) != Some(LEGACY_TASK_SCHEMA_VERSION) {
        return task;
    }
    let Some(object) = task.as_object_mut() else {
        return task;
    };
    object.insert(
        "schemaVersion".to_string(),
        Value::String(TASK_SCHEMA_VERSION.to_string()),
    );
    object.insert(
        "schemaMigration".to_string(),
        serde_json::json!({
            "from": LEGACY_TASK_SCHEMA_VERSION,
            "mode": "read-projection",
            "to": TASK_SCHEMA_VERSION,
        }),
    );
    task
}

/// Old desktop records can contain a syntactically valid placeholder diff for
/// a plan that explicitly said not to modify files. Keep the stored artifact
/// untouched, but project it as non-applicable so it cannot appear as a live
/// approval after an upgrade.
fn project_legacy_execution_state(mut task: Value) -> Value {
    if task.get("status").and_then(Value::as_str) != Some("waiting approval")
        || task
            .pointer("/patchDraft/notApplicable")
            .and_then(Value::as_bool)
            == Some(true)
        || !legacy_plan_is_validation_only(&task)
    {
        return task;
    }
    let Some(object) = task.as_object_mut() else {
        return task;
    };
    object.insert("status".to_string(), Value::String("planned".to_string()));
    object.insert(
        "runtimeMigration".to_string(),
        serde_json::json!({
            "fromStatus": "waiting approval",
            "reason": "历史计划未声明实际工程改动，旧草稿不再可应用。",
            "version": "semantic-patch-gate-v1"
        }),
    );
    if let Some(draft) = object.get_mut("patchDraft").and_then(Value::as_object_mut) {
        draft.insert("notApplicable".to_string(), Value::Bool(true));
        draft.insert(
            "failureReason".to_string(),
            Value::String("历史计划明确不修改工程文件；该草稿仅保留为证据，不能应用。".to_string()),
        );
    }
    task
}

fn legacy_plan_is_validation_only(task: &Value) -> bool {
    let Some(changes) = task
        .pointer("/plan/candidateChanges")
        .or_else(|| task.pointer("/plan/candidate_changes"))
        .and_then(Value::as_array)
    else {
        return false;
    };
    !changes.is_empty()
        && changes.iter().filter_map(Value::as_str).all(|change| {
            [
                "先不写文件",
                "先不改文件",
                "不自动写文件",
                "不修改文件",
                "只形成",
            ]
            .iter()
            .any(|marker| change.contains(marker))
        })
}

/// Persists a desktop task and synchronizes its goal index as one Repository
/// transaction. Duplicate creation and repeated client requests return the
/// already-persisted task without creating a second state record.
pub fn save(
    root: &Path,
    project_path: &str,
    mut task: Value,
    timestamp: &str,
) -> Result<Value, String> {
    let task_dir = directory(root);
    fs::create_dir_all(&task_dir).map_err(|err| err.to_string())?;
    recover_storage(&task_dir)?;
    Repository::new(root).transaction_with("save-desktop-task", |repository| {
        let id = task
            .get("id")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| "任务缺少 id".to_string())?
            .to_string();
        let task_relative = format!("{TASK_DIRECTORY}/{}.json", safe_file_stem(&id));
        let is_new = repository.read_json(&task_relative).is_none();
        if is_new {
            let title = normalized_title(&task);
            let goal_id = task.get("goalId").and_then(Value::as_str).unwrap_or("");
            if !title.is_empty() && is_open(&task) {
                for (_, existing) in list_repository_records(repository)? {
                    if is_open(&existing)
                        && existing.get("goalId").and_then(Value::as_str).unwrap_or("") == goal_id
                        && normalized_title(&existing) == title
                    {
                        let mut result = existing;
                        if let Some(object) = result.as_object_mut() {
                            object.insert("deduplicated".to_string(), Value::Bool(true));
                        }
                        return Ok((result, Vec::new()));
                    }
                }
            }
        }
        if let Some(request_id) = task
            .get("requestId")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            for (_, existing) in list_repository_records(repository)? {
                if existing
                    .get("requestId")
                    .and_then(Value::as_str)
                    .map(str::trim)
                    == Some(request_id)
                    && existing.get("id").and_then(Value::as_str) != Some(id.as_str())
                {
                    return Ok((existing, Vec::new()));
                }
            }
        }
        let object = task
            .as_object_mut()
            .ok_or_else(|| "任务记录必须是 JSON object".to_string())?;
        object.insert(
            "schemaVersion".to_string(),
            Value::String(TASK_SCHEMA_VERSION.to_string()),
        );
        object.remove("schemaMigration");
        object.insert(
            "updatedAt".to_string(),
            Value::String(timestamp.to_string()),
        );
        object.insert(
            "projectPath".to_string(),
            Value::String(project_path.to_string()),
        );
        mark_persisted(&mut task, &id, timestamp);
        let mut mutations = vec![JsonMutation::upsert(task_relative, task.clone())];
        let goal_id = task.get("goalId").and_then(Value::as_str).unwrap_or("");
        if let Some(mut goals) = repository.read_json(GOALS_PATH) {
            crate::runtime::goals::rebind_task(&mut goals, &id, goal_id, timestamp);
            mutations.push(JsonMutation::upsert(GOALS_PATH, goals));
        }
        Ok((task, mutations))
    })
}

fn safe_file_stem(id: &str) -> String {
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

fn normalized_title(task: &Value) -> String {
    task.get("title")
        .and_then(Value::as_str)
        .unwrap_or("")
        .split_whitespace()
        .collect::<String>()
        .to_lowercase()
}

fn is_open(task: &Value) -> bool {
    task.get("archivedAt").is_none_or(Value::is_null)
        && !matches!(
            task.get("status")
                .and_then(Value::as_str)
                .unwrap_or("")
                .trim(),
            "done" | "failed" | "cancelled"
        )
}

fn mark_persisted(task: &mut Value, task_id: &str, timestamp: &str) {
    let Some(trace) = task.get_mut("requestTrace").and_then(Value::as_object_mut) else {
        return;
    };
    trace.insert(
        "outcome".to_string(),
        Value::String("succeeded".to_string()),
    );
    trace.insert(
        "persistedAt".to_string(),
        Value::String(timestamp.to_string()),
    );
    trace.insert("runtime".to_string(), Value::String("tauri".to_string()));
    trace.insert("taskId".to_string(), Value::String(task_id.to_string()));
}

pub fn recover_storage(task_dir: &Path) -> Result<(), String> {
    if !task_dir.exists() {
        return Ok(());
    }
    let stale_before = SystemTime::now()
        .checked_sub(std::time::Duration::from_secs(60 * 60))
        .unwrap_or(UNIX_EPOCH);
    let quarantine_dir = task_dir.join("quarantine");
    for entry in fs::read_dir(task_dir).map_err(|err| err.to_string())? {
        let path = entry.map_err(|err| err.to_string())?.path();
        if !path.is_file() {
            continue;
        }
        let name = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("");
        if name.ends_with(".tmp") {
            if fs::metadata(&path)
                .and_then(|metadata| metadata.modified())
                .unwrap_or(SystemTime::now())
                < stale_before
            {
                let _ = fs::remove_file(&path);
            }
            continue;
        }
        if !name.ends_with(".json") || name == "manifest.json" || read_json(&path).is_some() {
            continue;
        }
        fs::create_dir_all(&quarantine_dir).map_err(|err| err.to_string())?;
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        fs::rename(
            &path,
            quarantine_dir.join(format!("{name}.{nonce}.corrupt")),
        )
        .map_err(|err| err.to_string())?;
    }
    Ok(())
}

fn read_json(path: &Path) -> Option<Value> {
    fs::read_to_string(path)
        .ok()
        .and_then(|content| serde_json::from_str(&content).ok())
}

/// Deletes one task and every state projection owned by it in one Repository
/// transaction: task, task conversation, goal index, and backlog item.
pub fn delete(root: &Path, id: &str, timestamp: &str) -> Result<(), String> {
    let id = id.trim();
    if id.is_empty() {
        return Err("任务 id 不能为空".to_string());
    }
    Repository::new(root).transaction_with("delete-desktop-task", |repository| {
        let task_relative = format!("{TASK_DIRECTORY}/{}.json", safe_file_stem(id));
        let task = repository.read_json(&task_relative);
        let task_conversation_id = task.as_ref().and_then(|task| {
            task.get("conversationId")
                .and_then(Value::as_str)
                .map(str::to_string)
        });
        let mut mutations = Vec::new();
        if task.is_some() {
            mutations.push(JsonMutation::delete(task_relative));
        }
        for (relative, conversation) in repository.list_json_records(CONVERSATION_DIRECTORY)? {
            let belongs_to_task = conversation.get("taskId").and_then(Value::as_str) == Some(id)
                || task_conversation_id.as_deref()
                    == conversation.get("id").and_then(Value::as_str);
            if belongs_to_task {
                mutations.push(JsonMutation::delete(relative));
            }
        }
        for (relative_path, collection_key) in [(GOALS_PATH, "goals"), (BACKLOG_PATH, "items")] {
            let Some(mut document) = repository.read_json(relative_path) else {
                continue;
            };
            if collection_key == "goals" {
                if let Some(goals) = document.get_mut("goals").and_then(Value::as_array_mut) {
                    for goal in goals {
                        for field in ["taskIds", "decompositionTaskIds"] {
                            if let Some(task_ids) =
                                goal.get_mut(field).and_then(Value::as_array_mut)
                            {
                                task_ids.retain(|task_id| task_id.as_str() != Some(id));
                            }
                        }
                    }
                }
            } else if let Some(items) = document.get_mut("items").and_then(Value::as_array_mut) {
                items.retain(|item| item.get("id").and_then(Value::as_str) != Some(id));
            }
            if let Some(object) = document.as_object_mut() {
                object.insert(
                    "updatedAt".to_string(),
                    Value::String(timestamp.to_string()),
                );
            }
            mutations.push(JsonMutation::upsert(relative_path, document));
        }
        Ok(((), mutations))
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn lists_newest_task_first_and_ignores_manifest() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-tasks-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let directory = root.join(TASK_DIRECTORY);
        fs::create_dir_all(&directory).unwrap();
        fs::write(directory.join("manifest.json"), r#"{"updatedAt":"999"}"#).unwrap();
        fs::write(
            directory.join("first.json"),
            r#"{"id":"first","updatedAt":"1"}"#,
        )
        .unwrap();
        fs::write(
            directory.join("latest.json"),
            r#"{"id":"latest","updatedAt":"2"}"#,
        )
        .unwrap();
        assert_eq!(list(&root).unwrap()[0]["id"], "latest");
    }

    #[test]
    fn projects_legacy_non_writing_drafts_out_of_approval() {
        let projected = project_legacy_execution_state(serde_json::json!({
            "id": "legacy-check",
            "status": "waiting approval",
            "patchDraft": { "diff": "--- a/HANDOFF.md\n+++ b/HANDOFF.md" },
            "plan": { "candidateChanges": ["先不写文件，只形成下一步建议。"] }
        }));
        assert_eq!(projected["status"], "planned");
        assert_eq!(projected["patchDraft"]["notApplicable"], true);
        assert_eq!(
            projected["runtimeMigration"]["version"],
            "semantic-patch-gate-v1"
        );
    }

    #[test]
    fn projects_legacy_task_schema_without_rewriting_history() {
        let projected = project_task_schema(serde_json::json!({
            "schemaVersion": "project-os.desktop-task.v0.1",
            "id": "legacy-task"
        }));
        assert_eq!(projected["schemaVersion"], TASK_SCHEMA_VERSION);
        assert_eq!(
            projected["schemaMigration"]["from"],
            LEGACY_TASK_SCHEMA_VERSION
        );
        assert_eq!(projected["schemaMigration"]["mode"], "read-projection");
    }

    #[test]
    fn projects_confirmation_word_titles_from_existing_plan_evidence() {
        let projected = project_confirmation_title(serde_json::json!({
            "id": "confirmation-title",
            "title": "可以",
            "plan": { "summary": "修复对话状态机" }
        }));
        assert_eq!(projected["title"], "修复对话状态机");
        assert_eq!(
            projected["runtimeMigration"]["version"],
            "confirmation-title-v1"
        );
    }

    #[test]
    fn delete_removes_all_task_owned_state_in_one_transaction() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-task-delete-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let task_dir = root.join(TASK_DIRECTORY);
        let conversation_dir = root.join(CONVERSATION_DIRECTORY);
        fs::create_dir_all(&task_dir).unwrap();
        fs::create_dir_all(&conversation_dir).unwrap();
        fs::write(task_dir.join("task-1.json"), r#"{"schemaVersion":"project-os.desktop-task.v0.1","id":"task-1","conversationId":"conversation-1"}"#).unwrap();
        fs::write(conversation_dir.join("conversation-1.json"), r#"{"schemaVersion":"project-os.desktop-conversation.v0.1","id":"conversation-1","taskId":"task-1"}"#).unwrap();
        fs::write(
            root.join(GOALS_PATH),
            r#"{"goals":[{"id":"goal-1","decompositionTaskIds":["task-1"],"taskIds":["task-1"]}]}"#,
        )
        .unwrap();
        fs::write(root.join(BACKLOG_PATH), r#"{"items":[{"id":"task-1"}]}"#).unwrap();
        delete(&root, "task-1", "now").unwrap();
        assert!(!task_dir.join("task-1.json").exists());
        assert!(!conversation_dir.join("conversation-1.json").exists());
        assert_eq!(
            read_json(&root.join(GOALS_PATH)).unwrap()["goals"][0]["taskIds"],
            serde_json::json!([])
        );
        assert_eq!(
            read_json(&root.join(GOALS_PATH)).unwrap()["goals"][0]["decompositionTaskIds"],
            serde_json::json!([])
        );
    }

    #[test]
    fn save_is_idempotent_deduplicates_and_rebinds_goal() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-task-save-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(root.join(".omnidesk/data")).unwrap();
        fs::write(
            root.join(GOALS_PATH),
            r#"{"goals":[{"id":"goal-a","taskIds":["task-old"]},{"id":"goal-b","taskIds":[]}]}"#,
        )
        .unwrap();
        let saved = save(&root, "/project", serde_json::json!({"id":"task-new","requestId":"request-1","goalId":"goal-b","title":"Refactor runtime","requestTrace":{"requestId":"request-1"}}), "now").unwrap();
        assert_eq!(saved["schemaVersion"], TASK_SCHEMA_VERSION);
        assert!(saved.get("schemaMigration").is_none());
        assert_eq!(saved["requestTrace"]["taskId"], "task-new");
        assert_eq!(saved["requestTrace"]["runtime"], "tauri");
        let goals = read_json(&root.join(GOALS_PATH)).unwrap();
        assert_eq!(
            goals["goals"][1]["taskIds"],
            serde_json::json!(["task-new"])
        );
        let repeated = save(&root, "/project", serde_json::json!({"id":"another-id","requestId":"request-1","goalId":"goal-b","title":"Different title"}), "later").unwrap();
        assert_eq!(repeated["id"], "task-new");
        let duplicate = save(&root, "/project", serde_json::json!({"id":"duplicate-id","goalId":"goal-b","title":" Refactor  runtime "}), "later").unwrap();
        assert_eq!(duplicate["id"], "task-new");
        assert_eq!(duplicate["deduplicated"], true);
    }

    #[test]
    fn recovery_preserves_recent_temp_and_quarantines_corrupt_json() {
        let directory = std::env::temp_dir().join(format!(
            "omnidesk-task-recovery-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&directory).unwrap();
        fs::write(directory.join("recent.tmp"), "partial").unwrap();
        fs::write(directory.join("broken.json"), "{").unwrap();
        recover_storage(&directory).unwrap();
        assert!(directory.join("recent.tmp").exists());
        assert!(!directory.join("broken.json").exists());
        assert_eq!(
            fs::read_dir(directory.join("quarantine")).unwrap().count(),
            1
        );
    }

    #[test]
    fn project_roots_keep_task_conversation_and_agent_run_state_isolated() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let first = std::env::temp_dir().join(format!("omnidesk-isolation-first-{nonce}"));
        let second = std::env::temp_dir().join(format!("omnidesk-isolation-second-{nonce}"));
        save(
            &first,
            "/first",
            serde_json::json!({"id":"task-same","title":"First task"}),
            "first",
        )
        .unwrap();
        save(
            &second,
            "/second",
            serde_json::json!({"id":"task-same","title":"Second task"}),
            "second",
        )
        .unwrap();
        crate::runtime::conversations::save(
            &first,
            "/first",
            serde_json::json!({"id":"conversation-same","turns":[]}),
            "first",
        )
        .unwrap();
        crate::runtime::conversations::save(
            &second,
            "/second",
            serde_json::json!({"id":"conversation-same","turns":[]}),
            "second",
        )
        .unwrap();
        let run = crate::runtime::agent_runs::new_hermes_run(
            "run-same".to_string(),
            String::new(),
            "first".to_string(),
            "first".to_string(),
            1,
            String::new(),
            "first",
        );
        crate::runtime::agent_runs::persist(&first, &run).unwrap();

        assert_eq!(list(&first).unwrap()[0]["projectPath"], "/first");
        assert_eq!(list(&second).unwrap()[0]["projectPath"], "/second");
        assert_eq!(
            crate::runtime::conversations::list(&first).unwrap()[0]["projectPath"],
            "/first"
        );
        assert_eq!(
            crate::runtime::conversations::list(&second).unwrap()[0]["projectPath"],
            "/second"
        );
        assert_eq!(crate::runtime::agent_runs::list(&first).unwrap().len(), 1);
        assert!(crate::runtime::agent_runs::list(&second)
            .unwrap()
            .is_empty());
    }
}
