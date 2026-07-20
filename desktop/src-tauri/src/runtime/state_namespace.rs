use crate::runtime::repository::write_atomic;
use serde::Serialize;
use serde_json::{json, Value};
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

pub const LEGACY_STATE_ROOT: &str = ".project-os";
pub const STATE_ROOT: &str = ".omnidesk";
pub const NAMESPACE_MANIFEST: &str = ".omnidesk/namespace.json";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum StatePartition {
    Data,
    Runtime,
    Cache,
    Evidence,
}

impl StatePartition {
    fn directory(self) -> &'static str {
        match self {
            Self::Data => "data",
            Self::Runtime => "runtime",
            Self::Cache => "cache",
            Self::Evidence => "evidence",
        }
    }
}

#[derive(Debug, Default, Eq, PartialEq)]
pub struct MigrationOutcome {
    pub copied: usize,
    pub unchanged: usize,
    pub conflicts: Vec<String>,
    pub skipped: Vec<String>,
}

/// A destructive legacy-root cleanup is only safe after every source file has
/// been proved to exist unchanged in the active namespace. This report is
/// read-only; deletion still requires a separate explicit approval.
#[derive(Debug, Default, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyRetirementReadiness {
    pub namespace_active: bool,
    pub legacy_exists: bool,
    pub ready: bool,
    pub missing_targets: Vec<String>,
    pub mismatched_targets: Vec<String>,
    pub skipped: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyRetentionArchive {
    pub archive_relative: String,
    pub files: Vec<LegacyRetentionArchiveFile>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyRetentionArchiveFile {
    pub legacy_relative: String,
    pub active_target: String,
    pub bytes: usize,
}

impl MigrationOutcome {
    pub fn status(&self, legacy_exists: bool) -> &'static str {
        if !legacy_exists {
            "not-needed"
        } else if self.conflicts.is_empty() {
            "copied"
        } else {
            "conflicted"
        }
    }
}

/// Maps a legacy path into the v1 namespace without changing its basename or
/// silently discarding unknown state. Unknown paths are preserved as evidence
/// until a later schema explicitly claims ownership.
pub fn migration_target(relative_legacy_path: &str) -> Result<(StatePartition, String), String> {
    let normalized = normalize_relative_path(relative_legacy_path)?;
    let mut parts = normalized.split('/');
    let first = parts.next().unwrap_or_default();
    let remainder = parts.collect::<Vec<_>>().join("/");

    let (partition, mapped) = match first {
        "events" | "transactions" | "locks" => (StatePartition::Runtime, normalized.clone()),
        "tmp" | "graph" | "entry-contexts" | "state-bundles" | "recommendations" => {
            (StatePartition::Cache, normalized.clone())
        }
        "model-health.json"
        | "fact-freshness.json"
        | "workspace-facts.json"
        | "native-terminal-trace.json" => (StatePartition::Cache, normalized.clone()),
        "goal-validation-report.json" => (StatePartition::Evidence, normalized.clone()),
        "reports" | "backups" => (StatePartition::Evidence, normalized.clone()),
        "runs" if remainder == "desktop-tasks" || remainder.starts_with("desktop-tasks/") => {
            let suffix = remainder
                .strip_prefix("desktop-tasks")
                .unwrap_or_default()
                .trim_start_matches('/');
            let mapped = if suffix.is_empty() {
                "tasks".to_string()
            } else {
                format!("tasks/{suffix}")
            };
            (StatePartition::Data, mapped)
        }
        "runs"
            if remainder == "desktop-conversations"
                || remainder.starts_with("desktop-conversations/") =>
        {
            let suffix = remainder
                .strip_prefix("desktop-conversations")
                .unwrap_or_default()
                .trim_start_matches('/');
            let mapped = if suffix.is_empty() {
                "conversations".to_string()
            } else {
                format!("conversations/{suffix}")
            };
            (StatePartition::Data, mapped)
        }
        "runs" if remainder == "agent-runs" || remainder.starts_with("agent-runs/") => {
            let suffix = remainder
                .strip_prefix("agent-runs")
                .unwrap_or_default()
                .trim_start_matches('/');
            let mapped = if suffix.is_empty() {
                "agent-runs".to_string()
            } else {
                format!("agent-runs/{suffix}")
            };
            (StatePartition::Data, mapped)
        }
        "runs" => (StatePartition::Evidence, normalized.clone()),
        "conversations" | "agent-runs" => (StatePartition::Data, normalized.clone()),
        _ if !normalized.contains('/') => (StatePartition::Data, normalized.clone()),
        _ => (
            StatePartition::Evidence,
            format!("legacy-unclassified/{normalized}"),
        ),
    };

    Ok((
        partition,
        format!("{STATE_ROOT}/{}/{mapped}", partition.directory()),
    ))
}

