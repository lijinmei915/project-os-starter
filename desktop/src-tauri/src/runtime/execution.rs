use crate::runtime::repository::{JsonMutation, Repository, TextMutation};
use serde_json::{json, Value};
use std::io::Write;
use std::path::Path;
use std::process::{Command, Stdio};

const AUDIT_PATH: &str = ".omnidesk/evidence/execution-audit.json";
const RUN_SUMMARY_PATH: &str = ".omnidesk/evidence/desktop-summary.md";
const MAX_EVENTS: usize = 2_000;
const EXECUTION_AUDIT_SCHEMA_VERSION: &str = "omnidesk.execution-audit.v0.1";

/// A fixed, repository-scoped verification command that can be separately approved.
pub struct GuardedCheckSpec {
    pub id: &'static str,
    pub label: &'static str,
    pub command: &'static str,
    pub program: String,
    pub args: Vec<String>,
    pub required_paths: Vec<&'static str>,
}

pub fn guarded_check_spec(id: &str) -> Option<GuardedCheckSpec> {
    match id {
        "runtime" => Some(GuardedCheckSpec {
            id: "runtime",
            label: "Desktop Tests",
            command: "npm --prefix desktop test",
            program: "npm".to_string(),
            args: vec!["--prefix".to_string(), "desktop".to_string(), "test".to_string()],
            required_paths: vec!["desktop/package.json"],
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

pub fn trim_runner_output(value: &str) -> String {
    let trimmed = value.trim();
    let mut result: String = trimmed.chars().take(6000).collect();
    if trimmed.chars().count() > 6000 {
        result.push_str("\n...output trimmed...");
    }
    result
}

pub fn run_git_apply(
    root: &Path,
    diff: &str,
    check_only: bool,
) -> Result<std::process::Output, String> {
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

pub fn build_run_summary_markdown(task: &Value, finished_at: &str) -> String {
    let title = task
        .get("title")
        .and_then(Value::as_str)
        .unwrap_or("未命名任务");
    let status = task
        .get("status")
        .and_then(Value::as_str)
        .unwrap_or("unknown");
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
            "schemaVersion": EXECUTION_AUDIT_SCHEMA_VERSION, "events": []
        }));
        let object = audit.as_object_mut().ok_or_else(|| "执行审计记录必须是 JSON object".to_string())?;
        object.insert("schemaVersion".to_string(), Value::String(EXECUTION_AUDIT_SCHEMA_VERSION.to_string()));
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
            .read_text(RUN_SUMMARY_PATH)
            .unwrap_or_else(|| {
                "# Desktop Run Summary\n\n> OmniDesk 自动生成的任务摘要。\n\n".to_string()
            });
        let content = format!("{}{}\n", existing.trim_end(), summary);
        Ok((
            (),
            vec![TextMutation::upsert(
                RUN_SUMMARY_PATH,
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
    fn guarded_checks_are_fixed_to_the_desktop_runtime_contract() {
        let runtime = guarded_check_spec("runtime").expect("runtime check exists");
        assert_eq!(runtime.command, "npm --prefix desktop test");
        assert_eq!(runtime.required_paths, vec!["desktop/package.json"]);
        assert!(guarded_check_spec("arbitrary-shell-command").is_none());
    }

    #[test]
    fn runner_output_is_bounded_without_changing_short_output() {
        assert_eq!(trim_runner_output("  passed\n"), "passed");
        let output = trim_runner_output(&"x".repeat(6001));
        assert!(output.starts_with(&"x".repeat(6000)));
        assert!(output.ends_with("...output trimmed..."));
    }

    #[test]
    fn run_summary_uses_persisted_task_evidence_and_caller_timestamp() {
        let summary = build_run_summary_markdown(
            &json!({
                "title": "修复执行域",
                "status": "done",
                "patchDraft": { "files": ["desktop/src-tauri/src/runtime/execution.rs"] },
                "applyResult": { "message": "Patch 已应用" },
                "verificationSummary": "检查通过",
                "runs": [{ "label": "Cargo", "success": true }]
            }),
            "2026-07-21T00:00:00Z",
        );
        assert!(summary.contains("修复执行域"));
        assert!(summary.contains("2026-07-21T00:00:00Z"));
        assert!(summary.contains("`desktop/src-tauri/src/runtime/execution.rs`"));
        assert!(summary.contains("Cargo: passed"));
    }

    #[test]
    fn audit_entries_are_schema_versioned_and_transactional() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-execution-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        crate::runtime::state_namespace::ensure_active_state_namespace(&root).unwrap();
        append_audit(&root, "patch-apply", true, json!({"stage":"apply"}), "now").unwrap();
        let audit = Repository::new(&root).read_json(AUDIT_PATH).unwrap();
        assert_eq!(audit["schemaVersion"], EXECUTION_AUDIT_SCHEMA_VERSION);
        assert_eq!(audit["events"][0]["action"], "patch-apply");
        assert!(root.join(".omnidesk/runtime/events").is_dir());
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
        crate::runtime::state_namespace::ensure_active_state_namespace(&root).unwrap();
        std::fs::write(root.join("HANDOFF.md"), "# 当前交接\n").unwrap();
        append_run_summary(&root, "## First").unwrap();
        append_run_summary(&root, "## Second").unwrap();
        append_handoff(&root, "\n## First handoff").unwrap();
        append_handoff(&root, "\n## Second handoff").unwrap();
        let summary =
            std::fs::read_to_string(root.join(RUN_SUMMARY_PATH)).unwrap();
        let handoff = std::fs::read_to_string(root.join("HANDOFF.md")).unwrap();
        assert!(summary.contains("## First") && summary.contains("## Second"));
        assert!(handoff.contains("## First handoff") && handoff.contains("## Second handoff"));
        let events = std::fs::read_dir(root.join(".omnidesk/runtime/events"))
            .unwrap()
            .count();
        assert_eq!(events, 4);
        std::fs::remove_dir_all(root).unwrap();
    }
}
