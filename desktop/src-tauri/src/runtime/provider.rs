use crate::runtime::repository::{JsonMutation, Repository};
use crate::runtime::state_namespace::state_path_for_read;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const PROVIDER_CONFIG_PATH: &str = ".omnidesk/data/desktop-provider.json";
const MODEL_CATALOG_PATH: &str = ".omnidesk/data/model-catalog.json";
const MODEL_HEALTH_PATH: &str = ".omnidesk/cache/model-health.json";
pub const PROVIDER_SCHEMA_VERSION: &str = "omnidesk.desktop-provider.v0.1";
const LEGACY_PROVIDER_SCHEMA_VERSION: &str = "project-os.desktop-provider.v0.1";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderModelTestResult {
    pub model: String,
    pub success: bool,
    pub message: String,
}

pub async fn test_connection(
    provider: &ProviderConfig,
    api_key: &str,
) -> Result<ProviderModelTestResult, String> {
    let response = post_chat_completion(
        provider,
        api_key,
        &serde_json::json!({
            "model": provider.model,
            "messages": [{ "role": "user", "content": "Reply with OK only." }],
            "temperature": 0
        }),
        Duration::from_secs(45),
    )
    .await?;
    let content = chat_completion_content(require_success(response, "模型测试失败").await?)
        .await
        .map_err(|error| {
            if error == "provider 返回空内容" {
                "模型返回为空".to_string()
            } else {
                error
            }
        })?;
    Ok(ProviderModelTestResult {
        model: provider.model.clone(),
        success: true,
        message: format!("{} 可用：{}", provider.model, trim_for_trace(&content)),
    })
}

pub fn model_test_config(
    api_base: &str,
    api_key_env: &str,
    model: &str,
) -> Result<ProviderConfig, String> {
    if api_base.trim().is_empty() {
        return Err("请先填写 API 请求地址".to_string());
    }
    if model.trim().is_empty() {
        return Err("请先选择或填写模型名称".to_string());
    }
    Ok(ProviderConfig {
        schema_version: PROVIDER_SCHEMA_VERSION.to_string(),
        provider: "openai-compatible".to_string(),
        model: model.trim().to_string(),
        api_base: api_base.trim().to_string(),
        api_key_env: api_key_env.trim().to_string(),
        enabled: true,
        active_profile_id: String::new(),
        profiles: Vec::new(),
    })
}

pub fn resolve_credential(
    root: &Path,
    api_key_env: &str,
    inline_api_key: &str,
) -> Result<String, String> {
    if !inline_api_key.trim().is_empty() {
        return Ok(inline_api_key.trim().to_string());
    }
    if api_key_env.trim().is_empty() {
        return Err("请先填写 Key 保存变量名或粘贴 API Key".to_string());
    }
    read_secret(root, api_key_env.trim())
        .ok_or_else(|| format!("环境变量或 .env.local 中未设置 {}", api_key_env.trim()))
}

pub async fn test_connection_with_credential(
    root: &Path,
    provider: &ProviderConfig,
    inline_api_key: &str,
) -> Result<ProviderModelTestResult, String> {
    let api_key = resolve_credential(root, &provider.api_key_env, inline_api_key)?;
    test_connection(provider, &api_key).await
}

pub async fn probe_catalog_with_credential(
    root: &Path,
    api_base: &str,
    api_key_env: &str,
    inline_api_key: &str,
) -> Result<Vec<String>, String> {
    let api_key = resolve_credential(root, api_key_env, inline_api_key)?;
    probe_model_catalog(api_base, &api_key).await
}

pub fn chat_completions_endpoint(api_base: &str) -> String {
    let base = api_base.trim_end_matches('/');
    if base.ends_with("/chat/completions") {
        base.to_string()
    } else {
        format!("{base}/chat/completions")
    }
}

pub fn models_endpoint(api_base: &str) -> String {
    let base = api_base.trim_end_matches('/');
    if base.ends_with("/models") {
        base.to_string()
    } else if base.ends_with("/chat/completions") {
        format!("{}/models", base.trim_end_matches("/chat/completions"))
    } else {
        format!("{base}/models")
    }
}

#[derive(Deserialize)]
struct ChatCompletionsResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: ChatResponseMessage,
}

#[derive(Deserialize)]
struct ChatResponseMessage {
    content: String,
}

#[derive(Deserialize)]
struct ModelsListResponse {
    data: Vec<ModelItem>,
}

#[derive(Deserialize)]
struct ModelItem {
    id: String,
}

/// The caller owns credential lookup and request policy. This module owns the
/// shared OpenAI-compatible transport shape so plan, draft, chat and provider
/// probes cannot drift into subtly different endpoint/error semantics.
pub fn http_client(timeout: Duration) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|err| err.to_string())
}

pub async fn post_chat_completion(
    provider: &ProviderConfig,
    api_key: &str,
    payload: &Value,
    timeout: Duration,
) -> Result<reqwest::Response, String> {
    http_client(timeout)?
        .post(chat_completions_endpoint(&provider.api_base))
        .bearer_auth(api_key)
        .json(payload)
        .send()
        .await
        .map_err(|err| err.to_string())
}

pub async fn get_models(
    api_base: &str,
    api_key: &str,
    timeout: Duration,
) -> Result<reqwest::Response, String> {
    http_client(timeout)?
        .get(models_endpoint(api_base))
        .bearer_auth(api_key)
        .send()
        .await
        .map_err(|err| err.to_string())
}

