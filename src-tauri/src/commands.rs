use std::sync::Arc;

use tauri::State;



use crate::assets;

use crate::backup;

use crate::db;

use crate::documents::{

    DashboardStats, DecryptedContent, DocumentMeta, EditActivityDay, SaveResult, SearchHit,

};

use crate::credentials::{
    CreateCredentialEntryInput, CredentialEntry, CredentialEntryListItem, CredentialListFilter,
    UpdateCredentialEntryPatch,
};
use crate::journal::{CreateJournalEntryInput, JournalEntry, UpdateJournalEntryPatch};
use crate::mubu::{
    CreateMubuDocInput, MubuDoc, MubuNode, SaveMubuTreeInput, UpdateMubuDocPatch,
};

use crate::mcp::McpBridge;

use crate::requirements::{

    CreateRequirementInput, ReorderItem, Requirement, UpdateRequirementPatch,

};

use crate::link_index::{GraphPayload, LinkIndexSnapshot, LinkMention, LinkStats};

use crate::launch_records::{
    CreateLaunchRecordInput, LaunchRecord, UpdateLaunchRecordPatch,
};

use crate::vault::{CreateVaultResult, EnableEncryptionResult, VaultStatus};

use crate::vault_lock::VaultLockGuard;
use crate::{sync_document_connection, AppState};



fn session_dek(state: &State<Arc<AppState>>) -> Result<Option<[u8; 32]>, String> {

    Ok(state

        .vault_service

        .lock()

        .map_err(|_| "vault service lock poisoned".to_string())?

        .session_dek())

}

/// `(encryption_enabled, session_dek)` for reading/writing sealed secrets.
fn vault_secrets_crypto(
    state: &State<Arc<AppState>>,
) -> Result<(bool, Option<[u8; 32]>), String> {
    let (_initialized, encryption_enabled) = vault_meta(state)?;
    let dek = session_dek(state)?;
    Ok((encryption_enabled, dek))
}



fn vault_meta(state: &State<Arc<AppState>>) -> Result<(bool, bool), String> {

    let vault = state

        .vault_service

        .lock()

        .map_err(|_| "vault service lock poisoned".to_string())?;

    if !vault.is_vault_initialized() {

        return Ok((false, false));

    }

    let meta = vault.load_meta().map_err(|e| e.to_string())?;

    Ok((true, meta.encryption_enabled))

}

fn map_backup_vault_error(e: crate::vault::VaultError) -> String {
    match e {
        crate::vault::VaultError::UnlockFailed => "WRONG_PASSWORD".to_string(),
        crate::vault::VaultError::Locked => "PASSWORD_REQUIRED".to_string(),
        crate::vault::VaultError::Io(err)
            if err.kind() == std::io::ErrorKind::PermissionDenied
                || err.raw_os_error() == Some(5) =>
        {
            "无法写入数据目录：知识库文件仍被占用。请关闭其他狸知实例后重试".to_string()
        }
        other => other.to_string(),
    }
}

fn audit_log(event_type: &str, detail: Option<&str>) {
    if let Ok(dir) = db::data_dir() {
        let _ = crate::audit::log_event(&dir, event_type, detail);
    }
}

#[tauri::command]
pub fn list_audit_events(limit: Option<usize>) -> Result<Vec<crate::audit::AuditEvent>, String> {
    let dir = db::data_dir().map_err(|e| e.to_string())?;
    Ok(crate::audit::list_events(&dir, limit.unwrap_or(50)))
}



#[tauri::command]

pub fn list_documents(state: State<Arc<AppState>>) -> Result<Vec<DocumentMeta>, String> {

    state

        .document_service

        .lock()

        .map_err(|_| "document service lock poisoned".to_string())?

        .list_documents()

        .map_err(|e| e.to_string())

}



#[tauri::command]

pub fn create_document(

    state: State<Arc<AppState>>,

    title: String,

    folder: Option<String>,

) -> Result<DocumentMeta, String> {

    let dek = session_dek(&state)?;

    state

        .document_service

        .lock()

        .map_err(|_| "document service lock poisoned".to_string())?

        .create_document(title, folder, dek.as_ref())

        .map_err(|e| e.to_string())

}



#[tauri::command]

pub fn read_document(state: State<Arc<AppState>>, id: String) -> Result<DecryptedContent, String> {

    let dek = session_dek(&state)?;

    state

        .document_service

        .lock()

        .map_err(|_| "document service lock poisoned".to_string())?

        .read_document(&id, dek.as_ref())

        .map_err(|e| e.to_string())

}



#[tauri::command]

pub fn read_all_documents(state: State<Arc<AppState>>) -> Result<Vec<DecryptedContent>, String> {

    let dek = session_dek(&state)?;

    state

        .document_service

        .lock()

        .map_err(|_| "document service lock poisoned".to_string())?

        .read_all_documents(dek.as_ref())

        .map_err(|e| e.to_string())

}



#[tauri::command]

pub fn save_document(

    state: State<Arc<AppState>>,

    id: String,

    content: String,

) -> Result<SaveResult, String> {

    let dek = session_dek(&state)?;

    state

        .document_service

        .lock()

        .map_err(|_| "document service lock poisoned".to_string())?

        .save_document(&id, &content, dek.as_ref())

        .map_err(|e| e.to_string())

}



#[tauri::command]

pub fn rename_document(state: State<Arc<AppState>>, id: String, title: String) -> Result<(), String> {
    let dek = session_dek(&state)?;
    state
        .document_service
        .lock()
        .map_err(|_| "document service lock poisoned".to_string())?
        .rename_document(&id, &title, dek.as_ref())
        .map_err(|e| e.to_string())
}



#[tauri::command]

pub fn delete_document(state: State<Arc<AppState>>, id: String) -> Result<(), String> {

    state

        .document_service

        .lock()

        .map_err(|_| "document service lock poisoned".to_string())?

        .delete_document(&id)

        .map_err(|e| e.to_string())

}



#[tauri::command]

pub fn move_document(

    state: State<Arc<AppState>>,

    id: String,

    folder: String,

) -> Result<DocumentMeta, String> {

    let dek = session_dek(&state)?;

    state

        .document_service

        .lock()

        .map_err(|_| "document service lock poisoned".to_string())?

        .move_document(&id, folder, dek.as_ref())

        .map_err(|e| e.to_string())

}



#[tauri::command]

pub fn migrate_documents_folder(

    state: State<Arc<AppState>>,

    old_prefix: String,

    new_prefix: String,

) -> Result<Vec<DocumentMeta>, String> {

    let dek = session_dek(&state)?;

    state

        .document_service

        .lock()

        .map_err(|_| "document service lock poisoned".to_string())?

        .migrate_documents_folder(&old_prefix, &new_prefix, dek.as_ref())

        .map_err(|e| e.to_string())

}



#[tauri::command]

pub fn get_edit_activity(state: State<Arc<AppState>>, days: u32) -> Result<Vec<EditActivityDay>, String> {

    state

        .document_service

        .lock()

        .map_err(|_| "document service lock poisoned".to_string())?

        .get_edit_activity(days)

        .map_err(|e| e.to_string())

}



#[tauri::command]

pub fn get_dashboard_stats(state: State<Arc<AppState>>) -> Result<DashboardStats, String> {

    let dek = session_dek(&state)?;

    state

        .document_service

        .lock()

        .map_err(|_| "document service lock poisoned".to_string())?

        .get_dashboard_stats(dek.as_ref())

        .map_err(|e| e.to_string())

}



#[tauri::command]

pub fn save_asset(

    state: State<Arc<AppState>>,

    bytes: Vec<u8>,

    extension: String,

) -> Result<String, String> {

    let data_dir = db::data_dir().map_err(|e| e.to_string())?;

    let (initialized, encryption_enabled) = vault_meta(&state)?;

    let dek = session_dek(&state)?;

    assets::save_asset(

        &data_dir,

        bytes,

        &extension,

        initialized && encryption_enabled,

        dek.as_ref(),

    )

    .map_err(|e| e.to_string())

}



