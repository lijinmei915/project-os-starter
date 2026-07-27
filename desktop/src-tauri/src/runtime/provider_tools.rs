use crate::runtime::provider::ProviderConfig;
use crate::runtime::repository::{JsonMutation, Repository};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::Path;

pub const START_ENGINEERING_TASK_TOOL: &str = "start_engineering_task";
pub const RESPOND_TO_USER_TOOL: &str = "respond_to_user";
pub const RESPOND_WITH_RECOMMENDATION_TOOL: &str = "respond_with_recommendation";
const PROVIDER_TOOL_CAPABILITIES_PATH: &str = ".omnidesk/cache/provider-tool-capabilities.json";
const PROVIDER_TOOL_CAPABILITIES_SCHEMA: &str = "omnidesk.provider-tool-capabilities.v0.1";

#[derive(Debug, Clone, Copy, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ProviderToolMode {
    NativeFunctionCalling,
    CompatibilityKeyword,
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderToolCapabilityEntry {
    pub api_base: String,
    pub model: String,
    pub mode: ProviderToolMode,
    pub source: String,
    pub observed_at: String,
}

#[derive(Debug, Clone, Default, Eq, PartialEq)]
pub struct ProviderToolCall {
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Clone, Default, Eq, PartialEq)]
pub struct ProviderToolCallFragment {
    pub index: usize,
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub struct ProviderConversationResponse {
    pub reply: String,
    pub recommended_task: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProviderToolCapabilityCache {
    schema_version: String,
    #[serde(default)]
    entries: Vec<ProviderToolCapabilityEntry>,
}

fn default_provider_tool_mode(_provider: &ProviderConfig) -> ProviderToolMode {
    // The production transport is OpenAI-compatible. Probe native tools first for every
    // unobserved API base/model pair, then persist compatibility mode only after an
    // explicit upstream rejection.
    ProviderToolMode::NativeFunctionCalling
}

pub fn provider_tool_mode(root: &Path, provider: &ProviderConfig) -> ProviderToolMode {
    load_provider_tool_capabilities(root)
        .ok()
        .and_then(|cache| {
            cache
                .entries
                .into_iter()
                .find(|entry| entry.api_base == provider.api_base && entry.model == provider.model)
        })
        .map(|entry| entry.mode)
        .unwrap_or_else(|| default_provider_tool_mode(provider))
}

pub fn record_provider_tool_capability(
    root: &Path,
    provider: &ProviderConfig,
    mode: ProviderToolMode,
    source: &str,
) -> Result<(), String> {
    Repository::new(root).transaction_with("record-provider-tool-capability", |repository| {
        let mut cache = repository
            .read_json(PROVIDER_TOOL_CAPABILITIES_PATH)
            .map(|value| serde_json::from_value(value).map_err(|error| error.to_string()))
            .transpose()?
            .unwrap_or_else(empty_provider_tool_capability_cache);
        cache.schema_version = PROVIDER_TOOL_CAPABILITIES_SCHEMA.to_string();
        let entry = ProviderToolCapabilityEntry {
            api_base: provider.api_base.clone(),
            model: provider.model.clone(),
            mode,
            source: source.trim().to_string(),
            observed_at: crate::runtime::provider::current_unix_timestamp(),
        };
        if let Some(existing) = cache
            .entries
            .iter_mut()
            .find(|item| item.api_base == entry.api_base && item.model == entry.model)
        {
            *existing = entry;
        } else {
            cache.entries.push(entry);
        }
        Ok((
            (),
            vec![JsonMutation::upsert(
                PROVIDER_TOOL_CAPABILITIES_PATH,
                serde_json::to_value(cache).map_err(|error| error.to_string())?,
            )],
        ))
    })
}

fn empty_provider_tool_capability_cache() -> ProviderToolCapabilityCache {
    ProviderToolCapabilityCache {
        schema_version: PROVIDER_TOOL_CAPABILITIES_SCHEMA.to_string(),
        entries: Vec::new(),
    }
}

fn load_provider_tool_capabilities(root: &Path) -> Result<ProviderToolCapabilityCache, String> {
    Repository::new(root)
        .read_json(PROVIDER_TOOL_CAPABILITIES_PATH)
        .map(|value| serde_json::from_value(value).map_err(|error| error.to_string()))
        .transpose()
        .map(|cache| cache.unwrap_or_else(empty_provider_tool_capability_cache))
}

pub fn should_fallback_from_native_tools(error: &str) -> bool {
    let text = error.to_ascii_lowercase();
    (text.contains("http 400") || text.contains("http 422"))
        && (text.contains("tool") || text.contains("function"))
        && (text.contains("unsupported")
            || text.contains("not support")
            || text.contains("unknown")
            || text.contains("unrecognized")
            || text.contains("invalid"))
}

pub fn conversation_tool_definitions() -> Value {
    json!([{
        "type": "function",
        "function": {
            "name": START_ENGINEERING_TASK_TOOL,
            "description": "Use when the user explicitly asks OmniDesk to change, create, fix, configure, run, or otherwise carry out an engineering task. Do not use for questions, explanations, reviews, or status requests.",
            "parameters": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                    "task": { "type": "string", "description": "A concise description of the requested engineering outcome." }
                },
                "required": ["task"]
            }
        }
    }, {
        "type": "function",
        "function": {
            "name": RESPOND_TO_USER_TOOL,
            "description": "Use for every conversational answer that is not an explicit engineering execution request. Put the complete user-visible answer in reply. You MUST set action to start-agent and provide a self-contained task whenever reply selects or recommends one implementation, priority, improvement, or smallest next step. Set action to none and task to an empty string only for pure explanation or multiple unranked alternatives with no selected engineering outcome. Never recommend a concrete next step while returning action=none.",
            "parameters": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                    "reply": { "type": "string", "description": "The complete natural-language answer shown to the user." },
                    "action": { "type": "string", "enum": ["none", "start-agent"], "description": "Whether the answer carries one executable next action." },
                    "task": { "type": "string", "description": "A concise, self-contained engineering outcome when action is start-agent; otherwise an empty string." }
                },
                "required": ["reply", "action", "task"]
            }
        }
    }])
}