/// Fetches a normalized model catalog from an OpenAI-compatible connection.
/// Callers resolve credentials locally before entering this transport boundary.
pub async fn probe_model_catalog(api_base: &str, api_key: &str) -> Result<Vec<String>, String> {
    if api_base.trim().is_empty() {
        return Err("请先填写 API 请求地址".to_string());
    }
    if api_key.trim().is_empty() {
        return Err("请先填写 Key 保存变量名或粘贴 API Key".to_string());
    }
    let response = get_models(api_base.trim(), api_key.trim(), Duration::from_secs(30)).await?;
    listed_models(require_success(response, "模型列表请求失败").await?).await
}

pub async fn require_success(
    response: reqwest::Response,
    operation: &str,
) -> Result<reqwest::Response, String> {
    let status = response.status();
    if status.is_success() {
        return Ok(response);
    }
    let body = response.text().await.unwrap_or_default();
    Err(format!(
        "{operation} HTTP {status}: {}",
        trim_for_trace(&body)
    ))
}

pub async fn chat_completion_content(response: reqwest::Response) -> Result<String, String> {
    let chat: ChatCompletionsResponse = response.json().await.map_err(|err| err.to_string())?;
    chat.choices
        .first()
        .map(|choice| choice.message.content.trim().to_string())
        .filter(|content| !content.is_empty())
        .ok_or_else(|| "provider 返回空内容".to_string())
}

pub async fn listed_models(response: reqwest::Response) -> Result<Vec<String>, String> {
    let payload: ModelsListResponse = response.json().await.map_err(|err| err.to_string())?;
    let mut models = payload
        .data
        .into_iter()
        .map(|item| item.id.trim().to_string())
        .filter(|id| !id.is_empty())
        .collect::<Vec<_>>();
    models.sort();
    models.dedup();
    if models.is_empty() {
        return Err("接口返回成功，但没有拿到模型列表".to_string());
    }
    Ok(models)
}

pub fn trim_for_trace(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.chars().count() > 240 {
        format!("{}...", trimmed.chars().take(240).collect::<String>())
    } else {
        trimmed.to_string()
    }
}

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

/// Credential values remain outside runtime state. This DTO intentionally
/// contains only credential presence so the desktop can render each profile
/// without exposing secret material.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderStatus {
    pub provider: String,
    pub model: String,
    pub api_base: String,
    pub api_key_env: String,
    pub enabled: bool,
    pub has_api_key: bool,
    pub active_profile_id: String,
    pub profiles: Vec<ProviderProfileStatus>,
    pub source: String,
    pub workspace_root: String,
    pub revision: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderProfileStatus {
    pub id: String,
    pub name: String,
    pub note: String,
    pub website: String,
    pub provider: String,
    pub model: String,
    pub api_base: String,
    pub api_key_env: String,
    pub has_api_key: bool,
}

/// Builds the public Provider status without reading a credential. The caller
/// owns the secret boundary and supplies only a presence lookup.
pub fn status<F>(
    config: &ProviderConfig,
    workspace_root: String,
    revision: String,
    has_credential: F,
) -> ProviderStatus
where
    F: Fn(&str) -> bool,
{
    let profiles = config
        .profiles
        .iter()
        .map(|profile| ProviderProfileStatus {
            id: profile.id.clone(),
            name: profile.name.clone(),
            note: profile.note.clone(),
            website: profile.website.clone(),
            provider: profile.provider.clone(),
            model: profile.model.clone(),
            api_base: profile.api_base.clone(),
            api_key_env: profile.api_key_env.clone(),
            has_api_key: has_credential(&profile.api_key_env),
        })
        .collect();
    ProviderStatus {
        provider: config.provider.clone(),
        model: config.model.clone(),
        api_base: config.api_base.clone(),
        api_key_env: config.api_key_env.clone(),
        enabled: config.enabled,
        has_api_key: has_credential(&config.api_key_env),
        active_profile_id: config.active_profile_id.clone(),
        profiles,
        source: "tauri".to_string(),
        workspace_root,
        revision,
    }
}

/// The revision lets the desktop invalidate its status view when provider
/// configuration changes, without including any credential data in state.
pub fn status_source(root: &Path) -> (String, String) {
    let path = state_path_for_read(root, PROVIDER_CONFIG_PATH)
        .unwrap_or_else(|_| root.join(PROVIDER_CONFIG_PATH));
    let revision = fs::metadata(&path)
        .ok()
        .and_then(|metadata| {
            let modified = metadata.modified().ok()?.duration_since(UNIX_EPOCH).ok()?;
            Some(format!("{}-{}", modified.as_millis(), metadata.len()))
        })
        .unwrap_or_else(|| "missing".to_string());
    (root.to_string_lossy().to_string(), revision)
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

pub fn isolated_provider_key_env(base: &str, profile_id: &str) -> String {
    let suffix = profile_id
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() {
                ch.to_ascii_uppercase()
            } else {
                '_'
            }
        })
        .collect::<String>()
        .trim_matches('_')
        .to_string();
    let base = base.trim().trim_end_matches('_');
    format!(
        "{}_{}",
        if base.is_empty() {
            "OMNIDESK_API_KEY"
        } else {
            base
        },
        if suffix.is_empty() {
            "PROFILE"
        } else {
            suffix.as_str()
        }
    )
}