#[tauri::command]

pub fn get_asset_path(state: State<Arc<AppState>>, id: String) -> Result<String, String> {

    let data_dir = db::data_dir().map_err(|e| e.to_string())?;

    let (initialized, encryption_enabled) = vault_meta(&state)?;

    let dek = session_dek(&state)?;

    let path = assets::get_asset_path(

        &data_dir,

        &id,

        initialized && encryption_enabled,

        dek.as_ref(),

    )

    .map_err(|e| e.to_string())?;

    path.to_str()

        .ok_or_else(|| "invalid asset path".to_string())

        .map(String::from)

}



#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetBytesResponse {
    pub id: String,
    pub mime_type: String,
    pub data_base64: String,
    pub size: usize,
}



#[tauri::command]

pub fn read_asset_bytes(state: State<Arc<AppState>>, id: String) -> Result<AssetBytesResponse, String> {

    use base64::{engine::general_purpose::STANDARD, Engine as _};

    let data_dir = db::data_dir().map_err(|e| e.to_string())?;

    let (initialized, encryption_enabled) = vault_meta(&state)?;

    let dek = session_dek(&state)?;

    let bytes = assets::read_asset_bytes(

        &data_dir,

        &id,

        initialized && encryption_enabled,

        dek.as_ref(),

    )

    .map_err(|e| e.to_string())?;

    Ok(AssetBytesResponse {

        id: id.clone(),

        mime_type: assets::mime_for_asset_id(&id).to_string(),

        data_base64: STANDARD.encode(&bytes),

        size: bytes.len(),

    })

}



#[tauri::command]

pub fn rebuild_search_index(state: State<Arc<AppState>>) -> Result<usize, String> {

    let dek = session_dek(&state)?;

    let doc_service = state

        .document_service

        .lock()

        .map_err(|_| "document service lock poisoned".to_string())?;

    let count = doc_service

        .list_documents()

        .map_err(|e| e.to_string())?

        .len();

    doc_service

        .rebuild_indexes(dek.as_ref())

        .map_err(|e| e.to_string())?;

    Ok(count)

}



#[tauri::command]

pub fn search_documents(

    state: State<Arc<AppState>>,

    query: String,

    limit: Option<usize>,

) -> Result<Vec<SearchHit>, String> {

    let dek = session_dek(&state)?;

    state

        .document_service

        .lock()

        .map_err(|_| "document service lock poisoned".to_string())?

        .search_documents(&query, limit.unwrap_or(20).min(100), dek.as_ref())

        .map_err(|e| e.to_string())

}



#[tauri::command]

pub fn get_link_index_snapshot(

    state: State<Arc<AppState>>,

) -> Result<LinkIndexSnapshot, String> {

    let dek = session_dek(&state)?;

    state

        .document_service

        .lock()

        .map_err(|_| "document service lock poisoned".to_string())?

        .get_link_index_snapshot(dek.as_ref())

        .map_err(|e| e.to_string())

}



#[tauri::command]

pub fn get_backlinks(

    state: State<Arc<AppState>>,

    document_id: String,

) -> Result<Vec<LinkMention>, String> {

    let dek = session_dek(&state)?;

    state

        .document_service

        .lock()

        .map_err(|_| "document service lock poisoned".to_string())?

        .get_backlinks(&document_id, dek.as_ref())

        .map_err(|e| e.to_string())

}



#[tauri::command]

pub fn get_unlinked_mentions(

    state: State<Arc<AppState>>,

    document_id: String,

) -> Result<Vec<LinkMention>, String> {

    let dek = session_dek(&state)?;

    state

        .document_service

        .lock()

        .map_err(|_| "document service lock poisoned".to_string())?

        .get_unlinked_mentions(&document_id, dek.as_ref())

        .map_err(|e| e.to_string())

}



#[tauri::command]

pub fn get_outbound_link_titles(

    state: State<Arc<AppState>>,

    document_id: String,

) -> Result<Vec<String>, String> {

    let dek = session_dek(&state)?;

    state

        .document_service

        .lock()

        .map_err(|_| "document service lock poisoned".to_string())?

        .get_outbound_titles(&document_id, dek.as_ref())

        .map_err(|e| e.to_string())

}



#[tauri::command]

pub fn get_link_stats(state: State<Arc<AppState>>) -> Result<LinkStats, String> {

    let dek = session_dek(&state)?;

    state

        .document_service

        .lock()

        .map_err(|_| "document service lock poisoned".to_string())?

        .get_link_stats(dek.as_ref())

        .map_err(|e| e.to_string())

}



#[tauri::command]

pub fn get_local_graph(

    state: State<Arc<AppState>>,

    center_id: String,

    depth: Option<u32>,

) -> Result<GraphPayload, String> {

    let dek = session_dek(&state)?;

    state

        .document_service

        .lock()

        .map_err(|_| "document service lock poisoned".to_string())?

        .get_local_graph(&center_id, depth.unwrap_or(2), dek.as_ref())

        .map_err(|e| e.to_string())

}



#[tauri::command]

pub fn create_vault(

    state: State<Arc<AppState>>,

    password: String,

    hint: Option<String>,

    lock_on_startup: Option<bool>,

) -> Result<CreateVaultResult, String> {

    let result = state

        .vault_service

        .lock()

        .map_err(|_| "vault service lock poisoned".to_string())?

        .create_vault(password, hint, lock_on_startup)

        .map_err(|e| e.to_string())?;



    let vault = state

        .vault_service

        .lock()

        .map_err(|_| "vault service lock poisoned".to_string())?;

    let mut docs = state

        .document_service

        .lock()

        .map_err(|_| "document service lock poisoned".to_string())?;

    sync_document_connection(&mut docs, &vault).map_err(|e| e.to_string())?;

    drop(vault);

    drop(docs);



    Ok(result)

}



#[tauri::command]

pub fn unlock_vault(state: State<Arc<AppState>>, password: String) -> Result<VaultStatus, String> {

    let status = {

        let mut vault = state

            .vault_service

            .lock()

            .map_err(|_| "vault service lock poisoned".to_string())?;

        match vault.unlock_vault(password) {
            Ok(s) => s,
            Err(e) => {
                let msg = if matches!(e, crate::vault::VaultError::UnlockFailed) {
                    "WRONG_PASSWORD".to_string()
                } else {
                    e.to_string()
                };
                audit_log("unlock_fail", None);
                return Err(msg);
            }
        }

    };

    audit_log("unlock", None);

    let vault = state

        .vault_service

        .lock()

        .map_err(|_| "vault service lock poisoned".to_string())?;

    let mut docs = state

        .document_service

        .lock()

        .map_err(|_| "document service lock poisoned".to_string())?;

    sync_document_connection(&mut docs, &vault).map_err(|e| e.to_string())?;

    Ok(status)

}



#[tauri::command]

pub fn lock_vault(state: State<Arc<AppState>>) -> Result<(), String> {

    {

        let mut vault = state

            .vault_service

            .lock()

            .map_err(|_| "vault service lock poisoned".to_string())?;

        vault.lock_vault();

    }



    let vault = state

        .vault_service

        .lock()

        .map_err(|_| "vault service lock poisoned".to_string())?;

    let mut docs = state

        .document_service

        .lock()

        .map_err(|_| "document service lock poisoned".to_string())?;

    sync_document_connection(&mut docs, &vault).map_err(|e| e.to_string())?;

    audit_log("lock", None);

    Ok(())

}



#[tauri::command]

pub fn get_vault_status(state: State<Arc<AppState>>) -> Result<VaultStatus, String> {

    Ok(state

        .vault_service

        .lock()

        .map_err(|_| "vault service lock poisoned".to_string())?

        .get_status())

}



#[tauri::command]

