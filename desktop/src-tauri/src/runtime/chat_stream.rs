use crate::runtime::chat_content::{
    chat_router_prompt, ChatTurnInput, ChatWithModelResult, DialogueContextInput,
};
use crate::runtime::planning::PlanAttachment;
use crate::runtime::provider::{
    chat_completion_content, post_chat_completion, read_secret, require_success, ProviderConfig,
};
use futures_util::StreamExt;
use serde_json::{json, Value};
use std::path::Path;
use std::time::Duration;

pub async fn generate_provider_chat<F>(
    provider: &ProviderConfig,
    root: &Path,
    project_name: &str,
    stage: &str,
    message: &str,
    attachments: &[PlanAttachment],
    recent_turns: &[ChatTurnInput],
    context_state: &DialogueContextInput,
    summary: &Value,
    project_memory: &[Value],
    project_evidence: &Value,
    mut on_delta: F,
) -> Result<ChatWithModelResult, String>
where
    F: FnMut(String, usize),
{
    let api_key = read_secret(root, &provider.api_key_env)
        .ok_or_else(|| format!("环境变量或 .env.local 中未设置 {}", provider.api_key_env))?;
    if api_key.trim().is_empty() {
        return Err(format!("环境变量 {} 为空", provider.api_key_env));
    }

    let router_prompt = chat_router_prompt(
        project_name,
        stage,
        &provider.model,
        message,
        attachments,
        recent_turns,
        context_state,
        summary,
        project_memory,
        project_evidence,
    );
    let user_content = provider_user_content(router_prompt, attachments);
    let response = post_chat_completion(
        provider,
        &api_key,
        &json!({
            "model": provider.model,
            "messages": [
                {
                    "role": "system",
                    "content": "You are OmniDesk, a local AI project workbench assistant. Return only strict JSON with keys reply, shouldCreatePlan, intent. Do not include markdown fences."
                },
                {
                    "role": "user",
                    "content": user_content
                }
            ],
            "temperature": 0.45,
            "stream": true
        }),
        Duration::from_secs(45),
    )
    .await?;
    let response = require_success(response, "provider").await?;

    let is_sse = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.contains("text/event-stream"))
        .unwrap_or(false);
    let content = if !is_sse {
        chat_completion_content(response).await?
    } else {
        let mut content = String::new();
        let mut pending = String::new();
        let mut emitted_reply_chars = 0usize;
        let mut stream = response.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|err| err.to_string())?;
            let chunk = String::from_utf8_lossy(&chunk);
            for delta in consume_openai_sse_deltas(&mut pending, &chunk) {
                content.push_str(&delta);
                let reply = streaming_reply_prefix(&content);
                let reply_delta = reply.chars().skip(emitted_reply_chars).collect::<String>();
                emitted_reply_chars += reply_delta.chars().count();
                on_delta(reply_delta, delta.chars().count());
            }
        }
        if content.trim().is_empty() {
            return Err("provider 流式返回空内容".to_string());
        }
        content
    };
    parse_chat_result(&content)
}

fn provider_user_content(router_prompt: String, attachments: &[PlanAttachment]) -> Value {
    if attachments.is_empty() {
        return Value::String(router_prompt);
    }
    let mut parts = vec![json!({ "type": "text", "text": router_prompt })];
    for attachment in attachments {
        parts.push(json!({
            "type": "image_url",
            "image_url": { "url": attachment.data_url, "detail": "auto" }
        }));
    }
    Value::Array(parts)
}

fn parse_chat_result(content: &str) -> Result<ChatWithModelResult, String> {
    let mut result: ChatWithModelResult =
        serde_json::from_str(content).map_err(|err| format!("chat JSON 解析失败: {}", err))?;
    if result.reply.trim().is_empty() {
        result.reply =
            "我在。你可以直接说想做什么，我会先判断是普通对话还是需要创建计划。".to_string();
    }
    if result.intent.trim().is_empty() {
        result.intent = if result.should_create_plan {
            "task"
        } else {
            "chat"
        }
        .to_string();
    }
    Ok(result)
}

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

    #[test]
    fn builds_multimodal_content_without_exposing_attachment_metadata() {
        let content = provider_user_content(
            "prompt".to_string(),
            &[PlanAttachment {
                name: "screen.png".to_string(),
                data_url: "data:image/png;base64,AAAA".to_string(),
                mime_type: "image/png".to_string(),
            }],
        );
        assert_eq!(
            content.pointer("/0/text").and_then(Value::as_str),
            Some("prompt")
        );
        assert_eq!(
            content.pointer("/1/image_url/url").and_then(Value::as_str),
            Some("data:image/png;base64,AAAA")
        );
        assert!(content.to_string().find("screen.png").is_none());
    }

    #[test]
    fn normalizes_empty_chat_reply_and_intent_after_strict_json_parsing() {
        let result =
            parse_chat_result(r#"{"reply":"","shouldCreatePlan":true,"intent":""}"#).unwrap();
        assert!(!result.reply.is_empty());
        assert_eq!(result.intent, "task");
        assert!(result.should_create_plan);
        assert!(parse_chat_result("not-json").is_err());
    }
}
