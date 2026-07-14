mod assets;

mod backup;

mod commands;

mod crypto;

mod db;

mod documents;

mod export;

mod requirements;

mod launch_records;

mod journal;

mod credentials;

pub mod mcp;

mod link_index;

mod search_index;

mod text_util;

mod vault;

mod vault_lock;

mod ai;

mod cc_workbench;

mod prefs;

mod revisions;



use std::sync::{Arc, Mutex};



use documents::DocumentService;

use mcp::McpBridge;

use thiserror::Error;

use vault::VaultService;

use vault_lock::VaultLockGuard;



#[derive(Debug, Error)]

pub enum AppError {

    #[error("data directory unavailable")]

    DataDirUnavailable,

    #[error("document not found: {0}")]

    DocumentNotFound(String),

    #[error("需求不存在")]

    RequirementNotFound(String),

    #[error("{0}")]

    RequirementValidation(String),

    #[error("上线记录不存在")]

    LaunchRecordNotFound(String),

    #[error("{0}")]

    LaunchRecordValidation(String),

    #[error("小记不存在")]

    JournalNotFound(String),

    #[error("{0}")]

    JournalValidation(String),

    #[error("凭据不存在")]

    CredentialNotFound(String),

    #[error("{0}")]

    CredentialValidation(String),

    #[error("invalid asset id: {0}")]

    InvalidAssetId(String),

    #[error("asset not found: {0}")]

    AssetNotFound(String),

    #[error("VAULT_LOCKED")]

    VaultLocked,

    #[error(transparent)]