pub fn enable_encryption(

    state: State<Arc<AppState>>,

    password: String,

    lock_on_startup: Option<bool>,

) -> Result<EnableEncryptionResult, String> {

    let result = {

        let mut vault = state

            .vault_service

            .lock()

            .map_err(|_| "vault service lock poisoned".to_string())?;

        let mut docs = state

            .document_service

            .lock()

            .map_err(|_| "document service lock poisoned".to_string())?;

        vault

            .enable_encryption(password, lock_on_startup, &mut docs)

            .map_err(|e| e.to_string())?

    };



    let vault = state

        .vault_service

        .lock()

        .map_err(|_| "vault service lock poisoned".to_string())?;

    let mut docs = state

        .document_service

        .lock()

        .map_err(|_| "document service lock poisoned".to_string())?;

    sync_document_connection(&mut docs, &vault).map_err(|e| e.to_string())?;



    Ok(result)

}



#[tauri::command]
pub fn set_lock_on_startup(
    state: State<Arc<AppState>>,
    enabled: bool,
    password: String,
) -> Result<VaultStatus, String> {
    let status = {
        let mut vault = state
            .vault_service
            .lock()
            .map_err(|_| "vault service lock poisoned".to_string())?;

        let mut docs = state
            .document_service
            .lock()
            .map_err(|_| "document service lock poisoned".to_string())?;

        vault
            .set_lock_on_startup(enabled, password, &mut docs)
            .map_err(|e| {
                if matches!(e, crate::vault::VaultError::UnlockFailed) {
                    "WRONG_PASSWORD".to_string()
                } else {
                    e.to_string()
                }
            })?
    };

    let vault = state
        .vault_service
        .lock()
        .map_err(|_| "vault service lock poisoned".to_string())?;

    let mut docs = state
        .document_service
        .lock()
        .map_err(|_| "document service lock poisoned".to_string())?;

    sync_document_connection(&mut docs, &vault).map_err(|e| e.to_string())?;

    Ok(status)
}



#[tauri::command]

pub fn export_vault(
    state: State<Arc<AppState>>,
    dest_path: String,
    password: Option<String>,
) -> Result<String, String> {
    let vault = state
        .vault_service
        .lock()
        .map_err(|_| "vault service lock poisoned".to_string())?;

    if vault.session().is_locked()
        && vault
            .load_meta()
            .map(|m| m.encryption_enabled && m.lock_on_startup())
            .unwrap_or(false)
    {
        return Err("VAULT_LOCKED".to_string());
    }

    let path = backup::export_vault(
        vault.data_dir(),
        std::path::Path::new(&dest_path),
        password.as_deref(),
    )
    .map_err(map_backup_vault_error)?;

    audit_log("export_vault", None);

    Ok(path.to_string_lossy().into_owned())
}



#[tauri::command]

pub fn validate_vault_backup(path: String) -> Result<backup::BackupValidation, String> {

    Ok(backup::validate_vault_backup(std::path::Path::new(&path)))

}



#[tauri::command]

pub fn import_vault(
    state: State<Arc<AppState>>,
    vault_lock: State<std::sync::Mutex<Option<VaultLockGuard>>>,
    src_path: String,
    password: String,
    recovery_phrase: Option<String>,
    mode: String,
) -> Result<backup::ImportResult, String> {
    let data_dir = {
        let vault = state
            .vault_service
            .lock()
            .map_err(|_| "vault service lock poisoned".to_string())?;
        vault.data_dir().to_path_buf()
    };

    // 释放 SQLite 与进程锁；勿在整个 import 期间持有 document_service 互斥锁。
    {
        let mut docs = state
            .document_service
            .lock()
            .map_err(|_| "document service lock poisoned".to_string())?;
        docs.disconnect();
    }

    if let Ok(mut guard) = vault_lock.lock() {
        *guard = None;
    }

    let current_dek = session_dek(&state).ok().flatten();
    let result = backup::import_vault(
        &data_dir,
        std::path::Path::new(&src_path),
        &password,
        recovery_phrase.as_deref(),
        &mode,
        current_dek,
    )
    .map_err(map_backup_vault_error);

    let reconnect = result.as_ref().map(|r| !r.requires_restart).unwrap_or(true);
    if reconnect {
        if let Ok(mut guard) = vault_lock.lock() {
            if guard.is_none() {
                if let Ok(new_guard) = VaultLockGuard::acquire(&data_dir, "app") {
                    *guard = Some(new_guard);
                }
            }
        }
        if let (Ok(mut docs), Ok(vault)) = (
            state.document_service.lock(),
            state.vault_service.lock(),
        ) {
            let _ = sync_document_connection(&mut docs, &vault);
        }
    }

    result
}



#[tauri::command]
pub fn export_markdown_folder(
    dest_dir: String,
    files: Vec<crate::export::MarkdownExportFile>,
) -> Result<crate::export::MarkdownFolderExportResult, String> {
    let result = crate::export::export_markdown_folder(std::path::Path::new(&dest_dir), &files)
        .map_err(|e| e.to_string())?;
    let event = if files.len() > 1 {
        "export_batch"
    } else {
        "export"
    };
    let detail = format!("files:{}", files.len());
    audit_log(event, Some(&detail));
    Ok(result)
}

#[tauri::command]
pub fn write_export_file(path: String, content: String) -> Result<(), String> {
    write_export_bytes(path, content.into_bytes())
}

#[tauri::command]
pub fn write_export_binary(path: String, content: Vec<u8>) -> Result<(), String> {
    write_export_bytes(path, content)
}

