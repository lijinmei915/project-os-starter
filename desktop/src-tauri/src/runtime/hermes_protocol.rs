use serde::Serialize;
use serde_json::{json, Value};
use std::io::Write;
use std::path::PathBuf;
use std::process::Command;
use std::sync::mpsc;
use std::time::{Duration, Instant};
use tokio_util::sync::CancellationToken;

pub const ACP_MAX_LINE_BYTES: usize = 1024 * 1024;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExecutorStatus {
    pub id: String,
    pub protocol: String,
    pub status: String,
    pub version: String,
    pub message: String,
}

pub fn acp_program() -> Option<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(home) = std::env::var("HOME") {
        candidates.push(PathBuf::from(home).join(".local/bin/hermes-acp"));
    }
    candidates.push(PathBuf::from("hermes-acp"));
    candidates
        .into_iter()
        .find(|candidate| candidate.components().count() == 1 || candidate.is_file())
}

pub fn executor_status() -> ExecutorStatus {
    for program in candidate_programs("hermes-acp") {
        match Command::new(&program).arg("--check").output() {
            Ok(output) if output.status.success() => {
                let version = Command::new(&program)
                    .arg("--version")
                    .output()
                    .ok()
                    .map(|output| process_output(&output))
                    .unwrap_or_default();
                return ExecutorStatus {
                    id: "hermes".to_string(),
                    protocol: "acp".to_string(),
                    status: "ready".to_string(),
                    version,
                    message: "Hermes ACP 通道检查通过；模型凭据仍需通过实际请求验证。".to_string(),
                };
            }
            Ok(output) => {
                return ExecutorStatus {
                    id: "hermes".to_string(),
                    protocol: "acp".to_string(),
                    status: "unavailable".to_string(),
                    version: String::new(),
                    message: format!(
                        "检测到 Hermes ACP，但健康检查未通过：{}",
                        process_output(&output)
                    ),
                };
            }
            Err(_) => continue,
        }
    }
    for program in candidate_programs("hermes") {
        if let Ok(output) = Command::new(&program).arg("--version").output() {
            return ExecutorStatus {
                id: "hermes".to_string(),
                protocol: "cli".to_string(),
                status: "cli-only".to_string(),
                version: process_output(&output),
                message: "已检测到 Hermes CLI；ACP 健康检查通过前不能接入受控执行。".to_string(),
            };
        }
    }
    ExecutorStatus {
        id: "hermes".to_string(),
        protocol: "acp".to_string(),
        status: "not-installed".to_string(),
        version: String::new(),
        message: "未检测到 Hermes。安装并完成模型配置后，OmniDesk 才能将它作为可选执行器使用。"
            .to_string(),
    }
}

fn candidate_programs(program: &str) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(home) = std::env::var("HOME") {
        paths.push(PathBuf::from(home).join(".local/bin").join(program));
    }
    paths.push(PathBuf::from(program));
    paths
}

fn process_output(output: &std::process::Output) -> String {
    let text = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    let trimmed = text.trim();
    let mut result = trimmed.chars().take(6_000).collect::<String>();
    if trimmed.chars().count() > 6_000 {
        result.push_str("\n...output trimmed...");
    }
    result
}

/// Hermes reads the OpenAI aliases first, but several compatible providers
/// require their own conventional key variable. Never return aliases that
/// Hermes already configures explicitly.
pub fn custom_provider_key_env(api_base: &str) -> Option<String> {
    let authority = api_base
        .trim()
        .split_once("://")
        .map(|(_, value)| value)
        .unwrap_or(api_base)
        .split('/')
        .next()
        .unwrap_or("")
        .split('@')
        .last()
        .unwrap_or("")
        .split(':')
        .next()
        .unwrap_or("");
    let mut labels = authority
        .split('.')
        .filter(|label| !label.is_empty())
        .collect::<Vec<_>>();
    while matches!(labels.first(), Some(&"api" | &"www")) {
        labels.remove(0);
    }
    let vendor = *labels.get(labels.len().checked_sub(2)?)?;
    let normalized = vendor
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() {
                ch.to_ascii_uppercase()
            } else {
                '_'
            }
        })
        .collect::<String>();
    if normalized.is_empty()
        || !normalized.starts_with(|ch: char| ch.is_ascii_alphabetic())
        || matches!(normalized.as_str(), "OPENAI" | "OPENROUTER" | "OLLAMA")
    {
        return None;
    }
    Some(format!("{}_API_KEY", normalized))
}

