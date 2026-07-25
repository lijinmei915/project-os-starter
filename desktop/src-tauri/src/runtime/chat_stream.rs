use crate::runtime::chat_content::{
    chat_reply_prompt, ChatTurnInput, ChatWithModelResult, DialogueContextInput,
};
use crate::runtime::chat_routing::{is_question_like_message, should_create_plan_for_message};
use crate::runtime::planning::PlanAttachment;
use crate::runtime::provider::{
    post_streaming_chat_completion, read_secret, require_success, ProviderConfig,
};
use crate::runtime::provider_tools::{
    add_conversation_tools, engineering_task_from_calls, non_streaming_message,
    record_provider_tool_capability, should_fallback_from_native_tools, tool_call_fragments,
    ProviderToolCall, ProviderToolMode,
};
use futures_util::StreamExt;
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::path::Path;
use std::time::Duration;

const FIRST_RESPONSE_TIMEOUT: Duration = Duration::from_secs(30);
const STREAM_IDLE_TIMEOUT: Duration = Duration::from_secs(45);

#[derive(Debug)]
pub struct ChatStreamError {
    pub message: String,
    pub partial_reply: String,
}

impl ChatStreamError {
    fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            partial_reply: String::new(),
        }
    }

    fn with_partial(message: impl Into<String>, partial_reply: &str) -> Self {
        Self {
            message: message.into(),
            partial_reply: partial_reply.trim().to_string(),
        }
    }
}

impl From<String> for ChatStreamError {
    fn from(message: String) -> Self {
        Self::new(message)
    }
}

