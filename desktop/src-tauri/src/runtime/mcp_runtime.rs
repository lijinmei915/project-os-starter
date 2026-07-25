use crate::runtime::repository::{JsonMutation, Repository};
use crate::runtime::tool_registry::{
    validate_descriptor, ToolDescriptor, ToolRisk, ToolSource, TOOL_DESCRIPTOR_SCHEMA,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashSet;
use std::io::{BufRead, BufReader, Write};
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::time::{Duration, Instant};
use tokio_util::sync::CancellationToken;

pub const MCP_SERVERS_SCHEMA: &str = "omnidesk.mcp-servers.v0.1";
pub const MCP_SERVER_SCHEMA: &str = "omnidesk.mcp-server.v0.1";
pub const MCP_DISCOVERY_EVIDENCE_SCHEMA: &str = "omnidesk.mcp-discovery-evidence.v0.1";
const MCP_SERVERS_PATH: &str = ".omnidesk/data/mcp-servers.json";
const MCP_DISCOVERY_TIMEOUT: Duration = Duration::from_secs(10);
const MCP_MAX_LINE_BYTES: usize = 256 * 1024;
const MCP_MAX_OUTPUT_BYTES: usize = 1024 * 1024;
const MCP_MAX_TOOLS: usize = 100;
const MCP_MAX_PAGES: usize = 4;

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpEnvBinding {
    pub name: String,
    pub source_env: String,
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpServerConfig {
    #[serde(default = "server_schema")]
    pub schema_version: String,
    pub id: String,
    pub name: String,
    #[serde(default = "stdio_transport")]
    pub transport: String,
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: Vec<McpEnvBinding>,
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "always_approval")]
    pub approval_policy: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpServerRegistry {
    pub schema_version: String,
    #[serde(default)]
    pub servers: Vec<McpServerConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpDiscoveredTool {
    pub server_id: String,
    pub remote_name: String,
    pub descriptor: ToolDescriptor,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpDiscoveryResult {
    pub server_id: String,
    pub protocol_version: String,
    pub tools: Vec<McpDiscoveredTool>,
    pub truncated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpDiscoveryEvidence {
    pub schema_version: String,
    pub project_id: String,
    pub server_id: String,
    pub server_revision: Value,
    pub discovered_at: String,
    pub result: McpDiscoveryResult,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpCallResult {
    pub server_id: String,
    pub remote_name: String,
    pub content: Value,
    pub is_error: bool,
}

pub fn load(root: &Path) -> Result<McpServerRegistry, String> {
    let registry = Repository::new(root)
        .read_json(MCP_SERVERS_PATH)
        .map(|value| serde_json::from_value(value).map_err(|error| error.to_string()))
        .transpose()?
        .unwrap_or_else(empty_registry);
    validate_registry(&registry)?;
    Ok(registry)
}

pub fn save(root: &Path, server: McpServerConfig) -> Result<McpServerRegistry, String> {
    validate_server(&server)?;
    Repository::new(root).transaction_with("save-mcp-server", |repository| {
        let mut registry = repository
            .read_json(MCP_SERVERS_PATH)
            .map(|value| serde_json::from_value(value).map_err(|error| error.to_string()))
            .transpose()?
            .unwrap_or_else(empty_registry);
        registry.schema_version = MCP_SERVERS_SCHEMA.to_string();
        if let Some(existing) = registry
            .servers
            .iter_mut()
            .find(|item| item.id == server.id)
        {
            *existing = server.clone();
        } else {
            registry.servers.push(server.clone());
        }
        registry
            .servers
            .sort_by(|left, right| left.id.cmp(&right.id));
        validate_registry(&registry)?;
        Ok((
            registry.clone(),
            vec![JsonMutation::upsert(
                MCP_SERVERS_PATH,
                serde_json::to_value(&registry).map_err(|error| error.to_string())?,
            )],
        ))
    })
}

pub fn remove(root: &Path, id: &str) -> Result<McpServerRegistry, String> {
    let id = id.trim();
    if !valid_id(id) {
        return Err("MCP Server ID 无效".to_string());
    }
    Repository::new(root).transaction_with("remove-mcp-server", |repository| {
        let mut registry = repository
            .read_json(MCP_SERVERS_PATH)
            .map(|value| serde_json::from_value(value).map_err(|error| error.to_string()))
            .transpose()?
            .unwrap_or_else(empty_registry);
        let before = registry.servers.len();
        registry.servers.retain(|server| server.id != id);
        if registry.servers.len() == before {
            return Err("未找到 MCP Server".to_string());
        }
        Ok((
            registry.clone(),
            vec![JsonMutation::upsert(
                MCP_SERVERS_PATH,
                serde_json::to_value(&registry).map_err(|error| error.to_string())?,
            )],
        ))
    })
}

pub fn discover_tools(
    state_root: &Path,
    project_root: &Path,
    server_id: &str,
    cancellation: Option<&CancellationToken>,
) -> Result<McpDiscoveryResult, String> {
    let registry = load(state_root)?;
    let server = registry
        .servers
        .into_iter()
        .find(|server| server.id == server_id.trim())
        .ok_or_else(|| "未找到 MCP Server".to_string())?;
    if !server.enabled {
        return Err("MCP Server 尚未启用".to_string());
    }
    validate_server(&server)?;
    let mut command = Command::new(&server.command);
    command
        .args(&server.args)
        .current_dir(project_root)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    for binding in &server.env {
        let value = std::env::var(&binding.source_env)
            .map_err(|_| format!("MCP 环境变量未配置：{}", binding.source_env))?;
        command.env(&binding.name, value);
    }
    let mut child = command
        .spawn()
        .map_err(|error| format!("MCP Server 启动失败：{error}"))?;
    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| "MCP stdin 不可用".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "MCP stdout 不可用".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "MCP stderr 不可用".to_string())?;
    let (tx, rx) = mpsc::channel::<Result<Value, String>>();
    std::thread::spawn(move || {
        let mut total = 0usize;
        for line in BufReader::new(stdout).lines() {
            let line = match line {
                Ok(value) => value,
                Err(error) => {
                    let _ = tx.send(Err(error.to_string()));
                    return;
                }
            };
            total = total.saturating_add(line.len());
            if line.len() > MCP_MAX_LINE_BYTES || total > MCP_MAX_OUTPUT_BYTES {
                let _ = tx.send(Err("MCP 输出超过安全上限".to_string()));
                return;
            }
            if line.trim().is_empty() {
                continue;
            }
            let _ = tx.send(
                serde_json::from_str(&line)
                    .map_err(|_| "MCP stdout 包含非 JSON-RPC 内容".to_string()),
            );
        }
    });
    let (stderr_tx, stderr_rx) = mpsc::channel::<String>();
    std::thread::spawn(move || {
        let text = BufReader::new(stderr)
            .lines()
            .take(100)
            .filter_map(Result::ok)
            .collect::<Vec<_>>()
            .join("\n");
        let _ = stderr_tx.send(text.chars().take(4000).collect());
    });

    let deadline = Instant::now() + MCP_DISCOVERY_TIMEOUT;
    let result = (|| -> Result<McpDiscoveryResult, String> {
        write_rpc(
            &mut stdin,
            &json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": { "name": "OmniDesk", "version": "0.1.0" }
                }
            }),
        )?;
        let initialized = wait_for_rpc(&rx, 1, deadline, cancellation)?;
        let protocol_version = initialized
            .pointer("/result/protocolVersion")
            .and_then(Value::as_str)
            .unwrap_or("2024-11-05")
            .to_string();
        write_rpc(
            &mut stdin,
            &json!({ "jsonrpc": "2.0", "method": "notifications/initialized" }),
        )?;

        let mut tools = Vec::new();
        let mut cursor = None::<String>;
        let mut truncated = false;
        for page in 0..MCP_MAX_PAGES {
            let id = 2 + page as u64;
            let params = cursor
                .as_ref()
                .map(|cursor| json!({ "cursor": cursor }))
                .unwrap_or_else(|| json!({}));
            write_rpc(
                &mut stdin,
                &json!({ "jsonrpc": "2.0", "id": id, "method": "tools/list", "params": params }),
            )?;
            let response = wait_for_rpc(&rx, id, deadline, cancellation)?;
            let page_tools = response
                .pointer("/result/tools")
                .and_then(Value::as_array)
                .ok_or_else(|| "MCP tools/list 缺少 tools".to_string())?;
            for tool in page_tools {
                if tools.len() >= MCP_MAX_TOOLS {
                    truncated = true;
                    break;
                }
                tools.push(discovered_tool(&server.id, tool)?);
            }
            if truncated {
                break;
            }
            cursor = response
                .pointer("/result/nextCursor")
                .and_then(Value::as_str)
                .filter(|value| !value.is_empty())
                .map(str::to_string);
            if cursor.is_none() {
                break;
            }
            if page + 1 == MCP_MAX_PAGES {
                truncated = true;
            }
        }
        let mut names = HashSet::new();
        if tools
            .iter()
            .any(|tool| !names.insert(tool.descriptor.name.as_str()))
        {
            return Err("MCP 工具规范化后名称冲突".to_string());
        }
        Ok(McpDiscoveryResult {
            server_id: server.id.clone(),
            protocol_version,
            tools,
            truncated,
        })
    })();
    let _ = child.kill();
    let _ = child.wait();
    result.map_err(|error| {
        let stderr = stderr_rx
            .recv_timeout(Duration::from_millis(100))
            .unwrap_or_default();
        if stderr.is_empty() {
            error
        } else {
            format!("{error}；MCP: {stderr}")
        }
    })
}

pub fn save_discovery_evidence(
    root: &Path,
    project_id: &str,
    result: McpDiscoveryResult,
    timestamp: &str,
) -> Result<McpDiscoveryEvidence, String> {
    let server = configured_server(root, &result.server_id)?;
    let evidence = McpDiscoveryEvidence {
        schema_version: MCP_DISCOVERY_EVIDENCE_SCHEMA.to_string(),
        project_id: project_id.to_string(),
        server_id: result.server_id.clone(),
        server_revision: server_revision(&server),
        discovered_at: timestamp.to_string(),
        result,
    };
    Repository::new(root).transaction(
        "save-mcp-discovery-evidence",
        &[JsonMutation::upsert(
            discovery_evidence_path(&evidence.server_id)?,
            serde_json::to_value(&evidence).map_err(|error| error.to_string())?,
        )],
    )?;
    Ok(evidence)
}

/// Returns discovery evidence only while it is still bound to the active
/// project and the exact current server configuration. Stale evidence remains
/// on disk for audit purposes but is not exposed as callable capability.
pub fn load_valid_discovery_evidence(
    root: &Path,
    project_id: &str,
    server_id: &str,
) -> Result<Option<McpDiscoveryEvidence>, String> {
    let server = configured_server(root, server_id)?;
    let Some(value) = Repository::new(root).read_json(&discovery_evidence_path(server_id)?) else {
        return Ok(None);
    };
    let evidence: McpDiscoveryEvidence =
        serde_json::from_value(value).map_err(|_| "MCP 发现证据损坏。".to_string())?;
    if evidence.schema_version != MCP_DISCOVERY_EVIDENCE_SCHEMA
        || evidence.project_id != project_id
        || evidence.server_id != server_id
        || evidence.server_revision != server_revision(&server)
    {
        return Ok(None);
    }
    Ok(Some(evidence))
}

pub fn discovered_tool_for_call(
    root: &Path,
    project_id: &str,
    server_id: &str,
    remote_name: &str,
    arguments: &Value,
) -> Result<McpDiscoveredTool, String> {
    let evidence =
        load_valid_discovery_evidence(root, project_id, server_id)?.ok_or_else(|| {
            "MCP 工具尚未发现、发现证据已过期或属于其他项目，请重新发现。".to_string()
        })?;
    let tool = evidence
        .result
        .tools
        .into_iter()
        .find(|tool| tool.remote_name == remote_name)
        .ok_or_else(|| "MCP 工具不在最近一次发现证据中。".to_string())?;
    validate_json_schema(&tool.descriptor.input_schema, arguments, "arguments")?;
    Ok(tool)
}

pub fn call_tool(
    state_root: &Path,
    project_root: &Path,
    project_id: &str,
    server_id: &str,
    remote_name: &str,
    arguments: &Value,
    cancellation: Option<&CancellationToken>,
) -> Result<McpCallResult, String> {
    discovered_tool_for_call(state_root, project_id, server_id, remote_name, arguments)?;
    let server = configured_server(state_root, server_id)?;
    let mut child = configured_command(&server, project_root)?
        .spawn()
        .map_err(|error| format!("MCP Server 启动失败：{error}"))?;
    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| "MCP stdin 不可用".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "MCP stdout 不可用".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "MCP stderr 不可用".to_string())?;
    let rx = bounded_stdout(stdout);
    let stderr_rx = bounded_stderr(stderr);
    let deadline = Instant::now() + MCP_DISCOVERY_TIMEOUT;
    let result = (|| -> Result<McpCallResult, String> {
        initialize_session(&mut stdin, &rx, deadline, cancellation)?;
        write_rpc(
            &mut stdin,
            &json!({
                "jsonrpc": "2.0", "id": 2, "method": "tools/call",
                "params": { "name": remote_name, "arguments": arguments }
            }),
        )?;
        let response = wait_for_rpc(&rx, 2, deadline, cancellation)?;
        let content = response
            .pointer("/result/content")
            .cloned()
            .unwrap_or(Value::Null);
        let encoded = serde_json::to_vec(&content).map_err(|error| error.to_string())?;
        if encoded.len() > MCP_MAX_OUTPUT_BYTES {
            return Err("MCP 工具结果超过安全上限".to_string());
        }
        Ok(McpCallResult {
            server_id: server.id.clone(),
            remote_name: remote_name.to_string(),
            content,
            is_error: response
                .pointer("/result/isError")
                .and_then(Value::as_bool)
                .unwrap_or(false),
        })
    })();
    let _ = child.kill();
    let _ = child.wait();
    result.map_err(|error| append_stderr(error, &stderr_rx))
}