    Io(#[from] std::io::Error),

    #[error(transparent)]

    Sqlite(#[from] rusqlite::Error),

    #[error(transparent)]

    Crypto(#[from] crypto::CryptoError),

}



impl From<AppError> for vault::VaultError {

    fn from(value: AppError) -> Self {

        match value {

            AppError::VaultLocked => vault::VaultError::Locked,

            AppError::Io(e) => vault::VaultError::Io(e),

            AppError::Sqlite(e) => vault::VaultError::Sqlite(e),

            AppError::Crypto(e) => vault::VaultError::Crypto(e),

            _ => vault::VaultError::InvalidData,

        }

    }

}



pub struct AppState {

    pub document_service: Mutex<DocumentService>,

    pub vault_service: Mutex<VaultService>,

}



pub fn sync_document_connection(

    document_service: &mut DocumentService,

    vault_service: &VaultService,

) -> Result<(), AppError> {

    let initialized = vault_service.is_vault_initialized();

    if !initialized {

        document_service.set_vault_state(false, false);

        document_service.connect_plaintext()?;

        return Ok(());

    }



    let meta = vault_service.load_meta().map_err(|_| AppError::VaultLocked)?;

    document_service.set_vault_state(true, meta.encryption_enabled);



    if meta.encryption_enabled {

        if let Some(dek) = vault_service.session_dek() {

            document_service.connect_encrypted(&dek)?;

        } else {

            document_service.disconnect();

        }

    } else {

        document_service.connect_plaintext()?;

    }

    Ok(())

}



pub fn data_dir() -> Result<std::path::PathBuf, AppError> {
    db::data_dir()
}



pub fn init_app_state() -> Result<AppState, AppError> {

    let data_dir = db::data_dir()?;

    db::init(&data_dir)?;



    let mut vault_service = VaultService::new(data_dir.clone());

    let mut document_service = DocumentService::new(data_dir);



    if vault_service.is_vault_initialized() {

        let _ = vault_service.try_auto_unlock();

    }



    sync_document_connection(&mut document_service, &vault_service)?;



    Ok(AppState {

        document_service: Mutex::new(document_service),

        vault_service: Mutex::new(vault_service),

    })

}



#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {

    let data_dir = data_dir().unwrap_or_else(|e| {
        eprintln!("failed to resolve lizhi-kb data directory: {e}");
        std::process::exit(1);
    });

    let vault_lock = std::sync::Mutex::new(Some(
        VaultLockGuard::acquire(&data_dir, "app").unwrap_or_else(|_| {
            eprintln!("无法启动狸知：lizhi-mcpd Sidecar 正在独占知识库，请先关闭 Sidecar。");
            std::process::exit(1);
        }),
    ));

    let app_state = Arc::new(init_app_state().unwrap_or_else(|e| {
        eprintln!("failed to initialize lizhi-kb backend: {e}");
        std::process::exit(1);
    }));

    let mcp_bridge = McpBridge::new(app_state.clone()).unwrap_or_else(|e| {
        eprintln!("failed to initialize MCP bridge: {e}");
        std::process::exit(1);
    });

    if let Err(e) = mcp_bridge.start_if_needed() {

        eprintln!("MCP bridge start skipped: {e}");

    }



    tauri::Builder::default()

        .plugin(tauri_plugin_opener::init())

        .plugin(tauri_plugin_dialog::init())

        .plugin(tauri_plugin_process::init())

        .manage(vault_lock)

        .manage(app_state)

        .manage(mcp_bridge)

        .setup(|app| {
            cc_workbench::paths::init_bridge_script(app.handle());
            cc_workbench::skill_market::init_skill_market(app.handle());
            cc_workbench::agent_market::init_agent_market(app.handle());
            Ok(())
        })

        .invoke_handler(tauri::generate_handler![

            commands::list_documents,

            commands::create_document,

            commands::read_document,

            commands::read_all_documents,

            commands::save_document,

            commands::rename_document,

            commands::delete_document,

            commands::move_document,

            commands::migrate_documents_folder,

            commands::get_edit_activity,

            commands::get_dashboard_stats,

            commands::save_asset,

            commands::list_assets,
            commands::delete_asset,

            commands::get_asset_path,

            commands::read_asset_bytes,

            commands::rebuild_search_index,

            commands::search_documents,

            commands::get_link_index_snapshot,

            commands::get_backlinks,

            commands::get_unlinked_mentions,

            commands::get_outbound_link_titles,

            commands::get_link_stats,

            commands::get_local_graph,

            commands::create_vault,

            commands::unlock_vault,

            commands::lock_vault,

            commands::get_vault_status,

            commands::enable_encryption,

            commands::set_lock_on_startup,

            commands::export_vault,

            commands::validate_vault_backup,

            commands::import_vault,

            commands::export_markdown_folder,
            commands::export_obsidian_vault,
            commands::write_export_file,
            commands::write_export_binary,
            commands::read_text_file,
            commands::unlock_vault_with_recovery,

            commands::reset_password_with_recovery,

            commands::list_requirements,

            commands::create_requirement,

            commands::update_requirement,

            commands::delete_requirement,

            commands::reorder_requirements,

            commands::list_launch_records,

            commands::create_launch_record,

            commands::update_launch_record,

            commands::delete_launch_record,

            commands::list_journal_entries,

            commands::create_journal_entry,

            commands::update_journal_entry,

            commands::delete_journal_entry,

            commands::list_credential_entries,

            commands::get_credential_entry,

            commands::create_credential_entry,

            commands::update_credential_entry,

            commands::delete_credential_entry,

            commands::get_mcp_config,

            commands::get_mcp_adapter_path,

            commands::set_mcp_config,

            commands::regenerate_mcp_token,

            commands::get_ai_config,

            commands::set_ai_config,

            commands::test_ai_connection,

            commands::ai_chat_stream,

            commands::ai_rag_query,

            commands::ai_agent_run,

            commands::get_cc_workbench_status,

            commands::get_cc_workbench_config,

            commands::set_cc_workbench_config,

            commands::upsert_cc_provider,

            commands::delete_cc_provider,

            commands::switch_cc_provider,

            commands::list_cc_skills,

            commands::list_cc_skill_market,

            commands::preview_cc_switch_import,

            commands::save_cc_switch_import,

            commands::sort_cc_providers,

            commands::preview_claude_local_settings,

            commands::toggle_cc_skill,

            commands::import_cc_skills,

            commands::preview_cc_skills_import,

            commands::delete_cc_skill,

            commands::open_cc_skill,

            commands::list_cc_mcp_servers,

            commands::upsert_cc_mcp_server,

            commands::delete_cc_mcp_server,

            commands::toggle_cc_mcp_server,

            commands::get_cc_mcp_server_status,

            commands::copy_cc_mcp_server_config,

            commands::install_cc_sdk,

            commands::list_cc_agents,
            commands::save_cc_agent,
            commands::delete_cc_agent,
            commands::import_cc_agents,
            commands::export_cc_agents,
            commands::preview_cc_agents_import,
            commands::list_cc_agent_market,

            commands::get_cc_claude_md,
            commands::save_cc_claude_md,
            commands::get_cc_hooks,
            commands::save_cc_hooks,

            commands::get_cc_claude_permissions,
            commands::save_cc_claude_permissions,

            commands::append_cc_usage_entry,
            commands::get_cc_usage_stats,

            commands::fetch_cc_market_catalog,

            commands::cc_workbench_git_status,
            commands::cc_workbench_git_file_diff,
            commands::cc_workbench_git_diff,
            commands::cc_workbench_git_undo_edits,

            commands::list_cc_prompts,
            commands::save_cc_prompt,
            commands::delete_cc_prompt,
            commands::import_cc_prompts,
            commands::export_cc_prompts,
            commands::preview_cc_prompts_import,

            commands::list_cc_slash_commands,

            commands::list_cc_context_files,

            commands::cc_workbench_enhance_prompt,

            commands::cc_workbench_test_model,

            commands::cc_workbench_send,
            commands::cc_workbench_abort,
            commands::cc_workbench_tool_permission_response,

            commands::get_vault_ui_state,

            commands::save_vault_ui_state,

            commands::list_document_revisions,
            commands::read_document_revision,

        ])

        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            eprintln!("error while running tauri application: {e}");
            std::process::exit(1);
        });

}


