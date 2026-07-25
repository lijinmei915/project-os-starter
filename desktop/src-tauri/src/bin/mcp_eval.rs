#![allow(dead_code)]

#[path = "../runtime/mod.rs"]
mod runtime;

use runtime::agent_scheduler::ClaimOutcome;
use runtime::mcp_runtime::{McpServerConfig, MCP_SERVER_SCHEMA};
use serde::Deserialize;
use serde_json::{json, Value};
use std::fs;
use std::io::{self, Read};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const REQUEST_SCHEMA: &str = "omnidesk.third-party-mcp-eval-request.v0.1";
const RESULT_SCHEMA: &str = "omnidesk.third-party-mcp-runtime-result.v0.1";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct EvalRequest {
    schema_version: String,
    app_root: String,
    project_root: String,
    project_id: String,
    server_id: String,
    server_name: String,
    command: String,
    args: Vec<String>,
    tool_name: String,
    tool_arguments: Value,
    expected_content_fragment: String,
}

fn main() {
    let mut input = String::new();
    if let Err(error) = io::stdin().read_to_string(&mut input) {
        fail(format!("cannot read MCP Eval request: {error}"));
    }
    let request = serde_json::from_str::<EvalRequest>(&input)
        .unwrap_or_else(|error| fail(format!("invalid MCP Eval request JSON: {error}")));
    let result = match run(request) {
        Ok(result) => result,
        Err(error) => fail(error),
    };
    println!(
        "{}",
        serde_json::to_string(&result).expect("MCP Eval result must serialize")
    );
}