fn configured_server(root: &Path, server_id: &str) -> Result<McpServerConfig, String> {
    let server = load(root)?
        .servers
        .into_iter()
        .find(|server| server.id == server_id.trim())
        .ok_or_else(|| "未找到 MCP Server".to_string())?;
    if !server.enabled {
        return Err("MCP Server 尚未启用".to_string());
    }
    validate_server(&server)?;
    Ok(server)
}

fn server_revision(server: &McpServerConfig) -> Value {
    json!({
        "schemaVersion": server.schema_version,
        "transport": server.transport,
        "command": server.command,
        "args": server.args,
        "env": server.env,
        "enabled": server.enabled,
        "approvalPolicy": server.approval_policy,
    })
}

fn discovery_evidence_path(server_id: &str) -> Result<String, String> {
    if !valid_id(server_id) {
        return Err("MCP Server ID 无效".to_string());
    }
    Ok(format!(".omnidesk/cache/mcp-discovery/{server_id}.json"))
}

fn configured_command(server: &McpServerConfig, project_root: &Path) -> Result<Command, String> {
    let mut command = Command::new(&server.command);
    command
        .args(&server.args)
        .current_dir(project_root)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    for binding in &server.env {
        let value = std::env::var(&binding.source_env)
            .map_err(|_| format!("MCP 环境变量未配置：{}", binding.source_env))?;
        command.env(&binding.name, value);
    }
    Ok(command)
}

