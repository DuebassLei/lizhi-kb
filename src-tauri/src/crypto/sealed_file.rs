use std::fs;
use std::path::Path;

use super::{decrypt, encrypt, CryptoError, DEK_LEN, NONCE_LEN};

/// Write `nonce || ciphertext` for AES-256-GCM sealed payload.
pub fn write_sealed(path: &Path, dek: &[u8; DEK_LEN], plaintext: &[u8]) -> Result<(), CryptoError> {
    let (nonce, ciphertext) = encrypt(dek, plaintext)?;
    let mut payload = Vec::with_capacity(NONCE_LEN + ciphertext.len());
    payload.extend_from_slice(&nonce);
    payload.extend_from_slice(&ciphertext);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|_| CryptoError::EncryptFailed)?;
    }
    fs::write(path, payload).map_err(|_| CryptoError::EncryptFailed)?;
    Ok(())
}

pub fn read_sealed(path: &Path, dek: &[u8; DEK_LEN]) -> Result<Vec<u8>, CryptoError> {
    let data = fs::read(path).map_err(|_| CryptoError::DecryptFailed)?;
    if data.len() < NONCE_LEN {
        return Err(CryptoError::DecryptFailed);
    }
    let mut nonce = [0u8; NONCE_LEN];
    nonce.copy_from_slice(&data[..NONCE_LEN]);
    decrypt(dek, &nonce, &data[NONCE_LEN..])
}
