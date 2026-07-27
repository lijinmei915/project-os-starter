use crate::runtime::acp_protocol::{
    extract_structured_envelope, provider_usage, wait_for_response, write_request, ProviderUsage,
};
use crate::runtime::agent_tools::{build_task_context, execute_read_tool};
use crate::runtime::patch::{validate_apply_diff_paths, validate_unified_diff_authorized};
use crate::runtime::provider::trim_for_trace;
use crate::runtime::tool_registry::{builtin_registry, find_builtin, validate_arguments};
use serde_json::{json, Value};
use std::collections::HashSet;
use std::io::{BufRead, BufReader, Read};
use std::path::Path;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio_util::sync::CancellationToken;

const ACP_TIMEOUT: Duration = Duration::from_secs(75);
const MAX_TOOL_ARGUMENT_RETRIES: usize = 2;

fn tool_argument_correction(name: &str, arguments: &Value) -> Option<(String, Value)> {
    let Some(descriptor) = find_builtin(name) else {
        return Some((
            format!("工具 {name} 未登记；请选择已登记的只读工具"),
            serde_json::to_value(builtin_registry()).unwrap_or_else(|_| json!({})),
        ));
    };
    validate_arguments(&descriptor, arguments)
        .err()
        .map(|error| (error, descriptor.input_schema))
}

/// The ACP loop returns an explicit state instead of claiming completion from
/// a successful provider response. The Tauri adapter persists and approves it.
use crate::runtime::agent_executor::{AgentEvent, AgentExecutionMode, AgentExecutionResult};

fn push_event(
    events: &mut Vec<AgentEvent>,
    kind: &str,
    phase: &str,
    status: &str,
    summary: impl Into<String>,
    details: Value,
) {
    events.push(AgentEvent::new(
        events.len() + 1,
        kind,
        phase,
        status,
        summary,
        details,
    ));
}

fn push_terminal(
    events: &mut Vec<AgentEvent>,
    status: &str,
    step: usize,
    summary: impl Into<String>,
) -> Result<(), String> {
    if events.iter().any(AgentEvent::is_terminal) {
        return Err("Agent Event 已存在终态，拒绝重复封口。".to_string());
    }
    push_event(
        events,
        "terminal",
        "model",
        status,
        summary,
        json!({ "step": step }),
    );
    Ok(())
}

pub struct AcpExecutionConfig {
    pub executor_id: &'static str,
    pub display_name: &'static str,
    pub trace_prefix: &'static str,
    pub program: PathBuf,
    pub args: Vec<String>,
    pub forward_provider_env: bool,
    pub mode: AgentExecutionMode,
}