fn bounded_stdout(stdout: std::process::ChildStdout) -> mpsc::Receiver<Result<Value, String>> {
    let (tx, rx) = mpsc::channel::<Result<Value, String>>();
    std::thread::spawn(move || {
        let mut total = 0usize;
        for line in BufReader::new(stdout).lines() {
            let line = match line {
                Ok(value) => value,
                Err(error) => {
                    let _ = tx.send(Err(error.to_string()));
                    return;
                }
            };
            total = total.saturating_add(line.len());
            if line.len() > MCP_MAX_LINE_BYTES || total > MCP_MAX_OUTPUT_BYTES {
                let _ = tx.send(Err("MCP 输出超过安全上限".to_string()));
                return;
            }
            if !line.trim().is_empty() {
                let _ = tx.send(
                    serde_json::from_str(&line)
                        .map_err(|_| "MCP stdout 包含非 JSON-RPC 内容".to_string()),
                );
            }
        }
    });
    rx
}

fn bounded_stderr(stderr: std::process::ChildStderr) -> mpsc::Receiver<String> {
    let (tx, rx) = mpsc::channel::<String>();
    std::thread::spawn(move || {
        let text = BufReader::new(stderr)
            .lines()
            .take(100)
            .filter_map(Result::ok)
            .collect::<Vec<_>>()
            .join("\n");
        let _ = tx.send(text.chars().take(4000).collect());
    });
    rx
}