fn required_recommendation_tool_definition() -> Value {
    json!({
        "type": "function",
        "function": {
            "name": RESPOND_WITH_RECOMMENDATION_TOOL,
            "description": "Select exactly one self-contained engineering outcome from the completed user-visible answer.",
            "parameters": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                    "task": { "type": "string", "description": "The one concrete, self-contained engineering outcome selected as the next action." }
                },
                "required": ["task"]
            }
        }
    })
}

pub fn recommendation_task_from_calls(
    calls: &[ProviderToolCall],
) -> Result<Option<String>, String> {
    let mut task = None;
    for call in calls {
        let name = call.name.trim();
        if name != RESPOND_WITH_RECOMMENDATION_TOOL {
            return Err(format!("provider 返回了未登记的推荐工具调用：{name}"));
        }
        if task.is_some() {
            return Err("provider 返回了重复的推荐工具调用".to_string());
        }
        let arguments: Value = serde_json::from_str(&call.arguments)
            .map_err(|_| "provider 推荐工具参数不是有效 JSON".to_string())?;
        let arguments = arguments
            .as_object()
            .ok_or_else(|| "provider 推荐工具参数必须是对象".to_string())?;
        if arguments.len() != 1 || !arguments.contains_key("task") {
            return Err("provider 推荐工具参数必须只包含 task".to_string());
        }
        let value = arguments
            .get("task")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| "provider 推荐工具参数 task 必须是非空字符串".to_string())?;
        if value.chars().count() > 1_200 {
            return Err("provider 推荐工具参数 task 超出长度上限".to_string());
        }
        task = Some(value.to_string());
    }
    Ok(task)
}

pub fn add_conversation_tools(
    root: &Path,
    provider: &ProviderConfig,
    payload: &mut Value,
    require_recommendation: bool,
) -> ProviderToolMode {
    let mode = provider_tool_mode(root, provider);
    if mode == ProviderToolMode::NativeFunctionCalling {
        if let Some(object) = payload.as_object_mut() {
            if require_recommendation {
                object.insert(
                    "tools".to_string(),
                    Value::Array(vec![required_recommendation_tool_definition()]),
                );
                object.insert(
                    "tool_choice".to_string(),
                    json!({ "type": "function", "function": { "name": RESPOND_WITH_RECOMMENDATION_TOOL } }),
                );
            } else {
                object.insert("tools".to_string(), conversation_tool_definitions());
                object.insert(
                    "tool_choice".to_string(),
                    Value::String("required".to_string()),
                );
            }
        }
    }
    mode
}

