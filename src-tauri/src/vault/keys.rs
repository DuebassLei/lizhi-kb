use std::fs;
use std::path::Path;

use zeroize::Zeroizing;

use crate::crypto::{decrypt, encrypt, DEK_LEN, NONCE_LEN, SALT_LEN};

use super::VaultError;

const MAGIC: &[u8; 4] = b"LZKY";
const FORMAT_VERSION: u8 = 1;
const FLAG_ENCRYPTION_ENABLED: u8 = 0x01;

/// On-disk `keys.enc` payload (password-wrapped or raw DEK).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct KeysFile {
    pub encryption_enabled: bool,
    pub salt: [u8; SALT_LEN],
    pub nonce: [u8; NONCE_LEN],
    /// Encrypted DEK (with GCM tag) when `encryption_enabled`, else raw 32-byte DEK.
    pub payload: Vec<u8>,
}

impl KeysFile {
    pub fn wrap_dek(dek: &[u8; DEK_LEN], password: &[u8]) -> Result<Self, VaultError> {
        let salt = crate::crypto::generate_salt();
        let kek = Zeroizing::new(crate::crypto::derive_key(password, &salt)?);
        let (nonce, ciphertext) = encrypt(&kek, dek)?;

        Ok(Self {
            encryption_enabled: true,
            salt,
            nonce,
            payload: ciphertext,
        })
    }

    pub fn store_raw_dek(dek: &[u8; DEK_LEN]) -> Self {
        Self {
            encryption_enabled: false,
            salt: [0u8; SALT_LEN],
            nonce: [0u8; NONCE_LEN],
            payload: dek.to_vec(),
        }
    }

    pub fn unwrap_dek(&self, password: &[u8]) -> Result<[u8; DEK_LEN], VaultError> {
        let dek_bytes = if self.encryption_enabled {
            let kek = Zeroizing::new(crate::crypto::derive_key(password, &self.salt)?);
            decrypt(&kek, &self.nonce, &self.payload)?
        } else {
            if self.payload.len() != DEK_LEN {
                return Err(VaultError::InvalidData);
            }
            self.payload.clone()
        };

        if dek_bytes.len() != DEK_LEN {
            return Err(VaultError::InvalidData);
        }

        let mut dek = [0u8; DEK_LEN];
        dek.copy_from_slice(&dek_bytes);
        Ok(dek)
    }

    fn to_bytes(&self) -> Vec<u8> {
        let mut buf = Vec::with_capacity(98);
        buf.extend_from_slice(MAGIC);
        buf.push(FORMAT_VERSION);
        buf.push(if self.encryption_enabled {
            FLAG_ENCRYPTION_ENABLED
        } else {
            0
        });
        buf.extend_from_slice(&self.salt);
        buf.extend_from_slice(&self.nonce);
        buf.extend_from_slice(&self.payload);
        buf
    }

    fn from_bytes(data: &[u8]) -> Result<Self, VaultError> {
        if data.len() < 4 + 1 + 1 + SALT_LEN + NONCE_LEN {
            return Err(VaultError::InvalidData);
        }
        if &data[0..4] != MAGIC {
            return Err(VaultError::InvalidData);
        }
        if data[4] != FORMAT_VERSION {
            return Err(VaultError::InvalidData);
        }

        let flags = data[5];
        let encryption_enabled = flags & FLAG_ENCRYPTION_ENABLED != 0;
        let mut salt = [0u8; SALT_LEN];
        salt.copy_from_slice(&data[6..6 + SALT_LEN]);
        let mut nonce = [0u8; NONCE_LEN];
        nonce.copy_from_slice(&data[6 + SALT_LEN..6 + SALT_LEN + NONCE_LEN]);
        let payload = data[6 + SALT_LEN + NONCE_LEN..].to_vec();

        if encryption_enabled {
            // 32-byte DEK + 16-byte GCM tag
            if payload.len() != DEK_LEN + 16 {
                return Err(VaultError::InvalidData);
            }
        } else if payload.len() != DEK_LEN {
            return Err(VaultError::InvalidData);
        }

        Ok(Self {
            encryption_enabled,
            salt,
            nonce,
            payload,
        })
    }
}

pub fn write_keys(path: &Path, keys: &KeysFile) -> Result<(), VaultError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, keys.to_bytes())?;
    Ok(())
}

pub fn read_keys(path: &Path) -> Result<KeysFile, VaultError> {
    let data = fs::read(path)?;
    KeysFile::from_bytes(&data)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::generate_dek;

    #[test]
    fn encrypted_keys_round_trip() {
        let dek = generate_dek();
        let keys = KeysFile::wrap_dek(&dek, b"correct-password").unwrap();
        let recovered = keys.unwrap_dek(b"correct-password").unwrap();
        assert_eq!(recovered, dek);
    }

    #[test]
    fn wrong_password_fails_unwrap() {
        let dek = generate_dek();
        let keys = KeysFile::wrap_dek(&dek, b"correct-password").unwrap();
        let result = keys.unwrap_dek(b"wrong-password");
        assert!(matches!(result, Err(VaultError::Crypto(_))));
    }

    #[test]
    fn raw_dek_round_trip() {
        let dek = generate_dek();
        let keys = KeysFile::store_raw_dek(&dek);
        let recovered = keys.unwrap_dek(b"").unwrap();
        assert_eq!(recovered, dek);
    }

    #[test]
    fn serialize_deserialize_round_trip() {
        let dek = generate_dek();
        let keys = KeysFile::wrap_dek(&dek, b"password").unwrap();
        let bytes = keys.to_bytes();
        let parsed = KeysFile::from_bytes(&bytes).unwrap();
        assert_eq!(parsed, keys);
        assert_eq!(parsed.unwrap_dek(b"password").unwrap(), dek);
    }
}
