use crate::runtime::repository::{JsonMutation, Repository};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::Path;

const AGENT_RUN_SCHEMA_VERSION: &str = "omnidesk.agent-run.v0.1";
const AGENT_RUN_DIRECTORY: &str = ".omnidesk/data/agent-runs";

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct AgentRunCheckpoint {
    pub phase: String,
    pub context_summary: String,
    pub last_confirmation: Option<Value>,
    pub next_action: String,
    #[serde(default)]
    pub tool_name: String,
    #[serde(default)]
    pub tool_arguments: Value,
    #[serde(default)]
    pub tool_result: Option<Value>,
    #[serde(default)]
    pub allowed_files: Vec<String>,
    #[serde(default)]
    pub completed_check_ids: Vec<String>,
    #[serde(default = "default_remaining_repair_budget")]
    pub remaining_repair_budget: usize,
}

fn default_remaining_repair_budget() -> usize {
    2
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PersistedAgentRun {
    pub schema_version: String,
    pub id: String,
    pub request_id: String,
    pub conversation_id: String,
    pub task_id: String,
    pub project_id: String,
    pub executor_id: String,
    pub status: String,
    pub step: usize,
    pub max_steps: usize,
    pub attempt: usize,
    pub revision: usize,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub summary: String,
    #[serde(default)]
    pub prompt: String,
    #[serde(default)]
    pub approval: Option<Value>,
    #[serde(default)]
    pub approval_token: String,
    #[serde(default)]
    pub repair_attempt: usize,
    #[serde(default)]
    pub evidence: Vec<Value>,
    #[serde(default)]
    pub checkpoint: AgentRunCheckpoint,
}

pub struct PrepareModelRunInput {
    pub run_id: String,
    pub request_id: String,
    pub project_id: String,
    pub prompt: String,
    pub max_steps: usize,
    pub approval_token: String,
    pub resume_existing: bool,
}

pub struct PreparedModelRun {
    pub run: PersistedAgentRun,
    pub execution_prompt: String,
}

pub struct ModelRunCompletion {
    pub status: String,
    pub summary: String,
    pub step: Option<usize>,
    pub approval: Option<Value>,
    pub evidence_details: Value,
}

pub fn append_evidence(
    run: &mut PersistedAgentRun,
    phase: &str,
    summary: impl Into<String>,
    details: Value,
    timestamp: &str,
) {
    run.evidence.push(json!({
        "phase": phase,
        "recordedAt": timestamp,
        "summary": summary.into(),
        "details": details,
    }));
    // Evidence is user-facing and bounded, not an unbounded raw log store.
    if run.evidence.len() > 40 {
        run.evidence.drain(0..run.evidence.len() - 40);
    }
}

fn relative_path(id: &str) -> Result<String, String> {
    let id = id.trim();
    if id.is_empty()
        || !id
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_')
    {
        return Err("Agent Run id 非法。".to_string());
    }
    Ok(format!(".omnidesk/data/agent-runs/{id}.json"))
}

pub fn persist(root: &Path, run: &PersistedAgentRun) -> Result<(), String> {
    Repository::new(root).transaction("persist-agent-run", &[mutation(run)?])?;
    Ok(())
}

fn mutation(run: &PersistedAgentRun) -> Result<JsonMutation, String> {
    Ok(JsonMutation::upsert(
        relative_path(&run.id)?,
        serde_json::to_value(run).map_err(|err| err.to_string())?,
    ))
}

pub fn load(root: &Path, id: &str) -> Result<PersistedAgentRun, String> {
    load_from_repository(&Repository::new(root), id)
}

fn load_from_repository(repository: &Repository, id: &str) -> Result<PersistedAgentRun, String> {
    let value = repository
        .read_json(&relative_path(id)?)
        .ok_or_else(|| "没有找到对应的 Agent Run。".to_string())?;
    serde_json::from_value(value).map_err(|_| "Agent Run 记录损坏。".to_string())
}

pub fn list(root: &Path) -> Result<Vec<PersistedAgentRun>, String> {
    list_from_repository(&Repository::new(root))
}

fn list_from_repository(repository: &Repository) -> Result<Vec<PersistedAgentRun>, String> {
    let mut runs = repository
        .list_json_records(AGENT_RUN_DIRECTORY)?
        .into_iter()
        .filter_map(|(_, value)| serde_json::from_value::<PersistedAgentRun>(value).ok())
        .collect::<Vec<_>>();
    runs.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
    runs.truncate(100);
    Ok(runs)
}

pub fn recover_stale(root: &Path, timestamp: &str) -> Result<(), String> {
    Repository::new(root).transaction_with("recover-stale-agent-runs", |repository| {
        let mut mutations = Vec::new();
        for mut run in list_from_repository(repository)? {
            if !matches!(
                run.status.as_str(),
                "queued" | "running" | "awaiting-approval" | "applying" | "verifying"
            ) {
                continue;
            }
            let prior_phase = run.status.clone();
            run.checkpoint = AgentRunCheckpoint {
                phase: prior_phase,
                context_summary: run.summary.clone(),
                last_confirmation: run.approval.clone(),
                next_action: if run.approval.is_some() {
                    "resume-approval".to_string()
                } else {
                    "resume-stage".to_string()
                },
                tool_name: run.checkpoint.tool_name.clone(),
                tool_arguments: run.checkpoint.tool_arguments.clone(),
                tool_result: run.checkpoint.tool_result.clone(),
                allowed_files: run.checkpoint.allowed_files.clone(),
                completed_check_ids: run.checkpoint.completed_check_ids.clone(),
                remaining_repair_budget: run.checkpoint.remaining_repair_budget,
            };
            run.status = "interrupted".to_string();
            run.revision += 1;
            run.updated_at = timestamp.to_string();
            run.summary = "应用退出时 Agent Run 未完成；旧进程结果已失效，可重新恢复。".to_string();
            mutations.push(mutation(&run)?);
        }
        Ok(((), mutations))
    })
}

pub fn resume(root: &Path, id: &str, timestamp: &str) -> Result<PersistedAgentRun, String> {
    Repository::new(root).transaction_with("resume-agent-run", |repository| {
        let mut run = load_from_repository(repository, id)
            .map_err(|_| "没有找到可恢复的 Agent Run。".to_string())?;
        if run.status != "interrupted" {
            return Err(format!("当前状态为 {}，不能恢复。", run.status));
        }
        if run.prompt.trim().is_empty() {
            return Err("该 Agent Run 没有保存执行提示，不能恢复。".to_string());
        }
        run.status = if run.checkpoint.next_action == "resume-approval" && run.approval.is_some() {
            "awaiting-approval".to_string()
        } else {
            "queued".to_string()
        };
        run.attempt += 1;
        run.revision += 1;
        run.updated_at = timestamp.to_string();
        run.summary = format!(
            "已从 {} 阶段恢复，等待 {}。",
            run.checkpoint.phase,
            if run.status == "awaiting-approval" {
                "原审批"
            } else {
                "重新调度"
            }
        );
        Ok((run.clone(), vec![mutation(&run)?]))
    })
}

pub fn approve(root: &Path, id: &str, timestamp: &str) -> Result<PersistedAgentRun, String> {
    Repository::new(root).transaction_with("approve-agent-run", |repository| {
        let mut run = load_from_repository(repository, id)
            .map_err(|_| "没有找到待审批的 Agent Run。".to_string())?;
        if run.status != "awaiting-approval" {
            return Err(format!("当前状态为 {}，不能审批。", run.status));
        }
        let token = run
            .approval
            .as_ref()
            .and_then(|approval| approval.get("token"))
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        if token.is_empty() {
            return Err("该 Agent Run 没有待审批请求。".to_string());
        }
        // The run remains in its approval phase until the controlled tool has
        // actually consumed the approval. The tool executor guards this state.
        run.attempt += 1;
        run.revision += 1;
        run.updated_at = timestamp.to_string();
        run.summary = "已批准，可执行受控工具。".to_string();
        run.approval_token = token;
        if let Some(object) = run.approval.as_mut().and_then(Value::as_object_mut) {
            object.insert("status".to_string(), json!("approved"));
        }
        Ok((run.clone(), vec![mutation(&run)?]))
    })
}

/// Creates or resumes a persisted Agent Run at the model boundary. This
/// consumes neither a write/check approval nor a provider request; callers
/// retain ownership of model transport and cancellation.
pub fn prepare_model_run(
    root: &Path,
    input: PrepareModelRunInput,
    timestamp: &str,
) -> Result<PreparedModelRun, String> {
    if !input.approval_token.trim().is_empty() {
        let existing_run =
            load(root, &input.run_id).map_err(|_| "审批凭证没有对应的 Agent Run。".to_string())?;
        if existing_run.approval_token != input.approval_token {
            return Err("审批凭证不匹配，拒绝继续执行。".to_string());
        }
    }
    let base_run = if input.resume_existing {
        let run = load(root, &input.run_id)?;
        if run.project_id != input.project_id {
            return Err("Agent Run 不属于当前项目，拒绝继续。".to_string());
        }
        if run.status != "queued" {
            return Err(format!("当前状态为 {}，不能继续模型阶段。", run.status));
        }
        run
    } else {
        let run = new_hermes_run(
            input.run_id,
            input.request_id,
            input.project_id,
            input.prompt,
            input.max_steps,
            input.approval_token,
            timestamp,
        );
        persist(root, &run)?;
        run
    };
    let continuation = base_run
        .checkpoint
        .tool_result
        .as_ref()
        .map(|result| {
            format!(
                "\n\nOmniDesk 已执行上一受控工具，结果如下。不要重复这个操作；保留授权文件范围，若仍需写入或检查，先请求新的独立审批。\n{}",
                serde_json::to_string(result).unwrap_or_else(|_| "null".to_string())
            )
        })
        .unwrap_or_default();
    let execution_prompt = format!("{}{}", base_run.prompt, continuation);
    let mut run = base_run;
    run.status = "running".to_string();
    run.revision += 1;
    run.updated_at = timestamp.to_string();
    run.summary = "Hermes 正在读取上下文并形成结果。".to_string();
    run.checkpoint.phase = "running".to_string();
    run.checkpoint.context_summary = run.summary.clone();
    run.checkpoint.last_confirmation = None;
    run.checkpoint.next_action = "resume-model".to_string();
    append_evidence(
        &mut run,
        "draft",
        "Hermes 开始生成受控草稿。",
        json!({ "maxSteps": input.max_steps, "resumed": input.resume_existing }),
        timestamp,
    );
    persist(root, &run)?;
    Ok(PreparedModelRun {
        run,
        execution_prompt,
    })
}

/// Persists the terminal or approval boundary reached by a model transport.
/// Transport-specific result parsing stays outside this domain; the durable
/// state, checkpoint and user-facing evidence do not.
pub fn settle_model_run(
    root: &Path,
    mut run: PersistedAgentRun,
    completion: ModelRunCompletion,
    timestamp: &str,
) -> Result<PersistedAgentRun, String> {
    run.status = completion.status;
    if let Some(step) = completion.step {
        run.step = step;
    }
    run.revision += 1;
    run.updated_at = timestamp.to_string();
    run.summary = completion.summary;
    run.approval = completion.approval;
    run.checkpoint.phase = run.status.clone();
    run.checkpoint.context_summary = run.summary.clone();
    run.checkpoint.last_confirmation = run.approval.clone();
    run.checkpoint.next_action = if run.status == "awaiting-approval" {
        "resume-approval".to_string()
    } else if matches!(run.status.as_str(), "failed" | "cancelled" | "succeeded") {
        "none".to_string()
    } else {
        "resume-stage".to_string()
    };
    let evidence_phase = if run.status == "awaiting-approval" {
        "approval"
    } else {
        "result"
    };
    let summary = run.summary.clone();
    append_evidence(
        &mut run,
        evidence_phase,
        summary,
        completion.evidence_details,
        timestamp,
    );
    persist(root, &run)?;
    Ok(run)
}

/// Consumes an already-approved tool request and records the durable execution
/// checkpoint. The Tauri adapter remains responsible for the actual write or
/// check, but it must not duplicate this state-machine transition.
pub fn begin_approved_tool(
    run: &mut PersistedAgentRun,
    token: &str,
    timestamp: &str,
) -> Result<(String, Value), String> {
    if run.status != "awaiting-approval" {
        return Err(format!("当前状态为 {}，不能执行审批工具。", run.status));
    }
    let approval = run
        .approval
        .clone()
        .ok_or_else(|| "没有待审批工具请求。".to_string())?;
    if approval.get("status").and_then(Value::as_str) != Some("approved") {
        return Err("审批请求尚未批准。".to_string());
    }
    let expected = approval.get("token").and_then(Value::as_str).unwrap_or("");
    if expected.is_empty() || expected != token {
        return Err("审批 token 不匹配，拒绝执行。".to_string());
    }
    let name = approval
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let arguments = approval
        .get("arguments")
        .cloned()
        .unwrap_or_else(|| json!({}));
    run.status = if name == "apply_patch" {
        "applying"
    } else {
        "verifying"
    }
    .to_string();
    run.revision += 1;
    run.updated_at = timestamp.to_string();
    run.summary = format!("正在执行已批准工具：{name}");
    run.checkpoint.phase = run.status.clone();
    run.checkpoint.context_summary = run.summary.clone();
    run.checkpoint.last_confirmation = Some(approval);
    run.checkpoint.next_action = if name == "apply_patch" {
        "resume-apply-approval".to_string()
    } else {
        "resume-check-approval".to_string()
    };
    run.checkpoint.tool_name = name.clone();
    run.checkpoint.tool_arguments = arguments.clone();
    run.checkpoint.tool_result = None;
    run.checkpoint.allowed_files = arguments
        .get("allowedFiles")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(ToString::to_string)
                .collect()
        })
        .unwrap_or_default();
    let phase = run.status.clone();
    append_evidence(
        run,
        &phase,
        format!("开始执行已批准工具：{name}"),
        json!({ "arguments": arguments }),
        timestamp,
    );
    Ok((name, arguments))
}

