use crate::runtime::repository::{JsonMutation, Repository};
use crate::runtime::tasks;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::BTreeSet;
use std::path::{Component, Path};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
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
    #[serde(default)]
    pub snapshot: Value,
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
                if name.starts_with(".env") || matches!(
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
                        | ".DS_Store" | "__pycache__" | ".venv" | "venv"
                        | "auth.json" | "credentials.json" | "id_rsa" | "id_ed25519"
                ) {
                    return false;
                }
            }
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => return false,
        }
    }
    let file_name = path.file_name().and_then(|name| name.to_str()).unwrap_or("");
    !file_name.starts_with(".env") && ![".lock", ".pem", ".key", ".p12", ".pfx"].iter().any(|suffix|file_name.ends_with(suffix))
}

fn git_output(root: &Path, args: &[String]) -> Result<Vec<u8>, String> {
    let output = Command::new("git").arg("-C").arg(root).args(args)
        .stderr(Stdio::null()).output().map_err(|_|"无法读取 Git 变动状态".to_string())?;
    if !output.status.success() || output.stdout.len() > 4 * 1024 * 1024 {
        return Err("Git 状态不可用或超过归档上限".to_string());
    }
    Ok(output.stdout)
}

/// NUL-separated porcelain preserves spaces, Unicode and rename sources.
/// Porcelain paths are relative to the repository; bind them to this project.
fn changed_paths(root: &Path) -> Result<Vec<String>, String> {
    let prefix = git_output(root,&["rev-parse".into(),"--show-prefix".into()])?;
    let prefix = std::str::from_utf8(&prefix).map_err(|_|"Git 工程路径无法识别")?.trim_end_matches('\n');
    let output = git_output(root,&["status".into(),"--porcelain=v1".into(),"-z".into(),"--untracked-files=all".into(),"--".into(),".".into()])?;
    let mut records = output.split(|byte| *byte == 0).filter(|record|!record.is_empty());
    let mut paths = BTreeSet::new();
    while let Some(record) = records.next() {
        if record.len()<4 { return Err("Git 变动记录不完整".into()); }
        let mut names = vec![&record[3..]];
        if record[..2].iter().any(|byte|matches!(byte,b'R'|b'C')) {
            names.push(records.next().ok_or("Git 重命名记录不完整")?);
        }
        for name in names {
            let name = std::str::from_utf8(name).map_err(|_|"Git 文件名无法识别")?;
            if let Some(relative) = name.strip_prefix(prefix).filter(|path|is_safe_external_change_path(path)) {
                paths.insert(relative.to_string());
            }
        }
    }
    Ok(paths.into_iter().collect())
}

fn capture_snapshot(root: &Path, paths: &[String]) -> Result<Value, String> {
    if paths.len() > 1_000 { return Err("变动文件超过版本归档上限".into()); }
    let before = crate::runtime::validation_revision::capture(root)?;
    let mut args = vec!["ls-files".into(),"--stage".into(),"-z".into(),"--".into()];
    args.extend(paths.iter().map(|path|format!(":(literal){path}")));
    let index = git_output(root,&args)?;
    let head = git_output(root,&["rev-parse".into(),"--verify".into(),"HEAD".into()]).unwrap_or_default();
    let after = crate::runtime::validation_revision::capture(root)?;
    if before != after || changed_paths(root)? != paths || git_output(root,&args)? != index
        || git_output(root,&["rev-parse".into(),"--verify".into(),"HEAD".into()]).unwrap_or_default() != head {
        return Err("归档期间文件或 Git 版本发生变化".into());
    }
    let binding = json!({"source":after["sourceDigest"],"root":after["rootDigest"],
        "index":format!("{:x}",Sha256::digest(index)),"head":String::from_utf8_lossy(&head).trim(),"paths":paths});
    Ok(json!({"status":"captured","scope":"project-source-and-changed-index-v1","algorithm":"sha256",
        "fingerprint":format!("{:x}",Sha256::digest(serde_json::to_vec(&binding).map_err(|error|error.to_string())?)),
        "sourceDigest":after["sourceDigest"],"fileCount":after["fileCount"],"contentStored":false}))
}