/// Copies legacy state into the partitioned namespace. This operation is
/// intentionally non-destructive and idempotent. Existing different content
/// becomes a conflict and is never overwritten.
pub fn migrate_legacy_state(root: &Path) -> Result<MigrationOutcome, String> {
    let legacy_root = root.join(LEGACY_STATE_ROOT);
    let legacy_exists = legacy_root.is_dir();
    let mut outcome = MigrationOutcome::default();

    if legacy_exists {
        let mut files = Vec::new();
        collect_regular_files(&legacy_root, &legacy_root, &mut files, &mut outcome.skipped)?;
        files.sort();

        for relative in files {
            let relative_string = relative.to_string_lossy().replace('\\', "/");
            let (_, target_relative) = migration_target(&relative_string)?;
            let source = legacy_root.join(&relative);
            let target = root.join(&target_relative);
            let content = fs::read(&source).map_err(|error| error.to_string())?;

            if target.exists() {
                let target_content = fs::read(&target).map_err(|error| error.to_string())?;
                if target_content == content {
                    outcome.unchanged += 1;
                } else {
                    outcome.conflicts.push(target_relative);
                }
                continue;
            }

            write_atomic(&target, &content)?;
            outcome.copied += 1;
        }
    }

    outcome.conflicts.sort();
    outcome.skipped.sort();
    let manifest = namespace_manifest(&outcome, legacy_exists);
    write_atomic(
        &root.join(NAMESPACE_MANIFEST),
        &[
            serde_json::to_vec_pretty(&manifest).map_err(|error| error.to_string())?,
            b"\n".to_vec(),
        ]
        .concat(),
    )?;
    Ok(outcome)
}

/// Ensures a project uses the v1 namespace. Existing active namespaces are
/// left untouched because their legacy source intentionally becomes stale
/// after cutover.
pub fn ensure_active_state_namespace(root: &Path) -> Result<MigrationOutcome, String> {
    if namespace_is_active(root) {
        return Ok(MigrationOutcome::default());
    }
    let outcome = migrate_legacy_state(root)?;
    if outcome.conflicts.is_empty() {
        activate_state_namespace(root, &outcome, root.join(LEGACY_STATE_ROOT).is_dir())?;
    }
    Ok(outcome)
}

/// Produces the evidence required before an explicitly approved cleanup can
/// delete `.project-os`. It re-reads all legacy files instead of trusting a
/// historical migration manifest because source data can change after cutover.
pub fn legacy_retirement_readiness(root: &Path) -> Result<LegacyRetirementReadiness, String> {
    let legacy_root = root.join(LEGACY_STATE_ROOT);
    let mut readiness = LegacyRetirementReadiness {
        namespace_active: namespace_is_active(root),
        legacy_exists: legacy_root.is_dir(),
        ..LegacyRetirementReadiness::default()
    };

    if !readiness.legacy_exists {
        readiness.ready = readiness.namespace_active;
        return Ok(readiness);
    }

    let mut files = Vec::new();
    collect_regular_files(
        &legacy_root,
        &legacy_root,
        &mut files,
        &mut readiness.skipped,
    )?;
    files.sort();

    for relative in files {
        let legacy_relative = relative.to_string_lossy().replace('\\', "/");
        let (_, target_relative) = migration_target(&legacy_relative)?;
        let source = legacy_root.join(&relative);
        let target = root.join(&target_relative);
        if !target.is_file() {
            readiness.missing_targets.push(target_relative);
            continue;
        }
        if fs::read(&source).map_err(|error| error.to_string())?
            != fs::read(&target).map_err(|error| error.to_string())?
        {
            readiness.mismatched_targets.push(target_relative);
        }
    }

    readiness.missing_targets.sort();
    readiness.mismatched_targets.sort();
    readiness.skipped.sort();
    readiness.ready = readiness.namespace_active
        && readiness.missing_targets.is_empty()
        && readiness.mismatched_targets.is_empty()
        && readiness.skipped.is_empty();
    Ok(readiness)
}

