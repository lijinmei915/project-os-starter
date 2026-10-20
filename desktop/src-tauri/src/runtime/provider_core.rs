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
    pub done: bool,
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

/// A transport chunk can end inside a Unicode scalar. Keep only that unfinished
/// suffix instead of replacing its bytes before the next chunk arrives.
#[derive(Default)]
pub struct Utf8StreamDecoder {
    pending: Vec<u8>,
}

impl Utf8StreamDecoder {
    pub fn push(&mut self, chunk: &[u8]) -> Result<String, &'static str> {
        self.pending.extend_from_slice(chunk);
        let valid_len = match std::str::from_utf8(&self.pending) {
            Ok(_) => self.pending.len(),
            Err(error) if error.error_len().is_none() => error.valid_up_to(),
            Err(_) => return Err("模型流式响应包含无效的 UTF-8 字符"),
        };
        let decoded = std::str::from_utf8(&self.pending[..valid_len])
            .expect("UTF-8 validated prefix")
            .to_string();
        self.pending.drain(..valid_len);
        Ok(decoded)
    }

    pub fn finish(self) -> Result<(), &'static str> {
        if self.pending.is_empty() {
            Ok(())
        } else {
            Err("模型流式响应在 UTF-8 字符中间中断")
        }
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
        || text.contains("error sending request")
        || text.contains("tcp connect error")
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
            output.done = true;
            continue;
        }
        let event: Value = match serde_json::from_str(data) {
            Ok(event) => event,
            Err(_) => continue,
        };
        if event
            .pointer("/choices/0/finish_reason")
            .and_then(Value::as_str)
            .is_some()
        {
            output.done = true;
        }
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
    fn utf8_decoder_preserves_every_split_and_single_byte_delivery() {
        let text = "data: 中文🙂\"é\"\r\n\n�";
        let bytes = text.as_bytes();
        for split in 0..=bytes.len() {
            let mut decoder = Utf8StreamDecoder::default();
            let mut decoded = decoder.push(&bytes[..split]).unwrap();
            assert!(decoder.pending.len() <= 3);
            decoded.push_str(&decoder.push(&bytes[split..]).unwrap());
            decoder.finish().unwrap();
            assert_eq!(decoded, text, "byte split {split}");
        }
        let mut decoder = Utf8StreamDecoder::default();
        let mut decoded = String::new();
        for byte in bytes {
            decoded.push_str(&decoder.push(&[*byte]).unwrap());
            assert!(decoder.pending.len() <= 3);
        }
        decoder.finish().unwrap();
        assert_eq!(decoded, text);
    }

    #[test]
    fn utf8_decoder_rejects_invalid_and_unfinished_characters() {
        for invalid in [&[0xff][..], &[0xc0, 0xaf], &[0xed, 0xa0, 0x80]] {
            assert!(Utf8StreamDecoder::default().push(invalid).is_err());
        }
        let mut decoder = Utf8StreamDecoder::default();
        assert_eq!(decoder.push(&"中".as_bytes()[..1]).unwrap(), "");
        assert!(decoder.finish().is_err());
    }

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
        assert!(output.done);
        assert!(pending.is_empty());
    }

    #[test]
    fn retries_only_first_network_failure_without_partial_output() {
        assert!(should_retry(&ProviderCoreError::new("connection reset"), 0));
        assert!(!should_retry(
            &ProviderCoreError::new("connection reset"),
            1
        ));
        assert!(!should_retry(
            &ProviderCoreError::with_partial("connection reset", "partial"),
            0
        ));
        assert!(!should_retry(
            &ProviderCoreError::new("provider HTTP 401: invalid token"),
            0
        ));
        assert!(should_retry(
            &ProviderCoreError::new(
                "error sending request for url (http://127.0.0.1:49152/v1/chat/completions)"
            ),
            0
        ));
    }
}