fn write_export_bytes(path: String, content: Vec<u8>) -> Result<(), String> {
    let path = std::path::Path::new(&path);
    if !path.is_absolute() {
        return Err("导出路径无效".into());
    }
    if path.is_dir() {
        return Err("导出路径不能是文件夹".into());
    }
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    let path = std::path::Path::new(&path);
    if !path.is_absolute() {
        return Err("文件路径无效".into());
    }
    if !path.is_file() {
        return Err("文件不存在".into());
    }
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn unlock_vault_with_recovery(

    state: State<Arc<AppState>>,

    recovery_phrase: String,

) -> Result<VaultStatus, String> {

    let status = {

        let mut vault = state

            .vault_service

            .lock()

            .map_err(|_| "vault service lock poisoned".to_string())?;

        match vault.unlock_with_recovery_phrase(recovery_phrase.trim()) {
            Ok(s) => s,
            Err(e) => {
                let msg = if matches!(e, crate::vault::VaultError::UnlockFailed) {
                    "INVALID_RECOVERY_PHRASE".to_string()
                } else {
                    e.to_string()
                };
                audit_log("unlock_fail", None);
                return Err(msg);
            }
        }

    };

    audit_log("unlock", None);

    let vault = state

        .vault_service

        .lock()

        .map_err(|_| "vault service lock poisoned".to_string())?;

    let mut docs = state

        .document_service

        .lock()

        .map_err(|_| "document service lock poisoned".to_string())?;

    sync_document_connection(&mut docs, &vault).map_err(|e| e.to_string())?;

    Ok(status)

}



#[tauri::command]

pub fn reset_password_with_recovery(

    state: State<Arc<AppState>>,

    recovery_phrase: String,

    new_password: String,

) -> Result<VaultStatus, String> {

    let status = {

        let mut vault = state

            .vault_service

            .lock()

            .map_err(|_| "vault service lock poisoned".to_string())?;

        vault

            .reset_password_with_recovery(recovery_phrase.trim(), new_password)

            .map_err(|e| {

                if matches!(e, crate::vault::VaultError::UnlockFailed) {

                    "INVALID_RECOVERY_PHRASE".to_string()

                } else {

                    e.to_string()

                }

            })?

    };



    let vault = state

        .vault_service

        .lock()

        .map_err(|_| "vault service lock poisoned".to_string())?;

    let mut docs = state

        .document_service

        .lock()

        .map_err(|_| "document service lock poisoned".to_string())?;

    sync_document_connection(&mut docs, &vault).map_err(|e| e.to_string())?;



    Ok(status)

}

#[tauri::command]
pub fn list_requirements(state: State<Arc<AppState>>) -> Result<Vec<Requirement>, String> {
    state
        .document_service
        .lock()
        .map_err(|_| "document service lock poisoned".to_string())?
        .list_requirements()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_requirement(
    state: State<Arc<AppState>>,
    input: CreateRequirementInput,
) -> Result<Requirement, String> {
    state
        .document_service
        .lock()
        .map_err(|_| "document service lock poisoned".to_string())?
        .create_requirement(input)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_requirement(
    state: State<Arc<AppState>>,
    id: String,
    patch: UpdateRequirementPatch,
) -> Result<Requirement, String> {
    state
        .document_service
        .lock()
        .map_err(|_| "document service lock poisoned".to_string())?
        .update_requirement(&id, patch)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_requirement(state: State<Arc<AppState>>, id: String) -> Result<(), String> {
    state
        .document_service
        .lock()
        .map_err(|_| "document service lock poisoned".to_string())?
        .delete_requirement(&id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reorder_requirements(
    state: State<Arc<AppState>>,
    updates: Vec<ReorderItem>,
) -> Result<(), String> {
    state
        .document_service
        .lock()
        .map_err(|_| "document service lock poisoned".to_string())?
        .reorder_requirements(updates)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_launch_records(state: State<Arc<AppState>>) -> Result<Vec<LaunchRecord>, String> {
    state
        .document_service
        .lock()
        .map_err(|_| "document service lock poisoned".to_string())?
        .list_launch_records()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_launch_record(
    state: State<Arc<AppState>>,
    input: CreateLaunchRecordInput,
) -> Result<LaunchRecord, String> {
    state
        .document_service
        .lock()
        .map_err(|_| "document service lock poisoned".to_string())?
        .create_launch_record(input)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_launch_record(
    state: State<Arc<AppState>>,
    id: String,
    patch: UpdateLaunchRecordPatch,
) -> Result<LaunchRecord, String> {
    state
        .document_service
        .lock()
        .map_err(|_| "document service lock poisoned".to_string())?
        .update_launch_record(&id, patch)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_launch_record(state: State<Arc<AppState>>, id: String) -> Result<(), String> {
    state
        .document_service
        .lock()
        .map_err(|_| "document service lock poisoned".to_string())?
        .delete_launch_record(&id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_journal_entries(state: State<Arc<AppState>>) -> Result<Vec<JournalEntry>, String> {
    state
        .document_service
        .lock()
        .map_err(|_| "document service lock poisoned".to_string())?
        .list_journal_entries()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_journal_entry(
    state: State<Arc<AppState>>,
    input: CreateJournalEntryInput,
) -> Result<JournalEntry, String> {
    state
        .document_service
        .lock()
        .map_err(|_| "document service lock poisoned".to_string())?
        .create_journal_entry(input)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_journal_entry(
    state: State<Arc<AppState>>,
    id: String,
    patch: UpdateJournalEntryPatch,
) -> Result<JournalEntry, String> {
    state
        .document_service
        .lock()
        .map_err(|_| "document service lock poisoned".to_string())?
        .update_journal_entry(&id, patch)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_journal_entry(state: State<Arc<AppState>>, id: String) -> Result<(), String> {
    state
        .document_service
        .lock()
        .map_err(|_| "document service lock poisoned".to_string())?
        .delete_journal_entry(&id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_credential_entries(
    state: State<Arc<AppState>>,
    filter: Option<CredentialListFilter>,
) -> Result<Vec<CredentialEntryListItem>, String> {
    state
        .document_service
        .lock()
        .map_err(|_| "document service lock poisoned".to_string())?
        .list_credential_entries(filter.unwrap_or_default())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_credential_entry(
    state: State<Arc<AppState>>,
    id: String,
) -> Result<CredentialEntry, String> {
    state
        .document_service
        .lock()
        .map_err(|_| "document service lock poisoned".to_string())?
        .get_credential_entry(&id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_credential_entry(
    state: State<Arc<AppState>>,
    input: CreateCredentialEntryInput,
) -> Result<CredentialEntry, String> {
    state
        .document_service
        .lock()
        .map_err(|_| "document service lock poisoned".to_string())?
        .create_credential_entry(input)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_credential_entry(
    state: State<Arc<AppState>>,
    id: String,
    patch: UpdateCredentialEntryPatch,
) -> Result<CredentialEntry, String> {
    state
        .document_service
        .lock()
        .map_err(|_| "document service lock poisoned".to_string())?
        .update_credential_entry(&id, patch)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_credential_entry(state: State<Arc<AppState>>, id: String) -> Result<(), String> {
    state
        .document_service
        .lock()
        .map_err(|_| "document service lock poisoned".to_string())?
        .delete_credential_entry(&id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_mubu_docs(state: State<Arc<AppState>>) -> Result<Vec<MubuDoc>, String> {
    state
        .document_service
        .lock()
        .map_err(|_| "document service lock poisoned".to_string())?
        .list_mubu_docs()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_mubu_doc(
    state: State<Arc<AppState>>,
    input: CreateMubuDocInput,
) -> Result<MubuDoc, String> {
    state
        .document_service
        .lock()
        .map_err(|_| "document service lock poisoned".to_string())?
        .create_mubu_doc(input)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_mubu_doc(
    state: State<Arc<AppState>>,
    id: String,
    patch: UpdateMubuDocPatch,
) -> Result<MubuDoc, String> {
    state
        .document_service
        .lock()
        .map_err(|_| "document service lock poisoned".to_string())?
        .update_mubu_doc(&id, patch)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_mubu_doc(state: State<Arc<AppState>>, id: String) -> Result<(), String> {
    state
        .document_service
        .lock()
        .map_err(|_| "document service lock poisoned".to_string())?
        .delete_mubu_doc(&id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_mubu_tree(state: State<Arc<AppState>>, doc_id: String) -> Result<Vec<MubuNode>, String> {
    state
        .document_service
        .lock()
        .map_err(|_| "document service lock poisoned".to_string())?
        .get_mubu_tree(&doc_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_mubu_tree(
    state: State<Arc<AppState>>,
    doc_id: String,
    input: SaveMubuTreeInput,
) -> Result<MubuDoc, String> {
    state
        .document_service
        .lock()
        .map_err(|_| "document service lock poisoned".to_string())?
        .save_mubu_tree(&doc_id, input)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_mcp_adapter_path() -> Result<Option<String>, String> {
    Ok(crate::mcp::resolve_mcp_adapter_path())
}

#[tauri::command]
pub fn get_mcp_config(
    bridge: State<McpBridge>,
    reveal_token: Option<bool>,
) -> Result<crate::mcp::McpConfigPublic, String> {
    let config = bridge.get_config()?;
    Ok(crate::mcp::to_public(
        &config,
        reveal_token.unwrap_or(false),
    ))
}

#[tauri::command]
pub fn set_mcp_config(
    bridge: State<McpBridge>,
    update: crate::mcp::McpConfigUpdate,
) -> Result<crate::mcp::McpConfigPublic, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let mut config = bridge.get_config()?;
    crate::mcp::apply_update(&mut config, &update);
    crate::mcp::save_config(&data_dir, &config)?;
    bridge.reload_config(config.clone())?;
    Ok(crate::mcp::to_public(&config, false))
}

#[tauri::command]
pub fn regenerate_mcp_token(
    bridge: State<McpBridge>,
) -> Result<crate::mcp::McpConfigPublic, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let mut config = bridge.get_config()?;
    crate::mcp::regenerate_token(&mut config);
    crate::mcp::save_config(&data_dir, &config)?;
    bridge.reload_config(config.clone())?;
    Ok(crate::mcp::to_public(&config, true))
}

#[tauri::command]
pub fn get_ai_config(
    state: State<'_, Arc<AppState>>,
    reveal_key: Option<bool>,
) -> Result<crate::ai::AiConfigPublic, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let (enc, dek) = vault_secrets_crypto(&state)?;
    let config = crate::ai::load_config(&data_dir, enc, dek.as_ref())?;
    let secrets = crate::ai::load_secrets(&data_dir, enc, dek.as_ref())
        .unwrap_or_default();
    Ok(crate::ai::to_public(&config, &secrets, reveal_key.unwrap_or(false)))
}

#[tauri::command]
pub fn set_ai_config(
    state: State<'_, Arc<AppState>>,
    update: crate::ai::AiConfigUpdate,
) -> Result<crate::ai::AiConfigPublic, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let (enc, dek) = vault_secrets_crypto(&state)?;
    let mut config = crate::ai::load_config(&data_dir, enc, dek.as_ref())?;
    let mut secrets = crate::ai::load_secrets(&data_dir, enc, dek.as_ref())?;
    crate::ai::apply_update(&mut config, &mut secrets, &update);
    crate::ai::save_config(&data_dir, &config)?;
    crate::ai::save_secrets(&data_dir, &secrets, enc, dek.as_ref())?;
    Ok(crate::ai::to_public(&config, &secrets, false))
}

#[tauri::command]
pub async fn test_ai_connection(
    state: State<'_, Arc<AppState>>,
    request: crate::ai::TestConnectionRequest,
) -> Result<crate::ai::ConnectionResult, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let (enc, dek) = vault_secrets_crypto(&state)?;
    let config = crate::ai::load_config(&data_dir, enc, dek.as_ref())?;
    let secrets = crate::ai::load_secrets(&data_dir, enc, dek.as_ref())?;
    Ok(
        crate::ai::llm_client::test_connection(
            &config,
            &secrets,
            request.provider_id.as_deref(),
        )
        .await,
    )
}

fn ensure_vault_unlocked(state: &State<Arc<AppState>>) -> Result<(), String> {
    let vault = state
        .vault_service
        .lock()
        .map_err(|_| "vault service lock poisoned".to_string())?;
    if vault.is_vault_initialized() && vault.session_dek().is_none() {
        return Err("VAULT_LOCKED".into());
    }
    Ok(())
}

#[tauri::command]
pub async fn ai_chat_stream(
    state: State<'_, Arc<AppState>>,
    request: crate::ai::ChatRequest,
    on_event: tauri::ipc::Channel<crate::ai::StreamEvent>,
) -> Result<(), String> {
    ensure_vault_unlocked(&state)?;

    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let (enc, dek) = vault_secrets_crypto(&state)?;
    let config = std::sync::Arc::new(crate::ai::load_config(&data_dir, enc, dek.as_ref())?);
    let secrets = std::sync::Arc::new(crate::ai::load_secrets(&data_dir, enc, dek.as_ref())?);

    let provider_id = crate::ai::resolve_cloud_provider_id(
        request.cloud_provider_id.clone(),
        request.use_cloud,
        config.active_cloud_provider_id.as_deref(),
    );

    crate::ai::llm_client::chat_stream(
        config,
        secrets,
        request.messages,
        provider_id,
        on_event,
    )
    .await
}

#[tauri::command]
pub async fn ai_rag_query(
    state: State<'_, Arc<AppState>>,
    request: crate::ai::RagRequest,
    on_event: tauri::ipc::Channel<crate::ai::StreamEvent>,
) -> Result<(), String> {
    ensure_vault_unlocked(&state)?;

    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let (enc, dek) = vault_secrets_crypto(&state)?;
    let config = std::sync::Arc::new(crate::ai::load_config(&data_dir, enc, dek.as_ref())?);
    let secrets = std::sync::Arc::new(crate::ai::load_secrets(&data_dir, enc, dek.as_ref())?);
    let app_state = state.inner().clone();

    crate::ai::rag::rag_query_stream(
        app_state,
        config,
        secrets,
        request,
        dek,
        on_event,
    )
    .await
}

#[tauri::command]
pub async fn ai_agent_run(
    state: State<'_, Arc<AppState>>,
    request: crate::ai::AgentRequest,
    on_event: tauri::ipc::Channel<crate::ai::StreamEvent>,
) -> Result<(), String> {
    ensure_vault_unlocked(&state)?;

    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let (enc, dek) = vault_secrets_crypto(&state)?;
    let config = std::sync::Arc::new(crate::ai::load_config(&data_dir, enc, dek.as_ref())?);
    let secrets = std::sync::Arc::new(crate::ai::load_secrets(&data_dir, enc, dek.as_ref())?);
    let app_state = state.inner().clone();

    crate::ai::agent::agent_run_stream(app_state, config, secrets, request, dek, on_event).await
}

#[tauri::command]
pub fn get_cc_workbench_status() -> Result<crate::cc_workbench::CcWorkbenchStatus, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    Ok(crate::cc_workbench::runtime::collect_status(&data_dir))
}

#[tauri::command]
pub fn get_cc_workbench_config(
    state: State<'_, Arc<AppState>>,
    reveal_key: Option<bool>,
    reveal_provider_id: Option<String>,
) -> Result<crate::cc_workbench::CcWorkbenchConfigPublic, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let (enc, dek) = vault_secrets_crypto(&state)?;
    let config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    let secrets = crate::cc_workbench::load_secrets(&data_dir, enc, dek.as_ref())
        .unwrap_or_default();
    Ok(crate::cc_workbench::to_public_with_reveal(
        &config,
        &secrets,
        reveal_key.unwrap_or(false),
        reveal_provider_id.as_deref(),
    ))
}

#[tauri::command]
pub fn set_cc_workbench_config(
    state: State<'_, Arc<AppState>>,
    update: crate::cc_workbench::CcWorkbenchConfigUpdate,
) -> Result<crate::cc_workbench::CcWorkbenchConfigPublic, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let (enc, dek) = vault_secrets_crypto(&state)?;
    let mut config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    let mut secrets = crate::cc_workbench::load_secrets(&data_dir, enc, dek.as_ref())?;
    crate::cc_workbench::apply_update(&mut config, &mut secrets, &update)?;
    crate::cc_workbench::save_config(&data_dir, &config)?;
    crate::cc_workbench::save_secrets(&data_dir, &secrets, enc, dek.as_ref())?;
    Ok(crate::cc_workbench::to_public(&config, &secrets, None))
}

#[tauri::command]
pub fn upsert_cc_provider(
    state: State<'_, Arc<AppState>>,
    input: crate::cc_workbench::CcProviderInput,
) -> Result<crate::cc_workbench::CcWorkbenchConfigPublic, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let (enc, dek) = vault_secrets_crypto(&state)?;
    let mut config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    let mut secrets = crate::cc_workbench::load_secrets(&data_dir, enc, dek.as_ref())?;
    crate::cc_workbench::providers::upsert_provider(&mut config, &mut secrets, &input)?;
    crate::cc_workbench::save_config(&data_dir, &config)?;
    crate::cc_workbench::save_secrets(&data_dir, &secrets, enc, dek.as_ref())?;
    Ok(crate::cc_workbench::to_public(&config, &secrets, None))
}

#[tauri::command]
pub fn delete_cc_provider(
    state: State<'_, Arc<AppState>>,
    id: String,
) -> Result<crate::cc_workbench::CcWorkbenchConfigPublic, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let (enc, dek) = vault_secrets_crypto(&state)?;
    let mut config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    let mut secrets = crate::cc_workbench::load_secrets(&data_dir, enc, dek.as_ref())?;
    crate::cc_workbench::providers::delete_provider(&mut config, &mut secrets, &id)?;
    crate::cc_workbench::save_config(&data_dir, &config)?;
    crate::cc_workbench::save_secrets(&data_dir, &secrets, enc, dek.as_ref())?;
    Ok(crate::cc_workbench::to_public(&config, &secrets, None))
}

#[tauri::command]
pub fn switch_cc_provider(
    state: State<'_, Arc<AppState>>,
    id: String,
) -> Result<crate::cc_workbench::CcWorkbenchConfigPublic, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let (enc, dek) = vault_secrets_crypto(&state)?;
    let mut config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    let mut secrets = crate::cc_workbench::load_secrets(&data_dir, enc, dek.as_ref())?;
    crate::cc_workbench::providers::switch_provider(&mut config, &mut secrets, &id)?;
    crate::cc_workbench::save_config(&data_dir, &config)?;
    Ok(crate::cc_workbench::to_public(&config, &secrets, None))
}

#[tauri::command]
pub fn list_cc_skills() -> Result<Vec<crate::cc_workbench::CcSkillEntry>, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    Ok(crate::cc_workbench::providers::list_skills(
        &data_dir,
        config.project_path.as_deref(),
    ))
}

#[tauri::command]
pub fn list_cc_skill_market() -> Result<Vec<crate::cc_workbench::CcSkillMarketEntry>, String> {
    crate::cc_workbench::skill_market::list_skill_market()
}

#[tauri::command]
pub fn preview_cc_switch_import(
    db_path: Option<String>,
) -> Result<crate::cc_workbench::CcSwitchImportPreview, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    let existing: Vec<String> = config.providers.iter().map(|p| p.id.clone()).collect();
    crate::cc_workbench::cc_switch::preview_import(db_path.as_deref(), &existing)
}

#[tauri::command]
pub fn save_cc_switch_import(
    state: State<'_, Arc<AppState>>,
    request: crate::cc_workbench::CcSwitchSaveRequest,
) -> Result<crate::cc_workbench::CcWorkbenchConfigPublic, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let (enc, dek) = vault_secrets_crypto(&state)?;
    let mut config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    let mut secrets = crate::cc_workbench::load_secrets(&data_dir, enc, dek.as_ref())?;
    let imports = crate::cc_workbench::cc_switch::build_import_inputs(
        request.db_path.as_deref(),
        &request.provider_ids,
    )?;
    for (input, api_key) in imports {
        let id = input.id.clone().unwrap_or_default();
        crate::cc_workbench::providers::upsert_provider(&mut config, &mut secrets, &input)?;
        if let Some(key) = api_key {
            secrets.set_provider_key(&id, key);
        }
    }
    crate::cc_workbench::save_config(&data_dir, &config)?;
    crate::cc_workbench::save_secrets(&data_dir, &secrets, enc, dek.as_ref())?;
    Ok(crate::cc_workbench::to_public(&config, &secrets, None))
}

#[tauri::command]
pub fn sort_cc_providers(
    state: State<'_, Arc<AppState>>,
    ordered_ids: Vec<String>,
) -> Result<crate::cc_workbench::CcWorkbenchConfigPublic, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let (enc, dek) = vault_secrets_crypto(&state)?;
    let mut config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    let secrets = crate::cc_workbench::load_secrets(&data_dir, enc, dek.as_ref())?;
    crate::cc_workbench::providers::sort_providers(&mut config, ordered_ids);
    crate::cc_workbench::save_config(&data_dir, &config)?;
    Ok(crate::cc_workbench::to_public(&config, &secrets, None))
}

#[tauri::command]
pub fn preview_claude_local_settings(
) -> Result<crate::cc_workbench::ClaudeLocalSettingsPreview, String> {
    Ok(crate::cc_workbench::claude_settings::preview_local_settings())
}

#[tauri::command]
pub fn toggle_cc_skill(
    request: crate::cc_workbench::CcSkillToggleRequest,
) -> Result<(), String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    crate::cc_workbench::skills::toggle_skill(
        &data_dir,
        config.project_path.as_deref(),
        &request.name,
        &request.scope,
        request.enabled,
    )
}

#[tauri::command]
pub fn import_cc_skills(
    request: crate::cc_workbench::CcSkillImportRequest,
) -> Result<crate::cc_workbench::CcSkillImportResult, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    Ok(crate::cc_workbench::skills::import_skills(
        &data_dir,
        config.project_path.as_deref(),
        &request.scope,
        &request.source_paths,
    ))
}

#[tauri::command]
pub fn delete_cc_skill(
    request: crate::cc_workbench::CcSkillDeleteRequest,
) -> Result<(), String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    crate::cc_workbench::skills::delete_skill(
        &data_dir,
        config.project_path.as_deref(),
        &request.name,
        &request.scope,
        request.enabled,
    )
}

#[tauri::command]
pub fn open_cc_skill(path: String, app: tauri::AppHandle) -> Result<(), String> {
    use std::path::PathBuf;
    use tauri_plugin_opener::OpenerExt;

    let skill_dir = PathBuf::from(path.trim());
    if !skill_dir.exists() {
        return Err(format!("路径不存在: {}", skill_dir.display()));
    }
    let target = skill_dir.join("SKILL.md");
    let open_path = if target.is_file() {
        target
    } else {
        skill_dir
    };
    app.opener()
        .open_path(open_path.to_string_lossy().as_ref(), None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_cc_mcp_servers() -> Result<Vec<crate::cc_workbench::CcMcpServer>, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    crate::cc_workbench::mcp_servers::list_cc_mcp_servers(config.project_path.as_deref())
}

#[tauri::command]
pub fn upsert_cc_mcp_server(
    input: crate::cc_workbench::CcMcpServerInput,
) -> Result<crate::cc_workbench::CcMcpServer, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    crate::cc_workbench::mcp_servers::upsert_cc_mcp_server(&input, config.project_path.as_deref())
}

#[tauri::command]
pub fn delete_cc_mcp_server(id: String) -> Result<(), String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    crate::cc_workbench::mcp_servers::delete_cc_mcp_server(&id, config.project_path.as_deref())
}

#[tauri::command]
pub fn toggle_cc_mcp_server(
    request: crate::cc_workbench::CcMcpServerToggleRequest,
) -> Result<(), String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    crate::cc_workbench::mcp_servers::toggle_cc_mcp_server(&request, config.project_path.as_deref())
}

#[tauri::command]
pub fn get_cc_mcp_server_status(
) -> Result<Vec<crate::cc_workbench::CcMcpServerStatusInfo>, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    crate::cc_workbench::mcp_servers::get_cc_mcp_server_status(config.project_path.as_deref())
}

#[tauri::command]
pub fn copy_cc_mcp_server_config(id: String) -> Result<String, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    let servers = crate::cc_workbench::mcp_servers::list_cc_mcp_servers(config.project_path.as_deref())?;
    let server = servers
        .into_iter()
        .find(|s| s.id == id)
        .ok_or_else(|| format!("未找到 MCP 服务器: {id}"))?;
    Ok(crate::cc_workbench::mcp_servers::copy_config_snippet(&server))
}

#[tauri::command]
pub async fn install_cc_sdk() -> Result<String, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || crate::cc_workbench::runtime::install_sdk(&data_dir))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn list_cc_agents() -> Result<Vec<crate::cc_workbench::CcAgentEntry>, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    Ok(crate::cc_workbench::chat_input::list_agents(
        config.project_path.as_deref(),
    ))
}

#[tauri::command]
pub fn save_cc_agent(
    input: crate::cc_workbench::CcAgentInput,
) -> Result<crate::cc_workbench::CcAgentEntry, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    crate::cc_workbench::chat_input::save_agent(config.project_path.as_deref(), &input)
}

#[tauri::command]
pub fn delete_cc_agent(
    request: crate::cc_workbench::CcAgentDeleteRequest,
) -> Result<(), String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    crate::cc_workbench::chat_input::delete_agent(
        config.project_path.as_deref(),
        &request.id,
        &request.scope,
    )
}

#[tauri::command]
pub fn import_cc_agents(
    request: crate::cc_workbench::CcAgentImportRequest,
) -> Result<crate::cc_workbench::CcAgentImportResult, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    Ok(crate::cc_workbench::chat_input::import_agents(
        config.project_path.as_deref(),
        &request.scope,
        &request.source_paths,
        &request.conflict_mode,
    ))
}

#[tauri::command]
pub fn export_cc_agents(
    request: crate::cc_workbench::CcAgentExportRequest,
) -> Result<crate::cc_workbench::CcAgentExportResult, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    Ok(crate::cc_workbench::chat_input::export_agents(
        config.project_path.as_deref(),
        &request.agents,
        &request.dest_dir,
        &request.format,
    ))
}

#[tauri::command]
pub fn list_cc_agent_market() -> Result<Vec<crate::cc_workbench::CcAgentMarketEntry>, String> {
    crate::cc_workbench::agent_market::list_agent_market()
}

#[tauri::command]
pub fn get_cc_claude_md(scope: String) -> Result<crate::cc_workbench::CcClaudeMdPreview, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    crate::cc_workbench::claude_md::get_claude_md(&scope, config.project_path.as_deref())
}

#[tauri::command]
pub fn save_cc_claude_md(
    scope: String,
    content: String,
) -> Result<crate::cc_workbench::CcClaudeMdPreview, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    crate::cc_workbench::claude_md::save_claude_md(&scope, &content, config.project_path.as_deref())
}

#[tauri::command]
pub fn get_cc_hooks(scope: String) -> Result<crate::cc_workbench::CcHooksPreview, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    crate::cc_workbench::hooks::get_cc_hooks(&scope, config.project_path.as_deref())
}

#[tauri::command]
pub fn save_cc_hooks(
    scope: String,
    hooks_json: String,
) -> Result<crate::cc_workbench::CcHooksPreview, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    crate::cc_workbench::hooks::save_cc_hooks(&scope, &hooks_json, config.project_path.as_deref())
}

