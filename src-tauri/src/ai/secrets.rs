use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiSecrets {
    #[serde(default)]
    pub cloud_api_keys: HashMap<String, String>,
    /// 旧版单 Key 字段，加载后迁移到 `cloud_api_keys`
    #[serde(default, skip_serializing)]
    pub cloud_api_key: String,
}

pub fn secrets_path(data_dir: &Path) -> PathBuf {
    data_dir.join("ai-secrets.json")
}

pub fn migrate_legacy_secrets(secrets: &mut AiSecrets) -> bool {
    if secrets.cloud_api_key.is_empty() {
        return false;
    }
    if secrets.cloud_api_keys.is_empty() {
        secrets
            .cloud_api_keys
            .insert("legacy".to_string(), secrets.cloud_api_key.clone());
    }
    secrets.cloud_api_key.clear();
    true
}

pub fn load_secrets(data_dir: &Path) -> Result<AiSecrets, String> {
    let path = secrets_path(data_dir);
    if !path.is_file() {
        return Ok(AiSecrets::default());
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut secrets: AiSecrets = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    migrate_legacy_secrets(&mut secrets);
    Ok(secrets)
}

pub fn save_secrets(data_dir: &Path, secrets: &AiSecrets) -> Result<(), String> {
    let path = secrets_path(data_dir);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let to_save = AiSecrets {
        cloud_api_keys: secrets.cloud_api_keys.clone(),
        cloud_api_key: String::new(),
    };
    let json = serde_json::to_string_pretty(&to_save).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

/// 规范化 API Key：去掉首尾空白，并移除用户误填的 `Bearer ` 前缀（请求时会自动添加）。
pub fn normalize_api_key(raw: &str) -> String {
    let trimmed = raw.trim();
    trimmed
        .strip_prefix("Bearer ")
        .or_else(|| trimmed.strip_prefix("bearer "))
        .or_else(|| trimmed.strip_prefix("BEARER "))
        .unwrap_or(trimmed)
        .trim()
        .to_string()
}

pub fn get_cloud_api_key(secrets: &AiSecrets, provider_id: &str) -> Option<String> {
    secrets
        .cloud_api_keys
        .get(provider_id)
        .map(|k| normalize_api_key(k))
        .filter(|k| !k.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_strips_bearer_prefix() {
        assert_eq!(
            normalize_api_key("Bearer ailab_abc123"),
            "ailab_abc123"
        );
        assert_eq!(
            normalize_api_key("bearer ailab_abc123"),
            "ailab_abc123"
        );
    }

    #[test]
    fn normalize_keeps_plain_key() {
        assert_eq!(normalize_api_key("  ailab_abc123  "), "ailab_abc123");
    }
}
