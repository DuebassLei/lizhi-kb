use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum CwdMode {
    #[default]
    Vault,
    Project,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum CcProviderMode {
    #[default]
    Official,
    Custom,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CcPromptEnhancerConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub auto_trigger: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub system_prompt: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CcWorkbenchConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub cwd_mode: CwdMode,
    #[serde(default)]
    pub project_path: Option<String>,
    #[serde(default)]
    pub provider_mode: CcProviderMode,
    #[serde(default)]
    pub base_url: String,
    #[serde(default)]
    pub model: String,
    #[serde(default)]
    pub fast_model: String,
    #[serde(default)]
    pub active_provider_id: Option<String>,
    #[serde(default)]
    pub providers: Vec<super::providers::CcProviderEntry>,
    #[serde(default)]
    pub provider_order: Vec<String>,
    #[serde(default)]
    pub prompt_enhancer: CcPromptEnhancerConfig,
    #[serde(default)]
    pub agent_market_url: Option<String>,
    #[serde(default)]
    pub skill_market_url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CcWorkbenchConfigPublic {
    pub enabled: bool,
    pub cwd_mode: CwdMode,
    pub project_path: Option<String>,
    pub provider_mode: CcProviderMode,
    pub base_url: String,
    pub model: String,
    pub fast_model: String,
    pub active_provider_id: Option<String>,
    pub providers: Vec<super::providers::CcProviderPublic>,
    pub api_key_masked: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    #[serde(default)]
    pub prompt_enhancer: CcPromptEnhancerConfig,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_market_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skill_market_url: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CcWorkbenchConfigUpdate {
    pub enabled: Option<bool>,
    pub cwd_mode: Option<CwdMode>,
    pub project_path: Option<String>,
    pub provider_mode: Option<CcProviderMode>,
    pub base_url: Option<String>,
    pub model: Option<String>,
    pub fast_model: Option<String>,
    pub anthropic_api_key: Option<String>,
    pub prompt_enhancer: Option<CcPromptEnhancerConfig>,
    pub agent_market_url: Option<String>,
    pub skill_market_url: Option<String>,
}

pub fn config_path(data_dir: &Path) -> PathBuf {
    data_dir.join("cc-workbench.json")
}

pub fn load_config(data_dir: &Path) -> Result<CcWorkbenchConfig, String> {
    let path = config_path(data_dir);
    if !path.is_file() {
        return Ok(CcWorkbenchConfig::default());
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

pub fn load_config_ready(data_dir: &Path) -> Result<CcWorkbenchConfig, String> {
    let mut config = load_config(data_dir)?;
    super::providers::ensure_builtin_providers(&mut config);
    if let Some(path) = config.project_path.clone() {
        if super::path_utils::normalize_config_path(&path).is_err() {
            config.project_path = None;
            let _ = save_config(data_dir, &config);
        }
    }
    Ok(config)
}

pub fn save_config(data_dir: &Path, config: &CcWorkbenchConfig) -> Result<(), String> {
    let path = config_path(data_dir);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

pub fn to_public(
    config: &CcWorkbenchConfig,
    secrets: &super::secrets::CcWorkbenchSecrets,
    reveal_provider_id: Option<&str>,
) -> CcWorkbenchConfigPublic {
    let active_id = config.active_provider_id.as_deref();
    let key = active_id
        .and_then(|id| secrets.get_provider_key(id))
        .or_else(|| super::secrets::get_api_key(secrets));
    CcWorkbenchConfigPublic {
        enabled: config.enabled,
        cwd_mode: config.cwd_mode,
        project_path: config.project_path.clone(),
        provider_mode: config.provider_mode,
        base_url: config.base_url.clone(),
        model: config.model.clone(),
        fast_model: config.fast_model.clone(),
        active_provider_id: config.active_provider_id.clone(),
        providers: super::providers::providers_for_public(config, secrets, reveal_provider_id),
        api_key_masked: mask_key(key.as_deref()),
        api_key: None,
        prompt_enhancer: config.prompt_enhancer.clone(),
        agent_market_url: config.agent_market_url.clone(),
        skill_market_url: config.skill_market_url.clone(),
    }
}

pub fn to_public_with_reveal(
    config: &CcWorkbenchConfig,
    secrets: &super::secrets::CcWorkbenchSecrets,
    reveal_key: bool,
    reveal_provider_id: Option<&str>,
) -> CcWorkbenchConfigPublic {
    let reveal_id = if reveal_key {
        reveal_provider_id.or(config.active_provider_id.as_deref())
    } else {
        reveal_provider_id
    };
    let mut public = to_public(config, secrets, reveal_id);
    if let Some(id) = reveal_id {
        public.api_key = secrets.get_provider_key(id);
    }
    public
}

pub fn apply_update(
    config: &mut CcWorkbenchConfig,
    secrets: &mut super::secrets::CcWorkbenchSecrets,
    update: &CcWorkbenchConfigUpdate,
) -> Result<(), String> {
    if let Some(enabled) = update.enabled {
        config.enabled = enabled;
    }
    if let Some(mode) = update.cwd_mode {
        config.cwd_mode = mode;
    }
    if let Some(path) = &update.project_path {
        let trimmed = path.trim();
        config.project_path = if trimmed.is_empty() {
            None
        } else {
            Some(super::path_utils::normalize_config_path(trimmed)?)
        };
    }
    if let Some(mode) = update.provider_mode {
        config.provider_mode = mode;
    }
    if let Some(url) = &update.base_url {
        config.base_url = normalize_base_url(url);
    }
    if let Some(model) = &update.model {
        config.model = model.trim().to_string();
    }
    if let Some(model) = &update.fast_model {
        config.fast_model = model.trim().to_string();
    }
    if let Some(key) = &update.anthropic_api_key {
        let normalized = super::secrets::normalize_api_key(key);
        let active = config
            .active_provider_id
            .clone()
            .unwrap_or_else(|| super::providers::OFFICIAL_PROVIDER_ID.to_string());
        if normalized.is_empty() {
            secrets.remove_provider_key(&active);
            secrets.anthropic_api_key.clear();
        } else {
            secrets.set_provider_key(&active, normalized.clone());
            secrets.set_legacy_api_key(normalized);
        }
    }
    if let Some(enhancer) = &update.prompt_enhancer {
        config.prompt_enhancer = enhancer.clone();
    }
    if let Some(url) = &update.agent_market_url {
        let trimmed = url.trim();
        config.agent_market_url = if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        };
    }
    if let Some(url) = &update.skill_market_url {
        let trimmed = url.trim();
        config.skill_market_url = if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        };
    }
    super::providers::sync_legacy_from_active(config, secrets);
    Ok(())
}

pub fn normalize_base_url(raw: &str) -> String {
    let mut url = raw.trim().trim_end_matches('/').to_string();
    if url.len() >= 12 && url.to_lowercase().ends_with("/v1/messages") {
        url.truncate(url.len() - "/v1/messages".len());
        url = url.trim_end_matches('/').to_string();
    }
    url
}

fn mask_key(key: Option<&str>) -> String {
    match key.filter(|k| !k.is_empty()) {
        None => String::new(),
        Some(k) if k.len() <= 8 => "••••••••".to_string(),
        Some(k) => format!("{}••••{}", &k[..4], &k[k.len() - 4..]),
    }
}

#[cfg(test)]
mod tests {
    use super::normalize_base_url;

    #[test]
    fn strips_v1_messages_suffix_from_anthropic_proxy_url() {
        assert_eq!(
            normalize_base_url("https://lab.iwhalecloud.com/gpt-proxy/anthropic/v1/messages"),
            "https://lab.iwhalecloud.com/gpt-proxy/anthropic"
        );
    }

    #[test]
    fn keeps_deepseek_anthropic_base_url() {
        assert_eq!(
            normalize_base_url("https://api.deepseek.com/anthropic"),
            "https://api.deepseek.com/anthropic"
        );
    }
}
