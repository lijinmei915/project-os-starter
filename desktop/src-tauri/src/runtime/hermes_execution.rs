use crate::runtime::agent_executor::{AgentEventSink, AgentExecutionMode, AgentExecutionPurpose, AgentExecutionResult};
use std::path::Path;
use tokio_util::sync::CancellationToken;

#[allow(dead_code)]
pub fn run_structured_loop(
    root: &Path,
    api_key: &str,
    api_base: &str,
    api_key_env: &str,
    model: &str,
    prompt: &str,
    max_steps: usize,
    cancellation: Option<&CancellationToken>,
) -> Result<AgentExecutionResult, String> {
    run_structured_loop_with_mode(
        root,
        api_key,
        api_base,
        api_key_env,
        model,
        prompt,
        max_steps,
        cancellation,
        AgentExecutionMode::Start,
        AgentExecutionPurpose::GovernedTask,
        None,
    )
}

#[allow(clippy::too_many_arguments)]
pub fn run_structured_loop_with_mode(
    root: &Path,
    api_key: &str,
    api_base: &str,
    api_key_env: &str,
    model: &str,
    prompt: &str,
    max_steps: usize,
    cancellation: Option<&CancellationToken>,
    mode: AgentExecutionMode,
    purpose: AgentExecutionPurpose,
    event_sink: Option<AgentEventSink>,
) -> Result<AgentExecutionResult, String> {
    let program = crate::runtime::hermes_protocol::acp_program()
        .ok_or_else(|| "未检测到 hermes-acp".to_string())?;
    crate::runtime::acp_execution::run_acp_structured_loop(
        crate::runtime::acp_execution::AcpExecutionConfig {
            executor_id: "hermes-acp",
            display_name: "Hermes",
            trace_prefix: "HERMES",
            program,
            args: Vec::new(),
            forward_provider_env: true,
            supports_warm_workers: true,
            mode,
            purpose,
            native_tool_events: true,
            event_sink,
        },
        root,
        api_key,
        api_base,
        api_key_env,
        model,
        prompt,
        max_steps,
        cancellation,
    )
}

pub fn prewarm_worker(
    root: &Path,
    api_key: &str,
    api_base: &str,
    api_key_env: &str,
    model: &str,
) -> Result<(), String> {
    let program = crate::runtime::hermes_protocol::acp_program()
        .ok_or_else(|| "未检测到 hermes-acp".to_string())?;
    crate::runtime::acp_execution::prewarm_acp_worker(
        &crate::runtime::acp_execution::AcpExecutionConfig {
            executor_id: "hermes-acp",
            display_name: "Hermes",
            trace_prefix: "HERMES",
            program,
            args: Vec::new(),
            forward_provider_env: true,
            supports_warm_workers: true,
            mode: AgentExecutionMode::Start,
            purpose: AgentExecutionPurpose::GovernedTask,
            native_tool_events: true,
            event_sink: None,
        },
        root,
        api_key,
        api_base,
        api_key_env,
        model,
    )
}
