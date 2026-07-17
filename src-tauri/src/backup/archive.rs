use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};
use zip::read::ZipArchive;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

use crate::db;
use crate::crypto::DEK_LEN;
use crate::prefs::{
    load_ui_state, merge_ui_state, save_ui_state, AI_CONFIG_FILENAME, AI_SECRETS_ENC_FILENAME,
    AI_SECRETS_FILENAME, CC_SECRETS_ENC_FILENAME, CC_SECRETS_FILENAME,
    CC_WORKBENCH_CONFIG_FILENAME, MCP_CONFIG_FILENAME, OPTIONAL_BACKUP_FILES, UI_STATE_FILENAME,
};
use crate::vault::{meta_path, mnemonic_to_dek, read_keys, verify_password_verifier, VaultError, VaultMeta, META_FILENAME, KEYS_FILENAME};

pub const BACKUP_FORMAT_VERSION: u32 = 2;

/// Reserved for backup file dialogs / filters (`.lizhi`).
#[allow(dead_code)]
pub const BACKUP_EXTENSION: &str = "lizhi";
pub const MANIFEST_FILENAME: &str = "manifest.json";

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupManifest {
    pub format_version: u32,
    pub vault_id: String,
    pub created_at: i64,
    pub encryption_enabled: bool,
    pub files: Vec<BackupFileEntry>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BackupFileEntry {
    pub path: String,
    pub sha256: String,
    pub size: u64,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupValidation {
    pub valid: bool,
    pub vault_id: Option<String>,
    pub encryption_enabled: bool,
    pub file_count: usize,
    pub error: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub success: bool,
    pub requires_restart: bool,
    pub vault_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub merged_documents: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub merged_assets: Option<u32>,
}

pub fn export_vault(
    data_dir: &Path,
    dest_path: &Path,
    password: Option<&str>,
) -> Result<PathBuf, VaultError> {
    let meta = read_meta(data_dir)?;
    if meta.encryption_enabled {
        let pwd = password.filter(|p| !p.is_empty()).ok_or(VaultError::Locked)?;
        let keys = read_keys(&data_dir.join(KEYS_FILENAME))?;
        if keys.encryption_enabled {
            keys.unwrap_dek(pwd.as_bytes()).map_err(|e| match e {
                VaultError::Crypto(_) => VaultError::UnlockFailed,
                other => other,
            })?;
        } else {
            verify_password_verifier(&meta, pwd.as_bytes())?;
        }
    }
    let mut files = Vec::new();

    collect_file(&mut files, data_dir, META_FILENAME)?;
    collect_file(&mut files, data_dir, KEYS_FILENAME)?;

    let db_name = if meta.encryption_enabled {
        "vault.db"
    } else {
        "lizhi-kb.db"
    };
    if data_dir.join(db_name).is_file() {
        collect_file(&mut files, data_dir, db_name)?;
    }

    collect_dir(&mut files, data_dir, "workspace")?;
    collect_dir(&mut files, data_dir, "assets")?;
    collect_dir(&mut files, data_dir, "revisions")?;
    collect_dir(&mut files, data_dir, crate::writing_styles::WRITING_STYLES_DIR)?;

    for name in OPTIONAL_BACKUP_FILES {
        collect_file_optional(&mut files, data_dir, name)?;
    }

    let manifest = BackupManifest {
        format_version: BACKUP_FORMAT_VERSION,
        vault_id: meta.vault_id.clone(),
        created_at: chrono::Utc::now().timestamp(),
        encryption_enabled: meta.encryption_enabled,
        files: files.clone(),
    };

    if let Some(parent) = dest_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let file = File::create(dest_path)?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    let manifest_json = serde_json::to_string_pretty(&manifest)?;
    zip.start_file(MANIFEST_FILENAME, options)?;
    zip.write_all(manifest_json.as_bytes())?;

    for entry in &files {
        let abs = data_dir.join(&entry.path);
        zip.start_file(&entry.path, options)?;
        let mut src = File::open(&abs)?;
        let mut buffer = Vec::new();
        src.read_to_end(&mut buffer)?;
        zip.write_all(&buffer)?;
    }

    zip.finish()?;
    Ok(dest_path.to_path_buf())
}

pub fn validate_vault_backup(path: &Path) -> BackupValidation {
    match validate_vault_backup_inner(path) {
        Ok((meta, manifest)) => {
            let encryption_enabled =
                manifest.encryption_enabled || meta.encryption_enabled;
            BackupValidation {
                valid: true,
                vault_id: Some(manifest.vault_id),
                encryption_enabled,
                file_count: manifest.files.len(),
                error: None,
            }
        }
        Err(e) => BackupValidation {
            valid: false,
            vault_id: None,
            encryption_enabled: false,
            file_count: 0,
            error: Some(e.to_string()),
        },
    }
}

fn validate_vault_backup_inner(path: &Path) -> Result<(VaultMeta, BackupManifest), VaultError> {
    let file = File::open(path)?;
    let mut archive = ZipArchive::new(file)?;

    let manifest: BackupManifest = {
        let mut manifest_file = archive.by_name(MANIFEST_FILENAME)?;
        let mut content = String::new();
        manifest_file.read_to_string(&mut content)?;
        serde_json::from_str(&content)?
    };

    for entry in &manifest.files {
        let mut zip_entry = archive.by_name(&entry.path)?;
        let mut hasher = Sha256::new();
        let mut buffer = [0u8; 8192];
        loop {
            let n = zip_entry.read(&mut buffer)?;
            if n == 0 {
                break;
            }
            hasher.update(&buffer[..n]);
        }
        let digest = hex::encode(hasher.finalize());
        if digest != entry.sha256 {
            return Err(VaultError::InvalidData);
        }
    }

    let meta = read_meta_from_zip(&mut archive)?;
    Ok((meta, manifest))
}

pub fn import_vault(
    data_dir: &Path,
    src_path: &Path,
    password: &str,
    recovery_phrase: Option<&str>,
    mode: &str,
    current_dek: Option<[u8; DEK_LEN]>,
) -> Result<ImportResult, VaultError> {
    match mode {
        "replace" => import_vault_replace(data_dir, src_path, password, recovery_phrase),
        "merge" => {
            import_vault_merge_settings(data_dir, src_path, password, recovery_phrase, current_dek)
        }
        "merge-documents" => import_vault_merge_documents(
            data_dir,
            src_path,
            password,
            recovery_phrase,
            current_dek,
        ),
        _ => Err(VaultError::InvalidData),
    }
}

fn read_manifest_and_extract(
    src_path: &Path,
    data_dir: &Path,
) -> Result<(BackupManifest, PathBuf), VaultError> {
    let file = File::open(src_path)?;
    let mut archive = ZipArchive::new(file)?;

    let manifest: BackupManifest = {
        let mut manifest_file = archive.by_name(MANIFEST_FILENAME)?;
        let mut content = String::new();
        manifest_file.read_to_string(&mut content)?;
        serde_json::from_str(&content)?
    };

    let staging = data_dir
        .parent()
        .ok_or(VaultError::InvalidData)?
        .join(format!(".lizhi-import-{}", uuid::Uuid::new_v4()));

    fs::create_dir_all(&staging)?;

    for entry in &manifest.files {
        let mut zip_entry = archive.by_name(&entry.path)?;
        let dest = staging.join(&entry.path);
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent)?;
        }
        let mut out = File::create(&dest)?;
        let mut hasher = Sha256::new();
        let mut buffer = [0u8; 8192];
        loop {
            let n = zip_entry.read(&mut buffer)?;
            if n == 0 {
                break;
            }
            hasher.update(&buffer[..n]);
            out.write_all(&buffer[..n])?;
        }
        let digest = hex::encode(hasher.finalize());
        if digest != entry.sha256 {
            let _ = fs::remove_dir_all(&staging);
            return Err(VaultError::InvalidData);
        }
    }

    Ok((manifest, staging))
}

