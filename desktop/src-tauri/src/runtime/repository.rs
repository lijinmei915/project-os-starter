use serde_json::{json, Value};
use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::process;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// The sole persistence boundary for project-local OmniDesk state.
/// Domain services must provide paths relative to the workspace root.
#[derive(Clone, Debug)]
pub struct Repository {
    root: PathBuf,
}

#[derive(Clone, Debug)]
pub struct JsonMutation {
    pub relative_path: String,
    pub value: Option<Value>,
}

/// A UTF-8 text mutation for project documents such as HANDOFF.md. Text is
/// intentionally separate from JSON runtime records so governance documents
/// do not inherit runtime JSON schema requirements.
#[derive(Clone, Debug)]
pub struct TextMutation {
    pub relative_path: String,
    pub content: Option<String>,
}

impl TextMutation {
    pub fn upsert(relative_path: impl Into<String>, content: impl Into<String>) -> Self {
        Self {
            relative_path: relative_path.into(),
            content: Some(content.into()),
        }
    }
}

impl JsonMutation {
    pub fn upsert(relative_path: impl Into<String>, value: Value) -> Self {
        Self {
            relative_path: relative_path.into(),
            value: Some(value),
        }
    }

    pub fn delete(relative_path: impl Into<String>) -> Self {
        Self {
            relative_path: relative_path.into(),
            value: None,
        }
    }
}