fn active_task(root: &Path) -> (Option<String>, Option<String>) {
    let mut tasks = tasks::list_repository_records(&Repository::new(root)).unwrap_or_default()
        .into_iter().map(|(_,task)|task).collect::<Vec<_>>();
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
        && value.get("snapshot") == Some(&next.snapshot)
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
    let mut changed_files = changed_paths(root)?;
    if changed_files.is_empty() { return Ok(None); }
    let snapshot = capture_snapshot(root,&changed_files).unwrap_or_else(|_|json!({"status":"unavailable",
        "reason":"当前无法稳定核对工程版本，记录只保留变动路径。","contentStored":false}));
    let changed_file_count = changed_files.len();
    let files_truncated = changed_file_count > MAX_CHANGED_FILES;
    changed_files.truncate(MAX_CHANGED_FILES);
    if changed_files.is_empty() {
        return Ok(None);
    }

    let (linked_task_id, linked_task_title) = active_task(root);
    let detected_at = timestamp_string();
    static SEQUENCE: AtomicU64 = AtomicU64::new(0);
    let next = ExternalChangeSummary {
        id: format!("external-change-{detected_at}-{}-{}",std::process::id(),SEQUENCE.fetch_add(1,Ordering::Relaxed)),
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
        snapshot,
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
        assert!(!is_safe_external_change_path("secrets/auth.json"));
        assert!(!is_safe_external_change_path(".env/source.js"));
        assert!(!is_safe_external_change_path("cert.pem"));
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
        assert_eq!(first.snapshot["status"],"captured");
        fs::write(root.join("desktop/src/main.jsx"),"third!").unwrap(); // Same length, same paths.
        let second = record_workspace_change(&root,"project-1").unwrap().unwrap();
        assert_eq!(first.changed_files,second.changed_files);
        assert_ne!(first.snapshot["fingerprint"],second.snapshot["fingerprint"]);
        assert_eq!(second.snapshot["contentStored"],false);
        assert!(record_workspace_change(&root,"project-1").unwrap().is_none());
        let archive = summary(&root);
        assert_eq!(archive["entryCount"], 2);
        assert_eq!(archive["entries"][0]["status"], "archived-unverified");
        assert_eq!(archive["entries"][0]["approvalRequired"], false);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn archive_handles_unicode_spaces_nested_projects_and_index_only_changes() {
        let root = test_root("names-index");
        fs::create_dir_all(root.join("nested/src")).unwrap();
        let git = |args:&[&str]| {
            let result = Command::new("git").arg("-C").arg(&root).args(args).output().unwrap();
            assert!(result.status.success(),"{:?}",result); result
        };
        git(&["init","--quiet"]);
        let project = root.join("nested");
        let file = project.join("src/中文 name.js");
        fs::write(&file,"first\n").unwrap();
        git(&["add","nested"]);
        fs::write(&file,"second\n").unwrap();
        let first = record_workspace_change(&project,"nested-project").unwrap().unwrap();
        assert_eq!(first.changed_files,vec!["src/中文 name.js"]);
        git(&["add","nested"]);
        let second = record_workspace_change(&project,"nested-project").unwrap().unwrap();
        assert_ne!(first.snapshot["fingerprint"],second.snapshot["fingerprint"]);
        assert_eq!(first.snapshot["sourceDigest"],second.snapshot["sourceDigest"]);
        fs::write(project.join("src/third.js"),"third\n").unwrap();
        fs::write(project.join(".env"),"secret-value-never-archived").unwrap();
        let third = record_workspace_change(&project,"nested-project").unwrap().unwrap();
        assert!(third.changed_files.contains(&"src/third.js".to_string()));
        assert!(!third.changed_files.iter().any(|path|path.contains(".env")));
        assert!(!summary(&project).to_string().contains("secret-value-never-archived"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn archive_hashes_files_beyond_the_display_window_without_storing_content() {
        let root = test_root("truncated");
        fs::create_dir_all(root.join("src")).unwrap();
        Command::new("git").args(["init","--quiet"]).current_dir(&root).status().unwrap();
        for index in 0..32 { fs::write(root.join(format!("src/{index:02}.js")),"first").unwrap(); }
        let first = record_workspace_change(&root,"project").unwrap().unwrap();
        assert_eq!(first.changed_file_count,32);
        assert!(first.files_truncated);
        fs::write(root.join("src/31.js"),"later").unwrap();
        let second = record_workspace_change(&root,"project").unwrap().unwrap();
        assert_eq!(first.changed_files,second.changed_files);
        assert_ne!(first.snapshot["fingerprint"],second.snapshot["fingerprint"]);
        assert!(!summary(&root).to_string().contains("later"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn archive_preserves_both_rename_paths_and_deletion_versions() {
        let root = test_root("rename-delete");
        fs::create_dir_all(root.join("src")).unwrap();
        let git = |args:&[&str]| {
            assert!(Command::new("git").arg("-C").arg(&root).args(args).output().unwrap().status.success());
        };
        git(&["init","--quiet"]);
        fs::write(root.join("src/before name.js"),"baseline\n").unwrap();
        git(&["add","src"]);
        git(&["-c","user.name=OmniDesk Test","-c","user.email=test@example.invalid","commit","--quiet","-m","fixture"]);
        git(&["mv","src/before name.js","src/after 中文.js"]);
        let renamed = record_workspace_change(&root,"project").unwrap().unwrap();
        assert_eq!(renamed.changed_files,vec!["src/after 中文.js","src/before name.js"]);
        fs::remove_file(root.join("src/after 中文.js")).unwrap();
        let deleted = record_workspace_change(&root,"project").unwrap().unwrap();
        assert_ne!(renamed.snapshot["fingerprint"],deleted.snapshot["fingerprint"]);
        assert_eq!(summary(&root)["entryCount"],2);
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn archive_preserves_path_observation_but_never_claims_a_symlink_snapshot() {
        let root = test_root("symlink");
        fs::create_dir_all(root.join("src")).unwrap();
        Command::new("git").args(["init","--quiet"]).current_dir(&root).status().unwrap();
        std::os::unix::fs::symlink("/etc/hosts",root.join("src/link.js")).unwrap();
        let entry = record_workspace_change(&root,"project").unwrap().unwrap();
        assert_eq!(entry.snapshot["status"],"unavailable");
        assert_eq!(entry.verification_status,"unverified");
        assert_eq!(entry.snapshot["contentStored"],false);
        assert!(record_workspace_change(&root,"project").unwrap().is_none());
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
