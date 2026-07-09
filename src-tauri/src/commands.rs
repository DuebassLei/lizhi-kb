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
            "无法写入数据目录：知识库文件仍被占用。请关闭其他狸知实例或 Sidecar 后重试".to_string()
        }
        other => other.to_string(),
    }
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

        .rename_document(&id, &title)

        .map_err(|e| e.to_string())?;

    state

        .document_service

        .lock()

        .map_err(|_| "document service lock poisoned".to_string())?

        .rebuild_indexes(dek.as_ref())

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

        vault.unlock_vault(password).map_err(|e| {

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

    let result = backup::import_vault(
        &data_dir,
        std::path::Path::new(&src_path),
        &password,
        recovery_phrase.as_deref(),
        &mode,
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
    crate::export::export_markdown_folder(std::path::Path::new(&dest_dir), &files)
        .map_err(|e| e.to_string())
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

        vault

            .unlock_with_recovery_phrase(recovery_phrase.trim())

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
pub fn get_ai_config(reveal_key: Option<bool>) -> Result<crate::ai::AiConfigPublic, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let config = crate::ai::load_config(&data_dir)?;
    let secrets = crate::ai::load_secrets(&data_dir)?;
    Ok(crate::ai::to_public(&config, &secrets, reveal_key.unwrap_or(false)))
}

#[tauri::command]
pub fn set_ai_config(update: crate::ai::AiConfigUpdate) -> Result<crate::ai::AiConfigPublic, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let mut config = crate::ai::load_config(&data_dir)?;
    let mut secrets = crate::ai::load_secrets(&data_dir)?;
    crate::ai::apply_update(&mut config, &mut secrets, &update);
    crate::ai::save_config(&data_dir, &config)?;
    crate::ai::save_secrets(&data_dir, &secrets)?;
    Ok(crate::ai::to_public(&config, &secrets, false))
}

#[tauri::command]
pub async fn test_ai_connection(
    request: crate::ai::TestConnectionRequest,
) -> Result<crate::ai::ConnectionResult, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    let config = crate::ai::load_config(&data_dir)?;
    let secrets = crate::ai::load_secrets(&data_dir)?;
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
    let config = std::sync::Arc::new(crate::ai::load_config(&data_dir)?);
    let secrets = std::sync::Arc::new(crate::ai::load_secrets(&data_dir)?);

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
    let config = std::sync::Arc::new(crate::ai::load_config(&data_dir)?);
    let secrets = std::sync::Arc::new(crate::ai::load_secrets(&data_dir)?);
    let dek = session_dek(&state)?;
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
    let config = std::sync::Arc::new(crate::ai::load_config(&data_dir)?);
    let secrets = std::sync::Arc::new(crate::ai::load_secrets(&data_dir)?);
    let dek = session_dek(&state)?;
    let app_state = state.inner().clone();

    crate::ai::agent::agent_run_stream(app_state, config, secrets, request, dek, on_event).await
}

#[tauri::command]
pub fn get_vault_ui_state() -> Result<crate::prefs::VaultUiState, String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    crate::prefs::load_ui_state(&data_dir)
}

#[tauri::command]
pub fn save_vault_ui_state(state: crate::prefs::VaultUiState) -> Result<(), String> {
    let data_dir = db::data_dir().map_err(|e| e.to_string())?;
    crate::prefs::save_ui_state(&data_dir, &state)
}

