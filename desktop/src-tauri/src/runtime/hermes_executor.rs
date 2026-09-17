use crate::runtime::agent_executor::{
    AgentExecutionRequest, AgentExecutionResult, AgentExecutor, AgentExecutorCapabilities,
    AgentExecutorWarmupRequest,
    AgentExecutorStatus, AGENT_EXECUTOR_CONTRACT_VERSION,
};
use crate::runtime::provider::{sync_hermes_runtime_config, ProviderConfig};

pub struct HermesAcpExecutor;

pub static HERMES_ACP_EXECUTOR: HermesAcpExecutor = HermesAcpExecutor;

impl AgentExecutor for HermesAcpExecutor {
    fn id(&self) -> &'static str {
        "hermes-acp"
    }

    fn capabilities(&self) -> AgentExecutorCapabilities {
        AgentExecutorCapabilities::governed_acp(true)
    }

    fn status(&self) -> AgentExecutorStatus {
        let mut status = crate::runtime::hermes_protocol::executor_status();
        status.contract_version = AGENT_EXECUTOR_CONTRACT_VERSION.to_string();
        status.id = self.id().to_string();
        status.capabilities = self.capabilities();
        if status.status == "ready" {
            status.message = format!(
                "{} {}",
                status.message,
                crate::runtime::acp_execution::warm_hermes_worker_summary()
            );
        }
        status
    }

    fn prepare(&self, provider: &ProviderConfig) -> Result<(), String> {
        sync_hermes_runtime_config(provider)
    }

    fn prewarm(&self, request: AgentExecutorWarmupRequest) -> Result<(), String> {
        crate::runtime::hermes_execution::prewarm_worker(
            &request.root,
            &request.api_key,
            &request.api_base,
            &request.api_key_env,
            &request.model,
        )
    }

    fn execute(&self, request: AgentExecutionRequest) -> Result<AgentExecutionResult, String> {
        crate::runtime::hermes_execution::run_structured_loop_with_mode(
            &request.root,
            &request.api_key,
            &request.api_base,
            &request.api_key_env,
            &request.model,
            &request.prompt,
            request.max_steps,
            request.cancellation.as_ref(),
            request.mode,
            request.purpose,
            request.event_sink,
        )
    }
}