fn import_vault_replace(
    data_dir: &Path,
    src_path: &Path,
    password: &str,
    recovery_phrase: Option<&str>,
) -> Result<ImportResult, VaultError> {
    let (manifest, staging) = read_manifest_and_extract(src_path, data_dir)?;

    let result = (|| -> Result<ImportResult, VaultError> {
        crate::vault::read_keys(&staging.join(KEYS_FILENAME))?;
        verify_import_access(&staging, password, recovery_phrase)?;
        atomic_replace(data_dir, &staging)?;
        Ok(ImportResult {
            success: true,
            requires_restart: true,
            vault_id: manifest.vault_id,
            merged_documents: None,
            merged_assets: None,
        })
    })();

    let _ = fs::remove_dir_all(&staging);
    result
}

fn import_vault_merge_settings(
    data_dir: &Path,
    src_path: &Path,
    password: &str,
    recovery_phrase: Option<&str>,
    current_dek: Option<[u8; DEK_LEN]>,
) -> Result<ImportResult, VaultError> {
    let (manifest, staging) = read_manifest_and_extract(src_path, data_dir)?;

    let result = (|| -> Result<ImportResult, VaultError> {
        if staging.join(KEYS_FILENAME).is_file() {
            let meta = read_meta(&staging)?;
            let has_sealed_secrets = staging.join(AI_SECRETS_ENC_FILENAME).is_file()
                || staging.join(CC_SECRETS_ENC_FILENAME).is_file();
            if meta.encryption_enabled && has_sealed_secrets {
                verify_import_access(&staging, password, recovery_phrase)?;
            }
        }
        apply_settings_merge(data_dir, &staging, password, recovery_phrase, current_dek)?;

        Ok(ImportResult {
            success: true,
            requires_restart: false,
            vault_id: manifest.vault_id,
            merged_documents: None,
            merged_assets: None,
        })
    })();

    let _ = fs::remove_dir_all(&staging);
    result
}

