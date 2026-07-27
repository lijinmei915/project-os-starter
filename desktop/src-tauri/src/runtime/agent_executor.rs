use crate::runtime::provider::ProviderConfig;
use serde::Serialize;
use serde_json::Value;
use std::collections::BTreeMap;
use std::path::PathBuf;
use tokio_util::sync::CancellationToken;

pub const AGENT_EXECUTOR_CONTRACT_VERSION: &str = "omnidesk.agent-executor.v1";
pub const AGENT_EVENT_SCHEMA_VERSION: &str = "omnidesk.agent-event.v1";

#[derive(Serialize, Clone, Debug, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AgentExecutorCapabilities {
    pub protocol: String,
    pub structured_tools: bool,
    pub cancellation: bool,
    pub checkpoint_resume: bool,
    pub user_interaction: bool,
    pub approval_requests: bool,
    pub usage: bool,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    extensions: BTreeMap<String, Value>,
}

impl AgentExecutorCapabilities {
    pub fn governed_acp(usage: bool) -> Self {
        Self {
            protocol: "acp".to_string(),
            structured_tools: true,
            cancellation: true,
            checkpoint_resume: true,
            user_interaction: true,
            approval_requests: true,
            usage,
            extensions: BTreeMap::new(),
        }
    }

    pub fn unsupported(protocol: impl Into<String>) -> Self {
        Self {
            protocol: protocol.into(),
            structured_tools: false,
            cancellation: false,
            checkpoint_resume: false,
            user_interaction: false,
            approval_requests: false,
            usage: false,
            extensions: BTreeMap::new(),
        }
    }

    pub fn with_extension(mut self, key: impl Into<String>, value: Value) -> Self {
        self.extensions.insert(key.into(), value);
        self
    }
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AgentExecutorStatus {
    pub contract_version: String,
    pub id: String,
    pub protocol: String,
    pub status: String,
    pub version: String,
    pub message: String,
    pub capabilities: AgentExecutorCapabilities,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AgentExecutionMode {
    Start,
    Resume,
}

pub struct AgentExecutionRequest {
    pub mode: AgentExecutionMode,
    pub root: PathBuf,
    pub api_key: String,
    pub api_base: String,
    pub api_key_env: String,
    pub prompt: String,
    pub max_steps: usize,
    pub cancellation: Option<CancellationToken>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentEvent {
    pub schema_version: &'static str,
    pub sequence: usize,
    pub kind: String,
    pub phase: String,
    pub status: String,
    pub summary: String,
    pub details: Value,
}

impl AgentEvent {
    pub fn new(
        sequence: usize,
        kind: impl Into<String>,
        phase: impl Into<String>,
        status: impl Into<String>,
        summary: impl Into<String>,
        details: Value,
    ) -> Self {
        Self {
            schema_version: AGENT_EVENT_SCHEMA_VERSION,
            sequence,
            kind: kind.into(),
            phase: phase.into(),
            status: status.into(),
            summary: summary.into(),
            details,
        }
    }

    pub fn is_terminal(&self) -> bool {
        self.kind == "terminal"
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentExecutionResult {
    pub status: String,
    pub summary: String,
    pub step: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub approval: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interaction: Option<Value>,
    pub events: Vec<AgentEvent>,
    // Compatibility diagnostics. Runtime governance and Timeline must consume
    // `events`, never these executor-shaped fields.
    pub observations: Vec<Value>,
    pub trace: Vec<String>,
    #[serde(skip_serializing_if = "crate::runtime::acp_protocol::ProviderUsage::is_empty")]
    pub usage: crate::runtime::acp_protocol::ProviderUsage,
}

pub trait AgentExecutor: Send + Sync {
    fn id(&self) -> &'static str;
    fn capabilities(&self) -> AgentExecutorCapabilities;
    fn status(&self) -> AgentExecutorStatus;
    fn prepare(&self, provider: &ProviderConfig) -> Result<(), String>;
    fn execute(&self, request: AgentExecutionRequest) -> Result<AgentExecutionResult, String>;
}

const DEFAULT_AGENT_EXECUTOR_ID: &str = "hermes-acp";

static AGENT_EXECUTORS: [&'static dyn AgentExecutor; 2] = [
    &crate::runtime::hermes_executor::HERMES_ACP_EXECUTOR,
    &crate::runtime::gemini_executor::GEMINI_ACP_EXECUTOR,
];

pub fn registered_agent_executors() -> &'static [&'static dyn AgentExecutor] {
    &AGENT_EXECUTORS
}

pub fn agent_executor_by_id(id: &str) -> Result<&'static dyn AgentExecutor, String> {
    let id = id.trim();
    registered_agent_executors()
        .iter()
        .copied()
        .find(|executor| executor.id() == id)
        .ok_or_else(|| format!("未注册 Agent Executor: {id}"))
}

pub fn select_agent_executor(
    requested_id: Option<&str>,
    persisted_id: Option<&str>,
) -> Result<&'static dyn AgentExecutor, String> {
    if let Some(id) = persisted_id.filter(|id| !id.trim().is_empty()) {
        return agent_executor_by_id(id);
    }
    if let Some(id) = requested_id.filter(|id| !id.trim().is_empty()) {
        return agent_executor_by_id(id);
    }
    Ok(default_agent_executor())
}

pub fn validate_governed_capabilities(executor: &dyn AgentExecutor) -> Result<(), String> {
    // Runtime admission deliberately reads only the frozen v1 core. Adapter
    // extensions are descriptive and must never alter governance decisions.
    let capabilities = executor.capabilities();
    let missing = [
        (!capabilities.structured_tools).then_some("structuredTools"),
        (!capabilities.cancellation).then_some("cancellation"),
        (!capabilities.checkpoint_resume).then_some("checkpointResume"),
        (!capabilities.user_interaction).then_some("userInteraction"),
        (!capabilities.approval_requests).then_some("approvalRequests"),
    ]
    .into_iter()
    .flatten()
    .collect::<Vec<_>>();
    if missing.is_empty() {
        Ok(())
    } else {
        Err(format!(
            "Agent Executor {} 缺少受控执行能力: {}",
            executor.id(),
            missing.join(", ")
        ))
    }
}

pub fn default_agent_executor() -> &'static dyn AgentExecutor {
    agent_executor_by_id(DEFAULT_AGENT_EXECUTOR_ID)
        .expect("默认 Agent Executor 必须存在于 Registry")
}

#[cfg(test)]
mod tests {
    use super::*;

