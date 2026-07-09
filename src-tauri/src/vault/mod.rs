mod keys;
mod service;
mod session;

pub use keys::read_keys;
pub use service::{
    mnemonic_to_dek, CreateVaultResult, EnableEncryptionResult, VaultMeta, VaultService, VaultStatus,
};
pub(crate) use service::verify_password_verifier;

use std::path::{Path, PathBuf};

pub const META_FILENAME: &str = "vault.meta.json";
pub const KEYS_FILENAME: &str = "keys.enc";
pub const SCHEMA_VERSION: u32 = 1;

pub fn meta_path(data_dir: &Path) -> PathBuf {
    data_dir.join(META_FILENAME)
}

pub fn keys_path(data_dir: &Path) -> PathBuf {
    data_dir.join(KEYS_FILENAME)
}

use thiserror::Error;

#[derive(Debug, Error)]
pub enum VaultError {
    #[error("vault already exists")]
    AlreadyExists,
    #[error("vault not found")]
    NotFound,
    #[error("vault is locked")]
    Locked,
    #[error("unlock failed")]
    UnlockFailed,
    #[error("invalid vault data")]
    InvalidData,
    #[error(transparent)]
    Crypto(#[from] crate::crypto::CryptoError),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error(transparent)]
    Sqlite(#[from] rusqlite::Error),
    #[error(transparent)]
    Archive(#[from] zip::result::ZipError),
}
