use std::fs;
use std::path::{Path, PathBuf};

use bip39::{Language, Mnemonic};
use chrono::Utc;
use hex::{FromHex, ToHex};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::assets;
use crate::crypto::{derive_key, generate_dek, generate_salt, SALT_LEN};
use crate::db;
use crate::documents::DocumentService;

use super::keys::{read_keys, write_keys, KeysFile};
use super::session::VaultSession;
use super::{keys_path, meta_path, VaultError, SCHEMA_VERSION};

/// Persisted vault metadata — fields align with future `.lizhi` manifest.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultMeta {
    pub vault_id: String,
    pub schema_version: u32,
    pub encryption_enabled: bool,
    /// When `None`, legacy vaults default to `encryption_enabled` (backward compatible).
    #[serde(default)]
    pub lock_on_startup: Option<bool>,
    /// Argon2id salt (hex) for backup password verification when keys are not password-wrapped.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password_salt_hex: Option<String>,
    /// Argon2id derived key (hex) for backup password verification.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password_hash_hex: Option<String>,
    pub created_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hint: Option<String>,
}

impl VaultMeta {
    /// Whether the app should stay locked on startup until the user enters the master password.
    pub fn lock_on_startup(&self) -> bool {
        self.lock_on_startup.unwrap_or(self.encryption_enabled)
    }
}

fn store_password_verifier(meta: &mut VaultMeta, password: &[u8]) -> Result<(), VaultError> {
    let salt = generate_salt();
    let hash = derive_key(password, &salt)?;
    meta.password_salt_hex = Some(salt.encode_hex());
    meta.password_hash_hex = Some(hash.encode_hex());
    Ok(())
}

fn clear_password_verifier(meta: &mut VaultMeta) {
    meta.password_salt_hex = None;
    meta.password_hash_hex = None;
}