#[tauri::command]
pub fn list_cc_prompts() -> Result<Vec<crate::cc_workbench::CcPromptEntry>, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    Ok(crate::cc_workbench::chat_input::list_prompts(
        config.project_path.as_deref(),
    ))
}

#[tauri::command]
pub fn save_cc_prompt(
    input: crate::cc_workbench::CcPromptInput,
) -> Result<crate::cc_workbench::CcPromptEntry, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    crate::cc_workbench::chat_input::save_prompt(config.project_path.as_deref(), &input)
}

#[tauri::command]
pub fn delete_cc_prompt(
    request: crate::cc_workbench::CcPromptDeleteRequest,
) -> Result<(), String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    crate::cc_workbench::chat_input::delete_prompt(
        config.project_path.as_deref(),
        &request.id,
        &request.scope,
    )
}

#[tauri::command]
pub fn import_cc_prompts(
    request: crate::cc_workbench::CcPromptImportRequest,
) -> Result<crate::cc_workbench::CcPromptImportResult, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    Ok(crate::cc_workbench::chat_input::import_prompts(
        config.project_path.as_deref(),
        &request.scope,
        &request.source_paths,
        &request.conflict_mode,
    ))
}

#[tauri::command]
pub fn export_cc_prompts(
    request: crate::cc_workbench::CcPromptExportRequest,
) -> Result<crate::cc_workbench::CcPromptExportResult, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    Ok(crate::cc_workbench::chat_input::export_prompts(
        config.project_path.as_deref(),
        &request.prompts,
        &request.dest_dir,
        &request.format,
    ))
}

