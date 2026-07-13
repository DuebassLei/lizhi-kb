use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

use crate::crypto::{decrypt, encrypt, DEK_LEN, NONCE_LEN};
use crate::AppError;

fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RevisionMeta {
    pub id: String,
    pub created_at: i64,
    pub size_bytes: u64,
}

fn revisions_dir(data_dir: &Path, doc_id: &str) -> PathBuf {
    data_dir.join("revisions").join(doc_id)
}

fn validate_doc_id(doc_id: &str) -> Result<&str, AppError> {
    if doc_id.is_empty()
        || doc_id.contains("..")
        || doc_id.contains('/')
        || doc_id.contains('\\')
    {
        return Err(AppError::DocumentNotFound(doc_id.to_string()));
    }
    Ok(doc_id)
}

pub fn save_revision(
    data_dir: &Path,
    doc_id: &str,
    content: &str,
    encryption_enabled: bool,
    dek: Option<&[u8; DEK_LEN]>,
) -> Result<RevisionMeta, AppError> {
    let doc_id = validate_doc_id(doc_id)?;
    let dir = revisions_dir(data_dir, doc_id);
    fs::create_dir_all(&dir)?;
    let created_at = now_millis();
    let id = created_at.to_string();
    let path = if encryption_enabled {
        dir.join(format!("{id}.md.enc"))
    } else {
        dir.join(format!("{id}.md"))
    };

    if encryption_enabled {
        let dek = dek.ok_or(AppError::VaultLocked)?;
        let (nonce, ciphertext) = encrypt(dek, content.as_bytes()).map_err(AppError::Crypto)?;
        let mut payload = Vec::with_capacity(NONCE_LEN + ciphertext.len());
        payload.extend_from_slice(&nonce);
        payload.extend_from_slice(&ciphertext);
        fs::write(&path, payload)?;
    } else {
        fs::write(&path, content.as_bytes())?;
    }

    Ok(RevisionMeta {
        id,
        created_at,
        size_bytes: content.len() as u64,
    })
}

pub fn list_revisions(data_dir: &Path, doc_id: &str) -> Result<Vec<RevisionMeta>, AppError> {
    let doc_id = validate_doc_id(doc_id)?;
    let dir = revisions_dir(data_dir, doc_id);
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
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or_default();
        let id = name.strip_suffix(".md").unwrap_or(name);
        let created_at: i64 = id.parse().unwrap_or(0);
        if created_at == 0 {
            continue;
        }
        let size_bytes = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
        items.push(RevisionMeta {
            id: id.to_string(),
            created_at,
            size_bytes,
        });
    }
    items.sort_by_key(|b| std::cmp::Reverse(b.created_at));
    Ok(items)
}

pub fn read_revision(
    data_dir: &Path,
    doc_id: &str,
    revision_id: &str,
    encryption_enabled: bool,
    dek: Option<&[u8; DEK_LEN]>,
) -> Result<String, AppError> {
    let doc_id = validate_doc_id(doc_id)?;
    let dir = revisions_dir(data_dir, doc_id);
    let plain_path = dir.join(format!("{revision_id}.md"));
    let enc_path = dir.join(format!("{revision_id}.md.enc"));

    if encryption_enabled {
        let dek = dek.ok_or(AppError::VaultLocked)?;
        let data = fs::read(&enc_path).map_err(|_| AppError::DocumentNotFound(revision_id.to_string()))?;
        if data.len() < NONCE_LEN {
            return Err(AppError::DocumentNotFound(revision_id.to_string()));
        }
        let mut nonce = [0u8; NONCE_LEN];
        nonce.copy_from_slice(&data[..NONCE_LEN]);
        let plaintext = decrypt(dek, &nonce, &data[NONCE_LEN..]).map_err(AppError::Crypto)?;
        String::from_utf8(plaintext)
            .map_err(|_| AppError::DocumentNotFound(revision_id.to_string()))
    } else {
        fs::read_to_string(&plain_path)
            .map_err(|_| AppError::DocumentNotFound(revision_id.to_string()))
    }
}
