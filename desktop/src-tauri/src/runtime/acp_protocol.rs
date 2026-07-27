use serde::Serialize;
use serde_json::{json, Value};
use std::io::Write;
use std::sync::mpsc;
use std::time::{Duration, Instant};
use tokio_util::sync::CancellationToken;

pub const ACP_MAX_LINE_BYTES: usize = 1024 * 1024;

#[derive(Debug, Default, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProviderUsage {
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub total_tokens: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cost_usd: Option<f64>,
    pub source: String,
}

impl ProviderUsage {
    pub fn merge(&mut self, other: ProviderUsage) {
        let had_usage = !self.is_empty();
        self.input_tokens = self.input_tokens.saturating_add(other.input_tokens);
        self.output_tokens = self.output_tokens.saturating_add(other.output_tokens);
        self.total_tokens = self.total_tokens.saturating_add(other.total_tokens);
        self.cost_usd = match (had_usage, self.cost_usd, other.cost_usd) {
            (false, _, value) => value,
            (true, Some(left), Some(right)) => Some(left + right),
            (true, _, _) => None,
        };
        if !other.source.is_empty() {
            self.source = other.source;
        }
    }

    pub fn is_empty(&self) -> bool {
        self.input_tokens == 0
            && self.output_tokens == 0
            && self.total_tokens == 0
            && self.cost_usd.is_none()
    }
}

pub fn provider_usage(message: &Value) -> Option<ProviderUsage> {
    let usage = [
        message.pointer("/result/usage"),
        message.pointer("/result/response/usage"),
        message.get("usage"),
    ]
    .into_iter()
    .flatten()
    .find(|value| value.is_object())?;
    let number = |keys: &[&str]| {
        keys.iter()
            .find_map(|key| usage.get(*key).and_then(Value::as_u64))
            .unwrap_or(0)
    };
    let input_tokens = number(&[
        "input_tokens",
        "inputTokens",
        "prompt_tokens",
        "promptTokens",
    ]);
    let output_tokens = number(&[
        "output_tokens",
        "outputTokens",
        "completion_tokens",
        "completionTokens",
    ]);
    let total_tokens =
        number(&["total_tokens", "totalTokens"]).max(input_tokens.saturating_add(output_tokens));
    let cost_usd = ["cost_usd", "costUsd", "total_cost", "totalCost"]
        .into_iter()
        .find_map(|key| usage.get(key).and_then(Value::as_f64));
    let result = ProviderUsage {
        input_tokens,
        output_tokens,
        total_tokens,
        cost_usd,
        source: "acp-response".to_string(),
    };
    (!result.is_empty()).then_some(result)
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
            .ok_or_else(|| "ACP 请求超时".to_string())?;
        let line = match receiver.recv_timeout(remaining.min(Duration::from_millis(200))) {
            Ok(line) => line?,
            Err(mpsc::RecvTimeoutError::Timeout) => continue,
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                return Err("ACP 请求超时或连接已关闭".to_string())
            }
        };
        if line.len() > ACP_MAX_LINE_BYTES {
            return Err("ACP 返回行超出安全上限".to_string());
        }
        let message: Value =
            serde_json::from_str(&line).map_err(|err| format!("ACP 返回无效 JSON-RPC: {err}"))?;
        if let Some(id) = message.get("id").and_then(Value::as_u64) {
            if message.get("method").is_some() {
                write_response(stdin, rejection_response(id))?;
                continue;
            }
            if id == expected_id {
                if let Some(error) = message.get("error") {
                    return Err(format!(
                        "ACP RPC 错误: {}",
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
        .ok_or_else(|| "Agent 未返回结构化 JSON envelope".to_string())?;
    let end = normalized
        .rfind('}')
        .ok_or_else(|| "Agent JSON envelope 不完整".to_string())?;
    serde_json::from_str::<Value>(&normalized[start..=end])
        .map_err(|err| format!("Agent envelope JSON 解析失败: {err}"))
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
    fn extracts_only_a_complete_json_envelope() {
        assert_eq!(
            extract_structured_envelope("```json\n{\"type\":\"final\"}\n```").unwrap()["type"],
            "final"
        );
        assert!(extract_structured_envelope("not json").is_err());
    }

    #[test]
    fn normalizes_provider_usage_without_inventing_missing_cost() {
        let usage = provider_usage(&json!({
            "result": { "usage": { "prompt_tokens": 12, "completion_tokens": 8, "total_tokens": 20 } }
        }))
        .unwrap();
        assert_eq!(usage.input_tokens, 12);
        assert_eq!(usage.output_tokens, 8);
        assert_eq!(usage.total_tokens, 20);
        assert_eq!(usage.cost_usd, None);
        assert!(provider_usage(&json!({ "result": {} })).is_none());
    }

    #[test]
    fn keeps_multi_step_cost_unknown_when_any_provider_response_omits_it() {
        let with_cost = provider_usage(&json!({
            "usage": { "input_tokens": 6, "output_tokens": 4, "total_tokens": 10, "cost_usd": 0.01 }
        }))
        .unwrap();
        let without_cost = provider_usage(&json!({
            "usage": { "input_tokens": 3, "output_tokens": 2, "total_tokens": 5 }
        }))
        .unwrap();

        let mut usage = ProviderUsage::default();
        usage.merge(with_cost.clone());
        usage.merge(without_cost.clone());
        assert_eq!(usage.total_tokens, 15);
        assert_eq!(usage.cost_usd, None);

        let mut reversed = ProviderUsage::default();
        reversed.merge(without_cost);
        reversed.merge(with_cost);
        assert_eq!(reversed.total_tokens, 15);
        assert_eq!(reversed.cost_usd, None);
    }
}