fn initialize_session(
    stdin: &mut impl Write,
    receiver: &mpsc::Receiver<Result<Value, String>>,
    deadline: Instant,
    cancellation: Option<&CancellationToken>,
) -> Result<(), String> {
    write_rpc(
        stdin,
        &json!({
            "jsonrpc": "2.0", "id": 1, "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05", "capabilities": {},
                "clientInfo": { "name": "OmniDesk", "version": "0.1.0" }
            }
        }),
    )?;
    wait_for_rpc(receiver, 1, deadline, cancellation)?;
    write_rpc(
        stdin,
        &json!({ "jsonrpc": "2.0", "method": "notifications/initialized" }),
    )
}

fn append_stderr(error: String, receiver: &mpsc::Receiver<String>) -> String {
    let stderr = receiver
        .recv_timeout(Duration::from_millis(100))
        .unwrap_or_default();
    if stderr.is_empty() {
        error
    } else {
        format!("{error}；MCP: {stderr}")
    }
}

fn validate_json_schema(schema: &Value, value: &Value, path: &str) -> Result<(), String> {
    if let Some(options) = schema.get("enum").and_then(Value::as_array) {
        if !options.contains(value) {
            return Err(format!("MCP 参数 {path} 不在允许值中"));
        }
    }
    match schema
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or("object")
    {
        "object" => {
            let object = value
                .as_object()
                .ok_or_else(|| format!("MCP 参数 {path} 必须是对象"))?;
            let properties = schema.get("properties").and_then(Value::as_object);
            for required in schema
                .get("required")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
                .filter_map(Value::as_str)
            {
                if !object.contains_key(required) {
                    return Err(format!("MCP 参数 {path}.{required} 为必填项"));
                }
            }
            for (key, child) in object {
                let child_schema = properties
                    .and_then(|items| items.get(key))
                    .ok_or_else(|| format!("MCP 参数 {path}.{key} 未在 schema 中声明"))?;
                validate_json_schema(child_schema, child, &format!("{path}.{key}"))?;
            }
        }
        "array" => {
            let items = value
                .as_array()
                .ok_or_else(|| format!("MCP 参数 {path} 必须是数组"))?;
            if let Some(item_schema) = schema.get("items") {
                for (index, item) in items.iter().enumerate() {
                    validate_json_schema(item_schema, item, &format!("{path}[{index}]"))?;
                }
            }
        }
        "string" if !value.is_string() => return Err(format!("MCP 参数 {path} 必须是字符串")),
        "number" if !value.is_number() => return Err(format!("MCP 参数 {path} 必须是数字")),
        "integer" if !value.is_i64() && !value.is_u64() => {
            return Err(format!("MCP 参数 {path} 必须是整数"))
        }
        "boolean" if !value.is_boolean() => return Err(format!("MCP 参数 {path} 必须是布尔值")),
        "null" if !value.is_null() => return Err(format!("MCP 参数 {path} 必须为空")),
        "string" | "number" | "integer" | "boolean" | "null" => {}
        other => return Err(format!("MCP 参数 schema 类型不受支持：{other}")),
    }
    Ok(())
}

