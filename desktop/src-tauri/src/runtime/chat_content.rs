use crate::runtime::chat_routing::{
    is_greeting_message, is_question_like_message, should_create_plan_for_message,
};
use crate::runtime::planning::PlanAttachment;
use crate::runtime::provider::trim_for_trace;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::path::Path;

const GOALS_PATH: &str = ".omnidesk/data/goals.json";
const BACKLOG_PATH: &str = ".omnidesk/data/task-backlog.json";
const GOAL_VALIDATION_REPORT_PATH: &str = ".omnidesk/evidence/goal-validation-report.json";

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ChatTurnInput {
    pub role: String,
    pub text: String,
}

#[derive(Default, Deserialize, Serialize, Clone)]
#[serde(default, rename_all = "camelCase")]
pub struct DialogueContextInput {
    pub current_topic: String,
    pub expected_next_action: String,
    pub last_intent: String,
    pub pending_question: String,
    pub previous_conclusion: String,
    pub user_delegation: String,
    pub task_id: String,
    pub task_title: String,
    pub task_status: String,
    pub task_goal: String,
    pub task_summary: String,
    pub task_next_action: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatWithModelResult {
    pub reply: String,
    pub should_create_plan: bool,
    pub intent: String,
    #[serde(default)]
    pub provider_status: String,
    #[serde(default)]
    pub provider_model: String,
    #[serde(default)]
    pub provider_error: String,
    #[serde(default)]
    pub response_mode: String,
    #[serde(default)]
    pub references: Vec<MessageReference>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MessageReference {
    pub kind: String,
    pub label: String,
    pub target: String,
    #[serde(default)]
    pub detail: String,
}

pub fn chat_reply_prompt(
    project_name: &str,
    stage: &str,
    current_model: &str,
    message: &str,
    attachments: &[PlanAttachment],
    recent_turns: &[ChatTurnInput],
    context_state: &DialogueContextInput,
    summary: &Value,
    project_memory: &[Value],
    project_evidence: &Value,
) -> String {
    let attachment_note = if attachments.is_empty() {
        "No image attachments.".to_string()
    } else {
        format!(
            "Image attachments: {}.",
            attachments
                .iter()
                .map(|attachment| attachment.name.clone())
                .collect::<Vec<_>>()
                .join(", ")
        )
    };
    let history = recent_turns
        .iter()
        .take(8)
        .map(|turn| format!("{}: {}", turn.role, trim_for_trace(&turn.text)))
        .collect::<Vec<_>>()
        .join("\n");
    let context_json = serde_json::to_string(context_state).unwrap_or_else(|_| "{}".to_string());
    let summary_json = serde_json::to_string(summary).unwrap_or_else(|_| "{}".to_string());
    let memory_json = serde_json::to_string(project_memory).unwrap_or_else(|_| "[]".to_string());
    let evidence_json =
        serde_json::to_string_pretty(project_evidence).unwrap_or_else(|_| "{}".to_string());
    format!(
        r#"Current project: {project_name}
Current stage: {stage}
Current configured model: {current_model}
{attachment_note}

Dialogue context state:
{context_json}

Earlier conversation summary:
{summary_json}

Confirmed project memory (may guide collaboration constraints; do not treat it as live file evidence):
{memory_json}

Recent conversation:
{history}

Verified local project evidence:
{evidence_json}

User message:
{message}

Reply directly to the user in natural Chinese text. Do not wrap the answer in JSON or add routing metadata.

Rules:
- Treat short follow-ups such as "那怎么办", "你判断", "直接告诉我", and "直接修" as continuations of currentTopic and previousConclusion. Do not ask the user to repeat the subject when contextState identifies it.
- For project questions, answer from verified local project evidence. State the conclusion first, then cite concrete evidence in the prose, then give the smallest useful next action.
- If evidence is insufficient for a claim, label it as an inference instead of presenting it as fact.
- If the user asks what model you are, mention the current configured model exactly.
- Do not suggest generating a plan, clicking buttons, or asking for confirmation unless the user's request is ambiguous.
- Do not tell the user to inspect another page instead of answering when the evidence above already supports an answer.
- Do not invent completed work.
- Do not mention internal JSON or routing.
"#
    )
}

pub fn local_chat_result(
    message: &str,
    has_attachments: bool,
    context_state: &DialogueContextInput,
    project_evidence: &Value,
) -> ChatWithModelResult {
    let should_create_plan = should_create_plan_for_message(message, has_attachments);
    let topic = if context_state.current_topic.trim().is_empty() {
        message
    } else {
        context_state.current_topic.as_str()
    };
    let risk_question = message.contains("风险") || topic.contains("风险");
    let active_task_count = project_evidence
        .get("activeTasks")
        .and_then(Value::as_array)
        .map(Vec::len)
        .unwrap_or(0);
    let changed_file_count = project_evidence
        .get("changedFiles")
        .and_then(Value::as_array)
        .map(Vec::len)
        .unwrap_or(0);
    let validation_status = project_evidence
        .get("validationStatus")
        .and_then(Value::as_str)
        .unwrap_or("not-run");
    let current_focus = project_evidence
        .get("activeTasks")
        .and_then(Value::as_array)
        .and_then(|tasks| tasks.first())
        .and_then(|task| task.get("title"))
        .and_then(Value::as_str)
        .unwrap_or("当前最高优先级任务");
    ChatWithModelResult {
        reply: if should_create_plan {
            "可以，我整理成一个可执行计划。".to_string()
        } else if is_greeting_message(message) {
            "你好，我在。".to_string()
        } else if context_state.expected_next_action == "recommend-next" {
            format!("建议按这个顺序处理：先推进「{}」；然后运行目标验收并处理失败项；最后审阅剩余 Git 变更，确认是否可以交付。", current_focus)
        } else if context_state.expected_next_action == "decide-next" {
            format!("我判断先推进「{}」。它是当前最直接的阻塞点，完成后立即运行目标验收，再决定是否处理其他风险。", current_focus)
        } else if is_question_like_message(message) || !context_state.current_topic.is_empty() {
            if risk_question {
                format!("当前可确认的风险有三项：还有 {} 个活跃或待确认任务；Git 工作区有 {} 个变更文件；目标验收状态为 {}。建议先处理失败或进行中的任务，再运行目标验收，最后确认剩余 Git 变更是否属于本轮交付。", active_task_count, changed_file_count, validation_status)
            } else {
                format!(
                    "继续回答「{}」：{}",
                    topic,
                    if context_state.previous_conclusion.is_empty() {
                        "当前本地证据还不足以给出更具体结论。"
                    } else {
                        context_state.previous_conclusion.as_str()
                    }
                )
            }
        } else {
            "可以，继续说。".to_string()
        },
        should_create_plan,
        intent: if should_create_plan { "task" } else { "chat" }.to_string(),
        provider_status: "local".to_string(),
        provider_model: String::new(),
        provider_error: String::new(),
        response_mode: "local".to_string(),
        references: Vec::new(),
    }
}

pub fn project_evidence(root: &Path, state: Option<&Value>) -> (Value, Vec<MessageReference>) {
    let project_status = state.and_then(|value| value.get("status")).or(state);
    let goals = read_json(root.join(GOALS_PATH));
    let active_goal_id = goals
        .as_ref()
        .and_then(|value| value.get("activeGoalId"))
        .and_then(Value::as_str)
        .unwrap_or("");
    let active_goal = goals
        .as_ref()
        .and_then(|value| value.get("goals"))
        .and_then(Value::as_array)
        .and_then(|items| {
            items
                .iter()
                .find(|item| item.get("id").and_then(Value::as_str) == Some(active_goal_id))
        });
    let mut task_items = Vec::new();
    if let Ok(entries) = fs::read_dir(crate::runtime::tasks::directory(root)) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|value| value.to_str()) != Some("json")
                || path.file_name().and_then(|value| value.to_str()) == Some("manifest.json")
            {
                continue;
            }
            if let Some(task) = read_json(&path) {
                let status = task
                    .get("status")
                    .and_then(Value::as_str)
                    .unwrap_or("planned");
                if status != "done" {
                    task_items.push(json!({ "id": task.get("id").and_then(Value::as_str).unwrap_or(""), "title": task.get("title").and_then(Value::as_str).unwrap_or("未命名任务"), "status": status, "updatedAt": task.get("updatedAt").and_then(Value::as_str).unwrap_or("") }));
                }
            }
        }
    }
    task_items.sort_by(|a, b| {
        b.get("updatedAt")
            .and_then(Value::as_str)
            .unwrap_or("")
            .cmp(a.get("updatedAt").and_then(Value::as_str).unwrap_or(""))
    });
    task_items.truncate(8);
    let mut changed_files = crate::runtime::workspace_governance::git_changed_files(root)
        .into_iter()
        .collect::<Vec<_>>();
    changed_files.sort();
    changed_files.truncate(12);
    let validation_status = read_json(root.join(GOAL_VALIDATION_REPORT_PATH))
        .as_ref()
        .and_then(|value| value.get("status"))
        .and_then(Value::as_str)
        .unwrap_or("not-run")
        .to_string();
    let mut references = Vec::new();
    for (path, label) in [
        ("PROJECT.md", "项目状态"),
        ("HANDOFF.md", "当前交接"),
        (BACKLOG_PATH, "任务清单"),
        (GOAL_VALIDATION_REPORT_PATH, "验收报告"),
    ] {
        if root.join(path).is_file() {
            references.push(MessageReference {
                kind: "file".to_string(),
                label: label.to_string(),
                target: path.to_string(),
                detail: String::new(),
            });
        }
    }
    if let Some(task) = task_items.first() {
        if let (Some(id), Some(title)) = (
            task.get("id").and_then(Value::as_str),
            task.get("title").and_then(Value::as_str),
        ) {
            references.push(MessageReference {
                kind: "task".to_string(),
                label: title.to_string(),
                target: id.to_string(),
                detail: task
                    .get("status")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string(),
            });
        }
    }
    let evidence = json!({
        "phase": state.and_then(|value| value.get("phase")).and_then(Value::as_str).unwrap_or("unknown"),
        "stage": state.and_then(|value| value.get("stage")).and_then(Value::as_str).unwrap_or("unknown"),
        "doing": compact_json_items(project_status, "doing", 6),
        "blocked": compact_json_items(project_status, "blocked", 6),
        "activeGoal": active_goal.map(|goal| json!({ "id": goal.get("id").and_then(Value::as_str).unwrap_or(""), "title": goal.get("shortTitle").and_then(Value::as_str).or_else(|| goal.get("title").and_then(Value::as_str)).unwrap_or(""), "status": goal.get("status").and_then(Value::as_str).unwrap_or("") })),
        "activeTasks": task_items,
        "changedFiles": changed_files,
        "validationStatus": validation_status
    });
    (evidence, references)
}

