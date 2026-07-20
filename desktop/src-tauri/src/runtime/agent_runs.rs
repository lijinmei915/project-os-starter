use crate::runtime::repository::{JsonMutation, Repository};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::Path;

const AGENT_RUN_SCHEMA_VERSION: &str = "omnidesk.agent-run.v0.1";
const AGENT_RUN_DIRECTORY: &str = ".project-os/runs/agent-runs";

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct AgentRunCheckpoint {
    pub phase: String,
    pub context_summary: String,
    pub last_confirmation: Option<Value>,
    pub next_action: String,
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

pub fn append_evidence(run: &mut PersistedAgentRun, phase: &str, summary: impl Into<String>, details: Value, timestamp: &str) {
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
    Ok(format!(".project-os/runs/agent-runs/{id}.json"))
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
                next_action: if run.approval.is_some() { "resume-approval".to_string() } else { "resume-stage".to_string() },
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
        run.summary = format!("已从 {} 阶段恢复，等待 {}。", run.checkpoint.phase, if run.status == "awaiting-approval" { "原审批" } else { "重新调度" });
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
        },
        evidence: vec![json!({
            "phase": "result",
            "recordedAt": timestamp,
            "summary": "Agent Run 已创建。",
            "details": { "executor": "hermes-acp" },
        })],
    }
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
    fn resume_keeps_a_pending_approval_checkpoint() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-agent-checkpoint-{}",
            SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()
        ));
        let mut run = new_hermes_run(
            "run-checkpoint".to_string(), "request-1".to_string(), "project-1".to_string(),
            "test".to_string(), 20, String::new(), "now",
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
