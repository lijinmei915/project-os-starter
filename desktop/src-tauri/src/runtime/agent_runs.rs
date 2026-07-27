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
    pub interaction: Option<Value>,
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
    pub isolation: Option<crate::runtime::isolated_workspace::IsolatedWorkspace>,
    #[serde(default)]
    pub evidence: Vec<Value>,
    #[serde(default)]
    pub interactions: Vec<Value>,
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
    pub conversation_id: String,
    pub task_id: String,
    pub resume_existing: bool,
    pub isolation: Option<crate::runtime::isolated_workspace::IsolatedWorkspace>,
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
    pub interaction: Option<Value>,
    pub evidence_details: Value,
}

#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentRunMetrics {
    pub event_count: usize,
    pub model_event_count: usize,
    pub duration_ms: u64,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub total_tokens: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cost_usd: Option<f64>,
}

const INTERACTION_SCHEMA_VERSION: &str = "omnidesk.interaction.v0.1";
const RUN_EVENT_SCHEMA_VERSION: &str = "omnidesk.run-event.v0.1";

pub fn validate_ask_user_interaction(arguments: &Value, step: usize) -> Result<Value, String> {
    let object = arguments
        .as_object()
        .ok_or_else(|| "ask_user 参数必须是对象。".to_string())?;
    let bounded_text = |key: &str, minimum: usize, maximum: usize| -> Result<String, String> {
        let value = object.get(key).and_then(Value::as_str).unwrap_or("").trim();
        if value.chars().count() < minimum || value.chars().count() > maximum {
            return Err(format!("ask_user 的 {key} 长度不合法。"));
        }
        Ok(value.to_string())
    };
    let title = bounded_text("title", 1, 80)?;
    let description = bounded_text("description", 0, 240)?;
    let fields = object
        .get("fields")
        .and_then(Value::as_array)
        .ok_or_else(|| "ask_user 缺少 fields。".to_string())?;
    if fields.is_empty() || fields.len() > 6 {
        return Err("ask_user 的 fields 数量必须在 1 到 6 之间。".to_string());
    }
    let mut ids = std::collections::HashSet::new();
    let mut normalized_fields = Vec::new();
    for field in fields {
        let field = field
            .as_object()
            .ok_or_else(|| "ask_user field 必须是对象。".to_string())?;
        let id = field.get("id").and_then(Value::as_str).unwrap_or("").trim();
        if id.is_empty()
            || id.len() > 48
            || !id
                .chars()
                .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
            || !ids.insert(id.to_string())
        {
            return Err("ask_user field id 必须唯一且仅含字母、数字、- 或 _。".to_string());
        }
        let kind = field.get("type").and_then(Value::as_str).unwrap_or("");
        if !matches!(kind, "single-choice" | "multi-choice" | "text" | "confirm") {
            return Err("ask_user field type 不受支持。".to_string());
        }
        let label = field
            .get("label")
            .and_then(Value::as_str)
            .unwrap_or("")
            .trim();
        if label.is_empty() || label.chars().count() > 100 {
            return Err("ask_user field label 长度不合法。".to_string());
        }
        let required = field
            .get("required")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        let mut normalized =
            json!({ "id": id, "type": kind, "label": label, "required": required });
        if matches!(kind, "single-choice" | "multi-choice") {
            let options = field
                .get("options")
                .and_then(Value::as_array)
                .ok_or_else(|| "选择题缺少 options。".to_string())?;
            if options.is_empty() || options.len() > 12 {
                return Err("选择题选项数量必须在 1 到 12 之间。".to_string());
            }
            let mut values = std::collections::HashSet::new();
            let mut normalized_options = Vec::new();
            for option in options {
                let value = option
                    .get("value")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .trim();
                let label = option
                    .get("label")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .trim();
                if value.is_empty()
                    || value.len() > 80
                    || label.is_empty()
                    || label.chars().count() > 100
                    || !values.insert(value.to_string())
                {
                    return Err("ask_user 选项不合法或重复。".to_string());
                }
                normalized_options.push(json!({ "value": value, "label": label }));
            }
            normalized["options"] = Value::Array(normalized_options);
        }
        normalized_fields.push(normalized);
    }
    Ok(json!({
        "id": format!("ask-user-{step}"),
        "kind": "ask_user",
        "schemaVersion": INTERACTION_SCHEMA_VERSION,
        "title": title,
        "description": description,
        "fields": normalized_fields,
        "actions": [{ "id": "submit", "label": "提交" }, { "id": "skip", "label": "跳过" }],
        "status": "pending",
    }))
}