pub fn validate_registry(registry: &McpServerRegistry) -> Result<(), String> {
    if registry.schema_version != MCP_SERVERS_SCHEMA {
        return Err("MCP Server 注册表版本不受支持".to_string());
    }
    if registry.servers.len() > 32 {
        return Err("MCP Server 数量超过上限".to_string());
    }
    let mut ids = HashSet::new();
    for server in &registry.servers {
        validate_server(server)?;
        if !ids.insert(server.id.as_str()) {
            return Err(format!("MCP Server ID 重复：{}", server.id));
        }
    }
    Ok(())
}

pub fn validate_server(server: &McpServerConfig) -> Result<(), String> {
    if server.schema_version != MCP_SERVER_SCHEMA {
        return Err("MCP Server 配置版本不受支持".to_string());
    }
    if !valid_id(&server.id) {
        return Err("MCP Server ID 仅支持小写字母、数字、- 和 _".to_string());
    }
    if server.name.trim().is_empty() || server.name.chars().count() > 80 {
        return Err("MCP Server 名称长度无效".to_string());
    }
    if server.transport != "stdio" {
        return Err("当前 MCP 仅支持 stdio transport".to_string());
    }
    if !valid_command(&server.command) {
        return Err("MCP command 必须是绝对路径或不含空白的可执行文件名".to_string());
    }
    if server.args.len() > 32
        || server
            .args
            .iter()
            .any(|arg| arg.len() > 1024 || arg.contains('\0'))
    {
        return Err("MCP 参数数量或长度超过上限".to_string());
    }
    if server.approval_policy != "always" {
        return Err("MCP 工具必须逐次审批".to_string());
    }
    if server.env.len() > 16 {
        return Err("MCP 环境变量绑定超过上限".to_string());
    }
    let mut names = HashSet::new();
    for binding in &server.env {
        if !valid_env_name(&binding.name)
            || !valid_env_name(&binding.source_env)
            || !names.insert(binding.name.as_str())
        {
            return Err("MCP 环境变量绑定无效或重复".to_string());
        }
    }
    Ok(())
}