#[tauri::command]
pub fn list_cc_slash_commands() -> Result<Vec<crate::cc_workbench::CcSlashCommandEntry>, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    Ok(crate::cc_workbench::slash_commands::list_slash_commands(
        config.project_path.as_deref(),
    ))
}

#[tauri::command]
pub fn list_cc_context_files(
    state: State<'_, Arc<AppState>>,
    request: crate::cc_workbench::CcListContextFilesRequest,
) -> Result<Vec<crate::cc_workbench::CcContextFileEntry>, String> {
    ensure_vault_unlocked(&state)?;
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    let query = request.query.unwrap_or_default();
    let mode = crate::cc_workbench::chat_input::cwd_mode_from_str(&request.cwd_mode);
    match mode {
        crate::cc_workbench::config::CwdMode::Project => {
            let path = request
                .project_path
                .or(config.project_path.clone())
                .filter(|p| !p.trim().is_empty())
                .ok_or_else(|| "请先在设置中选择项目目录".to_string())?;
            crate::cc_workbench::chat_input::list_context_files_project(&path, &query)
        }
        crate::cc_workbench::config::CwdMode::Vault => {
            let paths: Vec<String> = state
                .document_service
                .lock()
                .map_err(|_| "document service lock poisoned".to_string())?
                .list_documents()
                .map_err(|e| e.to_string())?
                .into_iter()
                .map(|d| d.path)
                .collect();
            let mut entries = crate::cc_workbench::chat_input::list_context_files_vault(
                &paths, &query,
            );
            entries.extend(crate::cc_workbench::context::list_vault_folders(&paths));
            entries.sort_by(|a, b| a.path.cmp(&b.path));
            Ok(entries)
        }
    }
}

