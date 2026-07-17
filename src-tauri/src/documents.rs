use chrono::{Datelike, Duration, Local, NaiveDate};
use rayon::prelude::*;
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use uuid::Uuid;

use crate::crypto::{decrypt, encrypt, DEK_LEN, NONCE_LEN};
use crate::db;
use crate::link_index::{self, GraphPayload, LinkMention};
use crate::search_index;
use crate::vault::VaultError;
use crate::text_util::{extract_h1_title, replace_wiki_link_title};
use crate::AppError;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentMeta {
    pub id: String,
    pub title: String,
    pub path: String,
    pub folder: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub ai_exclude: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct DecryptedContent {
    pub id: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveResult {
    pub id: String,
    pub saved_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameResult {
    pub id: String,
    pub title: String,
    pub propagated_doc_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConvertMentionResult {
    pub id: String,
    pub saved_at: i64,
    pub replaced_count: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EditActivityDay {
    pub date: String,
    pub edit_count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardStats {
    pub total_docs: i64,
    pub total_words: i64,
    pub edits_this_week: i64,
    pub last_edit_date: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub id: String,
    pub title: String,
    pub snippet: String,
    pub match_in: String,
    pub score: i32,
}

pub struct DocumentService {
    conn: Option<Connection>,
    data_dir: PathBuf,
    vault_initialized: bool,
    encryption_enabled: bool,
}

/// 可跨线程克隆的读盘上下文（路径 + 解密参数），用于 rayon 并行读文档
#[derive(Clone)]
struct DocReadContext {
    data_dir: PathBuf,
    encryption_enabled: bool,
    dek: Option<[u8; DEK_LEN]>,
}

impl DocReadContext {
    fn from_service(service: &DocumentService, dek: Option<&[u8; DEK_LEN]>) -> Self {
        Self {
            data_dir: service.data_dir.clone(),
            encryption_enabled: service.encryption_enabled,
            dek: dek.copied(),
        }
    }

    fn document_dir(&self, folder: &str) -> PathBuf {
        if folder.is_empty() {
            db::workspace_dir(&self.data_dir)
        } else {
            db::workspace_dir(&self.data_dir).join(folder)
        }
    }

    fn absolute_path(&self, folder: &str, id: &str) -> PathBuf {
        if self.encryption_enabled {
            self.document_dir(folder).join(format!("{id}.md.enc"))
        } else {
            self.plaintext_path(folder, id)
        }
    }

    fn plaintext_path(&self, folder: &str, id: &str) -> PathBuf {
        self.document_dir(folder).join(format!("{id}.md"))
    }

    fn read_content(&self, folder: &str, id: &str) -> Result<String, AppError> {
        if self.encryption_enabled {
            let dek = self.dek.as_ref().ok_or(AppError::VaultLocked)?;
            let path = self.absolute_path(folder, id);
            let bytes = read_encrypted_file(&path, dek)?;
            String::from_utf8(bytes).map_err(|_| AppError::InvalidAssetId("invalid utf8".into()))
        } else {
            Ok(fs::read_to_string(self.plaintext_path(folder, id))?)
        }
    }

    fn read_content_cross_format(&self, folder: &str, id: &str) -> Result<String, AppError> {
        let enc_path = self.document_dir(folder).join(format!("{id}.md.enc"));
        let plain_path = self.plaintext_path(folder, id);

        if self.encryption_enabled {
            if let Some(dek) = self.dek.as_ref() {
                if enc_path.is_file() {
                    let bytes = read_encrypted_file(&enc_path, dek)?;
                    return String::from_utf8(bytes)
                        .map_err(|_| AppError::InvalidAssetId("invalid utf8".into()));
                }
            }
            if plain_path.is_file() {
                return Ok(fs::read_to_string(plain_path)?);
            }
        } else {
            if plain_path.is_file() {
                return Ok(fs::read_to_string(plain_path)?);
            }
            if let Some(dek) = self.dek.as_ref() {
                if enc_path.is_file() {
                    let bytes = read_encrypted_file(&enc_path, dek)?;
                    return String::from_utf8(bytes)
                        .map_err(|_| AppError::InvalidAssetId("invalid utf8".into()));
                }
            }
        }
        Err(AppError::Io(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "document file missing",
        )))
    }

    fn write_content(&self, folder: &str, id: &str, content: &str) -> Result<(), AppError> {
        if self.encryption_enabled {
            let dek = self.dek.as_ref().ok_or(AppError::VaultLocked)?;
            write_encrypted_file(&self.absolute_path(folder, id), dek, content.as_bytes())?;
        } else {
            fs::write(self.plaintext_path(folder, id), content)?;
        }
        Ok(())
    }

    fn read_content_resilient(&self, primary_folder: &str, id: &str) -> Result<String, AppError> {
        let mut last_err: Option<AppError> = None;
        for folder in folder_read_candidates(primary_folder) {
            match self.read_content(&folder, id) {
                Ok(content) => return Ok(content),
                Err(AppError::VaultLocked) => return Err(AppError::VaultLocked),
                Err(AppError::Crypto(e)) => return Err(AppError::Crypto(e)),
                Err(e) => last_err = Some(e),
            }
            if let Ok(content) = self.read_content_cross_format(&folder, id) {
                return Ok(content);
            }
        }

        if matches!(
            last_err.as_ref(),
            Some(AppError::Io(e)) if e.kind() == std::io::ErrorKind::NotFound
        ) {
            self.write_content(primary_folder, id, "")?;
            return Ok(String::new());
        }

        Err(last_err.unwrap_or_else(|| AppError::DocumentNotFound(id.to_string())))
    }
}

impl DocumentService {
    pub fn new(data_dir: PathBuf) -> Self {
        Self {
            conn: None,
            data_dir,
            vault_initialized: false,
            encryption_enabled: false,
        }
    }

    pub fn data_dir(&self) -> &Path {
        &self.data_dir
    }

    pub fn is_connected(&self) -> bool {
        self.conn.is_some()
    }

    pub fn set_vault_state(&mut self, vault_initialized: bool, encryption_enabled: bool) {
        self.vault_initialized = vault_initialized;
        self.encryption_enabled = encryption_enabled;
    }

    pub fn connect_plaintext(&mut self) -> Result<(), AppError> {
        self.conn = Some(db::open_plaintext_connection(&self.data_dir)?);
        Ok(())
    }

    pub fn connect_encrypted(&mut self, dek: &[u8; DEK_LEN]) -> Result<(), AppError> {
        self.conn = Some(db::open_vault_connection(&self.data_dir, dek)?);
        Ok(())
    }

    pub fn disconnect(&mut self) {
        self.conn = None;
    }

    pub(crate) fn conn(&self) -> Result<&Connection, AppError> {
        if self.vault_initialized && self.encryption_enabled && self.conn.is_none() {
            return Err(AppError::VaultLocked);
        }
        self.conn
            .as_ref()
            .ok_or(AppError::VaultLocked)
    }

    pub(crate) fn conn_mut(&mut self) -> Result<&mut Connection, AppError> {
        if self.vault_initialized && self.encryption_enabled && self.conn.is_none() {
            return Err(AppError::VaultLocked);
        }
        self.conn
            .as_mut()
            .ok_or(AppError::VaultLocked)
    }

    pub fn list_documents(&self) -> Result<Vec<DocumentMeta>, AppError> {
        let mut stmt = self.conn()?.prepare(
            "SELECT id, title, path, folder, created_at, updated_at, ai_exclude FROM documents ORDER BY updated_at DESC",
        )?;

        let rows = stmt.query_map([], map_document_meta)?;

        rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
    }

    pub fn list_folders(&self) -> Result<Vec<String>, AppError> {
        let docs = self.list_documents()?;
        let mut folders: Vec<String> = docs
            .into_iter()
            .map(|d| d.folder)
            .filter(|f| !f.is_empty())
            .collect();
        folders.sort();
        folders.dedup();
        Ok(folders)
    }

    pub fn create_document(
        &mut self,
        title: String,
        folder: Option<String>,
        dek: Option<&[u8; DEK_LEN]>,
    ) -> Result<DocumentMeta, AppError> {
        let id = Uuid::new_v4().to_string();
        // 规范化并注册侧栏树（与 MCP/前端 slug 规则对齐），避免文档落入「收件箱」
        let folder = {
            let raw = folder.unwrap_or_else(|| "inbox".to_string());
            match crate::prefs::ensure_folder_path(&self.data_dir, &raw) {
                Ok((normalized, _)) => normalized,
                Err(e) => {
                    eprintln!("[lizhi] ensure_folder_path before create failed ({raw}): {e}");
                    crate::prefs::normalize_folder_id(&raw)
                }
            }
        };
        let path = relative_path(&folder, &id, self.encryption_enabled);
        let now = now_millis();

        fs::create_dir_all(self.document_dir(&folder))?;
        self.write_content(&folder, &id, "", dek)?;

        self.conn()?.execute(
            "INSERT INTO documents (id, title, path, folder, created_at, updated_at, word_count)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0)",
            params![id, title, path, folder, now, now],
        )?;

        let meta = DocumentMeta {
            id: id.clone(),
            title: title.clone(),
            path,
            folder: folder.clone(),
            created_at: now,
            updated_at: now,
            ai_exclude: false,
        };

        self.index_document(&meta.id, &meta.title, "", &[])?;

        Ok(meta)
    }

    pub fn read_document(
        &self,
        id: &str,
        dek: Option<&[u8; DEK_LEN]>,
    ) -> Result<DecryptedContent, AppError> {
        let (folder, _path) = self.get_document_location(id)?;
        let content = self.read_content_resilient(&folder, id, dek)?;
        Ok(DecryptedContent {
            id: id.to_string(),
            content,
        })
    }

    /// 单次批量读取全部文档正文（减少 IPC 往返；并行读盘/解密）
    pub fn read_all_documents(
        &self,
        dek: Option<&[u8; DEK_LEN]>,
    ) -> Result<Vec<DecryptedContent>, AppError> {
        let metas = self.list_documents()?;
        let ctx = DocReadContext::from_service(self, dek);
        metas
            .into_par_iter()
            .map(|meta| {
                let content = ctx.read_content_resilient(&meta.folder, &meta.id)?;
                Ok(DecryptedContent {
                    id: meta.id,
                    content,
                })
            })
            .collect()
    }

    pub fn ensure_indexes_fresh(&self, dek: Option<&[u8; DEK_LEN]>) -> Result<(), AppError> {
        let conn = self.conn()?;
        if search_index::needs_rebuild(conn)? || link_index::needs_rebuild(conn)? {
            self.rebuild_indexes(dek)?;
        }
        Ok(())
    }

    pub fn rebuild_indexes(&self, dek: Option<&[u8; DEK_LEN]>) -> Result<(), AppError> {
        {
            let conn = self.conn()?;
            search_index::rebuild_fts_table(conn)?;
        }
        let metas = self.list_documents()?;
        let title_map = link_index::build_title_map(&metas);
        for meta in &metas {
            let content = self.read_document(&meta.id, dek)?.content;
            let conn = self.conn()?;
            search_index::upsert_document(conn, &meta.id, &meta.title, &content)?;
            link_index::index_links_and_unlinked(
                conn,
                &meta.id,
                &content,
                &meta.title,
                &title_map,
                &metas,
            )?;
        }
        search_index::mark_rebuild_complete(self.conn()?)?;
        Ok(())
    }

    fn index_document(
        &self,
        id: &str,
        title: &str,
        content: &str,
        metas: &[DocumentMeta],
    ) -> Result<(), AppError> {
        let conn = self.conn()?;
        search_index::upsert_document(conn, id, title, content)?;
        let all_metas = if metas.is_empty() {
            self.list_documents()?
        } else {
            metas.to_vec()
        };
        let title_map = link_index::build_title_map(&all_metas);
        link_index::index_links_and_unlinked(conn, id, content, title, &title_map, &all_metas)
    }

    /// FTS5 全文检索
    pub fn search_documents(
        &self,
        query: &str,
        limit: usize,
        dek: Option<&[u8; DEK_LEN]>,
    ) -> Result<Vec<SearchHit>, AppError> {
        self.ensure_indexes_fresh(dek)?;
        search_index::search(self.conn()?, query, limit)
    }

    pub fn get_backlinks(&self, id: &str, dek: Option<&[u8; DEK_LEN]>) -> Result<Vec<LinkMention>, AppError> {
        self.ensure_indexes_fresh(dek)?;
        link_index::get_backlinks(self.conn()?, id)
    }

    pub fn get_unlinked_mentions(
        &self,
        id: &str,
        dek: Option<&[u8; DEK_LEN]>,
    ) -> Result<Vec<LinkMention>, AppError> {
        self.ensure_indexes_fresh(dek)?;
        link_index::get_unlinked_mentions(self.conn()?, id)
    }

    pub fn get_outbound_links(
        &self,
        id: &str,
        dek: Option<&[u8; DEK_LEN]>,
    ) -> Result<Vec<LinkMention>, AppError> {
        self.ensure_indexes_fresh(dek)?;
        link_index::get_outbound_links(self.conn()?, id)
    }

    pub fn get_link_stats(
        &self,
        dek: Option<&[u8; DEK_LEN]>,
    ) -> Result<link_index::LinkStats, AppError> {
        self.ensure_indexes_fresh(dek)?;
        let metas = self.list_documents()?;
        link_index::get_link_stats(self.conn()?, &metas)
    }

    pub fn get_outbound_titles(
        &self,
        id: &str,
        dek: Option<&[u8; DEK_LEN]>,
    ) -> Result<Vec<String>, AppError> {
        self.ensure_indexes_fresh(dek)?;
        link_index::get_outbound_titles(self.conn()?, id)
    }

    pub fn get_link_index_snapshot(
        &self,
        dek: Option<&[u8; DEK_LEN]>,
    ) -> Result<link_index::LinkIndexSnapshot, AppError> {
        self.ensure_indexes_fresh(dek)?;
        let metas = self.list_documents()?;
        link_index::build_link_index_snapshot(self.conn()?, &metas)
    }

    pub fn read_documents_batch(
        &self,
        ids: Option<Vec<String>>,
        dek: Option<&[u8; DEK_LEN]>,
    ) -> Result<Vec<DecryptedContent>, AppError> {
        let metas = self.list_documents()?;
        let target_ids: Vec<String> = match ids {
            Some(list) if !list.is_empty() => list,
            _ => metas.into_iter().map(|m| m.id).collect(),
        };
        target_ids
            .into_iter()
            .map(|id| self.read_document(&id, dek))
            .collect()
    }

    pub fn get_local_graph(
        &self,
        center_id: &str,
        depth: u32,
        dek: Option<&[u8; DEK_LEN]>,
    ) -> Result<GraphPayload, AppError> {
        self.ensure_indexes_fresh(dek)?;
        let depth = depth.clamp(1, 3);
        let metas = self.list_documents()?;
        link_index::get_local_graph(self.conn()?, &metas, center_id, depth)
    }

    pub fn save_document(
        &mut self,
        id: &str,
        content: &str,
        dek: Option<&[u8; DEK_LEN]>,
    ) -> Result<SaveResult, AppError> {
        // 库标题与正文 H1 独立；MCP 可通过 sync_title_from_h1 显式同步
        self.save_document_with_options(id, content, dek, false)
    }

    pub fn save_document_with_options(
        &mut self,
        id: &str,
        content: &str,
        dek: Option<&[u8; DEK_LEN]>,
        sync_title_from_h1: bool,
    ) -> Result<SaveResult, AppError> {
        let (folder, _path) = self.get_document_location(id)?;
        let now = now_millis();

        self.write_content(&folder, id, content, dek)?;
        let words = count_words(content);

        let mut title = self.get_document_meta(id)?.title;
        if sync_title_from_h1 {
            if let Some(h1) = extract_h1_title(content) {
                title = h1;
            }
        }

        let updated = self.conn_mut()?.execute(
            "UPDATE documents SET title = ?1, updated_at = ?2, word_count = ?3 WHERE id = ?4",
            params![title, now, words, id],
        )?;

        if updated == 0 {
            return Err(AppError::DocumentNotFound(id.to_string()));
        }

        self.increment_edit_activity_today()?;
        self.index_document(id, &title, content, &[])?;

        let data_dir = self.data_dir.clone();
        let encryption_enabled = dek.is_some();
        let _ = crate::revisions::save_revision(
            &data_dir,
            id,
            content,
            encryption_enabled,
            dek,
        );

        Ok(SaveResult {
            id: id.to_string(),
            saved_at: now,
        })
    }

    /// Rename a document and refresh only its search/link index rows.
    /// Does **not** rebuild the full-library FTS/link indexes (that was the title-save lag).
    pub fn rename_document(
        &mut self,
        id: &str,
        title: &str,
        dek: Option<&[u8; DEK_LEN]>,
    ) -> Result<(), AppError> {
        let now = now_millis();
        let updated = self.conn_mut()?.execute(
            "UPDATE documents SET title = ?1, updated_at = ?2 WHERE id = ?3",
            params![title, now, id],
        )?;

        if updated == 0 {
            return Err(AppError::DocumentNotFound(id.to_string()));
        }

        // Keep inbound wiki-link rows' display title in sync (queries join id, but
        // outbound title lists still read target_title).
        {
            let conn = self.conn()?;
            let _ = link_index::update_inbound_link_titles(conn, id, title);
        }

        let content = self
            .read_document(id, dek)
            .map(|d| d.content)
            .unwrap_or_default();
        self.index_document(id, title, &content, &[])?;

        Ok(())
    }

    pub fn rename_document_with_propagation(
        &mut self,
        id: &str,
        new_title: &str,
        propagate_wiki_links: bool,
        dek: Option<&[u8; DEK_LEN]>,
    ) -> Result<RenameResult, AppError> {
        let old_meta = self.get_document_meta(id)?;
        let old_title = old_meta.title.clone();
        if old_title == new_title {
            return Ok(RenameResult {
                id: id.to_string(),
                title: new_title.to_string(),
                propagated_doc_ids: Vec::new(),
            });
        }

        self.rename_document(id, new_title, dek)?;

        let mut propagated = Vec::new();
        if propagate_wiki_links {
            for meta in self.list_documents()? {
                if meta.id == id {
                    continue;
                }
                let content = self.read_document(&meta.id, dek)?.content;
                let updated = replace_wiki_link_title(&content, &old_title, new_title);
                if updated != content {
                    self.save_document_with_options(&meta.id, &updated, dek, false)?;
                    propagated.push(meta.id);
                }
            }
        }

        Ok(RenameResult {
            id: id.to_string(),
            title: new_title.to_string(),
            propagated_doc_ids: propagated,
        })
    }

    pub fn convert_unlinked_mention(
        &mut self,
        source_id: &str,
        target_title: &str,
        dek: Option<&[u8; DEK_LEN]>,
    ) -> Result<ConvertMentionResult, AppError> {
        let content = self.read_document(source_id, dek)?.content;
        let escaped = regex::escape(target_title.trim());
        let pattern = format!(r"(?<!\[\[){escaped}(?!\]\])");
        let re = regex::Regex::new(&pattern)
            .map_err(|e| AppError::CredentialValidation(format!("正则错误: {e}")))?;
        let mut replaced_count = 0u32;
        let updated = re
            .replace_all(&content, |_caps: &regex::Captures| {
                replaced_count += 1;
                format!("[[{target_title}]]")
            })
            .to_string();

        if updated == content || replaced_count == 0 {
            return Err(AppError::CredentialValidation(
                "未找到可转换的纯文本提及".into(),
            ));
        }

        let result = self.save_document_with_options(source_id, &updated, dek, false)?;
        Ok(ConvertMentionResult {
            id: result.id,
            saved_at: result.saved_at,
            replaced_count,
        })
    }

    pub fn delete_document(&mut self, id: &str) -> Result<(), AppError> {
        let (folder, _path) = self.get_document_location(id)?;
        let file_path = self.absolute_path(&folder, id);

        if let Ok(conn) = self.conn() {
            search_index::remove_document(conn, id)?;
            link_index::remove_links_for_document(conn, id)?;
        }

        self.conn_mut()?
            .execute("DELETE FROM documents WHERE id = ?1", params![id])?;

        if file_path.exists() {
            fs::remove_file(file_path)?;
        }

        Ok(())
    }

    pub fn move_document(
        &mut self,
        id: &str,
        folder: String,
        _dek: Option<&[u8; DEK_LEN]>,
    ) -> Result<DocumentMeta, AppError> {
        let folder = match crate::prefs::ensure_folder_path(&self.data_dir, &folder) {
            Ok((normalized, _)) => normalized,
            Err(e) => {
                eprintln!("[lizhi] ensure_folder_path before move failed ({folder}): {e}");
                crate::prefs::normalize_folder_id(&folder)
            }
        };

        let (old_folder, _old_path) = self.get_document_location(id)?;
        if old_folder == folder {
            return self.get_document_meta(id);
        }

        fs::create_dir_all(self.document_dir(&folder))?;

        let src = self.absolute_path(&old_folder, id);
        let dst = self.absolute_path(&folder, id);
        if src.exists() {
            if dst.exists() {
                fs::remove_file(&dst)?;
            }
            fs::rename(&src, &dst)?;
        }

        let path = relative_path(&folder, id, self.encryption_enabled);
        let now = now_millis();

        let updated = self.conn_mut()?.execute(
            "UPDATE documents SET folder = ?1, path = ?2, updated_at = ?3 WHERE id = ?4",
            params![folder, path, now, id],
        )?;

        if updated == 0 {
            return Err(AppError::DocumentNotFound(id.to_string()));
        }

        self.get_document_meta(id)
    }

    pub fn migrate_documents_folder(
        &mut self,
        old_prefix: &str,
        new_prefix: &str,
        dek: Option<&[u8; DEK_LEN]>,
    ) -> Result<Vec<DocumentMeta>, AppError> {
        let like_pattern = format!("{old_prefix}/%");
        let moves: Vec<(String, String)> = {
            let mut stmt = self.conn()?.prepare(
                "SELECT id, folder FROM documents
                 WHERE folder = ?1 OR folder LIKE ?2
                 ORDER BY LENGTH(folder), folder, id",
            )?;
            let rows = stmt
                .query_map(params![old_prefix, like_pattern], |row| {
                    let id: String = row.get(0)?;
                    let old_folder: String = row.get(1)?;
                    Ok((id, remap_folder_prefix(&old_folder, old_prefix, new_prefix)))
                })?
                .collect::<Result<Vec<_>, _>>()?;
            rows
        };

        let mut results = Vec::with_capacity(moves.len());
        for (id, new_folder) in moves {
            results.push(self.move_document(&id, new_folder, dek)?);
        }
        Ok(results)
    }

    pub fn get_edit_activity(&self, days: u32) -> Result<Vec<EditActivityDay>, AppError> {
        let days = days.max(1) as i64;
        let today = Local::now().date_naive();
        let start = today - Duration::days(days - 1);

        let mut stmt = self.conn()?.prepare(
            "SELECT date, edit_count FROM edit_activity WHERE date >= ?1 AND date <= ?2",
        )?;

        let mut counts: std::collections::HashMap<String, i64> = stmt
            .query_map(params![format_date(start), format_date(today)], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
            })?
            .collect::<Result<Vec<_>, _>>()?
            .into_iter()
            .collect();

        let mut result = Vec::with_capacity(days as usize);
        let mut cursor = start;
        while cursor <= today {
            let key = format_date(cursor);
            let edit_count = counts.remove(&key).unwrap_or(0);
            result.push(EditActivityDay { date: key, edit_count });
            cursor += Duration::days(1);
        }

        Ok(result)
    }

    pub fn get_dashboard_stats(
        &self,
        dek: Option<&[u8; DEK_LEN]>,
    ) -> Result<DashboardStats, AppError> {
        let total_docs: i64 = self
            .conn()?
            .query_row("SELECT COUNT(*) FROM documents", [], |row| row.get(0))?;

        let mut total_words: i64 = self
            .conn()?
            .query_row(
                "SELECT COALESCE(SUM(word_count), 0) FROM documents",
                [],
                |row| row.get(0),
            )?;

        if total_words == 0 && total_docs > 0 {
            total_words = self.backfill_word_counts(dek)?;
        }
        let edits_this_week = self.count_edits_this_week()?;
        let last_edit_date = self.last_edit_date()?;

        Ok(DashboardStats {
            total_docs,
            total_words,
            edits_this_week,
            last_edit_date,
        })
    }

    pub fn migrate_to_encrypted(&mut self, dek: &[u8; DEK_LEN]) -> Result<(), VaultError> {
        let rows: Vec<(String, String, String)> = {
            let conn = self.conn.as_ref().ok_or(VaultError::Locked)?;
            let mut stmt = conn.prepare("SELECT id, folder, path FROM documents")?;
            let mapped = stmt.query_map([], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?))
            })?;
            mapped.collect::<Result<Vec<_>, _>>()?
        };

        for (id, folder, _old_path) in rows {
            let plain_path = self.plaintext_path(&folder, &id);
            if plain_path.is_file() {
                let content = fs::read_to_string(&plain_path)?;
                self.write_content(&folder, &id, &content, Some(dek))
                    .map_err(VaultError::from)?;
                fs::remove_file(plain_path)?;
            }
            let new_path = relative_path(&folder, &id, true);
            if let Some(conn) = self.conn.as_mut() {
                conn.execute(
                    "UPDATE documents SET path = ?1 WHERE id = ?2",
                    params![new_path, id],
                )?;
            }
        }

        // Release lizhi-kb.db before migration — Windows cannot delete/replace while open (os error 32).
        self.conn = None;
        migrate_plaintext_db_to_vault(&self.data_dir, dek)?;
        self.encryption_enabled = true;
        self.conn = Some(db::open_vault_connection(&self.data_dir, dek)?);
        Ok(())
    }

    fn get_document_location(&self, id: &str) -> Result<(String, String), AppError> {
        self.conn()?
            .query_row(
                "SELECT folder, path FROM documents WHERE id = ?1",
                params![id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?
            .ok_or_else(|| AppError::DocumentNotFound(id.to_string()))
    }

    fn get_document_meta(&self, id: &str) -> Result<DocumentMeta, AppError> {
        self.conn()?
            .query_row(
                "SELECT id, title, path, folder, created_at, updated_at, ai_exclude FROM documents WHERE id = ?1",
                params![id],
                map_document_meta,
            )
            .optional()?
            .ok_or_else(|| AppError::DocumentNotFound(id.to_string()))
    }

    pub fn set_document_ai_exclude(
        &mut self,
        id: &str,
        exclude: bool,
    ) -> Result<DocumentMeta, AppError> {
        let flag = i32::from(exclude);
        let updated = self.conn_mut()?.execute(
            "UPDATE documents SET ai_exclude = ?1 WHERE id = ?2",
            params![flag, id],
        )?;
        if updated == 0 {
            return Err(AppError::DocumentNotFound(id.to_string()));
        }
        self.get_document_meta(id)
    }

    pub fn read_document_for_ai(
        &self,
        id: &str,
        dek: Option<&[u8; DEK_LEN]>,
    ) -> Result<DecryptedContent, AppError> {
        let meta = self.get_document_meta(id)?;
        if meta.ai_exclude {
            return Err(AppError::AiExclude);
        }
        let content = self.read_content_resilient(&meta.folder, id, dek)?;
        Ok(DecryptedContent {
            id: id.to_string(),
            content: crate::ai_privacy::sanitize_for_ai(&content),
        })
    }

    pub fn search_documents_for_ai(
        &self,
        query: &str,
        limit: usize,
        dek: Option<&[u8; DEK_LEN]>,
    ) -> Result<Vec<SearchHit>, AppError> {
        let metas = self.list_documents()?;
        let hits = self.search_documents(query, limit, dek)?;
        Ok(crate::ai_privacy::filter_search_hits_for_ai(&metas, hits))
    }

    fn document_dir(&self, folder: &str) -> PathBuf {
        if folder.is_empty() {
            db::workspace_dir(&self.data_dir)
        } else {
            db::workspace_dir(&self.data_dir).join(folder)
        }
    }

    fn absolute_path(&self, folder: &str, id: &str) -> PathBuf {
        if self.encryption_enabled {
            self.document_dir(folder).join(format!("{id}.md.enc"))
        } else {
            self.plaintext_path(folder, id)
        }
    }

    fn plaintext_path(&self, folder: &str, id: &str) -> PathBuf {
        self.document_dir(folder).join(format!("{id}.md"))
    }

    fn read_content(
        &self,
        folder: &str,
        id: &str,
        dek: Option<&[u8; DEK_LEN]>,
    ) -> Result<String, AppError> {
        if self.encryption_enabled {
            let dek = dek.ok_or(AppError::VaultLocked)?;
            let path = self.absolute_path(folder, id);
            let bytes = read_encrypted_file(&path, dek)?;
            String::from_utf8(bytes).map_err(|_| AppError::InvalidAssetId("invalid utf8".into()))
        } else {
            Ok(fs::read_to_string(self.plaintext_path(folder, id))?)
        }
    }

    /// 尝试多个 folder 路径；正文文件缺失时自动重建空文件（索引存在但文件丢失）
    fn read_content_resilient(
        &self,
        primary_folder: &str,
        id: &str,
        dek: Option<&[u8; DEK_LEN]>,
    ) -> Result<String, AppError> {
        let mut last_err: Option<AppError> = None;
        for folder in folder_read_candidates(primary_folder) {
            match self.read_content(&folder, id, dek) {
                Ok(content) => return Ok(content),
                Err(AppError::VaultLocked) => return Err(AppError::VaultLocked),
                Err(AppError::Crypto(e)) => return Err(AppError::Crypto(e)),
                Err(e) => last_err = Some(e),
            }
            if let Ok(content) = self.read_content_cross_format(&folder, id, dek) {
                return Ok(content);
            }
        }

        if matches!(
            last_err.as_ref(),
            Some(AppError::Io(e)) if e.kind() == std::io::ErrorKind::NotFound
        ) {
            self.write_content(primary_folder, id, "", dek)?;
            return Ok(String::new());
        }

        Err(last_err.unwrap_or_else(|| AppError::DocumentNotFound(id.to_string())))
    }

    /// 加密/明文扩展名不一致时的兼容读取（迁移或历史数据）
    fn read_content_cross_format(
        &self,
        folder: &str,
        id: &str,
        dek: Option<&[u8; DEK_LEN]>,
    ) -> Result<String, AppError> {
        let enc_path = self.document_dir(folder).join(format!("{id}.md.enc"));
        let plain_path = self.plaintext_path(folder, id);

        if self.encryption_enabled {
            if let Some(dek) = dek {
                if enc_path.is_file() {
                    let bytes = read_encrypted_file(&enc_path, dek)?;
                    return String::from_utf8(bytes)
                        .map_err(|_| AppError::InvalidAssetId("invalid utf8".into()));
                }
            }
            if plain_path.is_file() {
                return Ok(fs::read_to_string(plain_path)?);
            }
        } else {
            if plain_path.is_file() {
                return Ok(fs::read_to_string(plain_path)?);
            }
            if let Some(dek) = dek {
                if enc_path.is_file() {
                    let bytes = read_encrypted_file(&enc_path, dek)?;
                    return String::from_utf8(bytes)
                        .map_err(|_| AppError::InvalidAssetId("invalid utf8".into()));
                }
            }
        }
        Err(AppError::Io(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "document file missing",
        )))
    }

    fn write_content(
        &self,
        folder: &str,
        id: &str,
        content: &str,
        dek: Option<&[u8; DEK_LEN]>,
    ) -> Result<(), AppError> {
        if self.encryption_enabled {
            let dek = dek.ok_or(AppError::VaultLocked)?;
            write_encrypted_file(&self.absolute_path(folder, id), dek, content.as_bytes())?;
        } else {
            fs::write(self.plaintext_path(folder, id), content)?;
        }
        Ok(())
    }

    fn increment_edit_activity_today(&mut self) -> Result<(), AppError> {
        let today = format_date(Local::now().date_naive());
        self.conn_mut()?.execute(
            "INSERT INTO edit_activity (date, edit_count) VALUES (?1, 1)
             ON CONFLICT(date) DO UPDATE SET edit_count = edit_count + 1",
            params![today],
        )?;
        Ok(())
    }

    fn backfill_word_counts(&self, dek: Option<&[u8; DEK_LEN]>) -> Result<i64, AppError> {
        let mut stmt = self.conn()?.prepare("SELECT folder, id FROM documents")?;
        let rows: Vec<(String, String)> = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
            .collect::<Result<Vec<_>, _>>()?;

        let ctx = DocReadContext::from_service(self, dek);
        let counted: Vec<(String, i64)> = rows
            .par_iter()
            .filter_map(|(folder, id)| {
                ctx.read_content(folder, id)
                    .ok()
                    .map(|content| (id.clone(), count_words(&content)))
            })
            .collect();

        let conn = self.conn()?;
        let mut total = 0i64;
        for (id, words) in counted {
            total += words;
            conn.execute(
                "UPDATE documents SET word_count = ?1 WHERE id = ?2",
                params![words, id],
            )?;
        }
        Ok(total)
    }

    fn count_edits_this_week(&self) -> Result<i64, AppError> {
        let today = Local::now().date_naive();
        let week_start = today - Duration::days(6);
        self.conn()?.query_row(
            "SELECT COALESCE(SUM(edit_count), 0) FROM edit_activity
             WHERE date >= ?1 AND date <= ?2",
            params![format_date(week_start), format_date(today)],
            |row| row.get(0),
        )
        .map_err(AppError::from)
    }

    fn last_edit_date(&self) -> Result<Option<String>, AppError> {
        self.conn()?
            .query_row(
                "SELECT date FROM edit_activity WHERE edit_count > 0
                 ORDER BY date DESC LIMIT 1",
                [],
                |row| row.get(0),
            )
            .optional()
            .map_err(AppError::from)
    }

    /// Verify a candidate DEK during recovery-phrase import (vault may be locked).
    pub fn verify_dek_for_recovery(&self, dek: &[u8; DEK_LEN]) -> Result<(), VaultError> {
        if !self.encryption_enabled {
            return Err(VaultError::InvalidData);
        }

        let conn = db::open_vault_connection(&self.data_dir, dek).map_err(|_| VaultError::InvalidData)?;

        let sample: Option<(String, String)> = conn
            .query_row(
                "SELECT folder, id FROM documents LIMIT 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()
            .map_err(|_| VaultError::InvalidData)?;

        if let Some((folder, id)) = sample {
            let path = self.absolute_path(&folder, &id);
            if path.extension().and_then(|s| s.to_str()) == Some("enc") {
                read_encrypted_file(&path, dek).map_err(|_| VaultError::InvalidData)?;
            }
        }

        Ok(())
    }
}

fn write_encrypted_file(path: &Path, dek: &[u8; DEK_LEN], plaintext: &[u8]) -> Result<(), AppError> {
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

fn read_encrypted_file(path: &Path, dek: &[u8; DEK_LEN]) -> Result<Vec<u8>, AppError> {
    let data = fs::read(path)?;
    if data.len() < NONCE_LEN {
        return Err(AppError::InvalidAssetId("corrupt document".into()));
    }
    let mut nonce = [0u8; NONCE_LEN];
    nonce.copy_from_slice(&data[..NONCE_LEN]);
    decrypt(dek, &nonce, &data[NONCE_LEN..]).map_err(AppError::Crypto)
}

fn migrate_plaintext_db_to_vault(data_dir: &Path, dek: &[u8; DEK_LEN]) -> Result<(), VaultError> {
    let plain_path = db::db_path(data_dir);
    if !plain_path.is_file() {
        db::open_vault_connection(data_dir, dek)?;
        return Ok(());
    }

    let src = db::open_plaintext_connection(data_dir).map_err(VaultError::from)?;
    let dst_path = db::vault_db_path(data_dir);
    if dst_path.exists() {
        fs::remove_file(&dst_path)?;
    }
    let dst = db::open_vault_connection(data_dir, dek)?;
    copy_table(&src, &dst, "documents")?;
    copy_table(&src, &dst, "edit_activity")?;
    copy_table(&src, &dst, "requirements")?;
    copy_table(&src, &dst, "journal_entries")?;
    copy_table(&src, &dst, "credential_entries")?;
    copy_table(&src, &dst, "launch_records")?;
    copy_table(&src, &dst, "mubu_docs")?;
    copy_table(&src, &dst, "mubu_nodes")?;
    drop(src);
    drop(dst);
    fs::remove_file(plain_path)?;
    Ok(())
}

fn copy_table(src: &Connection, dst: &Connection, table: &str) -> Result<(), VaultError> {
    let sql = format!("SELECT * FROM {table}");
    let mut stmt = src.prepare(&sql)?;
    let col_count = stmt.column_count();
    let col_names: Vec<String> = (0..col_count)
        .map(|i| stmt.column_name(i).unwrap_or("").to_string())
        .collect();

    let placeholders: String = (1..=col_count).map(|i| format!("?{i}")).collect::<Vec<_>>().join(", ");
    let insert_sql = format!(
        "INSERT INTO {table} ({}) VALUES ({placeholders})",
        col_names.join(", ")
    );

    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        let values: Vec<rusqlite::types::Value> = (0..col_count)
            .map(|i| row.get(i))
            .collect::<Result<Vec<_>, _>>()?;
        let params: Vec<&dyn rusqlite::ToSql> = values.iter().map(|v| v as &dyn rusqlite::ToSql).collect();
        dst.execute(&insert_sql, params.as_slice())?;
    }
    Ok(())
}

fn folder_read_candidates(primary: &str) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for candidate in [primary, "inbox", ""] {
        if !out.iter().any(|f| f == candidate) {
            out.push(candidate.to_string());
        }
    }
    out
}

fn remap_folder_prefix(folder: &str, old_prefix: &str, new_prefix: &str) -> String {
    if folder == old_prefix {
        new_prefix.to_string()
    } else {
        let suffix = &folder[old_prefix.len()..];
        format!("{new_prefix}{suffix}")
    }
}

fn relative_path(folder: &str, id: &str, encrypted: bool) -> String {
    let ext = if encrypted { "md.enc" } else { "md" };
    if folder.is_empty() {
        format!("{id}.{ext}")
    } else {
        format!("{folder}/{id}.{ext}")
    }
}

fn format_date(date: NaiveDate) -> String {
    format!("{:04}-{:02}-{:02}", date.year(), date.month(), date.day())
}

fn now_millis() -> i64 {
    Local::now().timestamp_millis()
}

fn map_document_meta(row: &rusqlite::Row<'_>) -> rusqlite::Result<DocumentMeta> {
    Ok(DocumentMeta {
        id: row.get(0)?,
        title: row.get(1)?,
        path: row.get(2)?,
        folder: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
        ai_exclude: row.get::<_, i32>(6)? != 0,
    })
}

fn count_words(content: &str) -> i64 {
    content
        .split_whitespace()
        .filter(|word| !word.is_empty())
        .count() as i64
}