#[allow(clippy::too_many_arguments)]
pub fn run_acp_structured_loop(
    config: AcpExecutionConfig,
    root: &Path,
    api_key: &str,
    api_base: &str,
    api_key_env: &str,
    prompt: &str,
    max_steps: usize,
    cancellation: Option<&CancellationToken>,
) -> Result<AgentExecutionResult, String> {
    let initial_context = build_task_context(root, prompt)?;
    let mut command = Command::new(&config.program);
    command
        .args(&config.args)
        .current_dir(root)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if config.forward_provider_env {
        command
            .env("OPENAI_API_KEY", api_key)
            .env("OPENAI_BASE_URL", api_base);
        if !api_key_env.trim().is_empty() {
            command.env(api_key_env.trim(), api_key);
        }
        if let Some(key_env) = crate::runtime::hermes_protocol::custom_provider_key_env(api_base) {
            command.env(key_env, api_key);
        }
    }
    let mut child = command
        .spawn()
        .map_err(|err| format!("启动 {} ACP 失败: {err}", config.display_name))?;
    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| format!("{} ACP stdin 不可用", config.display_name))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| format!("{} ACP stdout 不可用", config.display_name))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| format!("{} ACP stderr 不可用", config.display_name))?;
    let (lines_tx, lines_rx) = mpsc::channel::<Result<String, String>>();
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines() {
            let result = line.map_err(|err| err.to_string());
            let should_stop = result.is_err();
            if lines_tx.send(result).is_err() || should_stop {
                break;
            }
        }
    });
    let (stderr_tx, stderr_rx) = mpsc::channel::<String>();
    std::thread::spawn(move || {
        let mut output = String::new();
        let _ = BufReader::new(stderr)
            .take(8192)
            .read_to_string(&mut output);
        let _ = stderr_tx.send(output);
    });
    let deadline = Instant::now() + ACP_TIMEOUT;
    let mut trace = vec![
        format!("{}_ACP: structured tool loop", config.trace_prefix),
        format!("EXECUTION_MODE: {:?}", config.mode),
        "CONTEXT_PACK: bounded read-only project context prepared".to_string(),
    ];
    let mut observations = vec![json!({
        "name": "initial_context",
        "success": true,
        "data": initial_context,
    })];
    let mut events = Vec::new();
    push_event(
        &mut events,
        "lifecycle",
        "model",
        "running",
        "Agent Executor 开始处理。",
        json!({ "mode": format!("{:?}", config.mode) }),
    );
    let mut authorized_patch_files = HashSet::<String>::new();
    let mut envelope_retry_used = false;
    let mut consecutive_tool_argument_errors = 0usize;
    let mut usage = ProviderUsage::default();
    let mut result = (|| -> Result<AgentExecutionResult, String> {
        write_request(
            &mut stdin,
            1,
            "initialize",
            json!({ "protocolVersion": 1, "clientCapabilities": {}, "clientInfo": { "name": "OmniDesk", "version": "0.1.0" } }),
        )?;
        let mut ignored = String::new();
        wait_for_response(
            &lines_rx,
            &mut stdin,
            1,
            deadline,
            &mut ignored,
            cancellation,
        )?;
        write_request(
            &mut stdin,
            2,
            "session/new",
            json!({ "cwd": root.to_string_lossy(), "mcpServers": [] }),
        )?;
        let session = wait_for_response(
            &lines_rx,
            &mut stdin,
            2,
            deadline,
            &mut ignored,
            cancellation,
        )?;
        let session_id = session
            .pointer("/result/sessionId")
            .and_then(Value::as_str)
            .ok_or_else(|| format!("{} ACP 没有返回 sessionId", config.display_name))?
            .to_string();
        let initial_context_text = observations
            .first()
            .expect("initial context observation exists");
        let tool_contracts =
            serde_json::to_string(&builtin_registry()).unwrap_or_else(|_| "{}".to_string());
        let instruction = format!("{}\n\nInitial read-only project context: {}\n\nRegistered read-only tool contracts: {}\n\nYou are a governed executor. Return ONLY JSON. The initial context is informational only and does not authorize a patch: before requesting apply_patch, explicitly call read_file for every file you intend to modify. For project context use {{\"type\":\"tool_call\",\"name\":\"read_file|list_files|search_project|git_status\",\"arguments\":{{...}}}} and follow the registered schemas exactly. If a required product decision is missing, return {{\"type\":\"tool_call\",\"name\":\"ask_user\",\"arguments\":{{\"title\":\"...\",\"description\":\"...\",\"fields\":[{{\"id\":\"...\",\"type\":\"single-choice|multi-choice|text|confirm\",\"label\":\"...\",\"required\":true,\"options\":[{{\"value\":\"...\",\"label\":\"...\"}}]}}],\"actions\":[{{\"id\":\"submit\",\"label\":\"提交\"}},{{\"id\":\"skip\",\"label\":\"跳过\"}}]}}}}. Ask only for information necessary to continue; this does not grant permission to write files or run checks. To request a project modification or an allowlisted check, return apply_patch or run_check with arguments; OmniDesk will pause for independent approval before executing it. When enough context is available return {{\"type\":\"final\",\"result\":{{...}}}}. Never call tools directly.", prompt, initial_context_text, tool_contracts);
        let mut next_prompt = instruction;
        for step in 0..max_steps.max(1) {
            if cancellation.is_some_and(CancellationToken::is_cancelled) {
                return Err("请求已取消".to_string());
            }
            let request_id = 3 + (step as u64 * 2);
            write_request(
                &mut stdin,
                request_id,
                "session/prompt",
                json!({ "sessionId": session_id, "prompt": [{ "type": "text", "text": next_prompt }] }),
            )?;
            let mut agent_text = String::new();
            let prompt_response = wait_for_response(
                &lines_rx,
                &mut stdin,
                request_id,
                deadline,
                &mut agent_text,
                cancellation,
            )?;
            if let Some(prompt_usage) = provider_usage(&prompt_response) {
                usage.merge(prompt_usage);
            }
            let parsed = extract_structured_envelope(&agent_text);
            let invalid_reason = match &parsed {
                Ok(value)
                    if matches!(
                        value.get("type").and_then(Value::as_str),
                        Some("final" | "tool_call")
                    ) =>
                {
                    None
                }
                Ok(_) => Some(format!("{} 返回未知 envelope 类型", config.display_name)),
                Err(error) => Some(error.clone()),
            };
            let envelope = if let Some(reason) = invalid_reason {
                if envelope_retry_used {
                    return Err(reason);
                }
                envelope_retry_used = true;
                trace.push(format!(
                    "{}_STEP: {} envelope retry",
                    config.trace_prefix,
                    step + 1
                ));
                write_request(
                    &mut stdin,
                    request_id + 1,
                    "session/prompt",
                    json!({
                        "sessionId": session_id,
                        "prompt": [{
                            "type": "text",
                            "text": "Your previous response did not match the required envelope. Return exactly one JSON object now. Its type must be either `tool_call` with name and arguments, or `final` with result. Do not explain, do not use markdown fences, and do not perform any operation outside that JSON response."
                        }]
                    }),
                )?;
                let mut corrected_text = String::new();
                let corrected_response = wait_for_response(
                    &lines_rx,
                    &mut stdin,
                    request_id + 1,
                    deadline,
                    &mut corrected_text,
                    cancellation,
                )?;
                if let Some(prompt_usage) = provider_usage(&corrected_response) {
                    usage.merge(prompt_usage);
                }
                let corrected = extract_structured_envelope(&corrected_text)?;
                if !matches!(
                    corrected.get("type").and_then(Value::as_str),
                    Some("final" | "tool_call")
                ) {
                    return Err(format!(
                        "{} 纠正后仍返回未知 envelope 类型",
                        config.display_name
                    ));
                }
                corrected
            } else {
                parsed.expect("validated envelope")
            };
            let kind = envelope.get("type").and_then(Value::as_str).unwrap_or("");
            if kind == "final" {
                trace.push(format!("{}_STEP: {} final", config.trace_prefix, step + 1));
                let summary = format!("{} 已完成结构化推理。", config.display_name);
                push_terminal(&mut events, "succeeded", step + 1, &summary)?;
                return Ok(AgentExecutionResult {
                    status: "succeeded".to_string(),
                    summary,
                    step: step + 1,
                    result: envelope.get("result").cloned(),
                    approval: None,
                    interaction: None,
                    events,
                    observations,
                    trace,
                    usage,
                });
            }
            debug_assert_eq!(kind, "tool_call");
            let name = envelope.get("name").and_then(Value::as_str).unwrap_or("");
            let mut args = envelope
                .get("arguments")
                .cloned()
                .unwrap_or_else(|| json!({}));
            trace.push(format!(
                "{}_STEP: {} tool {}",
                config.trace_prefix,
                step + 1,
                name
            ));
            push_event(
                &mut events,
                "tool-call",
                "tool",
                "requested",
                format!("Agent 请求工具 {name}。"),
                json!({ "name": name, "step": step + 1 }),
            );
            if name == "ask_user" {
                let interaction =
                    crate::runtime::agent_runs::validate_ask_user_interaction(&args, step + 1)?;
                push_terminal(
                    &mut events,
                    "awaiting-user-input",
                    step + 1,
                    "等待用户补充必要信息。",
                )?;
                return Ok(AgentExecutionResult {
                    status: "awaiting-user-input".to_string(),
                    summary: "需要你确认一个关键选择后才能继续。".to_string(),
                    step: step + 1,
                    result: None,
                    approval: None,
                    interaction: Some(interaction),
                    events,
                    observations,
                    trace,
                    usage,
                });
            }
            if matches!(name, "apply_patch" | "run_check") {
                if name == "apply_patch" {
                    let diff = args
                        .get("diff")
                        .and_then(Value::as_str)
                        .ok_or_else(|| format!("{} Patch 请求缺少 diff。", config.display_name))?;
                    validate_apply_diff_paths(diff)?;
                    let allowed_files = authorized_patch_files.iter().cloned().collect::<Vec<_>>();
                    validate_unified_diff_authorized(diff, &allowed_files)?;
                    args["allowedFiles"] = json!(allowed_files);
                }
                let approval = json!({ "id": format!("{}:{}:approval", config.executor_id, step), "name": name, "arguments": args, "reason": if name == "apply_patch" { "修改项目文件" } else { "运行项目检查" }, "toolCallId": format!("{}:{}:tool", config.executor_id, step), "status": "pending", "token": format!("{}-approval-{}-{}", config.executor_id, step, current_unix_timestamp()) });
                push_terminal(
                    &mut events,
                    "awaiting-approval",
                    step + 1,
                    "等待用户审批受控操作。",
                )?;
                return Ok(AgentExecutionResult {
                    status: "awaiting-approval".to_string(),
                    summary: format!("{} 请求了需要确认的操作。", config.display_name),
                    step: step + 1,
                    result: None,
                    approval: Some(approval),
                    interaction: None,
                    events,
                    observations,
                    trace,
                    usage,
                });
            }
            if let Some((error, expected_schema)) = tool_argument_correction(name, &args) {
                consecutive_tool_argument_errors += 1;
                trace.push(format!(
                    "{}_STEP: {} invalid tool arguments {}/{}",
                    config.trace_prefix,
                    step + 1,
                    consecutive_tool_argument_errors,
                    MAX_TOOL_ARGUMENT_RETRIES + 1
                ));
                observations.push(json!({
                    "name": name,
                    "success": false,
                    "error": { "kind": "invalid-arguments", "message": error },
                    "expectedSchema": expected_schema,
                }));
                if consecutive_tool_argument_errors > MAX_TOOL_ARGUMENT_RETRIES {
                    push_terminal(&mut events, "failed", step + 1, "工具参数连续纠正失败。")?;
                    return Ok(AgentExecutionResult {
                        status: "failed".to_string(),
                        summary: "Agent 连续多次无法按工具契约读取项目，任务未完成。".to_string(),
                        step: step + 1,
                        result: None,
                        approval: None,
                        interaction: None,
                        events,
                        observations,
                        trace,
                        usage,
                    });
                }
                next_prompt = format!(
                    "The previous tool call was not executed because its arguments were invalid. Correct the call using this observation and schema, then return exactly one JSON envelope. Do not repeat the same invalid arguments: {}",
                    observations.last().expect("invalid argument observation was just pushed")
                );
                continue;
            }
            consecutive_tool_argument_errors = 0;
            let observation = execute_read_tool(root, name, &args)
                .map_err(|error| format!("{} 读取工具失败：{error}", config.display_name))?;
            if name == "read_file" {
                if let Some(path) = args
                    .get("path")
                    .and_then(Value::as_str)
                    .filter(|path| crate::runtime::patch::is_context_path(path))
                {
                    authorized_patch_files.insert(path.to_string());
                }
            }
            observations.push(json!({ "name": name, "success": true, "data": observation }));
            push_event(
                &mut events,
                "tool-result",
                "tool",
                "succeeded",
                format!("工具 {name} 已返回结果。"),
                json!({ "name": name, "step": step + 1, "success": true }),
            );
            next_prompt = format!(
                "Tool observation (do not repeat the tool call unless needed): {}",
                observations.last().expect("observation was just pushed")
            );
        }
        let summary = format!(
            "{} 工具步数超过上限（{}）",
            config.display_name,
            max_steps.max(1)
        );
        push_terminal(&mut events, "budget-exceeded", max_steps.max(1), &summary)?;
        Ok(AgentExecutionResult {
            status: "budget-exceeded".to_string(),
            summary,
            step: max_steps.max(1),
            result: None,
            approval: None,
            interaction: None,
            events,
            observations,
            trace,
            usage,
        })
    })();
    let _ = child.kill();
    let _ = child.wait();
    if let Err(error) = &result {
        let stderr = stderr_rx
            .recv_timeout(Duration::from_secs(1))
            .unwrap_or_default();
        if !stderr.trim().is_empty() {
            result = Err(format!(
                "{}；{}: {}",
                error,
                config.display_name,
                trim_for_trace(&stderr)
            ));
        }
    }
    result
}

