use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use tiny_http::{Header, Request, Response, StatusCode};

use crate::documents::{DecryptedContent, DocumentMeta, RenameResult, SaveResult, SearchHit};
use crate::link_index::{LinkIndexSnapshot, LinkStats};
use crate::assets;
use crate::prefs;
use crate::vault::VaultStatus;

use super::auth;
use super::config::McpConfig;
use super::runtime::McpRequestSettings;
use crate::AppState;

type McpHttpError = (StatusCode, &'static str, String);
type VaultAssetContext = (std::path::PathBuf, bool, Option<[u8; 32]>);
type McpHttpResponse = Response<std::io::Cursor<Vec<u8>>>;

#[derive(Debug, Serialize)]
struct ErrorBody {
    error: &'static str,
    message: String,
}

fn error_response(status: StatusCode, error: &'static str, message: String) -> Response<std::io::Cursor<Vec<u8>>> {
    json_response(status, &ErrorBody { error, message })
}

#[derive(Debug, Deserialize)]
struct SearchBody {
    query: String,
    #[serde(default = "default_search_limit")]
    limit: usize,
}

fn default_search_limit() -> usize {
    20
}

#[derive(Debug, Deserialize)]
struct CreateDocumentBody {
    title: String,
    #[serde(default)]
    folder: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SaveDocumentBody {
    content: String,
    #[serde(default = "default_true")]
    sync_title_from_h1: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Deserialize)]
struct BatchReadBody {
    #[serde(default)]
    ids: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct RenameBody {
    title: String,
    #[serde(default = "default_true")]
    propagate_wiki_links: bool,
}

#[derive(Debug, Deserialize)]
struct MoveBody {
    folder: String,
}

#[derive(Debug, Deserialize)]
struct TagsBody {
    tags: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct ConvertMentionBody {
    target_title: String,
}

#[derive(Debug, Deserialize)]
struct MigrateFolderBody {
    old_prefix: String,
    new_prefix: String,
}

#[derive(Debug, Deserialize)]
struct EnsureFolderBody {
    /// 文件夹路径；可省略 `projects/` 前缀（将自动挂到知识库下）
    #[serde(alias = "folder")]
    path: String,
}

#[derive(Debug, Deserialize)]
struct DeleteFolderBody {
    /// 文件夹路径；可省略 `projects/` 前缀
    #[serde(alias = "folder")]
    path: String,
    /// 目录内文档迁往何处；默认上级目录（无上级则 inbox）
    #[serde(default)]
    move_documents_to: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SaveAssetBody {
    data_base64: String,
    extension: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AssetPayload {
    id: String,
    mime_type: String,
    data_base64: String,
    size: usize,
}

fn parse_asset_id(path: &str) -> Result<String, (StatusCode, &'static str, String)> {
    let prefix = "/assets/";
    if !path.starts_with(prefix) {
        return Err((StatusCode(400), "BAD_REQUEST", "无效资产路径".into()));
    }
    let id = path.trim_start_matches(prefix).trim_end_matches('/');
    if id.is_empty() || id.contains('/') {
        return Err((StatusCode(400), "BAD_REQUEST", "无效资产 id".into()));
    }
    Ok(id.to_string())
}

fn vault_asset_context(
    app_state: &AppState,
) -> Result<VaultAssetContext, McpHttpError> {
    let data_dir = crate::db::data_dir().map_err(map_data_dir_error)?;
    let vault = app_state
        .vault_service
        .lock()
        .map_err(|_| {
            (
                StatusCode(500),
                "INTERNAL_ERROR",
                "vault service lock poisoned".into(),
            )
        })?;
    let initialized = vault.is_vault_initialized();
    let encryption_enabled = if initialized {
        vault
            .load_meta()
            .map(|m| m.encryption_enabled)
            .unwrap_or(false)
    } else {
        false
    };
    let dek = vault.session_dek();
    Ok((data_dir, initialized && encryption_enabled, dek))
}

fn parse_document_id(path: &str, suffix: &str) -> Result<String, (StatusCode, &'static str, String)> {
    let prefix = "/documents/";
    if !path.starts_with(prefix) {
        return Err((StatusCode(400), "BAD_REQUEST", "无效文档路径".into()));
    }
    let rest = path.trim_start_matches(prefix).trim_end_matches('/');
    let id = if suffix.is_empty() {
        if rest.contains('/') {
            return Err((StatusCode(404), "NOT_FOUND", "未知路径".into()));
        }
        rest.to_string()
    } else {
        let marker = format!("/{suffix}");
        if !rest.ends_with(&marker) {
            return Err((StatusCode(404), "NOT_FOUND", "未知路径".into()));
        }
        rest.strip_suffix(&marker)
            .unwrap_or("")
            .trim_end_matches('/')
            .to_string()
    };
    if id.is_empty() {
        return Err((StatusCode(400), "BAD_REQUEST", "缺少文档 id".into()));
    }
    Ok(id)
}

fn doc_service_lock(
    app_state: &AppState,
) -> Result<std::sync::MutexGuard<'_, crate::documents::DocumentService>, (StatusCode, &'static str, String)>
{
    app_state
        .document_service
        .lock()
        .map_err(|_| {
            (
                StatusCode(500),
                "INTERNAL_ERROR",
                "document service lock poisoned".into(),
            )
        })
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct StatusResponse {
    mode: &'static str,
    mcp_enabled: bool,
    write_enabled: bool,
    vault: VaultStatus,
}

pub fn handle_bridge_request(
    request: Request,
    app_state: Arc<AppState>,
    config: Arc<Mutex<McpConfig>>,
) {
    let settings = match config.lock() {
        Ok(cfg) => McpRequestSettings {
            app_state,
            token: cfg.token.clone(),
            write_enabled: cfg.write_enabled,
            bridge_enabled: cfg.enabled,
        },
        Err(_) => {
            let response = error_response(
                StatusCode(500),
                "INTERNAL_ERROR",
                "config lock poisoned".into(),
            );
            let _ = request.respond(response);
            return;
        }
    };
    handle_request(request, settings);
}

pub fn handle_request(mut request: Request, settings: McpRequestSettings) {
    let method = request.method().clone();
    let url = request.url().to_string();
    let path = url.split('?').next().unwrap_or(&url).to_string();

    let response = match dispatch(&method, &path, &url, &mut request, &settings) {
        Ok(resp) => resp,
        Err((status, error, message)) => error_response(status, error, message),
    };

    let _ = request.respond(response);
}

fn dispatch(
    method: &tiny_http::Method,
    path: &str,
    url: &str,
    request: &mut Request,
    settings: &McpRequestSettings,
) -> Result<McpHttpResponse, McpHttpError> {
    if !settings.bridge_enabled {
        return Err((
            StatusCode(503),
            "MCP_DISABLED",
            "MCP 桥接未启用，请在设置中开启".into(),
        ));
    }

    auth::validate_token(request, &settings.token).map_err(|code| {
        (
            StatusCode(401),
            code,
            "缺少或无效的 Bearer token".into(),
        )
    })?;

    let app_state = &settings.app_state;
    let vault_status = app_state
        .vault_service
        .lock()
        .map_err(|_| {
            (
                StatusCode(500),
                "INTERNAL_ERROR",
                "vault service lock poisoned".into(),
            )
        })?
        .get_status();

    if vault_status.encryption_enabled && vault_status.is_locked {
        return Err((
            StatusCode(403),
            "VAULT_LOCKED",
            "知识库已锁定，请先解锁".into(),
        ));
    }

    let dek = app_state
        .vault_service
        .lock()
        .map_err(|_| {
            (
                StatusCode(500),
                "INTERNAL_ERROR",
                "vault service lock poisoned".into(),
            )
        })?
        .session_dek();

    match (method.as_str(), path) {
        ("GET", "/status") => {
            let body = StatusResponse {
                mode: "bridge",
                mcp_enabled: settings.bridge_enabled,
                write_enabled: settings.write_enabled,
                vault: vault_status,
            };
            Ok(json_response(StatusCode(200), &body))
        }
        ("GET", "/documents") => {
            let docs = app_state
                .document_service
                .lock()
                .map_err(|_| {
                    (
                        StatusCode(500),
                        "INTERNAL_ERROR",
                        "document service lock poisoned".into(),
                    )
                })?
                .list_documents()
                .map_err(map_app_error)?;
            Ok(json_response(StatusCode(200), &docs))
        }
        ("GET", "/folders") => {
            let folders = doc_service_lock(app_state)?
                .list_folders()
                .map_err(map_app_error)?;
            Ok(json_response(StatusCode(200), &folders))
        }
        ("GET", "/folder-tree") => {
            let data_dir = crate::db::data_dir().map_err(map_data_dir_error)?;
            let tree = prefs::get_folder_tree(&data_dir).map_err(map_string_error)?;
            Ok(json_response(StatusCode(200), &tree))
        }
        ("GET", "/tags") => {
            let data_dir = crate::db::data_dir().map_err(map_data_dir_error)?;
            let tags = prefs::list_all_tags(&data_dir).map_err(map_string_error)?;
            Ok(json_response(StatusCode(200), &tags))
        }
        ("GET", "/links/stats") => {
            let stats = doc_service_lock(app_state)?
                .get_link_stats(dek.as_ref())
                .map_err(map_app_error)?;
            Ok(json_response(StatusCode(200), &stats))
        }
        ("GET", "/links/snapshot") => {
            let snapshot = doc_service_lock(app_state)?
                .get_link_index_snapshot(dek.as_ref())
                .map_err(map_app_error)?;
            Ok(json_response(StatusCode(200), &snapshot))
        }
        ("GET", "/stats/dashboard") => {
            let stats = doc_service_lock(app_state)?
                .get_dashboard_stats(dek.as_ref())
                .map_err(map_app_error)?;
            Ok(json_response(StatusCode(200), &stats))
        }
        ("GET", "/stats/edit-activity") => {
            let days = parse_query_u32(url, "days").unwrap_or(365).clamp(1, 3660);
            let activity = doc_service_lock(app_state)?
                .get_edit_activity(days)
                .map_err(map_app_error)?;
            Ok(json_response(StatusCode(200), &activity))
        }
        ("GET", path) if path.starts_with("/graph/") => {
            let id = path.trim_start_matches("/graph/").to_string();
            if id.is_empty() {
                return Err((StatusCode(400), "BAD_REQUEST", "缺少文档 id".into()));
            }
            let depth = parse_query_u32(url, "depth").unwrap_or(2).clamp(1, 3);
            let graph = app_state
                .document_service
                .lock()
                .map_err(|_| {
                    (
                        StatusCode(500),
                        "INTERNAL_ERROR",
                        "document service lock poisoned".into(),
                    )
                })?
                .get_local_graph(&id, depth, dek.as_ref())
                .map_err(map_app_error)?;
            Ok(json_response(StatusCode(200), &graph))
        }
        ("GET", path) if path.starts_with("/documents/") && path.ends_with("/backlinks") => {
            let id = parse_document_id(path, "backlinks")?;
            let backlinks = doc_service_lock(app_state)?
                .get_backlinks(&id, dek.as_ref())
                .map_err(map_app_error)?;
            Ok(json_response(StatusCode(200), &backlinks))
        }
        ("GET", path) if path.starts_with("/documents/") && path.ends_with("/unlinked-mentions") => {
            let id = parse_document_id(path, "unlinked-mentions")?;
            let mentions = doc_service_lock(app_state)?
                .get_unlinked_mentions(&id, dek.as_ref())
                .map_err(map_app_error)?;
            Ok(json_response(StatusCode(200), &mentions))
        }
        ("GET", path) if path.starts_with("/documents/") && path.ends_with("/outbound-links") => {
            let id = parse_document_id(path, "outbound-links")?;
            let links = doc_service_lock(app_state)?
                .get_outbound_links(&id, dek.as_ref())
                .map_err(map_app_error)?;
            Ok(json_response(StatusCode(200), &links))
        }
        ("GET", path) if path.starts_with("/documents/") && path.ends_with("/tags") => {
            let id = parse_document_id(path, "tags")?;
            let data_dir = crate::db::data_dir().map_err(map_data_dir_error)?;
            let tags = prefs::get_document_tags(&data_dir, &id).map_err(map_string_error)?;
            Ok(json_response(StatusCode(200), &tags))
        }
        ("GET", path) if path.starts_with("/documents/") => {
            let id = parse_document_id(path, "")?;
            let doc = doc_service_lock(app_state)?
                .read_document(&id, dek.as_ref())
                .map_err(map_app_error)?;
            Ok(json_response(StatusCode(200), &doc))
        }
        ("POST", "/search") => {
            let body: SearchBody = read_json_body(request)?;
            let hits = app_state
                .document_service
                .lock()
                .map_err(|_| {
                    (
                        StatusCode(500),
                        "INTERNAL_ERROR",
                        "document service lock poisoned".into(),
                    )
                })?
                .search_documents(&body.query, body.limit.min(100), dek.as_ref())
                .map_err(map_app_error)?;
            Ok(json_response(StatusCode(200), &hits))
        }
        ("POST", "/assets") => {
            ensure_write_enabled(settings)?;
            use base64::{engine::general_purpose::STANDARD, Engine as _};
            let body: SaveAssetBody = read_json_body(request)?;
            let bytes = STANDARD
                .decode(body.data_base64.as_bytes())
                .map_err(|e| (StatusCode(400), "BAD_REQUEST", format!("Base64 解码失败: {e}")))?;
            let (data_dir, encryption_enabled, dek) = vault_asset_context(app_state)?;
            let id = assets::save_asset(
                &data_dir,
                bytes,
                &body.extension,
                encryption_enabled,
                dek.as_ref(),
            )
            .map_err(map_app_error)?;
            Ok(json_response(
                StatusCode(201),
                &serde_json::json!({
                    "id": id,
                    "mimeType": assets::mime_for_asset_id(&id),
                }),
            ))
        }
        ("GET", path) if path.starts_with("/assets/") => {
            use base64::{engine::general_purpose::STANDARD, Engine as _};
            let id = parse_asset_id(path)?;
            let (data_dir, encryption_enabled, dek) = vault_asset_context(app_state)?;
            let bytes = assets::read_asset_bytes(
                &data_dir,
                &id,
                encryption_enabled,
                dek.as_ref(),
            )
            .map_err(map_app_error)?;
            let payload = AssetPayload {
                id: id.clone(),
                mime_type: assets::mime_for_asset_id(&id).to_string(),
                data_base64: STANDARD.encode(&bytes),
                size: bytes.len(),
            };
            Ok(json_response(StatusCode(200), &payload))
        }
        ("POST", "/documents/batch-read") => {
            let body: BatchReadBody = read_json_body(request)?;
            let docs = doc_service_lock(app_state)?
                .read_documents_batch(body.ids, dek.as_ref())
                .map_err(map_app_error)?;
            Ok(json_response(StatusCode(200), &docs))
        }
        ("POST", "/documents") => {
            ensure_write_enabled(settings)?;
            let body: CreateDocumentBody = read_json_body(request)?;
            let data_dir = crate::db::data_dir().map_err(map_data_dir_error)?;
            let folder = body
                .folder
                .unwrap_or_else(|| "inbox".to_string());
            let (folder, _) =
                prefs::ensure_folder_path(&data_dir, &folder).map_err(map_string_error)?;
            let mut service = doc_service_lock(app_state)?;
            let doc = service
                .create_document(body.title, Some(folder), dek.as_ref())
                .map_err(map_app_error)?;
            Ok(json_response(StatusCode(201), &doc))
        }
        ("POST", path) if path.starts_with("/documents/") && path.ends_with("/convert-mention") => {
            ensure_write_enabled(settings)?;
            let id = parse_document_id(path, "convert-mention")?;
            let body: ConvertMentionBody = read_json_body(request)?;
            let mut service = doc_service_lock(app_state)?;
            let result = service
                .convert_unlinked_mention(&id, &body.target_title, dek.as_ref())
                .map_err(map_app_error)?;
            Ok(json_response(StatusCode(200), &result))
        }
        ("POST", "/folders/migrate") => {
            ensure_write_enabled(settings)?;
            let body: MigrateFolderBody = read_json_body(request)?;
            let data_dir = crate::db::data_dir().map_err(map_data_dir_error)?;
            let old_prefix = prefs::normalize_folder_id(&body.old_prefix);
            let new_prefix = prefs::normalize_folder_id(&body.new_prefix);
            let mut service = doc_service_lock(app_state)?;
            let migrated = service
                .migrate_documents_folder(&old_prefix, &new_prefix, dek.as_ref())
                .map_err(map_app_error)?;
            let tree = prefs::migrate_folder_prefix_in_tree(&data_dir, &old_prefix, &new_prefix)
                .map_err(map_string_error)?;
            Ok(json_response(
                StatusCode(200),
                &serde_json::json!({
                    "migratedCount": migrated.len(),
                    "documents": migrated,
                    "oldPrefix": old_prefix,
                    "newPrefix": new_prefix,
                    "tree": tree,
                }),
            ))
        }
        ("POST", "/folders/ensure") => {
            ensure_write_enabled(settings)?;
            let body: EnsureFolderBody = read_json_body(request)?;
            let data_dir = crate::db::data_dir().map_err(map_data_dir_error)?;
            let (folder, tree) =
                prefs::ensure_folder_path(&data_dir, &body.path).map_err(map_string_error)?;
            Ok(json_response(
                StatusCode(200),
                &serde_json::json!({ "folder": folder, "tree": tree }),
            ))
        }
        ("POST", "/folders/delete") => {
            ensure_write_enabled(settings)?;
            let body: DeleteFolderBody = read_json_body(request)?;
            let data_dir = crate::db::data_dir().map_err(map_data_dir_error)?;
            let folder = prefs::normalize_folder_id(&body.path);
            if folder == "inbox" || folder == "projects" {
                return Err((
                    StatusCode(400),
                    "BAD_REQUEST",
                    "不能删除系统根目录 inbox / projects".into(),
                ));
            }
            let dest = body
                .move_documents_to
                .as_deref()
                .map(prefs::normalize_folder_id)
                .or_else(|| prefs::parent_folder_id(&folder))
                .unwrap_or_else(|| "inbox".into());
            if dest == folder || dest.starts_with(&format!("{folder}/")) {
                return Err((
                    StatusCode(400),
                    "BAD_REQUEST",
                    "文档目标目录不能是待删目录自身或其子路径".into(),
                ));
            }
            prefs::ensure_folder_path(&data_dir, &dest).map_err(map_string_error)?;

            let mut service = doc_service_lock(app_state)?;
            let docs = service.list_documents().map_err(map_app_error)?;
            let prefix = format!("{folder}/");
            let mut moved = Vec::new();
            for doc in docs {
                if doc.folder == folder || doc.folder.starts_with(&prefix) {
                    let meta = service
                        .move_document(&doc.id, dest.clone(), dek.as_ref())
                        .map_err(map_app_error)?;
                    moved.push(meta);
                }
            }

            let (folder, removed, _tree) =
                prefs::delete_folder_path(&data_dir, &folder).map_err(map_string_error)?;
            let mut pruned = Vec::new();
            if let Some(parent) = prefs::parent_folder_id(&folder) {
                pruned = prefs::prune_empty_folder_chain(&data_dir, &parent)
                    .map_err(map_string_error)?;
            }
            let tree = prefs::get_folder_tree(&data_dir).map_err(map_string_error)?;
            Ok(json_response(
                StatusCode(200),
                &serde_json::json!({
                    "folder": folder,
                    "removedFolderIds": removed,
                    "prunedEmptyAncestors": pruned,
                    "movedDocuments": moved,
                    "movedTo": dest,
                    "tree": tree,
                }),
            ))
        }
        ("PUT", path) if path.starts_with("/documents/") && path.ends_with("/tags") => {
            ensure_write_enabled(settings)?;
            let id = parse_document_id(path, "tags")?;
            let body: TagsBody = read_json_body(request)?;
            let data_dir = crate::db::data_dir().map_err(map_data_dir_error)?;
            let tags = prefs::set_document_tags(&data_dir, &id, &body.tags).map_err(map_string_error)?;
            Ok(json_response(StatusCode(200), &tags))
        }
        ("PUT", path) if path.starts_with("/documents/") => {
            ensure_write_enabled(settings)?;
            let id = parse_document_id(path, "")?;
            let body: SaveDocumentBody = read_json_body(request)?;
            let mut service = doc_service_lock(app_state)?;
            let result = service
                .save_document_with_options(
                    &id,
                    &body.content,
                    dek.as_ref(),
                    body.sync_title_from_h1,
                )
                .map_err(map_app_error)?;
            Ok(json_response(StatusCode(200), &result))
        }
        ("PATCH", path) if path.starts_with("/documents/") && path.ends_with("/rename") => {
            ensure_write_enabled(settings)?;
            let id = parse_document_id(path, "rename")?;
            let body: RenameBody = read_json_body(request)?;
            let mut service = doc_service_lock(app_state)?;
            let result = service
                .rename_document_with_propagation(
                    &id,
                    &body.title,
                    body.propagate_wiki_links,
                    dek.as_ref(),
                )
                .map_err(map_app_error)?;
            Ok(json_response(StatusCode(200), &result))
        }
        ("PATCH", path) if path.starts_with("/documents/") && path.ends_with("/move") => {
            ensure_write_enabled(settings)?;
            let id = parse_document_id(path, "move")?;
            let body: MoveBody = read_json_body(request)?;
            let data_dir = crate::db::data_dir().map_err(map_data_dir_error)?;
            let (folder, _) =
                prefs::ensure_folder_path(&data_dir, &body.folder).map_err(map_string_error)?;
            let mut service = doc_service_lock(app_state)?;
            let doc = service
                .move_document(&id, folder, dek.as_ref())
                .map_err(map_app_error)?;
            Ok(json_response(StatusCode(200), &doc))
        }
        ("DELETE", path) if path.starts_with("/documents/") => {
            ensure_write_enabled(settings)?;
            let id = parse_document_id(path, "")?;
            let mut service = doc_service_lock(app_state)?;
            service.delete_document(&id).map_err(map_app_error)?;
            Ok(json_response(StatusCode(200), &serde_json::json!({ "deleted": id })))
        }
        _ => Err((
            StatusCode(404),
            "NOT_FOUND",
            format!("未知路径: {method} {path}"),
        )),
    }
}

fn ensure_write_enabled(settings: &McpRequestSettings) -> Result<(), (StatusCode, &'static str, String)> {
    if settings.write_enabled {
        Ok(())
    } else {
        Err((
            StatusCode(403),
            "WRITE_DISABLED",
            "MCP 写入未启用，请在设置中开启".into(),
        ))
    }
}

fn read_json_body<T: for<'de> Deserialize<'de>>(
    request: &mut Request,
) -> Result<T, (StatusCode, &'static str, String)> {
    let mut body = Vec::new();
    let _ = request
        .as_reader()
        .read_to_end(&mut body)
        .map_err(|e| (StatusCode(400), "BAD_REQUEST", e.to_string()))?;
    serde_json::from_slice(&body)
        .map_err(|e| (StatusCode(400), "BAD_REQUEST", format!("JSON 解析失败: {e}")))
}

fn json_response<T: Serialize>(
    status: StatusCode,
    value: &T,
) -> Response<std::io::Cursor<Vec<u8>>> {
    let json = serde_json::to_vec(value).unwrap_or_else(|_| br#"{"error":"INTERNAL_ERROR"}"#.to_vec());
    let mut response = Response::from_data(json).with_status_code(status);
    response.add_header(
        Header::from_bytes(&b"Content-Type"[..], &b"application/json; charset=utf-8"[..])
            .expect("header"),
    );
    response
}

fn parse_query_u32(url: &str, key: &str) -> Option<u32> {
    let query = url.split('?').nth(1)?;
    for part in query.split('&') {
        let mut kv = part.splitn(2, '=');
        let k = kv.next()?;
        if k == key {
            return kv.next()?.parse().ok();
        }
    }
    None
}

fn map_data_dir_error(err: crate::AppError) -> (StatusCode, &'static str, String) {
    (
        StatusCode(500),
        "INTERNAL_ERROR",
        err.to_string(),
    )
}

fn map_string_error(err: String) -> (StatusCode, &'static str, String) {
    (StatusCode(500), "INTERNAL_ERROR", err)
}

fn map_app_error(err: crate::AppError) -> (StatusCode, &'static str, String) {
    match err {
        crate::AppError::VaultLocked => (
            StatusCode(403),
            "VAULT_LOCKED",
            "知识库已锁定".into(),
        ),
        crate::AppError::DocumentNotFound(id) => (
            StatusCode(404),
            "NOT_FOUND",
            format!("文档不存在: {id}"),
        ),
        crate::AppError::AssetNotFound(id) => (
            StatusCode(404),
            "NOT_FOUND",
            format!("资产不存在: {id}"),
        ),
        crate::AppError::InvalidAssetId(message) => (
            StatusCode(400),
            "BAD_REQUEST",
            message,
        ),
        crate::AppError::CredentialValidation(message) => (
            StatusCode(400),
            "BAD_REQUEST",
            message,
        ),
        other => (StatusCode(500), "INTERNAL_ERROR", other.to_string()),
    }
}

#[allow(dead_code)]
fn _type_refs() {
    let _: Option<DocumentMeta> = None;
    let _: Option<DecryptedContent> = None;
    let _: Option<SaveResult> = None;
    let _: Option<RenameResult> = None;
    let _: Option<LinkStats> = None;
    let _: Option<LinkIndexSnapshot> = None;
    let _: Option<SearchHit> = None;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_document_subpaths() {
        assert_eq!(
            parse_document_id("/documents/abc/backlinks", "backlinks").unwrap(),
            "abc"
        );
        assert_eq!(parse_document_id("/documents/abc", "").unwrap(), "abc");
        assert!(parse_document_id("/documents/abc/tags/extra", "tags").is_err());
    }

    #[test]
    fn parse_asset_path_id() {
        assert_eq!(
            parse_asset_id("/assets/abc-123.png").unwrap(),
            "abc-123.png"
        );
        assert!(parse_asset_id("/assets/").is_err());
    }
}