pub fn references_for_message(
    message: &str,
    context_state: &DialogueContextInput,
    references: Vec<MessageReference>,
) -> Vec<MessageReference> {
    if is_greeting_message(message) {
        return Vec::new();
    }
    let topic = format!("{} {}", context_state.current_topic, message);
    let preferred_labels: &[&str] = if topic.contains("风险") || topic.contains("验收") {
        &["当前交接", "任务清单", "验收报告"]
    } else if topic.contains("状态") || topic.contains("进度") || topic.contains("下一步") {
        &["项目状态", "当前交接", "任务清单"]
    } else if context_state.expected_next_action == "apply-fix" {
        &["任务清单", "当前交接"]
    } else {
        &["项目状态", "当前交接"]
    };
    let mut selected = references
        .iter()
        .filter(|reference| preferred_labels.contains(&reference.label.as_str()))
        .cloned()
        .collect::<Vec<_>>();
    if topic.contains("任务") || context_state.expected_next_action == "apply-fix" {
        if let Some(task) = references.iter().find(|reference| reference.kind == "task") {
            selected.push(task.clone());
        }
    }
    selected.truncate(4);
    selected
}

fn compact_json_items(value: Option<&Value>, key: &str, limit: usize) -> Vec<String> {
    value
        .and_then(|item| item.get(key))
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(str::trim).filter(|text| !text.is_empty()))
                .take(limit)
                .map(String::from)
                .collect()
        })
        .unwrap_or_default()
}

fn read_json(path: impl AsRef<Path>) -> Option<Value> {
    fs::read_to_string(path)
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn local_result_keeps_questions_out_of_plan_mode() {
        let result = local_chat_result(
            "为什么会失败",
            false,
            &DialogueContextInput::default(),
            &json!({}),
        );
        assert!(!result.should_create_plan);
        assert_eq!(result.intent, "chat");
    }

    #[test]
    fn references_do_not_leak_into_greetings() {
        let references = vec![MessageReference {
            kind: "file".to_string(),
            label: "项目状态".to_string(),
            target: "PROJECT.md".to_string(),
            detail: String::new(),
        }];
        assert!(
            references_for_message("你好", &DialogueContextInput::default(), references).is_empty()
        );
    }

    #[test]
    fn provider_prompt_requests_natural_text_without_routing_json() {
        let prompt = chat_reply_prompt(
            "OmniDesk",
            "stabilizing",
            "test-model",
            "这个问题是什么",
            &[],
            &[],
            &DialogueContextInput::default(),
            &json!({}),
            &[],
            &json!({}),
        );
        assert!(prompt.contains("natural Chinese text"));
        assert!(!prompt.contains("Return strict JSON"));
        assert!(!prompt.contains("shouldCreatePlan"));
    }
}
