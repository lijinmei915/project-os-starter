use serde_json::{json, Value};
use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::process;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

#[cfg(test)]
thread_local! { static RECOVERY_JOURNAL_READS: std::cell::Cell<usize> = const { std::cell::Cell::new(0) }; }

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
        let _lock = RepositoryLock::acquire(&self.root)?;
        self.recover_incomplete_transactions_locked()?;
        self.commit_transaction(operation, mutations)
    }

    /// Builds and commits mutations while the Repository lock is held. Use for
    /// read-modify-write domain operations so source reads cannot race a
    /// concurrent state update between preparation and commit.
    pub fn transaction_with<T, F>(&self, operation: &str, prepare: F) -> Result<T, String>
    where
        F: FnOnce(&Repository) -> Result<(T, Vec<JsonMutation>), String>,
    {
        let _lock = RepositoryLock::acquire(&self.root)?;
        self.recover_incomplete_transactions_locked()?;
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
        let _lock = RepositoryLock::acquire(&self.root)?;
        self.recover_incomplete_transactions_locked()?;
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

        let transaction_id = format!("{}-{}", operation, unique_file_suffix());
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

        self.archive_pending_journal(&journal_path)?;

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

        let transaction_id = format!("{}-{}", operation, unique_file_suffix());
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
        self.archive_pending_journal(&journal_path)?;
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
        let _lock = RepositoryLock::acquire(&self.root)?;
        self.recover_incomplete_transactions_locked()
    }

    fn recover_incomplete_transactions_locked(&self) -> Result<(), String> {
        self.recover_journals_locked(false)
    }

    pub(crate) fn recover_imported_transactions(&self) -> Result<(), String> {
        let _lock = RepositoryLock::acquire(&self.root)?;
        self.recover_journals_locked(true)
    }

    fn recover_journals_locked(&self, imported: bool) -> Result<(), String> {
        let directory = crate::runtime::state_namespace::state_path_for_read(
            &self.root,
            ".omnidesk/runtime/transactions",
        )?;
        if !directory.exists() {
            return Ok(());
        }
        let pending = directory.join("pending");
        if fs::symlink_metadata(&pending).is_ok_and(|metadata|metadata.file_type().is_symlink()) {
            return Err("未结事务目录不能是符号链接。".to_string());
        }
        if !pending.exists() || imported {
            // One upgrade/import scan. The directory is the durable cutover:
            // all new writers put unfinished journals in pending from now on.
            self.recover_journal_directory(&directory, false)?;
            fs::create_dir_all(&pending).map_err(|error|error.to_string())?;
        }
        self.recover_journal_directory(&pending, true)
    }

    fn recover_journal_directory(&self, directory: &Path, pending: bool) -> Result<(), String> {
        for entry in fs::read_dir(directory).map_err(|error|error.to_string())? {
            let entry = entry.map_err(|error|error.to_string())?;
            let path = entry.path();
            if path.extension().and_then(|value|value.to_str()) != Some("json") { continue; }
            if !entry.file_type().map_err(|error|error.to_string())?.is_file() {
                if pending {return Err("未结事务目录包含非常规文件，不能安全恢复。".to_string());}
                continue;
            }
            #[cfg(test)] RECOVERY_JOURNAL_READS.with(|reads|reads.set(reads.get()+1));
            let Some(mut journal) = fs::read_to_string(&path)
                .ok()
                .and_then(|content| serde_json::from_str::<Value>(&content).ok())
            else {
                if pending {return Err("未结事务记录损坏，已保留现场，请先核对状态。".to_string());}
                continue;
            };
            let state = journal.get("state").and_then(Value::as_str);
            if state != Some("prepared") {
                if pending {
                    if !matches!(state,Some("committed"|"rolled-back")) {return Err("未结事务状态未知，不能安全恢复。".to_string());}
                    self.archive_pending_journal(&path)?;
                }
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
            if pending {self.archive_pending_journal(&path)?;}
        }
        Ok(())
    }

    fn transaction_path(&self, transaction_id: &str) -> PathBuf {
        crate::runtime::state_namespace::state_path_for_write(
            &self.root,
            ".omnidesk/runtime/transactions",
        )
        .unwrap_or_else(|_| self.root.join(".omnidesk/runtime/transactions"))
        .join("pending")
        .join(format!("{transaction_id}.json"))
    }

    fn archive_pending_journal(&self, path: &Path) -> Result<(), String> {
        let directory = crate::runtime::state_namespace::state_path_for_write(&self.root,".omnidesk/runtime/transactions")?;
        let destination = directory.join(path.file_name().ok_or_else(||"事务文件缺少名称".to_string())?);
        if destination.exists() {
            if fs::read(path).map_err(|error|error.to_string())? != fs::read(&destination).map_err(|error|error.to_string())? {
                return Err("事务归档编号冲突，已保留两份记录。".to_string());
            }
            return fs::remove_file(path).map_err(|error|error.to_string());
        }
        fs::rename(path,destination).map_err(|error|error.to_string())
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
    if !relative_path.starts_with(".omnidesk/data/tasks/")
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
        ".{file_name}.{}.tmp",
        unique_file_suffix()
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

pub(crate) struct RepositoryLock {
    // Keep the handle (and stable lock file) alive. The kernel releases the
    // lock on close or process death; unlinking would create a second lock inode.
    _file: fs::File,
}

impl RepositoryLock {
    fn acquire(root: &Path) -> Result<Self, String> {
        Self::acquire_named(root, "omnidesk-repository.lock")
    }

    /// A separate lease for a whole source operation. Never hold the short
    /// Repository transaction lock across Git/audit execution.
    pub(crate) fn acquire_named(root: &Path, name: &str) -> Result<Self, String> {
        if name.is_empty() || !name.bytes().all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, b'-' | b'.')) {
            return Err("操作锁名称无效".to_string());
        }
        let path =
            crate::runtime::state_namespace::state_path_for_write(root, ".omnidesk/runtime/locks")?
                .join(name);
        let parent = path.parent().ok_or_else(|| "锁目录无效".to_string())?;
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
        let mut options = fs::OpenOptions::new();
        options.read(true).write(true).create(true).truncate(false);
        #[cfg(unix)] {
            use std::os::unix::fs::OpenOptionsExt;
            options.custom_flags(libc::O_NOFOLLOW);
        }
        let mut file = options.open(&path).map_err(|error|error.to_string())?;
        for _ in 0..20 {
            match file.try_lock() {
                Ok(()) => {
                    file.set_len(0).map_err(|error|error.to_string())?;
                    file.write_all(format!("pid={} acquiredAt={}\n", process::id(), timestamp_string()).as_bytes())
                        .map_err(|error| error.to_string())?;
                    return Ok(Self { _file:file });
                }
                Err(std::fs::TryLockError::WouldBlock) => {
                    std::thread::sleep(Duration::from_millis(15));
                }
                Err(std::fs::TryLockError::Error(error)) => return Err(error.to_string()),
            }
        }
        Err("项目状态正被另一项操作更新，请稍后重试".to_string())
    }
}