pub fn settle_approved_tool(
    run: &mut PersistedAgentRun,
    name: &str,
    arguments: &Value,
    result: Value,
    timestamp: &str,
) {
    let check_failed =
        name == "run_check" && result.get("success").and_then(Value::as_bool) == Some(false);
    if name == "run_check" {
        if let Some(check_id) = arguments.get("checkId").and_then(Value::as_str) {
            if !run
                .checkpoint
                .completed_check_ids
                .iter()
                .any(|id| id == check_id)
            {
                run.checkpoint
                    .completed_check_ids
                    .push(check_id.to_string());
            }
        }
    }
    if check_failed && run.checkpoint.remaining_repair_budget == 0 {
        run.status = "failed".to_string();
        run.checkpoint.next_action = "none".to_string();
        run.summary = "检查仍未通过，已达到两轮修复上限。".to_string();
    } else {
        if check_failed {
            run.checkpoint.remaining_repair_budget -= 1;
            run.repair_attempt += 1;
            run.checkpoint.next_action = "resume-repair-draft".to_string();
            run.summary = format!(
                "检查未通过，剩余 {} 轮受控修复。",
                run.checkpoint.remaining_repair_budget
            );
        } else {
            run.checkpoint.next_action = "resume-model".to_string();
            run.summary = format!("已执行审批工具：{name}；等待模型根据结果继续。");
        }
        run.status = "queued".to_string();
    }
    run.step += 1;
    run.revision += 1;
    run.updated_at = timestamp.to_string();
    run.checkpoint.phase = run.status.clone();
    run.checkpoint.context_summary = run.summary.clone();
    run.checkpoint.tool_result = Some(result.clone());
    run.approval = None;
    run.approval_token.clear();
    let summary = run.summary.clone();
    append_evidence(
        run,
        if check_failed { "check" } else { "tool-result" },
        summary,
        json!({ "name": name, "result": result }),
        timestamp,
    );
}