fn import_vault_merge_documents(
    data_dir: &Path,
    src_path: &Path,
    password: &str,
    recovery_phrase: Option<&str>,
    current_dek: Option<[u8; DEK_LEN]>,
) -> Result<ImportResult, VaultError> {
    let (manifest, staging) = read_manifest_and_extract(src_path, data_dir)?;

    let result = (|| -> Result<ImportResult, VaultError> {
        if staging.join(KEYS_FILENAME).is_file() {
            verify_import_access(&staging, password, recovery_phrase)?;
        }

        apply_settings_merge(data_dir, &staging, password, recovery_phrase, current_dek)?;

        let stats = super::merge_docs::merge_documents_from_staging(
            data_dir,
            &staging,
            password,
            recovery_phrase,
        )?;

        Ok(ImportResult {
            success: true,
            requires_restart: false,
            vault_id: manifest.vault_id,
            merged_documents: Some(stats.documents),
            merged_assets: Some(stats.assets),
        })
    })();

    let _ = fs::remove_dir_all(&staging);
    result
}

fn apply_settings_merge(
    data_dir: &Path,
    staging: &Path,
    password: &str,
    recovery_phrase: Option<&str>,
    current_dek: Option<[u8; DEK_LEN]>,
) -> Result<(), VaultError> {
    let settings_files = [
        AI_CONFIG_FILENAME,
        MCP_CONFIG_FILENAME,
        CC_WORKBENCH_CONFIG_FILENAME,
    ];
    for name in settings_files {
        let src = staging.join(name);
        if src.is_file() {
            fs::copy(&src, data_dir.join(name))?;
        }
    }

    merge_secrets_file(
        data_dir,
        staging,
        (AI_SECRETS_FILENAME, AI_SECRETS_ENC_FILENAME),
        password,
        recovery_phrase,
        current_dek,
        |dir, enc, dek, bytes| {
            let secrets: crate::ai::AiSecrets =
                serde_json::from_slice(bytes).map_err(|_| VaultError::InvalidData)?;
            crate::ai::save_secrets(dir, &secrets, enc, dek).map_err(|_| VaultError::InvalidData)
        },
    )?;
    merge_secrets_file(
        data_dir,
        staging,
        (CC_SECRETS_FILENAME, CC_SECRETS_ENC_FILENAME),
        password,
        recovery_phrase,
        current_dek,
        |dir, enc, dek, bytes| {
            let secrets: crate::cc_workbench::secrets::CcWorkbenchSecrets =
                serde_json::from_slice(bytes).map_err(|_| VaultError::InvalidData)?;
            crate::cc_workbench::save_secrets(dir, &secrets, enc, dek)
                .map_err(|_| VaultError::InvalidData)
        },
    )?;

    let incoming_ui = staging.join(UI_STATE_FILENAME);
    if incoming_ui.is_file() {
        let incoming = load_ui_state(staging).map_err(|_| VaultError::InvalidData)?;
        let existing = load_ui_state(data_dir).map_err(|_| VaultError::InvalidData)?;
        let merged = merge_ui_state(&existing, &incoming);
        save_ui_state(data_dir, &merged).map_err(|_| VaultError::InvalidData)?;
    }

    crate::writing_styles::merge_from_staging(data_dir, staging).map_err(|_| VaultError::InvalidData)?;

    Ok(())
}

