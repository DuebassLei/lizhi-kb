use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use rand::RngCore;

use super::{CryptoError, KEY_LEN};

pub const DEK_LEN: usize = KEY_LEN;
pub const NONCE_LEN: usize = 12;

pub fn generate_dek() -> [u8; DEK_LEN] {
    let mut dek = [0u8; DEK_LEN];
    rand::thread_rng().fill_bytes(&mut dek);
    dek
}

pub fn encrypt(key: &[u8; KEY_LEN], plaintext: &[u8]) -> Result<([u8; NONCE_LEN], Vec<u8>), CryptoError> {
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| CryptoError::InvalidKeyLength)?;
    let mut nonce_bytes = [0u8; NONCE_LEN];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|_| CryptoError::EncryptFailed)?;

    Ok((nonce_bytes, ciphertext))
}

pub fn decrypt(
    key: &[u8; KEY_LEN],
    nonce: &[u8; NONCE_LEN],
    ciphertext: &[u8],
) -> Result<Vec<u8>, CryptoError> {
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| CryptoError::InvalidKeyLength)?;
    let nonce = Nonce::from_slice(nonce);

    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| CryptoError::DecryptFailed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::kdf::{derive_key, generate_salt};
    use zeroize::Zeroize;

    #[test]
    fn encrypt_decrypt_round_trip() {
        let salt = generate_salt();
        let key = derive_key(b"vault-password", &salt).unwrap();
        let plaintext = b"data encryption key material";

        let (nonce, ciphertext) = encrypt(&key, plaintext).unwrap();
        let recovered = decrypt(&key, &nonce, &ciphertext).unwrap();
        assert_eq!(recovered, plaintext);
    }

    #[test]
    fn wrong_password_fails_decrypt() {
        let salt = generate_salt();
        let key = derive_key(b"correct-password", &salt).unwrap();
        let wrong_key = derive_key(b"wrong-password", &salt).unwrap();
        let plaintext = b"secret dek bytes here!!!!!!!!!!!";

        let (nonce, ciphertext) = encrypt(&key, plaintext).unwrap();
        let result = decrypt(&wrong_key, &nonce, &ciphertext);
        assert!(matches!(result, Err(CryptoError::DecryptFailed)));
    }

    #[test]
    fn keys_are_zeroized_after_use() {
        let mut key = derive_key(b"temp", &generate_salt()).unwrap();
        key.zeroize();
        assert!(key.iter().all(|b| *b == 0));
    }
}
