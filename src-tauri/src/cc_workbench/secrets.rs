use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::crypto::{read_sealed, write_sealed, DEK_LEN};
use crate::prefs::{CC_SECRETS_ENC_FILENAME, CC_SECRETS_FILENAME};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CcWorkbenchSecrets {
    #[serde(default)]
    pub anthropic_api_key: String,
    #[serde(default)]
    pub provider_keys: HashMap<String, String>,
}

pub fn secrets_path(data_dir: &Path) -> PathBuf {
    data_dir.join(CC_SECRETS_FILENAME)
}

pub fn secrets_enc_path(data_dir: &Path) -> PathBuf {
    data_dir.join(CC_SECRETS_ENC_FILENAME)
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

pub fn load_secrets(
    data_dir: &Path,
    encryption_enabled: bool,
    dek: Option<&[u8; DEK_LEN]>,
) -> Result<CcWorkbenchSecrets, String> {
    let enc_path = secrets_enc_path(data_dir);
    let plain_path = secrets_path(data_dir);

    if enc_path.is_file() {
        let dek = dek.ok_or_else(|| "VAULT_LOCKED".to_string())?;
        let bytes = read_sealed(&enc_path, dek).map_err(|e| e.to_string())?;
        let mut secrets: CcWorkbenchSecrets =
            serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
        migrate_legacy_key(&mut secrets);
        return Ok(secrets);
    }

    if plain_path.is_file() {
        let raw = fs::read_to_string(&plain_path).map_err(|e| e.to_string())?;
        let mut secrets: CcWorkbenchSecrets =
            serde_json::from_str(&raw).map_err(|e| e.to_string())?;
        migrate_legacy_key(&mut secrets);
        if encryption_enabled {
            let dek = dek.ok_or_else(|| "VAULT_LOCKED".to_string())?;
            save_secrets(data_dir, &secrets, true, Some(dek))?;
        }
        return Ok(secrets);
    }

    Ok(CcWorkbenchSecrets::default())
}

pub fn save_secrets(
    data_dir: &Path,
    secrets: &CcWorkbenchSecrets,
    encryption_enabled: bool,
    dek: Option<&[u8; DEK_LEN]>,
) -> Result<(), String> {
    let json = serde_json::to_vec_pretty(secrets).map_err(|e| e.to_string())?;

    if encryption_enabled {
        let dek = dek.ok_or_else(|| "VAULT_LOCKED".to_string())?;
        let enc_path = secrets_enc_path(data_dir);
        write_sealed(&enc_path, dek, &json).map_err(|e| e.to_string())?;
        let plain = secrets_path(data_dir);
        if plain.is_file() {
            let _ = fs::remove_file(plain);
        }
    } else {
        let plain = secrets_path(data_dir);
        if let Some(parent) = plain.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::write(&plain, json).map_err(|e| e.to_string())?;
        let enc = secrets_enc_path(data_dir);
        if enc.is_file() {
            let _ = fs::remove_file(enc);
        }
    }
    Ok(())
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