fn merge_secrets_file<F>(
    data_dir: &Path,
    staging: &Path,
    (plain_name, enc_name): (&str, &str),
    password: &str,
    recovery_phrase: Option<&str>,
    current_session_dek: Option<[u8; DEK_LEN]>,
    write_target: F,
) -> Result<(), VaultError>
where
    F: FnOnce(&Path, bool, Option<&[u8; DEK_LEN]>, &[u8]) -> Result<(), VaultError>,
{
    let staging_enc = staging.join(enc_name);
    let staging_plain = staging.join(plain_name);
    if !staging_enc.is_file() && !staging_plain.is_file() {
        return Ok(());
    }

    let current_meta = read_meta(data_dir)?;
    let bytes = if staging_enc.is_file() {
        let backup_dek = resolve_merge_dek(staging, password, recovery_phrase)?
            .ok_or(VaultError::Locked)?;
        crate::crypto::read_sealed(&staging_enc, &backup_dek).map_err(|_| VaultError::InvalidData)?
    } else {
        fs::read(&staging_plain)?
    };

    let current_dek = if current_meta.encryption_enabled {
        Some(match current_session_dek {
            Some(dek) => dek,
            None => resolve_merge_dek(data_dir, password, recovery_phrase)?
                .ok_or(VaultError::Locked)?,
        })
    } else {
        None
    };

    write_target(
        data_dir,
        current_meta.encryption_enabled,
        current_dek.as_ref(),
        &bytes,
    )?;
    Ok(())
}

fn resolve_merge_dek(
    data_dir: &Path,
    password: &str,
    recovery_phrase: Option<&str>,
) -> Result<Option<[u8; DEK_LEN]>, VaultError> {
    let meta = read_meta(data_dir)?;
    let keys_path = data_dir.join(KEYS_FILENAME);
    if !keys_path.is_file() {
        return Ok(None);
    }
    let keys = read_keys(&keys_path)?;
    if !(meta.encryption_enabled || keys.encryption_enabled) {
        return Ok(None);
    }
    if !password.is_empty() {
        return Ok(Some(keys.unwrap_dek(password.as_bytes())?));
    }
    let phrase = recovery_phrase.ok_or(VaultError::Locked)?;
    Ok(Some(mnemonic_to_dek(phrase)?))
}

fn verify_import_access(
    staging: &Path,
    password: &str,
    recovery_phrase: Option<&str>,
) -> Result<(), VaultError> {
    let meta = read_meta(staging)?;
    let keys = read_keys(&staging.join(KEYS_FILENAME))?;
    let encryption_required = meta.encryption_enabled || keys.encryption_enabled;

    if !encryption_required {
        keys.unwrap_dek(b"")?;
        return Ok(());
    }

    if !password.is_empty() {
        keys.unwrap_dek(password.as_bytes())?;
        return Ok(());
    }

    let phrase = recovery_phrase.ok_or(VaultError::InvalidData)?;
    let dek = mnemonic_to_dek(phrase)?;
    db::open_vault_connection(staging, &dek).map_err(|_| VaultError::UnlockFailed)?;
    Ok(())
}