/// Archives only legacy files that diverged after cutover. This is a separate,
/// explicit retention action: it never removes `.project-os`, and callers must
/// use the archive as evidence before requesting a destructive cleanup.
pub fn archive_legacy_retirement_differences(root: &Path) -> Result<LegacyRetentionArchive, String> {
    let readiness = legacy_retirement_readiness(root)?;
    if !readiness.namespace_active {
        return Err("状态命名空间尚未激活，不能归档 legacy 差异".to_string());
    }
    if !readiness.legacy_exists {
        return Err("未发现需要归档的 legacy 状态目录".to_string());
    }
    if !readiness.missing_targets.is_empty() || !readiness.skipped.is_empty() {
        return Err("legacy 状态仍有漏迁或符号链接，不能归档后清理".to_string());
    }

    let archive_id = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .to_string();
    let archive_relative = format!("{STATE_ROOT}/evidence/legacy-retirement/{archive_id}");
    let archive_root = root.join(&archive_relative);
    let legacy_root = root.join(LEGACY_STATE_ROOT);
    let mut files = Vec::new();
    let mut skipped = Vec::new();
    collect_regular_files(&legacy_root, &legacy_root, &mut files, &mut skipped)?;
    if !skipped.is_empty() {
        return Err("legacy 状态包含符号链接，不能归档后清理".to_string());
    }
    files.sort();

    let mut archived = Vec::new();
    for relative in files {
        let legacy_relative = relative.to_string_lossy().replace('\\', "/");
        let (_, active_target) = migration_target(&legacy_relative)?;
        let source = legacy_root.join(&relative);
        let target = root.join(&active_target);
        let source_content = fs::read(&source).map_err(|error| error.to_string())?;
        if target.is_file()
            && source_content == fs::read(&target).map_err(|error| error.to_string())?
        {
            continue;
        }
        let archive_file = archive_root.join("source").join(&relative);
        write_atomic(&archive_file, &source_content)?;
        archived.push(LegacyRetentionArchiveFile {
            legacy_relative,
            active_target,
            bytes: source_content.len(),
        });
    }
    archived.sort_by(|left, right| left.legacy_relative.cmp(&right.legacy_relative));
    let manifest = json!({
        "schemaVersion": "omnidesk.legacy-retention-archive.v1",
        "archiveRoot": archive_relative,
        "legacyRoot": LEGACY_STATE_ROOT,
        "files": archived.clone(),
    });
    write_atomic(
        &archive_root.join("manifest.json"),
        &[serde_json::to_vec_pretty(&manifest).map_err(|error| error.to_string())?, b"\n".to_vec()].concat(),
    )?;
    Ok(LegacyRetentionArchive {
        archive_relative,
        files: archived,
    })
}

pub fn namespace_is_active(root: &Path) -> bool {
    fs::read_to_string(root.join(NAMESPACE_MANIFEST))
        .ok()
        .and_then(|content| serde_json::from_str::<Value>(&content).ok())
        .and_then(|manifest| {
            manifest
                .get("activeNamespace")
                .and_then(Value::as_str)
                .map(|value| value == "omnidesk")
        })
        .unwrap_or(false)
}

pub fn state_path_for_read(root: &Path, relative_path: &str) -> Result<PathBuf, String> {
    let normalized = normalize_relative_path(relative_path)?;
    if normalized == STATE_ROOT || normalized.starts_with(&format!("{STATE_ROOT}/")) {
        return Ok(root.join(normalized));
    }
    if normalized == LEGACY_STATE_ROOT {
        return Ok(if namespace_is_active(root) {
            root.join(STATE_ROOT)
        } else {
            root.join(LEGACY_STATE_ROOT)
        });
    }
    let Some(legacy_relative) = normalized.strip_prefix(&format!("{LEGACY_STATE_ROOT}/")) else {
        return Ok(root.join(normalized));
    };
    if namespace_is_active(root) {
        let (_, target) = migration_target(legacy_relative)?;
        return Ok(root.join(target));
    }
    Ok(root.join(normalized))
}