pub fn non_streaming_message(response: &Value) -> (String, Vec<ProviderToolCall>) {
    let message = response
        .pointer("/choices/0/message")
        .unwrap_or(&Value::Null);
    let content = message
        .get("content")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string();
    let tools = message
        .get("tool_calls")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|call| {
            let function = call.get("function")?;
            let name = function.get("name")?.as_str()?.trim();
            if name.is_empty() {
                return None;
            }
            let arguments = match function.get("arguments") {
                Some(Value::String(value)) => value.clone(),
                Some(value) => serde_json::to_string(value).ok()?,
                None => String::new(),
            };
            Some(ProviderToolCall {
                name: name.to_string(),
                arguments,
            })
        })
        .collect();
    (content, tools)
}

pub fn tool_call_fragments(event: &Value) -> Vec<ProviderToolCallFragment> {
    event
        .pointer("/choices/0/delta/tool_calls")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|call| {
            let index = call.get("index").and_then(Value::as_u64)? as usize;
            let name = call
                .pointer("/function/name")
                .and_then(Value::as_str)
                .unwrap_or_default();
            let arguments = call
                .pointer("/function/arguments")
                .and_then(Value::as_str)
                .unwrap_or_default();
            (!name.is_empty() || !arguments.is_empty()).then(|| ProviderToolCallFragment {
                index,
                name: name.to_string(),
                arguments: arguments.to_string(),
            })
        })
        .collect()
}

pub fn streamed_conversation_reply(arguments: &str) -> String {
    let Some(value_start) = top_level_reply_value_start(arguments) else {
        return String::new();
    };
    let chars = arguments[value_start..].chars().collect::<Vec<_>>();
    let mut output = String::new();
    let mut index = 0;
    while index < chars.len() {
        match chars[index] {
            '"' => break,
            '\\' => {
                let Some(escape) = chars.get(index + 1).copied() else {
                    break;
                };
                match escape {
                    '"' | '\\' | '/' => {
                        output.push(escape);
                        index += 1;
                    }
                    'b' => {
                        output.push('\u{0008}');
                        index += 1;
                    }
                    'f' => {
                        output.push('\u{000c}');
                        index += 1;
                    }
                    'n' => {
                        output.push('\n');
                        index += 1;
                    }
                    'r' => {
                        output.push('\r');
                        index += 1;
                    }
                    't' => {
                        output.push('\t');
                        index += 1;
                    }
                    'u' => {
                        let Some(first) = decode_hex_quad(&chars, index + 2) else {
                            break;
                        };
                        index += 5;
                        if (0xD800..=0xDBFF).contains(&first) {
                            if chars.get(index + 1) != Some(&'\\')
                                || chars.get(index + 2) != Some(&'u')
                            {
                                break;
                            }
                            let Some(second) = decode_hex_quad(&chars, index + 3) else {
                                break;
                            };
                            if !(0xDC00..=0xDFFF).contains(&second) {
                                break;
                            }
                            let scalar = 0x10000
                                + (((first as u32) - 0xD800) << 10)
                                + ((second as u32) - 0xDC00);
                            if let Some(character) = char::from_u32(scalar) {
                                output.push(character);
                            }
                            index += 6;
                        } else if let Some(character) = char::from_u32(first as u32) {
                            output.push(character);
                        }
                    }
                    _ => break,
                }
            }
            character if character.is_control() => break,
            character => output.push(character),
        }
        index += 1;
    }
    output
}

fn top_level_reply_value_start(arguments: &str) -> Option<usize> {
    let bytes = arguments.as_bytes();
    let mut index = 0;
    while bytes.get(index)?.is_ascii_whitespace() {
        index += 1;
    }
    if bytes.get(index) != Some(&b'{') {
        return None;
    }
    index += 1;
    loop {
        while bytes.get(index).is_some_and(u8::is_ascii_whitespace) {
            index += 1;
        }
        if bytes.get(index) == Some(&b'}') {
            return None;
        }
        let (key, next) = decode_complete_json_string(arguments, index)?;
        index = next;
        while bytes.get(index).is_some_and(u8::is_ascii_whitespace) {
            index += 1;
        }
        if bytes.get(index) != Some(&b':') {
            return None;
        }
        index += 1;
        while bytes.get(index).is_some_and(u8::is_ascii_whitespace) {
            index += 1;
        }
        if key == "reply" {
            return (bytes.get(index) == Some(&b'"')).then_some(index + 1);
        }
        let (_, next) = decode_complete_json_string(arguments, index)?;
        index = next;
        while bytes.get(index).is_some_and(u8::is_ascii_whitespace) {
            index += 1;
        }
        match bytes.get(index) {
            Some(b',') => index += 1,
            _ => return None,
        }
    }
}