impl Repository {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }

    pub fn read_json(&self, relative_path: &str) -> Option<Value> {
        let path = self.resolve_for_read(relative_path).ok()?;
        fs::read_to_string(path)
            .ok()
            .and_then(|content| serde_json::from_str(&content).ok())
    }

    pub fn read_text(&self, relative_path: &str) -> Option<String> {
        let path = self.resolve_for_read(relative_path).ok()?;
        fs::read_to_string(path).ok()
    }

    /// Lists JSON records below one workspace-relative directory without
    /// exposing absolute paths to domain services.
    pub fn list_json_records(
        &self,
        relative_directory: &str,
    ) -> Result<Vec<(String, Value)>, String> {
        let directory = self.resolve_for_read(relative_directory)?;
        if !directory.exists() {
            return Ok(Vec::new());
        }
        let mut records = fs::read_dir(&directory)
            .map_err(|err| err.to_string())?
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .filter(|path| {
                path.extension().and_then(|extension| extension.to_str()) == Some("json")
            })
            .filter_map(|path| {
                let relative = path
                    .strip_prefix(&self.root)
                    .ok()?
                    .to_string_lossy()
                    .replace('\\', "/");
                let value = fs::read_to_string(path)
                    .ok()
                    .and_then(|content| serde_json::from_str::<Value>(&content).ok())?;
                Some((relative, value))
            })
            .collect::<Vec<_>>();
        records.sort_by(|(left, _), (right, _)| left.cmp(right));
        Ok(records)
    }

    pub fn write_json(&self, relative_path: &str, value: &Value) -> Result<(), String> {
        validate_state_schema(relative_path, value)?;
        let path = self.resolve_for_write(relative_path)?;
        let content = serde_json::to_vec_pretty(value).map_err(|err| err.to_string())?;
        write_atomic(&path, &[content, b"\n".to_vec()].concat())
    }

    pub fn transaction(
        &self,
        operation: &str,
        mutations: &[JsonMutation],
    ) -> Result<Value, String> {
        self.recover_incomplete_transactions()?;
        let _lock = RepositoryLock::acquire(&self.root)?;
        self.commit_transaction(operation, mutations)
    }

    /// Builds and commits mutations while the Repository lock is held. Use for
    /// read-modify-write domain operations so source reads cannot race a
    /// concurrent state update between preparation and commit.
    pub fn transaction_with<T, F>(&self, operation: &str, prepare: F) -> Result<T, String>
    where
        F: FnOnce(&Repository) -> Result<(T, Vec<JsonMutation>), String>,
    {
        self.recover_incomplete_transactions()?;
        let _lock = RepositoryLock::acquire(&self.root)?;
        let (result, mutations) = prepare(self)?;
        if mutations.is_empty() {
            return Ok(result);
        }
        self.commit_transaction(operation, &mutations)?;
        Ok(result)
    }

    /// Equivalent to `transaction_with`, for UTF-8 governance documents.
    /// Text snapshots are recorded in the journal so interrupted operations can
    /// restore the exact prior Markdown instead of attempting JSON parsing.
    pub fn text_transaction_with<T, F>(&self, operation: &str, prepare: F) -> Result<T, String>
    where
        F: FnOnce(&Repository) -> Result<(T, Vec<TextMutation>), String>,
    {
        self.recover_incomplete_transactions()?;
        let _lock = RepositoryLock::acquire(&self.root)?;
        let (result, mutations) = prepare(self)?;
        if mutations.is_empty() {
            return Ok(result);
        }
        self.commit_text_transaction(operation, &mutations)?;
        Ok(result)
    }

    fn commit_transaction(
        &self,
        operation: &str,
        mutations: &[JsonMutation],
    ) -> Result<Value, String> {
        if operation.trim().is_empty() {
            return Err("事务操作名不能为空".to_string());
        }
        if mutations.is_empty() {
            return Err("事务至少需要一个状态变更".to_string());
        }

        let transaction_id = format!("{}-{}", operation, timestamp_millis());
        let staged = mutations
            .iter()
            .map(|mutation| {
                if let Some(value) = mutation.value.as_ref() {
                    validate_state_schema(&mutation.relative_path, value)?;
                }
                let path = self.resolve_for_write(&mutation.relative_path)?;
                let content = mutation
                    .value
                    .as_ref()
                    .map(|value| serde_json::to_vec_pretty(value).map_err(|err| err.to_string()))
                    .transpose()?
                    .map(|content| [content, b"\n".to_vec()].concat());
                let previous = fs::read_to_string(&path)
                    .ok()
                    .and_then(|content| serde_json::from_str::<Value>(&content).ok());
                Ok((path, content, mutation.relative_path.clone(), previous))
            })
            .collect::<Result<Vec<_>, String>>()?;

        let journal_path = self.transaction_path(&transaction_id);
        let mut journal = json!({
            "schemaVersion": "omnidesk.repository-transaction.v0.1",
            "id": transaction_id,
            "operation": operation,
            "state": "prepared",
            "timestamp": timestamp_string(),
            "mutations": staged.iter().map(|(_, _, relative, previous)| json!({ "path": relative, "previous": previous })).collect::<Vec<_>>(),
        });
        write_atomic(
            &journal_path,
            &[
                serde_json::to_vec_pretty(&journal).map_err(|err| err.to_string())?,
                b"\n".to_vec(),
            ]
            .concat(),
        )?;

        for (path, content, _, _) in &staged {
            let result = match content {
                Some(content) => write_atomic(path, content),
                None if path.exists() => fs::remove_file(path).map_err(|err| err.to_string()),
                None => Ok(()),
            };
            if let Err(error) = result {
                let _ = self.restore_journal(&journal);
                return Err(error);
            }
        }

        journal["state"] = Value::String("committed".to_string());
        journal["committedAt"] = Value::String(timestamp_string());
        write_atomic(
            &journal_path,
            &[
                serde_json::to_vec_pretty(&journal).map_err(|err| err.to_string())?,
                b"\n".to_vec(),
            ]
            .concat(),
        )?;

        let event = json!({
            "schemaVersion": "omnidesk.repository-event.v0.1",
            "id": transaction_id,
            "operation": operation,
            "timestamp": timestamp_string(),
            "paths": staged.iter().map(|(_, _, relative, _)| relative).collect::<Vec<_>>(),
        });
        let event_path = crate::runtime::state_namespace::state_path_for_write(
            &self.root,
            ".omnidesk/runtime/events",
        )?
        .join(format!("{}.json", event["id"].as_str().unwrap_or("event")));
        write_atomic(
            &event_path,
            &[
                serde_json::to_vec_pretty(&event).map_err(|err| err.to_string())?,
                b"\n".to_vec(),
            ]
            .concat(),
        )?;
        Ok(event)
    }

    fn commit_text_transaction(
        &self,
        operation: &str,
        mutations: &[TextMutation],
    ) -> Result<Value, String> {
        if operation.trim().is_empty() {
            return Err("事务操作名不能为空".to_string());
        }
        if mutations.is_empty() {
            return Err("事务至少需要一个状态变更".to_string());
        }

        let transaction_id = format!("{}-{}", operation, timestamp_millis());
        let staged = mutations
            .iter()
            .map(|mutation| {
                let path = self.resolve_for_write(&mutation.relative_path)?;
                let previous = fs::read_to_string(&path).ok();
                Ok((
                    path,
                    mutation.content.clone(),
                    mutation.relative_path.clone(),
                    previous,
                ))
            })
            .collect::<Result<Vec<_>, String>>()?;
        let journal_path = self.transaction_path(&transaction_id);
        let mut journal = json!({
            "schemaVersion": "omnidesk.repository-transaction.v0.1",
            "id": transaction_id,
            "operation": operation,
            "state": "prepared",
            "timestamp": timestamp_string(),
            "mutations": staged.iter().map(|(_, _, relative, previous)| json!({
                "path": relative,
                "kind": "text",
                "previous": previous
            })).collect::<Vec<_>>(),
        });
        write_atomic(
            &journal_path,
            &[
                serde_json::to_vec_pretty(&journal).map_err(|err| err.to_string())?,
                b"\n".to_vec(),
            ]
            .concat(),
        )?;

        for (path, content, _, _) in &staged {
            let result = match content {
                Some(content) => write_atomic(path, content.as_bytes()),
                None if path.exists() => fs::remove_file(path).map_err(|err| err.to_string()),
                None => Ok(()),
            };
            if let Err(error) = result {
                let _ = self.restore_journal(&journal);
                return Err(error);
            }
        }

        journal["state"] = Value::String("committed".to_string());
        journal["committedAt"] = Value::String(timestamp_string());
        write_atomic(
            &journal_path,
            &[
                serde_json::to_vec_pretty(&journal).map_err(|err| err.to_string())?,
                b"\n".to_vec(),
            ]
            .concat(),
        )?;
        let event = json!({
            "schemaVersion": "omnidesk.repository-event.v0.1",
            "id": transaction_id,
            "operation": operation,
            "timestamp": timestamp_string(),
            "paths": staged.iter().map(|(_, _, relative, _)| relative).collect::<Vec<_>>(),
        });
        let event_path = crate::runtime::state_namespace::state_path_for_write(
            &self.root,
            ".omnidesk/runtime/events",
        )?
        .join(format!("{}.json", event["id"].as_str().unwrap_or("event")));
        write_atomic(
            &event_path,
            &[
                serde_json::to_vec_pretty(&event).map_err(|err| err.to_string())?,
                b"\n".to_vec(),
            ]
            .concat(),
        )?;
        Ok(event)
    }

    pub fn recover_incomplete_transactions(&self) -> Result<(), String> {
        let directory = crate::runtime::state_namespace::state_path_for_read(
            &self.root,
            ".omnidesk/runtime/transactions",
        )?;
        let Ok(entries) = fs::read_dir(&directory) else {
            return Ok(());
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let Some(mut journal) = fs::read_to_string(&path)
                .ok()
                .and_then(|content| serde_json::from_str::<Value>(&content).ok())
            else {
                continue;
            };
            if journal.get("state").and_then(Value::as_str) != Some("prepared") {
                continue;
            }
            self.restore_journal(&journal)?;
            journal["state"] = Value::String("rolled-back".to_string());
            journal["recoveredAt"] = Value::String(timestamp_string());
            write_atomic(
                &path,
                &[
                    serde_json::to_vec_pretty(&journal).map_err(|err| err.to_string())?,
                    b"\n".to_vec(),
                ]
                .concat(),
            )?;
        }
        Ok(())
    }

    fn transaction_path(&self, transaction_id: &str) -> PathBuf {
        crate::runtime::state_namespace::state_path_for_write(
            &self.root,
            ".omnidesk/runtime/transactions",
        )
        .unwrap_or_else(|_| self.root.join(".omnidesk/runtime/transactions"))
        .join(format!("{transaction_id}.json"))
    }

    fn restore_journal(&self, journal: &Value) -> Result<(), String> {
        for mutation in journal
            .get("mutations")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            let relative = mutation
                .get("path")
                .and_then(Value::as_str)
                .ok_or_else(|| "事务记录缺少路径".to_string())?;
            let path = self.resolve_for_write(relative)?;
            match mutation.get("previous") {
                Some(Value::Null) | None => {
                    if path.exists() {
                        fs::remove_file(&path).map_err(|err| err.to_string())?;
                    }
                }
                Some(previous) if mutation.get("kind").and_then(Value::as_str) == Some("text") => {
                    let content = previous
                        .as_str()
                        .ok_or_else(|| "文本事务记录损坏".to_string())?;
                    write_atomic(&path, content.as_bytes())?;
                }
                Some(previous) => self.write_json(relative, previous)?,
            }
        }
        Ok(())
    }

    fn validate_relative(&self, relative_path: &str) -> Result<(), String> {
        let relative = Path::new(relative_path);
        if relative_path.trim().is_empty()
            || relative.is_absolute()
            || relative.components().any(|component| {
                matches!(
                    component,
                    Component::ParentDir | Component::RootDir | Component::Prefix(_)
                )
            })
        {
            return Err("状态路径必须位于项目根目录内".to_string());
        }
        Ok(())
    }

    fn resolve_for_read(&self, relative_path: &str) -> Result<PathBuf, String> {
        self.validate_relative(relative_path)?;
        crate::runtime::state_namespace::state_path_for_read(&self.root, relative_path)
    }

    fn resolve_for_write(&self, relative_path: &str) -> Result<PathBuf, String> {
        self.validate_relative(relative_path)?;
        crate::runtime::state_namespace::state_path_for_write(&self.root, relative_path)
    }
}