#[tauri::command]
pub fn cc_workbench_enhance_prompt(
    state: State<'_, Arc<AppState>>,
    request: crate::cc_workbench::CcEnhancePromptRequest,
) -> Result<crate::cc_workbench::CcEnhancePromptResult, String> {
    ensure_vault_unlocked(&state)?;
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    let (enc, dek) = vault_secrets_crypto(&state)?;
    let secrets = crate::cc_workbench::load_secrets(&data_dir, enc, dek.as_ref())?;
    if !config.enabled {
        return Err("Claude Agent 工作台未启用".into());
    }
    let prompt = request.prompt.trim();
    if prompt.is_empty() {
        return Err("请输入要增强的提示词".into());
    }
    crate::cc_workbench::runtime::run_enhance_prompt(
        &data_dir,
        &config,
        &secrets,
        prompt,
        request.selected_model.as_deref(),
        request.selected_model_slot.as_deref(),
    )
}

#[tauri::command]
pub fn cc_workbench_test_model(
    state: State<'_, Arc<AppState>>,
    request: crate::cc_workbench::CcModelTestRequest,
) -> Result<crate::cc_workbench::CcModelTestResult, String> {
    ensure_vault_unlocked(&state)?;
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    let (enc, dek) = vault_secrets_crypto(&state)?;
    let secrets = crate::cc_workbench::load_secrets(&data_dir, enc, dek.as_ref())?;
    if !config.enabled {
        return Err("Claude Agent 工作台未启用".into());
    }
    let model = request.model.trim();
    if model.is_empty() {
        return Err("请选择要测试的模型".into());
    }
    crate::cc_workbench::runtime::run_test_model(
        &data_dir,
        &config,
        &secrets,
        model,
        request.model_slot.as_deref(),
    )
}

#[tauri::command]
pub async fn cc_workbench_send(
    state: State<'_, Arc<AppState>>,
    request: crate::cc_workbench::CcWorkbenchRequest,
    on_event: tauri::ipc::Channel<crate::ai::StreamEvent>,
) -> Result<(), String> {
    ensure_vault_unlocked(&state)?;

    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    let (enc, dek) = vault_secrets_crypto(&state)?;
    let secrets = crate::cc_workbench::load_secrets(&data_dir, enc, dek.as_ref())?;

    if !config.enabled {
        return Err("Claude Agent 工作台未启用，请在设置中开启".into());
    }

    let dek = session_dek(&state)?;
    let opened_file_contents = {
        let doc = state
            .document_service
            .lock()
            .map_err(|_| "document service lock poisoned".to_string())?;
        crate::cc_workbench::context::resolve_opened_files(
            &config,
            &doc,
            dek.as_ref(),
            &request.opened_files,
        )?
    };
    let attachment_contents =
        crate::cc_workbench::context::resolve_attachments(&request.attachments)?;

    crate::cc_workbench::runtime::run_stream(
        &data_dir,
        &config,
        &secrets,
        request,
        opened_file_contents,
        attachment_contents,
        on_event,
    )
}

