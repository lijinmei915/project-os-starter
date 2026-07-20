use crate::runtime::repository::{JsonMutation, Repository};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::process::Command;

const PROVIDER_CONFIG_PATH: &str = ".project-os/desktop-provider.json";
const MODEL_CATALOG_PATH: &str = ".project-os/model-catalog.json";
const MODEL_HEALTH_PATH: &str = ".project-os/model-health.json";

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfig {
    pub schema_version: String,
    pub provider: String,
    pub model: String,
    pub api_base: String,
    pub api_key_env: String,
    pub enabled: bool,
    #[serde(default)]
    pub active_profile_id: String,
    #[serde(default)]
    pub profiles: Vec<ProviderProfile>,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProviderProfile {
    pub id: String,
    pub name: String,
    pub note: String,
    pub website: String,
    pub provider: String,
    pub model: String,
    pub api_base: String,
    pub api_key_env: String,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModelCatalog {
    pub schema_version: String,
    pub providers: Vec<ModelCatalogProvider>,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModelCatalogProvider {
    pub id: String,
    pub label: String,
    #[serde(default)]
    pub note: String,
    #[serde(default)]
    pub website: String,
    pub provider: String,
    pub api_base: String,
    pub api_key_env: String,
    pub models: Vec<String>,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModelHealthCache {
    pub schema_version: String,
    #[serde(default)]
    pub entries: Vec<ModelHealthEntry>,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModelHealthEntry {
    pub api_base: String,
    pub api_key_env: String,
    pub model: String,
    pub status: String,
    pub message: String,
    pub checked_at: String,
}

/// Keeps execution failures explainable without persisting credentials or raw
/// provider payloads. These values are shared with the desktop presentation.
pub fn classify_failure(message: &str) -> &'static str {
    let text = message.to_lowercase();
    if text.contains("insufficient_user_quota")
        || text.contains("quota insufficient")
        || text.contains("subscription quota")
        || text.contains("额度不足")
        || text.contains("订阅额度")
    {
        "quota-exhausted"
    } else if text.contains("http 401")
        || text.contains("http 403")
        || text.contains("invalid api key")
        || text.contains("invalid token")
        || text.contains("unauthorized")
        || text.contains("认证失败")
    {
        "authentication-failed"
    } else if text.contains("model_not_found")
        || text.contains("model not found")
        || text.contains("unknown model")
        || text.contains("模型不存在")
        || text.contains("模型不可用")
    {
        "model-unavailable"
    } else if text.contains("timed out")
        || text.contains("timeout")
        || text.contains("connection")
        || text.contains("dns")
        || text.contains("网络")
        || text.contains("连接")
    {
        "network-unavailable"
    } else {
        "unavailable"
    }
}

fn profile_id(api_key_env: &str) -> String {
    api_key_env
        .trim()
        .to_lowercase()
        .trim_end_matches("_api_key")
        .replace('_', "-")
}
fn profile_name(api_key_env: &str, model: &str) -> String {
    let value = api_key_env
        .trim()
        .trim_end_matches("_API_KEY")
        .replace('_', " ");
    if value.is_empty() {
        model.to_string()
    } else {
        value
    }
}

pub fn default_config() -> ProviderConfig {
    let profile = ProviderProfile {
        id: "deepseek".to_string(),
        name: "DeepSeek".to_string(),
        note: "DeepSeek 官方账号".to_string(),
        website: "https://platform.deepseek.com".to_string(),
        provider: "openai-compatible".to_string(),
        model: "deepseek-v4-flash".to_string(),
        api_base: "https://api.deepseek.com/v1".to_string(),
        api_key_env: "DEEPSEEK_API_KEY".to_string(),
    };
    ProviderConfig {
        schema_version: "project-os.desktop-provider.v0.1".to_string(),
        provider: profile.provider.clone(),
        model: profile.model.clone(),
        api_base: profile.api_base.clone(),
        api_key_env: profile.api_key_env.clone(),
        enabled: false,
        active_profile_id: profile.id.clone(),
        profiles: vec![profile],
    }
}

fn normalize_config(config: &mut ProviderConfig) -> bool {
    let mut changed = false;
    if config.active_profile_id.trim().is_empty() {
        config.active_profile_id = profile_id(&config.api_key_env);
        changed = true;
    }
    if config.profiles.is_empty() {
        config.profiles.push(ProviderProfile {
            id: config.active_profile_id.clone(),
            name: profile_name(&config.api_key_env, &config.model),
            note: String::new(),
            website: String::new(),
            provider: config.provider.clone(),
            model: config.model.clone(),
            api_base: config.api_base.clone(),
            api_key_env: config.api_key_env.clone(),
        });
        changed = true;
    }
    if config.schema_version != "project-os.desktop-provider.v0.1" {
        config.schema_version = "project-os.desktop-provider.v0.1".to_string();
        changed = true;
    }
    changed
}

pub fn load_or_seed_config(root: &Path) -> Result<ProviderConfig, String> {
    if let Some(value) = Repository::new(root).read_json(PROVIDER_CONFIG_PATH) {
        let mut config: ProviderConfig =
            serde_json::from_value(value).map_err(|err| err.to_string())?;
        if normalize_config(&mut config) {
            save_config(root, &config)?;
        }
        return Ok(config);
    }
    let config = default_config();
    save_config(root, &config)?;
    Ok(config)
}
pub fn save_config(root: &Path, config: &ProviderConfig) -> Result<(), String> {
    Repository::new(root).transaction(
        "save-provider-config",
        &[JsonMutation::upsert(
            PROVIDER_CONFIG_PATH,
            serde_json::to_value(config).map_err(|err| err.to_string())?,
        )],
    )?;
    Ok(())
}

pub fn default_catalog() -> ModelCatalog {
    ModelCatalog {
        schema_version: "project-os.model-catalog.v0.1".to_string(),
        providers: vec![
            ModelCatalogProvider {
                id: "openai".to_string(),
                label: "OpenAI".to_string(),
                note: "OpenAI 官方账号".to_string(),
                website: "https://platform.openai.com".to_string(),
                provider: "openai-compatible".to_string(),
                api_base: "https://api.openai.com/v1".to_string(),
                api_key_env: "OPENAI_API_KEY".to_string(),
                models: vec![
                    "gpt-5.5".to_string(),
                    "gpt-5.4".to_string(),
                    "gpt-5.4-mini".to_string(),
                    "gpt-5.4-nano".to_string(),
                    "gpt-4.1-mini".to_string(),
                ],
            },
            ModelCatalogProvider {
                id: "deepseek".to_string(),
                label: "DeepSeek".to_string(),
                note: "DeepSeek 官方账号".to_string(),
                website: "https://platform.deepseek.com".to_string(),
                provider: "openai-compatible".to_string(),
                api_base: "https://api.deepseek.com/v1".to_string(),
                api_key_env: "DEEPSEEK_API_KEY".to_string(),
                models: vec![
                    "deepseek-v4-flash".to_string(),
                    "deepseek-chat".to_string(),
                    "deepseek-reasoner".to_string(),
                ],
            },
            ModelCatalogProvider {
                id: "qwen".to_string(),
                label: "Qwen".to_string(),
                note: "阿里百炼 / DashScope".to_string(),
                website: "https://dashscope.aliyun.com".to_string(),
                provider: "openai-compatible".to_string(),
                api_base: "https://dashscope.aliyuncs.com/compatible-mode/v1".to_string(),
                api_key_env: "DASHSCOPE_API_KEY".to_string(),
                models: vec![
                    "qwen3.7-max".to_string(),
                    "qwen3.7-plus".to_string(),
                    "qwen3.6-flash".to_string(),
                    "qwen-plus".to_string(),
                ],
            },
            ModelCatalogProvider {
                id: "gateway".to_string(),
                label: "Gateway".to_string(),
                note: "公司或团队统一中转".to_string(),
                website: "https://your-gateway.example".to_string(),
                provider: "openai-compatible".to_string(),
                api_base: "https://your-gateway.example/v1".to_string(),
                api_key_env: "LLM_GATEWAY_API_KEY".to_string(),
                models: vec!["your-model".to_string()],
            },
        ],
    }
}
pub fn load_or_seed_catalog(root: &Path) -> Result<ModelCatalog, String> {
    if let Some(value) = Repository::new(root).read_json(MODEL_CATALOG_PATH) {
        let catalog: ModelCatalog = serde_json::from_value(value).map_err(|err| err.to_string())?;
        if !catalog.providers.is_empty() {
            return Ok(catalog);
        }
    }
    let catalog = default_catalog();
    save_catalog(root, &catalog)?;
    Ok(catalog)
}
pub fn save_catalog(root: &Path, catalog: &ModelCatalog) -> Result<(), String> {
    Repository::new(root).transaction(
        "save-model-catalog",
        &[JsonMutation::upsert(
            MODEL_CATALOG_PATH,
            serde_json::to_value(catalog).map_err(|err| err.to_string())?,
        )],
    )?;
    Ok(())
}

pub fn load_or_seed_health(root: &Path) -> Result<ModelHealthCache, String> {
    if let Some(value) = Repository::new(root).read_json(MODEL_HEALTH_PATH) {
        let mut cache: ModelHealthCache =
            serde_json::from_value(value).map_err(|err| err.to_string())?;
        cache.schema_version = "project-os.model-health.v0.1".to_string();
        save_health(root, &cache)?;
        return Ok(cache);
    }
    let cache = ModelHealthCache {
        schema_version: "project-os.model-health.v0.1".to_string(),
        entries: Vec::new(),
    };
    save_health(root, &cache)?;
    Ok(cache)
}
pub fn save_health(root: &Path, cache: &ModelHealthCache) -> Result<(), String> {
    Repository::new(root).transaction(
        "save-model-health",
        &[JsonMutation::upsert(
            MODEL_HEALTH_PATH,
            serde_json::to_value(cache).map_err(|err| err.to_string())?,
        )],
    )?;
    Ok(())
}
pub fn upsert_health(cache: &mut ModelHealthCache, entry: ModelHealthEntry) {
    if let Some(existing) = cache.entries.iter_mut().find(|item| {
        item.api_base == entry.api_base
            && item.api_key_env == entry.api_key_env
            && item.model == entry.model
    }) {
        *existing = entry
    } else {
        cache.entries.push(entry)
    }
}
pub fn record_health(root: &Path, entry: ModelHealthEntry) -> Result<(), String> {
    Repository::new(root).transaction_with("record-model-health", |repository| {
        let mut cache = repository
            .read_json(MODEL_HEALTH_PATH)
            .map(|value| serde_json::from_value(value).map_err(|err| err.to_string()))
            .transpose()?
            .unwrap_or(ModelHealthCache {
                schema_version: "project-os.model-health.v0.1".to_string(),
                entries: Vec::new(),
            });
        cache.schema_version = "project-os.model-health.v0.1".to_string();
        upsert_health(&mut cache, entry);
        Ok((
            (),
            vec![JsonMutation::upsert(
                MODEL_HEALTH_PATH,
                serde_json::to_value(cache).map_err(|err| err.to_string())?,
            )],
        ))
    })
}

/// Provider credentials live outside Repository state on purpose: transaction
/// journals must never contain plaintext secrets. This module remains the only
/// runtime owner of the local secret-file format and uses atomic replacement.
pub fn read_secret(root: &Path, key: &str) -> Option<String> {
    if let Ok(value) = std::env::var(key) {
        if !value.trim().is_empty() {
            return Some(value);
        }
    }
    read_dotenv_value(root.join(".env.local"), key)
        .or_else(|| read_dotenv_value(root.join(".env"), key))
        .or_else(|| read_launchctl_env_value(key))
}

pub fn write_secret(root: &Path, key: &str, value: &str) -> Result<(), String> {
    let path = root.join(".env.local");
    let mut lines = fs::read_to_string(&path)
        .unwrap_or_else(|_| "# Local secrets only. This file is ignored by git.\n".to_string())
        .lines()
        .map(ToString::to_string)
        .collect::<Vec<_>>();
    let next_line = format!("{key}={}", escape_dotenv_value(value));
    let mut replaced = false;
    for line in &mut lines {
        let trimmed = line.trim_start();
        if trimmed.starts_with('#') {
            continue;
        }
        if let Some((name, _)) = trimmed.split_once('=') {
            if name.trim() == key {
                *line = next_line.clone();
                replaced = true;
                break;
            }
        }
    }
    if !replaced {
        if !lines.last().map(|line| line.is_empty()).unwrap_or(false) {
            lines.push(String::new());
        }
        lines.push(next_line);
    }
    crate::runtime::repository::write_atomic(&path, format!("{}\n", lines.join("\n")).as_bytes())
}

pub fn remove_secret(root: &Path, key: &str) -> Result<(), String> {
    let path = root.join(".env.local");
    let Ok(content) = fs::read_to_string(&path) else {
        return Ok(());
    };
    let lines = content
        .lines()
        .filter(|line| {
            let trimmed = line.trim_start();
            trimmed.starts_with('#')
                || trimmed
                    .split_once('=')
                    .map(|(name, _)| name.trim() != key)
                    .unwrap_or(true)
        })
        .map(ToString::to_string)
        .collect::<Vec<_>>();
    crate::runtime::repository::write_atomic(&path, format!("{}\n", lines.join("\n")).as_bytes())
}

pub fn migrate_secret(root: &Path, previous_key: &str, next_key: &str) -> Result<(), String> {
    if previous_key != next_key {
        if let Some(secret) = read_secret(root, previous_key) {
            write_secret(root, next_key, &secret)?;
        }
    }
    Ok(())
}

fn read_dotenv_value(path: std::path::PathBuf, key: &str) -> Option<String> {
    let content = fs::read_to_string(path).ok()?;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let Some((name, value)) = trimmed.split_once('=') else {
            continue;
        };
        if name.trim() == key {
            return Some(clean_dotenv_value(value));
        }
    }
    None
}

fn escape_dotenv_value(value: &str) -> String {
    if value
        .chars()
        .any(|ch| ch.is_whitespace() || ch == '"' || ch == '\'' || ch == '#')
    {
        format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\""))
    } else {
        value.to_string()
    }
}

fn clean_dotenv_value(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.len() >= 2 {
        let first = trimmed.as_bytes()[0] as char;
        let last = trimmed.as_bytes()[trimmed.len() - 1] as char;
        if (first == '"' && last == '"') || (first == '\'' && last == '\'') {
            return trimmed[1..trimmed.len() - 1].to_string();
        }
    }
    trimmed.to_string()
}

fn read_launchctl_env_value(key: &str) -> Option<String> {
    let output = Command::new("launchctl")
        .args(["getenv", key])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
    (!value.is_empty()).then_some(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};
    #[test]
    fn provider_state_round_trips_through_repository() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-provider-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let config = load_or_seed_config(&root).unwrap();
        assert_eq!(config.schema_version, "project-os.desktop-provider.v0.1");
        record_health(
            &root,
            ModelHealthEntry {
                api_base: "https://api.example/v1".to_string(),
                api_key_env: "EXAMPLE_API_KEY".to_string(),
                model: "example".to_string(),
                status: "available".to_string(),
                message: "OK".to_string(),
                checked_at: "now".to_string(),
            },
        )
        .unwrap();
        record_health(
            &root,
            ModelHealthEntry {
                api_base: "https://api.example/v1".to_string(),
                api_key_env: "EXAMPLE_API_KEY".to_string(),
                model: "example".to_string(),
                status: "unavailable".to_string(),
                message: "changed".to_string(),
                checked_at: "later".to_string(),
            },
        )
        .unwrap();
        let health = load_or_seed_health(&root).unwrap();
        assert_eq!(health.entries.len(), 1);
        assert_eq!(health.entries[0].status, "unavailable");
        assert!(!load_or_seed_catalog(&root).unwrap().providers.is_empty());
    }

    #[test]
    fn classifies_provider_failures_without_collapsing_quota_or_auth() {
        assert_eq!(
            classify_failure("provider HTTP 403: subscription quota insufficient"),
            "quota-exhausted"
        );
        assert_eq!(classify_failure("provider HTTP 401: invalid token"), "authentication-failed");
        assert_eq!(classify_failure("provider HTTP 404: model_not_found"), "model-unavailable");
        assert_eq!(classify_failure("request timed out"), "network-unavailable");
    }
    #[test]
    fn secrets_are_atomically_replaced_and_removed() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-provider-secret-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        write_secret(&root, "EXAMPLE_API_KEY", "first value").unwrap();
        write_secret(&root, "EXAMPLE_API_KEY", "next").unwrap();
        assert_eq!(
            read_secret(&root, "EXAMPLE_API_KEY").as_deref(),
            Some("next")
        );
        let text = fs::read_to_string(root.join(".env.local")).unwrap();
        assert_eq!(text.matches("EXAMPLE_API_KEY=").count(), 1);
        remove_secret(&root, "EXAMPLE_API_KEY").unwrap();
        assert!(read_secret(&root, "EXAMPLE_API_KEY").is_none());
        fs::remove_dir_all(root).unwrap();
    }
}
