use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CcWorkbenchSecrets {
    #[serde(default)]
    pub anthropic_api_key: String,
    #[serde(default)]
    pub provider_keys: HashMap<String, String>,
}

pub fn secrets_path(data_dir: &Path) -> PathBuf {
    data_dir.join("cc-secrets.json")
}

pub fn normalize_api_key(raw: &str) -> String {
    let trimmed = raw.trim();
    trimmed
        .strip_prefix("Bearer ")
        .or_else(|| trimmed.strip_prefix("bearer "))
        .unwrap_or(trimmed)
        .trim()
        .to_string()
}

pub fn load_secrets(data_dir: &Path) -> Result<CcWorkbenchSecrets, String> {
    let path = secrets_path(data_dir);
    if !path.is_file() {
        return Ok(CcWorkbenchSecrets::default());
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut secrets: CcWorkbenchSecrets = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    migrate_legacy_key(&mut secrets);
    Ok(secrets)
}

pub fn save_secrets(data_dir: &Path, secrets: &CcWorkbenchSecrets) -> Result<(), String> {
    let path = secrets_path(data_dir);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(secrets).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

pub fn get_api_key(secrets: &CcWorkbenchSecrets) -> Option<String> {
    let key = normalize_api_key(&secrets.anthropic_api_key);
    if key.is_empty() {
        None
    } else {
        Some(key)
    }
}

impl CcWorkbenchSecrets {
    pub fn get_provider_key(&self, provider_id: &str) -> Option<String> {
        self.provider_keys
            .get(provider_id)
            .map(|k| normalize_api_key(k))
            .filter(|k| !k.is_empty())
            .or_else(|| {
                if provider_id == super::providers::OFFICIAL_PROVIDER_ID {
                    get_api_key(self)
                } else {
                    None
                }
            })
    }

    pub fn set_provider_key(&mut self, provider_id: &str, key: String) {
        let normalized = normalize_api_key(&key);
        if normalized.is_empty() {
            self.provider_keys.remove(provider_id);
        } else {
            self.provider_keys.insert(provider_id.to_string(), normalized);
        }
    }

    pub fn remove_provider_key(&mut self, provider_id: &str) {
        self.provider_keys.remove(provider_id);
    }

    pub fn set_legacy_api_key(&mut self, key: String) {
        self.anthropic_api_key = normalize_api_key(&key);
    }
}

fn migrate_legacy_key(secrets: &mut CcWorkbenchSecrets) {
    let legacy = normalize_api_key(&secrets.anthropic_api_key);
    if legacy.is_empty() {
        return;
    }
    secrets
        .provider_keys
        .entry(super::providers::OFFICIAL_PROVIDER_ID.to_string())
        .or_insert(legacy);
}