pub fn state_path_for_write(root: &Path, relative_path: &str) -> Result<PathBuf, String> {
    state_path_for_read(root, relative_path)
}

pub fn state_path_exists(root: &Path, relative_path: &str) -> bool {
    state_path_for_read(root, relative_path)
        .is_ok_and(|path| path.exists())
}

pub fn legacy_relative_from_absolute(path: &Path) -> Option<(PathBuf, String)> {
    let components = path.components().collect::<Vec<_>>();
    let legacy_index = components.iter().position(|component| {
        matches!(component, Component::Normal(value) if *value == std::ffi::OsStr::new(LEGACY_STATE_ROOT))
    })?;
    let root = components[..legacy_index]
        .iter()
        .fold(PathBuf::new(), |mut result, component| {
            result.push(component.as_os_str());
            result
        });
    let suffix = components[legacy_index + 1..]
        .iter()
        .fold(PathBuf::new(), |mut result, component| {
            result.push(component.as_os_str());
            result
        })
        .to_string_lossy()
        .replace('\\', "/");
    Some((root, format!("{LEGACY_STATE_ROOT}/{suffix}")))
}

pub fn state_path_from_absolute(path: &Path) -> Result<PathBuf, String> {
    let Some((root, legacy_relative)) = legacy_relative_from_absolute(path) else {
        return Ok(path.to_path_buf());
    };
    state_path_for_read(&root, &legacy_relative)
}

pub fn namespace_manifest(outcome: &MigrationOutcome, legacy_exists: bool) -> Value {
    json!({
        "schemaVersion": "omnidesk.state-namespace.v1",
        "layoutVersion": 1,
        "stateRoot": STATE_ROOT,
        "legacyRoot": LEGACY_STATE_ROOT,
        "activeNamespace": "legacy",
        "readMode": "legacy-primary",
        "partitions": {
            "data": ".omnidesk/data",
            "runtime": ".omnidesk/runtime",
            "cache": ".omnidesk/cache",
            "evidence": ".omnidesk/evidence"
        },
        "migration": {
            "status": outcome.status(legacy_exists),
            "copied": outcome.copied,
            "unchanged": outcome.unchanged,
            "conflicts": outcome.conflicts,
            "skipped": outcome.skipped
        }
    })
}

fn activate_state_namespace(
    root: &Path,
    outcome: &MigrationOutcome,
    legacy_exists: bool,
) -> Result<(), String> {
    let mut manifest = namespace_manifest(outcome, legacy_exists);
    manifest["activeNamespace"] = Value::String("omnidesk".to_string());
    manifest["readMode"] = Value::String("omnidesk-primary".to_string());
    write_atomic(
        &root.join(NAMESPACE_MANIFEST),
        &[
            serde_json::to_vec_pretty(&manifest).map_err(|error| error.to_string())?,
            b"\n".to_vec(),
        ]
        .concat(),
    )
}

fn normalize_relative_path(path: &str) -> Result<String, String> {
    let relative = Path::new(path);
    if path.trim().is_empty()
        || relative.is_absolute()
        || relative.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
    {
        return Err("迁移路径必须位于旧状态根内".to_string());
    }
    Ok(relative.to_string_lossy().replace('\\', "/"))
}