pub fn fail_approved_tool(run: &mut PersistedAgentRun, name: &str, error: &str, timestamp: &str) {
    run.status = "failed".to_string();
    run.revision += 1;
    run.updated_at = timestamp.to_string();
    run.summary = format!("已批准工具执行失败：{error}");
    run.checkpoint.phase = "failed".to_string();
    run.checkpoint.context_summary = run.summary.clone();
    run.checkpoint.next_action = "none".to_string();
    run.checkpoint.tool_result = Some(json!({ "error": error }));
    let summary = run.summary.clone();
    append_evidence(
        run,
        "tool-failed",
        summary,
        json!({ "name": name, "error": error }),
        timestamp,
    );
}

pub fn new_hermes_run(
    id: String,
    request_id: String,
    project_id: String,
    prompt: String,
    max_steps: usize,
    approval_token: String,
    timestamp: &str,
) -> PersistedAgentRun {
    PersistedAgentRun {
        schema_version: AGENT_RUN_SCHEMA_VERSION.to_string(),
        id,
        request_id,
        conversation_id: String::new(),
        task_id: String::new(),
        project_id,
        executor_id: "hermes-acp".to_string(),
        status: "queued".to_string(),
        step: 0,
        max_steps: max_steps.max(1),
        attempt: 0,
        revision: 0,
        created_at: timestamp.to_string(),
        updated_at: timestamp.to_string(),
        summary: "等待 Hermes 执行。".to_string(),
        prompt,
        approval: None,
        approval_token,
        repair_attempt: 0,
        checkpoint: AgentRunCheckpoint {
            phase: "queued".to_string(),
            context_summary: "Agent Run 已创建。".to_string(),
            last_confirmation: None,
            next_action: "start".to_string(),
            tool_name: String::new(),
            tool_arguments: json!({}),
            tool_result: None,
            allowed_files: Vec::new(),
            completed_check_ids: Vec::new(),
            remaining_repair_budget: default_remaining_repair_budget(),
        },
        evidence: vec![json!({
            "phase": "result",
            "recordedAt": timestamp,
            "summary": "Agent Run 已创建。",
            "details": { "executor": "hermes-acp" },
        })],
    }
}