pub fn should_retry_provider_chat(error: &ChatStreamError, retry_count: usize) -> bool {
    retry_count == 0
        && error.partial_reply.is_empty()
        && crate::runtime::provider::classify_failure(&error.message) == "network-unavailable"
}

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
) -> Result<ChatWithModelResult, ChatStreamError>
where
    F: FnMut(String, usize),
{
    let api_key = read_secret(root, &provider.api_key_env)
        .ok_or_else(|| format!("环境变量或 .env.local 中未设置 {}", provider.api_key_env))?;
    if api_key.trim().is_empty() {
        return Err(ChatStreamError::new(format!(
            "环境变量 {} 为空",
            provider.api_key_env
        )));
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
    let mut payload = json!({
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
    });
    let compatibility_payload = payload.clone();
    let mut provider_tool_mode = add_conversation_tools(root, provider, &mut payload);
    let response = tokio::time::timeout(
        FIRST_RESPONSE_TIMEOUT,
        post_streaming_chat_completion(provider, &api_key, &payload, FIRST_RESPONSE_TIMEOUT),
    )
    .await
    .map_err(|_| ChatStreamError::new("模型等待首个响应超时"))??;
    let response = match require_success(response, "provider").await {
        Ok(response) => response,
        Err(error)
            if provider_tool_mode == ProviderToolMode::NativeFunctionCalling
                && should_fallback_from_native_tools(&error) =>
        {
            record_provider_tool_capability(
                root,
                provider,
                ProviderToolMode::CompatibilityKeyword,
                "explicit-tool-rejection",
            )?;
            provider_tool_mode = ProviderToolMode::CompatibilityKeyword;
            let fallback = tokio::time::timeout(
                FIRST_RESPONSE_TIMEOUT,
                post_streaming_chat_completion(
                    provider,
                    &api_key,
                    &compatibility_payload,
                    FIRST_RESPONSE_TIMEOUT,
                ),
            )
            .await
            .map_err(|_| ChatStreamError::new("模型等待兼容响应超时"))??;
            require_success(fallback, "provider compatibility fallback").await?
        }
        Err(error) => return Err(ChatStreamError::new(error)),
    };
    if provider_tool_mode == ProviderToolMode::NativeFunctionCalling {
        record_provider_tool_capability(
            root,
            provider,
            ProviderToolMode::NativeFunctionCalling,
            "request-accepted-tools",
        )?;
    }

    let is_sse = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.contains("text/event-stream"))
        .unwrap_or(false);
    let (content, tool_calls) = if !is_sse {
        let response: Value = tokio::time::timeout(STREAM_IDLE_TIMEOUT, response.json())
            .await
            .map_err(|_| ChatStreamError::new("模型响应读取超时"))?
            .map_err(|error| ChatStreamError::new(error.to_string()))?;
        let output = non_streaming_message(&response);
        if output.0.is_empty() && output.1.is_empty() {
            return Err(ChatStreamError::new("provider 返回空内容"));
        }
        output
    } else {
        let mut content = String::new();
        let mut pending = String::new();
        let mut tool_call_parts = BTreeMap::<usize, ProviderToolCall>::new();
        let mut stream_mode = StreamMode::Unknown;
        let mut stream = response.bytes_stream();
        loop {
            let next = tokio::time::timeout(STREAM_IDLE_TIMEOUT, stream.next())
                .await
                .map_err(|_| {
                    ChatStreamError::with_partial("模型流式响应长时间没有新内容", &content)
                })?;
            let Some(chunk) = next else { break };
            let chunk =
                chunk.map_err(|err| ChatStreamError::with_partial(err.to_string(), &content))?;
            let chunk = String::from_utf8_lossy(&chunk);
            let delta = consume_openai_sse_parts(&mut pending, &chunk);
            for fragment in delta.tool_call_fragments {
                let call = tool_call_parts.entry(fragment.index).or_default();
                call.name.push_str(&fragment.name);
                call.arguments.push_str(&fragment.arguments);
            }
            for delta in delta.content {
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
        let tool_calls = tool_call_parts.into_values().collect::<Vec<_>>();
        if content.trim().is_empty() && tool_calls.is_empty() {
            return Err(ChatStreamError::new("provider 流式返回空内容"));
        }
        if stream_mode == StreamMode::LegacyCandidate {
            let visible = visible_chat_content(&content)?.0;
            on_delta(visible.clone(), visible.chars().count());
        }
        (content, tool_calls)
    };
    Ok(build_chat_result(
        &content,
        message,
        !attachments.is_empty(),
        provider_tool_mode,
        &tool_calls,
    )?)
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
    provider_tool_mode: ProviderToolMode,
    tool_calls: &[ProviderToolCall],
) -> Result<ChatWithModelResult, String> {
    let native_task = engineering_task_from_calls(tool_calls)?.is_some();
    let (reply, content_mode) = if content.trim().is_empty() && native_task {
        ("已识别为工程任务，正在准备执行计划。".to_string(), "text")
    } else {
        visible_chat_content(content)?
    };
    let should_create_plan = match provider_tool_mode {
        ProviderToolMode::NativeFunctionCalling => native_task,
        ProviderToolMode::CompatibilityKeyword => {
            should_create_plan_for_message(message, has_attachments)
        }
    };
    let response_mode = match (provider_tool_mode, native_task, content_mode) {
        (_, _, "legacy-json") => "legacy-json",
        (ProviderToolMode::NativeFunctionCalling, true, _) => "native-function-call",
        (ProviderToolMode::NativeFunctionCalling, false, _) => "native-text",
        (ProviderToolMode::CompatibilityKeyword, _, _) => "compatibility-keyword",
    };
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
    consume_openai_sse_parts(pending, chunk).content
}

struct ProviderStreamDelta {
    content: Vec<String>,
    tool_call_fragments: Vec<crate::runtime::provider_tools::ProviderToolCallFragment>,
}

fn consume_openai_sse_parts(pending: &mut String, chunk: &str) -> ProviderStreamDelta {
    pending.push_str(chunk);
    let mut content = Vec::new();
    let mut tools = Vec::new();
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
            content.push(delta.to_string());
        }
        tools.extend(tool_call_fragments(&event));
    }
    ProviderStreamDelta {
        content,
        tool_call_fragments: tools,
    }
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
        let result = build_chat_result(
            "这是自然文本回答。",
            "这是什么",
            false,
            ProviderToolMode::CompatibilityKeyword,
            &[],
        )
        .unwrap();
        assert_eq!(result.reply, "这是自然文本回答。");
        assert_eq!(result.intent, "question");
        assert!(!result.should_create_plan);
        assert_eq!(result.response_mode, "compatibility-keyword");
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
            ProviderToolMode::CompatibilityKeyword,
            &[],
        )
        .unwrap();
        assert_eq!(result.reply, "兼容回答");
        assert_eq!(result.intent, "task");
        assert!(result.should_create_plan);
        assert_eq!(result.response_mode, "legacy-json");
        assert!(build_chat_result(
            "   ",
            "你好",
            false,
            ProviderToolMode::CompatibilityKeyword,
            &[],
        )
        .is_err());
    }

    #[test]
    fn native_function_call_replaces_keyword_task_routing() {
        let result = build_chat_result(
            "",
            "please do it",
            false,
            ProviderToolMode::NativeFunctionCalling,
            &[ProviderToolCall {
                name: "start_engineering_task".to_string(),
                arguments: r#"{"task":"please do it"}"#.to_string(),
            }],
        )
        .unwrap();
        assert!(result.should_create_plan);
        assert_eq!(result.intent, "task");
        assert_eq!(result.response_mode, "native-function-call");

        let question = build_chat_result(
            "这是解释。",
            "帮我解释这个实现",
            false,
            ProviderToolMode::NativeFunctionCalling,
            &[],
        )
        .unwrap();
        assert!(!question.should_create_plan);
        assert_eq!(question.response_mode, "native-text");
    }

    #[test]
    fn native_function_call_requires_valid_structured_arguments() {
        let result = build_chat_result(
            "",
            "please do it",
            false,
            ProviderToolMode::NativeFunctionCalling,
            &[ProviderToolCall {
                name: "start_engineering_task".to_string(),
                arguments: r#"{"task":7}"#.to_string(),
            }],
        );
        assert!(result.is_err());
    }

    #[test]
    fn accumulates_streamed_native_tool_call_fragments_by_index() {
        let mut pending = String::new();
        let first = consume_openai_sse_parts(
            &mut pending,
            "data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"function\":{\"name\":\"start_\"}}]}}]}\n\n",
        );
        let second = consume_openai_sse_parts(
            &mut pending,
            "data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"function\":{\"name\":\"engineering_task\"}}]}}]}\n\n",
        );
        assert_eq!(
            first.tool_call_fragments,
            vec![crate::runtime::provider_tools::ProviderToolCallFragment {
                index: 0,
                name: "start_".to_string(),
                arguments: String::new(),
            }]
        );
        assert_eq!(
            second.tool_call_fragments,
            vec![crate::runtime::provider_tools::ProviderToolCallFragment {
                index: 0,
                name: "engineering_task".to_string(),
                arguments: String::new(),
            }]
        );
    }

    #[test]
    fn preserves_received_text_when_a_stream_is_interrupted() {
        let error = ChatStreamError::with_partial("stream closed", "已经收到的回答");
        assert_eq!(error.message, "stream closed");
        assert_eq!(error.partial_reply, "已经收到的回答");
    }

    #[test]
    fn retries_only_the_first_network_failure_before_any_visible_text() {
        let network = ChatStreamError::new("connection reset");
        assert!(should_retry_provider_chat(&network, 0));
        assert!(!should_retry_provider_chat(&network, 1));
        assert!(!should_retry_provider_chat(
            &ChatStreamError::with_partial("connection reset", "partial"),
            0
        ));
        assert!(!should_retry_provider_chat(
            &ChatStreamError::new("provider HTTP 401: invalid token"),
            0
        ));
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
        assert_eq!(result.response_mode, "native-text");
        assert_eq!(deltas.concat(), "自然文本");
        assert!(request.contains("\"tools\""));
        assert!(request.contains("natural Chinese text"));
        assert!(!request.contains("Return only strict JSON"));
        assert!(!request.contains("shouldCreatePlan"));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[tokio::test]
    async fn persists_an_accepted_native_function_call() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let request = read_http_request(&mut stream);
            let body = concat!(
                "data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"function\":{\"name\":\"start_\"}}]}}]}\n\n",
                "data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"function\":{\"name\":\"engineering_task\",\"arguments\":\"{\\\"task\\\":\\\"修复发送延迟\\\"}\"}}]}}]}\n\n",
                "data: [DONE]\n\n"
            );
            write_sse_response(&mut stream, body);
            request
        });
        let (root, provider) = native_test_provider(address);
        let result = generate_provider_chat(
            &provider,
            &root,
            "OmniDesk",
            "stabilizing",
            "修复发送延迟",
            &[],
            &[],
            &DialogueContextInput::default(),
            &json!({}),
            &[],
            &json!({}),
            |_, _| {},
        )
        .await
        .unwrap();
        let request = server.join().unwrap();
        assert!(request.contains("\"tools\""));
        assert!(result.should_create_plan);
        assert_eq!(result.response_mode, "native-function-call");
        assert_eq!(
            crate::runtime::provider_tools::provider_tool_mode(&root, &provider),
            ProviderToolMode::NativeFunctionCalling
        );
        std::fs::remove_dir_all(root).unwrap();
    }

    #[tokio::test]
    async fn persists_explicit_tool_rejection_and_retries_without_tools_once() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = std::thread::spawn(move || {
            let (mut first, _) = listener.accept().unwrap();
            let first_request = read_http_request(&mut first);
            let error = "{\"error\":{\"message\":\"tools are unsupported\"}}";
            write!(
                first,
                "HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                error.len(),
                error
            )
            .unwrap();

            let (mut second, _) = listener.accept().unwrap();
            let second_request = read_http_request(&mut second);
            let body = concat!(
                "data: {\"choices\":[{\"delta\":{\"content\":\"正在准备\"}}]}\n\n",
                "data: [DONE]\n\n"
            );
            write_sse_response(&mut second, body);
            (first_request, second_request)
        });
        let (root, provider) = native_test_provider(address);
        let result = generate_provider_chat(
            &provider,
            &root,
            "OmniDesk",
            "stabilizing",
            "修复发送延迟",
            &[],
            &[],
            &DialogueContextInput::default(),
            &json!({}),
            &[],
            &json!({}),
            |_, _| {},
        )
        .await
        .unwrap();
        let (first_request, second_request) = server.join().unwrap();
        assert!(first_request.contains("\"tools\""));
        assert!(!second_request.contains("\"tools\""));
        assert_eq!(result.response_mode, "compatibility-keyword");
        assert_eq!(
            crate::runtime::provider_tools::provider_tool_mode(&root, &provider),
            ProviderToolMode::CompatibilityKeyword
        );
        std::fs::remove_dir_all(root).unwrap();
    }

    fn native_test_provider(address: std::net::SocketAddr) -> (std::path::PathBuf, ProviderConfig) {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-native-tool-chat-{}",
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
        (root, provider)
    }

    fn read_http_request(stream: &mut std::net::TcpStream) -> String {
        let mut request = Vec::new();
        let mut buffer = [0_u8; 8192];
        loop {
            let count = stream.read(&mut buffer).unwrap();
            if count == 0 {
                break;
            }
            request.extend_from_slice(&buffer[..count]);
            let Some(header_end) = request.windows(4).position(|bytes| bytes == b"\r\n\r\n") else {
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
        String::from_utf8_lossy(&request).to_string()
    }

    fn write_sse_response(stream: &mut std::net::TcpStream, body: &str) {
        write!(
            stream,
            "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            body.len(),
            body
        )
        .unwrap();
    }
}
