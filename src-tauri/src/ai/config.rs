use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub const DEFAULT_LOCAL_BASE_URL: &str = "http://127.0.0.1:11434";
pub const DEFAULT_LOCAL_MODEL: &str = "qwen2.5:7b";
pub const DEFAULT_RAG_TOP_K: u8 = 8;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudProvider {
    pub id: String,
    pub name: String,
    pub base_url: String,
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiConfig {
    pub enabled: bool,
    #[serde(default = "default_provider")]
    pub provider: String,
    #[serde(default = "default_local_base_url")]
    pub local_base_url: String,
    #[serde(default = "default_local_model")]
    pub local_model: String,
    #[serde(default)]
    pub cloud_enabled: bool,
    #[serde(default)]
    pub cloud_providers: Vec<CloudProvider>,
    #[serde(default)]
    pub active_cloud_provider_id: Option<String>,
    #[serde(default = "default_rag_top_k")]
    pub rag_top_k: u8,
    #[serde(default)]
    pub write_enabled: bool,
    #[serde(default = "default_network_hosts")]
    pub network_hosts: Vec<String>,
}

fn default_provider() -> String {
    "ollama".to_string()
}

fn default_local_base_url() -> String {
    DEFAULT_LOCAL_BASE_URL.to_string()
}

fn default_local_model() -> String {
    DEFAULT_LOCAL_MODEL.to_string()
}

fn default_rag_top_k() -> u8 {
    DEFAULT_RAG_TOP_K
}

fn default_network_hosts() -> Vec<String> {
    vec![
        "127.0.0.1".to_string(),
        "localhost".to_string(),
        "::1".to_string(),
    ]
}

impl Default for AiConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            provider: default_provider(),
            local_base_url: default_local_base_url(),
            local_model: default_local_model(),
            cloud_enabled: false,
            cloud_providers: Vec::new(),
            active_cloud_provider_id: None,
            rag_top_k: default_rag_top_k(),
            write_enabled: false,
            network_hosts: default_network_hosts(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudProviderPublic {
    pub id: String,
    pub name: String,
    pub base_url: String,
    pub model: String,
    pub api_key_masked: String,
    pub api_key: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiConfigPublic {
    pub enabled: bool,
    pub provider: String,
    pub local_base_url: String,
    pub local_model: String,
    pub cloud_enabled: bool,
    pub cloud_providers: Vec<CloudProviderPublic>,
    pub active_cloud_provider_id: Option<String>,
    pub rag_top_k: u8,
    pub write_enabled: bool,
    pub network_hosts: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudProviderUpdate {
    pub id: Option<String>,
    pub name: String,
    pub base_url: String,
    pub model: String,
    pub api_key: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiConfigUpdate {
    pub enabled: Option<bool>,
    pub provider: Option<String>,
    pub local_base_url: Option<String>,
    pub local_model: Option<String>,
    pub cloud_enabled: Option<bool>,
    pub cloud_providers: Option<Vec<CloudProviderUpdate>>,
    pub active_cloud_provider_id: Option<Option<String>>,
    pub rag_top_k: Option<u8>,
    pub write_enabled: Option<bool>,
    pub network_hosts: Option<Vec<String>>,
}

pub fn config_path(data_dir: &Path) -> PathBuf {
    data_dir.join("ai-config.json")
}

fn migrate_legacy_config(value: &mut serde_json::Value, secrets: &mut super::secrets::AiSecrets) -> bool {
    let has_providers = value
        .get("cloudProviders")
        .and_then(|v| v.as_array())
        .is_some_and(|a| !a.is_empty());
    if has_providers {
        return false;
    }

    let cloud_enabled = value
        .get("cloudEnabled")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let base_url = value
        .get("cloudBaseUrl")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    let model = value
        .get("cloudModel")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();

    if !cloud_enabled && base_url.is_empty() {
        return false;
    }

    let id = Uuid::new_v4().to_string();
    let provider = serde_json::json!({
        "id": id,
        "name": "默认云端",
        "baseUrl": if base_url.is_empty() { "https://api.deepseek.com/v1" } else { base_url.as_str() },
        "model": if model.is_empty() { "deepseek-chat" } else { model.as_str() },
    });
    value["cloudProviders"] = serde_json::json!([provider]);
    value["activeCloudProviderId"] = serde_json::json!(id);

    if !secrets.cloud_api_key.is_empty() {
        secrets.cloud_api_keys.insert(id.clone(), secrets.cloud_api_key.clone());
    }
    true
}

pub fn load_config(data_dir: &Path) -> Result<AiConfig, String> {
    let path = config_path(data_dir);
    if !path.is_file() {
        let config = AiConfig::default();
        save_config(data_dir, &config)?;
        return Ok(config);
    }

    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut value: serde_json::Value =
        serde_json::from_str(&raw).map_err(|e| e.to_string())?;

    let mut secrets = super::secrets::load_secrets(data_dir)?;
    let secrets_dirty = super::secrets::migrate_legacy_secrets(&mut secrets);
    let config_migrated = migrate_legacy_config(&mut value, &mut secrets);

    if secrets_dirty || config_migrated {
        super::secrets::save_secrets(data_dir, &secrets)?;
    }

    let config: AiConfig = serde_json::from_value(value).map_err(|e| e.to_string())?;

    if config_migrated {
        save_config(data_dir, &config)?;
    }

    Ok(config)
}

pub fn save_config(data_dir: &Path, config: &AiConfig) -> Result<(), String> {
    let path = config_path(data_dir);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

pub fn mask_secret(value: &str) -> String {
    if value.is_empty() {
        return String::new();
    }
    if value.len() <= 8 {
        return "****".to_string();
    }
    format!("{}…{}", &value[..4], &value[value.len() - 4..])
}

pub fn provider_public(
    provider: &CloudProvider,
    secrets: &super::secrets::AiSecrets,
    reveal_key: bool,
) -> CloudProviderPublic {
    let key = secrets.cloud_api_keys.get(&provider.id).cloned().unwrap_or_default();
    CloudProviderPublic {
        id: provider.id.clone(),
        name: provider.name.clone(),
        base_url: provider.base_url.clone(),
        model: provider.model.clone(),
        api_key_masked: mask_secret(&key),
        api_key: if reveal_key && !key.is_empty() {
            Some(key)
        } else {
            None
        },
    }
}

pub fn to_public(config: &AiConfig, secrets: &super::secrets::AiSecrets, reveal_key: bool) -> AiConfigPublic {
    AiConfigPublic {
        enabled: config.enabled,
        provider: config.provider.clone(),
        local_base_url: config.local_base_url.clone(),
        local_model: config.local_model.clone(),
        cloud_enabled: config.cloud_enabled,
        cloud_providers: config
            .cloud_providers
            .iter()
            .map(|p| provider_public(p, secrets, reveal_key))
            .collect(),
        active_cloud_provider_id: config.active_cloud_provider_id.clone(),
        rag_top_k: config.rag_top_k,
        write_enabled: config.write_enabled,
        network_hosts: config.network_hosts.clone(),
    }
}

pub fn find_provider<'a>(config: &'a AiConfig, provider_id: &str) -> Option<&'a CloudProvider> {
    config
        .cloud_providers
        .iter()
        .find(|p| p.id == provider_id)
}

pub fn apply_update(
    config: &mut AiConfig,
    secrets: &mut super::secrets::AiSecrets,
    update: &AiConfigUpdate,
) {
    if let Some(enabled) = update.enabled {
        config.enabled = enabled;
    }
    if let Some(provider) = &update.provider {
        config.provider = provider.clone();
    }
    if let Some(url) = &update.local_base_url {
        config.local_base_url = url.trim().to_string();
    }
    if let Some(model) = &update.local_model {
        config.local_model = model.trim().to_string();
    }
    if let Some(cloud_enabled) = update.cloud_enabled {
        config.cloud_enabled = cloud_enabled;
    }
    if let Some(providers) = &update.cloud_providers {
        let mut next = Vec::with_capacity(providers.len());
        for item in providers {
            let id = item
                .id
                .clone()
                .filter(|s| !s.trim().is_empty())
                .unwrap_or_else(|| Uuid::new_v4().to_string());
            if let Some(key) = item.api_key.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
                secrets.cloud_api_keys.insert(id.clone(), key.to_string());
            }
            next.push(CloudProvider {
                id,
                name: item.name.trim().to_string(),
                base_url: item.base_url.trim().to_string(),
                model: item.model.trim().to_string(),
            });
        }
        let valid_ids: std::collections::HashSet<String> =
            next.iter().map(|p| p.id.clone()).collect();
        secrets
            .cloud_api_keys
            .retain(|id, _| valid_ids.contains(id));
        config.cloud_providers = next;
    }
    if let Some(active) = &update.active_cloud_provider_id {
        config.active_cloud_provider_id = active.clone();
    }
    if let Some(top_k) = update.rag_top_k {
        config.rag_top_k = top_k.clamp(1, 20);
    }
    if let Some(write_enabled) = update.write_enabled {
        config.write_enabled = write_enabled;
    }
    if let Some(hosts) = &update.network_hosts {
        config.network_hosts = hosts
            .iter()
            .map(|h| h.trim().to_lowercase())
            .filter(|h| !h.is_empty())
            .collect();
    }

    if let Some(active_id) = &config.active_cloud_provider_id {
        if !config.cloud_providers.iter().any(|p| &p.id == active_id) {
            config.active_cloud_provider_id = config.cloud_providers.first().map(|p| p.id.clone());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_is_disabled() {
        let config = AiConfig::default();
        assert!(!config.enabled);
        assert!(!config.cloud_enabled);
        assert!(config.cloud_providers.is_empty());
    }
}