#[tauri::command]
pub fn cc_workbench_abort() -> Result<(), String> {
    crate::cc_workbench::runtime::abort_active_stream()
}

#[tauri::command]
pub fn list_cc_bridge_processes() -> Result<crate::cc_workbench::CcBridgeProcessList, String> {
    Ok(crate::cc_workbench::list_bridge_processes())
}

#[tauri::command]
pub fn kill_cc_bridge_process(pid: u32) -> Result<(), String> {
    let was_session = crate::cc_workbench::bridge_processes::session_pid() == Some(pid);
    crate::cc_workbench::kill_bridge_process(pid)?;
    if was_session {
        crate::cc_workbench::runtime::clear_session_runtime_state();
    }
    Ok(())
}

#[tauri::command]
pub fn cc_workbench_tool_permission_response(
    request: crate::cc_workbench::CcToolPermissionResponse,
) -> Result<(), String> {
    let request_id = request.request_id.trim();
    if request_id.is_empty() {
        return Err("requestId 不能为空".into());
    }
    crate::cc_workbench::runtime::respond_tool_permission(
        request_id,
        &request.behavior,
        request.message.as_deref(),
    )
}

#[tauri::command]
pub fn get_vault_ui_state() -> Result<crate::prefs::VaultUiState, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    crate::prefs::load_ui_state(&data_dir)
}

#[tauri::command]
pub fn save_vault_ui_state(
    app: State<Arc<AppState>>,
    state: crate::prefs::VaultUiState,
) -> Result<(), String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    crate::prefs::save_ui_state(&data_dir, &state)?;
    // 前端可能覆盖掉 MCP ensure 写入的树：按文档实际 folder 再 reconcile 一次
    if let Ok(svc) = app.document_service.lock() {
        if let Ok(folders) = svc.list_folders() {
            for folder in folders {
                let _ = crate::prefs::ensure_folder_path(&data_dir, &folder);
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn list_assets(state: State<Arc<AppState>>) -> Result<Vec<assets::AssetEntry>, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let (_, encryption_enabled) = vault_meta(&state)?;
    assets::list_assets(&data_dir, encryption_enabled).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_asset(state: State<Arc<AppState>>, id: String) -> Result<(), String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let (_, encryption_enabled) = vault_meta(&state)?;
    assets::delete_asset(&data_dir, &id, encryption_enabled).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn export_obsidian_vault(
    state: State<Arc<AppState>>,
    dest_dir: String,
    files: Vec<crate::export::MarkdownExportFile>,
    assets_list: Vec<crate::export::ObsidianExportAsset>,
) -> Result<crate::export::ObsidianExportResult, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let (_, encryption_enabled) = vault_meta(&state)?;
    let dek = session_dek(&state)?;
    let result = crate::export::export_obsidian_vault(
        &data_dir,
        std::path::Path::new(&dest_dir),
        &files,
        &assets_list,
        encryption_enabled,
        dek.as_ref(),
    )
    .map_err(|e| e.to_string())?;
    let detail = format!("files:{}", files.len());
    audit_log("export_obsidian", Some(&detail));
    Ok(result)
}

#[tauri::command]
pub fn preview_cc_agents_import(
    request: crate::cc_workbench::CcAgentImportRequest,
) -> Result<crate::cc_workbench::chat_input::CcImportPreview, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    Ok(crate::cc_workbench::chat_input::preview_agents_import(
        config.project_path.as_deref(),
        &request.scope,
        &request.source_paths,
    ))
}

#[tauri::command]
pub fn preview_cc_skills_import(
    request: crate::cc_workbench::CcSkillImportRequest,
) -> Result<crate::cc_workbench::chat_input::CcImportPreview, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    Ok(crate::cc_workbench::skills::preview_skills_import(
        &data_dir,
        config.project_path.as_deref(),
        &request.scope,
        &request.source_paths,
    ))
}

#[tauri::command]
pub fn preview_cc_prompts_import(
    request: crate::cc_workbench::CcPromptImportRequest,
) -> Result<crate::cc_workbench::chat_input::CcImportPreview, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let config = crate::cc_workbench::config::load_config_ready(&data_dir)?;
    Ok(crate::cc_workbench::chat_input::preview_prompts_import(
        config.project_path.as_deref(),
        &request.scope,
        &request.source_paths,
    ))
}

#[tauri::command]
pub fn get_cc_claude_permissions() -> Result<crate::cc_workbench::claude_settings::CcClaudePermissionsPreview, String> {
    Ok(crate::cc_workbench::claude_settings::get_permissions())
}

#[tauri::command]
pub fn save_cc_claude_permissions(
    permissions: crate::cc_workbench::claude_settings::CcClaudePermissions,
) -> Result<crate::cc_workbench::claude_settings::CcClaudePermissionsPreview, String> {
    crate::cc_workbench::claude_settings::save_permissions(&permissions)
}

#[tauri::command]
pub fn append_cc_usage_entry(entry: crate::cc_workbench::usage::CcUsageEntry) -> Result<(), String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    crate::cc_workbench::usage::append_usage(&data_dir, entry)
}

#[tauri::command]
pub fn get_cc_usage_stats() -> Result<Vec<crate::cc_workbench::usage::CcUsageEntry>, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    crate::cc_workbench::usage::list_usage(&data_dir)
}

#[tauri::command]
pub fn fetch_cc_market_catalog(url: String) -> Result<Vec<serde_json::Value>, String> {
    crate::cc_workbench::market_catalog::fetch_remote_catalog(&url)
}

#[tauri::command]
pub fn cc_workbench_git_status(project_path: String) -> Result<crate::cc_workbench::git_ops::CcGitStatusResult, String> {
    crate::cc_workbench::git_ops::git_status(&project_path)
}

#[tauri::command]
pub fn cc_workbench_git_file_diff(
    project_path: String,
    path: String,
) -> Result<crate::cc_workbench::git_ops::CcGitFileDiffContents, String> {
    crate::cc_workbench::git_ops::git_file_diff_contents(&project_path, &path)
}

#[tauri::command]
pub fn cc_workbench_git_diff(project_path: String, paths: Vec<String>) -> Result<String, String> {
    crate::cc_workbench::git_ops::git_diff(&project_path, &paths)
}

#[tauri::command]
pub fn cc_workbench_git_undo_edits(
    project_path: String,
    paths: Vec<String>,
) -> Result<u32, String> {
    crate::cc_workbench::git_ops::git_undo_edits(&project_path, &paths)
}

#[tauri::command]
pub fn list_document_revisions(
    state: State<Arc<AppState>>,
    doc_id: String,
) -> Result<Vec<crate::revisions::RevisionMeta>, String> {
    let data_dir = {
        let vault = state
            .vault_service
            .lock()
            .map_err(|_| "vault service lock poisoned".to_string())?;
        vault.data_dir().to_path_buf()
    };
    crate::revisions::list_revisions(&data_dir, &doc_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_document_revision(
    state: State<Arc<AppState>>,
    doc_id: String,
    revision_id: String,
) -> Result<String, String> {
    let dek = session_dek(&state)?;
    let (data_dir, encryption_enabled) = {
        let vault = state
            .vault_service
            .lock()
            .map_err(|_| "vault service lock poisoned".to_string())?;
        let encryption_enabled = if vault.is_vault_initialized() {
            vault
                .load_meta()
                .map(|m| m.encryption_enabled)
                .unwrap_or(false)
        } else {
            false
        };
        (vault.data_dir().to_path_buf(), encryption_enabled)
    };
    crate::revisions::read_revision(
        &data_dir,
        &doc_id,
        &revision_id,
        encryption_enabled,
        dek.as_ref(),
    )
    .map_err(|e| e.to_string())
}

