use serde_json::Value;

#[derive(Debug, Clone, Default, Eq, PartialEq)]
pub struct ToolCallFragment {
    pub index: usize,
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Clone, Default, Eq, PartialEq)]
pub struct StreamDelta {
    pub content: Vec<String>,
    pub tool_call_fragments: Vec<ToolCallFragment>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub struct ProviderCoreError {
    pub message: String,
    pub partial_reply: String,
}

impl ProviderCoreError {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            partial_reply: String::new(),
        }
    }

    pub fn with_partial(message: impl Into<String>, partial_reply: &str) -> Self {
        Self {
            message: message.into(),
            partial_reply: partial_reply.trim().to_string(),
        }
    }
}

impl From<String> for ProviderCoreError {
    fn from(message: String) -> Self {
        Self::new(message)
    }
}

pub fn chat_completions_endpoint(api_base: &str) -> String {
    let base = api_base.trim_end_matches('/');
    if base.ends_with("/chat/completions") {
        base.to_string()
    } else {
        format!("{base}/chat/completions")
    }
}

pub fn models_endpoint(api_base: &str) -> String {
    let base = api_base.trim_end_matches('/');
    if base.ends_with("/models") {
        base.to_string()
    } else if base.ends_with("/chat/completions") {
        format!("{}/models", base.trim_end_matches("/chat/completions"))
    } else {
        format!("{base}/models")
    }
}

pub fn classify_failure(message: &str) -> &'static str {
    let text = message.to_lowercase();
    if text.contains("insufficient_user_quota")
        || text.contains("quota insufficient")
        || text.contains("subscription quota")
        || text.contains("额度不足")
        || text.contains("订阅额度")
    {
        "quota-exhausted"
    } else if text.contains("http 401")
        || text.contains("http 403")
        || text.contains("invalid api key")
        || text.contains("invalid token")
        || text.contains("unauthorized")
        || text.contains("认证失败")
    {
        "authentication-failed"
    } else if text.contains("model_not_found")
        || text.contains("model not found")
        || text.contains("unknown model")
        || text.contains("模型不存在")
        || text.contains("模型不可用")
    {
        "model-unavailable"
    } else if text.contains("timed out")
        || text.contains("timeout")
        || text.contains("超时")
        || text.contains("connection")
        || text.contains("dns")
        || text.contains("网络")
        || text.contains("连接")
    {
        "network-unavailable"
    } else {
        "unavailable"
    }
}

pub fn should_retry(error: &ProviderCoreError, retry_count: usize) -> bool {
    retry_count == 0
        && error.partial_reply.is_empty()
        && classify_failure(&error.message) == "network-unavailable"
}

/// Consumes complete OpenAI-compatible SSE lines and keeps an unfinished line
/// in `pending` for the next transport chunk.
pub fn consume_openai_sse(pending: &mut String, chunk: &str) -> StreamDelta {
    pending.push_str(chunk);
    let mut output = StreamDelta::default();
    while let Some(index) = pending.find('\n') {
        let line = pending[..index].trim().to_string();
        pending.drain(..=index);
        let Some(data) = line.strip_prefix("data:") else {
            continue;
        };
        let data = data.trim();
        if data == "[DONE]" {
            continue;
        }
        let event: Value = match serde_json::from_str(data) {
            Ok(event) => event,
            Err(_) => continue,
        };
        if let Some(delta) = event
            .pointer("/choices/0/delta/content")
            .and_then(Value::as_str)
            .filter(|value| !value.is_empty())
        {
            output.content.push(delta.to_string());
        }
        let Some(calls) = event
            .pointer("/choices/0/delta/tool_calls")
            .and_then(Value::as_array)
        else {
            continue;
        };
        for call in calls {
            let Some(index) = call.get("index").and_then(Value::as_u64) else {
                continue;
            };
            output.tool_call_fragments.push(ToolCallFragment {
                index: index as usize,
                name: call
                    .pointer("/function/name")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string(),
                arguments: call
                    .pointer("/function/arguments")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string(),
            });
        }
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_endpoints_without_product_state() {
        assert_eq!(
            chat_completions_endpoint("https://api.example.test/v1"),
            "https://api.example.test/v1/chat/completions"
        );
        assert_eq!(
            models_endpoint("https://api.example.test/v1/chat/completions"),
            "https://api.example.test/v1/models"
        );
    }

    #[test]
    fn preserves_split_sse_and_extracts_generic_tool_calls() {
        let mut pending = String::new();
        assert!(consume_openai_sse(
            &mut pending,
            "data: {\"choices\":[{\"delta\":{\"content\":\"hel"
        )
        .content
        .is_empty());
        let output = consume_openai_sse(
            &mut pending,
            "lo\"}}]}\n\ndata: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"function\":{\"name\":\"lookup\",\"arguments\":\"{}\"}}]}}]}\n\ndata: [DONE]\n\n",
        );
        assert_eq!(output.content, vec!["hello"]);
        assert_eq!(output.tool_call_fragments[0].name, "lookup");
        assert_eq!(output.tool_call_fragments[0].arguments, "{}");
        assert!(pending.is_empty());
    }

    #[test]
    fn retries_only_first_network_failure_without_partial_output() {
        assert!(should_retry(&ProviderCoreError::new("connection reset"), 0));
        assert!(!should_retry(&ProviderCoreError::new("connection reset"), 1));
        assert!(!should_retry(
            &ProviderCoreError::with_partial("connection reset", "partial"),
            0
        ));
        assert!(!should_retry(
            &ProviderCoreError::new("provider HTTP 401: invalid token"),
            0
        ));
    }
}
