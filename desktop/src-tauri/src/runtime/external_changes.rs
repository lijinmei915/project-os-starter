use crate::runtime::repository::{JsonMutation, Repository};
use crate::runtime::tasks;
use crate::runtime::workspace_governance::git_changed_files;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::{Component, Path};
use std::time::{SystemTime, UNIX_EPOCH};

const EXTERNAL_CHANGES_PATH: &str = ".omnidesk/data/external-changes.json";
const EXTERNAL_CHANGES_SCHEMA_VERSION: &str = "omnidesk.external-change-archive.v0.1";
const MAX_CHANGED_FILES: usize = 30;
const MAX_ARCHIVE_ENTRIES: usize = 50;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalChangeSummary {
    pub id: String,
    pub project_id: String,
    pub source: String,
    pub status: String,
    pub changed_file_count: usize,
    pub changed_files: Vec<String>,
    pub files_truncated: bool,
    pub approval_required: bool,
    pub verification_status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub linked_task_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub linked_task_title: Option<String>,
    pub detected_at: String,
}

pub fn empty_summary() -> Value {
    json!({
        "schemaVersion": EXTERNAL_CHANGES_SCHEMA_VERSION,
        "status": "none",
        "entryCount": 0,
        "latest": null,
        "entries": [],
    })
}

pub fn summary(root: &Path) -> Value {
    let document = Repository::new(root).read_json(EXTERNAL_CHANGES_PATH);
    let Some(document) = document else {
        return empty_summary();
    };
    if document.get("entries").and_then(Value::as_array).is_some() {
        return document;
    }
    let entries = existing_entries(Some(&document));
    if entries.is_empty() {
        return empty_summary();
    }
    json!({
        "schemaVersion": EXTERNAL_CHANGES_SCHEMA_VERSION,
        "status": "archived-unverified",
        "entryCount": entries.len(),
        "latest": entries.last(),
        "entries": entries,
        "schemaMigration": {
            "from": document.get("schemaVersion").and_then(Value::as_str).unwrap_or("unknown"),
            "mode": "read-projection",
        }
    })
}

pub fn is_safe_external_change_path(path: &str) -> bool {
    let path = Path::new(path);
    if path.as_os_str().is_empty() || path.is_absolute() {
        return false;
    }
    for component in path.components() {
        match component {
            Component::Normal(name) => {
                let name = name.to_string_lossy();
                if matches!(
                    name.as_ref(),
                    ".git"
                        | ".omnidesk"
                        | ".project-os"
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
                ) {
                    return false;
                }
            }
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => return false,
        }
    }
    let file_name = path.file_name().and_then(|name| name.to_str()).unwrap_or("");
    !file_name.starts_with(".env") && !file_name.ends_with(".lock")
}

fn active_task(root: &Path) -> (Option<String>, Option<String>) {
    let mut tasks = tasks::list(root).unwrap_or_default();
    tasks.retain(|task| {
        !matches!(
            task.get("status").and_then(Value::as_str).unwrap_or(""),
            "done" | "completed" | "verified" | "succeeded" | "cancelled" | "failed"
        )
    });
    tasks.sort_by(|left, right| {
        let left_time = left
            .get("updatedAt")
            .or_else(|| left.get("createdAt"))
            .and_then(Value::as_str)
            .unwrap_or("");
        let right_time = right
            .get("updatedAt")
            .or_else(|| right.get("createdAt"))
            .and_then(Value::as_str)
            .unwrap_or("");
        right_time.cmp(left_time)
    });
    let Some(task) = tasks.first() else {
        return (None, None);
    };
    (
        task.get("id").and_then(Value::as_str).map(str::to_string),
        task.get("title").and_then(Value::as_str).map(str::to_string),
    )
}

fn timestamp_string() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    format!("{millis}")
}

fn existing_entries(document: Option<&Value>) -> Vec<Value> {
    let Some(document) = document else {
        return Vec::new();
    };
    if let Some(entries) = document.get("entries").and_then(Value::as_array) {
        return entries.clone();
    }
    if document.get("changedFiles").and_then(Value::as_array).is_some() {
        let mut legacy = document.clone();
        legacy["id"] = json!(format!(
            "external-change-{}",
            document
                .get("detectedAt")
                .and_then(Value::as_str)
                .unwrap_or("legacy")
        ));
        legacy["status"] = json!("archived-unverified");
        legacy["approvalRequired"] = json!(false);
        legacy["verificationStatus"] = json!("unverified");
        legacy["filesTruncated"] = json!(false);
        return vec![legacy];
    }
    Vec::new()
}

fn entry_matches(value: &Value, next: &ExternalChangeSummary) -> bool {
    value.get("projectId").and_then(Value::as_str) == Some(next.project_id.as_str())
        && value.get("source").and_then(Value::as_str) == Some(next.source.as_str())
        && value.get("changedFiles") == Some(&json!(next.changed_files))
        && value.get("linkedTaskId")
            == next
                .linked_task_id
                .as_ref()
                .map(|id| json!(id))
                .as_ref()
}

