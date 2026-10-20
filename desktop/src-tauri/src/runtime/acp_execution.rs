use crate::runtime::acp_protocol::{
    extract_structured_envelope, provider_usage, wait_for_response, wait_for_response_with_updates,
    write_request, AcpResponseTimeouts, ProviderUsage,
};
use crate::runtime::agent_tools::{build_risk_review_context, build_task_context, execute_read_tool, list_files};
use crate::runtime::patch::{validate_apply_diff_paths, validate_unified_diff_authorized};
use crate::runtime::tool_registry::{builtin_registry, find_builtin, validate_arguments};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{BufRead, BufReader, Read};
use std::path::Path;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::{mpsc, Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio_util::sync::CancellationToken;

// Each ACP RPC request owns a new timeout window. In particular, an Agent
// must not lose its remaining time while waiting for the user to answer an
// ask_user form and then resuming from that checkpoint.
const ACP_STARTUP_TIMEOUT: Duration = Duration::from_secs(30);
const ACP_FIRST_RESPONSE_TIMEOUT: Duration = Duration::from_secs(60);
const ACP_STREAM_IDLE_TIMEOUT: Duration = Duration::from_secs(45);
const ACP_PROMPT_MAX_DURATION: Duration = Duration::from_secs(5 * 60);
const MAX_TOOL_ARGUMENT_RETRIES: usize = 2;
const WARM_HERMES_WORKER_LIMIT: usize = 2;

#[derive(Clone, Eq, PartialEq)]
struct WarmWorkerKey {
    program: PathBuf,
    args: Vec<String>,
    workspace_root: PathBuf,
    api_base: String,
    api_key: String,
    api_key_env: String,
    model: String,
}

struct AcpTransport {
    child: std::process::Child,
    stdin: std::process::ChildStdin,
    lines_rx: mpsc::Receiver<Result<String, String>>,
    stderr_rx: mpsc::Receiver<String>,
    initialized: bool,
}

impl AcpTransport {
    fn close(&mut self, display_name: &str, log_stderr: bool) {
        let _ = self.child.kill();
        let _ = self.child.wait();
        if log_stderr {
            let stderr = self
                .stderr_rx
                .recv_timeout(Duration::from_secs(1))
                .unwrap_or_default();
            if !stderr.trim().is_empty() {
                eprintln!("[OmniDesk] {display_name} ACP stderr: {}", stderr.trim());
            }
        }
    }
}

impl Drop for AcpTransport {
    fn drop(&mut self) {
        self.close("Agent", false);
    }
}

struct WarmWorker {
    key: WarmWorkerKey,
    transport: AcpTransport,
}

#[derive(Default)]
struct WarmWorkerPool {
    idle: Vec<WarmWorker>,
    total: usize,
}

static WARM_HERMES_WORKERS: OnceLock<Mutex<WarmWorkerPool>> = OnceLock::new();

enum AcpTransportLease {
    Warm(WarmWorker),
    Cold(AcpTransport),
}

impl AcpTransportLease {
    fn transport_mut(&mut self) -> &mut AcpTransport {
        match self {
            Self::Warm(worker) => &mut worker.transport,
            Self::Cold(transport) => transport,
        }
    }

    fn finish(mut self, display_name: &str, keep_warm: bool) {
        match &mut self {
            Self::Cold(transport) => transport.close(display_name, !keep_warm),
            Self::Warm(_) if keep_warm => {
                let Self::Warm(worker) = self else { unreachable!() };
                let mut pool = WARM_HERMES_WORKERS
                    .get_or_init(|| Mutex::new(WarmWorkerPool::default()))
                    .lock()
                    .expect("常驻 Hermes Worker 锁不可中毒");
                pool.idle.push(worker);
            }
            Self::Warm(worker) => {
                worker.transport.close(display_name, true);
                let mut pool = WARM_HERMES_WORKERS
                    .get_or_init(|| Mutex::new(WarmWorkerPool::default()))
                    .lock()
                    .expect("常驻 Hermes Worker 锁不可中毒");
                pool.total = pool.total.saturating_sub(1);
            }
        }
    }
}

fn initial_context_for_purpose(
    purpose: AgentExecutionPurpose,
    root: &Path,
    prompt: &str,
) -> Result<Value, String> {
    if purpose == AgentExecutionPurpose::ReadonlyPlan {
        let listing = list_files(root, ".")?;
        return Ok(json!({
            "summary": "只提供经过安全过滤的文件索引；未预加载任何源码正文。",
            "excerpts": [],
            "files": listing.get("items").cloned().unwrap_or_else(|| json!([])),
            "truncated": listing.get("truncated").cloned().unwrap_or_else(|| json!(false)),
            "guardrail": "只读规划必须通过经过治理的 read_file 取得真实源码证据后才能完成。",
        }));
    }
    if purpose == AgentExecutionPurpose::RiskReview {
        return build_risk_review_context(root, prompt);
    }
    build_task_context(root, prompt)
}

struct TemporaryHermesHome {
    path: PathBuf,
}

impl TemporaryHermesHome {
    fn readonly(api_base: &str, api_key_env: &str, model: &str) -> Result<Self, String> {
        if api_base.trim().is_empty() || api_key_env.trim().is_empty() || model.trim().is_empty() {
            return Err("Hermes 只读隔离配置缺少模型连接信息".to_string());
        }
        let path = std::env::temp_dir().join(format!(
            "omnidesk-hermes-readonly-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ));
        fs::create_dir_all(&path)
            .map_err(|error| format!("创建 Hermes 只读隔离目录失败：{error}"))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&path, fs::Permissions::from_mode(0o700))
                .map_err(|error| format!("限制 Hermes 只读隔离目录权限失败：{error}"))?;
        }
        let quote =
            |value: &str| serde_json::to_string(value.trim()).map_err(|error| error.to_string());
        let config = format!(
            "model:\n  provider: \"omnidesk-gateway\"\n  base_url: {}\n  api_mode: \"chat_completions\"\n  default: {}\n  key_env: {}\nproviders:\n  omnidesk-gateway:\n    base_url: {}\n    default_model: {}\n    api_mode: \"chat_completions\"\n    key_env: {}\napprovals:\n  mode: \"ask\"\n  deny:\n    - \"*\"\nmcp_servers: {{}}\n",
            quote(api_base)?,
            quote(model)?,
            quote(api_key_env)?,
            quote(api_base)?,
            quote(model)?,
            quote(api_key_env)?,
        );
        fs::write(path.join("config.yaml"), config)
            .map_err(|error| format!("写入 Hermes 只读隔离配置失败：{error}"))?;
        Ok(Self { path })
    }
}

impl Drop for TemporaryHermesHome {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}

fn spawn_acp_transport(
    config: &AcpExecutionConfig,
    root: &Path,
    api_key: &str,
    api_base: &str,
    api_key_env: &str,
    readonly_home: Option<&TemporaryHermesHome>,
) -> Result<AcpTransport, String> {
    let mut command = Command::new(&config.program);
    command
        .args(&config.args)
        .current_dir(root)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(home) = readonly_home {
        command
            .env("HERMES_HOME", &home.path)
            .env("HERMES_EXEC_ASK", "1");
    }
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
    let stdin = child
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
    Ok(AcpTransport { child, stdin, lines_rx, stderr_rx, initialized: false })
}

fn warm_worker_key(
    config: &AcpExecutionConfig,
    root: &Path,
    api_key: &str,
    api_base: &str,
    api_key_env: &str,
    model: &str,
) -> WarmWorkerKey {
    WarmWorkerKey {
        program: config.program.clone(),
        args: config.args.clone(),
        workspace_root: root.to_path_buf(),
        api_base: api_base.to_string(),
        api_key: api_key.to_string(),
        api_key_env: api_key_env.to_string(),
        model: model.to_string(),
    }
}

fn can_use_warm_worker(config: &AcpExecutionConfig) -> bool {
    config.supports_warm_workers
        && matches!(config.purpose, AgentExecutionPurpose::GovernedTask | AgentExecutionPurpose::RiskReview)
}

pub fn warm_hermes_worker_summary() -> String {
    let pool = WARM_HERMES_WORKERS.get_or_init(|| Mutex::new(WarmWorkerPool::default()));
    let state = pool.lock().expect("常驻 Hermes Worker 锁不可中毒");
    let busy = state.total.saturating_sub(state.idle.len());
    format!(
        "常驻 Worker：{} 个空闲、{} 个处理任务，容量 {}。",
        state.idle.len(),
        busy,
        WARM_HERMES_WORKER_LIMIT
    )
}

#[allow(clippy::too_many_arguments)]
pub fn prewarm_acp_worker(
    config: &AcpExecutionConfig,
    root: &Path,
    api_key: &str,
    api_base: &str,
    api_key_env: &str,
    model: &str,
) -> Result<(), String> {
    if !can_use_warm_worker(config) {
        return Ok(());
    }
    let mut lease = acquire_acp_transport(
        config,
        root,
        api_key,
        api_base,
        api_key_env,
        model,
        None,
    )?;
    let result = initialize_acp_transport(lease.transport_mut(), None);
    lease.finish(config.display_name, result.is_ok());
    result
}

fn acquire_acp_transport(
    config: &AcpExecutionConfig,
    root: &Path,
    api_key: &str,
    api_base: &str,
    api_key_env: &str,
    model: &str,
    readonly_home: Option<&TemporaryHermesHome>,
) -> Result<AcpTransportLease, String> {
    if !can_use_warm_worker(config) {
        return spawn_acp_transport(config, root, api_key, api_base, api_key_env, readonly_home)
            .map(AcpTransportLease::Cold);
    }
    let key = warm_worker_key(config, root, api_key, api_base, api_key_env, model);
    let pool = WARM_HERMES_WORKERS.get_or_init(|| Mutex::new(WarmWorkerPool::default()));
    {
        let mut state = pool.lock().expect("常驻 Hermes Worker 锁不可中毒");
        while let Some(index) = state.idle.iter().position(|worker| worker.key == key) {
            let mut worker = state.idle.swap_remove(index);
            if matches!(worker.transport.child.try_wait(), Ok(None)) {
                return Ok(AcpTransportLease::Warm(worker));
            }
            // An idle child can be reclaimed by the OS. Discard it before a
            // task borrows it so the current task can start a replacement.
            worker.transport.close(config.display_name, true);
            state.total = state.total.saturating_sub(1);
        }
        if state.total >= WARM_HERMES_WORKER_LIMIT {
            return spawn_acp_transport(config, root, api_key, api_base, api_key_env, readonly_home)
                .map(AcpTransportLease::Cold);
        }
        state.total += 1;
    }
    match spawn_acp_transport(config, root, api_key, api_base, api_key_env, readonly_home) {
        Ok(transport) => Ok(AcpTransportLease::Warm(WarmWorker { key, transport })),
        Err(error) => {
            let mut state = pool.lock().expect("常驻 Hermes Worker 锁不可中毒");
            state.total = state.total.saturating_sub(1);
            Err(error)
        }
    }
}

fn initialize_acp_transport(
    transport: &mut AcpTransport,
    cancellation: Option<&CancellationToken>,
) -> Result<(), String> {
    if transport.initialized {
        return Ok(());
    }
    write_request(
        &mut transport.stdin,
        1,
        "initialize",
        json!({ "protocolVersion": 1, "clientCapabilities": {}, "clientInfo": { "name": "OmniDesk", "version": "0.1.0" } }),
    )?;
    let mut ignored = String::new();
    wait_for_response(
        &transport.lines_rx,
        &mut transport.stdin,
        1,
        startup_timeouts(),
        &mut ignored,
        cancellation,
    )?;
    transport.initialized = true;
    Ok(())
}

#[cfg(test)]
fn reset_warm_hermes_workers_for_tests() {
    let pool = WARM_HERMES_WORKERS.get_or_init(|| Mutex::new(WarmWorkerPool::default()));
    let mut state = pool.lock().expect("常驻 Hermes Worker 锁不可中毒");
    for mut worker in state.idle.drain(..) {
        worker.transport.close("Hermes", false);
    }
    state.total = 0;
}

fn has_readonly_plan_evidence(purpose: AgentExecutionPurpose, observations: &[Value]) -> bool {
    purpose != AgentExecutionPurpose::ReadonlyPlan
        || observations.iter().any(|observation| {
            observation.get("success").and_then(Value::as_bool) == Some(true)
                && matches!(
                    observation.get("name").and_then(Value::as_str),
                    Some("read_file" | "search_project")
                )
        })
}

#[derive(Clone)]
struct NativeReadCall {
    path: String,
    finished: bool,
}

fn handle_native_readonly_update(
    root: &Path,
    message: &Value,
    calls: &mut HashMap<String, NativeReadCall>,
    observations: &mut Vec<Value>,
    events: &mut Vec<AgentEvent>,
    event_sink: Option<&AgentEventSink>,
    consecutive_read_errors: &mut usize,
) -> Result<(), String> {
    let Some(update) = message.pointer("/params/update") else {
        return Ok(());
    };
    match update.get("sessionUpdate").and_then(Value::as_str) {
        Some("tool_call") => {
            let id = update
                .get("toolCallId")
                .and_then(Value::as_str)
                .filter(|value| !value.trim().is_empty())
                .ok_or_else(|| "Hermes 原生工具事件缺少 toolCallId".to_string())?;
            let kind = update.get("kind").and_then(Value::as_str).unwrap_or("");
            let title = update.get("title").and_then(Value::as_str).unwrap_or("");
            if kind != "read" || !title.starts_with("read:") {
                return Err("只读规划拒绝了 Agent 请求的非读取工具。".to_string());
            }
            let requested_path = update
                .pointer("/locations/0/path")
                .and_then(Value::as_str)
                .ok_or_else(|| "Hermes read_file 事件缺少项目相对路径".to_string())?;
            if calls.contains_key(id) {
                return Err("Hermes 返回重复的原生工具调用标识".to_string());
            }
            crate::runtime::agent_tools::validate_project_relative_path(requested_path)?;
            let validated = match crate::runtime::agent_tools::read_file(
                root,
                requested_path,
                1,
                Some(1),
            ) {
                Ok(validated) => validated,
                Err(error) if error.starts_with("没有找到项目路径：") => {
                    *consecutive_read_errors += 1;
                    let path = requested_path.trim().to_string();
                    calls.insert(
                        id.to_string(),
                        NativeReadCall {
                            path: path.clone(),
                            finished: true,
                        },
                    );
                    observations.push(json!({
                        "name": "read_file",
                        "success": false,
                        "data": { "path": path.clone(), "reason": "path-not-found" },
                    }));
                    push_event(
                        events,
                        event_sink,
                        "tool-call",
                        "tool",
                        "requested",
                        "Agent 请求读取项目文件。",
                        json!({ "name": "read_file", "path": path.clone() }),
                    );
                    push_event(
                        events,
                        event_sink,
                        "tool-result",
                        "tool",
                        "failed",
                        "文件路径不存在，Agent 正在重新查找。",
                        json!({ "name": "read_file", "path": path, "success": false }),
                    );
                    if *consecutive_read_errors > MAX_TOOL_ARGUMENT_RETRIES {
                        return Err(
                            "Agent 连续读取了不存在的项目文件，未能自动找到正确路径。可以重试。"
                                .to_string(),
                        );
                    }
                    return Ok(());
                }
                Err(error) => return Err(error),
            };
            *consecutive_read_errors = 0;
            let path = validated
                .get("path")
                .and_then(Value::as_str)
                .ok_or_else(|| "Hermes read_file 路径校验没有返回安全路径".to_string())?
                .to_string();
            calls.insert(
                id.to_string(),
                NativeReadCall {
                    path: path.clone(),
                    finished: false,
                },
            );
            push_event(
                events,
                event_sink,
                "tool-call",
                "tool",
                "requested",
                "Agent 请求读取项目文件。",
                json!({ "name": "read_file", "path": path }),
            );
        }
        Some("tool_call_update") => {
            let Some(id) = update.get("toolCallId").and_then(Value::as_str) else {
                return Ok(());
            };
            let Some(call) = calls.get_mut(id) else {
                return Ok(());
            };
            if call.finished {
                return Ok(());
            }
            match update.get("status").and_then(Value::as_str) {
                Some("completed") => {
                    call.finished = true;
                    observations.push(json!({
                        "name": "read_file",
                        "success": true,
                        "data": { "path": call.path.clone() },
                    }));
                    push_event(
                        events,
                        event_sink,
                        "tool-result",
                        "tool",
                        "succeeded",
                        "已取得文件内容。",
                        json!({ "name": "read_file", "path": call.path.clone(), "success": true }),
                    );
                }
                Some("failed") => {
                    call.finished = true;
                    *consecutive_read_errors += 1;
                    observations.push(json!({
                        "name": "read_file",
                        "success": false,
                        "data": { "path": call.path.clone() },
                    }));
                    push_event(
                        events,
                        event_sink,
                        "tool-result",
                        "tool",
                        "failed",
                        "文件读取失败。",
                        json!({ "name": "read_file", "path": call.path.clone(), "success": false }),
                    );
                    if *consecutive_read_errors > MAX_TOOL_ARGUMENT_RETRIES {
                        return Err(
                            "Agent 连续读取项目文件失败，未能取得生成计划所需的信息。可以重试。"
                                .to_string(),
                        );
                    }
                }
                _ => {}
            }
        }
        _ => {}
    }
    Ok(())
}

fn startup_timeouts() -> AcpResponseTimeouts {
    AcpResponseTimeouts::new(
        ACP_STARTUP_TIMEOUT,
        ACP_STARTUP_TIMEOUT,
        ACP_STARTUP_TIMEOUT,
    )
}

fn prompt_timeouts() -> AcpResponseTimeouts {
    AcpResponseTimeouts::new(
        ACP_FIRST_RESPONSE_TIMEOUT,
        ACP_STREAM_IDLE_TIMEOUT,
        ACP_PROMPT_MAX_DURATION,
    )
}

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

fn validate_tool_for_purpose(purpose: AgentExecutionPurpose, name: &str) -> Result<(), String> {
    if matches!(purpose, AgentExecutionPurpose::ReadonlyPlan | AgentExecutionPurpose::RiskReview)
        && !matches!(
            name,
            "read_file" | "list_files" | "search_project" | "git_status"
        )
    {
        return Err(format!("只读检查拒绝非读取工具：{name}"));
    }
    Ok(())
}

/// The ACP loop returns an explicit state instead of claiming completion from
/// a successful provider response. The Tauri adapter persists and approves it.
use crate::runtime::agent_executor::{
    AgentEvent, AgentEventSink, AgentExecutionMode, AgentExecutionPurpose, AgentExecutionResult,
};

fn push_event(
    events: &mut Vec<AgentEvent>,
    event_sink: Option<&AgentEventSink>,
    kind: &str,
    phase: &str,
    status: &str,
    summary: impl Into<String>,
    details: Value,
) {
    let event = AgentEvent::new(events.len() + 1, kind, phase, status, summary, details);
    if let Some(sink) = event_sink {
        sink(&event);
    }
    events.push(event);
}

fn push_terminal(
    events: &mut Vec<AgentEvent>,
    event_sink: Option<&AgentEventSink>,
    status: &str,
    step: usize,
    summary: impl Into<String>,
) -> Result<(), String> {
    if events.iter().any(AgentEvent::is_terminal) {
        return Err("Agent Event 已存在终态，拒绝重复封口。".to_string());
    }
    push_event(
        events,
        event_sink,
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
    pub supports_warm_workers: bool,
    pub mode: AgentExecutionMode,
    pub purpose: AgentExecutionPurpose,
    pub native_tool_events: bool,
    pub event_sink: Option<AgentEventSink>,
}

#[allow(clippy::too_many_arguments)]
pub fn run_acp_structured_loop(
    config: AcpExecutionConfig,
    root: &Path,
    api_key: &str,
    api_base: &str,
    api_key_env: &str,
    model: &str,
    prompt: &str,
    max_steps: usize,
    cancellation: Option<&CancellationToken>,
) -> Result<AgentExecutionResult, String> {
    let initial_context = initial_context_for_purpose(config.purpose, root, prompt)?;
    let readonly_hermes_home = (config.native_tool_events
        && config.purpose == AgentExecutionPurpose::ReadonlyPlan)
        .then(|| TemporaryHermesHome::readonly(api_base, api_key_env, model))
        .transpose()?;
    let mut transport_lease = acquire_acp_transport(
        &config,
        root,
        api_key,
        api_base,
        api_key_env,
        model,
        readonly_hermes_home.as_ref(),
    )?;
    if let Err(error) = initialize_acp_transport(transport_lease.transport_mut(), cancellation) {
        transport_lease.finish(config.display_name, false);
        return Err(error);
    }
    let transport = transport_lease.transport_mut();
    let mut stdin = &mut transport.stdin;
    let lines_rx = &transport.lines_rx;
    let context_trace = if config.purpose == AgentExecutionPurpose::ReadonlyPlan {
        "CONTEXT_PACK: source excerpts withheld until explicit read tools run"
    } else {
        "CONTEXT_PACK: bounded read-only project context prepared"
    };
    let mut trace = vec![
        format!("{}_ACP: structured tool loop", config.trace_prefix),
        format!("EXECUTION_MODE: {:?}", config.mode),
        context_trace.to_string(),
    ];
    let mut observations = vec![json!({
        "name": "initial_context",
        "success": true,
        "data": initial_context,
    })];
    let mut events = Vec::new();
    push_event(
        &mut events,
        config.event_sink.as_ref(),
        "lifecycle",
        "model",
        "running",
        "Agent Executor 开始处理。",
        json!({ "mode": format!("{:?}", config.mode) }),
    );
    let mut authorized_patch_files = HashSet::<String>::new();
    let mut envelope_retry_used = false;
    let mut consecutive_tool_argument_errors = 0usize;
    let mut native_read_calls = HashMap::<String, NativeReadCall>::new();
    let mut consecutive_native_read_errors = 0usize;
    let mut usage = ProviderUsage::default();
    let result = (|| -> Result<AgentExecutionResult, String> {
        let mut ignored = String::new();
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
            startup_timeouts(),
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
        let native_readonly =
            config.native_tool_events && config.purpose == AgentExecutionPurpose::ReadonlyPlan;
        let instruction = if native_readonly {
            format!("{}\n\nSafe project file index (paths only; no source contents): {}\n\nThis is a strictly read-only planning run. Use Hermes' native read_file tool to inspect the minimum real source context. Do not use search_files, terminal, process, execute_code, write_file, patch, web, browser, memory, skills, delegation, MCP, or any other tool. All commands and code execution are blocked by the isolated runtime config. After at least one successful read_file call, return ONLY {{\"type\":\"final\",\"result\":{{...}}}} matching the requested plan shape. Do not return a synthetic tool_call envelope and do not explain outside JSON.", prompt, initial_context_text)
        } else {
            let tool_contracts =
                serde_json::to_string(&builtin_registry()).unwrap_or_else(|_| "{}".to_string());
            let policy = if config.purpose == AgentExecutionPurpose::ReadonlyPlan {
                "This is a strictly read-only planning run. No source contents were preloaded. You may only request read_file, list_files, search_project, or git_status. Never request ask_user, apply_patch, run_check, terminal, or any write/execute tool. You must successfully use read_file or search_project before returning the final plan JSON; a final response without that evidence will be rejected."
            } else if config.purpose == AgentExecutionPurpose::RiskReview {
                "This is a bounded read-only risk review. Inspect only the minimum project context needed to identify concrete risks. You may only request read_file, list_files, search_project, or git_status. Never request ask_user, apply_patch, run_check, terminal, or any write/execute tool. Return a final result once the risks are supported by the collected evidence."
            } else {
                "The initial context is informational only and does not authorize a patch: before requesting apply_patch, explicitly call read_file for every file you intend to modify. If a required product decision is missing, use ask_user. Patch and checks require independent approval."
            };
            format!("{}\n\nInitial read-only project context: {}\n\nRegistered read-only tool contracts: {}\n\nYou are a governed executor. Return ONLY JSON. For project context use {{\"type\":\"tool_call\",\"name\":\"read_file|list_files|search_project|git_status\",\"arguments\":{{...}}}} and follow the registered schemas exactly. {} When enough context is available return {{\"type\":\"final\",\"result\":{{...}}}}. Never call tools directly.", prompt, initial_context_text, tool_contracts, policy)
        };
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
            let prompt_response = if native_readonly {
                wait_for_response_with_updates(
                    &lines_rx,
                    &mut stdin,
                    request_id,
                    prompt_timeouts(),
                    &mut agent_text,
                    cancellation,
                    |message| {
                        handle_native_readonly_update(
                            root,
                            message,
                            &mut native_read_calls,
                            &mut observations,
                            &mut events,
                            config.event_sink.as_ref(),
                            &mut consecutive_native_read_errors,
                        )
                    },
                )?
            } else {
                wait_for_response(
                    &lines_rx,
                    &mut stdin,
                    request_id,
                    prompt_timeouts(),
                    &mut agent_text,
                    cancellation,
                )?
            };
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
                            "text": if native_readonly {
                                "Your previous response did not match the required final envelope. Return exactly one JSON object now with type `final` and the requested result. Do not call another tool, explain, or use markdown fences."
                            } else {
                                "Your previous response did not match the required envelope. Return exactly one JSON object now. Its type must be either `tool_call` with name and arguments, or `final` with result. Do not explain, do not use markdown fences, and do not perform any operation outside that JSON response."
                            }
                        }]
                    }),
                )?;
                let mut corrected_text = String::new();
                let corrected_response = if native_readonly {
                    wait_for_response_with_updates(
                        &lines_rx,
                        &mut stdin,
                        request_id + 1,
                        prompt_timeouts(),
                        &mut corrected_text,
                        cancellation,
                        |message| {
                            handle_native_readonly_update(
                                root,
                                message,
                                &mut native_read_calls,
                                &mut observations,
                                &mut events,
                                config.event_sink.as_ref(),
                                &mut consecutive_native_read_errors,
                            )
                        },
                    )?
                } else {
                    wait_for_response(
                        &lines_rx,
                        &mut stdin,
                        request_id + 1,
                        prompt_timeouts(),
                        &mut corrected_text,
                        cancellation,
                    )?
                };
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
                if !has_readonly_plan_evidence(config.purpose, &observations) {
                    trace.push(format!(
                        "{}_STEP: {} final rejected without source evidence",
                        config.trace_prefix,
                        step + 1
                    ));
                    next_prompt = if native_readonly {
                        "No governed source evidence has been collected. Use exactly one native read_file call on a safe relative path from the supplied index, then return the final JSON envelope.".to_string()
                    } else {
                        "No source evidence has been collected. Before returning a final plan, request exactly one valid read_file or search_project tool call for the real project context. Do not return final yet.".to_string()
                    };
                    continue;
                }
                trace.push(format!("{}_STEP: {} final", config.trace_prefix, step + 1));
                let summary = format!("{} 已完成结构化推理。", config.display_name);
                push_terminal(
                    &mut events,
                    config.event_sink.as_ref(),
                    "succeeded",
                    step + 1,
                    &summary,
                )?;
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
            validate_tool_for_purpose(config.purpose, name)?;
            trace.push(format!(
                "{}_STEP: {} tool {}",
                config.trace_prefix,
                step + 1,
                name
            ));
            push_event(
                &mut events,
                config.event_sink.as_ref(),
                "tool-call",
                "tool",
                "requested",
                format!("Agent 请求工具 {name}。"),
                json!({
                    "name": name,
                    "step": step + 1,
                    "path": args.get("path").and_then(Value::as_str),
                }),
            );
            if name == "ask_user" {
                let interaction =
                    crate::runtime::agent_runs::validate_ask_user_interaction(&args, step + 1)?;
                push_terminal(
                    &mut events,
                    config.event_sink.as_ref(),
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
                    config.event_sink.as_ref(),
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
                    push_terminal(
                        &mut events,
                        config.event_sink.as_ref(),
                        "failed",
                        step + 1,
                        "工具参数连续纠正失败。",
                    )?;
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
                config.event_sink.as_ref(),
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
        push_terminal(
            &mut events,
            config.event_sink.as_ref(),
            "budget-exceeded",
            max_steps.max(1),
            &summary,
        )?;
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
    transport_lease.finish(config.display_name, result.is_ok());
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
        use std::sync::atomic::{AtomicU64, Ordering};
        // macOS clock readings can coincide across parallel test threads.
        // A process-local sequence prevents one test deleting another's fixture.
        static NEXT_FIXTURE: AtomicU64 = AtomicU64::new(0);
        let root = std::env::temp_dir().join(format!(
            "omnidesk-acp-executor-{}-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos(),
            NEXT_FIXTURE.fetch_add(1, Ordering::Relaxed)
        ));
        std::fs::create_dir(&root).unwrap();
        std::fs::write(root.join("README.md"), "fixture\n").unwrap();
        let program = root.join("fixture-acp.sh");
        std::fs::write(
            &program,
            r#"#!/bin/sh
while IFS= read -r line; do
  case "$line" in
    *'"id":1'*) printf 'initialized\n' >> init.count; printf '%s\n' '{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":1}}' ;;
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
    fn readonly_plan_allows_only_registered_read_tools() {
        for name in ["read_file", "list_files", "search_project", "git_status"] {
            validate_tool_for_purpose(AgentExecutionPurpose::ReadonlyPlan, name).unwrap();
        }
        for name in ["ask_user", "apply_patch", "run_check", "terminal"] {
            assert!(validate_tool_for_purpose(AgentExecutionPurpose::ReadonlyPlan, name).is_err());
        }
        validate_tool_for_purpose(AgentExecutionPurpose::GovernedTask, "apply_patch").unwrap();
    }

    #[test]
    fn risk_review_allows_only_registered_read_tools() {
        for name in ["read_file", "list_files", "search_project", "git_status"] {
            validate_tool_for_purpose(AgentExecutionPurpose::RiskReview, name).unwrap();
        }
        for name in ["ask_user", "apply_patch", "run_check", "terminal"] {
            assert!(validate_tool_for_purpose(AgentExecutionPurpose::RiskReview, name).is_err());
        }
    }

    #[test]
    fn readonly_plan_requires_successful_source_evidence_before_final() {
        let root = std::env::temp_dir();
        let initial = initial_context_for_purpose(
            AgentExecutionPurpose::ReadonlyPlan,
            &root,
            "inspect status bar",
        )
        .unwrap();
        assert_eq!(initial["excerpts"], json!([]));
        assert!(!has_readonly_plan_evidence(
            AgentExecutionPurpose::ReadonlyPlan,
            &[json!({ "name": "initial_context", "success": true, "data": initial })],
        ));
        assert!(!has_readonly_plan_evidence(
            AgentExecutionPurpose::ReadonlyPlan,
            &[json!({ "name": "list_files", "success": true })],
        ));
        assert!(has_readonly_plan_evidence(
            AgentExecutionPurpose::ReadonlyPlan,
            &[json!({ "name": "read_file", "success": true })],
        ));
        assert!(has_readonly_plan_evidence(
            AgentExecutionPurpose::ReadonlyPlan,
            &[json!({ "name": "search_project", "success": true })],
        ));
        assert!(has_readonly_plan_evidence(
            AgentExecutionPurpose::GovernedTask,
            &[],
        ));
    }

    #[test]
    fn readonly_hermes_home_blocks_commands_and_has_no_mcp_servers() {
        let home = TemporaryHermesHome::readonly(
            "https://example.invalid/v1",
            "TEST_API_KEY",
            "test-model",
        )
        .unwrap();
        let path = home.path.clone();
        let config = std::fs::read_to_string(path.join("config.yaml")).unwrap();
        assert!(config.contains("deny:\n    - \"*\""));
        assert!(config.contains("mcp_servers: {}"));
        assert!(config.contains("providers:\n  omnidesk-gateway:"));
        assert!(config.contains("key_env: \"TEST_API_KEY\""));
        assert!(!config.contains("secret"));
        drop(home);
        assert!(!path.exists());
    }

    #[test]
    fn native_readonly_events_accept_safe_reads_and_reject_other_tools() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-native-read-event-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ));
        std::fs::create_dir_all(root.join("src")).unwrap();
        std::fs::write(
            root.join("src/status.rs"),
            "pub const STATUS: &str = \"ready\";\n",
        )
        .unwrap();
        std::fs::write(root.join(".env.local"), "SECRET=value\n").unwrap();

        let mut calls = HashMap::new();
        let mut observations = Vec::new();
        let mut events = Vec::new();
        let mut consecutive_read_errors = 0usize;
        handle_native_readonly_update(
            &root,
            &json!({
                "method": "session/update",
                "params": { "update": {
                    "sessionUpdate": "tool_call",
                    "toolCallId": "read-1",
                    "kind": "read",
                    "title": "read: src/status.rs",
                    "locations": [{ "path": "src/status.rs" }]
                }}
            }),
            &mut calls,
            &mut observations,
            &mut events,
            None,
            &mut consecutive_read_errors,
        )
        .unwrap();
        handle_native_readonly_update(
            &root,
            &json!({
                "method": "session/update",
                "params": { "update": {
                    "sessionUpdate": "tool_call_update",
                    "toolCallId": "read-1",
                    "kind": "read",
                    "status": "completed"
                }}
            }),
            &mut calls,
            &mut observations,
            &mut events,
            None,
            &mut consecutive_read_errors,
        )
        .unwrap();
        assert_eq!(
            events
                .iter()
                .map(|event| event.kind.as_str())
                .collect::<Vec<_>>(),
            vec!["tool-call", "tool-result"]
        );
        assert!(has_readonly_plan_evidence(
            AgentExecutionPurpose::ReadonlyPlan,
            &observations,
        ));

        let terminal = json!({
            "method": "session/update",
            "params": { "update": {
                "sessionUpdate": "tool_call",
                "toolCallId": "terminal-1",
                "kind": "execute",
                "title": "terminal: ls",
                "locations": []
            }}
        });
        assert!(handle_native_readonly_update(
            &root,
            &terminal,
            &mut calls,
            &mut observations,
            &mut events,
            None,
            &mut consecutive_read_errors,
        )
        .is_err());

        let secret = json!({
            "method": "session/update",
            "params": { "update": {
                "sessionUpdate": "tool_call",
                "toolCallId": "read-secret",
                "kind": "read",
                "title": "read: .env.local",
                "locations": [{ "path": ".env.local" }]
            }}
        });
        assert!(handle_native_readonly_update(
            &root,
            &secret,
            &mut calls,
            &mut observations,
            &mut events,
            None,
            &mut consecutive_read_errors,
        )
        .is_err());
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn native_readonly_missing_path_is_repairable_and_corrected_read_becomes_evidence() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-native-read-repair-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ));
        std::fs::create_dir_all(root.join("desktop/tests")).unwrap();
        std::fs::write(
            root.join("desktop/tests/conversation-agent-events.test.mjs"),
            "test('fixture', () => {});\n",
        )
        .unwrap();
        let mut calls = HashMap::new();
        let mut observations = Vec::new();
        let mut events = Vec::new();
        let mut consecutive_read_errors = 0usize;

        let wrong_path = json!({
            "method": "session/update",
            "params": { "update": {
                "sessionUpdate": "tool_call",
                "toolCallId": "read-wrong-suffix",
                "kind": "read",
                "title": "read: desktop/tests/conversation-agent-events.test.js",
                "locations": [{ "path": "desktop/tests/conversation-agent-events.test.js" }]
            }}
        });
        handle_native_readonly_update(
            &root,
            &wrong_path,
            &mut calls,
            &mut observations,
            &mut events,
            None,
            &mut consecutive_read_errors,
        )
        .expect("a safe missing path should be repairable");
        assert_eq!(consecutive_read_errors, 1);
        assert_eq!(observations.last().unwrap()["success"], false);
        assert_eq!(events.last().unwrap().status, "failed");

        let corrected_path = json!({
            "method": "session/update",
            "params": { "update": {
                "sessionUpdate": "tool_call",
                "toolCallId": "read-corrected-suffix",
                "kind": "read",
                "title": "read: desktop/tests/conversation-agent-events.test.mjs",
                "locations": [{ "path": "desktop/tests/conversation-agent-events.test.mjs" }]
            }}
        });
        handle_native_readonly_update(
            &root,
            &corrected_path,
            &mut calls,
            &mut observations,
            &mut events,
            None,
            &mut consecutive_read_errors,
        )
        .unwrap();
        handle_native_readonly_update(
            &root,
            &json!({
                "method": "session/update",
                "params": { "update": {
                    "sessionUpdate": "tool_call_update",
                    "toolCallId": "read-corrected-suffix",
                    "status": "completed"
                }}
            }),
            &mut calls,
            &mut observations,
            &mut events,
            None,
            &mut consecutive_read_errors,
        )
        .unwrap();
        assert_eq!(consecutive_read_errors, 0);
        assert!(has_readonly_plan_evidence(
            AgentExecutionPurpose::ReadonlyPlan,
            &observations,
        ));
        assert_eq!(
            events
                .iter()
                .filter(|event| event.kind == "terminal")
                .count(),
            0
        );
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn native_readonly_missing_path_correction_has_a_bounded_budget() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-native-read-budget-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ));
        std::fs::create_dir_all(&root).unwrap();
        let mut calls = HashMap::new();
        let mut observations = Vec::new();
        let mut events = Vec::new();
        let mut consecutive_read_errors = 0usize;
        for attempt in 0..=MAX_TOOL_ARGUMENT_RETRIES {
            let result = handle_native_readonly_update(
                &root,
                &json!({
                    "method": "session/update",
                    "params": { "update": {
                        "sessionUpdate": "tool_call",
                        "toolCallId": format!("missing-{attempt}"),
                        "kind": "read",
                        "title": "read: missing.rs",
                        "locations": [{ "path": format!("missing-{attempt}.rs") }]
                    }}
                }),
                &mut calls,
                &mut observations,
                &mut events,
                None,
                &mut consecutive_read_errors,
            );
            if attempt < MAX_TOOL_ARGUMENT_RETRIES {
                assert!(result.is_ok());
            } else {
                let error = result.unwrap_err();
                assert!(error.contains("未能自动找到正确路径"));
                assert!(!error.contains("missing-"));
            }
        }
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn event_log_rejects_a_second_terminal_state() {
        let mut events = Vec::new();
        push_terminal(&mut events, None, "succeeded", 1, "done").unwrap();
        assert!(push_terminal(&mut events, None, "failed", 1, "late").is_err());
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
                supports_warm_workers: false,
                mode: AgentExecutionMode::Resume,
                purpose: AgentExecutionPurpose::GovernedTask,
                native_tool_events: false,
                event_sink: None,
            },
            &root,
            "",
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
                supports_warm_workers: false,
                mode: AgentExecutionMode::Start,
                purpose: AgentExecutionPurpose::GovernedTask,
                native_tool_events: false,
                event_sink: None,
            },
            &root,
            "",
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

    #[cfg(unix)]
    #[test]
    fn warm_hermes_worker_reuses_one_process_for_independent_sessions() {
        reset_warm_hermes_workers_for_tests();
        let (root, program) = acp_fixture();
        let config = || AcpExecutionConfig {
            executor_id: "hermes-acp",
            display_name: "Hermes",
            trace_prefix: "HERMES",
            program: program.clone(),
            args: Vec::new(),
            forward_provider_env: false,
            supports_warm_workers: true,
            mode: AgentExecutionMode::Start,
            purpose: AgentExecutionPurpose::GovernedTask,
            native_tool_events: true,
            event_sink: None,
        };
        run_acp_structured_loop(config(), &root, "", "", "", "", "first", 1, None).unwrap();
        run_acp_structured_loop(config(), &root, "", "", "", "", "second", 1, None).unwrap();
        let initialized = std::fs::read_to_string(root.join("init.count")).unwrap();
        assert_eq!(initialized.lines().count(), 1);
        assert!(warm_hermes_worker_summary().contains("1 个空闲"));
        reset_warm_hermes_workers_for_tests();
        let _ = std::fs::remove_dir_all(root);
    }

    #[cfg(unix)]
    #[test]
    fn warm_hermes_worker_rebuilds_an_idle_process_that_has_exited() {
        reset_warm_hermes_workers_for_tests();
        let (root, program) = acp_fixture();
        let config = || AcpExecutionConfig {
            executor_id: "hermes-acp",
            display_name: "Hermes",
            trace_prefix: "HERMES",
            program: program.clone(),
            args: Vec::new(),
            forward_provider_env: false,
            supports_warm_workers: true,
            mode: AgentExecutionMode::Start,
            purpose: AgentExecutionPurpose::GovernedTask,
            native_tool_events: true,
            event_sink: None,
        };
        run_acp_structured_loop(config(), &root, "", "", "", "", "first", 1, None).unwrap();
        {
            let pool = WARM_HERMES_WORKERS.get_or_init(|| Mutex::new(WarmWorkerPool::default()));
            let mut state = pool.lock().unwrap();
            let worker = state.idle.first_mut().unwrap();
            worker.transport.child.kill().unwrap();
            worker.transport.child.wait().unwrap();
        }
        run_acp_structured_loop(config(), &root, "", "", "", "", "second", 1, None).unwrap();
        let initialized = std::fs::read_to_string(root.join("init.count")).unwrap();
        assert_eq!(initialized.lines().count(), 2);
        assert!(warm_hermes_worker_summary().contains("1 个空闲"));
        reset_warm_hermes_workers_for_tests();
        let _ = std::fs::remove_dir_all(root);
    }
}