fn atomic_replace(data_dir: &Path, staging: &Path) -> Result<(), VaultError> {
    let parent = data_dir.parent().ok_or(VaultError::InvalidData)?;
    let backup = parent.join(format!(".lizhi-backup-{}", uuid::Uuid::new_v4()));

    if try_rename_replace(data_dir, staging, &backup).is_ok() {
        let _ = fs::remove_dir_all(&backup);
        return Ok(());
    }

    if backup.exists() {
        let _ = fs::rename(&backup, data_dir);
    }

    replace_by_copy(data_dir, staging)
}

fn try_rename_replace(data_dir: &Path, staging: &Path, backup: &Path) -> Result<(), VaultError> {
    if data_dir.exists() {
        fs::rename(data_dir, backup)?;
    }
    fs::rename(staging, data_dir)?;
    Ok(())
}

fn replace_by_copy(data_dir: &Path, staging: &Path) -> Result<(), VaultError> {
    if data_dir.exists() {
        clear_dir_contents(data_dir)?;
    } else {
        fs::create_dir_all(data_dir)?;
    }
    copy_dir_all(staging, data_dir)
}

fn clear_dir_contents(dir: &Path) -> Result<(), VaultError> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            fs::remove_dir_all(path)?;
        } else {
            fs::remove_file(path)?;
        }
    }
    Ok(())
}

fn copy_dir_all(src: &Path, dst: &Path) -> Result<(), VaultError> {
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let target = dst.join(entry.file_name());
        if file_type.is_dir() {
            fs::create_dir_all(&target)?;
            copy_dir_all(&entry.path(), &target)?;
        } else {
            fs::copy(entry.path(), &target)?;
        }
    }
    Ok(())
}

pub(crate) fn read_meta(data_dir: &Path) -> Result<VaultMeta, VaultError> {
    let content = fs::read_to_string(meta_path(data_dir))?;
    Ok(serde_json::from_str(&content)?)
}

fn read_meta_from_zip(archive: &mut ZipArchive<File>) -> Result<VaultMeta, VaultError> {
    let mut meta_file = archive.by_name(META_FILENAME)?;
    let mut content = String::new();
    meta_file.read_to_string(&mut content)?;
    Ok(serde_json::from_str(&content)?)
}

fn collect_file(
    files: &mut Vec<BackupFileEntry>,
    data_dir: &Path,
    rel: &str,
) -> Result<(), VaultError> {
    let abs = data_dir.join(rel);
    if !abs.is_file() {
        return Err(VaultError::NotFound);
    }
    files.push(hash_file(rel, &abs)?);
    Ok(())
}

fn collect_file_optional(
    files: &mut Vec<BackupFileEntry>,
    data_dir: &Path,
    rel: &str,
) -> Result<(), VaultError> {
    let abs = data_dir.join(rel);
    if abs.is_file() {
        files.push(hash_file(rel, &abs)?);
    }
    Ok(())
}

fn collect_dir(
    files: &mut Vec<BackupFileEntry>,
    data_dir: &Path,
    rel_dir: &str,
) -> Result<(), VaultError> {
    let root = data_dir.join(rel_dir);
    if !root.exists() {
        return Ok(());
    }
    collect_dir_recursive(files, data_dir, &root)?;
    Ok(())
}

fn collect_dir_recursive(
    files: &mut Vec<BackupFileEntry>,
    data_dir: &Path,
    dir: &Path,
) -> Result<(), VaultError> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            collect_dir_recursive(files, data_dir, &path)?;
        } else if path.is_file() {
            let rel = path
                .strip_prefix(data_dir)
                .map_err(|_| VaultError::InvalidData)?
                .to_string_lossy()
                .replace('\\', "/");
            files.push(hash_file(&rel, &path)?);
        }
    }
    Ok(())
}