fn decode_complete_json_string(input: &str, start: usize) -> Option<(String, usize)> {
    if input.as_bytes().get(start) != Some(&b'"') {
        return None;
    }
    let tail = &input[start..];
    let mut escaped = false;
    for (offset, character) in tail.char_indices().skip(1) {
        if escaped {
            escaped = false;
            continue;
        }
        match character {
            '\\' => escaped = true,
            '"' => {
                let end = start + offset + 1;
                let value = serde_json::from_str::<String>(&input[start..end]).ok()?;
                return Some((value, end));
            }
            _ => {}
        }
    }
    None
}

fn decode_hex_quad(chars: &[char], start: usize) -> Option<u16> {
    let digits = chars.get(start..start + 4)?;
    let mut value = 0u16;
    for digit in digits {
        value = value.checked_mul(16)? + digit.to_digit(16)? as u16;
    }
    Some(value)
}

pub fn engineering_task_from_calls(calls: &[ProviderToolCall]) -> Result<Option<String>, String> {
    let mut task = None;
    for call in calls
        .iter()
        .filter(|call| call.name.trim() == START_ENGINEERING_TASK_TOOL)
    {
        if task.is_some() {
            return Err("provider 返回了重复的工程任务工具调用".to_string());
        }
        let arguments: Value = serde_json::from_str(&call.arguments)
            .map_err(|_| "provider 工程任务工具参数不是有效 JSON".to_string())?;
        let arguments = arguments
            .as_object()
            .ok_or_else(|| "provider 工程任务工具参数必须是对象".to_string())?;
        if arguments.len() != 1 || !arguments.contains_key("task") {
            return Err("provider 工程任务工具参数必须只包含 task".to_string());
        }
        let value = arguments
            .get("task")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| "provider 工程任务工具参数 task 必须是非空字符串".to_string())?;
        task = Some(value.to_string());
    }
    Ok(task)
}