pub fn isolate_duplicate_provider_secrets(
    root: &Path,
    config: &mut ProviderConfig,
) -> Result<bool, String> {
    let mut used = std::collections::HashSet::new();
    let mut changed = false;
    for profile in &mut config.profiles {
        if used.insert(profile.api_key_env.clone()) {
            continue;
        }
        let previous_env = profile.api_key_env.clone();
        let mut next_env = isolated_provider_key_env(&previous_env, &profile.id);
        let mut index = 2;
        while used.contains(&next_env) {
            next_env = format!(
                "{}_{}",
                isolated_provider_key_env(&previous_env, &profile.id),
                index
            );
            index += 1;
        }
        migrate_secret(root, &previous_env, &next_env)?;
        if config.active_profile_id == profile.id {
            config.api_key_env = next_env.clone();
        }
        profile.api_key_env = next_env.clone();
        used.insert(next_env);
        changed = true;
    }
    Ok(changed)
}

pub fn upsert_provider_profile(profiles: &mut Vec<ProviderProfile>, profile: ProviderProfile) {
    if let Some(existing) = profiles.iter_mut().find(|item| item.id == profile.id) {
        *existing = profile;
    } else {
        profiles.push(profile);
    }
}

/// Normalizes an editable connection into the persisted profile shape. The
/// caller owns its transport DTO; the Provider domain owns profile identity
/// and required connection fields.
pub fn profile_from_input(
    provider: &str,
    model: &str,
    api_base: &str,
    api_key_env: &str,
    profile_id_value: &str,
    profile_name_value: &str,
    note: &str,
    website: &str,
) -> Result<ProviderProfile, String> {
    let provider = provider.trim();
    let model = model.trim();
    let api_base = api_base.trim();
    let api_key_env = api_key_env.trim();
    if provider.is_empty() {
        return Err("请输入 provider".to_string());
    }
    if model.is_empty() {
        return Err("请输入 model".to_string());
    }
    if api_base.is_empty() {
        return Err("请输入 apiBase".to_string());
    }
    if api_key_env.is_empty() {
        return Err("请输入 apiKeyEnv".to_string());
    }
    let id = if profile_id_value.trim().is_empty() {
        provider_profile_id(api_key_env)
    } else {
        profile_id_value.trim().to_string()
    };
    let name = if profile_name_value.trim().is_empty() {
        provider_profile_name(api_key_env, model)
    } else {
        profile_name_value.trim().to_string()
    };
    Ok(ProviderProfile {
        id,
        name,
        note: note.trim().to_string(),
        website: website.trim().to_string(),
        provider: provider.to_string(),
        model: model.to_string(),
        api_base: api_base.to_string(),
        api_key_env: api_key_env.to_string(),
    })
}

/// Selects the saved profile as active while preserving all other profiles.
/// Key values never enter this policy; profile key variable names must remain
/// unique so later secret removal cannot affect another connection.
pub fn save_profile(
    existing: &ProviderConfig,
    profile: ProviderProfile,
    enabled: bool,
) -> Result<ProviderConfig, String> {
    if existing
        .profiles
        .iter()
        .any(|item| item.id != profile.id && item.api_key_env == profile.api_key_env)
    {
        return Err("每个连接必须使用独立的 Key 保存变量，请重新保存连接。".to_string());
    }
    let mut profiles = existing.profiles.clone();
    upsert_provider_profile(&mut profiles, profile.clone());
    Ok(ProviderConfig {
        schema_version: PROVIDER_SCHEMA_VERSION.to_string(),
        provider: profile.provider,
        model: profile.model,
        api_base: profile.api_base,
        api_key_env: profile.api_key_env,
        enabled,
        active_profile_id: profile.id,
        profiles,
    })
}

/// Removes one profile and returns a key variable only when no remaining
/// profile references it. The caller owns the secret-file deletion boundary.
pub fn delete_profile(
    existing: &ProviderConfig,
    profile_id_value: &str,
) -> Result<(ProviderConfig, Option<String>), String> {
    let profile_id = profile_id_value.trim();
    if profile_id.is_empty() {
        return Err("缺少连接 ID".to_string());
    }
    let removed = existing
        .profiles
        .iter()
        .find(|profile| profile.id == profile_id)
        .cloned()
        .ok_or_else(|| "没有找到要删除的连接".to_string())?;
    let mut config = existing.clone();
    config.profiles.retain(|profile| profile.id != profile_id);
    let unused_key_env = (!removed.api_key_env.trim().is_empty()
        && !config
            .profiles
            .iter()
            .any(|profile| profile.api_key_env == removed.api_key_env))
    .then_some(removed.api_key_env);
    if config.active_profile_id == profile_id {
        if let Some(next) = config.profiles.first().cloned() {
            config.provider = next.provider;
            config.model = next.model;
            config.api_base = next.api_base;
            config.api_key_env = next.api_key_env;
            config.active_profile_id = next.id;
        } else {
            config.provider = "openai-compatible".to_string();
            config.model.clear();
            config.api_base.clear();
            config.api_key_env.clear();
            config.enabled = false;
            config.active_profile_id.clear();
        }
    }
    config.schema_version = PROVIDER_SCHEMA_VERSION.to_string();
    Ok((config, unused_key_env))
}

pub fn provider_profile_id(api_key_env: &str) -> String {
    api_key_env
        .trim()
        .to_lowercase()
        .trim_end_matches("_api_key")
        .replace('_', "-")
}

