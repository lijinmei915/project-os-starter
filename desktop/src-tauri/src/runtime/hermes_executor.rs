use crate::runtime::agent_executor::{
    AgentExecutionRequest, AgentExecutionResult, AgentExecutor, AgentExecutorCapabilities,
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
        status
    }

    fn prepare(&self, provider: &ProviderConfig) -> Result<(), String> {
        sync_hermes_runtime_config(provider)
    }

    fn execute(&self, request: AgentExecutionRequest) -> Result<AgentExecutionResult, String> {
        crate::runtime::hermes_execution::run_structured_loop_with_mode(
            &request.root,
            &request.api_key,
            &request.api_base,
            &request.api_key_env,
            &request.prompt,
            request.max_steps,
            request.cancellation.as_ref(),
            request.mode,
        )
    }
}