pub(crate) fn verify_password_verifier(meta: &VaultMeta, password: &[u8]) -> Result<(), VaultError> {
    let salt_hex = meta
        .password_salt_hex
        .as_ref()
        .ok_or(VaultError::UnlockFailed)?;
    let hash_hex = meta
        .password_hash_hex
        .as_ref()
        .ok_or(VaultError::UnlockFailed)?;
    let salt_bytes = Vec::from_hex(salt_hex).map_err(|_| VaultError::InvalidData)?;
    if salt_bytes.len() != SALT_LEN {
        return Err(VaultError::InvalidData);
    }
    let mut salt = [0u8; SALT_LEN];
    salt.copy_from_slice(&salt_bytes);
    let expected = Vec::from_hex(hash_hex).map_err(|_| VaultError::InvalidData)?;
    let actual = derive_key(password, &salt)?;
    if actual.as_slice() != expected.as_slice() {
        return Err(VaultError::UnlockFailed);
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultStatus {
    pub exists: bool,
    pub is_locked: bool,
    pub encryption_enabled: bool,
    pub lock_on_startup: bool,
    pub vault_id: Option<String>,
    pub schema_version: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateVaultResult {
    pub meta: VaultMeta,
    /// BIP39 24-word recovery phrase encoding the DEK (shown once at creation).
    pub recovery_phrase: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnableEncryptionResult {
    pub meta: VaultMeta,
    pub recovery_phrase: String,
}

pub struct VaultService {
    data_dir: PathBuf,
    session: VaultSession,
}

impl VaultService {
    pub fn new(data_dir: PathBuf) -> Self {
        Self {
            data_dir,
            session: VaultSession::default(),
        }
    }

    pub fn data_dir(&self) -> &Path {
        &self.data_dir
    }

    pub fn session(&self) -> &VaultSession {
        &self.session
    }

    pub fn session_dek(&self) -> Option<[u8; 32]> {
        self.session.dek().copied()
    }

    pub fn is_vault_initialized(&self) -> bool {
        meta_path(&self.data_dir).is_file()
    }

    pub fn load_meta(&self) -> Result<VaultMeta, VaultError> {
        let path = meta_path(&self.data_dir);
        if !path.is_file() {
            return Err(VaultError::NotFound);
        }
        let content = fs::read_to_string(&path)?;
        Ok(serde_json::from_str(&content)?)
    }

    pub fn get_status(&self) -> VaultStatus {
        match self.load_meta() {
            Ok(meta) => VaultStatus {
                exists: true,
                is_locked: self.session.is_locked(),
                encryption_enabled: meta.encryption_enabled,
                lock_on_startup: meta.lock_on_startup(),
                vault_id: Some(meta.vault_id),
                schema_version: Some(meta.schema_version),
            },
            Err(VaultError::NotFound) => VaultStatus {
                exists: false,
                is_locked: true,
                encryption_enabled: false,
                lock_on_startup: false,
                vault_id: None,
                schema_version: None,
            },
            Err(_) => VaultStatus {
                exists: false,
                is_locked: true,
                encryption_enabled: false,
                lock_on_startup: false,
                vault_id: None,
                schema_version: None,
            },
        }
    }

    pub fn create_vault(
        &mut self,
        password: String,
        hint: Option<String>,
        lock_on_startup: Option<bool>,
    ) -> Result<CreateVaultResult, VaultError> {
        if self.is_vault_initialized() {
            return Err(VaultError::AlreadyExists);
        }

        fs::create_dir_all(&self.data_dir)?;
        fs::create_dir_all(db::workspace_dir(&self.data_dir))?;
        fs::create_dir_all(assets::assets_dir(&self.data_dir))?;

        let dek = generate_dek();
        let encryption_enabled = !password.is_empty();
        let lock = lock_on_startup.unwrap_or(false);

        let mut meta = VaultMeta {
            vault_id: Uuid::new_v4().to_string(),
            schema_version: SCHEMA_VERSION,
            encryption_enabled,
            lock_on_startup: Some(lock),
            password_salt_hex: None,
            password_hash_hex: None,
            created_at: Utc::now().timestamp(),
            hint,
        };

        let keys = if encryption_enabled {
            if lock {
                KeysFile::wrap_dek(&dek, password.as_bytes())?
            } else {
                store_password_verifier(&mut meta, password.as_bytes())?;
                KeysFile::store_raw_dek(&dek)
            }
        } else {
            KeysFile::store_raw_dek(&dek)
        };

        write_keys(&keys_path(&self.data_dir), &keys)?;

        let meta_json = serde_json::to_string_pretty(&meta)?;
        fs::write(meta_path(&self.data_dir), meta_json)?;

        let recovery_phrase = dek_to_mnemonic(&dek)?;

        self.session.unlock(dek);
        if encryption_enabled && lock {
            self.session.lock();
        }

        Ok(CreateVaultResult {
            meta,
            recovery_phrase,
        })
    }

    pub fn unlock_vault(&mut self, password: String) -> Result<VaultStatus, VaultError> {
        let meta = self.load_meta()?;
        let keys = read_keys(&keys_path(&self.data_dir))?;

        let dek = keys.unwrap_dek(password.as_bytes()).map_err(|e| match e {
            VaultError::Crypto(_) => VaultError::UnlockFailed,
            other => other,
        })?;

        self.session.unlock(dek);
        Ok(self.build_status(&meta))
    }

    pub fn lock_vault(&mut self) {
        self.session.lock();
    }

    pub fn enable_encryption(
        &mut self,
        password: String,
        lock_on_startup: Option<bool>,
        document_service: &mut DocumentService,
    ) -> Result<EnableEncryptionResult, VaultError> {
        if password.is_empty() {
            return Err(VaultError::InvalidData);
        }

        let mut meta = self.load_meta()?;
        if meta.encryption_enabled {
            return Err(VaultError::AlreadyExists);
        }

        let lock = lock_on_startup.unwrap_or(false);

        let dek = self
            .session
            .dek()
            .copied()
            .ok_or(VaultError::Locked)?;

        document_service.migrate_to_encrypted(&dek)?;
        assets::encrypt_all_assets(&self.data_dir, &dek)?;
        // Migrate plaintext AI/CC secrets into DEK-sealed files.
        if let Ok(ai) = crate::ai::load_secrets(&self.data_dir, false, None) {
            let _ = crate::ai::save_secrets(&self.data_dir, &ai, true, Some(&dek));
        }
        if let Ok(cc) = crate::cc_workbench::load_secrets(&self.data_dir, false, None) {
            let _ = crate::cc_workbench::save_secrets(&self.data_dir, &cc, true, Some(&dek));
        }

        let keys = if lock {
            KeysFile::wrap_dek(&dek, password.as_bytes())?
        } else {
            store_password_verifier(&mut meta, password.as_bytes())?;
            KeysFile::store_raw_dek(&dek)
        };
        write_keys(&keys_path(&self.data_dir), &keys)?;

        meta.encryption_enabled = true;
        meta.lock_on_startup = Some(lock);
        let meta_json = serde_json::to_string_pretty(&meta)?;
        fs::write(meta_path(&self.data_dir), meta_json)?;

        let recovery_phrase = dek_to_mnemonic(&dek)?;

        if lock {
            self.session.lock();
        }

        Ok(EnableEncryptionResult {
            meta,
            recovery_phrase,
        })
    }

    pub fn verify_master_password(&self, password: &str) -> Result<(), VaultError> {
        let meta = self.load_meta()?;
        if !meta.encryption_enabled {
            return Ok(());
        }
        let keys = read_keys(&keys_path(&self.data_dir))?;
        if keys.encryption_enabled {
            keys.unwrap_dek(password.as_bytes()).map(|_| ())
        } else {
            verify_password_verifier(&meta, password.as_bytes())
        }
    }

    pub fn set_lock_on_startup(
        &mut self,
        enabled: bool,
        password: String,
        _document_service: &mut DocumentService,
    ) -> Result<VaultStatus, VaultError> {
        if password.is_empty() {
            return Err(VaultError::InvalidData);
        }

        let mut meta = self.load_meta()?;
        if !meta.encryption_enabled {
            return Err(VaultError::InvalidData);
        }

        if enabled == meta.lock_on_startup() {
            return Ok(self.build_status(&meta));
        }

        let keys = read_keys(&keys_path(&self.data_dir))?;
        let dek = if keys.encryption_enabled {
            keys.unwrap_dek(password.as_bytes()).map_err(|e| match e {
                VaultError::Crypto(_) => VaultError::UnlockFailed,
                other => other,
            })?
        } else {
            verify_password_verifier(&meta, password.as_bytes())?;
            keys.unwrap_dek(b"")?
        };

        if enabled {
            let wrapped = KeysFile::wrap_dek(&dek, password.as_bytes())?;
            write_keys(&keys_path(&self.data_dir), &wrapped)?;
            clear_password_verifier(&mut meta);
            meta.lock_on_startup = Some(true);
            self.session.unlock(dek);
            self.session.lock();
        } else {
            store_password_verifier(&mut meta, password.as_bytes())?;
            let raw = KeysFile::store_raw_dek(&dek);
            write_keys(&keys_path(&self.data_dir), &raw)?;
            meta.lock_on_startup = Some(false);
            self.session.unlock(dek);
        }

        let meta_json = serde_json::to_string_pretty(&meta)?;
        fs::write(meta_path(&self.data_dir), meta_json)?;

        Ok(self.build_status(&meta))
    }

    pub fn try_auto_unlock(&mut self) -> Result<VaultStatus, VaultError> {
        if !self.is_vault_initialized() {
            return Err(VaultError::NotFound);
        }
        let meta = self.load_meta()?;
        if meta.encryption_enabled && meta.lock_on_startup() {
            return Ok(self.build_status(&meta));
        }
        self.unlock_vault(String::new())
    }

    /// Unlock encrypted vault using BIP39 recovery phrase (DEK).
    pub fn unlock_with_recovery_phrase(&mut self, phrase: &str) -> Result<VaultStatus, VaultError> {
        let meta = self.load_meta()?;
        if !meta.encryption_enabled {
            return Err(VaultError::InvalidData);
        }
        let dek = mnemonic_to_dek(phrase)?;
        self.verify_dek(&dek)?;
        self.session.unlock(dek);
        Ok(self.build_status(&meta))
    }

    /// Re-wrap DEK with a new password after verifying recovery phrase.
    pub fn reset_password_with_recovery(
        &mut self,
        phrase: &str,
        new_password: String,
    ) -> Result<VaultStatus, VaultError> {
        if new_password.is_empty() {
            return Err(VaultError::InvalidData);
        }
        let meta = self.load_meta()?;
        let dek = mnemonic_to_dek(phrase)?;
        self.verify_dek(&dek)?;
        let keys = KeysFile::wrap_dek(&dek, new_password.as_bytes())?;
        write_keys(&keys_path(&self.data_dir), &keys)?;
        self.session.unlock(dek);
        Ok(self.build_status(&meta))
    }

    fn verify_dek(&self, dek: &[u8; 32]) -> Result<(), VaultError> {
        let meta = self.load_meta()?;
        if meta.encryption_enabled {
            crate::db::open_vault_connection(&self.data_dir, dek).map_err(|_| VaultError::UnlockFailed)?;
        } else {
            let keys = read_keys(&keys_path(&self.data_dir))?;
            let stored = keys.unwrap_dek(b"")?;
            if stored != *dek {
                return Err(VaultError::UnlockFailed);
            }
        }
        Ok(())
    }

    fn build_status(&self, meta: &VaultMeta) -> VaultStatus {
        VaultStatus {
            exists: true,
            is_locked: self.session.is_locked(),
            encryption_enabled: meta.encryption_enabled,
            lock_on_startup: meta.lock_on_startup(),
            vault_id: Some(meta.vault_id.clone()),
            schema_version: Some(meta.schema_version),
        }
    }
}

fn dek_to_mnemonic(dek: &[u8; 32]) -> Result<String, VaultError> {
    let mnemonic = Mnemonic::from_entropy(dek).map_err(|_| VaultError::InvalidData)?;
    Ok(mnemonic.to_string())
}

pub fn mnemonic_to_dek(phrase: &str) -> Result<[u8; 32], VaultError> {
    let mnemonic =
        Mnemonic::parse_in(Language::English, phrase).map_err(|_| VaultError::InvalidData)?;
    let entropy = mnemonic.to_entropy();
    if entropy.len() != 32 {
        return Err(VaultError::InvalidData);
    }
    let mut dek = [0u8; 32];
    dek.copy_from_slice(&entropy);
    Ok(dek)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    fn temp_data_dir() -> PathBuf {
        let dir = env::temp_dir().join(format!("lizhi-kb-vault-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn create_and_unlock_encrypted_vault() {
        let dir = temp_data_dir();
        let mut svc = VaultService::new(dir.clone());

        let result = svc
            .create_vault("strong-password".into(), Some("hint".into()), Some(true))
            .unwrap();
        assert!(result.meta.encryption_enabled);
        assert_eq!(result.recovery_phrase.split_whitespace().count(), 24);

        svc.lock_vault();
        assert!(svc.session().is_locked());

        let status = svc.unlock_vault("strong-password".into()).unwrap();
        assert!(!status.is_locked);
        assert!(status.encryption_enabled);

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn wrong_password_fails_unlock() {
        let dir = temp_data_dir();
        let mut svc = VaultService::new(dir.clone());

        svc.create_vault("correct".into(), None, Some(true)).unwrap();
        svc.lock_vault();

        let result = svc.unlock_vault("incorrect".into());
        assert!(matches!(result, Err(VaultError::UnlockFailed)));

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn no_password_vault_unlocks_with_empty_password() {
        let dir = temp_data_dir();
        let mut svc = VaultService::new(dir.clone());

        let result = svc.create_vault(String::new(), None, None).unwrap();
        assert!(!result.meta.encryption_enabled);

        svc.lock_vault();
        let status = svc.unlock_vault(String::new()).unwrap();
        assert!(!status.is_locked);

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn get_status_before_create() {
        let dir = temp_data_dir();
        let svc = VaultService::new(dir.clone());
        let status = svc.get_status();
        assert!(!status.exists);
        assert!(status.is_locked);

        let _ = fs::remove_dir_all(dir);
    }
}