/// Runtime records are restored across launches, so an unversioned payload is
/// not safe to persist. Governance documents migrate on their own schedule;
/// this strict boundary starts with task, conversation, and Agent Run state.
fn validate_state_schema(relative_path: &str, value: &Value) -> Result<(), String> {
    if !relative_path.starts_with(".project-os/runs/")
        && !relative_path.starts_with(".omnidesk/data/tasks/")
        && !relative_path.starts_with(".omnidesk/data/conversations/")
        && !relative_path.starts_with(".omnidesk/data/agent-runs/")
    {
        return Ok(());
    }
    if !value.is_object() {
        return Err("运行状态必须是 JSON object".to_string());
    }
    let version = value
        .get("schemaVersion")
        .and_then(Value::as_str)
        .unwrap_or("");
    if version.trim().is_empty() {
        return Err(format!("运行状态缺少 schemaVersion：{relative_path}"));
    }
    Ok(())
}

pub fn write_atomic(path: &Path, content: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "目标文件缺少父目录".to_string())?;
    fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("state.json");
    let temp_path = parent.join(format!(
        ".{file_name}.{}.{}.tmp",
        process::id(),
        timestamp_millis()
    ));
    let result = (|| -> Result<(), String> {
        let mut file = fs::File::create(&temp_path).map_err(|err| err.to_string())?;
        file.write_all(content).map_err(|err| err.to_string())?;
        file.sync_all().map_err(|err| err.to_string())?;
        fs::rename(&temp_path, path).map_err(|err| err.to_string())?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp_path);
    }
    result
}