    struct ContractFixture;

    impl AgentExecutor for ContractFixture {
        fn id(&self) -> &'static str {
            "fixture"
        }
        fn capabilities(&self) -> AgentExecutorCapabilities {
            AgentExecutorCapabilities {
                protocol: "test".to_string(),
                structured_tools: true,
                cancellation: true,
                checkpoint_resume: true,
                user_interaction: true,
                approval_requests: true,
                usage: false,
                extensions: BTreeMap::new(),
            }
        }
        fn status(&self) -> AgentExecutorStatus {
            AgentExecutorStatus {
                contract_version: AGENT_EXECUTOR_CONTRACT_VERSION.to_string(),
                id: self.id().to_string(),
                protocol: "test".to_string(),
                status: "ready".to_string(),
                version: "1".to_string(),
                message: String::new(),
                capabilities: self.capabilities(),
            }
        }
        fn prepare(&self, _provider: &ProviderConfig) -> Result<(), String> {
            Ok(())
        }
        fn execute(&self, _request: AgentExecutionRequest) -> Result<AgentExecutionResult, String> {
            Err("fixture".to_string())
        }
    }

    #[test]
    fn alternative_executors_implement_the_contract_without_hermes_types() {
        let executor: &dyn AgentExecutor = &ContractFixture;
        assert_eq!(executor.id(), "fixture");
        assert_eq!(executor.status().capabilities.protocol, "test");
    }

    #[test]
    fn registry_resolves_the_default_executor_by_stable_id() {
        assert_eq!(default_agent_executor().id(), DEFAULT_AGENT_EXECUTOR_ID);
        assert_eq!(
            agent_executor_by_id("hermes-acp").unwrap().id(),
            "hermes-acp"
        );
        assert_eq!(
            agent_executor_by_id("gemini-acp").unwrap().id(),
            "gemini-acp"
        );
        assert!(agent_executor_by_id("missing").is_err());
    }

    #[test]
    fn registry_ids_are_unique() {
        let mut ids = registered_agent_executors()
            .iter()
            .map(|executor| executor.id())
            .collect::<Vec<_>>();
        ids.sort_unstable();
        ids.dedup();
        assert_eq!(ids.len(), registered_agent_executors().len());
    }

    #[test]
    fn persisted_executor_binding_wins_over_a_new_selection() {
        assert_eq!(
            select_agent_executor(Some("gemini-acp"), Some("hermes-acp"))
                .unwrap()
                .id(),
            "hermes-acp"
        );
        assert!(select_agent_executor(None, Some("removed-executor")).is_err());
    }

    #[test]
    fn governed_execution_requires_the_complete_runtime_contract() {
        assert!(validate_governed_capabilities(default_agent_executor()).is_ok());
        assert!(validate_governed_capabilities(&ContractFixture).is_ok());
    }

    #[test]
    fn serialized_contract_is_versioned_and_extensions_are_not_core_fields() {
        let status = ContractFixture.status();
        let value = serde_json::to_value(status).unwrap();
        assert_eq!(value["contractVersion"], AGENT_EXECUTOR_CONTRACT_VERSION);
        assert!(value["capabilities"].get("extensions").is_none());

        let extended = ContractFixture
            .capabilities()
            .with_extension("fixture.parallelTools", Value::Bool(true));
        assert!(validate_governed_capabilities(&ContractFixture).is_ok());
        assert_eq!(
            serde_json::to_value(extended).unwrap()["extensions"]["fixture.parallelTools"],
            true
        );
    }

    #[test]
    fn agent_event_has_a_stable_public_shape_without_private_reasoning() {
        let event = AgentEvent::new(
            1,
            "lifecycle",
            "model",
            "running",
            "执行器开始处理。",
            serde_json::json!({ "mode": "start" }),
        );
        let value = serde_json::to_value(event).unwrap();
        assert_eq!(value["schemaVersion"], AGENT_EVENT_SCHEMA_VERSION);
        assert!(value.get("content").is_none());
        assert!(value.get("reasoning").is_none());
    }
}
