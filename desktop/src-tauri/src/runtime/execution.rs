use crate::runtime::repository::{JsonMutation, Repository, TextMutation};
use serde::Serialize;
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

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GuardedCheckResult {
    id: String,
    label: String,
    command: String,
    success: bool,
    code: Option<i32>,
    output: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyPatchResult {
    pub success: bool,
    pub message: String,
    pub output: String,
}

pub fn guarded_check_spec(id: &str) -> Option<GuardedCheckSpec> {
    match id {
        "runtime" => Some(GuardedCheckSpec {
            id: "runtime",
            label: "Desktop Tests",
            command: "npm --prefix desktop test",
            program: "npm".to_string(),
            args: vec![
                "--prefix".to_string(),
                "desktop".to_string(),
                "test".to_string(),
            ],
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

/// Runs a separately approved, fixed check and records only bounded evidence.
/// Callers must resolve the selected project root before entering this boundary.
pub fn run_guarded_check(
    root: &Path,
    check_id: &str,
    timestamp: &str,
) -> Result<GuardedCheckResult, String> {
    let result = execute_guarded_check(root, check_id)?;
    let _ = append_audit(
        root,
        "guarded-check",
        result.success,
        json!({ "checkId": result.id }),
        timestamp,
    );
    Ok(result)
}

/// Executes a fixed check after its caller has already passed the appropriate
/// approval boundary. Goal validation reuses this runner but owns aggregation
/// and goal-state persistence, so it does not create a second execution path.
pub(crate) fn execute_guarded_check(
    root: &Path,
    check_id: &str,
) -> Result<GuardedCheckResult, String> {
    if !root.exists() || !root.is_dir() {
        return Err("当前项目路径不存在或不是目录".to_string());
    }
    let spec =
        guarded_check_spec(check_id).ok_or_else(|| format!("不允许执行这个检查：{check_id}"))?;
    for relative in &spec.required_paths {
        if !root.join(relative).exists() {
            return Err(format!("当前项目缺少检查所需文件：{relative}"));
        }
    }

    let output = Command::new(&spec.program)
        .args(&spec.args)
        .current_dir(root)
        .output()
        .map_err(|err| err.to_string())?;
    Ok(GuardedCheckResult {
        id: spec.id.to_string(),
        label: spec.label.to_string(),
        command: spec.command.to_string(),
        success: output.status.success(),
        code: output.status.code(),
        output: trim_runner_output(&format!(
            "{}{}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        )),
    })
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

/// Validates and applies an already-approved Patch Draft. The caller owns the
/// project access decision; this boundary owns diff semantics, Git execution,
/// bounded output and audit evidence.
pub fn apply_patch_draft(
    root: &Path,
    draft: &Value,
    timestamp: &str,
) -> Result<ApplyPatchResult, String> {
    if draft
        .get("notApplicable")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        return Err(
            "当前任务没有已确认的工程改动，不能应用 Patch。请先运行检查或调整计划范围。"
                .to_string(),
        );
    }
    let diff = draft_diff(draft)?;
    if diff.contains("PATCH_DRAFT_PENDING") {
        return Err("当前还是占位草案，不能应用。请先生成真实 patch。".to_string());
    }
    if !diff.contains("@@") || !diff.contains("--- ") || !diff.contains("+++ ") {
        return Err("patch 草案不是可应用的 unified diff".to_string());
    }
    crate::runtime::patch::validate_apply_diff_paths(diff)?;
    let allowed_files = draft
        .get("allowedFiles")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(ToString::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    crate::runtime::patch::validate_unified_diff_authorized(diff, &allowed_files)?;

    let check = run_git_apply(root, diff, true)?;
    if !check.status.success() {
        let _ = append_audit(
            root,
            "patch-apply",
            false,
            json!({ "stage": "validate" }),
            timestamp,
        );
        return Err(format!(
            "patch 验证失败：{}",
            trim_runner_output(&format!(
                "{}{}",
                String::from_utf8_lossy(&check.stdout),
                String::from_utf8_lossy(&check.stderr)
            ))
        ));
    }

    let applied = run_git_apply(root, diff, false)?;
    let output = trim_runner_output(&format!(
        "{}{}",
        String::from_utf8_lossy(&applied.stdout),
        String::from_utf8_lossy(&applied.stderr)
    ));
    if !applied.status.success() {
        let _ = append_audit(
            root,
            "patch-apply",
            false,
            json!({ "stage": "apply" }),
            timestamp,
        );
        return Err(format!("patch 应用失败：{}", output));
    }
    let _ = append_audit(
        root,
        "patch-apply",
        true,
        json!({ "stage": "apply" }),
        timestamp,
    );
    Ok(ApplyPatchResult {
        success: true,
        message: "patch 已应用到当前项目文件".to_string(),
        output,
    })
}

/// Executes one approved Agent tool against the project that originally owned
/// the run. The project binding is checked before the approval is consumed so
/// switching the active project cannot redirect a previously approved write.
pub fn execute_approved_agent_tool(
    app_root: &Path,
    project_root: &Path,
    project_id: &str,
    project_access_mode: &str,
    run_id: &str,
    approval_token: &str,
    timestamp: &str,
) -> Result<Value, String> {
    let mut run = crate::runtime::agent_runs::load(app_root, run_id)
        .map_err(|_| "没有找到待执行的 Agent Run。".to_string())?;
    if run.project_id != project_id {
        return Err("当前项目与该 Agent Run 的授权项目不一致，已拒绝执行。".to_string());
    }
    let (name, arguments) =
        crate::runtime::agent_runs::begin_approved_tool(&mut run, approval_token, timestamp)?;
    crate::runtime::agent_runs::persist(app_root, &run)?;

    let result = if name == "integrate_worktree" {
        integrate_isolated_workspace(
            project_root,
            project_access_mode,
            run.isolation.as_ref(),
            &arguments,
            timestamp,
        )
    } else {
        let execution_root = run
            .isolation
            .as_ref()
            .map(|workspace| {
                crate::runtime::isolated_workspace::execution_root(workspace, project_root)
            })
            .transpose();
        execution_root.and_then(|execution_root| {
            execute_approved_tool(
                execution_root.as_deref().unwrap_or(project_root),
                project_access_mode,
                &name,
                &arguments,
                timestamp,
            )
        })
    };
    let result = match result {
        Ok(result) => result,
        Err(error) => {
            crate::runtime::agent_runs::fail_approved_tool(&mut run, &name, &error, timestamp);
            crate::runtime::agent_runs::persist(app_root, &run)?;
            return Err(error);
        }
    };
    crate::runtime::agent_runs::settle_approved_tool(
        &mut run,
        &name,
        &arguments,
        result.clone(),
        timestamp,
    );
    crate::runtime::agent_runs::persist(app_root, &run)?;
    Ok(result)
}

fn integrate_isolated_workspace(
    project_root: &Path,
    project_access_mode: &str,
    workspace: Option<&crate::runtime::isolated_workspace::IsolatedWorkspace>,
    arguments: &Value,
    timestamp: &str,
) -> Result<Value, String> {
    if project_access_mode != "controlled" {
        return Err("当前项目未授权受控修改。".to_string());
    }
    let workspace = workspace.ok_or_else(|| "Agent Run 没有可合并的隔离工作区。".to_string())?;
    crate::runtime::isolated_workspace::ensure_source_clean(project_root)?;
    let approved_diff = arguments
        .get("diff")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "隔离合并审批缺少 diff。".to_string())?;
    let current_diff = crate::runtime::isolated_workspace::integration_diff(workspace, project_root)?;
    if current_diff != approved_diff {
        return Err("隔离工作区在审批后发生变化；请重新生成合并审批。".to_string());
    }
    let allowed_files = arguments
        .get("allowedFiles")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(ToString::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let draft = json!({ "diff": approved_diff, "allowedFiles": allowed_files });
    let applied = apply_patch_draft(project_root, &draft, timestamp)?;
    let cleanup = crate::runtime::isolated_workspace::remove(workspace, project_root)
        .err()
        .unwrap_or_default();
    Ok(json!({
        "success": true,
        "message": "隔离工作区改动已合并到当前工程。",
        "apply": applied,
        "cleanupWarning": cleanup,
        "workspaceId": workspace.id,
    }))
}

fn execute_approved_tool(
    project_root: &Path,
    project_access_mode: &str,
    name: &str,
    arguments: &Value,
    timestamp: &str,
) -> Result<Value, String> {
    match name {
        "apply_patch" => {
            if project_access_mode != "controlled" {
                return Err("当前项目未授权受控修改。".to_string());
            }
            let diff = arguments
                .get("diff")
                .and_then(Value::as_str)
                .ok_or_else(|| "审批 Patch 缺少 diff。".to_string())?;
            let allowed_files = arguments
                .get("allowedFiles")
                .and_then(Value::as_array)
                .map(|items| {
                    items
                        .iter()
                        .filter_map(Value::as_str)
                        .map(ToString::to_string)
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            let draft = json!({ "diff": diff, "allowedFiles": allowed_files });
            serde_json::to_value(apply_patch_draft(project_root, &draft, timestamp)?)
                .map_err(|err| err.to_string())
        }
        "run_check" => {
            if project_access_mode != "controlled" {
                return Err("当前项目未授权执行检查。".to_string());
            }
            let check_id = arguments
                .get("checkId")
                .and_then(Value::as_str)
                .ok_or_else(|| "审批检查缺少 checkId。".to_string())?;
            serde_json::to_value(run_guarded_check(project_root, check_id, timestamp)?)
                .map_err(|err| err.to_string())
        }
        "integrate_worktree" => Err("隔离合并只能通过绑定 Agent Run 的执行入口。".to_string()),
        _ => Err(format!("不允许执行审批工具：{name}")),
    }
}

fn draft_diff(draft: &Value) -> Result<&str, String> {
    draft
        .get("diff")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "patch 草案为空".to_string())
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
        let existing = repository.read_text(RUN_SUMMARY_PATH).unwrap_or_else(|| {
            "# Desktop Run Summary\n\n> OmniDesk 自动生成的任务摘要。\n\n".to_string()
        });
        let content = format!("{}{}\n", existing.trim_end(), summary);
        Ok(((), vec![TextMutation::upsert(RUN_SUMMARY_PATH, content)]))
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
    use std::process::Command;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_directory(label: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!(
            "omnidesk-execution-{label}-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ))
    }

    fn initialize_git_directory(label: &str) -> std::path::PathBuf {
        let root = test_directory(label);
        std::fs::create_dir_all(&root).unwrap();
        let output = Command::new("git")
            .args(["init", "-q"])
            .current_dir(&root)
            .output()
            .unwrap();
        assert!(output.status.success());
        root
    }

    fn commit_initial_file(root: &Path, relative: &str, content: &str) {
        let configured = Command::new("git")
            .args(["config", "user.email", "test@example.invalid"])
            .current_dir(root)
            .output()
            .unwrap();
        assert!(configured.status.success());
        let configured = Command::new("git")
            .args(["config", "user.name", "OmniDesk Test"])
            .current_dir(root)
            .output()
            .unwrap();
        assert!(configured.status.success());
        std::fs::write(root.join(relative), content).unwrap();
        let added = Command::new("git")
            .args(["add", relative])
            .current_dir(root)
            .output()
            .unwrap();
        assert!(added.status.success());
        let committed = Command::new("git")
            .args(["commit", "-m", "initial"])
            .current_dir(root)
            .output()
            .unwrap();
        assert!(committed.status.success());
    }

    fn persist_approved_patch_run(root: &Path, run_id: &str, project_id: &str) {
        let mut run = crate::runtime::agent_runs::new_hermes_run(
            run_id.to_string(),
            "request-1".to_string(),
            project_id.to_string(),
            "update action smoke".to_string(),
            4,
            String::new(),
            "now",
        );
        run.status = "awaiting-approval".to_string();
        run.approval_token = "approval-1".to_string();
        run.approval = Some(json!({
            "token": "approval-1",
            "status": "approved",
            "name": "apply_patch",
            "arguments": {
                "diff": "--- a/action-smoke.md\n+++ b/action-smoke.md\n@@ -1 +1 @@\n-before\n+after\n",
                "allowedFiles": ["action-smoke.md"]
            }
        }));
        crate::runtime::agent_runs::persist(root, &run).unwrap();
    }

    #[test]
    fn guarded_checks_are_fixed_to_the_desktop_runtime_contract() {
        let runtime = guarded_check_spec("runtime").expect("runtime check exists");
        assert_eq!(runtime.command, "npm --prefix desktop test");
        assert_eq!(runtime.required_paths, vec!["desktop/package.json"]);
        assert!(guarded_check_spec("arbitrary-shell-command").is_none());
    }

    #[test]
    fn guarded_check_rejects_unknown_commands_without_starting_a_process() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-unknown-guarded-check-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&root).unwrap();
        assert!(run_guarded_check(&root, "arbitrary-shell-command", "now").is_err());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn runner_output_is_bounded_without_changing_short_output() {
        assert_eq!(trim_runner_output("  passed\n"), "passed");
        let output = trim_runner_output(&"x".repeat(6001));
        assert!(output.starts_with(&"x".repeat(6000)));
        assert!(output.ends_with("...output trimmed..."));
    }

    #[test]
    fn patch_apply_rejects_missing_ineligible_and_placeholder_drafts() {
        let root = initialize_git_directory("patch-draft-rejections");
        let missing = json!({ "allowedFiles": ["action-smoke.txt"] });
        assert_eq!(
            apply_patch_draft(&root, &missing, "now").unwrap_err(),
            "patch 草案为空"
        );

        let ineligible = json!({
            "notApplicable": true,
            "allowedFiles": ["action-smoke.txt"]
        });
        assert!(apply_patch_draft(&root, &ineligible, "now")
            .unwrap_err()
            .contains("没有已确认的工程改动"));

        let placeholder = json!({
            "diff": "PATCH_DRAFT_PENDING",
            "allowedFiles": ["action-smoke.txt"]
        });
        assert!(apply_patch_draft(&root, &placeholder, "now")
            .unwrap_err()
            .contains("占位草案"));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn patch_apply_rejects_files_outside_the_draft_authorization() {
        let root = initialize_git_directory("patch-unauthorized-file");
        std::fs::write(root.join("outside.md"), "before\n").unwrap();
        let draft = json!({
            "diff": "--- a/outside.md\n+++ b/outside.md\n@@ -1 +1 @@\n-before\n+blocked\n",
            "allowedFiles": ["inside.md"]
        });
        assert!(apply_patch_draft(&root, &draft, "now")
            .unwrap_err()
            .contains("授权范围之外"));
        assert_eq!(
            std::fs::read_to_string(root.join("outside.md")).unwrap(),
            "before\n"
        );
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn patch_apply_rejects_bad_hunks_and_records_validation_evidence() {
        let root = initialize_git_directory("patch-bad-hunk");
        crate::runtime::state_namespace::ensure_active_state_namespace(&root).unwrap();
        std::fs::write(root.join("README.md"), "current\n").unwrap();
        let draft = json!({
            "diff": "--- a/README.md\n+++ b/README.md\n@@ -1 +1 @@\n-missing\n+replacement\n",
            "allowedFiles": ["README.md"]
        });
        assert!(apply_patch_draft(&root, &draft, "2026-07-22T00:00:00Z")
            .unwrap_err()
            .contains("patch 验证失败"));
        assert_eq!(
            std::fs::read_to_string(root.join("README.md")).unwrap(),
            "current\n"
        );
        let audit = Repository::new(&root).read_json(AUDIT_PATH).unwrap();
        assert_eq!(audit["events"][0]["action"], "patch-apply");
        assert_eq!(audit["events"][0]["success"], false);
        assert_eq!(audit["events"][0]["details"]["stage"], "validate");
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn patch_apply_preserves_newline_and_records_success_evidence() {
        let root = initialize_git_directory("patch-success");
        crate::runtime::state_namespace::ensure_active_state_namespace(&root).unwrap();
        std::fs::write(root.join("action-smoke.md"), "before\n").unwrap();
        let draft = json!({
            "diff": "--- a/action-smoke.md\n+++ b/action-smoke.md\n@@ -1 +1 @@\n-before\n+ok\n",
            "allowedFiles": ["action-smoke.md"]
        });
        assert!(draft_diff(&draft).unwrap().ends_with('\n'));
        let result = apply_patch_draft(&root, &draft, "2026-07-22T00:00:00Z").unwrap();
        assert!(result.success);
        assert_eq!(
            std::fs::read_to_string(root.join("action-smoke.md")).unwrap(),
            "ok\n"
        );
        let audit = Repository::new(&root).read_json(AUDIT_PATH).unwrap();
        assert_eq!(audit["events"][0]["action"], "patch-apply");
        assert_eq!(audit["events"][0]["success"], true);
        assert_eq!(audit["events"][0]["details"]["stage"], "apply");
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn approved_tool_rejects_a_project_switch_before_consuming_approval() {
        let root = initialize_git_directory("approved-tool-project-binding");
        crate::runtime::state_namespace::ensure_active_state_namespace(&root).unwrap();
        std::fs::write(root.join("action-smoke.md"), "before\n").unwrap();
        persist_approved_patch_run(&root, "run-project-binding", "project-a");

        let error = execute_approved_agent_tool(
            &root,
            &root,
            "project-b",
            "controlled",
            "run-project-binding",
            "approval-1",
            "later",
        )
        .unwrap_err();

        assert!(error.contains("授权项目不一致"));
        let run = crate::runtime::agent_runs::load(&root, "run-project-binding").unwrap();
        assert_eq!(run.status, "awaiting-approval");
        assert_eq!(run.approval_token, "approval-1");
        assert_eq!(
            std::fs::read_to_string(root.join("action-smoke.md")).unwrap(),
            "before\n"
        );
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn isolated_workspace_diff_requires_a_fresh_approval_before_source_merge() {
        let root = initialize_git_directory("isolated-merge");
        commit_initial_file(&root, "README.md", "before\n");
        crate::runtime::state_namespace::ensure_active_state_namespace(&root).unwrap();
        let workspace = crate::runtime::isolated_workspace::create(&root, "run-isolated").unwrap();
        let isolated = crate::runtime::isolated_workspace::execution_root(&workspace, &root).unwrap();
        std::fs::write(isolated.join("README.md"), "after\n").unwrap();
        let approved = crate::runtime::isolated_workspace::integration_diff(&workspace, &root).unwrap();
        let arguments = json!({ "diff": approved, "allowedFiles": ["README.md"] });

        let result = integrate_isolated_workspace(
            &root,
            "controlled",
            Some(&workspace),
            &arguments,
            "now",
        )
        .unwrap();
        assert_eq!(result["success"], true);
        assert_eq!(std::fs::read_to_string(root.join("README.md")).unwrap(), "after\n");
        assert!(!Path::new(&workspace.root).exists());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn isolated_workspace_rejects_a_stale_integration_diff() {
        let root = initialize_git_directory("isolated-stale-merge");
        commit_initial_file(&root, "README.md", "before\n");
        crate::runtime::state_namespace::ensure_active_state_namespace(&root).unwrap();
        let workspace = crate::runtime::isolated_workspace::create(&root, "run-isolated-stale").unwrap();
        let isolated = crate::runtime::isolated_workspace::execution_root(&workspace, &root).unwrap();
        std::fs::write(isolated.join("README.md"), "after\n").unwrap();
        let approved = crate::runtime::isolated_workspace::integration_diff(&workspace, &root).unwrap();
        std::fs::write(isolated.join("README.md"), "changed-after-approval\n").unwrap();
        let arguments = json!({ "diff": approved, "allowedFiles": ["README.md"] });

        let error = integrate_isolated_workspace(
            &root,
            "controlled",
            Some(&workspace),
            &arguments,
            "now",
        )
        .unwrap_err();
        assert!(error.contains("审批后发生变化"));
        assert_eq!(std::fs::read_to_string(root.join("README.md")).unwrap(), "before\n");
        crate::runtime::isolated_workspace::remove(&workspace, &root).unwrap();
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn approved_tool_applies_only_to_its_bound_project_and_settles_the_run() {
        let root = initialize_git_directory("approved-tool-success");
        crate::runtime::state_namespace::ensure_active_state_namespace(&root).unwrap();
        std::fs::write(root.join("action-smoke.md"), "before\n").unwrap();
        persist_approved_patch_run(&root, "run-success", "project-a");

        let result = execute_approved_agent_tool(
            &root,
            &root,
            "project-a",
            "controlled",
            "run-success",
            "approval-1",
            "later",
        )
        .unwrap();

        assert_eq!(result["success"], true);
        assert_eq!(
            std::fs::read_to_string(root.join("action-smoke.md")).unwrap(),
            "after\n"
        );
        let run = crate::runtime::agent_runs::load(&root, "run-success").unwrap();
        assert_eq!(run.status, "queued");
        assert_eq!(run.checkpoint.next_action, "resume-model");
        assert!(run.approval.is_none());
        assert!(run.approval_token.is_empty());
        assert_eq!(
            run.checkpoint.tool_result.as_ref().unwrap()["success"],
            true
        );
        std::fs::remove_dir_all(root).unwrap();
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
        let summary = std::fs::read_to_string(root.join(RUN_SUMMARY_PATH)).unwrap();
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
