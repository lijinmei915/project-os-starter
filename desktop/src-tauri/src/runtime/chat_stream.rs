use serde_json::Value;

/// Consumes complete SSE lines only, preserving unfinished transport chunks
/// for the next read so a split Provider JSON envelope cannot be corrupted.
pub fn consume_openai_sse_deltas(pending: &mut String, chunk: &str) -> Vec<String> {
    pending.push_str(chunk);
    let mut deltas = Vec::new();
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
        let delta = event
            .pointer("/choices/0/delta/content")
            .and_then(Value::as_str)
            .unwrap_or("");
        if !delta.is_empty() {
            deltas.push(delta.to_string());
        }
    }
    deltas
}

/// Extracts a visible reply from an incomplete model JSON envelope. The final
/// response still has to pass strict JSON parsing before it becomes a result.
pub fn streaming_reply_prefix(content: &str) -> String {
    let Some(key_index) = content.find("\"reply\"") else {
        return String::new();
    };
    let Some((_, value)) = content[key_index + "\"reply\"".len()..].split_once(':') else {
        return String::new();
    };
    let Some(value) = value.trim_start().strip_prefix('"') else {
        return String::new();
    };

    let mut reply = String::new();
    let mut escaped = false;
    for character in value.chars() {
        if escaped {
            match character {
                'n' => reply.push('\n'),
                'r' => reply.push('\r'),
                't' => reply.push('\t'),
                '"' => reply.push('"'),
                '\\' => reply.push('\\'),
                other => reply.push(other),
            }
            escaped = false;
        } else if character == '\\' {
            escaped = true;
        } else if character == '"' {
            break;
        } else {
            reply.push(character);
        }
    }
    reply
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn handles_transport_splits_and_completion_markers() {
        let mut pending = String::new();
        assert!(consume_openai_sse_deltas(
            &mut pending,
            "data: {\"choices\":[{\"delta\":{\"content\":\"hel"
        )
        .is_empty());
        assert_eq!(
            consume_openai_sse_deltas(&mut pending, "lo\"}}]}\n\ndata: {\"choices\":[{\"delta\":{\"content\":\" world\"}}]}\n\ndata: [DONE]\n\n"),
            vec!["hello".to_string(), " world".to_string()]
        );
        assert!(pending.is_empty());
    }

    #[test]
    fn extracts_a_partial_reply_without_accepting_the_envelope() {
        assert_eq!(streaming_reply_prefix(r#"{"reply": "正在生成"#), "正在生成");
        assert_eq!(
            streaming_reply_prefix(r#"{"reply": "第一行\n第二行", "intent": "chat"}"#),
            "第一行\n第二行"
        );
        assert_eq!(streaming_reply_prefix(r#"{"intent": "chat"}"#), "");
    }
}