fn current_unix_timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(unix)]
    fn acp_fixture() -> (PathBuf, PathBuf) {
        use std::os::unix::fs::PermissionsExt;
        let root = std::env::temp_dir().join(format!(
            "omnidesk-acp-executor-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ));
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(root.join("README.md"), "fixture\n").unwrap();
        let program = root.join("fixture-acp.sh");
        std::fs::write(
            &program,
            r#"#!/bin/sh
while IFS= read -r line; do
  case "$line" in
    *'"id":1'*) printf '%s\n' '{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":1}}' ;;
    *'"id":2'*) printf '%s\n' '{"jsonrpc":"2.0","id":2,"result":{"sessionId":"fixture-session"}}' ;;
    *'"id":3'*)
      printf '%s\n' '{"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"fixture-session","update":{"content":{"type":"text","text":"{\"type\":\"final\",\"result\":{\"summary\":\"fixture complete\"}}"}}}}'
      printf '%s\n' '{"jsonrpc":"2.0","id":3,"result":{"stopReason":"end_turn","usage":{"inputTokens":4,"outputTokens":2,"totalTokens":6}}}'
      ;;
  esac
done
"#,
        )
        .unwrap();
        let mut permissions = std::fs::metadata(&program).unwrap().permissions();
        permissions.set_mode(0o700);
        std::fs::set_permissions(&program, permissions).unwrap();
        (root, program)
    }

    #[test]
    fn invalid_read_arguments_return_a_repairable_schema_observation() {
        let (error, schema) = tool_argument_correction(
            "read_file",
            &json!({ "path": "README.md", "startLine": 8, "endLine": 2 }),
        )
        .expect("invalid line range should be repairable");
        assert!(error.contains("endLine"));
        assert_eq!(schema["additionalProperties"], false);
        assert_eq!(schema["properties"]["endLine"]["type"], "integer");
    }

    #[test]
    fn valid_read_arguments_need_no_correction() {
        assert!(tool_argument_correction(
            "read_file",
            &json!({ "path": "README.md", "startLine": 1, "endLine": 20 }),
        )
        .is_none());
    }

    #[test]
    fn event_log_rejects_a_second_terminal_state() {
        let mut events = Vec::new();
        push_terminal(&mut events, "succeeded", 1, "done").unwrap();
        assert!(push_terminal(&mut events, "failed", 1, "late").is_err());
        assert_eq!(events.iter().filter(|event| event.is_terminal()).count(), 1);
    }

    #[test]
    fn unknown_tools_return_the_registered_tool_catalog() {
        let (error, catalog) = tool_argument_correction("read_range", &json!({}))
            .expect("unknown tool should be repairable");
        assert!(error.contains("未登记"));
        assert!(catalog["tools"]
            .as_array()
            .is_some_and(|tools| !tools.is_empty()));
    }

    #[cfg(unix)]
    #[test]
    fn alternate_acp_process_runs_the_shared_resume_contract() {
        let (root, program) = acp_fixture();
        let result = run_acp_structured_loop(
            AcpExecutionConfig {
                executor_id: "fixture-acp",
                display_name: "Fixture",
                trace_prefix: "FIXTURE",
                program,
                args: Vec::new(),
                forward_provider_env: false,
                mode: AgentExecutionMode::Resume,
            },
            &root,
            "",
            "",
            "",
            "return a final envelope",
            2,
            None,
        )
        .unwrap();
        assert_eq!(result.status, "succeeded");
        assert_eq!(result.events.first().unwrap().sequence, 1);
        assert_eq!(
            result
                .events
                .iter()
                .filter(|event| event.is_terminal())
                .count(),
            1
        );
        assert_eq!(result.events.last().unwrap().status, "succeeded");
        assert_eq!(result.result.unwrap()["summary"], "fixture complete");
        assert_eq!(result.usage.total_tokens, 6);
        assert!(result
            .trace
            .iter()
            .any(|line| line == "EXECUTION_MODE: Resume"));
        let _ = std::fs::remove_dir_all(root);
    }

    #[cfg(unix)]
    #[test]
    fn alternate_acp_process_obeys_runtime_cancellation() {
        let (root, program) = acp_fixture();
        let cancellation = CancellationToken::new();
        cancellation.cancel();
        let error = run_acp_structured_loop(
            AcpExecutionConfig {
                executor_id: "fixture-acp",
                display_name: "Fixture",
                trace_prefix: "FIXTURE",
                program,
                args: Vec::new(),
                forward_provider_env: false,
                mode: AgentExecutionMode::Start,
            },
            &root,
            "",
            "",
            "",
            "cancel",
            1,
            Some(&cancellation),
        )
        .unwrap_err();
        assert!(error.contains("请求已取消"));
        let _ = std::fs::remove_dir_all(root);
    }
}