fn run(request: EvalRequest) -> Result<Value, String> {
    if request.schema_version != REQUEST_SCHEMA {
        return Err("unsupported MCP Eval request schema".to_string());
    }
    if request.tool_name.trim().is_empty() || request.expected_content_fragment.trim().is_empty() {
        return Err("MCP Eval requires a tool and expected content fragment".to_string());
    }
    let app_root = existing_directory(&request.app_root, "app root")?;
    let project_root = existing_directory(&request.project_root, "project root")?;
    runtime::state_namespace::ensure_active_state_namespace(&app_root)?;
    runtime::mcp_runtime::save(
        &app_root,
        McpServerConfig {
            schema_version: MCP_SERVER_SCHEMA.to_string(),
            id: request.server_id.clone(),
            name: request.server_name.clone(),
            transport: "stdio".to_string(),
            command: request.command.clone(),
            args: request.args.clone(),
            env: Vec::new(),
            enabled: true,
            approval_policy: "always".to_string(),
        },
    )?;

    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let discovery_run_id = format!("mcp-eval-discovery-{nonce}");
    let discovery_token = format!("mcp-eval-discovery-approval-{nonce}");
    let discovery_timestamp = timestamp();
    let discovery_lease = reserve_project(
        &app_root,
        &discovery_run_id,
        &request.project_id,
        &discovery_timestamp,
    )?;
    let discovery_pending = runtime::agent_runs::create_mcp_discovery_run(
        &app_root,
        discovery_run_id.clone(),
        format!("{discovery_run_id}-request"),
        request.project_id.clone(),
        request.server_id.clone(),
        discovery_token.clone(),
        &discovery_timestamp,
    )?;
    discovery_lease.settle("waiting-approval", &timestamp())?;
    let discovery_scheduler_before = scheduler_status(&app_root, &discovery_run_id)?;
    let discovery_evidence_before = runtime::mcp_runtime::load_valid_discovery_evidence(
        &app_root,
        &request.project_id,
        &request.server_id,
    )?;
    let discovery_approved =
        runtime::agent_runs::approve(&app_root, &discovery_run_id, &timestamp())?;
    let discovery_result = runtime::execution::execute_approved_agent_tool(
        &app_root,
        &project_root,
        &request.project_id,
        "controlled",
        &discovery_run_id,
        &discovery_approved.approval_token,
        &timestamp(),
    )?;
    runtime::agent_scheduler::settle_if_present(
        &app_root,
        &discovery_run_id,
        "completed",
        &timestamp(),
    )?;
    let discovery_completed = runtime::agent_runs::load(&app_root, &discovery_run_id)?;
    let discovery_evidence = runtime::mcp_runtime::load_valid_discovery_evidence(
        &app_root,
        &request.project_id,
        &request.server_id,
    )?
    .ok_or_else(|| "approved discovery did not create current project evidence".to_string())?;
    let discovered_tool = discovery_evidence
        .result
        .tools
        .iter()
        .find(|tool| tool.remote_name == request.tool_name)
        .ok_or_else(|| format!("third-party MCP did not expose {}", request.tool_name))?;
    if discovered_tool.descriptor.source != runtime::tool_registry::ToolSource::Mcp
        || discovered_tool.descriptor.risk != runtime::tool_registry::ToolRisk::Execute
        || !discovered_tool.descriptor.requires_approval
    {
        return Err("discovered MCP tool lost its governed descriptor boundary".to_string());
    }

    runtime::mcp_runtime::discovered_tool_for_call(
        &app_root,
        &request.project_id,
        &request.server_id,
        &request.tool_name,
        &request.tool_arguments,
    )?;
    let call_run_id = format!("mcp-eval-call-{nonce}");
    let call_token = format!("mcp-eval-call-approval-{nonce}");
    let call_timestamp = timestamp();
    let call_lease = reserve_project(
        &app_root,
        &call_run_id,
        &request.project_id,
        &call_timestamp,
    )?;
    let call_pending = runtime::agent_runs::create_mcp_call_run(
        &app_root,
        call_run_id.clone(),
        format!("{call_run_id}-request"),
        request.project_id.clone(),
        request.server_id.clone(),
        request.tool_name.clone(),
        request.tool_arguments.clone(),
        call_token.clone(),
        &call_timestamp,
    )?;
    call_lease.settle("waiting-approval", &timestamp())?;
    let call_scheduler_before = scheduler_status(&app_root, &call_run_id)?;
    let call_approved = runtime::agent_runs::approve(&app_root, &call_run_id, &timestamp())?;
    let call_result = runtime::execution::execute_approved_agent_tool(
        &app_root,
        &project_root,
        &request.project_id,
        "controlled",
        &call_run_id,
        &call_approved.approval_token,
        &timestamp(),
    )?;
    runtime::agent_scheduler::settle_if_present(
        &app_root,
        &call_run_id,
        "completed",
        &timestamp(),
    )?;
    let call_completed = runtime::agent_runs::load(&app_root, &call_run_id)?;
    let encoded_call_result =
        serde_json::to_vec(&call_result).map_err(|error| error.to_string())?;
    if call_result.get("isError").and_then(Value::as_bool) == Some(true) {
        return Err("third-party MCP returned isError=true".to_string());
    }
    if !String::from_utf8_lossy(&encoded_call_result).contains(&request.expected_content_fragment) {
        return Err("third-party MCP result did not contain the fixture proof".to_string());
    }

    let discovery_timeline =
        runtime::agent_runs::export_timeline(&app_root, &discovery_run_id, &timestamp())?;
    let call_timeline =
        runtime::agent_runs::export_timeline(&app_root, &call_run_id, &timestamp())?;
    let scheduler_after = runtime::agent_scheduler::snapshot(&app_root)?;
    let tool_names = discovery_evidence
        .result
        .tools
        .iter()
        .map(|tool| tool.remote_name.clone())
        .collect::<Vec<_>>();

    Ok(json!({
        "schemaVersion": RESULT_SCHEMA,
        "server": {
            "id": request.server_id,
            "transport": "stdio",
            "approvalPolicy": "always"
        },
        "discovery": {
            "runStatusBeforeApproval": discovery_pending.status,
            "schedulerStatusBeforeApproval": discovery_scheduler_before,
            "toolResultPresentBeforeApproval": discovery_pending.checkpoint.tool_result.is_some(),
            "evidencePresentBeforeApproval": discovery_evidence_before.is_some(),
            "completedRunStatus": discovery_completed.status,
            "evidenceSchemaVersion": discovery_evidence.schema_version,
            "evidenceProjectId": discovery_evidence.project_id,
            "protocolVersion": discovery_evidence.result.protocol_version,
            "toolNames": tool_names,
            "descriptorBoundary": {
                "source": "mcp",
                "risk": "execute",
                "requiresApproval": true
            },
            "transportResult": discovery_result
        },
        "call": {
            "runStatusBeforeApproval": call_pending.status,
            "schedulerStatusBeforeApproval": call_scheduler_before,
            "toolResultPresentBeforeApproval": call_pending.checkpoint.tool_result.is_some(),
            "completedRunStatus": call_completed.status,
            "remoteName": request.tool_name,
            "result": call_result,
            "resultBytes": encoded_call_result.len()
        },
        "approvals": {
            "count": 2,
            "independent": discovery_token != call_token
                && discovery_run_id != call_run_id
        },
        "scheduler": {
            "activeCountAfter": scheduler_after.active_count,
            "remainingEntriesAfter": scheduler_after.entries.len()
        },
        "timelines": [discovery_timeline["timeline"].clone(), call_timeline["timeline"].clone()]
    }))
}

fn reserve_project(
    root: &Path,
    run_id: &str,
    project_id: &str,
    timestamp: &str,
) -> Result<runtime::agent_scheduler::AgentSchedulerLease, String> {
    runtime::agent_scheduler::enqueue(root, run_id, project_id, timestamp)?;
    let (outcome, lease) = runtime::agent_scheduler::try_claim(root, run_id, timestamp)?;
    if outcome != ClaimOutcome::Claimed {
        return Err("MCP Eval could not claim the project scheduler slot".to_string());
    }
    lease.ok_or_else(|| "MCP Eval claimed no scheduler lease".to_string())
}

fn scheduler_status(root: &Path, run_id: &str) -> Result<String, String> {
    runtime::agent_scheduler::snapshot(root)?
        .entries
        .into_iter()
        .find(|entry| entry.run_id == run_id)
        .map(|entry| entry.status)
        .ok_or_else(|| "MCP Eval scheduler entry disappeared before approval".to_string())
}

fn existing_directory(value: &str, label: &str) -> Result<PathBuf, String> {
    let path = fs::canonicalize(value).map_err(|error| format!("invalid {label}: {error}"))?;
    if !path.is_dir() {
        return Err(format!("{label} must be a directory"));
    }
    Ok(path)
}

fn timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .to_string()
}

fn fail(error: String) -> ! {
    eprintln!("{error}");
    std::process::exit(2);
}
