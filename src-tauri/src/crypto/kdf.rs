use argon2::{Algorithm, Argon2, Params, Version};
use rand::RngCore;

use super::{CryptoError, KEY_LEN, SALT_LEN};

/// Argon2id m=65536 KiB (64 MB), t=3, p=4 — matches complete-design §4.5
pub const KDF_M_COST: u32 = 65536;
pub const KDF_T_COST: u32 = 3;
pub const KDF_P_COST: u32 = 4;

pub fn generate_salt() -> [u8; SALT_LEN] {
    let mut salt = [0u8; SALT_LEN];
    rand::thread_rng().fill_bytes(&mut salt);
    salt
}

pub fn derive_key(password: &[u8], salt: &[u8; SALT_LEN]) -> Result<[u8; KEY_LEN], CryptoError> {
    let params =
        Params::new(KDF_M_COST, KDF_T_COST, KDF_P_COST, Some(KEY_LEN)).map_err(|_| CryptoError::KdfFailed)?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    let mut key = [0u8; KEY_LEN];
    argon2
        .hash_password_into(password, salt, &mut key)
        .map_err(|_| CryptoError::KdfFailed)?;
    Ok(key)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derive_key_is_deterministic() {
        let salt = [7u8; SALT_LEN];
        let a = derive_key(b"test-password", &salt).unwrap();
        let b = derive_key(b"test-password", &salt).unwrap();
        assert_eq!(a, b);
    }

    #[test]
    fn derive_key_differs_for_different_passwords() {
        let salt = [7u8; SALT_LEN];
        let a = derive_key(b"password-a", &salt).unwrap();
        let b = derive_key(b"password-b", &salt).unwrap();
        assert_ne!(a, b);
    }
}