/// Records only the safe metadata needed to tell the workbench that another
/// application changed the current project. It never turns that observation
/// into a completed task, an approval, a check, or an automatic write.
pub fn record_workspace_change(
    root: &Path,
    project_id: &str,
) -> Result<Option<ExternalChangeSummary>, String> {
    let mut changed_files = git_changed_files(root)
        .into_iter()
        .filter(|path| is_safe_external_change_path(path))
        .collect::<Vec<_>>();
    changed_files.sort();
    let changed_file_count = changed_files.len();
    let files_truncated = changed_file_count > MAX_CHANGED_FILES;
    changed_files.truncate(MAX_CHANGED_FILES);
    if changed_files.is_empty() {
        return Ok(None);
    }

    let (linked_task_id, linked_task_title) = active_task(root);
    let detected_at = timestamp_string();
    let next = ExternalChangeSummary {
        id: format!("external-change-{detected_at}"),
        project_id: project_id.to_string(),
        source: "workspace-watcher".to_string(),
        status: "archived-unverified".to_string(),
        changed_file_count,
        changed_files,
        files_truncated,
        approval_required: false,
        verification_status: "unverified".to_string(),
        linked_task_id,
        linked_task_title,
        detected_at,
    };
    let repository = Repository::new(root);
    let persisted = repository.transaction_with("record-external-workspace-change", |repository| {
        let previous = repository.read_json(EXTERNAL_CHANGES_PATH);
        let mut entries = existing_entries(previous.as_ref());
        let unchanged = entries.last().is_some_and(|value| entry_matches(value, &next));
        if unchanged {
            return Ok((false, Vec::new()));
        }
        let next_value = serde_json::to_value(&next).map_err(|error| error.to_string())?;
        entries.push(next_value.clone());
        if entries.len() > MAX_ARCHIVE_ENTRIES {
            entries.drain(0..entries.len() - MAX_ARCHIVE_ENTRIES);
        }
        let archive = json!({
            "schemaVersion": EXTERNAL_CHANGES_SCHEMA_VERSION,
            "status": "archived-unverified",
            "entryCount": entries.len(),
            "latest": next_value,
            "entries": entries,
        });
        Ok((
            true,
            vec![JsonMutation::upsert(
                EXTERNAL_CHANGES_PATH,
                archive,
            )],
        ))
    })?;
    Ok(persisted.then_some(next))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn test_root(label: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!(
            "omnidesk-external-changes-{label}-{}",
            SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()
        ))
    }

    #[test]
    fn rejects_runtime_secret_and_build_paths() {
        assert!(is_safe_external_change_path("desktop/src/main.jsx"));
        assert!(is_safe_external_change_path("README.md"));
        assert!(!is_safe_external_change_path(".omnidesk/data/state.json"));
        assert!(!is_safe_external_change_path(".env.local"));
        assert!(!is_safe_external_change_path("node_modules/pkg/index.js"));
        assert!(!is_safe_external_change_path("../outside.rs"));
    }

    #[test]
    fn records_bounded_git_changes_once_without_completing_the_task() {
        let root = test_root("record");
        fs::create_dir_all(root.join(".git")).unwrap();
        fs::create_dir_all(root.join("desktop/src")).unwrap();
        fs::create_dir_all(root.join(".omnidesk/data/tasks")).unwrap();
        fs::write(root.join("desktop/src/main.jsx"), "first").unwrap();
        fs::write(
            root.join(".omnidesk/data/tasks/current.json"),
            r#"{"schemaVersion":"omnidesk.desktop-task.v0.1","id":"task-1","title":"外部改动任务","status":"running","updatedAt":"2026-07-30T10:00:00Z"}"#,
        )
        .unwrap();
        std::process::Command::new("git").arg("-C").arg(&root).arg("init").output().unwrap();
        std::process::Command::new("git")
            .arg("-C")
            .arg(&root)
            .args(["add", "desktop/src/main.jsx"])
            .output()
            .unwrap();
        fs::write(root.join("desktop/src/main.jsx"), "second").unwrap();
        let first = record_workspace_change(&root, "project-1").unwrap().unwrap();
        assert_eq!(first.changed_files, vec!["desktop/src/main.jsx"]);
        assert_eq!(first.linked_task_id.as_deref(), Some("task-1"));
        assert!(!first.approval_required);
        assert_eq!(first.verification_status, "unverified");
        assert_eq!(Repository::new(&root).read_json(".omnidesk/data/tasks/current.json").unwrap()["status"], "running");
        assert!(record_workspace_change(&root, "project-1").unwrap().is_none());
        let archive = summary(&root);
        assert_eq!(archive["entryCount"], 1);
        assert_eq!(archive["entries"][0]["status"], "archived-unverified");
        assert_eq!(archive["entries"][0]["approvalRequired"], false);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn migrates_the_previous_single_summary_into_archive_history() {
        let root = test_root("legacy-summary");
        fs::create_dir_all(root.join(".omnidesk/data")).unwrap();
        fs::write(
            root.join(EXTERNAL_CHANGES_PATH),
            r#"{"schemaVersion":"omnidesk.external-changes.v0.1","projectId":"project-1","source":"workspace-watcher","status":"detected","changedFileCount":1,"changedFiles":["README.md"],"detectedAt":"1"}"#,
        )
        .unwrap();
        let entries = existing_entries(Repository::new(&root).read_json(EXTERNAL_CHANGES_PATH).as_ref());
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0]["status"], "archived-unverified");
        assert_eq!(entries[0]["approvalRequired"], false);
        fs::remove_dir_all(root).unwrap();
    }
}
