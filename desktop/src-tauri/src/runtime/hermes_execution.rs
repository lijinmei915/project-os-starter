use crate::runtime::agent_tools::{build_task_context, execute_hermes_read_tool};
use crate::runtime::hermes_protocol::{
    acp_program, custom_provider_key_env, extract_structured_envelope, wait_for_response,
    write_request,
};
use crate::runtime::patch::{validate_apply_diff_paths, validate_unified_diff_authorized};
use crate::runtime::provider::trim_for_trace;
use serde::Serialize;
use serde_json::{json, Value};
use std::collections::HashSet;
use std::io::{BufRead, BufReader, Read};
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio_util::sync::CancellationToken;

const ACP_TIMEOUT: Duration = Duration::from_secs(75);

/// The ACP loop returns an explicit state instead of claiming completion from
/// a successful provider response. The Tauri adapter persists and approves it.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HermesAgentLoopResult {
    pub status: String,
    pub summary: String,
    pub step: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub approval: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interaction: Option<Value>,
    pub observations: Vec<Value>,
    pub trace: Vec<String>,
}

pub fn run_structured_loop(
    root: &Path,
    api_key: &str,
    api_base: &str,
    api_key_env: &str,
    prompt: &str,
    max_steps: usize,
    cancellation: Option<&CancellationToken>,
) -> Result<HermesAgentLoopResult, String> {
    let program = acp_program().ok_or_else(|| "未检测到 hermes-acp".to_string())?;
    let initial_context = build_task_context(root, prompt)?;
    let mut command = Command::new(program);
    command
        .current_dir(root)
        .env("OPENAI_API_KEY", api_key)
        .env("OPENAI_BASE_URL", api_base)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if !api_key_env.trim().is_empty() {
        command.env(api_key_env.trim(), api_key);
    }
    if let Some(key_env) = custom_provider_key_env(api_base) {
        command.env(key_env, api_key);
    }
    let mut child = command
        .spawn()
        .map_err(|err| format!("启动 Hermes ACP 失败: {err}"))?;
    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| "Hermes ACP stdin 不可用".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Hermes ACP stdout 不可用".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Hermes ACP stderr 不可用".to_string())?;
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
        "HERMES_ACP: structured tool loop".to_string(),
        "CONTEXT_PACK: bounded read-only project context prepared".to_string(),
    ];
    let mut observations = vec![json!({
        "name": "initial_context",
        "success": true,
        "data": initial_context,
    })];
    let mut authorized_patch_files = HashSet::<String>::new();
    let mut envelope_retry_used = false;
    let mut result = (|| -> Result<HermesAgentLoopResult, String> {
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
            .ok_or_else(|| "Hermes ACP 没有返回 sessionId".to_string())?
            .to_string();
        let initial_context_text = observations
            .first()
            .expect("initial context observation exists");
        let instruction = format!("{}\n\nInitial read-only project context: {}\n\nYou are a governed executor. Return ONLY JSON. The initial context is informational only and does not authorize a patch: before requesting apply_patch, explicitly call read_file for every file you intend to modify. For project context use {{\"type\":\"tool_call\",\"name\":\"read_file|list_files|search_project|git_status\",\"arguments\":{{...}}}}. If a required product decision is missing, return {{\"type\":\"tool_call\",\"name\":\"ask_user\",\"arguments\":{{\"title\":\"...\",\"description\":\"...\",\"fields\":[{{\"id\":\"...\",\"type\":\"single-choice|multi-choice|text|confirm\",\"label\":\"...\",\"required\":true,\"options\":[{{\"value\":\"...\",\"label\":\"...\"}}]}}],\"actions\":[{{\"id\":\"submit\",\"label\":\"提交\"}},{{\"id\":\"skip\",\"label\":\"跳过\"}}]}}}}. Ask only for information necessary to continue; this does not grant permission to write files or run checks. To request a project modification or an allowlisted check, return apply_patch or run_check with arguments; OmniDesk will pause for independent approval before executing it. When enough context is available return {{\"type\":\"final\",\"result\":{{...}}}}. Never call tools directly.", prompt, initial_context_text);
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
            wait_for_response(
                &lines_rx,
                &mut stdin,
                request_id,
                deadline,
                &mut agent_text,
                cancellation,
            )?;
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
                Ok(_) => Some("Hermes 返回未知 envelope 类型".to_string()),
                Err(error) => Some(error.clone()),
            };
            let envelope = if let Some(reason) = invalid_reason {
                if envelope_retry_used {
                    return Err(reason);
                }
                envelope_retry_used = true;
                trace.push(format!("HERMES_STEP: {} envelope retry", step + 1));
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
                wait_for_response(
                    &lines_rx,
                    &mut stdin,
                    request_id + 1,
                    deadline,
                    &mut corrected_text,
                    cancellation,
                )?;
                let corrected = extract_structured_envelope(&corrected_text)?;
                if !matches!(
                    corrected.get("type").and_then(Value::as_str),
                    Some("final" | "tool_call")
                ) {
                    return Err("Hermes 纠正后仍返回未知 envelope 类型".to_string());
                }
                corrected
            } else {
                parsed.expect("validated envelope")
            };
            let kind = envelope.get("type").and_then(Value::as_str).unwrap_or("");
            if kind == "final" {
                trace.push(format!("HERMES_STEP: {} final", step + 1));
                return Ok(HermesAgentLoopResult {
                    status: "succeeded".to_string(),
                    summary: "Hermes 已完成结构化推理。".to_string(),
                    step: step + 1,
                    result: envelope.get("result").cloned(),
                    approval: None,
                    interaction: None,
                    observations,
                    trace,
                });
            }
            debug_assert_eq!(kind, "tool_call");
            let name = envelope.get("name").and_then(Value::as_str).unwrap_or("");
            let mut args = envelope
                .get("arguments")
                .cloned()
                .unwrap_or_else(|| json!({}));
            trace.push(format!("HERMES_STEP: {} tool {}", step + 1, name));
            if name == "ask_user" {
                let interaction =
                    crate::runtime::agent_runs::validate_ask_user_interaction(&args, step + 1)?;
                return Ok(HermesAgentLoopResult {
                    status: "awaiting-user-input".to_string(),
                    summary: "需要你确认一个关键选择后才能继续。".to_string(),
                    step: step + 1,
                    result: None,
                    approval: None,
                    interaction: Some(interaction),
                    observations,
                    trace,
                });
            }
            if matches!(name, "apply_patch" | "run_check") {
                if name == "apply_patch" {
                    let diff = args
                        .get("diff")
                        .and_then(Value::as_str)
                        .ok_or_else(|| "Hermes Patch 请求缺少 diff。".to_string())?;
                    validate_apply_diff_paths(diff)?;
                    let allowed_files = authorized_patch_files.iter().cloned().collect::<Vec<_>>();
                    validate_unified_diff_authorized(diff, &allowed_files)?;
                    args["allowedFiles"] = json!(allowed_files);
                }
                let approval = json!({ "id": format!("hermes:{}:approval", step), "name": name, "arguments": args, "reason": if name == "apply_patch" { "修改项目文件" } else { "运行项目检查" }, "toolCallId": format!("hermes:{}:tool", step), "status": "pending", "token": format!("hermes-approval-{}-{}", step, current_unix_timestamp()) });
                return Ok(HermesAgentLoopResult {
                    status: "awaiting-approval".to_string(),
                    summary: "Hermes 请求了需要确认的操作。".to_string(),
                    step: step + 1,
                    result: None,
                    approval: Some(approval),
                    interaction: None,
                    observations,
                    trace,
                });
            }
            let observation = execute_hermes_read_tool(root, name, &args)?;
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
            next_prompt = format!(
                "Tool observation (do not repeat the tool call unless needed): {}",
                observations.last().expect("observation was just pushed")
            );
        }
        Ok(HermesAgentLoopResult {
            status: "budget-exceeded".to_string(),
            summary: format!("Hermes 工具步数超过上限（{}）", max_steps.max(1)),
            step: max_steps.max(1),
            result: None,
            approval: None,
            interaction: None,
            observations,
            trace,
        })
    })();
    let _ = child.kill();
    let _ = child.wait();
    if let Err(error) = &result {
        let stderr = stderr_rx
            .recv_timeout(Duration::from_secs(1))
            .unwrap_or_default();
        if !stderr.trim().is_empty() {
            result = Err(format!("{}；Hermes: {}", error, trim_for_trace(&stderr)));
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