fn hash_file(rel: &str, path: &Path) -> Result<BackupFileEntry, VaultError> {
    let bytes = fs::read(path)?;
    let digest = hex::encode(Sha256::digest(&bytes));
    Ok(BackupFileEntry {
        path: rel.to_string(),
        sha256: digest,
        size: bytes.len() as u64,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::vault::{keys_path, VaultService};
    use std::env;

    fn temp_dir() -> PathBuf {
        let dir = env::temp_dir().join(format!("lizhi-backup-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn backup_includes_optional_settings_files() {
        use crate::prefs::{save_ui_state, VaultUiState, UI_STATE_FILENAME};
        use crate::ai::config::AiConfig;
        use crate::ai::save_config;
        use serde_json::json;

        let dir = temp_dir();
        let mut svc = VaultService::new(dir.clone());
        svc.create_vault(String::new(), None, None).unwrap();

        save_ui_state(
            &dir,
            &VaultUiState {
                schema_version: 2,
                folders: Some(json!({ "folders": [] })),
                document_tags: None,
                ..Default::default()
            },
        )
        .unwrap();
        let ai_config = AiConfig::default();
        save_config(&dir, &ai_config).unwrap();

        let backup_path = dir.join("with-settings.lizhi");
        export_vault(&dir, &backup_path, None).unwrap();

        let file = File::open(&backup_path).unwrap();
        let mut archive = ZipArchive::new(file).unwrap();
        assert!(archive.by_name(UI_STATE_FILENAME).is_ok());
        assert!(archive.by_name("ai-config.json").is_ok());

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn merge_settings_import_preserves_workspace() {
        use crate::prefs::{load_ui_state, save_ui_state, VaultUiState};
        use serde_json::json;

        let source = temp_dir();
        let mut svc = VaultService::new(source.clone());
        svc.create_vault(String::new(), None, None).unwrap();
        db::open_plaintext_connection(&source).unwrap();
        let ws = db::workspace_dir(&source);
        fs::create_dir_all(ws.join("inbox")).unwrap();
        fs::write(ws.join("inbox/only-source.md"), "# source").unwrap();
        save_ui_state(
            &source,
            &VaultUiState {
                schema_version: 2,
                folders: None,
                document_tags: Some(json!({ "doc-a": ["备份标签"] })),
                ..Default::default()
            },
        )
        .unwrap();
        fs::write(
            source.join(CC_WORKBENCH_CONFIG_FILENAME),
            r#"{"schemaVersion":1,"projectPath":"/from-backup"}"#,
        )
        .unwrap();
        fs::write(
            source.join(CC_SECRETS_FILENAME),
            r#"{"anthropicApiKey":"sk-backup-key","providerKeys":{}}"#,
        )
        .unwrap();

        let backup_path = source.join("settings.lizhi");
        export_vault(&source, &backup_path, None).unwrap();

        let target = temp_dir();
        let mut svc2 = VaultService::new(target.clone());
        svc2.create_vault(String::new(), None, None).unwrap();
        db::open_plaintext_connection(&target).unwrap();
        let target_ws = db::workspace_dir(&target);
        fs::create_dir_all(target_ws.join("inbox")).unwrap();
        fs::write(target_ws.join("inbox/keep-me.md"), "# keep").unwrap();

        let result = import_vault(&target, &backup_path, "", None, "merge", None).unwrap();
        assert!(result.success);
        assert!(!result.requires_restart);
        assert!(target_ws.join("inbox/keep-me.md").is_file());

        let ui = load_ui_state(&target).unwrap();
        let tags = ui.document_tags.unwrap();
        assert_eq!(tags["doc-a"], json!(["备份标签"]));
        assert!(target.join(CC_WORKBENCH_CONFIG_FILENAME).is_file());
        let cc_secrets = fs::read_to_string(target.join(CC_SECRETS_FILENAME)).unwrap();
        assert!(cc_secrets.contains("sk-backup-key"));

        let _ = fs::remove_dir_all(source);
        let _ = fs::remove_dir_all(target);
    }

    #[test]
    fn backup_round_trip() {
        let dir = temp_dir();
        let mut svc = VaultService::new(dir.clone());
        svc.create_vault(String::new(), None, None).unwrap();
        db::open_plaintext_connection(&dir).unwrap();

        let ws = db::workspace_dir(&dir);
        fs::create_dir_all(ws.join("inbox")).unwrap();
        fs::write(ws.join("inbox/test.md"), "# hello").unwrap();

        let rev_dir = dir.join("revisions").join("doc-1");
        fs::create_dir_all(&rev_dir).unwrap();
        fs::write(rev_dir.join("1000.md"), "# old").unwrap();

        let backup_path = dir.join("test.lizhi");
        export_vault(&dir, &backup_path, None).unwrap();

        let validation = validate_vault_backup(&backup_path);
        assert!(validation.valid);

        {
            let file = File::open(&backup_path).unwrap();
            let mut archive = ZipArchive::new(file).unwrap();
            assert!(archive.by_name("revisions/doc-1/1000.md").is_ok());
        }

        let restore_dir = temp_dir();
        let result = import_vault(&restore_dir, &backup_path, "", None, "replace", None).unwrap();
        assert!(result.success);
        assert!(result.requires_restart);
        assert!(meta_path(&restore_dir).is_file());
        assert!(keys_path(&restore_dir).is_file());
        assert!(restore_dir.join("revisions/doc-1/1000.md").is_file());

        let _ = fs::remove_dir_all(dir);
        let _ = fs::remove_dir_all(restore_dir);
    }

    #[test]
    fn encrypted_backup_round_trip() {
        let dir = temp_dir();
        let mut svc = VaultService::new(dir.clone());
        svc.create_vault("secret".into(), None, None).unwrap();
        let dek = svc.session_dek().unwrap();
        let mut secrets = crate::ai::AiSecrets::default();
        secrets
            .cloud_api_keys
            .insert("p1".into(), "sk-enc-test".into());
        crate::ai::save_secrets(&dir, &secrets, true, Some(&dek)).unwrap();

        let backup_path = dir.join("encrypted.lizhi");
        export_vault(&dir, &backup_path, Some("secret")).unwrap();

        {
            let file = File::open(&backup_path).unwrap();
            let mut archive = ZipArchive::new(file).unwrap();
            assert!(archive.by_name(AI_SECRETS_ENC_FILENAME).is_ok());
            assert!(archive.by_name(AI_SECRETS_FILENAME).is_err());
        }

        let restore_dir = temp_dir();
        let result = import_vault(&restore_dir, &backup_path, "secret", None, "replace", None).unwrap();
        assert!(result.success);

        let mut svc2 = VaultService::new(restore_dir.clone());
        let status = svc2.unlock_vault("secret".into()).unwrap();
        assert!(!status.is_locked);
        let dek2 = svc2.session_dek().unwrap();
        let restored = crate::ai::load_secrets(&restore_dir, true, Some(&dek2)).unwrap();
        assert_eq!(restored.cloud_api_keys.get("p1").unwrap(), "sk-enc-test");

        let _ = fs::remove_dir_all(dir);
        let _ = fs::remove_dir_all(restore_dir);
    }

    #[test]
    fn plaintext_backup_validation_matches_meta() {
        let dir = temp_dir();
        let mut svc = VaultService::new(dir.clone());
        svc.create_vault(String::new(), None, None).unwrap();

        let backup_path = dir.join("plain.lizhi");
        export_vault(&dir, &backup_path, None).unwrap();

        let validation = validate_vault_backup(&backup_path);
        assert!(validation.valid);
        assert!(!validation.encryption_enabled);

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn encrypted_backup_validation_requires_password_flag() {
        let dir = temp_dir();
        let mut svc = VaultService::new(dir.clone());
        svc.create_vault("secret".into(), None, None).unwrap();

        let backup_path = dir.join("encrypted.lizhi");
        export_vault(&dir, &backup_path, Some("secret")).unwrap();

        let validation = validate_vault_backup(&backup_path);
        assert!(validation.valid);
        assert!(validation.encryption_enabled);

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn encrypted_export_requires_password() {
        let dir = temp_dir();
        let mut svc = VaultService::new(dir.clone());
        svc.create_vault("secret".into(), None, None).unwrap();

        let backup_path = dir.join("encrypted.lizhi");
        assert!(matches!(
            export_vault(&dir, &backup_path, None),
            Err(VaultError::Locked)
        ));
        assert!(matches!(
            export_vault(&dir, &backup_path, Some("wrong")),
            Err(VaultError::UnlockFailed)
        ));

        let _ = fs::remove_dir_all(dir);
    }
}