fn empty_registry() -> McpServerRegistry {
    McpServerRegistry {
        schema_version: MCP_SERVERS_SCHEMA.to_string(),
        servers: Vec::new(),
    }
}

fn server_schema() -> String {
    MCP_SERVER_SCHEMA.to_string()
}

fn stdio_transport() -> String {
    "stdio".to_string()
}

fn always_approval() -> String {
    "always".to_string()
}

fn valid_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 64
        && value.bytes().all(|byte| {
            byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-' || byte == b'_'
        })
}

fn valid_command(value: &str) -> bool {
    let value = value.trim();
    !value.is_empty()
        && value.len() <= 1024
        && !value.contains('\0')
        && !value.chars().any(char::is_whitespace)
}

fn valid_env_name(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 128
        && value.bytes().enumerate().all(|(index, byte)| {
            byte == b'_' || byte.is_ascii_uppercase() || (index > 0 && byte.is_ascii_digit())
        })
}

fn write_rpc(stdin: &mut impl Write, message: &Value) -> Result<(), String> {
    let mut line = serde_json::to_vec(message).map_err(|error| error.to_string())?;
    line.push(b'\n');
    stdin.write_all(&line).map_err(|error| error.to_string())?;
    stdin.flush().map_err(|error| error.to_string())
}

fn wait_for_rpc(
    receiver: &mpsc::Receiver<Result<Value, String>>,
    id: u64,
    deadline: Instant,
    cancellation: Option<&CancellationToken>,
) -> Result<Value, String> {
    loop {
        if cancellation.is_some_and(CancellationToken::is_cancelled) {
            return Err("MCP 请求已取消".to_string());
        }
        if Instant::now() >= deadline {
            return Err("MCP 能力发现超时".to_string());
        }
        match receiver.recv_timeout(Duration::from_millis(50)) {
            Ok(Ok(message)) if message.get("id").and_then(Value::as_u64) == Some(id) => {
                if let Some(error) = message.get("error") {
                    return Err(format!("MCP JSON-RPC 错误：{error}"));
                }
                return Ok(message);
            }
            Ok(Ok(_notification_or_other_response)) => continue,
            Ok(Err(error)) => return Err(error),
            Err(mpsc::RecvTimeoutError::Timeout) => continue,
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                return Err("MCP Server 提前断开".to_string());
            }
        }
    }
}

