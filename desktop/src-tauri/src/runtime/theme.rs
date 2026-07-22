use crate::runtime::repository::{JsonMutation, Repository};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

pub const THEME_PATH: &str = ".omnidesk/data/desktop-theme.json";
pub const SCHEMA_VERSION: &str = "omnidesk.desktop-theme.v0.1";
pub const LEGACY_SCHEMA_VERSION: &str = "project-os.desktop-theme.v0.1";

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DesktopThemeAccent {
    pub id: String,
    pub label: String,
    pub h: u16,
    pub s: String,
    pub l: String,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DesktopThemeConfig {
    pub schema_version: String,
    pub mode: String,
    pub accent: DesktopThemeAccent,
    #[serde(default)]
    pub accents: Vec<DesktopThemeAccent>,
}

pub fn load_or_seed(app_root: &Path) -> Result<DesktopThemeConfig, String> {
    let path = crate::runtime::state_namespace::state_path_for_read(app_root, THEME_PATH)
        .unwrap_or_else(|_| app_root.join(THEME_PATH));
    if path.exists() {
        let content = fs::read_to_string(&path).map_err(|err| err.to_string())?;
        let config: DesktopThemeConfig =
            serde_json::from_str(&content).map_err(|err| err.to_string())?;
        let legacy_schema = config.schema_version == LEGACY_SCHEMA_VERSION;
        let normalized = normalize(config);
        if !legacy_schema {
            save(app_root, &normalized)?;
        }
        return Ok(normalized);
    }
    let config = default_config();
    save(app_root, &config)?;
    Ok(config)
}

pub fn save(app_root: &Path, config: &DesktopThemeConfig) -> Result<(), String> {
    let mut config = config.clone();
    config.schema_version = SCHEMA_VERSION.to_string();
    Repository::new(app_root).transaction(
        "save-desktop-theme",
        &[JsonMutation::upsert(
            THEME_PATH,
            serde_json::to_value(config).map_err(|err| err.to_string())?,
        )],
    ).map(|_| ())
}

pub fn normalize(mut config: DesktopThemeConfig) -> DesktopThemeConfig {
    config.schema_version = SCHEMA_VERSION.to_string();
    if config.mode != "light" {
        config.mode = "dark".to_string();
    }
    config.accent = normalize_accent(config.accent);
    config.accents = config
        .accents
        .into_iter()
        .map(normalize_accent)
        .filter(|accent| !accent.id.is_empty())
        .fold(Vec::new(), |mut unique, accent| {
            if !unique
                .iter()
                .any(|item: &DesktopThemeAccent| item.id == accent.id)
            {
                unique.push(accent);
            }
            unique
        });
    if config.accent.id.starts_with("custom-")
        && !config
            .accents
            .iter()
            .any(|item| item.id == config.accent.id)
    {
        config.accents.push(config.accent.clone());
    }
    config
}

fn default_config() -> DesktopThemeConfig {
    DesktopThemeConfig {
        schema_version: SCHEMA_VERSION.to_string(),
        mode: "dark".to_string(),
        accent: DesktopThemeAccent {
            id: "mint".to_string(),
            label: "Mint".to_string(),
            h: 160,
            s: "80%".to_string(),
            l: "47%".to_string(),
        },
        accents: Vec::new(),
    }
}

fn normalize_accent(mut accent: DesktopThemeAccent) -> DesktopThemeAccent {
    accent.id = accent.id.trim().to_string();
    if accent.id.is_empty() {
        accent.id = "custom".to_string();
    }
    if accent.label.trim().is_empty() {
        accent.label = accent.id.clone();
    }
    if accent.h > 360 {
        accent.h = 160;
    }
    if !accent.s.ends_with('%') {
        accent.s = "80%".to_string();
    }
    if !accent.l.ends_with('%') {
        accent.l = "47%".to_string();
    }
    accent
}
