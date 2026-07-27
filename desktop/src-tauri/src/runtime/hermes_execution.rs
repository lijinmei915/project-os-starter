use crate::runtime::agent_executor::{AgentExecutionMode, AgentExecutionResult};
use std::path::Path;
use tokio_util::sync::CancellationToken;

#[allow(dead_code)]
pub fn run_structured_loop(
    root: &Path,
    api_key: &str,
    api_base: &str,
    api_key_env: &str,
    prompt: &str,
    max_steps: usize,
    cancellation: Option<&CancellationToken>,
) -> Result<AgentExecutionResult, String> {
    run_structured_loop_with_mode(
        root,
        api_key,
        api_base,
        api_key_env,
        prompt,
        max_steps,
        cancellation,
        AgentExecutionMode::Start,
    )
}

#[allow(clippy::too_many_arguments)]
pub fn run_structured_loop_with_mode(
    root: &Path,
    api_key: &str,
    api_base: &str,
    api_key_env: &str,
    prompt: &str,
    max_steps: usize,
    cancellation: Option<&CancellationToken>,
    mode: AgentExecutionMode,
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
            mode,
        },
        root,
        api_key,
        api_base,
        api_key_env,
        prompt,
        max_steps,
        cancellation,
    )
}