pub fn conversation_response_from_calls(
    calls: &[ProviderToolCall],
) -> Result<Option<ProviderConversationResponse>, String> {
    let mut response = None;
    for call in calls {
        let name = call.name.trim();
        if !matches!(name, START_ENGINEERING_TASK_TOOL | RESPOND_TO_USER_TOOL) {
            return Err(format!("provider 返回了未登记的对话工具调用：{name}"));
        }
        if name != RESPOND_TO_USER_TOOL {
            continue;
        }
        if response.is_some() {
            return Err("provider 返回了重复的结构化对话响应".to_string());
        }
        let arguments: Value = serde_json::from_str(&call.arguments)
            .map_err(|_| "provider 结构化对话参数不是有效 JSON".to_string())?;
        let arguments = arguments
            .as_object()
            .ok_or_else(|| "provider 结构化对话参数必须是对象".to_string())?;
        let valid_shape = arguments.len() == 3
            && arguments.contains_key("reply")
            && arguments.contains_key("action")
            && arguments.contains_key("task");
        if !valid_shape {
            return Err("provider 结构化对话参数与工具 schema 不一致".to_string());
        }
        let required_text = |key: &str, max: usize| -> Result<String, String> {
            let value = arguments
                .get(key)
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .ok_or_else(|| format!("provider 结构化对话参数 {key} 必须是非空字符串"))?;
            if value.chars().count() > max {
                return Err(format!("provider 结构化对话参数 {key} 超出长度上限"));
            }
            Ok(value.to_string())
        };
        let action = arguments
            .get("action")
            .and_then(Value::as_str)
            .ok_or_else(|| "provider 结构化对话参数 action 必须是字符串".to_string())?;
        let raw_task = arguments
            .get("task")
            .and_then(Value::as_str)
            .ok_or_else(|| "provider 结构化对话参数 task 必须是字符串".to_string())?
            .trim();
        let recommended_task = match action {
            "none" if raw_task.is_empty() => None,
            "start-agent" if !raw_task.is_empty() && raw_task.chars().count() <= 1_200 => {
                Some(raw_task.to_string())
            }
            "none" => return Err("provider action=none 时 task 必须为空".to_string()),
            "start-agent" => {
                return Err("provider action=start-agent 时 task 必须是有界非空字符串".to_string())
            }
            _ => return Err("provider 结构化对话 action 未登记".to_string()),
        };
        response = Some(ProviderConversationResponse {
            reply: required_text("reply", 12_000)?,
            recommended_task,
        });
    }
    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::runtime::provider::PROVIDER_SCHEMA_VERSION;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_root() -> std::path::PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "omnidesk-provider-tools-{}-{suffix}",
            std::process::id()
        ));
        fs::create_dir_all(&root).unwrap();
        root
    }

    fn provider(api_base: &str) -> ProviderConfig {
        ProviderConfig {
            schema_version: PROVIDER_SCHEMA_VERSION.to_string(),
            provider: "openai-compatible".to_string(),
            model: "test-model".to_string(),
            api_base: api_base.to_string(),
            api_key_env: "TEST_KEY".to_string(),
            enabled: true,
            active_profile_id: String::new(),
            profiles: Vec::new(),
        }
    }

    #[test]
    fn probes_native_tools_for_unobserved_openai_compatible_services() {
        let root = temp_root();
        assert_eq!(
            provider_tool_mode(&root, &provider("https://api.openai.com/v1")),
            ProviderToolMode::NativeFunctionCalling
        );
        assert_eq!(
            provider_tool_mode(&root, &provider("https://api.deepseek.com/v1")),
            ProviderToolMode::NativeFunctionCalling
        );
        assert_eq!(
            provider_tool_mode(&root, &provider("https://custom.example/v1")),
            ProviderToolMode::NativeFunctionCalling
        );
    }

    #[test]
    fn adds_a_bounded_native_tool_contract_without_affecting_fallback_payloads() {
        let root = temp_root();
        let mut native = json!({ "model": "test" });
        assert_eq!(
            add_conversation_tools(
                &root,
                &provider("https://api.openai.com/v1"),
                &mut native,
                false,
            ),
            ProviderToolMode::NativeFunctionCalling
        );
        assert_eq!(
            native
                .pointer("/tools/0/function/name")
                .and_then(Value::as_str),
            Some(START_ENGINEERING_TASK_TOOL)
        );
        assert_eq!(
            native
                .pointer("/tools/0/function/parameters/additionalProperties")
                .and_then(Value::as_bool),
            Some(false)
        );
        assert_eq!(
            native.get("tool_choice").and_then(Value::as_str),
            Some("required")
        );
        assert_eq!(
            native
                .pointer("/tools/1/function/name")
                .and_then(Value::as_str),
            Some(RESPOND_TO_USER_TOOL)
        );

        let mut recommendation = json!({ "model": "test" });
        add_conversation_tools(
            &root,
            &provider("https://api.openai.com/v1"),
            &mut recommendation,
            true,
        );
        assert_eq!(
            recommendation
                .pointer("/tools/0/function/name")
                .and_then(Value::as_str),
            Some(RESPOND_WITH_RECOMMENDATION_TOOL)
        );
        assert_eq!(
            recommendation
                .pointer("/tools/0/function/parameters/properties")
                .and_then(Value::as_object)
                .map(|properties| properties.keys().cloned().collect::<Vec<_>>()),
            Some(vec!["task".to_string()])
        );
        assert_eq!(
            recommendation
                .pointer("/tool_choice/function/name")
                .and_then(Value::as_str),
            Some(RESPOND_WITH_RECOMMENDATION_TOOL)
        );

        let fallback_provider = provider("https://gateway.example/v1");
        record_provider_tool_capability(
            &root,
            &fallback_provider,
            ProviderToolMode::CompatibilityKeyword,
            "explicit-tool-rejection",
        )
        .unwrap();
        let mut fallback = json!({ "model": "test" });
        assert_eq!(
            add_conversation_tools(&root, &fallback_provider, &mut fallback, false),
            ProviderToolMode::CompatibilityKeyword
        );
        assert!(fallback.get("tools").is_none());
    }

    #[test]
    fn persisted_capability_evidence_overrides_the_host_default() {
        let root = temp_root();
        let configured = provider("https://custom.example/v1");
        record_provider_tool_capability(
            &root,
            &configured,
            ProviderToolMode::CompatibilityKeyword,
            "explicit-tool-rejection",
        )
        .unwrap();
        assert_eq!(
            provider_tool_mode(&root, &configured),
            ProviderToolMode::CompatibilityKeyword
        );
        let cache = load_provider_tool_capabilities(&root).unwrap();
        assert_eq!(cache.entries.len(), 1);
        assert_eq!(cache.entries[0].source, "explicit-tool-rejection");
    }

    #[test]
    fn parses_native_tool_calls_with_or_without_text_content() {
        let response = json!({ "choices": [{ "message": { "content": null, "tool_calls": [{ "function": { "name": START_ENGINEERING_TASK_TOOL, "arguments": "{\"task\":\"fix\"}" } }] } }] });
        let (content, tools) = non_streaming_message(&response);
        assert!(content.is_empty());
        assert_eq!(
            engineering_task_from_calls(&tools).unwrap().as_deref(),
            Some("fix")
        );
    }

    #[test]
    fn streams_only_the_decoded_reply_field_from_partial_tool_arguments() {
        assert_eq!(
            streamed_conversation_reply(r#"{"reply":"第一行\n第二"#),
            "第一行\n第二"
        );
        assert_eq!(
            streamed_conversation_reply(
                r#"{"reply":"建议 \"先修\" \u4e2d文 \ud83d\ude80","task":"later"}"#
            ),
            "建议 \"先修\" 中文 🚀"
        );
        assert_eq!(
            streamed_conversation_reply(r#"{"task":"reply is not a field yet"}"#),
            ""
        );
        assert_eq!(
            streamed_conversation_reply(
                r#"{"task":"hidden \"reply\": \"do not show\"","reply":"可见"}"#
            ),
            "可见"
        );
        assert_eq!(
            streamed_conversation_reply(r#"{"reply":"未完成\u4e"#),
            "未完成"
        );
    }

    #[test]
    fn parses_a_bounded_structured_response_without_reading_prose() {
        let calls = [ProviderToolCall {
            name: RESPOND_TO_USER_TOOL.to_string(),
            arguments: r#"{"reply":"建议先统一任务状态。","action":"start-agent","task":"在会话消息旁加入统一任务状态标签"}"#.to_string(),
        }];
        assert_eq!(
            conversation_response_from_calls(&calls).unwrap(),
            Some(ProviderConversationResponse {
                reply: "建议先统一任务状态。".to_string(),
                recommended_task: Some("在会话消息旁加入统一任务状态标签".to_string()),
            })
        );
        assert_eq!(
            conversation_response_from_calls(&[ProviderToolCall {
                name: RESPOND_TO_USER_TOOL.to_string(),
                arguments: r#"{"reply":"只回答问题。","action":"none","task":""}"#.to_string(),
            }])
            .unwrap()
            .unwrap()
            .recommended_task,
            None
        );
        assert!(conversation_response_from_calls(&[ProviderToolCall {
            name: RESPOND_WITH_RECOMMENDATION_TOOL.to_string(),
            arguments: r#"{"task":"实现任务语义去重"}"#.to_string(),
        }])
        .is_err());
        assert!(conversation_response_from_calls(&[ProviderToolCall {
            name: RESPOND_TO_USER_TOOL.to_string(),
            arguments: r#"{"reply":"建议。","action":"none","task":"执行"}"#.to_string(),
        }])
        .is_err());
    }

    #[test]
    fn extracts_indexed_sse_tool_call_fragments() {
        let event = json!({ "choices": [{ "delta": { "tool_calls": [{ "index": 0, "function": { "name": "start_", "arguments": "{\"task\":" } }] } }] });
        assert_eq!(
            tool_call_fragments(&event),
            vec![ProviderToolCallFragment {
                index: 0,
                name: "start_".to_string(),
                arguments: "{\"task\":".to_string(),
            }]
        );
    }

    #[test]
    fn rejects_malformed_or_ambiguous_engineering_task_arguments() {
        let call = |arguments: &str| ProviderToolCall {
            name: START_ENGINEERING_TASK_TOOL.to_string(),
            arguments: arguments.to_string(),
        };
        assert!(engineering_task_from_calls(&[call("")]).is_err());
        assert!(engineering_task_from_calls(&[call(r#"{"task":7}"#)]).is_err());
        assert!(engineering_task_from_calls(&[call(r#"{"task":""}"#)]).is_err());
        assert!(engineering_task_from_calls(&[call(r#"{"task":"fix","extra":true}"#)]).is_err());
        assert!(engineering_task_from_calls(&[
            call(r#"{"task":"fix"}"#),
            call(r#"{"task":"again"}"#),
        ])
        .is_err());
    }

    #[test]
    fn falls_back_only_for_explicit_native_tool_capability_errors() {
        assert!(should_fallback_from_native_tools(
            "provider HTTP 400: tools are unsupported"
        ));
        assert!(should_fallback_from_native_tools(
            "provider HTTP 422: unrecognized function"
        ));
        assert!(!should_fallback_from_native_tools(
            "provider HTTP 401: invalid token"
        ));
        assert!(!should_fallback_from_native_tools("connection reset"));
    }
}
