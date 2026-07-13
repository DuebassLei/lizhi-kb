use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::crypto::{decrypt, encrypt, DEK_LEN, NONCE_LEN};
use crate::vault::VaultError;
use crate::AppError;

pub fn assets_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("assets")
}

pub fn asset_cache_dir(data_dir: &Path) -> PathBuf {
    data_dir.join(".asset-cache")
}

fn validate_asset_id(id: &str) -> Result<&str, AppError> {
    if id.is_empty()
        || id.contains("..")
        || id.contains('/')
        || id.contains('\\')
        || !id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.')
    {
        return Err(AppError::InvalidAssetId(id.to_string()));
    }
    Ok(id)
}

fn validate_extension(ext: &str) -> Result<&str, AppError> {
    let ext = ext.trim_start_matches('.');
    if ext.is_empty()
        || ext.len() > 8
        || !ext.chars().all(|c| c.is_ascii_alphanumeric())
    {
        return Err(AppError::InvalidAssetId(ext.to_string()));
    }
    Ok(ext)
}

fn encrypted_asset_path(dir: &Path, id: &str) -> PathBuf {
    dir.join(format!("{id}.enc"))
}

fn write_encrypted_bytes(path: &Path, dek: &[u8; DEK_LEN], plaintext: &[u8]) -> Result<(), AppError> {
    let (nonce, ciphertext) = encrypt(dek, plaintext).map_err(AppError::Crypto)?;
    let mut payload = Vec::with_capacity(NONCE_LEN + ciphertext.len());
    payload.extend_from_slice(&nonce);
    payload.extend_from_slice(&ciphertext);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, payload)?;
    Ok(())
}

fn read_encrypted_bytes(path: &Path, dek: &[u8; DEK_LEN]) -> Result<Vec<u8>, AppError> {
    let data = fs::read(path)?;
    if data.len() < NONCE_LEN {
        return Err(AppError::InvalidAssetId("corrupt asset".into()));
    }
    let mut nonce = [0u8; NONCE_LEN];
    nonce.copy_from_slice(&data[..NONCE_LEN]);
    decrypt(dek, &nonce, &data[NONCE_LEN..]).map_err(AppError::Crypto)
}

pub fn save_asset(
    data_dir: &Path,
    bytes: Vec<u8>,
    extension: &str,
    encryption_enabled: bool,
    dek: Option<&[u8; DEK_LEN]>,
) -> Result<String, AppError> {
    let ext = validate_extension(extension)?;
    let dir = assets_dir(data_dir);
    fs::create_dir_all(&dir)?;
    let id = format!("{}.{}", uuid::Uuid::new_v4(), ext);

    if encryption_enabled {
        let dek = dek.ok_or(AppError::VaultLocked)?;
        let path = encrypted_asset_path(&dir, &id);
        write_encrypted_bytes(&path, dek, &bytes)?;
    } else {
        let path = dir.join(&id);
        if !path.starts_with(&dir) {
            return Err(AppError::InvalidAssetId(id));
        }
        fs::write(path, bytes)?;
    }
    Ok(id)
}

pub fn get_asset_path(
    data_dir: &Path,
    id: &str,
    encryption_enabled: bool,
    dek: Option<&[u8; DEK_LEN]>,
) -> Result<PathBuf, AppError> {
    let id = validate_asset_id(id)?;
    let dir = assets_dir(data_dir);

    if encryption_enabled {
        let dek = dek.ok_or(AppError::VaultLocked)?;
        let enc_path = encrypted_asset_path(&dir, id);
        if !enc_path.is_file() {
            return Err(AppError::AssetNotFound(id.to_string()));
        }
        let plaintext = read_encrypted_bytes(&enc_path, dek)?;
        let cache_dir = asset_cache_dir(data_dir);
        fs::create_dir_all(&cache_dir)?;
        let cached = cache_dir.join(id);
        fs::write(&cached, plaintext)?;
        return Ok(cached);
    }

    let path = dir.join(id);
    if !path.starts_with(&dir) {
        return Err(AppError::InvalidAssetId(id.to_string()));
    }
    if !path.is_file() {
        return Err(AppError::AssetNotFound(id.to_string()));
    }
    Ok(path)
}