pub fn provider_profile_name(api_key_env: &str, model: &str) -> String {
    let name = api_key_env
        .trim()
        .trim_end_matches("_API_KEY")
        .replace('_', " ");
    if name.is_empty() {
        return model.to_string();
    }
    name.split_whitespace()
        .map(|part| {
            let mut chars = part.chars();
            chars
                .next()
                .map(|first| format!("{}{}", first.to_uppercase(), chars.as_str().to_lowercase()))
                .unwrap_or_default()
        })
        .collect::<Vec<_>>()
        .join(" ")
}

pub fn profile_config(config: &ProviderConfig, profile: &ProviderProfile) -> ProviderConfig {
    ProviderConfig {
        schema_version: config.schema_version.clone(),
        provider: profile.provider.clone(),
        model: profile.model.clone(),
        api_base: profile.api_base.clone(),
        api_key_env: profile.api_key_env.clone(),
        enabled: config.enabled,
        active_profile_id: profile.id.clone(),
        profiles: config.profiles.clone(),
    }
}

/// Returns the active profile first so failover keeps the user's selected
/// connection stable until its health evidence says otherwise.
pub fn ordered_profile_candidates(config: &ProviderConfig) -> Vec<(String, ProviderConfig)> {
    let mut candidates = vec![(config.active_profile_id.clone(), config.clone())];
    candidates.extend(
        config
            .profiles
            .iter()
            .filter(|profile| profile.id != config.active_profile_id)
            .map(|profile| (profile.id.clone(), profile_config(config, profile))),
    );
    candidates
}

pub fn health_entry<'a>(
    health: &'a ModelHealthCache,
    provider: &ProviderConfig,
) -> Option<&'a ModelHealthEntry> {
    health.entries.iter().find(|entry| {
        entry.api_base == provider.api_base
            && entry.api_key_env == provider.api_key_env
            && entry.model == provider.model
    })
}

pub fn health_is_fresh(entry: &ModelHealthEntry, now_seconds: u64) -> bool {
    let Ok(checked_at) = entry.checked_at.parse::<u64>() else {
        return false;
    };
    now_seconds >= checked_at && now_seconds - checked_at <= 60
}

pub fn current_unix_timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
        .to_string()
}

pub fn record_failure(root: &Path, provider: &ProviderConfig, message: &str) -> Result<(), String> {
    record_health(
        root,
        ModelHealthEntry {
            api_base: provider.api_base.clone(),
            api_key_env: provider.api_key_env.clone(),
            model: provider.model.clone(),
            status: classify_failure(message).to_string(),
            message: trim_for_trace(message),
            checked_at: current_unix_timestamp(),
        },
    )
}

/// Selects one usable saved connection, records every failed candidate, and
/// persists a successful fallback. The caller owns any executor-specific
/// synchronization that must happen after the active profile changes.
pub async fn prepare_for_request(
    root: &Path,
    configured: &ProviderConfig,
    excluded_profile_ids: &HashSet<String>,
) -> Result<(ProviderConfig, String), String> {
    let health = load_or_seed_health(root)?;
    let mut failures = Vec::new();
    for (profile_id, candidate) in ordered_profile_candidates(configured) {
        if excluded_profile_ids.contains(&profile_id) {
            continue;
        }
        let label = configured
            .profiles
            .iter()
            .find(|profile| profile.id == profile_id)
            .map(|profile| profile.name.clone())
            .filter(|name| !name.trim().is_empty())
            .unwrap_or_else(|| candidate.model.clone());
        let Some(api_key) = read_secret(root, &candidate.api_key_env) else {
            record_failure(root, &candidate, "未配置 API Key")?;
            failures.push(format!("{}（认证失败）", label));
            continue;
        };
        if let Some(entry) = health_entry(&health, &candidate) {
            let now = current_unix_timestamp().parse::<u64>().unwrap_or(0);
            if health_is_fresh(entry, now) {
                if entry.status == "available" {
                    let switch_note = if profile_id != configured.active_profile_id {
                        format!("已自动切换到可用连接「{}」。", label)
                    } else {
                        String::new()
                    };
                    if profile_id != configured.active_profile_id {
                        save_config(root, &candidate)?;
                    }
                    return Ok((candidate, switch_note));
                }
                failures.push(format!("{}（{}）", label, entry.status));
                continue;
            }
        }
        match test_connection(&candidate, &api_key).await {
            Ok(result) => {
                record_health(
                    root,
                    ModelHealthEntry {
                        api_base: candidate.api_base.clone(),
                        api_key_env: candidate.api_key_env.clone(),
                        model: candidate.model.clone(),
                        status: "available".to_string(),
                        message: result.message,
                        checked_at: current_unix_timestamp(),
                    },
                )?;
                let switch_note = if profile_id != configured.active_profile_id {
                    format!("已自动切换到可用连接「{}」。", label)
                } else {
                    String::new()
                };
                if profile_id != configured.active_profile_id {
                    save_config(root, &candidate)?;
                }
                return Ok((candidate, switch_note));
            }
            Err(error) => {
                record_failure(root, &candidate, &error)?;
                failures.push(format!("{}（{}）", label, classify_failure(&error)));
            }
        }
    }
    Err(format!(
        "没有可用模型连接：{}",
        if failures.is_empty() {
            "未找到可用 profile".to_string()
        } else {
            failures.join("；")
        }
    ))
}

