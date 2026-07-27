use crate::runtime::agent_executor::{
    AgentExecutorCapabilities, AgentExecutorStatus, AGENT_EXECUTOR_CONTRACT_VERSION,
};
use std::path::PathBuf;
use std::process::Command;

pub fn acp_program() -> Option<PathBuf> {
    candidate_programs("hermes-acp")
        .into_iter()
        .find(|candidate| candidate.components().count() == 1 || candidate.is_file())
}

pub fn executor_status() -> AgentExecutorStatus {
    for program in candidate_programs("hermes-acp") {
        match Command::new(&program).arg("--check").output() {
            Ok(output) if output.status.success() => {
                let version = Command::new(&program)
                    .arg("--version")
                    .output()
                    .ok()
                    .map(|output| process_output(&output))
                    .unwrap_or_default();
                return AgentExecutorStatus {
                    contract_version: AGENT_EXECUTOR_CONTRACT_VERSION.to_string(),
                    id: "hermes".to_string(),
                    protocol: "acp".to_string(),
                    status: "ready".to_string(),
                    version,
                    message: "Hermes ACP 通道检查通过；模型凭据仍需通过实际请求验证。".to_string(),
                    capabilities: acp_capabilities(true),
                };
            }
            Ok(output) => {
                return AgentExecutorStatus {
                    contract_version: AGENT_EXECUTOR_CONTRACT_VERSION.to_string(),
                    id: "hermes".to_string(),
                    protocol: "acp".to_string(),
                    status: "unavailable".to_string(),
                    version: String::new(),
                    message: format!(
                        "检测到 Hermes ACP，但健康检查未通过：{}",
                        process_output(&output)
                    ),
                    capabilities: acp_capabilities(true),
                };
            }
            Err(_) => continue,
        }
    }
    for program in candidate_programs("hermes") {
        if let Ok(output) = Command::new(&program).arg("--version").output() {
            return AgentExecutorStatus {
                contract_version: AGENT_EXECUTOR_CONTRACT_VERSION.to_string(),
                id: "hermes".to_string(),
                protocol: "cli".to_string(),
                status: "cli-only".to_string(),
                version: process_output(&output),
                message: "已检测到 Hermes CLI；ACP 健康检查通过前不能接入受控执行。".to_string(),
                capabilities: AgentExecutorCapabilities::unsupported("cli"),
            };
        }
    }
    AgentExecutorStatus {
        contract_version: AGENT_EXECUTOR_CONTRACT_VERSION.to_string(),
        id: "hermes".to_string(),
        protocol: "acp".to_string(),
        status: "not-installed".to_string(),
        version: String::new(),
        message: "未检测到 Hermes。安装并完成模型配置后，OmniDesk 才能将它作为可选执行器使用。"
            .to_string(),
        capabilities: acp_capabilities(true),
    }
}

fn acp_capabilities(usage: bool) -> AgentExecutorCapabilities {
    AgentExecutorCapabilities::governed_acp(usage)
}

fn candidate_programs(program: &str) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(home) = std::env::var("HOME") {
        paths.push(PathBuf::from(home).join(".local/bin").join(program));
    }
    paths.push(PathBuf::from(program));
    paths
}

fn process_output(output: &std::process::Output) -> String {
    let text = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    let trimmed = text.trim();
    let mut result = trimmed.chars().take(6_000).collect::<String>();
    if trimmed.chars().count() > 6_000 {
        result.push_str("\n...output trimmed...");
    }
    result
}

pub fn custom_provider_key_env(api_base: &str) -> Option<String> {
    let authority = api_base
        .trim()
        .split_once("://")
        .map(|(_, value)| value)
        .unwrap_or(api_base)
        .split('/')
        .next()
        .unwrap_or("")
        .split('@')
        .last()
        .unwrap_or("")
        .split(':')
        .next()
        .unwrap_or("");
    let mut labels = authority
        .split('.')
        .filter(|label| !label.is_empty())
        .collect::<Vec<_>>();
    while matches!(labels.first(), Some(&"api" | &"www")) {
        labels.remove(0);
    }
    let vendor = *labels.get(labels.len().checked_sub(2)?)?;
    let normalized = vendor
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() {
                ch.to_ascii_uppercase()
            } else {
                '_'
            }
        })
        .collect::<String>();
    if normalized.is_empty()
        || !normalized.starts_with(|ch: char| ch.is_ascii_alphabetic())
        || matches!(normalized.as_str(), "OPENAI" | "OPENROUTER" | "OLLAMA")
    {
        return None;
    }
    Some(format!("{}_API_KEY", normalized))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn custom_key_env_uses_the_provider_vendor_without_openai_aliases() {
        assert_eq!(
            custom_provider_key_env("https://aihub.firstshare.cn/v1"),
            Some("FIRSTSHARE_API_KEY".to_string())
        );
        assert_eq!(custom_provider_key_env("https://api.openai.com/v1"), None);
    }
}