fn collect_regular_files(
    base: &Path,
    directory: &Path,
    files: &mut Vec<PathBuf>,
    skipped: &mut Vec<String>,
) -> Result<(), String> {
    let entries = fs::read_dir(directory).map_err(|error| error.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        let relative = path
            .strip_prefix(base)
            .map_err(|error| error.to_string())?
            .to_path_buf();
        let metadata = fs::symlink_metadata(&path).map_err(|error| error.to_string())?;
        if metadata.file_type().is_symlink() {
            skipped.push(relative.to_string_lossy().replace('\\', "/"));
        } else if metadata.is_dir() {
            collect_regular_files(base, &path, files, skipped)?;
        } else if metadata.is_file() {
            files.push(relative);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn test_root(label: &str) -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        std::env::temp_dir().join(format!("omnidesk-state-namespace-{label}-{stamp}"))
    }

    #[test]
    fn classifies_legacy_state_into_explicit_partitions() {
        assert_eq!(
            migration_target("conversations/conv-1.json").unwrap(),
            (
                StatePartition::Data,
                ".omnidesk/data/conversations/conv-1.json".to_string()
            )
        );
        assert_eq!(
            migration_target("runs/desktop-tasks/task-1.json").unwrap(),
            (
                StatePartition::Data,
                ".omnidesk/data/tasks/task-1.json".to_string()
            )
        );
        assert_eq!(
            migration_target("events/event-1.json").unwrap(),
            (
                StatePartition::Runtime,
                ".omnidesk/runtime/events/event-1.json".to_string()
            )
        );
        assert_eq!(
            migration_target("model-health.json").unwrap(),
            (
                StatePartition::Cache,
                ".omnidesk/cache/model-health.json".to_string()
            )
        );
        assert_eq!(
            migration_target("reports/eval.json").unwrap(),
            (
                StatePartition::Evidence,
                ".omnidesk/evidence/reports/eval.json".to_string()
            )
        );
        assert_eq!(
            migration_target("runs/desktop-conversations/conv-1.json").unwrap(),
            (
                StatePartition::Data,
                ".omnidesk/data/conversations/conv-1.json".to_string()
            )
        );
        assert_eq!(
            migration_target("runs/agent-runs/run-1.json").unwrap(),
            (
                StatePartition::Data,
                ".omnidesk/data/agent-runs/run-1.json".to_string()
            )
        );
        assert!(migration_target("../secret").is_err());
    }

    #[test]
    fn migration_is_idempotent_and_never_deletes_legacy_state() {
        let root = test_root("idempotent");
        let source = root.join(".project-os/conversations/conv-1.json");
        write_atomic(&source, br#"{"id":"conv-1"}"#).unwrap();

        let first = migrate_legacy_state(&root).unwrap();
        assert_eq!(first.copied, 1);
        assert!(source.exists());
        assert_eq!(
            fs::read(root.join(".omnidesk/data/conversations/conv-1.json")).unwrap(),
            br#"{"id":"conv-1"}"#
        );

        let second = migrate_legacy_state(&root).unwrap();
        assert_eq!(second.copied, 0);
        assert_eq!(second.unchanged, 1);
        assert!(second.conflicts.is_empty());
        assert!(source.exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn migration_records_conflicts_without_overwriting_target() {
        let root = test_root("conflict");
        write_atomic(&root.join(".project-os/state.json"), br#"{"source":true}"#).unwrap();
        let target = root.join(".omnidesk/data/state.json");
        write_atomic(&target, br#"{"target":true}"#).unwrap();

        let outcome = migrate_legacy_state(&root).unwrap();
        assert_eq!(outcome.copied, 0);
        assert_eq!(
            outcome.conflicts,
            vec![".omnidesk/data/state.json".to_string()]
        );
        assert_eq!(fs::read(target).unwrap(), br#"{"target":true}"#);
        let manifest: Value =
            serde_json::from_slice(&fs::read(root.join(NAMESPACE_MANIFEST)).unwrap()).unwrap();
        assert_eq!(manifest["migration"]["status"], "conflicted");
        assert_eq!(manifest["activeNamespace"], "legacy");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn activation_refuses_conflicts_and_keeps_legacy_reads() {
        let root = test_root("activation-conflict");
        write_atomic(&root.join(".project-os/state.json"), br#"{"source":"legacy"}"#).unwrap();
        write_atomic(
            &root.join(".omnidesk/data/state.json"),
            br#"{"source":"omnidesk"}"#,
        )
        .unwrap();

        let outcome = ensure_active_state_namespace(&root).unwrap();
        assert_eq!(
            outcome.conflicts,
            vec![".omnidesk/data/state.json".to_string()]
        );
        assert!(!namespace_is_active(&root));
        assert_eq!(
            state_path_for_read(&root, ".project-os/state.json").unwrap(),
            root.join(".project-os/state.json")
        );
        assert_eq!(
            fs::read(state_path_for_read(&root, ".project-os/state.json").unwrap()).unwrap(),
            br#"{"source":"legacy"}"#
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn activation_switches_legacy_logical_paths_to_partitioned_state() {
        let root = test_root("activation");
        let legacy = root.join(".project-os/goals.json");
        write_atomic(&legacy, br#"{"goals":[]}"#).unwrap();

        let outcome = ensure_active_state_namespace(&root).unwrap();
        assert_eq!(outcome.copied, 1);
        assert!(namespace_is_active(&root));
        assert_eq!(
            state_path_for_read(&root, ".project-os/goals.json").unwrap(),
            root.join(".omnidesk/data/goals.json")
        );
        assert_eq!(
            fs::read(state_path_for_read(&root, ".project-os/goals.json").unwrap()).unwrap(),
            br#"{"goals":[]}"#
        );

        write_atomic(
            &root.join(".omnidesk/data/goals.json"),
            br#"{"goals":[{"id":"new"}]}"#,
        )
        .unwrap();
        let second = ensure_active_state_namespace(&root).unwrap();
        assert_eq!(second, MigrationOutcome::default());
        assert_eq!(fs::read(legacy).unwrap(), br#"{"goals":[]}"#);
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn migration_skips_symlinks_instead_of_following_them() {
        use std::os::unix::fs::symlink;

        let root = test_root("symlink");
        fs::create_dir_all(root.join(".project-os")).unwrap();
        let outside = root.join("outside.json");
        write_atomic(&outside, br#"{"secret":true}"#).unwrap();
        symlink(&outside, root.join(".project-os/link.json")).unwrap();

        let outcome = migrate_legacy_state(&root).unwrap();
        assert_eq!(outcome.skipped, vec!["link.json".to_string()]);
        assert!(!root.join(".omnidesk/data/link.json").exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn retirement_readiness_requires_an_active_lossless_namespace() {
        let root = test_root("retirement-ready");
        write_atomic(&root.join(".project-os/goals.json"), br#"{\"goals\":[]}"#).unwrap();

        let before_activation = legacy_retirement_readiness(&root).unwrap();
        assert!(!before_activation.ready);
        assert!(before_activation
            .missing_targets
            .contains(&".omnidesk/data/goals.json".to_string()));

        ensure_active_state_namespace(&root).unwrap();
        let ready = legacy_retirement_readiness(&root).unwrap();
        assert!(ready.ready);

        write_atomic(
            &root.join(".project-os/goals.json"),
            br#"{\"goals\":[\"changed\"]}"#,
        )
        .unwrap();
        let changed_legacy = legacy_retirement_readiness(&root).unwrap();
        assert!(!changed_legacy.ready);
        assert_eq!(
            changed_legacy.mismatched_targets,
            vec![".omnidesk/data/goals.json"]
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn retention_archive_preserves_only_diverged_legacy_files() {
        let root = test_root("retention-archive");
        write_atomic(&root.join(".project-os/state.json"), br#"{\"version\":1}"#).unwrap();
        write_atomic(&root.join(".project-os/goals.json"), br#"{\"goals\":[]}"#).unwrap();
        ensure_active_state_namespace(&root).unwrap();
        write_atomic(
            &root.join(".project-os/state.json"),
            br#"{\"version\":0,\"legacy\":true}"#,
        )
        .unwrap();

        let archive = archive_legacy_retirement_differences(&root).unwrap();
        assert_eq!(archive.files.len(), 1);
        assert_eq!(archive.files[0].legacy_relative, "state.json");
        assert_eq!(
            fs::read(root.join(&archive.archive_relative).join("source/state.json")).unwrap(),
            br#"{\"version\":0,\"legacy\":true}"#
        );
        assert!(root.join(".project-os/state.json").exists());
        assert!(root.join(&archive.archive_relative).join("manifest.json").exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn retirement_readiness_rejects_legacy_symlinks() {
        use std::os::unix::fs::symlink;

        let root = test_root("retirement-symlink");
        let outside = root.join("outside.json");
        write_atomic(&root.join(".project-os/state.json"), br#"{}"#).unwrap();
        write_atomic(&outside, b"outside").unwrap();
        symlink(&outside, root.join(".project-os/link.json")).unwrap();
        ensure_active_state_namespace(&root).unwrap();

        let readiness = legacy_retirement_readiness(&root).unwrap();
        assert!(!readiness.ready);
        assert_eq!(readiness.skipped, vec!["link.json"]);
        fs::remove_dir_all(root).unwrap();
    }
}