/// Renders the Hermes gateway stanza without accessing the filesystem or any
/// secret value. Callers own the explicit user-directory write boundary.
pub fn render_hermes_runtime_config(
    current: &str,
    config: &ProviderConfig,
) -> Result<String, String> {
    let provider = serde_json::to_string("omnidesk-gateway").map_err(|err| err.to_string())?;
    let base_url = serde_json::to_string(config.api_base.trim()).map_err(|err| err.to_string())?;
    let api_mode = serde_json::to_string("chat_completions").map_err(|err| err.to_string())?;
    let model = serde_json::to_string(config.model.trim()).map_err(|err| err.to_string())?;
    let key_env =
        serde_json::to_string(config.api_key_env.trim()).map_err(|err| err.to_string())?;
    let fields = vec![
        format!("  provider: {provider}"),
        format!("  base_url: {base_url}"),
        format!("  api_mode: {api_mode}"),
        format!("  default: {model}"),
        format!("  key_env: {key_env}"),
    ];
    let mut lines = current.lines().map(ToString::to_string).collect::<Vec<_>>();
    match lines.iter().position(|line| line.trim() == "model:") {
        Some(start) => {
            let end = lines
                .iter()
                .enumerate()
                .skip(start + 1)
                .find_map(|(index, line)| {
                    let trimmed = line.trim();
                    (!trimmed.is_empty()
                        && !line.chars().next().is_some_and(char::is_whitespace)
                        && !trimmed.starts_with('#'))
                    .then_some(index)
                })
                .unwrap_or(lines.len());
            let mut preserved = lines[start + 1..end]
                .iter()
                .filter(|line| {
                    let key = line.trim_start();
                    ![
                        "provider:",
                        "base_url:",
                        "api_mode:",
                        "default:",
                        "key_env:",
                        "api_key_env:",
                    ]
                    .iter()
                    .any(|prefix| key.starts_with(prefix))
                })
                .cloned()
                .collect::<Vec<_>>();
            lines.splice(
                start + 1..end,
                fields.into_iter().chain(preserved.drain(..)),
            );
        }
        None => {
            let mut section = vec!["model:".to_string()];
            section.extend(fields);
            section.push(String::new());
            section.extend(lines);
            lines = section;
        }
    }
    upsert_hermes_gateway_provider(&mut lines, &base_url, &model, &api_mode, &key_env);
    Ok(format!("{}\n", lines.join("\n").trim_end()))
}

fn upsert_hermes_gateway_provider(
    lines: &mut Vec<String>,
    base_url: &str,
    model: &str,
    api_mode: &str,
    key_env: &str,
) {
    let fields = vec![
        format!("    base_url: {base_url}"),
        format!("    default_model: {model}"),
        format!("    api_mode: {api_mode}"),
        format!("    key_env: {key_env}"),
    ];
    let providers_start = match lines.iter().position(|line| line.trim() == "providers:") {
        Some(index) => index,
        None => {
            if !lines.is_empty() && !lines.last().is_some_and(|line| line.trim().is_empty()) {
                lines.push(String::new());
            }
            lines.push("providers:".to_string());
            lines.push("  omnidesk-gateway:".to_string());
            lines.extend(fields);
            return;
        }
    };
    let providers_end = lines
        .iter()
        .enumerate()
        .skip(providers_start + 1)
        .find_map(|(index, line)| {
            let trimmed = line.trim();
            (!trimmed.is_empty()
                && !trimmed.starts_with('#')
                && !line.chars().next().is_some_and(char::is_whitespace))
            .then_some(index)
        })
        .unwrap_or(lines.len());
    let gateway_start = (providers_start + 1..providers_end).find(|index| {
        let line = &lines[*index];
        line.starts_with("  ") && !line.starts_with("   ") && line.trim() == "omnidesk-gateway:"
    });
    let Some(gateway_start) = gateway_start else {
        let mut entry = vec!["  omnidesk-gateway:".to_string()];
        entry.extend(fields);
        lines.splice(providers_end..providers_end, entry);
        return;
    };
    let gateway_end = (gateway_start + 1..providers_end)
        .find(|index| {
            let line = &lines[*index];
            !line.trim().is_empty()
                && !line.trim().starts_with('#')
                && line.starts_with("  ")
                && !line.starts_with("   ")
        })
        .unwrap_or(providers_end);
    let mut preserved = lines[gateway_start + 1..gateway_end]
        .iter()
        .filter(|line| {
            let key = line.trim_start();
            ![
                "base_url:",
                "default_model:",
                "api_mode:",
                "key_env:",
                "api_key_env:",
            ]
            .iter()
            .any(|prefix| key.starts_with(prefix))
        })
        .cloned()
        .collect::<Vec<_>>();
    lines.splice(
        gateway_start + 1..gateway_end,
        fields.into_iter().chain(preserved.drain(..)),
    );
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
        schema_version: PROVIDER_SCHEMA_VERSION.to_string(),
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
    if config.schema_version != PROVIDER_SCHEMA_VERSION {
        config.schema_version = PROVIDER_SCHEMA_VERSION.to_string();
        changed = true;
    }
    changed
}