pub fn mime_for_asset_id(id: &str) -> &'static str {
    let ext = id.rsplit('.').next().unwrap_or("").to_lowercase();
    match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "pdf" => "application/pdf",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        _ => "application/octet-stream",
    }
}

pub fn read_asset_bytes(
    data_dir: &Path,
    id: &str,
    encryption_enabled: bool,
    dek: Option<&[u8; DEK_LEN]>,
) -> Result<Vec<u8>, AppError> {
    let id = validate_asset_id(id)?;
    let dir = assets_dir(data_dir);

    if encryption_enabled {
        let dek = dek.ok_or(AppError::VaultLocked)?;
        let enc_path = encrypted_asset_path(&dir, id);
        if !enc_path.is_file() {
            return Err(AppError::AssetNotFound(id.to_string()));
        }
        read_encrypted_bytes(&enc_path, dek)
    } else {
        let path = dir.join(id);
        if !path.starts_with(&dir) {
            return Err(AppError::InvalidAssetId(id.to_string()));
        }
        if !path.is_file() {
            return Err(AppError::AssetNotFound(id.to_string()));
        }
        Ok(fs::read(path)?)
    }
}

pub fn encrypt_all_assets(data_dir: &Path, dek: &[u8; DEK_LEN]) -> Result<(), VaultError> {
    let dir = assets_dir(data_dir);
    if !dir.is_dir() {
        return Ok(());
    }
    for entry in fs::read_dir(&dir)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or_default();
        if name.ends_with(".enc") {
            continue;
        }
        let bytes = fs::read(&path)?;
        let enc_path = encrypted_asset_path(&dir, name);
        write_encrypted_bytes(&enc_path, dek, &bytes).map_err(VaultError::from)?;
        fs::remove_file(path)?;
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetEntry {
    pub id: String,
    pub mime: String,
    pub size_bytes: u64,
    pub created_at: i64,
}

pub fn list_assets(data_dir: &Path, encryption_enabled: bool) -> Result<Vec<AssetEntry>, AppError> {
    let dir = assets_dir(data_dir);
    if !dir.is_dir() {
        return Ok(Vec::new());
    }
    let mut items = Vec::new();
    for entry in fs::read_dir(&dir)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or_default()
            .to_string();
        let id = if encryption_enabled && name.ends_with(".enc") {
            name.strip_suffix(".enc").unwrap_or(&name).to_string()
        } else if encryption_enabled {
            continue;
        } else {
            name.clone()
        };
        if validate_asset_id(&id).is_err() {
            continue;
        }
        let meta = fs::metadata(&path)?;
        items.push(AssetEntry {
            id: id.clone(),
            mime: mime_for_asset_id(&id).to_string(),
            size_bytes: meta.len(),
            created_at: meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as i64)
                .unwrap_or(0),
        });
    }
    items.sort_by_key(|b| std::cmp::Reverse(b.created_at));
    Ok(items)
}

pub fn delete_asset(
    data_dir: &Path,
    id: &str,
    encryption_enabled: bool,
) -> Result<(), AppError> {
    let id = validate_asset_id(id)?;
    let dir = assets_dir(data_dir);
    let path = if encryption_enabled {
        encrypted_asset_path(&dir, id)
    } else {
        dir.join(id)
    };
    if !path.starts_with(&dir) || !path.is_file() {
        return Err(AppError::AssetNotFound(id.to_string()));
    }
    fs::remove_file(path)?;
    let cache_path = asset_cache_dir(data_dir).join(id);
    if cache_path.is_file() {
        let _ = fs::remove_file(cache_path);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn save_and_read_asset_roundtrip() {
        let dir = std::env::temp_dir().join(format!("lizhi-asset-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        let png = b"\x89PNG\r\n\x1a\n";
        let id = save_asset(&dir, png.to_vec(), "png", false, None).unwrap();
        let bytes = read_asset_bytes(&dir, &id, false, None).unwrap();
        assert_eq!(bytes, png);
        assert_eq!(mime_for_asset_id(&id), "image/png");
        let _ = fs::remove_dir_all(dir);
    }
}
