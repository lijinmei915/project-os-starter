use crate::runtime::chat_content::{
    chat_reply_prompt, ChatTurnInput, ChatWithModelResult, DialogueContextInput,
};
use crate::runtime::chat_routing::{is_question_like_message, should_create_plan_for_message};
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

    let reply_prompt = chat_reply_prompt(
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
    let user_content = provider_user_content(reply_prompt, attachments);
    let response = post_chat_completion(
        provider,
        &api_key,
        &json!({
            "model": provider.model,
            "messages": [
                {
                    "role": "system",
                    "content": "You are OmniDesk, a local AI project workbench assistant. Answer the user directly in natural Chinese text. Do not wrap the answer in JSON or include routing metadata."
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
        let mut stream_mode = StreamMode::Unknown;
        let mut stream = response.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|err| err.to_string())?;
            let chunk = String::from_utf8_lossy(&chunk);
            for delta in consume_openai_sse_deltas(&mut pending, &chunk) {
                content.push_str(&delta);
                match stream_mode {
                    StreamMode::Unknown => {
                        let trimmed = content.trim_start();
                        if trimmed.is_empty() {
                            continue;
                        }
                        if trimmed.starts_with('{') {
                            stream_mode = StreamMode::LegacyCandidate;
                        } else {
                            stream_mode = StreamMode::Text;
                            on_delta(content.clone(), content.chars().count());
                        }
                    }
                    StreamMode::Text => on_delta(delta.clone(), delta.chars().count()),
                    StreamMode::LegacyCandidate => {}
                }
            }
        }
        if content.trim().is_empty() {
            return Err("provider 流式返回空内容".to_string());
        }
        if stream_mode == StreamMode::LegacyCandidate {
            let visible = visible_chat_content(&content)?.0;
            on_delta(visible.clone(), visible.chars().count());
        }
        content
    };
    build_chat_result(&content, message, !attachments.is_empty())
}

#[derive(Clone, Copy, Eq, PartialEq)]
enum StreamMode {
    Unknown,
    Text,
    LegacyCandidate,
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

fn visible_chat_content(content: &str) -> Result<(String, &'static str), String> {
    let trimmed = content.trim();
    if trimmed.is_empty() {
        return Err("provider 返回空内容".to_string());
    }
    if let Ok(envelope) = serde_json::from_str::<Value>(trimmed) {
        if let Some(reply) = envelope.get("reply").and_then(Value::as_str) {
            let reply = reply.trim();
            if !reply.is_empty() {
                return Ok((reply.to_string(), "legacy-json"));
            }
        }
    }
    Ok((trimmed.to_string(), "text"))
}

fn build_chat_result(
    content: &str,
    message: &str,
    has_attachments: bool,
) -> Result<ChatWithModelResult, String> {
    let (reply, response_mode) = visible_chat_content(content)?;
    let should_create_plan = should_create_plan_for_message(message, has_attachments);
    Ok(ChatWithModelResult {
        reply,
        should_create_plan,
        intent: if should_create_plan {
            "task"
        } else if is_question_like_message(message) {
            "question"
        } else {
            "chat"
        }
        .to_string(),
        provider_status: String::new(),
        provider_model: String::new(),
        provider_error: String::new(),
        response_mode: response_mode.to_string(),
        references: Vec::new(),
    })
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read as _, Write as _};
    use std::net::TcpListener;
    use std::time::{SystemTime, UNIX_EPOCH};

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
    fn accepts_natural_text_without_json_parsing() {
        let result = build_chat_result("这是自然文本回答。", "这是什么", false).unwrap();
        assert_eq!(result.reply, "这是自然文本回答。");
        assert_eq!(result.intent, "question");
        assert!(!result.should_create_plan);
        assert_eq!(result.response_mode, "text");
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
    fn keeps_legacy_json_as_a_traced_compatibility_input() {
        let result = build_chat_result(
            r#"{"reply":"兼容回答","shouldCreatePlan":false,"intent":"chat"}"#,
            "帮我修复这个问题",
            false,
        )
        .unwrap();
        assert_eq!(result.reply, "兼容回答");
        assert_eq!(result.intent, "task");
        assert!(result.should_create_plan);
        assert_eq!(result.response_mode, "legacy-json");
        assert!(build_chat_result("   ", "你好", false).is_err());
    }

    #[tokio::test]
    async fn streams_natural_text_from_the_provider_without_a_json_contract() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = Vec::new();
            let mut buffer = [0_u8; 8192];
            loop {
                let count = stream.read(&mut buffer).unwrap();
                if count == 0 {
                    break;
                }
                request.extend_from_slice(&buffer[..count]);
                let Some(header_end) = request.windows(4).position(|bytes| bytes == b"\r\n\r\n")
                else {
                    continue;
                };
                let headers = String::from_utf8_lossy(&request[..header_end]);
                let content_length = headers
                    .lines()
                    .find_map(|line| {
                        line.to_ascii_lowercase()
                            .strip_prefix("content-length:")
                            .and_then(|value| value.trim().parse::<usize>().ok())
                    })
                    .unwrap_or(0);
                if request.len() >= header_end + 4 + content_length {
                    break;
                }
            }
            let request = String::from_utf8_lossy(&request).to_string();
            let body = concat!(
                "data: {\"choices\":[{\"delta\":{\"content\":\"自然\"}}]}\n\n",
                "data: {\"choices\":[{\"delta\":{\"content\":\"文本\"}}]}\n\n",
                "data: [DONE]\n\n"
            );
            write!(
                stream,
                "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(),
                body
            )
            .unwrap();
            request
        });
        let root = std::env::temp_dir().join(format!(
            "omnidesk-chat-stream-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(root.join(".env.local"), "OMNIDESK_CHAT_TEST_KEY=test-key\n").unwrap();
        let provider = ProviderConfig {
            schema_version: "omnidesk.desktop-provider.v0.1".to_string(),
            provider: "openai-compatible".to_string(),
            model: "test-model".to_string(),
            api_base: format!("http://{address}/v1"),
            api_key_env: "OMNIDESK_CHAT_TEST_KEY".to_string(),
            enabled: true,
            active_profile_id: String::new(),
            profiles: Vec::new(),
        };
        let mut deltas = Vec::new();
        let result = generate_provider_chat(
            &provider,
            &root,
            "OmniDesk",
            "stabilizing",
            "这是什么",
            &[],
            &[],
            &DialogueContextInput::default(),
            &json!({}),
            &[],
            &json!({}),
            |text, _| deltas.push(text),
        )
        .await
        .unwrap();
        let request = server.join().unwrap();
        assert_eq!(result.reply, "自然文本");
        assert_eq!(result.response_mode, "text");
        assert_eq!(deltas.concat(), "自然文本");
        assert!(request.contains("natural Chinese text"));
        assert!(!request.contains("Return only strict JSON"));
        assert!(!request.contains("shouldCreatePlan"));
        std::fs::remove_dir_all(root).unwrap();
    }
}