pub fn load_or_seed_config(root: &Path) -> Result<ProviderConfig, String> {
    if let Some(value) = Repository::new(root).read_json(PROVIDER_CONFIG_PATH) {
        let mut config: ProviderConfig =
            serde_json::from_value(value).map_err(|err| err.to_string())?;
        let legacy_schema = config.schema_version == LEGACY_PROVIDER_SCHEMA_VERSION;
        if normalize_config(&mut config) && !legacy_schema {
            save_config(root, &config)?;
        }
        return Ok(config);
    }
    let config = default_config();
    save_config(root, &config)?;
    Ok(config)
}
pub fn save_config(root: &Path, config: &ProviderConfig) -> Result<(), String> {
    let mut config = config.clone();
    config.schema_version = PROVIDER_SCHEMA_VERSION.to_string();
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
        schema_version: "omnidesk.model-catalog.v0.1".to_string(),
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
        cache.schema_version = "omnidesk.model-health.v0.1".to_string();
        save_health(root, &cache)?;
        return Ok(cache);
    }
    let cache = ModelHealthCache {
        schema_version: "omnidesk.model-health.v0.1".to_string(),
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
                schema_version: "omnidesk.model-health.v0.1".to_string(),
                entries: Vec::new(),
            });
        cache.schema_version = "omnidesk.model-health.v0.1".to_string();
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

pub fn save_secret_and_enable(
    root: &Path,
    config: &ProviderConfig,
    api_key_env: &str,
    api_key: &str,
) -> Result<ProviderConfig, String> {
    let api_key_env = api_key_env.trim();
    let api_key = api_key.trim();
    if api_key_env.is_empty() {
        return Err("缺少 API Key Env".to_string());
    }
    if api_key.is_empty() {
        return Err("请先粘贴 API Key".to_string());
    }
    if !api_key_env
        .chars()
        .all(|ch| ch.is_ascii_uppercase() || ch.is_ascii_digit() || ch == '_')
    {
        return Err("API Key Env 只能使用大写字母、数字和下划线".to_string());
    }
    write_secret(root, api_key_env, api_key)?;
    let mut next = config.clone();
    next.api_key_env = api_key_env.to_string();
    next.enabled = true;
    save_config(root, &next)?;
    Ok(next)
}

