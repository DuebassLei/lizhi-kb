mod cipher;
mod kdf;
mod sealed_file;

/// AES-256 key length (32 bytes).
pub const KEY_LEN: usize = 32;
/// Argon2 salt length per complete-design (32 bytes).
pub const SALT_LEN: usize = 32;

pub use cipher::{decrypt, encrypt, generate_dek, DEK_LEN, NONCE_LEN};
pub use kdf::{derive_key, generate_salt};
pub use sealed_file::{read_sealed, write_sealed};

use thiserror::Error;

#[derive(Debug, Error)]
pub enum CryptoError {
    #[error("encryption failed")]
    EncryptFailed,
    #[error("decryption failed")]
    DecryptFailed,
    #[error("invalid key length")]
    InvalidKeyLength,
    #[error("kdf failed")]
    KdfFailed,
}