struct RepositoryLock {
    path: PathBuf,
}

impl RepositoryLock {
    fn acquire(root: &Path) -> Result<Self, String> {
        let path =
            crate::runtime::state_namespace::state_path_for_write(root, ".omnidesk/runtime/locks")?
                .join("omnidesk-repository.lock");
        let parent = path.parent().ok_or_else(|| "锁目录无效".to_string())?;
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
        for _ in 0..20 {
            match fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&path)
            {
                Ok(mut file) => {
                    file.write_all(timestamp_string().as_bytes())
                        .map_err(|err| err.to_string())?;
                    return Ok(Self { path });
                }
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                    let stale = fs::metadata(&path)
                        .and_then(|metadata| metadata.modified())
                        .ok()
                        .and_then(|modified| SystemTime::now().duration_since(modified).ok())
                        .is_some_and(|age| age > Duration::from_secs(30));
                    if stale {
                        let _ = fs::remove_file(&path);
                    } else {
                        std::thread::sleep(Duration::from_millis(15));
                    }
                }
                Err(error) => return Err(error.to_string()),
            }
        }
        Err("项目状态正被另一项操作更新，请稍后重试".to_string())
    }
}

impl Drop for RepositoryLock {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}

fn timestamp_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn timestamp_string() -> String {
    format!("{}", timestamp_millis())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_root(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "omnidesk-repository-{label}-{}",
            timestamp_millis()
        ))
    }

    #[test]
    fn rejects_escape_paths() {
        let repository = Repository::new(test_root("escape"));
        assert!(repository
            .write_json("../outside.json", &json!({}))
            .is_err());
    }

    #[test]
    fn commits_mutations_and_emits_an_event() {
        let root = test_root("transaction");
        let repository = Repository::new(&root);
        let event = repository
            .transaction(
                "task-rebind",
                &[
                    JsonMutation {
                        relative_path: ".project-os/goals.json".to_string(),
                        value: Some(
                            json!({ "schemaVersion": "project-os.goals.v0.1", "goals": [] }),
                        ),
                    },
                    JsonMutation {
                        relative_path: ".project-os/runs/desktop-tasks/task-1.json".to_string(),
                        value: Some(json!({ "schemaVersion": "project-os.desktop-task.v0.1", "id": "task-1", "goalId": "goal-a" })),
                    },
                ],
            )
            .unwrap();
        assert_eq!(
            repository
                .read_json(".project-os/runs/desktop-tasks/task-1.json")
                .unwrap()["goalId"],
            "goal-a"
        );
        assert!(root
            .join(".omnidesk/runtime/events")
            .join(format!("{}.json", event["id"].as_str().unwrap()))
            .exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn active_namespace_routes_logical_legacy_paths_to_partitioned_storage() {
        let root = test_root("active-namespace");
        write_atomic(
            &root.join(".project-os/goals.json"),
            br#"{"schemaVersion":"omnidesk.goals.v0.1","goals":[]}"#,
        )
        .unwrap();
        crate::runtime::state_namespace::ensure_active_state_namespace(&root).unwrap();

        let repository = Repository::new(&root);
        repository
            .transaction(
                "update-goals",
                &[JsonMutation::upsert(
                    ".project-os/goals.json",
                    json!({ "schemaVersion": "omnidesk.goals.v0.1", "goals": [{ "id": "g1" }] }),
                )],
            )
            .unwrap();

        assert_eq!(
            repository.read_json(".project-os/goals.json").unwrap()["goals"][0]["id"],
            "g1"
        );
        assert_eq!(
            fs::read_to_string(root.join(".project-os/goals.json")).unwrap(),
            r#"{"schemaVersion":"omnidesk.goals.v0.1","goals":[]}"#
        );
        assert!(root.join(".omnidesk/data/goals.json").is_file());
        assert!(root.join(".omnidesk/runtime/events").is_dir());
        assert!(root.join(".omnidesk/runtime/transactions").is_dir());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn prepares_read_modify_write_while_holding_the_repository_lock() {
        let root = test_root("locked-prepare");
        let repository = Repository::new(&root);
        repository
            .transaction(
                "seed",
                &[JsonMutation::upsert(
                    ".project-os/state.json",
                    json!({"value": 1}),
                )],
            )
            .unwrap();
        let result = repository
            .transaction_with("increment", |repository| {
                let value = repository.read_json(".project-os/state.json").unwrap()["value"]
                    .as_i64()
                    .unwrap();
                Ok((
                    value + 1,
                    vec![JsonMutation::upsert(
                        ".project-os/state.json",
                        json!({"value": value + 1}),
                    )],
                ))
            })
            .unwrap();
        assert_eq!(result, 2);
        assert_eq!(
            repository.read_json(".project-os/state.json").unwrap()["value"],
            2
        );
    }

    #[test]
    fn rejects_unversioned_runtime_records() {
        let repository = Repository::new(test_root("schema"));
        let error = repository
            .transaction(
                "save-task",
                &[JsonMutation::upsert(
                    ".project-os/runs/desktop-tasks/task-1.json",
                    json!({ "id": "task-1" }),
                )],
            )
            .unwrap_err();
        assert!(error.contains("schemaVersion"));
    }

    #[test]
    fn restores_prepared_transaction_before_a_following_operation() {
        let root = test_root("recovery");
        let repository = Repository::new(&root);
        repository
            .write_json(".project-os/goals.json", &json!({ "before": true }))
            .unwrap();
        let transaction_dir = root.join(".omnidesk/runtime/transactions");
        fs::create_dir_all(&transaction_dir).unwrap();
        write_atomic(
            &transaction_dir.join("interrupted.json"),
            serde_json::to_string_pretty(&json!({
                "schemaVersion": "omnidesk.repository-transaction.v0.1",
                "state": "prepared",
                "mutations": [{ "path": ".project-os/goals.json", "previous": { "before": true } }]
            }))
            .unwrap()
            .as_bytes(),
        )
        .unwrap();
        repository
            .write_json(".project-os/goals.json", &json!({ "after": true }))
            .unwrap();
        repository.recover_incomplete_transactions().unwrap();
        assert_eq!(
            repository.read_json(".project-os/goals.json").unwrap()["before"],
            true
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn restores_prepared_text_transaction_exactly() {
        let root = test_root("text-recovery");
        let repository = Repository::new(&root);
        let handoff = root.join("HANDOFF.md");
        write_atomic(&handoff, b"# Before\n\nOld note\n").unwrap();
        let transaction_dir = root.join(".omnidesk/runtime/transactions");
        fs::create_dir_all(&transaction_dir).unwrap();
        write_atomic(
            &transaction_dir.join("interrupted-text.json"),
            serde_json::to_string_pretty(&json!({
                "schemaVersion": "omnidesk.repository-transaction.v0.1",
                "state": "prepared",
                "mutations": [{
                    "path": "HANDOFF.md",
                    "kind": "text",
                    "previous": "# Before\n\nOld note\n"
                }]
            }))
            .unwrap()
            .as_bytes(),
        )
        .unwrap();
        write_atomic(&handoff, b"# After\n").unwrap();
        repository.recover_incomplete_transactions().unwrap();
        assert_eq!(
            fs::read_to_string(&handoff).unwrap(),
            "# Before\n\nOld note\n"
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn commits_related_write_and_delete_together() {
        let root = test_root("delete");
        let repository = Repository::new(&root);
        repository
            .write_json(
                ".project-os/runs/desktop-tasks/task-1.json",
                &json!({ "schemaVersion": "project-os.desktop-task.v0.1", "id": "task-1" }),
            )
            .unwrap();
        repository
            .transaction(
                "delete-desktop-task",
                &[
                    JsonMutation::delete(".project-os/runs/desktop-tasks/task-1.json"),
                    JsonMutation::upsert(
                        ".project-os/goals.json",
                        json!({ "goals": [{ "taskIds": [] }] }),
                    ),
                ],
            )
            .unwrap();
        assert!(repository
            .read_json(".project-os/runs/desktop-tasks/task-1.json")
            .is_none());
        assert_eq!(
            repository.read_json(".project-os/goals.json").unwrap()["goals"][0]["taskIds"],
            json!([])
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn lists_json_records_with_workspace_relative_paths() {
        let root = test_root("list-json-records");
        let repository = Repository::new(&root);
        repository
            .write_json(
                ".project-os/runs/desktop-tasks/task-1.json",
                &json!({ "schemaVersion": "project-os.desktop-task.v0.1", "id": "task-1" }),
            )
            .unwrap();
        repository
            .write_json(
                ".project-os/runs/desktop-tasks/task-2.json",
                &json!({ "schemaVersion": "project-os.desktop-task.v0.1", "id": "task-2" }),
            )
            .unwrap();

        let records = repository
            .list_json_records(".project-os/runs/desktop-tasks")
            .unwrap();
        assert_eq!(
            records
                .iter()
                .map(|(path, _)| path.as_str())
                .collect::<Vec<_>>(),
            vec![
                ".project-os/runs/desktop-tasks/task-1.json",
                ".project-os/runs/desktop-tasks/task-2.json"
            ]
        );
        fs::remove_dir_all(root).unwrap();
    }
}
