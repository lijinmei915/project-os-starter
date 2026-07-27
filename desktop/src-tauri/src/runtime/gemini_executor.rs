use crate::runtime::acp_execution::{run_acp_structured_loop, AcpExecutionConfig};
use crate::runtime::agent_executor::{
    AgentExecutionRequest, AgentExecutionResult, AgentExecutor, AgentExecutorCapabilities,
    AgentExecutorStatus, AGENT_EXECUTOR_CONTRACT_VERSION,
};
use crate::runtime::provider::ProviderConfig;
use std::path::PathBuf;
use std::process::Command;

pub struct GeminiAcpExecutor;

pub static GEMINI_ACP_EXECUTOR: GeminiAcpExecutor = GeminiAcpExecutor;

fn candidate_programs() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(home) = std::env::var("HOME") {
        let home = PathBuf::from(home);
        paths.push(home.join(".npm/bin/gemini"));
        paths.push(home.join(".local/bin/gemini"));
    }
    paths.push(PathBuf::from("gemini"));
    paths
}

fn program() -> Option<PathBuf> {
    candidate_programs()
        .into_iter()
        .find(|candidate| candidate.components().count() == 1 || candidate.is_file())
}

fn probe() -> Result<(PathBuf, String), String> {
    let program = program().ok_or_else(|| "未检测到 Gemini CLI".to_string())?;
    let help = Command::new(&program)
        .arg("--help")
        .output()
        .map_err(|error| format!("无法检查 Gemini CLI: {error}"))?;
    let help_text = format!(
        "{}{}",
        String::from_utf8_lossy(&help.stdout),
        String::from_utf8_lossy(&help.stderr)
    );
    if !help.status.success() || !help_text.contains("--acp") {
        return Err("Gemini CLI 未提供可用的 --acp 入口".to_string());
    }
    let version = Command::new(&program)
        .arg("--version")
        .output()
        .ok()
        .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_string())
        .unwrap_or_default();
    Ok((program, version))
}

impl AgentExecutor for GeminiAcpExecutor {
    fn id(&self) -> &'static str {
        "gemini-acp"
    }

    fn capabilities(&self) -> AgentExecutorCapabilities {
        AgentExecutorCapabilities::governed_acp(false)
    }

    fn status(&self) -> AgentExecutorStatus {
        match probe() {
            Ok((_, version)) => AgentExecutorStatus {
                contract_version: AGENT_EXECUTOR_CONTRACT_VERSION.to_string(),
                id: self.id().to_string(),
                protocol: "acp".to_string(),
                status: "ready".to_string(),
                version,
                message: "Gemini ACP 入口可用；模型凭据仍需通过实际请求验证。".to_string(),
                capabilities: self.capabilities(),
            },
            Err(message) => AgentExecutorStatus {
                contract_version: AGENT_EXECUTOR_CONTRACT_VERSION.to_string(),
                id: self.id().to_string(),
                protocol: "acp".to_string(),
                status: "unavailable".to_string(),
                version: String::new(),
                message,
                capabilities: self.capabilities(),
            },
        }
    }

    fn prepare(&self, _provider: &ProviderConfig) -> Result<(), String> {
        probe().map(|_| ())
    }

    fn execute(&self, request: AgentExecutionRequest) -> Result<AgentExecutionResult, String> {
        let (program, _) = probe()?;
        run_acp_structured_loop(
            AcpExecutionConfig {
                executor_id: self.id(),
                display_name: "Gemini",
                trace_prefix: "GEMINI",
                program,
                args: vec![
                    "--acp".to_string(),
                    "--skip-trust".to_string(),
                    "--approval-mode".to_string(),
                    "plan".to_string(),
                ],
                forward_provider_env: false,
                mode: request.mode,
            },
            &request.root,
            &request.api_key,
            &request.api_base,
            &request.api_key_env,
            &request.prompt,
            request.max_steps,
            request.cancellation.as_ref(),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::runtime::agent_executor::AgentExecutionMode;
    use tokio_util::sync::CancellationToken;

    #[test]
    fn gemini_adapter_declares_the_governed_acp_contract() {
        let capabilities = GEMINI_ACP_EXECUTOR.capabilities();
        assert_eq!(GEMINI_ACP_EXECUTOR.id(), "gemini-acp");
        assert_eq!(capabilities.protocol, "acp");
        assert!(capabilities.structured_tools);
        assert!(capabilities.cancellation);
    }

    #[test]
    fn installed_gemini_process_obeys_runtime_cancellation() {
        if probe().is_err() {
            return;
        }
        let cancellation = CancellationToken::new();
        cancellation.cancel();
        let error = GEMINI_ACP_EXECUTOR
            .execute(AgentExecutionRequest {
                mode: AgentExecutionMode::Start,
                root: std::env::current_dir().unwrap(),
                api_key: String::new(),
                api_base: String::new(),
                api_key_env: String::new(),
                prompt: "cancel before model access".to_string(),
                max_steps: 1,
                cancellation: Some(cancellation),
            })
            .unwrap_err();
        assert!(error.contains("请求已取消"));
    }
}
