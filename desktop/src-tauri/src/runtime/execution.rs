use crate::runtime::repository::{JsonMutation, Repository, TextMutation};
use serde_json::{json, Value};
use std::path::Path;

const AUDIT_PATH: &str = ".project-os/runs/execution-audit.json";
const MAX_EVENTS: usize = 2_000;

/// Appends a bounded execution audit entry through the same locked transaction
/// boundary as every other runtime state mutation.
pub fn append_audit(
    root: &Path,
    action: &str,
    success: bool,
    details: Value,
    timestamp: &str,
) -> Result<(), String> {
    let repository = Repository::new(root);
    repository.transaction_with("append-execution-audit", |repository| {
        let mut audit = repository.read_json(AUDIT_PATH).unwrap_or_else(|| json!({
            "schemaVersion": "project-os.execution-audit.v0.1", "events": []
        }));
        let object = audit.as_object_mut().ok_or_else(|| "执行审计记录必须是 JSON object".to_string())?;
        object.insert("schemaVersion".to_string(), Value::String("project-os.execution-audit.v0.1".to_string()));
        object.insert("updatedAt".to_string(), Value::String(timestamp.to_string()));
        let events = object.entry("events").or_insert_with(|| Value::Array(Vec::new())).as_array_mut()
            .ok_or_else(|| "执行审计 events 必须是 array".to_string())?;
        events.push(json!({ "timestamp": timestamp, "action": action, "success": success, "details": details }));
        if events.len() > MAX_EVENTS { events.drain(..events.len() - MAX_EVENTS); }
        Ok(((), vec![JsonMutation::upsert(AUDIT_PATH, audit)]))
    })
}

pub fn append_run_summary(root: &Path, summary: &str) -> Result<(), String> {
    Repository::new(root).text_transaction_with("append-run-summary", |repository| {
        let existing = repository
            .read_text(".project-os/runs/desktop-summary.md")
            .unwrap_or_else(|| {
                "# Desktop Run Summary\n\n> OmniDesk 自动生成的任务摘要。\n\n".to_string()
            });
        let content = format!("{}{}\n", existing.trim_end(), summary);
        Ok((
            (),
            vec![TextMutation::upsert(
                ".project-os/runs/desktop-summary.md",
                content,
            )],
        ))
    })
}

pub fn append_handoff(root: &Path, block: &str) -> Result<(), String> {
    Repository::new(root).text_transaction_with("append-handoff", |repository| {
        let existing = repository
            .read_text("HANDOFF.md")
            .ok_or_else(|| "当前项目没有 HANDOFF.md，不能自动合并交接。".to_string())?;
        let content = format!("{}{}\n", existing.trim_end(), block);
        Ok(((), vec![TextMutation::upsert("HANDOFF.md", content)]))
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn audit_entries_are_schema_versioned_and_transactional() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-execution-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        append_audit(&root, "patch-apply", true, json!({"stage":"apply"}), "now").unwrap();
        let audit = Repository::new(&root).read_json(AUDIT_PATH).unwrap();
        assert_eq!(audit["schemaVersion"], "project-os.execution-audit.v0.1");
        assert_eq!(audit["events"][0]["action"], "patch-apply");
        assert!(root.join(".project-os/events").is_dir());
    }

    #[test]
    fn text_appends_are_transactional_and_keep_prior_blocks() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-execution-text-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(root.join("HANDOFF.md"), "# 当前交接\n").unwrap();
        append_run_summary(&root, "## First").unwrap();
        append_run_summary(&root, "## Second").unwrap();
        append_handoff(&root, "\n## First handoff").unwrap();
        append_handoff(&root, "\n## Second handoff").unwrap();
        let summary =
            std::fs::read_to_string(root.join(".project-os/runs/desktop-summary.md")).unwrap();
        let handoff = std::fs::read_to_string(root.join("HANDOFF.md")).unwrap();
        assert!(summary.contains("## First") && summary.contains("## Second"));
        assert!(handoff.contains("## First handoff") && handoff.contains("## Second handoff"));
        let events = std::fs::read_dir(root.join(".project-os/events"))
            .unwrap()
            .count();
        assert_eq!(events, 4);
        std::fs::remove_dir_all(root).unwrap();
    }
}