fn discovered_tool(server_id: &str, tool: &Value) -> Result<McpDiscoveredTool, String> {
    let remote_name = tool
        .get("name")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "MCP 工具缺少名称".to_string())?;
    let normalize = |value: &str| {
        value
            .chars()
            .map(|character| {
                if character.is_ascii_alphanumeric() {
                    character.to_ascii_lowercase()
                } else {
                    '_'
                }
            })
            .collect::<String>()
    };
    let normalized_server = normalize(server_id);
    let normalized = remote_name
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character.to_ascii_lowercase()
            } else {
                '_'
            }
        })
        .collect::<String>();
    let name = format!("mcp__{normalized_server}__{normalized}");
    if name.len() > 64 {
        return Err("MCP 工具名称超过上限".to_string());
    }
    let mut input_schema = tool
        .get("inputSchema")
        .cloned()
        .unwrap_or_else(|| json!({ "type": "object" }));
    let object = input_schema
        .as_object_mut()
        .ok_or_else(|| "MCP 工具 inputSchema 必须是对象".to_string())?;
    object.insert("type".to_string(), Value::String("object".to_string()));
    object.insert("additionalProperties".to_string(), Value::Bool(false));
    let descriptor = ToolDescriptor {
        schema_version: TOOL_DESCRIPTOR_SCHEMA.to_string(),
        name,
        version: "1.0.0".to_string(),
        description: tool
            .get("description")
            .and_then(Value::as_str)
            .unwrap_or("MCP tool")
            .chars()
            .take(500)
            .collect(),
        source: ToolSource::Mcp,
        risk: ToolRisk::Execute,
        requires_approval: true,
        input_schema,
    };
    validate_descriptor(&descriptor)?;
    Ok(McpDiscoveredTool {
        server_id: server_id.to_string(),
        remote_name: remote_name.to_string(),
        descriptor,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    #[cfg(unix)]
    use std::os::unix::fs::PermissionsExt;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_root() -> std::path::PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("omnidesk-mcp-{nonce}"));
        fs::create_dir_all(&root).unwrap();
        root
    }

    fn server() -> McpServerConfig {
        McpServerConfig {
            schema_version: MCP_SERVER_SCHEMA.to_string(),
            id: "fixture-server".to_string(),
            name: "Fixture Server".to_string(),
            transport: "stdio".to_string(),
            command: "fixture-mcp".to_string(),
            args: vec!["--stdio".to_string()],
            env: vec![McpEnvBinding {
                name: "API_KEY".to_string(),
                source_env: "OMNIDESK_MCP_FIXTURE_KEY".to_string(),
            }],
            enabled: true,
            approval_policy: "always".to_string(),
        }
    }

    #[test]
    fn persists_configuration_without_resolving_or_storing_secret_values() {
        let root = temp_root();
        let saved = save(&root, server()).unwrap();
        assert_eq!(saved.servers.len(), 1);
        let content = fs::read_to_string(root.join(MCP_SERVERS_PATH)).unwrap();
        assert!(content.contains("OMNIDESK_MCP_FIXTURE_KEY"));
        assert!(!content.contains("secret-value"));
        assert_eq!(load(&root).unwrap().servers[0], server());
        assert!(remove(&root, "fixture-server").unwrap().servers.is_empty());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_shell_strings_inline_secrets_and_non_approval_policies() {
        let mut invalid = server();
        invalid.command = "npx fixture-mcp".to_string();
        assert!(validate_server(&invalid).is_err());
        invalid = server();
        invalid.env[0].source_env = "actual-secret-value".to_string();
        assert!(validate_server(&invalid).is_err());
        invalid = server();
        invalid.approval_policy = "never".to_string();
        assert!(validate_server(&invalid).is_err());
        invalid = server();
        invalid.transport = "http".to_string();
        assert!(validate_server(&invalid).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn discovers_tools_through_bounded_stdio_and_marks_them_for_approval() {
        let root = temp_root();
        let script = root.join("fixture-mcp.sh");
        fs::write(
            &script,
            "#!/bin/sh\nIFS= read -r initialize\nprintf '%s\\n' '{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{\"tools\":{}}}}'\nIFS= read -r initialized\nIFS= read -r list\nprintf '%s\\n' '{\"jsonrpc\":\"2.0\",\"id\":2,\"result\":{\"tools\":[{\"name\":\"lookup-docs\",\"description\":\"Lookup docs\",\"inputSchema\":{\"type\":\"object\",\"properties\":{\"query\":{\"type\":\"string\"}},\"required\":[\"query\"]}}]}}'\n",
        )
        .unwrap();
        let mut permissions = fs::metadata(&script).unwrap().permissions();
        permissions.set_mode(0o700);
        fs::set_permissions(&script, permissions).unwrap();
        let mut configured = server();
        configured.command = script.to_string_lossy().to_string();
        configured.args.clear();
        configured.env.clear();
        save(&root, configured).unwrap();

        let result = discover_tools(&root, &root, "fixture-server", None).unwrap();
        assert_eq!(result.protocol_version, "2024-11-05");
        assert_eq!(result.tools.len(), 1);
        assert_eq!(result.tools[0].remote_name, "lookup-docs");
        assert_eq!(result.tools[0].descriptor.source, ToolSource::Mcp);
        assert_eq!(result.tools[0].descriptor.risk, ToolRisk::Execute);
        assert!(result.tools[0].descriptor.requires_approval);
        assert_eq!(
            result.tools[0]
                .descriptor
                .input_schema
                .get("additionalProperties")
                .and_then(Value::as_bool),
            Some(false)
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn cancellation_stops_discovery_before_waiting_for_a_server_response() {
        let root = temp_root();
        let script = root.join("blocked-mcp.sh");
        fs::write(&script, "#!/bin/sh\nsleep 30\n").unwrap();
        let mut permissions = fs::metadata(&script).unwrap().permissions();
        permissions.set_mode(0o700);
        fs::set_permissions(&script, permissions).unwrap();
        let mut configured = server();
        configured.command = script.to_string_lossy().to_string();
        configured.args.clear();
        configured.env.clear();
        save(&root, configured).unwrap();
        let cancellation = CancellationToken::new();
        cancellation.cancel();
        let started = Instant::now();
        assert!(
            discover_tools(&root, &root, "fixture-server", Some(&cancellation))
                .unwrap_err()
                .contains("已取消")
        );
        assert!(started.elapsed() < Duration::from_secs(2));
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn calls_only_recently_discovered_tools_with_schema_valid_arguments() {
        let root = temp_root();
        let marker = root.join("tool-called");
        let script = root.join("callable-mcp.sh");
        fs::write(&script, format!(r#"#!/bin/sh
IFS= read -r initialize
printf '%s\n' '{{"jsonrpc":"2.0","id":1,"result":{{"protocolVersion":"2024-11-05","capabilities":{{"tools":{{}}}}}}}}'
IFS= read -r initialized
IFS= read -r request
case "$request" in
  *tools/list*) printf '%s\n' '{{"jsonrpc":"2.0","id":2,"result":{{"tools":[{{"name":"lookup","inputSchema":{{"type":"object","properties":{{"query":{{"type":"string"}}}},"required":["query"]}}}}]}}}}' ;;
  *tools/call*) touch '{}'; printf '%s\n' '{{"jsonrpc":"2.0","id":2,"result":{{"content":[{{"type":"text","text":"found"}}],"isError":false}}}}' ;;
esac
"#, marker.to_string_lossy())).unwrap();
        let mut permissions = fs::metadata(&script).unwrap().permissions();
        permissions.set_mode(0o700);
        fs::set_permissions(&script, permissions).unwrap();
        let mut configured = server();
        configured.command = script.to_string_lossy().to_string();
        configured.args.clear();
        configured.env.clear();
        save(&root, configured.clone()).unwrap();

        assert!(call_tool(
            &root,
            &root,
            "project-a",
            "fixture-server",
            "lookup",
            &json!({ "query": "docs" }),
            None
        )
        .unwrap_err()
        .contains("尚未"));
        let discovered = discover_tools(&root, &root, "fixture-server", None).unwrap();
        save_discovery_evidence(&root, "project-a", discovered, "now").unwrap();
        assert!(
            load_valid_discovery_evidence(&root, "project-a", "fixture-server")
                .unwrap()
                .is_some()
        );
        assert!(
            load_valid_discovery_evidence(&root, "project-b", "fixture-server")
                .unwrap()
                .is_none()
        );
        let invalid_arguments = call_tool(
            &root,
            &root,
            "project-a",
            "fixture-server",
            "lookup",
            &json!({ "unknown": true }),
            None,
        )
        .unwrap_err();
        assert!(invalid_arguments.contains("query") || invalid_arguments.contains("schema"));
        assert!(!marker.exists());
        let result = call_tool(
            &root,
            &root,
            "project-a",
            "fixture-server",
            "lookup",
            &json!({ "query": "docs" }),
            None,
        )
        .unwrap();
        assert_eq!(result.content[0]["text"], "found");
        assert!(marker.exists());

        configured.args.push("--changed".to_string());
        save(&root, configured).unwrap();
        assert!(
            load_valid_discovery_evidence(&root, "project-a", "fixture-server")
                .unwrap()
                .is_none()
        );
        assert!(discovered_tool_for_call(
            &root,
            "project-a",
            "fixture-server",
            "lookup",
            &json!({ "query": "docs" })
        )
        .unwrap_err()
        .contains("过期"));
        fs::remove_dir_all(root).unwrap();
    }
}