fn timestamp_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn unique_file_suffix() -> String {
    static SEQUENCE: AtomicU64 = AtomicU64::new(0);
    format!("{}-{}-{}",process::id(),timestamp_millis(),SEQUENCE.fetch_add(1,Ordering::Relaxed))
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

    fn seed_interrupted_journal(root: &Path) {
        write_atomic(&root.join(".omnidesk/data/state.json"), br#"{"value":"during-commit"}"#).unwrap();
        write_atomic(&root.join(".omnidesk/runtime/transactions/pending/held.json"),
            serde_json::to_vec(&json!({"schemaVersion":"omnidesk.repository-transaction.v0.1",
                "state":"prepared","mutations":[{"path":".omnidesk/data/state.json","previous":{"value":"before-commit"}}]})).unwrap().as_slice()).unwrap();
    }

    #[test]
    fn recovery_cannot_restore_a_journal_while_its_writer_holds_the_lock() {
        let root = test_root("active-recovery");
        let lock = RepositoryLock::acquire(&root).unwrap();
        seed_interrupted_journal(&root);
        let repository = Repository::new(&root);
        let before = fs::read(root.join(".omnidesk/runtime/transactions/pending/held.json")).unwrap();
        assert!(repository.recover_incomplete_transactions().unwrap_err().contains("另一项操作"));
        assert_eq!(repository.read_json(".omnidesk/data/state.json").unwrap()["value"],"during-commit");
        assert_eq!(fs::read(root.join(".omnidesk/runtime/transactions/pending/held.json")).unwrap(),before);
        drop(lock);
        repository.recover_incomplete_transactions().unwrap();
        assert_eq!(repository.read_json(".omnidesk/data/state.json").unwrap()["value"],"before-commit");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn old_file_age_does_not_steal_a_live_lock_or_replace_its_file() {
        let root = test_root("old-live-lock");
        let path = root.join(".omnidesk/runtime/locks/omnidesk-repository.lock");
        let first = RepositoryLock::acquire(&root).unwrap();
        let file = fs::OpenOptions::new().write(true).open(&path).unwrap();
        file.set_times(fs::FileTimes::new().set_modified(SystemTime::now()-Duration::from_secs(120))).unwrap();
        assert!(RepositoryLock::acquire(&root).is_err());
        #[cfg(unix)] let inode = {use std::os::unix::fs::MetadataExt;fs::metadata(&path).unwrap().ino()};
        drop(first);
        assert!(path.is_file());
        let second = RepositoryLock::acquire(&root).unwrap();
        #[cfg(unix)] {use std::os::unix::fs::MetadataExt;assert_eq!(fs::metadata(&path).unwrap().ino(),inode);}
        drop(second);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    #[ignore = "child-process helper; invoked only by the crash recovery regression"]
    fn repository_lock_child() {
        let root = PathBuf::from(std::env::var_os("OMNIDESK_TEST_REPOSITORY_LOCK_ROOT").unwrap());
        let _lock = RepositoryLock::acquire(&root).unwrap();
        seed_interrupted_journal(&root);
        fs::write(root.join("lock-ready"),b"ready").unwrap();
        let mut line = String::new();
        std::io::stdin().read_line(&mut line).unwrap();
    }

    #[test]
    fn crashed_process_releases_lock_and_recovers_before_the_next_update() {
        use std::process::{Command,Stdio};
        let root = test_root("process-crash");
        let mut child = Command::new(std::env::current_exe().unwrap())
            .args(["--exact","runtime::repository::tests::repository_lock_child","--ignored","--nocapture"])
            .env("OMNIDESK_TEST_REPOSITORY_LOCK_ROOT",&root)
            .stdin(Stdio::piped()).stdout(Stdio::null()).stderr(Stdio::piped()).spawn().unwrap();
        let deadline = std::time::Instant::now()+Duration::from_secs(5);
        while !root.join("lock-ready").is_file() && std::time::Instant::now()<deadline {
            assert!(child.try_wait().unwrap().is_none(),"lock child exited before acquiring the lock");
            std::thread::sleep(Duration::from_millis(10));
        }
        assert!(root.join("lock-ready").is_file());
        let repository = Repository::new(&root);
        assert!(repository.recover_incomplete_transactions().is_err());
        assert_eq!(repository.read_json(".omnidesk/data/state.json").unwrap()["value"],"during-commit");
        child.kill().unwrap();child.wait().unwrap();
        let started = std::time::Instant::now();
        repository.transaction_with("after-crash",|repository| {
            let mut state = repository.read_json(".omnidesk/data/state.json").unwrap();
            assert_eq!(state["value"],"before-commit");
            state["nextUpdate"] = json!(true);
            Ok(((),vec![JsonMutation::upsert(".omnidesk/data/state.json",state)]))
        }).unwrap();
        assert!(started.elapsed()<Duration::from_secs(2),"dead process left a time-based lock delay");
        assert_eq!(repository.read_json(".omnidesk/data/state.json").unwrap()["nextUpdate"],true);
        let journal:Value = serde_json::from_slice(&fs::read(root.join(".omnidesk/runtime/transactions/held.json")).unwrap()).unwrap();
        assert_eq!(journal["state"],"rolled-back");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn steady_state_updates_do_not_read_the_growing_journal_archive() {
        let root = test_root("archive-fast-path");
        let archive = root.join(".omnidesk/runtime/transactions");
        fs::create_dir_all(&archive).unwrap();
        let history = serde_json::to_vec(&json!({"state":"committed","retainedEvidence":"x".repeat(4096)})).unwrap();
        for index in 0..1000 {fs::write(archive.join(format!("history-{index}.json")),&history).unwrap();}
        let repository = Repository::new(&root);
        RECOVERY_JOURNAL_READS.with(|reads|reads.set(0));
        repository.recover_incomplete_transactions().unwrap();
        assert_eq!(RECOVERY_JOURNAL_READS.with(|reads|reads.get()),1000);
        assert!(archive.join("pending").is_dir());
        RECOVERY_JOURNAL_READS.with(|reads|reads.set(0));
        let started = std::time::Instant::now();
        repository.transaction("hot-save",&[JsonMutation::upsert(".omnidesk/data/state.json",json!({"saved":true}))]).unwrap();
        assert_eq!(RECOVERY_JOURNAL_READS.with(|reads|reads.get()),0,"ordinary save must not parse historical journals");
        eprintln!("Repository hot-save with 1000 archived records: {}ms, historical journals read: 0",started.elapsed().as_millis());
        assert_eq!(fs::read(archive.join("history-0.json")).unwrap(),history);
        assert_eq!(fs::read(archive.join("history-999.json")).unwrap(),history);
        assert_eq!(fs::read_dir(archive.join("pending")).unwrap().count(),0);
        assert_eq!(fs::read_dir(&archive).unwrap().count(),1002); // history + new committed journal + pending directory
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn pending_committed_records_are_archived_without_rollback_and_corruption_blocks_writes() {
        let root = test_root("pending-states");
        let repository = Repository::new(&root);
        seed_interrupted_journal(&root);
        let pending = root.join(".omnidesk/runtime/transactions/pending");
        let path = pending.join("held.json");
        let mut journal:Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        journal["state"] = json!("committed");
        fs::write(&path,serde_json::to_vec(&journal).unwrap()).unwrap();
        repository.recover_incomplete_transactions().unwrap();
        assert_eq!(repository.read_json(".omnidesk/data/state.json").unwrap()["value"],"during-commit");
        assert!(!path.exists());
        assert!(root.join(".omnidesk/runtime/transactions/held.json").is_file());
        fs::write(pending.join("corrupt.json"),b"incomplete JSON").unwrap();
        let before = fs::read(root.join(".omnidesk/data/state.json")).unwrap();
        assert!(repository.transaction("must-not-write",&[JsonMutation::upsert(".omnidesk/data/state.json",json!({"lost":true}))]).unwrap_err().contains("记录损坏"));
        assert_eq!(fs::read(root.join(".omnidesk/data/state.json")).unwrap(),before);
        assert_eq!(fs::read(pending.join("corrupt.json")).unwrap(),b"incomplete JSON");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn explicit_import_recovery_checks_legacy_journals_after_cutover() {
        let root = test_root("import-after-cutover");
        let repository = Repository::new(&root);
        repository.transaction("seed",&[JsonMutation::upsert(".omnidesk/data/state.json",json!({"value":"before-import"}))]).unwrap();
        let imported = root.join(".omnidesk/runtime/transactions/imported.json");
        fs::write(&imported,serde_json::to_vec(&json!({"state":"prepared","mutations":[
            {"path":".omnidesk/data/state.json","previous":{"value":"import-recovered"}}
        ]})).unwrap()).unwrap();
        repository.recover_imported_transactions().unwrap();
        assert_eq!(repository.read_json(".omnidesk/data/state.json").unwrap()["value"],"import-recovered");
        assert_eq!(serde_json::from_slice::<Value>(&fs::read(imported).unwrap()).unwrap()["state"],"rolled-back");
        fs::remove_dir_all(root).unwrap();
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
                        relative_path: ".omnidesk/data/goals.json".to_string(),
                        value: Some(
                            json!({ "schemaVersion": "project-os.goals.v0.1", "goals": [] }),
                        ),
                    },
                    JsonMutation {
                        relative_path: ".omnidesk/data/tasks/task-1.json".to_string(),
                        value: Some(json!({ "schemaVersion": "project-os.desktop-task.v0.1", "id": "task-1", "goalId": "goal-a" })),
                    },
                ],
            )
            .unwrap();
        assert_eq!(
            repository
                .read_json(".omnidesk/data/tasks/task-1.json")
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
    fn native_namespace_writes_stay_in_the_partitioned_storage() {
        let root = test_root("active-namespace");
        write_atomic(
            &root.join(".omnidesk/data/goals.json"),
            br#"{"schemaVersion":"omnidesk.goals.v0.1","goals":[]}"#,
        )
        .unwrap();
        crate::runtime::state_namespace::ensure_active_state_namespace(&root).unwrap();

        let repository = Repository::new(&root);
        repository
            .transaction(
                "update-goals",
                &[JsonMutation::upsert(
                    ".omnidesk/data/goals.json",
                    json!({ "schemaVersion": "omnidesk.goals.v0.1", "goals": [{ "id": "g1" }] }),
                )],
            )
            .unwrap();

        assert_eq!(
            repository.read_json(".omnidesk/data/goals.json").unwrap()["goals"][0]["id"],
            "g1"
        );
        assert!(fs::read_to_string(root.join(".omnidesk/data/goals.json"))
            .unwrap()
            .contains("g1"));
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
                    ".omnidesk/data/state.json",
                    json!({"value": 1}),
                )],
            )
            .unwrap();
        let result = repository
            .transaction_with("increment", |repository| {
                let value = repository.read_json(".omnidesk/data/state.json").unwrap()["value"]
                    .as_i64()
                    .unwrap();
                Ok((
                    value + 1,
                    vec![JsonMutation::upsert(
                        ".omnidesk/data/state.json",
                        json!({"value": value + 1}),
                    )],
                ))
            })
            .unwrap();
        assert_eq!(result, 2);
        assert_eq!(
            repository.read_json(".omnidesk/data/state.json").unwrap()["value"],
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
                    ".omnidesk/data/tasks/task-1.json",
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
            .write_json(".omnidesk/data/goals.json", &json!({ "before": true }))
            .unwrap();
        let transaction_dir = root.join(".omnidesk/runtime/transactions");
        fs::create_dir_all(&transaction_dir).unwrap();
        write_atomic(
            &transaction_dir.join("interrupted.json"),
            serde_json::to_string_pretty(&json!({
                "schemaVersion": "omnidesk.repository-transaction.v0.1",
                "state": "prepared",
                "mutations": [{ "path": ".omnidesk/data/goals.json", "previous": { "before": true } }]
            }))
            .unwrap()
            .as_bytes(),
        )
        .unwrap();
        repository
            .write_json(".omnidesk/data/goals.json", &json!({ "after": true }))
            .unwrap();
        repository.recover_incomplete_transactions().unwrap();
        assert_eq!(
            repository.read_json(".omnidesk/data/goals.json").unwrap()["before"],
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
                ".omnidesk/data/tasks/task-1.json",
                &json!({ "schemaVersion": "project-os.desktop-task.v0.1", "id": "task-1" }),
            )
            .unwrap();
        repository
            .transaction(
                "delete-desktop-task",
                &[
                    JsonMutation::delete(".omnidesk/data/tasks/task-1.json"),
                    JsonMutation::upsert(
                        ".omnidesk/data/goals.json",
                        json!({ "goals": [{ "taskIds": [] }] }),
                    ),
                ],
            )
            .unwrap();
        assert!(repository
            .read_json(".omnidesk/data/tasks/task-1.json")
            .is_none());
        assert_eq!(
            repository.read_json(".omnidesk/data/goals.json").unwrap()["goals"][0]["taskIds"],
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
                ".omnidesk/data/tasks/task-1.json",
                &json!({ "schemaVersion": "project-os.desktop-task.v0.1", "id": "task-1" }),
            )
            .unwrap();
        repository
            .write_json(
                ".omnidesk/data/tasks/task-2.json",
                &json!({ "schemaVersion": "project-os.desktop-task.v0.1", "id": "task-2" }),
            )
            .unwrap();

        let records = repository
            .list_json_records(".omnidesk/data/tasks")
            .unwrap();
        assert_eq!(
            records
                .iter()
                .map(|(path, _)| path.as_str())
                .collect::<Vec<_>>(),
            vec![
                ".omnidesk/data/tasks/task-1.json",
                ".omnidesk/data/tasks/task-2.json"
            ]
        );
        fs::remove_dir_all(root).unwrap();
    }
}