pub fn sync_hermes_runtime_config(config: &ProviderConfig) -> Result<(), String> {
    if !config.enabled || config.model.trim().is_empty() || config.api_base.trim().is_empty() {
        return Ok(());
    }
    let Some(home) = std::env::var_os("HOME") else {
        return Ok(());
    };
    let path = PathBuf::from(home).join(".hermes/config.yaml");
    if !path.is_file() {
        return Ok(());
    }
    let current =
        fs::read_to_string(&path).map_err(|err| format!("读取 Hermes 配置失败: {err}"))?;
    let next = render_hermes_runtime_config(&current, config)?;
    if next != current {
        crate::runtime::repository::write_atomic(&path, next.as_bytes())
            .map_err(|err| format!("同步 Hermes 配置失败: {err}"))?;
    }
    Ok(())
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

    fn test_directory(label: &str) -> std::path::PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        std::env::temp_dir().join(format!("omnidesk-{label}-{}-{nonce}", std::process::id()))
    }
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
        assert_eq!(config.schema_version, PROVIDER_SCHEMA_VERSION);
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
        assert_eq!(
            classify_failure("provider HTTP 401: invalid token"),
            "authentication-failed"
        );
        assert_eq!(
            classify_failure("provider HTTP 404: model_not_found"),
            "model-unavailable"
        );
        assert_eq!(classify_failure("request timed out"), "network-unavailable");
    }

    #[test]
    fn status_projection_uses_credential_presence_without_receiving_secret_values() {
        let mut config = default_config();
        config.profiles.push(ProviderProfile {
            id: "fallback".to_string(),
            name: "Fallback".to_string(),
            note: "备用连接".to_string(),
            website: "https://fallback.example".to_string(),
            provider: "openai-compatible".to_string(),
            model: "fallback-model".to_string(),
            api_base: "https://fallback.example/v1".to_string(),
            api_key_env: "FALLBACK_API_KEY".to_string(),
        });

        let status = status(
            &config,
            "/workspace".to_string(),
            "42-64".to_string(),
            |key| key == "FALLBACK_API_KEY",
        );

        assert!(!status.has_api_key);
        assert_eq!(status.workspace_root, "/workspace");
        assert_eq!(status.revision, "42-64");
        assert_eq!(status.profiles.len(), 2);
        assert!(!status.profiles[0].has_api_key);
        assert!(status.profiles[1].has_api_key);
        let serialized = serde_json::to_value(status).unwrap();
        assert_eq!(serialized["source"], "tauri");
        assert_eq!(serialized["profiles"][1]["apiKeyEnv"], "FALLBACK_API_KEY");
        assert!(serialized.to_string().contains("FALLBACK_API_KEY"));
        assert!(!serialized.to_string().contains("secret-value"));
    }

    #[test]
    fn endpoint_helpers_normalize_provider_roots_and_existing_routes() {
        assert_eq!(
            chat_completions_endpoint("https://api.example.test/v1/"),
            "https://api.example.test/v1/chat/completions"
        );
        assert_eq!(
            chat_completions_endpoint("https://api.example.test/v1/chat/completions"),
            "https://api.example.test/v1/chat/completions"
        );
        assert_eq!(
            models_endpoint("https://api.example.test/v1/chat/completions"),
            "https://api.example.test/v1/models"
        );
        assert_eq!(
            models_endpoint("https://api.example.test/v1/models"),
            "https://api.example.test/v1/models"
        );
    }

    #[tokio::test]
    async fn model_catalog_probe_rejects_missing_connection_inputs_before_network_io() {
        assert_eq!(
            probe_model_catalog("", "key").await.unwrap_err(),
            "请先填写 API 请求地址"
        );
        assert_eq!(
            probe_model_catalog("https://api.example/v1", "")
                .await
                .unwrap_err(),
            "请先填写 Key 保存变量名或粘贴 API Key"
        );
    }

    #[tokio::test]
    async fn preflight_switches_after_a_quota_failure_and_records_both_profiles() {
        use std::io::{Read as _, Write as _};
        use std::net::TcpListener;

        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = std::thread::spawn(move || {
            for (status, body) in [
                (
                    "403 Forbidden",
                    r#"{"error":{"message":"subscription quota insufficient"}}"#,
                ),
                ("200 OK", r#"{"choices":[{"message":{"content":"OK"}}]}"#),
            ] {
                let (mut stream, _) = listener.accept().unwrap();
                let mut request = [0_u8; 4096];
                let _ = stream.read(&mut request);
                write!(
                    stream,
                    "HTTP/1.1 {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    status,
                    body.len(),
                    body
                )
                .unwrap();
            }
        });
        let root = test_directory("provider-preflight");
        fs::create_dir_all(&root).unwrap();
        write_secret(&root, "TW_KEY", "test-primary").unwrap();
        write_secret(&root, "QY_KEY", "test-fallback").unwrap();
        let primary = ProviderProfile {
            id: "tw".to_string(),
            name: "TW Gateway".to_string(),
            note: String::new(),
            website: String::new(),
            provider: "openai-compatible".to_string(),
            model: "primary".to_string(),
            api_base: format!("http://{}", address),
            api_key_env: "TW_KEY".to_string(),
        };
        let fallback = ProviderProfile {
            id: "qy".to_string(),
            name: "QY".to_string(),
            note: String::new(),
            website: String::new(),
            provider: "openai-compatible".to_string(),
            model: "fallback".to_string(),
            api_base: format!("http://{}", address),
            api_key_env: "QY_KEY".to_string(),
        };
        let config = ProviderConfig {
            schema_version: LEGACY_PROVIDER_SCHEMA_VERSION.to_string(),
            provider: primary.provider.clone(),
            model: primary.model.clone(),
            api_base: primary.api_base.clone(),
            api_key_env: primary.api_key_env.clone(),
            enabled: true,
            active_profile_id: primary.id.clone(),
            profiles: vec![primary, fallback],
        };

        let (selected, note) = prepare_for_request(&root, &config, &HashSet::new())
            .await
            .unwrap();

        assert_eq!(selected.active_profile_id, "qy");
        assert!(note.contains("QY"));
        assert_eq!(load_or_seed_config(&root).unwrap().active_profile_id, "qy");
        let health = load_or_seed_health(&root).unwrap();
        assert_eq!(health.entries.len(), 2);
        assert!(health
            .entries
            .iter()
            .any(|entry| entry.status == "quota-exhausted"));
        assert!(health
            .entries
            .iter()
            .any(|entry| entry.status == "available"));
        server.join().unwrap();
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn profile_helpers_keep_duplicate_keys_isolated_without_exposing_values() {
        assert_eq!(provider_profile_id("EXAMPLE_API_KEY"), "example");
        assert_eq!(
            provider_profile_name("EXAMPLE_API_KEY", "fallback"),
            "Example"
        );
        assert_eq!(
            isolated_provider_key_env("EXAMPLE_API_KEY", "team one"),
            "EXAMPLE_API_KEY_TEAM_ONE"
        );
        let mut profiles = vec![ProviderProfile {
            id: "existing".to_string(),
            name: "Existing".to_string(),
            note: String::new(),
            website: String::new(),
            provider: "openai-compatible".to_string(),
            model: "first".to_string(),
            api_base: "https://one.test".to_string(),
            api_key_env: "FIRST_API_KEY".to_string(),
        }];
        upsert_provider_profile(
            &mut profiles,
            ProviderProfile {
                id: "existing".to_string(),
                name: "Updated".to_string(),
                note: String::new(),
                website: String::new(),
                provider: "openai-compatible".to_string(),
                model: "second".to_string(),
                api_base: "https://two.test".to_string(),
                api_key_env: "SECOND_API_KEY".to_string(),
            },
        );
        assert_eq!(profiles.len(), 1);
        assert_eq!(profiles[0].api_key_env, "SECOND_API_KEY");
    }

    #[test]
    fn profile_mutation_policy_keeps_keys_isolated_and_reselects_active_profile() {
        let existing = default_config();
        let fallback = profile_from_input(
            "openai-compatible",
            "fallback-model",
            "https://fallback.example/v1",
            "FALLBACK_API_KEY",
            "",
            "",
            "备用连接",
            "https://fallback.example",
        )
        .unwrap();
        assert_eq!(fallback.id, "fallback");
        assert_eq!(fallback.name, "Fallback");

        let saved = save_profile(&existing, fallback.clone(), true).unwrap();
        assert_eq!(saved.active_profile_id, "fallback");
        assert_eq!(saved.api_key_env, "FALLBACK_API_KEY");
        assert_eq!(saved.profiles.len(), 2);

        let duplicate = ProviderProfile {
            id: "duplicate".to_string(),
            name: "Duplicate".to_string(),
            note: String::new(),
            website: String::new(),
            provider: "openai-compatible".to_string(),
            model: "duplicate-model".to_string(),
            api_base: "https://duplicate.example/v1".to_string(),
            api_key_env: "FALLBACK_API_KEY".to_string(),
        };
        assert!(save_profile(&saved, duplicate, true).is_err());

        let (after_delete, unused_key_env) = delete_profile(&saved, "fallback").unwrap();
        assert_eq!(unused_key_env.as_deref(), Some("FALLBACK_API_KEY"));
        assert_eq!(after_delete.active_profile_id, "deepseek");
        assert_eq!(after_delete.api_key_env, "DEEPSEEK_API_KEY");
        assert!(after_delete.enabled);

        let (empty, unused_key_env) = delete_profile(&after_delete, "deepseek").unwrap();
        assert_eq!(unused_key_env.as_deref(), Some("DEEPSEEK_API_KEY"));
        assert!(empty.profiles.is_empty());
        assert!(!empty.enabled);
        assert!(
            profile_from_input("", "model", "https://api.example", "KEY", "", "", "", "").is_err()
        );
    }

    #[test]
    fn provider_candidates_keep_active_profile_first_and_health_is_scoped() {
        let mut config = default_config();
        let fallback = ProviderProfile {
            id: "fallback".to_string(),
            name: "Fallback".to_string(),
            note: String::new(),
            website: String::new(),
            provider: "openai-compatible".to_string(),
            model: "fallback-model".to_string(),
            api_base: "https://fallback.example/v1".to_string(),
            api_key_env: "FALLBACK_API_KEY".to_string(),
        };
        config.profiles.push(fallback.clone());
        let candidates = ordered_profile_candidates(&config);
        assert_eq!(candidates.len(), 2);
        assert_eq!(candidates[0].0, config.active_profile_id);
        assert_eq!(candidates[1].0, "fallback");
        assert_eq!(candidates[1].1.model, "fallback-model");

        let health = ModelHealthCache {
            schema_version: "omnidesk.model-health.v0.1".to_string(),
            entries: vec![ModelHealthEntry {
                api_base: fallback.api_base.clone(),
                api_key_env: fallback.api_key_env.clone(),
                model: fallback.model.clone(),
                status: "available".to_string(),
                message: "OK".to_string(),
                checked_at: "100".to_string(),
            }],
        };
        let fallback_config = profile_config(&config, &fallback);
        assert!(health_entry(&health, &config).is_none());
        assert!(health_entry(&health, &fallback_config).is_some());
        assert!(health_is_fresh(
            health_entry(&health, &fallback_config).unwrap(),
            160
        ));
        assert!(!health_is_fresh(
            health_entry(&health, &fallback_config).unwrap(),
            161
        ));
    }

    #[test]
    fn legacy_provider_config_is_read_without_secret_migration_and_rewritten_on_save() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-provider-legacy-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(root.join(".omnidesk/data")).unwrap();
        fs::write(
            root.join(PROVIDER_CONFIG_PATH),
            r#"{"schemaVersion":"project-os.desktop-provider.v0.1","provider":"openai-compatible","model":"legacy-model","apiBase":"https://example.test/v1","apiKeyEnv":"LEGACY_PROVIDER_API_KEY","enabled":true}"#,
        )
        .unwrap();
        let config = load_or_seed_config(&root).unwrap();
        assert_eq!(config.schema_version, PROVIDER_SCHEMA_VERSION);
        assert_eq!(config.api_key_env, "LEGACY_PROVIDER_API_KEY");
        let on_disk = Repository::new(&root)
            .read_json(PROVIDER_CONFIG_PATH)
            .unwrap();
        assert_eq!(on_disk["schemaVersion"], LEGACY_PROVIDER_SCHEMA_VERSION);

        save_config(&root, &config).unwrap();
        let saved = Repository::new(&root)
            .read_json(PROVIDER_CONFIG_PATH)
            .unwrap();
        assert_eq!(saved["schemaVersion"], PROVIDER_SCHEMA_VERSION);
        assert_eq!(saved["apiKeyEnv"], "LEGACY_PROVIDER_API_KEY");
        fs::remove_dir_all(root).unwrap();
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

    #[test]
    fn credential_resolution_prefers_inline_values_without_persisting_them() {
        let root = test_directory("provider-inline-secret");
        fs::create_dir_all(&root).unwrap();
        write_secret(&root, "EXAMPLE_API_KEY", "stored").unwrap();
        assert_eq!(
            resolve_credential(&root, "EXAMPLE_API_KEY", " temporary ").unwrap(),
            "temporary"
        );
        assert_eq!(
            resolve_credential(&root, "EXAMPLE_API_KEY", "").unwrap(),
            "stored"
        );
        assert_eq!(
            resolve_credential(&root, "", "").unwrap_err(),
            "请先填写 Key 保存变量名或粘贴 API Key"
        );
        assert!(!fs::read_to_string(root.join(".env.local"))
            .unwrap()
            .contains("temporary"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn saved_provider_secret_is_validated_enabled_and_kept_outside_state() {
        let root = test_directory("provider-save-secret");
        fs::create_dir_all(&root).unwrap();
        let config = default_config();
        assert_eq!(
            save_secret_and_enable(&root, &config, "bad-key", "secret")
                .err()
                .unwrap(),
            "API Key Env 只能使用大写字母、数字和下划线"
        );
        let saved = save_secret_and_enable(&root, &config, "OMNIDESK_TEST_KEY", "secret").unwrap();
        assert!(saved.enabled);
        assert_eq!(saved.api_key_env, "OMNIDESK_TEST_KEY");
        assert_eq!(
            read_secret(&root, "OMNIDESK_TEST_KEY").as_deref(),
            Some("secret")
        );
        let state = Repository::new(&root)
            .read_json(PROVIDER_CONFIG_PATH)
            .unwrap()
            .to_string();
        assert!(!state.contains("secret"));
        fs::remove_dir_all(root).unwrap();
    }
}