/// Creates the native WebDriver recovery fixture through the same persisted
/// Agent Run contract used by production recovery. It intentionally stops at
/// pending approval: no patch, check, or project write is executed here.
#[cfg(feature = "webdriver")]
pub fn seed_native_recovery_run(
    root: &Path,
    project_id: String,
    timestamp: &str,
) -> Result<PersistedAgentRun, String> {
    let mut run = new_hermes_run(
        "native-recovery-run".to_string(),
        "native-recovery-request".to_string(),
        project_id,
        "Native WebDriver multi-file recovery fixture. Do not execute tools.".to_string(),
        1,
        String::new(),
        timestamp,
    );
    let allowed_files = vec![
        "README.md".to_string(),
        "AGENTS.md".to_string(),
        "PROJECT.md".to_string(),
        "docs/TESTING.md".to_string(),
    ];
    let approval = json!({
        "token": "native-recovery-approval",
        "status": "pending",
        "name": "apply_patch",
        "arguments": {
            "allowedFiles": allowed_files,
            "diff": "diff --git a/README.md b/README.md\n--- a/README.md\n+++ b/README.md\n@@ -1 +1 @@\n-# Native WebDriver fixture\n+# Native WebDriver fixture\ndiff --git a/AGENTS.md b/AGENTS.md\n--- a/AGENTS.md\n+++ b/AGENTS.md\n@@ -1 +1 @@\n-# Native WebDriver fixture\n+# Native WebDriver fixture\n"
        }
    });
    run.status = "awaiting-approval".to_string();
    run.summary = "原生多文件恢复夹具正在等待 Patch 审批。".to_string();
    run.approval = Some(approval.clone());
    run.checkpoint.phase = "awaiting-approval".to_string();
    run.checkpoint.context_summary = run.summary.clone();
    run.checkpoint.last_confirmation = Some(approval);
    run.checkpoint.next_action = "resume-approval".to_string();
    run.checkpoint.tool_name = "apply_patch".to_string();
    run.checkpoint.allowed_files = allowed_files;
    let authorized_files = run.checkpoint.allowed_files.clone();
    append_evidence(
        &mut run,
        "approval",
        "Native WebDriver multi-file recovery fixture created.",
        json!({ "fixture": true, "authorizedFiles": authorized_files }),
        timestamp,
    );
    persist(root, &run)?;
    Ok(run)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn recovery_transitions_only_non_terminal_runs() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-agent-runs-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let mut running = new_hermes_run(
            "run-running".to_string(),
            "request-1".to_string(),
            "project-1".to_string(),
            "test".to_string(),
            20,
            String::new(),
            "now",
        );
        running.status = "running".to_string();
        let mut done = running.clone();
        done.id = "run-done".to_string();
        done.status = "succeeded".to_string();
        persist(&root, &running).unwrap();
        persist(&root, &done).unwrap();
        recover_stale(&root, "later").unwrap();
        assert_eq!(load(&root, "run-running").unwrap().status, "interrupted");
        let recovered = load(&root, "run-running").unwrap();
        assert_eq!(recovered.checkpoint.phase, "running");
        assert_eq!(recovered.checkpoint.next_action, "resume-stage");
        assert_eq!(load(&root, "run-done").unwrap().status, "succeeded");
    }

    #[test]
    fn approval_is_a_persisted_state_transition() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-agent-approval-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let mut run = new_hermes_run(
            "run-1".to_string(),
            String::new(),
            "project-1".to_string(),
            "test".to_string(),
            20,
            String::new(),
            "now",
        );
        run.status = "awaiting-approval".to_string();
        run.approval = Some(json!({"token":"token-1","name":"run_check"}));
        persist(&root, &run).unwrap();
        let approved = approve(&root, "run-1", "later").unwrap();
        assert_eq!(approved.status, "awaiting-approval");
        assert_eq!(approved.approval_token, "token-1");
        assert_eq!(approved.approval.unwrap()["status"], "approved");
    }

    #[test]
    fn model_stage_preparation_persists_running_state_and_continues_tool_evidence() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-agent-model-stage-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let prepared = prepare_model_run(
            &root,
            PrepareModelRunInput {
                run_id: "run-model-stage".to_string(),
                request_id: "request-1".to_string(),
                project_id: "project-1".to_string(),
                prompt: "update the project".to_string(),
                max_steps: 4,
                approval_token: String::new(),
                resume_existing: false,
            },
            "now",
        )
        .unwrap();
        assert_eq!(prepared.run.status, "running");
        assert_eq!(prepared.run.checkpoint.next_action, "resume-model");
        assert_eq!(prepared.run.evidence.last().unwrap()["phase"], "draft");
        assert_eq!(load(&root, "run-model-stage").unwrap().status, "running");

        let mut persisted = load(&root, "run-model-stage").unwrap();
        persisted.status = "queued".to_string();
        persisted.checkpoint.tool_result = Some(json!({ "success": true, "output": "applied" }));
        persist(&root, &persisted).unwrap();
        let resumed = prepare_model_run(
            &root,
            PrepareModelRunInput {
                run_id: "run-model-stage".to_string(),
                request_id: String::new(),
                project_id: "project-1".to_string(),
                prompt: String::new(),
                max_steps: 4,
                approval_token: String::new(),
                resume_existing: true,
            },
            "later",
        )
        .unwrap();
        assert!(resumed.execution_prompt.contains("不要重复这个操作"));
        assert!(resumed.execution_prompt.contains("applied"));
        assert_eq!(resumed.run.status, "running");
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn model_stage_preparation_rejects_a_different_project_without_mutating_the_run() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-agent-model-project-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let mut run = new_hermes_run(
            "run-model-project".to_string(),
            "request-1".to_string(),
            "project-a".to_string(),
            "update".to_string(),
            4,
            String::new(),
            "now",
        );
        run.status = "queued".to_string();
        persist(&root, &run).unwrap();
        let error = prepare_model_run(
            &root,
            PrepareModelRunInput {
                run_id: run.id.clone(),
                request_id: String::new(),
                project_id: "project-b".to_string(),
                prompt: String::new(),
                max_steps: 4,
                approval_token: String::new(),
                resume_existing: true,
            },
            "later",
        )
        .err()
        .unwrap();
        assert!(error.contains("不属于当前项目"));
        assert_eq!(load(&root, &run.id).unwrap().status, "queued");
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn model_completion_persists_approval_checkpoint_and_evidence() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-agent-model-completion-approval-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let run = new_hermes_run(
            "run-model-completion-approval".to_string(),
            "request-1".to_string(),
            "project-1".to_string(),
            "update".to_string(),
            4,
            String::new(),
            "now",
        );
        let settled = settle_model_run(
            &root,
            run,
            ModelRunCompletion {
                status: "awaiting-approval".to_string(),
                summary: "等待独立 Patch 审批。".to_string(),
                step: Some(2),
                approval: Some(json!({ "token": "approval-1", "name": "apply_patch" })),
                evidence_details: json!({ "trace": ["draft-ready"] }),
            },
            "later",
        )
        .unwrap();

        assert_eq!(settled.status, "awaiting-approval");
        assert_eq!(settled.step, 2);
        assert_eq!(settled.checkpoint.next_action, "resume-approval");
        assert_eq!(
            settled.checkpoint.last_confirmation.as_ref().unwrap()["token"],
            "approval-1"
        );
        assert_eq!(settled.evidence.last().unwrap()["phase"], "approval");
        assert_eq!(
            load(&root, &settled.id).unwrap().summary,
            "等待独立 Patch 审批。"
        );
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn model_completion_marks_terminal_results_non_resumable() {
        for status in ["succeeded", "failed", "cancelled"] {
            let root = std::env::temp_dir().join(format!(
                "omnidesk-agent-model-completion-{status}-{}",
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
            let run = new_hermes_run(
                format!("run-model-completion-{status}"),
                "request-1".to_string(),
                "project-1".to_string(),
                "update".to_string(),
                4,
                String::new(),
                "now",
            );
            let settled = settle_model_run(
                &root,
                run,
                ModelRunCompletion {
                    status: status.to_string(),
                    summary: format!("{status} result"),
                    step: Some(3),
                    approval: None,
                    evidence_details: json!({ "status": status }),
                },
                "later",
            )
            .unwrap();

            assert_eq!(settled.status, status);
            assert_eq!(settled.step, 3);
            assert_eq!(settled.checkpoint.next_action, "none");
            assert!(settled.approval.is_none());
            assert_eq!(settled.evidence.last().unwrap()["phase"], "result");
            std::fs::remove_dir_all(root).unwrap();
        }
    }

    #[test]
    fn beginning_an_approved_tool_records_the_checkpoint_and_authorized_files() {
        let mut run = new_hermes_run(
            "run-begin-tool".to_string(),
            "request-1".to_string(),
            "project-1".to_string(),
            "test".to_string(),
            20,
            String::new(),
            "now",
        );
        run.status = "awaiting-approval".to_string();
        run.approval = Some(json!({
            "token": "approval-token",
            "status": "approved",
            "name": "apply_patch",
            "arguments": { "allowedFiles": ["src/lib.rs"] }
        }));

        let (name, arguments) = begin_approved_tool(&mut run, "approval-token", "later").unwrap();

        assert_eq!(name, "apply_patch");
        assert_eq!(arguments["allowedFiles"][0], "src/lib.rs");
        assert_eq!(run.status, "applying");
        assert_eq!(run.checkpoint.next_action, "resume-apply-approval");
        assert_eq!(run.checkpoint.allowed_files, vec!["src/lib.rs"]);
        assert_eq!(run.evidence.last().unwrap()["phase"], "applying");
        assert!(begin_approved_tool(&mut run, "approval-token", "later").is_err());
    }

    #[test]
    fn failed_check_consumes_one_repair_round_and_keeps_the_run_recoverable() {
        let mut run = new_hermes_run(
            "run-check-repair".to_string(),
            "request-1".to_string(),
            "project-1".to_string(),
            "test".to_string(),
            20,
            String::new(),
            "now",
        );
        settle_approved_tool(
            &mut run,
            "run_check",
            &json!({ "checkId": "desktop-node" }),
            json!({ "success": false, "output": "test failure" }),
            "later",
        );

        assert_eq!(run.status, "queued");
        assert_eq!(run.checkpoint.next_action, "resume-repair-draft");
        assert_eq!(run.checkpoint.remaining_repair_budget, 1);
        assert_eq!(run.repair_attempt, 1);
        assert_eq!(run.checkpoint.completed_check_ids, vec!["desktop-node"]);
        assert_eq!(run.evidence.last().unwrap()["phase"], "check");
    }

    #[test]
    fn failed_approved_tool_records_a_terminal_failure() {
        let mut run = new_hermes_run(
            "run-tool-failed".to_string(),
            "request-1".to_string(),
            "project-1".to_string(),
            "test".to_string(),
            20,
            String::new(),
            "now",
        );
        fail_approved_tool(&mut run, "apply_patch", "bad hunk", "later");
        assert_eq!(run.status, "failed");
        assert_eq!(run.checkpoint.next_action, "none");
        assert_eq!(
            run.checkpoint.tool_result.as_ref().unwrap()["error"],
            "bad hunk"
        );
        assert_eq!(run.evidence.last().unwrap()["phase"], "tool-failed");
    }

    #[test]
    fn resume_keeps_a_pending_approval_checkpoint() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-agent-checkpoint-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let mut run = new_hermes_run(
            "run-checkpoint".to_string(),
            "request-1".to_string(),
            "project-1".to_string(),
            "test".to_string(),
            20,
            String::new(),
            "now",
        );
        run.status = "awaiting-approval".to_string();
        run.summary = "等待写入审批。".to_string();
        run.approval = Some(json!({ "token": "approval-1", "status": "pending" }));
        persist(&root, &run).unwrap();
        recover_stale(&root, "later").unwrap();
        let resumed = resume(&root, "run-checkpoint", "resume").unwrap();
        assert_eq!(resumed.status, "awaiting-approval");
        assert_eq!(resumed.checkpoint.phase, "awaiting-approval");
        assert_eq!(resumed.approval.as_ref().unwrap()["token"], "approval-1");
    }

    #[test]
    fn interrupted_apply_requires_the_original_approval_instead_of_reapplying() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-agent-apply-checkpoint-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let mut run = new_hermes_run(
            "run-applying".to_string(),
            "request-1".to_string(),
            "project-1".to_string(),
            "update file".to_string(),
            20,
            String::new(),
            "now",
        );
        run.status = "applying".to_string();
        run.approval = Some(json!({
            "token": "approval-apply-1",
            "name": "apply_patch",
            "arguments": { "allowedFiles": ["src/lib.rs"] },
            "status": "approved"
        }));
        run.checkpoint.tool_name = "apply_patch".to_string();
        run.checkpoint.allowed_files = vec!["src/lib.rs".to_string()];
        run.checkpoint.remaining_repair_budget = 1;
        persist(&root, &run).unwrap();

        recover_stale(&root, "later").unwrap();
        let resumed = resume(&root, "run-applying", "resume").unwrap();

        assert_eq!(resumed.status, "awaiting-approval");
        assert_eq!(resumed.checkpoint.phase, "applying");
        assert_eq!(resumed.checkpoint.tool_name, "apply_patch");
        assert_eq!(resumed.checkpoint.allowed_files, vec!["src/lib.rs"]);
        assert_eq!(resumed.checkpoint.remaining_repair_budget, 1);
        assert_eq!(resumed.approval.unwrap()["token"], "approval-apply-1");
    }

    #[test]
    fn read_paths_use_the_same_id_boundary_as_persistence() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-agent-path-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        assert!(load(&root, "../outside").is_err());
        assert!(load(&root, "nested/run").is_err());
    }
}
