use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::crypto::{read_sealed, write_sealed, DEK_LEN};
use crate::prefs::{AI_SECRETS_ENC_FILENAME, AI_SECRETS_FILENAME};

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
    data_dir.join(AI_SECRETS_FILENAME)
}

pub fn secrets_enc_path(data_dir: &Path) -> PathBuf {
    data_dir.join(AI_SECRETS_ENC_FILENAME)
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

/// `encryption_enabled` + `dek`：加密库在解锁态读写密封文件；明文库忽略 dek。
pub fn load_secrets(
    data_dir: &Path,
    encryption_enabled: bool,
    dek: Option<&[u8; DEK_LEN]>,
) -> Result<AiSecrets, String> {
    let enc_path = secrets_enc_path(data_dir);
    let plain_path = secrets_path(data_dir);

    if enc_path.is_file() {
        let dek = dek.ok_or_else(|| "VAULT_LOCKED".to_string())?;
        let bytes = read_sealed(&enc_path, dek).map_err(|e| e.to_string())?;
        let mut secrets: AiSecrets =
            serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
        migrate_legacy_secrets(&mut secrets);
        return Ok(secrets);
    }

    if plain_path.is_file() {
        let raw = fs::read_to_string(&plain_path).map_err(|e| e.to_string())?;
        let mut secrets: AiSecrets = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
        let dirty = migrate_legacy_secrets(&mut secrets);
        if encryption_enabled {
            let dek = dek.ok_or_else(|| "VAULT_LOCKED".to_string())?;
            save_secrets(data_dir, &secrets, true, Some(dek))?;
        } else if dirty {
            save_secrets(data_dir, &secrets, false, None)?;
        }
        return Ok(secrets);
    }

    Ok(AiSecrets::default())
}

pub fn save_secrets(
    data_dir: &Path,
    secrets: &AiSecrets,
    encryption_enabled: bool,
    dek: Option<&[u8; DEK_LEN]>,
) -> Result<(), String> {
    let to_save = AiSecrets {
        cloud_api_keys: secrets.cloud_api_keys.clone(),
        cloud_api_key: String::new(),
    };
    let json = serde_json::to_vec_pretty(&to_save).map_err(|e| e.to_string())?;

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
    use crate::crypto::generate_dek;
    use std::env;

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

    #[test]
    fn sealed_round_trip_migrates_plaintext() {
        let dir = env::temp_dir().join(format!("lizhi-ai-sec-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        let mut secrets = AiSecrets::default();
        secrets
            .cloud_api_keys
            .insert("p1".into(), "sk-test".into());
        save_secrets(&dir, &secrets, false, None).unwrap();
        assert!(secrets_path(&dir).is_file());

        let dek = generate_dek();
        let loaded = load_secrets(&dir, true, Some(&dek)).unwrap();
        assert_eq!(loaded.cloud_api_keys.get("p1").unwrap(), "sk-test");
        assert!(secrets_enc_path(&dir).is_file());
        assert!(!secrets_path(&dir).is_file());

        let _ = fs::remove_dir_all(dir);
    }
}
