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

const INTERACTION_SCHEMA_VERSION: &str = "omnidesk.interaction.v0.1";

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
        let field = field.as_object().ok_or_else(|| "ask_user field 必须是对象。".to_string())?;
        let id = field.get("id").and_then(Value::as_str).unwrap_or("").trim();
        if id.is_empty() || id.len() > 48 || !id.chars().all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-') || !ids.insert(id.to_string()) {
            return Err("ask_user field id 必须唯一且仅含字母、数字、- 或 _。".to_string());
        }
        let kind = field.get("type").and_then(Value::as_str).unwrap_or("");
        if !matches!(kind, "single-choice" | "multi-choice" | "text" | "confirm") {
            return Err("ask_user field type 不受支持。".to_string());
        }
        let label = field.get("label").and_then(Value::as_str).unwrap_or("").trim();
        if label.is_empty() || label.chars().count() > 100 {
            return Err("ask_user field label 长度不合法。".to_string());
        }
        let required = field.get("required").and_then(Value::as_bool).unwrap_or(false);
        let mut normalized = json!({ "id": id, "type": kind, "label": label, "required": required });
        if matches!(kind, "single-choice" | "multi-choice") {
            let options = field.get("options").and_then(Value::as_array).ok_or_else(|| "选择题缺少 options。".to_string())?;
            if options.is_empty() || options.len() > 12 {
                return Err("选择题选项数量必须在 1 到 12 之间。".to_string());
            }
            let mut values = std::collections::HashSet::new();
            let mut normalized_options = Vec::new();
            for option in options {
                let value = option.get("value").and_then(Value::as_str).unwrap_or("").trim();
                let label = option.get("label").and_then(Value::as_str).unwrap_or("").trim();
                if value.is_empty() || value.len() > 80 || label.is_empty() || label.chars().count() > 100 || !values.insert(value.to_string()) {
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
                interaction: run.checkpoint.interaction.clone(),
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
        if let Some(index) = run.interactions.iter().position(|item| item.get("id") == Some(&json!(form_id))) {
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

fn validate_interaction_answers(interaction: &Value, action: &str, answers: &Value) -> Result<Value, String> {
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
        let required = field.get("required").and_then(Value::as_bool).unwrap_or(false);
        let value = answers.get(id);
        if value.is_none() || value == Some(&Value::Null) {
            if required {
                return Err(format!("请完成「{}」。", field.get("label").and_then(Value::as_str).unwrap_or(id)));
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
            "confirm" => Value::Bool(value.as_bool().ok_or_else(|| format!("「{}」必须确认或取消。", id))?),
            "single-choice" => {
                let choice = value.as_str().ok_or_else(|| format!("「{}」必须选择一个选项。", id))?;
                validate_interaction_option(field, choice)?;
                Value::String(choice.to_string())
            }
            "multi-choice" => {
                let choices = value.as_array().ok_or_else(|| format!("「{}」必须选择选项。", id))?;
                let mut unique = std::collections::HashSet::new();
                let mut result = Vec::new();
                for choice in choices {
                    let choice = choice.as_str().ok_or_else(|| format!("「{}」选项不合法。", id))?;
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
        .is_some_and(|options| options.iter().any(|option| option.get("value").and_then(Value::as_str) == Some(choice)));
    if valid { Ok(()) } else { Err("表单选项不属于当前问题。".to_string()) }
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
        let run = new_hermes_run_with_context(
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
        persist(root, &run)?;
        run
    };
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
    let mut interaction = completion.interaction;
    if let Some(value) = interaction.as_mut() {
        value["id"] = json!(format!(
            "ask-user-{}-{}-{}",
            run.id,
            run.revision + 1,
            completion.step.unwrap_or(run.step)
        ));
        value["requestedAt"] = json!(timestamp);
        if let Some(index) = run.interactions.iter().position(|item| item.get("id") == value.get("id")) {
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
    PersistedAgentRun {
        schema_version: AGENT_RUN_SCHEMA_VERSION.to_string(),
        id,
        request_id,
        conversation_id,
        task_id,
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

#[cfg(feature = "webdriver")]
pub fn seed_native_interaction_run(
    root: &Path,
    project_id: String,
    conversation_id: String,
    timestamp: &str,
) -> Result<PersistedAgentRun, String> {
    let run = new_hermes_run_with_context(
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
                conversation_id: String::new(),
                task_id: String::new(),
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
                conversation_id: String::new(),
                task_id: String::new(),
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
                conversation_id: String::new(),
                task_id: String::new(),
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
            SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()
        ));
        let interaction = validate_ask_user_interaction(&json!({
            "title": "确认范围",
            "description": "开始前需要这个选择。",
            "fields": [{
                "id": "scope", "type": "single-choice", "label": "数据范围", "required": true,
                "options": [{ "value": "personal", "label": "个人" }, { "value": "team", "label": "团队" }]
            }]
        }), 2).unwrap();
        let run = new_hermes_run_with_context(
            "run-interaction".to_string(), "request-1".to_string(), "project-1".to_string(),
            "build dashboard".to_string(), 4, String::new(), "conversation-1".to_string(), String::new(), "now",
        );
        let waiting = settle_model_run(&root, run, ModelRunCompletion {
            status: "awaiting-user-input".to_string(), summary: "等待用户确认。".to_string(), step: Some(2),
            approval: None, interaction: Some(interaction.clone()), evidence_details: json!({ "trace": ["ask-user"] }),
        }, "later").unwrap();
        assert_eq!(waiting.checkpoint.next_action, "await-user-input");
        let form_id = waiting.checkpoint.interaction.as_ref().unwrap()["id"].as_str().unwrap().to_string();
        assert_eq!(waiting.interactions.len(), 1);
        recover_stale(&root, "restart").unwrap();
        assert_eq!(load(&root, "run-interaction").unwrap().status, "awaiting-user-input");

        let submitted = submit_interaction(&root, "run-interaction", &form_id, "submit", json!({ "scope": "team" }), "answer").unwrap();
        assert_eq!(submitted.status, "queued");
        assert_eq!(submitted.checkpoint.next_action, "resume-user-input");
        assert_eq!(submitted.checkpoint.tool_result.as_ref().unwrap()["answers"]["scope"], "team");
        assert_eq!(submitted.interactions[0]["status"], "submitted");
        let same = submit_interaction(&root, "run-interaction", &form_id, "submit", json!({ "scope": "team" }), "again").unwrap();
        assert_eq!(same.revision, submitted.revision);
        assert!(submit_interaction(&root, "run-interaction", &form_id, "submit", json!({ "scope": "personal" }), "conflict").is_err());
        let resumed = prepare_model_run(&root, PrepareModelRunInput {
            run_id: "run-interaction".to_string(), request_id: String::new(), project_id: "project-1".to_string(),
            prompt: String::new(), max_steps: 4, approval_token: String::new(), conversation_id: String::new(), task_id: String::new(), resume_existing: true,
        }, "continue").unwrap();
        assert!(resumed.execution_prompt.contains("ask_user_result"));
        let completed = settle_model_run(&root, resumed.run, ModelRunCompletion {
            status: "succeeded".to_string(), summary: "done".to_string(), step: Some(3), approval: None,
            interaction: None, evidence_details: json!({ "result": true }),
        }, "done").unwrap();
        assert_eq!(completed.interactions[0]["status"], "submitted");

        let skipped_run = new_hermes_run_with_context(
            "run-interaction-skip".to_string(), "request-2".to_string(), "project-1".to_string(),
            "build another dashboard".to_string(), 4, String::new(), "conversation-1".to_string(), String::new(), "now",
        );
        let skipped_waiting = settle_model_run(&root, skipped_run, ModelRunCompletion {
            status: "awaiting-user-input".to_string(), summary: "等待用户确认。".to_string(), step: Some(1),
            approval: None, interaction: Some(interaction), evidence_details: json!({ "trace": ["ask-user"] }),
        }, "later").unwrap();
        let skipped_form_id = skipped_waiting.checkpoint.interaction.as_ref().unwrap()["id"].as_str().unwrap();
        let skipped = submit_interaction(&root, "run-interaction-skip", skipped_form_id, "skip", json!({ "scope": "invalid-is-ignored" }), "skipped").unwrap();
        assert_eq!(skipped.status, "queued");
        assert_eq!(skipped.checkpoint.tool_result.as_ref().unwrap()["action"], "skip");
        assert_eq!(skipped.checkpoint.tool_result.as_ref().unwrap()["answers"], json!({}));
        assert!(skipped.approval.is_none());
        std::fs::remove_dir_all(root).unwrap();
    }
}