pub fn append_evidence(
    run: &mut PersistedAgentRun,
    phase: &str,
    summary: impl Into<String>,
    details: Value,
    timestamp: &str,
) {
    let sequence = run
        .evidence
        .last()
        .and_then(|event| event.get("sequence"))
        .and_then(Value::as_u64)
        .unwrap_or(run.evidence.len() as u64)
        + 1;
    let kind = match phase {
        "scheduling" => "scheduling",
        "draft" => "model",
        "approval" => "approval",
        "interaction" => "user-interaction",
        "applying" => "patch",
        "running-tool" => "tool",
        "check" => "check",
        "tool-result" | "tool-failed" => "tool",
        "recovery" => "recovery",
        "cancelled" => "cancellation",
        _ => "result",
    };
    let actor = match kind {
        "model" | "approval" | "user-interaction" => "assistant",
        "cancellation" => "user",
        _ => "runtime",
    };
    run.evidence.push(json!({
        "schemaVersion": RUN_EVENT_SCHEMA_VERSION,
        "id": format!("{}:event:{}", run.id, sequence),
        "sequence": sequence,
        "kind": kind,
        "phase": phase,
        "status": run.status,
        "actor": actor,
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

pub fn persist_new_queued(root: &Path, run: &PersistedAgentRun) -> Result<(), String> {
    if run.status != "queued" {
        return Err("只有完整的 queued Agent Run 可以首次入队。".to_string());
    }
    Repository::new(root).transaction_with("create-queued-agent-run", |repository| {
        let path = relative_path(&run.id)?;
        if repository.read_json(&path).is_some() {
            return Err("Agent Run 已存在，拒绝覆盖原有执行证据。".to_string());
        }
        Ok(((), vec![mutation(run)?]))
    })
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
                "running" | "running-tool" | "awaiting-approval" | "applying" | "verifying"
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
                interaction: run.checkpoint.interaction.clone(),
                allowed_files: run.checkpoint.allowed_files.clone(),
                completed_check_ids: run.checkpoint.completed_check_ids.clone(),
                remaining_repair_budget: run.checkpoint.remaining_repair_budget,
            };
            run.status = "interrupted".to_string();
            run.revision += 1;
            run.updated_at = timestamp.to_string();
            run.summary = "应用退出时 Agent Run 未完成；旧进程结果已失效，可重新恢复。".to_string();
            let summary = run.summary.clone();
            let prior_phase = run.checkpoint.phase.clone();
            append_evidence(
                &mut run,
                "recovery",
                summary,
                json!({ "priorPhase": prior_phase, "action": "interrupted-on-startup" }),
                timestamp,
            );
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
        let summary = run.summary.clone();
        let from = run.checkpoint.phase.clone();
        let to = run.status.clone();
        append_evidence(
            &mut run,
            "recovery",
            summary,
            json!({ "from": from, "to": to }),
            timestamp,
        );
        Ok((run.clone(), vec![mutation(&run)?]))
    })
}

pub fn record_queue_wait(
    root: &Path,
    id: &str,
    position: usize,
    timestamp: &str,
) -> Result<PersistedAgentRun, String> {
    Repository::new(root).transaction_with("record-agent-queue-wait", |repository| {
        let mut run = load_from_repository(repository, id)?;
        if run.status != "queued" {
            return Err(format!("当前状态为 {}，不能记录排队等待。", run.status));
        }
        run.revision += 1;
        run.updated_at = timestamp.to_string();
        run.summary = format!("任务已排队（第 {position} 位）。");
        let summary = run.summary.clone();
        append_evidence(
            &mut run,
            "scheduling",
            summary,
            json!({ "position": position, "reason": "capacity-or-project-lock" }),
            timestamp,
        );
        Ok((run.clone(), vec![mutation(&run)?]))
    })
}

pub fn timeline_metrics(run: &PersistedAgentRun) -> AgentRunMetrics {
    let mut metrics = AgentRunMetrics {
        event_count: run.evidence.len(),
        ..AgentRunMetrics::default()
    };
    let mut usage_event_count = 0_usize;
    let mut cost_event_count = 0_usize;
    let mut reported_cost = 0.0_f64;
    for event in &run.evidence {
        if event.get("kind").and_then(Value::as_str) == Some("model") {
            metrics.model_event_count += 1;
        }
        let details = event.get("details").unwrap_or(&Value::Null);
        metrics.duration_ms = metrics.duration_ms.saturating_add(
            details
                .get("durationMs")
                .and_then(Value::as_u64)
                .unwrap_or(0),
        );
        let usage = details.get("usage").unwrap_or(&Value::Null);
        if usage.is_object() {
            usage_event_count += 1;
        }
        metrics.input_tokens = metrics.input_tokens.saturating_add(
            usage
                .get("inputTokens")
                .and_then(Value::as_u64)
                .unwrap_or(0),
        );
        metrics.output_tokens = metrics.output_tokens.saturating_add(
            usage
                .get("outputTokens")
                .and_then(Value::as_u64)
                .unwrap_or(0),
        );
        metrics.total_tokens = metrics.total_tokens.saturating_add(
            usage
                .get("totalTokens")
                .and_then(Value::as_u64)
                .unwrap_or(0),
        );
        if let Some(cost) = usage.get("costUsd").and_then(Value::as_f64) {
            cost_event_count += 1;
            reported_cost += cost;
        }
    }
    metrics.cost_usd = (usage_event_count > 0
        && usage_event_count == metrics.model_event_count
        && cost_event_count == usage_event_count)
        .then_some(reported_cost);
    metrics
}

pub fn export_timeline(root: &Path, id: &str, timestamp: &str) -> Result<Value, String> {
    let run = load(root, id)?;
    let path = format!(".omnidesk/evidence/agent-runs/{}.json", run.id);
    let events = run
        .evidence
        .iter()
        .map(redacted_timeline_event)
        .collect::<Vec<_>>();
    let export = json!({
        "schemaVersion": "omnidesk.run-timeline-export.v0.1",
        "runId": run.id,
        "requestId": run.request_id,
        "conversationId": run.conversation_id,
        "taskId": run.task_id,
        "projectId": run.project_id,
        "executorId": run.executor_id,
        "status": run.status,
        "createdAt": run.created_at,
        "updatedAt": run.updated_at,
        "exportedAt": timestamp,
        "metrics": timeline_metrics(&run),
        "events": events,
        "redaction": {
            "excluded": ["prompt", "content", "diff", "output", "observations", "credentials"],
            "policy": "metadata-only"
        }
    });
    Repository::new(root).transaction(
        "export-agent-run-timeline",
        &[JsonMutation::upsert(path.clone(), export.clone())],
    )?;
    Ok(json!({ "path": path, "timeline": export }))
}

fn redacted_timeline_event(event: &Value) -> Value {
    let details = event.get("details").unwrap_or(&Value::Null);
    let mut safe_details = serde_json::Map::new();
    for key in [
        "durationMs",
        "usage",
        "step",
        "position",
        "reason",
        "priorPhase",
        "action",
        "from",
        "to",
    ] {
        if let Some(value) = details.get(key) {
            safe_details.insert(key.to_string(), value.clone());
        }
    }
    if let Some(events) = details.get("agentEvents").and_then(Value::as_array) {
        let safe_events = events
            .iter()
            .take(100)
            .map(|event| {
                let mut safe = serde_json::Map::new();
                for key in [
                    "schemaVersion",
                    "sequence",
                    "kind",
                    "phase",
                    "status",
                    "summary",
                ] {
                    if let Some(value) = event.get(key) {
                        safe.insert(key.to_string(), value.clone());
                    }
                }
                let mut event_details = serde_json::Map::new();
                for key in ["name", "step", "success", "mode"] {
                    if let Some(value) = event.pointer(&format!("/details/{key}")) {
                        event_details.insert(key.to_string(), value.clone());
                    }
                }
                safe.insert("details".to_string(), Value::Object(event_details));
                Value::Object(safe)
            })
            .collect();
        safe_details.insert("agentEvents".to_string(), Value::Array(safe_events));
    }
    if let Some(trace) = details.get("trace").and_then(Value::as_array) {
        safe_details.insert(
            "trace".to_string(),
            Value::Array(
                trace
                    .iter()
                    .filter_map(Value::as_str)
                    .take(40)
                    .map(|line| Value::String(line.chars().take(240).collect()))
                    .collect(),
            ),
        );
    }
    if let Some(name) = details.get("name").and_then(Value::as_str) {
        safe_details.insert("name".to_string(), json!(name));
    }
    if let Some(success) = details
        .get("success")
        .and_then(Value::as_bool)
        .or_else(|| details.pointer("/result/success").and_then(Value::as_bool))
    {
        safe_details.insert("success".to_string(), json!(success));
    }
    if let Some(error) = details.get("error").and_then(Value::as_str) {
        safe_details.insert(
            "error".to_string(),
            Value::String(error.chars().take(500).collect()),
        );
    }
    let mut output = event.clone();
    output["details"] = Value::Object(safe_details);
    output
}

pub fn cancel(root: &Path, id: &str, timestamp: &str) -> Result<PersistedAgentRun, String> {
    Repository::new(root).transaction_with("cancel-agent-run", |repository| {
        let mut run = load_from_repository(repository, id)
            .map_err(|_| "没有找到可取消的 Agent Run。".to_string())?;
        if run.status == "cancelled" {
            return Ok((run, Vec::new()));
        }
        if !matches!(
            run.status.as_str(),
            "queued"
                | "running"
                | "running-tool"
                | "awaiting-approval"
                | "awaiting-user-input"
                | "interrupted"
        ) {
            return Err(format!("当前状态为 {}，不能取消。", run.status));
        }
        run.status = "cancelled".to_string();
        run.revision += 1;
        run.updated_at = timestamp.to_string();
        run.summary = "用户已取消 Agent Run；不会自动恢复或重放工程操作。".to_string();
        run.approval_token.clear();
        if let Some(approval) = run.approval.as_mut().and_then(Value::as_object_mut) {
            approval.insert("status".to_string(), json!("cancelled"));
        }
        if let Some(interaction) = run
            .checkpoint
            .interaction
            .as_mut()
            .and_then(Value::as_object_mut)
        {
            interaction.insert("status".to_string(), json!("cancelled"));
        }
        run.checkpoint.phase = "cancelled".to_string();
        run.checkpoint.context_summary = run.summary.clone();
        run.checkpoint.next_action = "none".to_string();
        let summary = run.summary.clone();
        append_evidence(
            &mut run,
            "cancelled",
            summary,
            json!({ "reason": "user-requested" }),
            timestamp,
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

pub fn submit_interaction(
    root: &Path,
    id: &str,
    form_id: &str,
    action: &str,
    answers: Value,
    timestamp: &str,
) -> Result<PersistedAgentRun, String> {
    Repository::new(root).transaction_with("submit-agent-interaction", |repository| {
        let mut run = load_from_repository(repository, id)
            .map_err(|_| "没有找到对应的 Agent Run。".to_string())?;
        let interaction = run
            .checkpoint
            .interaction
            .clone()
            .ok_or_else(|| "该 Agent Run 没有等待中的用户追问。".to_string())?;
        if interaction.get("kind").and_then(Value::as_str) != Some("ask_user")
            || interaction.get("id").and_then(Value::as_str) != Some(form_id)
        {
            return Err("表单不属于当前 Agent Run。".to_string());
        }
        if !matches!(action, "submit" | "skip") {
            return Err("ask_user 只支持提交或跳过。".to_string());
        }
        let normalized_answers = validate_interaction_answers(&interaction, action, &answers)?;
        let response = json!({ "action": action, "answers": normalized_answers });
        if interaction.get("status").and_then(Value::as_str) == Some("submitted") {
            if interaction.get("response") == Some(&response) {
                return Ok((run, Vec::new()));
            }
            return Err("该表单已经提交，不能改写原回答。".to_string());
        }
        if run.status != "awaiting-user-input" {
            return Err(format!("当前状态为 {}，不能提交表单。", run.status));
        }
        let mut submitted = interaction;
        submitted["status"] = json!("submitted");
        submitted["response"] = response.clone();
        submitted["submittedAt"] = json!(timestamp);
        if let Some(index) = run
            .interactions
            .iter()
            .position(|item| item.get("id") == Some(&json!(form_id)))
        {
            run.interactions[index] = submitted.clone();
        } else {
            run.interactions.push(submitted.clone());
        }
        run.status = "queued".to_string();
        run.revision += 1;
        run.updated_at = timestamp.to_string();
        run.summary = if action == "skip" {
            "已跳过追问，等待 Agent 根据该选择继续。".to_string()
        } else {
            "已提交追问回答，等待 Agent 继续。".to_string()
        };
        run.checkpoint.phase = "queued".to_string();
        run.checkpoint.context_summary = run.summary.clone();
        run.checkpoint.next_action = "resume-user-input".to_string();
        run.checkpoint.tool_name = "ask_user".to_string();
        run.checkpoint.tool_arguments = json!({ "formId": form_id });
        run.checkpoint.tool_result = Some(json!({
            "type": "ask_user_result",
            "formId": form_id,
            "action": action,
            "answers": normalized_answers,
        }));
        run.checkpoint.interaction = Some(submitted);
        let summary = run.summary.clone();
        append_evidence(
            &mut run,
            "interaction",
            summary,
            json!({ "formId": form_id, "action": action, "answers": normalized_answers }),
            timestamp,
        );
        Ok((run.clone(), vec![mutation(&run)?]))
    })
}

fn validate_interaction_answers(
    interaction: &Value,
    action: &str,
    answers: &Value,
) -> Result<Value, String> {
    if action == "skip" {
        return Ok(json!({}));
    }
    let answers = answers
        .as_object()
        .ok_or_else(|| "表单回答必须是对象。".to_string())?;
    let fields = interaction
        .get("fields")
        .and_then(Value::as_array)
        .ok_or_else(|| "表单定义损坏。".to_string())?;
    let mut normalized = serde_json::Map::new();
    for field in fields {
        let id = field.get("id").and_then(Value::as_str).unwrap_or("");
        let kind = field.get("type").and_then(Value::as_str).unwrap_or("");
        let required = field
            .get("required")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        let value = answers.get(id);
        if value.is_none() || value == Some(&Value::Null) {
            if required {
                return Err(format!(
                    "请完成「{}」。",
                    field.get("label").and_then(Value::as_str).unwrap_or(id)
                ));
            }
            continue;
        }
        let value = value.expect("checked above");
        let normalized_value = match kind {
            "text" => {
                let text = value.as_str().unwrap_or("").trim();
                if text.chars().count() > 800 || (required && text.is_empty()) {
                    return Err(format!("「{}」回答不合法。", id));
                }
                Value::String(text.to_string())
            }
            "confirm" => Value::Bool(
                value
                    .as_bool()
                    .ok_or_else(|| format!("「{}」必须确认或取消。", id))?,
            ),
            "single-choice" => {
                let choice = value
                    .as_str()
                    .ok_or_else(|| format!("「{}」必须选择一个选项。", id))?;
                validate_interaction_option(field, choice)?;
                Value::String(choice.to_string())
            }
            "multi-choice" => {
                let choices = value
                    .as_array()
                    .ok_or_else(|| format!("「{}」必须选择选项。", id))?;
                let mut unique = std::collections::HashSet::new();
                let mut result = Vec::new();
                for choice in choices {
                    let choice = choice
                        .as_str()
                        .ok_or_else(|| format!("「{}」选项不合法。", id))?;
                    validate_interaction_option(field, choice)?;
                    if unique.insert(choice.to_string()) {
                        result.push(Value::String(choice.to_string()));
                    }
                }
                if required && result.is_empty() {
                    return Err(format!("请完成「{}」。", id));
                }
                Value::Array(result)
            }
            _ => return Err("表单字段类型损坏。".to_string()),
        };
        normalized.insert(id.to_string(), normalized_value);
    }
    Ok(Value::Object(normalized))
}

fn validate_interaction_option(field: &Value, choice: &str) -> Result<(), String> {
    let valid = field
        .get("options")
        .and_then(Value::as_array)
        .is_some_and(|options| {
            options
                .iter()
                .any(|option| option.get("value").and_then(Value::as_str) == Some(choice))
        });
    if valid {
        Ok(())
    } else {
        Err("表单选项不属于当前问题。".to_string())
    }
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
    let mut base_run = if input.resume_existing {
        let run = load(root, &input.run_id)?;
        if run.project_id != input.project_id {
            return Err("Agent Run 不属于当前项目，拒绝继续。".to_string());
        }
        if run.status != "queued" {
            return Err(format!("当前状态为 {}，不能继续模型阶段。", run.status));
        }
        run
    } else {
        let mut run = new_hermes_run_with_context(
            input.run_id,
            input.request_id,
            input.project_id,
            input.prompt,
            input.max_steps,
            input.approval_token,
            input.conversation_id,
            input.task_id,
            timestamp,
        );
        run.isolation = input.isolation.clone();
        persist(root, &run)?;
        run
    };
    if base_run.isolation.is_none() {
        base_run.isolation = input.isolation;
    }
    let continuation = base_run
        .checkpoint
        .tool_result
        .as_ref()
        .map(|result| {
            format!(
                "\n\nOmniDesk 已记录上一操作或用户回答，结果如下。不要重复这个操作；用户回答不代表写入或检查授权。若仍需写入或检查，先请求新的独立审批。\n{}",
                serde_json::to_string(result).unwrap_or_else(|_| "null".to_string())
            )
        })
        .unwrap_or_default();
    let isolation_instruction = if base_run.isolation.is_some() {
        "\n\n当前任务运行在隔离 Git 工作区。Patch 和检查只作用于隔离副本；在返回 final 前必须请求并通过适用的受控检查。通过检查后，OmniDesk 会单独请求用户确认是否将已验证 diff 合并回原工程。不要声称改动已经进入原工程。"
    } else {
        ""
    };
    let execution_prompt = format!(
        "{}{}{}",
        base_run.prompt, continuation, isolation_instruction
    );
    let mut run = base_run;
    run.status = "running".to_string();
    run.revision += 1;
    run.updated_at = timestamp.to_string();
    run.summary = "Agent Executor 正在读取上下文并形成结果。".to_string();
    run.checkpoint.phase = "running".to_string();
    run.checkpoint.context_summary = run.summary.clone();
    run.checkpoint.last_confirmation = None;
    run.checkpoint.next_action = "resume-model".to_string();
    append_evidence(
        &mut run,
        "draft",
        "Agent Executor 开始生成受控草稿。",
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
    let expected_revision = run.revision;
    run.status = completion.status;
    if let Some(step) = completion.step {
        run.step = step;
    }
    run.revision += 1;
    run.updated_at = timestamp.to_string();
    run.summary = completion.summary;
    run.approval = completion.approval;
    let mut interaction = completion.interaction;
    if let Some(value) = interaction.as_mut() {
        value["id"] = json!(format!(
            "ask-user-{}-{}-{}",
            run.id,
            run.revision + 1,
            completion.step.unwrap_or(run.step)
        ));
        value["requestedAt"] = json!(timestamp);
        if let Some(index) = run
            .interactions
            .iter()
            .position(|item| item.get("id") == value.get("id"))
        {
            run.interactions[index] = value.clone();
        } else {
            run.interactions.push(value.clone());
        }
    }
    run.checkpoint.interaction = interaction;
    run.checkpoint.phase = run.status.clone();
    run.checkpoint.context_summary = run.summary.clone();
    run.checkpoint.last_confirmation = run.approval.clone();
    run.checkpoint.next_action = if run.status == "awaiting-approval" {
        "resume-approval".to_string()
    } else if run.status == "awaiting-user-input" {
        "await-user-input".to_string()
    } else if matches!(run.status.as_str(), "failed" | "cancelled" | "succeeded") {
        "none".to_string()
    } else {
        "resume-stage".to_string()
    };
    let evidence_phase = if run.status == "awaiting-approval" {
        "approval"
    } else if run.status == "awaiting-user-input" {
        "interaction"
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
    Repository::new(root).transaction_with("settle-agent-model-run", |repository| {
        let current = load_from_repository(repository, &run.id)?;
        if current.revision != expected_revision || current.status != "running" {
            return Err("Agent Run 已进入更新的状态，拒绝写入迟到的模型结果。".to_string());
        }
        Ok((run.clone(), vec![mutation(&run)?]))
    })
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
    run.status = match name.as_str() {
        "apply_patch" | "integrate_worktree" => "applying",
        "run_check" => "verifying",
        _ => "running-tool",
    }
    .to_string();
    run.revision += 1;
    run.updated_at = timestamp.to_string();
    run.summary = format!("正在执行已批准工具：{name}");
    run.checkpoint.phase = run.status.clone();
    run.checkpoint.context_summary = run.summary.clone();
    run.checkpoint.last_confirmation = Some(approval);
    run.checkpoint.next_action = match name.as_str() {
        "apply_patch" | "integrate_worktree" => "resume-apply-approval",
        "run_check" => "resume-check-approval",
        _ => "resume-tool-approval",
    }
    .to_string();
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
    let integration_succeeded = name == "integrate_worktree"
        && result.get("success").and_then(Value::as_bool) == Some(true);
    let standalone_tool_succeeded =
        run.executor_id == "tool-gateway" && matches!(name, "mcp_discover" | "mcp_call");
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
    if integration_succeeded {
        run.status = "succeeded".to_string();
        run.checkpoint.next_action = "none".to_string();
        run.summary = "隔离工作区改动已在独立审批后合并到当前工程。".to_string();
    } else if standalone_tool_succeeded {
        run.status = "succeeded".to_string();
        run.checkpoint.next_action = "none".to_string();
        run.summary = if name == "mcp_discover" {
            "MCP 工具能力发现完成。"
        } else {
            "MCP 工具调用完成。"
        }
        .to_string();
    } else if check_failed && run.checkpoint.remaining_repair_budget == 0 {
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
    run.approval_token.clear();
    let summary = run.summary.clone();
    append_evidence(
        run,
        "tool-failed",
        summary,
        json!({ "name": name, "error": error }),
        timestamp,
    );
}

/// Creates a durable approval request for MCP capability discovery. Creating
/// this run never starts the configured process; execution remains behind the
/// same approval consumer used by every governed Agent tool.
pub fn create_mcp_discovery_run(
    root: &Path,
    id: String,
    request_id: String,
    project_id: String,
    server_id: String,
    approval_token: String,
    timestamp: &str,
) -> Result<PersistedAgentRun, String> {
    let server_id = server_id.trim();
    if server_id.is_empty() {
        return Err("MCP 能力发现缺少 Server ID。".to_string());
    }
    if approval_token.trim().is_empty() {
        return Err("MCP 能力发现缺少独立审批 token。".to_string());
    }
    let mut run = new_hermes_run_with_context(
        id,
        request_id,
        project_id,
        format!("发现 MCP Server {server_id} 的工具能力。"),
        1,
        String::new(),
        String::new(),
        String::new(),
        timestamp,
    );
    run.executor_id = "tool-gateway".to_string();
    run.status = "awaiting-approval".to_string();
    run.summary = format!("等待批准发现 MCP Server {server_id} 的工具能力。");
    let approval = json!({
        "id": format!("{}:approval", run.id),
        "name": "mcp_discover",
        "arguments": { "serverId": server_id },
        "reason": "启动已配置的 MCP Server 并读取其工具清单",
        "toolCallId": format!("{}:tool", run.id),
        "status": "pending",
        "token": approval_token,
    });
    run.approval = Some(approval.clone());
    run.checkpoint.phase = "awaiting-approval".to_string();
    run.checkpoint.context_summary = run.summary.clone();
    run.checkpoint.last_confirmation = Some(approval.clone());
    run.checkpoint.next_action = "resume-approval".to_string();
    run.checkpoint.tool_name = "mcp_discover".to_string();
    run.checkpoint.tool_arguments = approval["arguments"].clone();
    append_evidence(
        &mut run,
        "approval",
        "MCP 能力发现正在等待独立审批。",
        json!({ "name": "mcp_discover", "serverId": server_id }),
        timestamp,
    );
    Repository::new(root).transaction_with("create-mcp-discovery-run", |repository| {
        let path = relative_path(&run.id)?;
        if repository.read_json(&path).is_some() {
            return Err("Agent Run 已存在，拒绝覆盖原有执行证据。".to_string());
        }
        Ok((run.clone(), vec![mutation(&run)?]))
    })
}

pub fn create_mcp_call_run(
    root: &Path,
    id: String,
    request_id: String,
    project_id: String,
    server_id: String,
    remote_name: String,
    arguments: Value,
    approval_token: String,
    timestamp: &str,
) -> Result<PersistedAgentRun, String> {
    if server_id.trim().is_empty()
        || remote_name.trim().is_empty()
        || approval_token.trim().is_empty()
    {
        return Err("MCP 工具调用缺少 Server、工具名或独立审批 token。".to_string());
    }
    let mut run = new_hermes_run_with_context(
        id,
        request_id,
        project_id,
        format!("调用 MCP 工具 {server_id}/{remote_name}。"),
        1,
        String::new(),
        String::new(),
        String::new(),
        timestamp,
    );
    run.executor_id = "tool-gateway".to_string();
    run.status = "awaiting-approval".to_string();
    run.summary = format!("等待批准调用 MCP 工具 {remote_name}。");
    let approval = json!({
        "id": format!("{}:approval", run.id),
        "name": "mcp_call",
        "arguments": { "serverId": server_id, "remoteName": remote_name, "arguments": arguments },
        "reason": "启动已配置的 MCP Server 并调用指定工具",
        "toolCallId": format!("{}:tool", run.id),
        "status": "pending",
        "token": approval_token,
    });
    run.approval = Some(approval.clone());
    run.checkpoint.phase = "awaiting-approval".to_string();
    run.checkpoint.context_summary = run.summary.clone();
    run.checkpoint.last_confirmation = Some(approval.clone());
    run.checkpoint.next_action = "resume-approval".to_string();
    run.checkpoint.tool_name = "mcp_call".to_string();
    run.checkpoint.tool_arguments = approval["arguments"].clone();
    append_evidence(
        &mut run,
        "approval",
        "MCP 工具调用正在等待独立审批。",
        json!({
            "name": "mcp_call", "serverId": server_id, "remoteName": remote_name
        }),
        timestamp,
    );
    Repository::new(root).transaction_with("create-mcp-call-run", |repository| {
        let path = relative_path(&run.id)?;
        if repository.read_json(&path).is_some() {
            return Err("Agent Run 已存在，拒绝覆盖原有执行证据。".to_string());
        }
        Ok((run.clone(), vec![mutation(&run)?]))
    })
}

#[cfg(any(test, feature = "webdriver"))]
pub fn new_hermes_run(
    id: String,
    request_id: String,
    project_id: String,
    prompt: String,
    max_steps: usize,
    approval_token: String,
    timestamp: &str,
) -> PersistedAgentRun {
    new_hermes_run_with_context(
        id,
        request_id,
        project_id,
        prompt,
        max_steps,
        approval_token,
        String::new(),
        String::new(),
        timestamp,
    )
}

pub fn new_hermes_run_with_context(
    id: String,
    request_id: String,
    project_id: String,
    prompt: String,
    max_steps: usize,
    approval_token: String,
    conversation_id: String,
    task_id: String,
    timestamp: &str,
) -> PersistedAgentRun {
    new_agent_run_with_context(
        id,
        request_id,
        project_id,
        "hermes-acp".to_string(),
        prompt,
        max_steps,
        approval_token,
        conversation_id,
        task_id,
        timestamp,
    )
}

#[allow(clippy::too_many_arguments)]
pub fn new_agent_run_with_context(
    id: String,
    request_id: String,
    project_id: String,
    executor_id: String,
    prompt: String,
    max_steps: usize,
    approval_token: String,
    conversation_id: String,
    task_id: String,
    timestamp: &str,
) -> PersistedAgentRun {
    let mut run = PersistedAgentRun {
        schema_version: AGENT_RUN_SCHEMA_VERSION.to_string(),
        id,
        request_id,
        conversation_id,
        task_id,
        project_id,
        executor_id,
        status: "queued".to_string(),
        step: 0,
        max_steps: max_steps.max(1),
        attempt: 0,
        revision: 0,
        created_at: timestamp.to_string(),
        updated_at: timestamp.to_string(),
        summary: "等待 Agent Executor 执行。".to_string(),
        prompt,
        approval: None,
        approval_token,
        repair_attempt: 0,
        isolation: None,
        interactions: Vec::new(),
        checkpoint: AgentRunCheckpoint {
            phase: "queued".to_string(),
            context_summary: "Agent Run 已创建。".to_string(),
            last_confirmation: None,
            next_action: "start".to_string(),
            tool_name: String::new(),
            tool_arguments: json!({}),
            tool_result: None,
            interaction: None,
            allowed_files: Vec::new(),
            completed_check_ids: Vec::new(),
            remaining_repair_budget: default_remaining_repair_budget(),
        },
        evidence: Vec::new(),
    };
    let executor_id = run.executor_id.clone();
    append_evidence(
        &mut run,
        "scheduling",
        "Agent Run 已创建并等待调度。",
        json!({ "executor": executor_id }),
        timestamp,
    );
    run
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

#[cfg(feature = "webdriver")]
pub fn seed_native_interaction_run(
    root: &Path,
    project_id: String,
    conversation_id: String,
    timestamp: &str,
) -> Result<PersistedAgentRun, String> {
    let mut run = new_hermes_run_with_context(
        "native-interaction-run".to_string(),
        "native-interaction-request".to_string(),
        project_id,
        "Native WebDriver ask_user fixture. Do not execute project tools.".to_string(),
        4,
        String::new(),
        conversation_id,
        "native-interaction-task".to_string(),
        timestamp,
    );
    run.status = "running".to_string();
    run.checkpoint.phase = "running".to_string();
    persist(root, &run)?;
    let interaction = validate_ask_user_interaction(
        &json!({
            "title": "确认数据范围",
            "description": "继续任务前需要确认一个关键选择。",
            "fields": [{
                "id": "scope",
                "type": "single-choice",
                "label": "数据范围",
                "required": true,
                "options": [
                    { "value": "personal", "label": "个人" },
                    { "value": "team", "label": "团队" }
                ]
            }]
        }),
        1,
    )?;
    settle_model_run(
        root,
        run,
        ModelRunCompletion {
            status: "awaiting-user-input".to_string(),
            summary: "原生追问夹具等待用户回答。".to_string(),
            step: Some(1),
            approval: None,
            interaction: Some(interaction),
            evidence_details: json!({ "fixture": true, "approvalCreated": false }),
        },
        timestamp,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn persist_running(root: &Path, mut run: PersistedAgentRun) -> PersistedAgentRun {
        run.status = "running".to_string();
        run.checkpoint.phase = "running".to_string();
        persist(root, &run).unwrap();
        run
    }

    #[test]
    fn new_run_persists_the_selected_executor_in_state_and_evidence() {
        let run = new_agent_run_with_context(
            "run-gemini".to_string(),
            "request-gemini".to_string(),
            "project".to_string(),
            "gemini-acp".to_string(),
            "inspect".to_string(),
            2,
            String::new(),
            String::new(),
            String::new(),
            "2026-07-27T00:00:00Z",
        );
        assert_eq!(run.executor_id, "gemini-acp");
        assert_eq!(run.evidence[0]["details"]["executor"], "gemini-acp");
    }

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
        let mut queued = running.clone();
        queued.id = "run-queued".to_string();
        queued.status = "queued".to_string();
        persist(&root, &running).unwrap();
        persist(&root, &done).unwrap();
        persist(&root, &queued).unwrap();
        recover_stale(&root, "later").unwrap();
        assert_eq!(load(&root, "run-running").unwrap().status, "interrupted");
        let recovered = load(&root, "run-running").unwrap();
        assert_eq!(recovered.checkpoint.phase, "running");
        assert_eq!(recovered.checkpoint.next_action, "resume-stage");
        assert_eq!(recovered.evidence.last().unwrap()["kind"], "recovery");
        assert_eq!(load(&root, "run-done").unwrap().status, "succeeded");
        assert_eq!(load(&root, "run-queued").unwrap().status, "queued");
    }

    #[test]
    fn initial_queue_persistence_keeps_complete_context_and_rejects_overwrite() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-agent-new-queue-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let run = new_hermes_run_with_context(
            "run-queued-context".to_string(),
            "request-queued-context".to_string(),
            "project-1".to_string(),
            "prepare a bounded change".to_string(),
            4,
            String::new(),
            "conversation-1".to_string(),
            "task-1".to_string(),
            "now",
        );
        persist_new_queued(&root, &run).unwrap();
        let saved = load(&root, &run.id).unwrap();
        assert_eq!(saved.status, "queued");
        assert_eq!(saved.request_id, "request-queued-context");
        assert_eq!(saved.conversation_id, "conversation-1");
        assert_eq!(saved.task_id, "task-1");
        assert_eq!(saved.prompt, "prepare a bounded change");
        assert_eq!(saved.evidence[0]["schemaVersion"], RUN_EVENT_SCHEMA_VERSION);
        assert_eq!(saved.evidence[0]["kind"], "scheduling");
        assert_eq!(saved.evidence[0]["sequence"], 1);
        assert!(persist_new_queued(&root, &run)
            .unwrap_err()
            .contains("拒绝覆盖"));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn queue_wait_appends_a_stable_scheduling_event_sequence() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-agent-queue-event-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let run = new_hermes_run(
            "run-queue-event".to_string(),
            "request-queue-event".to_string(),
            "project-1".to_string(),
            "wait safely".to_string(),
            4,
            String::new(),
            "now",
        );
        persist_new_queued(&root, &run).unwrap();
        let waiting = record_queue_wait(&root, &run.id, 2, "later").unwrap();
        assert_eq!(waiting.evidence.len(), 2);
        assert_eq!(waiting.evidence[1]["sequence"], 2);
        assert_eq!(waiting.evidence[1]["kind"], "scheduling");
        assert_eq!(waiting.evidence[1]["details"]["position"], 2);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn timeline_export_aggregates_explicit_metrics_and_redacts_content() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-agent-timeline-export-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let mut run = new_hermes_run(
            "run-export".to_string(),
            "request-export".to_string(),
            "project-1".to_string(),
            "secret prompt must not be exported".to_string(),
            4,
            String::new(),
            "now",
        );
        run.status = "running".to_string();
        append_evidence(
            &mut run,
            "draft",
            "model completed",
            json!({
                "durationMs": 125,
                "usage": { "inputTokens": 10, "outputTokens": 5, "totalTokens": 15, "costUsd": 0.002 },
                "observations": [{ "content": "private file body" }],
                "trace": ["HERMES_STEP: 1 final"]
            }),
            "later",
        );
        persist(&root, &run).unwrap();
        let exported = export_timeline(&root, &run.id, "exported").unwrap();
        let timeline = &exported["timeline"];
        assert_eq!(timeline["metrics"]["durationMs"], 125);
        assert_eq!(timeline["metrics"]["totalTokens"], 15);
        assert_eq!(timeline["metrics"]["costUsd"], 0.002);
        let serialized = serde_json::to_string(timeline).unwrap();
        assert!(!serialized.contains("secret prompt"));
        assert!(!serialized.contains("private file body"));
        assert!(serialized.contains("HERMES_STEP: 1 final"));
        assert!(root.join(exported["path"].as_str().unwrap()).is_file());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn timeline_cost_is_unknown_when_any_model_stage_omits_cost() {
        let mut run = new_hermes_run(
            "run-partial-cost".to_string(),
            "request-partial-cost".to_string(),
            "project-1".to_string(),
            "test cost completeness".to_string(),
            4,
            String::new(),
            "now",
        );
        run.status = "running".to_string();
        append_evidence(
            &mut run,
            "draft",
            "first model stage",
            json!({ "usage": { "inputTokens": 5, "outputTokens": 3, "totalTokens": 8, "costUsd": 0.001 } }),
            "one",
        );
        append_evidence(
            &mut run,
            "draft",
            "second model stage",
            json!({ "usage": { "inputTokens": 4, "outputTokens": 2, "totalTokens": 6 } }),
            "two",
        );
        let metrics = timeline_metrics(&run);
        assert_eq!(metrics.total_tokens, 14);
        assert_eq!(metrics.cost_usd, None);
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
                conversation_id: String::new(),
                task_id: String::new(),
                resume_existing: false,
                isolation: None,
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
                conversation_id: String::new(),
                task_id: String::new(),
                resume_existing: true,
                isolation: None,
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
                conversation_id: String::new(),
                task_id: String::new(),
                resume_existing: true,
                isolation: None,
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
        let run = persist_running(
            &root,
            new_hermes_run(
                "run-model-completion-approval".to_string(),
                "request-1".to_string(),
                "project-1".to_string(),
                "update".to_string(),
                4,
                String::new(),
                "now",
            ),
        );
        let settled = settle_model_run(
            &root,
            run,
            ModelRunCompletion {
                status: "awaiting-approval".to_string(),
                summary: "等待独立 Patch 审批。".to_string(),
                step: Some(2),
                approval: Some(json!({ "token": "approval-1", "name": "apply_patch" })),
                interaction: None,
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
            let run = persist_running(
                &root,
                new_hermes_run(
                    format!("run-model-completion-{status}"),
                    "request-1".to_string(),
                    "project-1".to_string(),
                    "update".to_string(),
                    4,
                    String::new(),
                    "now",
                ),
            );
            let settled = settle_model_run(
                &root,
                run,
                ModelRunCompletion {
                    status: status.to_string(),
                    summary: format!("{status} result"),
                    step: Some(3),
                    approval: None,
                    interaction: None,
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
    fn cancellation_seals_the_run_against_late_model_results() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-agent-cancel-race-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let running = persist_running(
            &root,
            new_hermes_run(
                "run-cancel-race".to_string(),
                "request-cancel-race".to_string(),
                "project-1".to_string(),
                "update".to_string(),
                4,
                String::new(),
                "now",
            ),
        );
        let cancelled = cancel(&root, &running.id, "cancelled-at").unwrap();
        assert_eq!(cancelled.status, "cancelled");
        assert_eq!(cancelled.checkpoint.next_action, "none");
        assert_eq!(cancelled.evidence.last().unwrap()["phase"], "cancelled");

        let error = settle_model_run(
            &root,
            running,
            ModelRunCompletion {
                status: "succeeded".to_string(),
                summary: "late result".to_string(),
                step: Some(1),
                approval: None,
                interaction: None,
                evidence_details: json!({ "late": true }),
            },
            "later",
        )
        .err()
        .unwrap();
        assert!(error.contains("迟到"));
        assert_eq!(load(&root, "run-cancel-race").unwrap().status, "cancelled");
        std::fs::remove_dir_all(root).unwrap();
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
    fn mcp_discovery_is_persisted_as_an_unexecuted_independent_approval() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-agent-mcp-discovery-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let run = create_mcp_discovery_run(
            &root,
            "run-mcp-discovery".to_string(),
            "request-mcp-discovery".to_string(),
            "project-1".to_string(),
            "docs-server".to_string(),
            "approval-mcp-discovery".to_string(),
            "now",
        )
        .unwrap();

        assert_eq!(run.executor_id, "tool-gateway");
        assert_eq!(run.status, "awaiting-approval");
        assert_eq!(run.approval.as_ref().unwrap()["status"], "pending");
        assert_eq!(run.approval.as_ref().unwrap()["name"], "mcp_discover");
        assert_eq!(run.checkpoint.tool_arguments["serverId"], "docs-server");
        assert!(run.approval_token.is_empty());
        assert_eq!(
            load(&root, "run-mcp-discovery").unwrap().revision,
            run.revision
        );
        assert!(create_mcp_discovery_run(
            &root,
            "run-mcp-discovery".to_string(),
            "request-2".to_string(),
            "project-1".to_string(),
            "docs-server".to_string(),
            "different-token".to_string(),
            "later",
        )
        .is_err());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn generic_approved_tools_use_tool_execution_state_not_verification_state() {
        let mut run = new_hermes_run(
            "run-mcp-tool-state".to_string(),
            "request-1".to_string(),
            "project-1".to_string(),
            "discover tools".to_string(),
            1,
            String::new(),
            "now",
        );
        run.status = "awaiting-approval".to_string();
        run.approval = Some(json!({
            "token": "approval-token",
            "status": "approved",
            "name": "mcp_discover",
            "arguments": { "serverId": "docs-server" }
        }));

        begin_approved_tool(&mut run, "approval-token", "later").unwrap();

        assert_eq!(run.status, "running-tool");
        assert_eq!(run.checkpoint.next_action, "resume-tool-approval");
        assert_eq!(run.evidence.last().unwrap()["kind"], "tool");
    }

    #[test]
    fn approved_isolated_integration_settles_as_a_terminal_success() {
        let mut run = new_hermes_run(
            "run-integrate-worktree".to_string(),
            "request-1".to_string(),
            "project-1".to_string(),
            "merge isolated changes".to_string(),
            20,
            String::new(),
            "now",
        );
        run.status = "awaiting-approval".to_string();
        run.approval = Some(json!({
            "token": "integration-token",
            "status": "approved",
            "name": "integrate_worktree",
            "arguments": { "allowedFiles": ["src/lib.rs"], "diff": "diff" }
        }));

        let (name, _) = begin_approved_tool(&mut run, "integration-token", "later").unwrap();
        assert_eq!(name, "integrate_worktree");
        assert_eq!(run.status, "applying");
        settle_approved_tool(
            &mut run,
            "integrate_worktree",
            &json!({ "allowedFiles": ["src/lib.rs"] }),
            json!({ "success": true }),
            "done",
        );
        assert_eq!(run.status, "succeeded");
        assert_eq!(run.checkpoint.next_action, "none");
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

    #[test]
    fn ask_user_contract_rejects_unbounded_or_unsafe_fields() {
        assert!(validate_ask_user_interaction(&json!({
            "title": "Need a choice",
            "description": "",
            "fields": [{ "id": "../scope", "type": "single-choice", "label": "Scope", "options": [{ "value": "one", "label": "One" }] }]
        }), 1).is_err());
        assert!(validate_ask_user_interaction(&json!({
            "title": "Need a choice",
            "description": "",
            "fields": [{ "id": "scope", "type": "single-choice", "label": "Scope", "options": [] }]
        }), 1).is_err());
    }

    #[test]
    fn user_interaction_survives_recovery_and_accepts_only_one_answer() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-agent-interaction-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let interaction = validate_ask_user_interaction(&json!({
            "title": "确认范围",
            "description": "开始前需要这个选择。",
            "fields": [{
                "id": "scope", "type": "single-choice", "label": "数据范围", "required": true,
                "options": [{ "value": "personal", "label": "个人" }, { "value": "team", "label": "团队" }]
            }]
        }), 2).unwrap();
        let run = persist_running(
            &root,
            new_hermes_run_with_context(
                "run-interaction".to_string(),
                "request-1".to_string(),
                "project-1".to_string(),
                "build dashboard".to_string(),
                4,
                String::new(),
                "conversation-1".to_string(),
                String::new(),
                "now",
            ),
        );
        let waiting = settle_model_run(
            &root,
            run,
            ModelRunCompletion {
                status: "awaiting-user-input".to_string(),
                summary: "等待用户确认。".to_string(),
                step: Some(2),
                approval: None,
                interaction: Some(interaction.clone()),
                evidence_details: json!({ "trace": ["ask-user"] }),
            },
            "later",
        )
        .unwrap();
        assert_eq!(waiting.checkpoint.next_action, "await-user-input");
        let form_id = waiting.checkpoint.interaction.as_ref().unwrap()["id"]
            .as_str()
            .unwrap()
            .to_string();
        assert_eq!(waiting.interactions.len(), 1);
        recover_stale(&root, "restart").unwrap();
        assert_eq!(
            load(&root, "run-interaction").unwrap().status,
            "awaiting-user-input"
        );

        let submitted = submit_interaction(
            &root,
            "run-interaction",
            &form_id,
            "submit",
            json!({ "scope": "team" }),
            "answer",
        )
        .unwrap();
        assert_eq!(submitted.status, "queued");
        assert_eq!(submitted.checkpoint.next_action, "resume-user-input");
        assert_eq!(
            submitted.checkpoint.tool_result.as_ref().unwrap()["answers"]["scope"],
            "team"
        );
        assert_eq!(submitted.interactions[0]["status"], "submitted");
        let same = submit_interaction(
            &root,
            "run-interaction",
            &form_id,
            "submit",
            json!({ "scope": "team" }),
            "again",
        )
        .unwrap();
        assert_eq!(same.revision, submitted.revision);
        assert!(submit_interaction(
            &root,
            "run-interaction",
            &form_id,
            "submit",
            json!({ "scope": "personal" }),
            "conflict"
        )
        .is_err());
        let resumed = prepare_model_run(
            &root,
            PrepareModelRunInput {
                run_id: "run-interaction".to_string(),
                request_id: String::new(),
                project_id: "project-1".to_string(),
                prompt: String::new(),
                max_steps: 4,
                approval_token: String::new(),
                conversation_id: String::new(),
                task_id: String::new(),
                resume_existing: true,
                isolation: None,
            },
            "continue",
        )
        .unwrap();
        assert!(resumed.execution_prompt.contains("ask_user_result"));
        let completed = settle_model_run(
            &root,
            resumed.run,
            ModelRunCompletion {
                status: "succeeded".to_string(),
                summary: "done".to_string(),
                step: Some(3),
                approval: None,
                interaction: None,
                evidence_details: json!({ "result": true }),
            },
            "done",
        )
        .unwrap();
        assert_eq!(completed.interactions[0]["status"], "submitted");

        let skipped_run = persist_running(
            &root,
            new_hermes_run_with_context(
                "run-interaction-skip".to_string(),
                "request-2".to_string(),
                "project-1".to_string(),
                "build another dashboard".to_string(),
                4,
                String::new(),
                "conversation-1".to_string(),
                String::new(),
                "now",
            ),
        );
        let skipped_waiting = settle_model_run(
            &root,
            skipped_run,
            ModelRunCompletion {
                status: "awaiting-user-input".to_string(),
                summary: "等待用户确认。".to_string(),
                step: Some(1),
                approval: None,
                interaction: Some(interaction),
                evidence_details: json!({ "trace": ["ask-user"] }),
            },
            "later",
        )
        .unwrap();
        let skipped_form_id = skipped_waiting.checkpoint.interaction.as_ref().unwrap()["id"]
            .as_str()
            .unwrap();
        let skipped = submit_interaction(
            &root,
            "run-interaction-skip",
            skipped_form_id,
            "skip",
            json!({ "scope": "invalid-is-ignored" }),
            "skipped",
        )
        .unwrap();
        assert_eq!(skipped.status, "queued");
        assert_eq!(
            skipped.checkpoint.tool_result.as_ref().unwrap()["action"],
            "skip"
        );
        assert_eq!(
            skipped.checkpoint.tool_result.as_ref().unwrap()["answers"],
            json!({})
        );
        assert!(skipped.approval.is_none());
        std::fs::remove_dir_all(root).unwrap();
    }
}