pub fn write_request(
    stdin: &mut impl Write,
    id: u64,
    method: &str,
    params: Value,
) -> Result<(), String> {
    let message = json!({ "jsonrpc": "2.0", "id": id, "method": method, "params": params });
    serde_json::to_writer(&mut *stdin, &message).map_err(|err| err.to_string())?;
    stdin.write_all(b"\n").map_err(|err| err.to_string())?;
    stdin.flush().map_err(|err| err.to_string())
}

pub fn rejection_response(id: u64) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "result": { "outcome": { "outcome": "cancelled" } }
    })
}

pub fn wait_for_response(
    receiver: &mpsc::Receiver<Result<String, String>>,
    stdin: &mut impl Write,
    expected_id: u64,
    deadline: Instant,
    agent_text: &mut String,
    cancellation: Option<&CancellationToken>,
) -> Result<Value, String> {
    loop {
        if cancellation.is_some_and(CancellationToken::is_cancelled) {
            return Err("请求已取消".to_string());
        }
        let remaining = deadline
            .checked_duration_since(Instant::now())
            .ok_or_else(|| "Hermes ACP 请求超时".to_string())?;
        let line = match receiver.recv_timeout(remaining.min(Duration::from_millis(200))) {
            Ok(line) => line?,
            Err(mpsc::RecvTimeoutError::Timeout) => continue,
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                return Err("Hermes ACP 请求超时或连接已关闭".to_string())
            }
        };
        if line.len() > ACP_MAX_LINE_BYTES {
            return Err("Hermes ACP 返回行超出安全上限".to_string());
        }
        let message: Value = serde_json::from_str(&line)
            .map_err(|err| format!("Hermes ACP 返回无效 JSON-RPC: {err}"))?;
        if let Some(id) = message.get("id").and_then(Value::as_u64) {
            if message.get("method").is_some() {
                write_response(stdin, rejection_response(id))?;
                continue;
            }
            if id == expected_id {
                if let Some(error) = message.get("error") {
                    return Err(format!(
                        "Hermes ACP RPC 错误: {}",
                        trim_for_trace(&error.to_string())
                    ));
                }
                return Ok(message);
            }
        }
        if message.get("method").and_then(Value::as_str) == Some("session/update") {
            if let Some(text) = message
                .pointer("/params/update/content/text")
                .and_then(Value::as_str)
            {
                agent_text.push_str(text);
            }
        }
    }
}

pub fn extract_structured_envelope(output: &str) -> Result<Value, String> {
    let normalized = output.replace("```json", "").replace("```", "");
    let start = normalized
        .find('{')
        .ok_or_else(|| "Hermes 未返回结构化 JSON envelope".to_string())?;
    let end = normalized
        .rfind('}')
        .ok_or_else(|| "Hermes JSON envelope 不完整".to_string())?;
    serde_json::from_str::<Value>(&normalized[start..=end])
        .map_err(|err| format!("Hermes envelope JSON 解析失败: {err}"))
}

fn write_response(stdin: &mut impl Write, message: Value) -> Result<(), String> {
    serde_json::to_writer(&mut *stdin, &message).map_err(|err| err.to_string())?;
    stdin.write_all(b"\n").map_err(|err| err.to_string())?;
    stdin.flush().map_err(|err| err.to_string())
}

fn trim_for_trace(value: &str) -> String {
    let mut output = value.replace('\0', " ");
    if output.len() > 800 {
        output.truncate(800);
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn custom_key_env_uses_the_provider_vendor_without_openai_aliases() {
        assert_eq!(
            custom_provider_key_env("https://aihub.firstshare.cn/v1"),
            Some("FIRSTSHARE_API_KEY".to_string())
        );
        assert_eq!(custom_provider_key_env("https://api.openai.com/v1"), None);
    }

    #[test]
    fn extracts_only_a_complete_json_envelope() {
        assert_eq!(
            extract_structured_envelope("```json\n{\"type\":\"final\"}\n```").unwrap()["type"],
            "final"
        );
        assert!(extract_structured_envelope("not json").is_err());
    }
}
