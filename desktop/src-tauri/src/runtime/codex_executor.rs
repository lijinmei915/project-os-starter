use crate::runtime::acp_protocol::ProviderUsage;
use crate::runtime::agent_executor::{
    AgentEvent, AgentExecutionRequest, AgentExecutionResult, AgentExecutor,
    AgentExecutorCapabilities, AgentExecutorStatus, AGENT_EXECUTOR_CONTRACT_VERSION,
};
use crate::runtime::provider::ProviderConfig;
use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Read};
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::time::Duration;

pub struct CodexCliExecutor;

pub static CODEX_CLI_EXECUTOR: CodexCliExecutor = CodexCliExecutor;

fn probe() -> Result<String, String> {
    let output = Command::new("codex")
        .arg("--version")
        .output()
        .map_err(|_| "未检测到 Codex CLI。请先在本机安装并登录 Codex CLI。".to_string())?;
    if !output.status.success() {
        return Err("Codex CLI 无法启动。请检查本机安装和登录状态。".to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn capabilities() -> AgentExecutorCapabilities {
    AgentExecutorCapabilities::unsupported("codex-jsonl")
        .with_extension("readOnlyPlanning", Value::Bool(true))
        .with_extension("streamingEvents", Value::Bool(true))
        .with_extension("writesGovernedByRuntime", Value::Bool(true))
}

fn public_event(
    events: &mut Vec<AgentEvent>,
    request: &AgentExecutionRequest,
    kind: &str,
    phase: &str,
    status: &str,
    summary: &str,
    details: Value,
) {
    let event = AgentEvent::new(events.len() + 1, kind, phase, status, summary, details);
    if let Some(sink) = &request.event_sink {
        sink(&event);
    }
    events.push(event);
}

fn terminal(
    events: &mut Vec<AgentEvent>,
    request: &AgentExecutionRequest,
    status: &str,
    summary: &str,
) {
    if !events.iter().any(AgentEvent::is_terminal) {
        public_event(
            events,
            request,
            "terminal",
            "model",
            status,
            summary,
            json!({}),
        );
    }
}

fn usage(value: &Value) -> ProviderUsage {
    let input_tokens = value
        .pointer("/usage/input_tokens")
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let output_tokens = value
        .pointer("/usage/output_tokens")
        .and_then(Value::as_u64)
        .unwrap_or(0);
    ProviderUsage {
        input_tokens,
        output_tokens,
        total_tokens: input_tokens.saturating_add(output_tokens),
        cost_usd: None,
        source: "codex-cli".to_string(),
    }
}

fn item_event(item: &Value) -> Option<(&'static str, &'static str)> {
    match item.get("type").and_then(Value::as_str) {
        Some("command_execution" | "file_change" | "mcp_tool_call") => {
            Some(("tool", "正在读取已授权的项目内容"))
        }
        Some("reasoning") => Some(("model", "正在分析已读取的项目内容")),
        _ => None,
    }
}

impl AgentExecutor for CodexCliExecutor {
    fn id(&self) -> &'static str {
        "codex-cli"
    }

    fn capabilities(&self) -> AgentExecutorCapabilities {
        capabilities()
    }

    fn status(&self) -> AgentExecutorStatus {
        match probe() {
            Ok(version) => AgentExecutorStatus {
                contract_version: AGENT_EXECUTOR_CONTRACT_VERSION.to_string(),
                id: self.id().to_string(),
                protocol: "codex-jsonl".to_string(),
                status: "ready".to_string(),
                version,
                message:
                    "Codex CLI 已就绪，可用于只读规划；文件改动和检查仍由 OmniDesk 审批链路处理。"
                        .to_string(),
                capabilities: self.capabilities(),
            },
            Err(message) => AgentExecutorStatus {
                contract_version: AGENT_EXECUTOR_CONTRACT_VERSION.to_string(),
                id: self.id().to_string(),
                protocol: "codex-jsonl".to_string(),
                status: "unavailable".to_string(),
                version: String::new(),
                message,
                capabilities: self.capabilities(),
            },
        }
    }

    fn prepare(&self, _provider: &ProviderConfig) -> Result<(), String> {
        probe().map(|_| ())
    }

    fn execute(&self, request: AgentExecutionRequest) -> Result<AgentExecutionResult, String> {
        if request.purpose != crate::runtime::agent_executor::AgentExecutionPurpose::ReadonlyPlan {
            return Err("Codex CLI 当前只接入只读规划，不能直接修改文件或运行检查。".to_string());
        }
        if request.mode != crate::runtime::agent_executor::AgentExecutionMode::Start {
            return Err(
                "Codex CLI 的已中断规划不能伪装为续传；请从已保存的计划阶段重新开始。".to_string(),
            );
        }
        probe()?;
        let mut child = Command::new("codex")
            .args(["exec", "--json", "--ephemeral", "--sandbox", "read-only", "--skip-git-repo-check", "--color", "never", "-C"])
            .arg(&request.root)
            .arg(format!(
                "{}\n\nReturn exactly one JSON object in this envelope: {{\"type\":\"final\",\"result\":<the plan matching the required shape>}}. Do not use markdown fences or add commentary.",
                request.prompt
            ))
            .stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped())
            .spawn()
            .map_err(|error| format!("启动 Codex CLI 失败：{error}"))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Codex CLI stdout 不可用".to_string())?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "Codex CLI stderr 不可用".to_string())?;
        let (tx, rx) = mpsc::channel();
        std::thread::spawn(move || {
            for line in BufReader::new(stdout).lines() {
                if tx.send(line).is_err() {
                    break;
                }
            }
        });
        let (stderr_tx, stderr_rx) = mpsc::channel();
        std::thread::spawn(move || {
            let mut text = String::new();
            let _ = BufReader::new(stderr).take(4096).read_to_string(&mut text);
            let _ = stderr_tx.send(text);
        });

        let mut events = Vec::new();
        let mut final_text = String::new();
        let mut final_usage = ProviderUsage::default();
        public_event(
            &mut events,
            &request,
            "lifecycle",
            "model",
            "running",
            "Codex 开始只读分析项目。",
            json!({ "mode": "read-only" }),
        );
        loop {
            if request
                .cancellation
                .as_ref()
                .is_some_and(|token| token.is_cancelled())
            {
                let _ = child.kill();
                terminal(
                    &mut events,
                    &request,
                    "cancelled",
                    "已停止 Codex 只读规划。",
                );
                return Err("请求已取消".to_string());
            }
            match rx.recv_timeout(Duration::from_millis(100)) {
                Ok(Ok(line)) => {
                    let Ok(value) = serde_json::from_str::<Value>(&line) else {
                        continue;
                    };
                    match value.get("type").and_then(Value::as_str) {
                        Some("item.started") => {
                            if let Some((phase, summary)) = value.get("item").and_then(item_event) {
                                public_event(
                                    &mut events,
                                    &request,
                                    "tool-call",
                                    phase,
                                    "running",
                                    summary,
                                    json!({ "itemType": value.pointer("/item/type").and_then(Value::as_str) }),
                                );
                            }
                        }
                        Some("item.completed") => {
                            let item = value.get("item").unwrap_or(&Value::Null);
                            if item.get("type").and_then(Value::as_str) == Some("agent_message") {
                                final_text = item
                                    .get("text")
                                    .and_then(Value::as_str)
                                    .unwrap_or_default()
                                    .to_string();
                            } else if let Some((phase, _)) = item_event(item) {
                                public_event(
                                    &mut events,
                                    &request,
                                    "tool-result",
                                    phase,
                                    "succeeded",
                                    "已完成只读项目读取。",
                                    json!({ "itemType": item.get("type").and_then(Value::as_str) }),
                                );
                            }
                        }
                        Some("turn.completed") => {
                            final_usage = usage(&value);
                        }
                        _ => {}
                    }
                }
                Ok(Err(error)) => {
                    terminal(
                        &mut events,
                        &request,
                        "failed",
                        "Codex 只读规划的事件流中断。",
                    );
                    return Err(format!("读取 Codex CLI 输出失败：{error}"));
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {
                    let exited = match child.try_wait() {
                        Ok(value) => value.is_some(),
                        Err(error) => {
                            terminal(
                                &mut events,
                                &request,
                                "failed",
                                "Codex 只读规划的进程状态不可用。",
                            );
                            return Err(format!("读取 Codex CLI 进程状态失败：{error}"));
                        }
                    };
                    if exited {
                        break;
                    }
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }
        let status = match child.wait() {
            Ok(status) => status,
            Err(error) => {
                terminal(
                    &mut events,
                    &request,
                    "failed",
                    "等待 Codex 只读规划结束时发生错误。",
                );
                return Err(format!("等待 Codex CLI 结束失败：{error}"));
            }
        };
        if !status.success() {
            let _ = stderr_rx.recv_timeout(Duration::from_millis(100));
            terminal(&mut events, &request, "failed", "Codex 只读规划未完成。");
            return Err("Codex CLI 未能完成只读规划。请检查 Codex 登录状态后重试。".to_string());
        }
        let payload = match crate::runtime::acp_protocol::extract_structured_envelope(&final_text)
            .and_then(|envelope| {
                envelope
                    .get("result")
                    .cloned()
                    .ok_or_else(|| "Codex 未返回计划结果".to_string())
            }) {
            Ok(payload) => payload,
            Err(error) => {
                terminal(
                    &mut events,
                    &request,
                    "failed",
                    "Codex 返回的计划格式不完整。",
                );
                return Err(error);
            }
        };
        terminal(&mut events, &request, "succeeded", "Codex 已生成只读计划。");
        Ok(AgentExecutionResult {
            status: "succeeded".to_string(),
            summary: "Codex 已生成只读计划。".to_string(),
            step: events.len(),
            result: Some(payload),
            approval: None,
            interaction: None,
            events,
            observations: vec![],
            trace: vec!["CODEX_CLI: JSONL read-only planning".to_string()],
            usage: final_usage,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn codex_cli_declares_only_its_verified_readonly_capabilities() {
        let capabilities = CODEX_CLI_EXECUTOR.capabilities();
        assert_eq!(CODEX_CLI_EXECUTOR.id(), "codex-cli");
        assert_eq!(capabilities.protocol, "codex-jsonl");
        assert!(!capabilities.structured_tools);
        assert_eq!(
            serde_json::to_value(capabilities).unwrap()["extensions"]["readOnlyPlanning"],
            true
        );
    }

    #[test]
    fn codex_usage_uses_the_cli_turn_completed_shape() {
        let result = usage(&json!({ "usage": { "input_tokens": 12, "output_tokens": 3 } }));
        assert_eq!(result.total_tokens, 15);
        assert_eq!(result.source, "codex-cli");
    }

    #[test]
    fn codex_final_message_uses_the_runtime_plan_envelope() {
        let payload = crate::runtime::acp_protocol::extract_structured_envelope(
            r#"{"type":"final","result":{"summary":"已完成只读计划"}}"#,
        )
        .unwrap();
        assert_eq!(payload["result"]["summary"], "已完成只读计划");
    }
}
