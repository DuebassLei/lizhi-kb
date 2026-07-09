use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::{params, Connection, OptionalExtension};

use crate::crypto::{decrypt, encrypt, DEK_LEN, NONCE_LEN};
use crate::db;
use crate::vault::{mnemonic_to_dek, read_keys, VaultError, KEYS_FILENAME};

use super::archive::read_meta;

#[derive(Debug, Clone)]
struct DocRow {
    id: String,
    title: String,
    #[allow(dead_code)]
    path: String,
    folder: String,
    created_at: i64,
    updated_at: i64,
    word_count: i64,
}

pub struct MergeDocumentsStats {
    pub documents: u32,
    pub assets: u32,
}

pub fn merge_documents_from_staging(
    data_dir: &Path,
    staging: &Path,
    password: &str,
    recovery_phrase: Option<&str>,
) -> Result<MergeDocumentsStats, VaultError> {
    let backup_meta = read_meta(staging)?;
    let current_meta = read_meta(data_dir)?;

    let backup_dek = resolve_dek(staging, password, recovery_phrase)?;
    let current_dek = resolve_dek(data_dir, password, recovery_phrase)?;

    let backup_conn = open_db_at(staging, backup_meta.encryption_enabled, backup_dek.as_ref())?;
    let current_conn = open_db_at(data_dir, current_meta.encryption_enabled, current_dek.as_ref())?;

    let mut doc_merged = 0u32;
    for doc in list_documents(&backup_conn)? {
        let existing_updated = query_updated_at(&current_conn, &doc.id)?;
        let import = existing_updated.map(|t| doc.updated_at > t).unwrap_or(true);
        if !import {
            continue;
        }

        let content = read_workspace_content(
            staging,
            &doc.folder,
            &doc.id,
            backup_meta.encryption_enabled,
            backup_dek.as_ref(),
        )?;

        write_workspace_content(
            data_dir,
            &doc.folder,
            &doc.id,
            &content,
            current_meta.encryption_enabled,
            current_dek.as_ref(),
        )?;

        let path = relative_doc_path(&doc.folder, &doc.id, current_meta.encryption_enabled);
        upsert_document(&current_conn, &doc, &path)?;
        doc_merged += 1;
    }

    merge_requirements(&backup_conn, &current_conn)?;
    merge_journal_entries(&backup_conn, &current_conn)?;
    merge_edit_activity(&backup_conn, &current_conn)?;
    merge_credential_entries(&backup_conn, &current_conn)?;
    merge_launch_records(&backup_conn, &current_conn)?;
    invalidate_derived_indexes(&current_conn)?;

    let asset_merged = merge_assets(
        staging,
        data_dir,
        backup_meta.encryption_enabled,
        current_meta.encryption_enabled,
        backup_dek.as_ref(),
        current_dek.as_ref(),
    )?;

    Ok(MergeDocumentsStats {
        documents: doc_merged,
        assets: asset_merged,
    })
}

fn resolve_dek(
    data_dir: &Path,
    password: &str,
    recovery_phrase: Option<&str>,
) -> Result<Option<[u8; DEK_LEN]>, VaultError> {
    let meta = read_meta(data_dir)?;
    let keys = read_keys(&data_dir.join(KEYS_FILENAME))?;
    if !(meta.encryption_enabled || keys.encryption_enabled) {
        return Ok(None);
    }
    if !password.is_empty() {
        return Ok(Some(keys.unwrap_dek(password.as_bytes())?));
    }
    let phrase = recovery_phrase.ok_or(VaultError::Locked)?;
    Ok(Some(mnemonic_to_dek(phrase)?))
}

fn open_db_at(
    data_dir: &Path,
    encrypted: bool,
    dek: Option<&[u8; DEK_LEN]>,
) -> Result<Connection, VaultError> {
    if encrypted {
        let dek = dek.ok_or(VaultError::Locked)?;
        db::open_vault_connection(data_dir, dek).map_err(VaultError::from)
    } else {
        db::open_plaintext_connection(data_dir).map_err(VaultError::from)
    }
}

fn list_documents(conn: &Connection) -> Result<Vec<DocRow>, VaultError> {
    let mut stmt = conn.prepare(
        "SELECT id, title, path, folder, created_at, updated_at, COALESCE(word_count, 0)
         FROM documents",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(DocRow {
            id: row.get(0)?,
            title: row.get(1)?,
            path: row.get(2)?,
            folder: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
            word_count: row.get(6)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(VaultError::from)
}

fn query_updated_at(conn: &Connection, id: &str) -> Result<Option<i64>, VaultError> {
    conn.query_row(
        "SELECT updated_at FROM documents WHERE id = ?1",
        params![id],
        |row| row.get(0),
    )
    .optional()
    .map_err(VaultError::from)
}

fn upsert_document(conn: &Connection, doc: &DocRow, path: &str) -> Result<(), VaultError> {
    conn.execute(
        "INSERT INTO documents (id, title, path, folder, created_at, updated_at, word_count)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           path = excluded.path,
           folder = excluded.folder,
           created_at = excluded.created_at,
           updated_at = excluded.updated_at,
           word_count = excluded.word_count",
        params![
            doc.id,
            doc.title,
            path,
            doc.folder,
            doc.created_at,
            doc.updated_at,
            doc.word_count
        ],
    )?;
    Ok(())
}

fn merge_requirements(backup: &Connection, current: &Connection) -> Result<(), VaultError> {
    let mut stmt = backup.prepare(
        "SELECT id, number, content, status, priority, sort_order, created_at, updated_at, due_at,
         proposed_at, expected_launch_at, actual_launch_at,
         title, progress_description, remarks, requester, owner, source
         FROM requirements",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, Option<String>>(4)?,
            row.get::<_, i32>(5)?,
            row.get::<_, i64>(6)?,
            row.get::<_, i64>(7)?,
            row.get::<_, Option<i64>>(8)?,
            row.get::<_, Option<i64>>(9)?,
            row.get::<_, Option<i64>>(10)?,
            row.get::<_, Option<i64>>(11)?,
            row.get::<_, Option<String>>(12)?,
            row.get::<_, Option<String>>(13)?,
            row.get::<_, Option<String>>(14)?,
            row.get::<_, Option<String>>(15)?,
            row.get::<_, Option<String>>(16)?,
            row.get::<_, Option<String>>(17)?,
        ))
    })?;

    for row in rows {
        let r = row?;
        let existing: Option<i64> = current
            .query_row(
                "SELECT updated_at FROM requirements WHERE id = ?1",
                params![r.0],
                |row| row.get(0),
            )
            .optional()?;
        if existing.map(|t| r.7 > t).unwrap_or(true) {
            current.execute(
                "INSERT INTO requirements (id, number, content, status, priority, sort_order,
                 created_at, updated_at, due_at, proposed_at, expected_launch_at, actual_launch_at,
                 title, progress_description, remarks, requester, owner, source)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18)
                 ON CONFLICT(id) DO UPDATE SET
                   number=excluded.number, content=excluded.content, status=excluded.status,
                   priority=excluded.priority, sort_order=excluded.sort_order,
                   created_at=excluded.created_at, updated_at=excluded.updated_at,
                   due_at=excluded.due_at, proposed_at=excluded.proposed_at,
                   expected_launch_at=excluded.expected_launch_at, actual_launch_at=excluded.actual_launch_at,
                   title=excluded.title, progress_description=excluded.progress_description,
                   remarks=excluded.remarks, requester=excluded.requester, owner=excluded.owner,
                   source=excluded.source",
                params![r.0, r.1, r.2, r.3, r.4, r.5, r.6, r.7, r.8, r.9, r.10, r.11, r.12, r.13, r.14, r.15, r.16, r.17],
            )?;
        }
    }
    Ok(())
}

fn merge_journal_entries(backup: &Connection, current: &Connection) -> Result<(), VaultError> {
    let mut stmt = backup.prepare(
        "SELECT id, day_date, content, created_at, updated_at FROM journal_entries",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, i64>(3)?,
            row.get::<_, i64>(4)?,
        ))
    })?;

    for row in rows {
        let r = row?;
        let existing: Option<i64> = current
            .query_row(
                "SELECT updated_at FROM journal_entries WHERE id = ?1",
                params![r.0],
                |row| row.get(0),
            )
            .optional()?;
        if existing.map(|t| r.4 > t).unwrap_or(true) {
            current.execute(
                "INSERT INTO journal_entries (id, day_date, content, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(id) DO UPDATE SET
                   day_date=excluded.day_date, content=excluded.content,
                   created_at=excluded.created_at, updated_at=excluded.updated_at",
                params![r.0, r.1, r.2, r.3, r.4],
            )?;
        }
    }
    Ok(())
}

fn table_exists(conn: &Connection, name: &str) -> Result<bool, VaultError> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
        params![name],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}

fn merge_credential_entries(backup: &Connection, current: &Connection) -> Result<(), VaultError> {
    if !table_exists(backup, "credential_entries")? {
        return Ok(());
    }
    let mut stmt = backup.prepare(
        "SELECT id, title, category, environment, username, password, url, notes,
         is_favorite, sort_order, created_at, updated_at
         FROM credential_entries",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, String>(5)?,
            row.get::<_, Option<String>>(6)?,
            row.get::<_, Option<String>>(7)?,
            row.get::<_, i32>(8)?,
            row.get::<_, i32>(9)?,
            row.get::<_, i64>(10)?,
            row.get::<_, i64>(11)?,
        ))
    })?;

    for row in rows {
        let r = row?;
        let existing: Option<i64> = current
            .query_row(
                "SELECT updated_at FROM credential_entries WHERE id = ?1",
                params![r.0],
                |row| row.get(0),
            )
            .optional()?;
        if existing.map(|t| r.11 > t).unwrap_or(true) {
            current.execute(
                "INSERT INTO credential_entries
                 (id, title, category, environment, username, password, url, notes,
                  is_favorite, sort_order, created_at, updated_at)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)
                 ON CONFLICT(id) DO UPDATE SET
                   title=excluded.title, category=excluded.category,
                   environment=excluded.environment, username=excluded.username,
                   password=excluded.password, url=excluded.url, notes=excluded.notes,
                   is_favorite=excluded.is_favorite, sort_order=excluded.sort_order,
                   created_at=excluded.created_at, updated_at=excluded.updated_at",
                params![r.0, r.1, r.2, r.3, r.4, r.5, r.6, r.7, r.8, r.9, r.10, r.11],
            )?;
        }
    }
    Ok(())
}

fn merge_launch_records(backup: &Connection, current: &Connection) -> Result<(), VaultError> {
    if !table_exists(backup, "launch_records")? {
        return Ok(());
    }
    let mut stmt = backup.prepare(
        "SELECT id, record_number, title, version, environment, status, risk_level,
         client_name, project_name, scheduled_at, launched_at, rolled_back_at,
         operator, owner, approver, change_summary, release_notes, rollback_reason,
         verification_status, verification_notes, linked_requirement_ids,
         linked_document_ids, tags, created_at, updated_at
         FROM launch_records",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, Option<String>>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, String>(5)?,
            row.get::<_, Option<String>>(6)?,
            row.get::<_, Option<String>>(7)?,
            row.get::<_, Option<String>>(8)?,
            row.get::<_, Option<i64>>(9)?,
            row.get::<_, Option<i64>>(10)?,
            row.get::<_, Option<i64>>(11)?,
            row.get::<_, Option<String>>(12)?,
            row.get::<_, Option<String>>(13)?,
            row.get::<_, Option<String>>(14)?,
            row.get::<_, Option<String>>(15)?,
            row.get::<_, Option<String>>(16)?,
            row.get::<_, Option<String>>(17)?,
            row.get::<_, Option<String>>(18)?,
            row.get::<_, Option<String>>(19)?,
            row.get::<_, Option<String>>(20)?,
            row.get::<_, Option<String>>(21)?,
            row.get::<_, Option<String>>(22)?,
            row.get::<_, i64>(23)?,
            row.get::<_, i64>(24)?,
        ))
    })?;

    for row in rows {
        let r = row?;
        let existing: Option<i64> = current
            .query_row(
                "SELECT updated_at FROM launch_records WHERE id = ?1",
                params![r.0],
                |row| row.get(0),
            )
            .optional()?;
        if !existing.map(|t| r.24 > t).unwrap_or(true) {
            continue;
        }
        let number_taken: Option<String> = current
            .query_row(
                "SELECT id FROM launch_records WHERE record_number = ?1 AND id != ?2",
                params![r.1, r.0],
                |row| row.get(0),
            )
            .optional()?;
        if number_taken.is_some() {
            continue;
        }
        current.execute(
            "INSERT INTO launch_records
             (id, record_number, title, version, environment, status, risk_level,
              client_name, project_name, scheduled_at, launched_at, rolled_back_at,
              operator, owner, approver, change_summary, release_notes, rollback_reason,
              verification_status, verification_notes, linked_requirement_ids,
              linked_document_ids, tags, created_at, updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24,?25)
             ON CONFLICT(id) DO UPDATE SET
               record_number=excluded.record_number, title=excluded.title,
               version=excluded.version, environment=excluded.environment,
               status=excluded.status, risk_level=excluded.risk_level,
               client_name=excluded.client_name, project_name=excluded.project_name,
               scheduled_at=excluded.scheduled_at, launched_at=excluded.launched_at,
               rolled_back_at=excluded.rolled_back_at, operator=excluded.operator,
               owner=excluded.owner, approver=excluded.approver,
               change_summary=excluded.change_summary, release_notes=excluded.release_notes,
               rollback_reason=excluded.rollback_reason,
               verification_status=excluded.verification_status,
               verification_notes=excluded.verification_notes,
               linked_requirement_ids=excluded.linked_requirement_ids,
               linked_document_ids=excluded.linked_document_ids,
               tags=excluded.tags,
               created_at=excluded.created_at, updated_at=excluded.updated_at",
            params![
                r.0, r.1, r.2, r.3, r.4, r.5, r.6, r.7, r.8, r.9, r.10, r.11, r.12, r.13, r.14,
                r.15, r.16, r.17, r.18, r.19, r.20, r.21, r.22, r.23, r.24
            ],
        )?;
    }
    Ok(())
}

fn merge_edit_activity(backup: &Connection, current: &Connection) -> Result<(), VaultError> {
    let mut stmt = backup.prepare("SELECT date, edit_count FROM edit_activity")?;
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
    })?;
    for row in rows {
        let (date, count) = row?;
        current.execute(
            "INSERT INTO edit_activity (date, edit_count) VALUES (?1, ?2)
             ON CONFLICT(date) DO UPDATE SET edit_count = edit_count + excluded.edit_count",
            params![date, count],
        )?;
    }
    Ok(())
}

fn invalidate_derived_indexes(conn: &Connection) -> Result<(), VaultError> {
    let _ = conn.execute("DELETE FROM document_links", []);
    let _ = conn.execute("DELETE FROM documents_fts", []);
    let _ = conn.execute("DELETE FROM search_index_meta", []);
    Ok(())
}

fn merge_assets(
    staging: &Path,
    data_dir: &Path,
    backup_enc: bool,
    current_enc: bool,
    backup_dek: Option<&[u8; DEK_LEN]>,
    current_dek: Option<&[u8; DEK_LEN]>,
) -> Result<u32, VaultError> {
    let src_dir = crate::assets::assets_dir(staging);
    let dst_dir = crate::assets::assets_dir(data_dir);
    if !src_dir.is_dir() {
        return Ok(0);
    }
    fs::create_dir_all(&dst_dir)?;

    let mut merged = 0u32;
    for entry in fs::read_dir(&src_dir)? {
        let entry = entry?;
        if !entry.file_type()?.is_file() {
            continue;
        }
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        let dst = dst_dir.join(&name);
        if dst.is_file() {
            continue;
        }

        let bytes = if backup_enc && name_str.ends_with(".enc") {
            let dek = backup_dek.ok_or(VaultError::Locked)?;
            read_encrypted_bytes(&entry.path(), dek)?
        } else {
            fs::read(entry.path())?
        };

        if current_enc {
            let dek = current_dek.ok_or(VaultError::Locked)?;
            let id = name_str.strip_suffix(".enc").unwrap_or(&name_str);
            let out = dst_dir.join(format!("{id}.enc"));
            write_encrypted_bytes(&out, dek, &bytes)?;
        } else {
            let out_name = name_str.strip_suffix(".enc").unwrap_or(&name_str);
            fs::write(dst_dir.join(out_name), bytes)?;
        }
        merged += 1;
    }
    Ok(merged)
}

fn read_workspace_content(
    data_dir: &Path,
    folder: &str,
    id: &str,
    encrypted: bool,
    dek: Option<&[u8; DEK_LEN]>,
) -> Result<String, VaultError> {
    for f in folder_candidates(folder) {
        let dir = workspace_folder(data_dir, &f);
        let enc = dir.join(format!("{id}.md.enc"));
        let plain = dir.join(format!("{id}.md"));
        if encrypted {
            if let Some(dek) = dek {
                if enc.is_file() {
                    let bytes = read_encrypted_bytes(&enc, dek)?;
                    return String::from_utf8(bytes).map_err(|_| VaultError::InvalidData);
                }
            }
        }
        if plain.is_file() {
            return fs::read_to_string(&plain).map_err(VaultError::from);
        }
    }
    Err(VaultError::NotFound)
}

fn write_workspace_content(
    data_dir: &Path,
    folder: &str,
    id: &str,
    content: &str,
    encrypted: bool,
    dek: Option<&[u8; DEK_LEN]>,
) -> Result<(), VaultError> {
    let dir = workspace_folder(data_dir, folder);
    fs::create_dir_all(&dir)?;
    if encrypted {
        let dek = dek.ok_or(VaultError::Locked)?;
        let path = dir.join(format!("{id}.md.enc"));
        write_encrypted_bytes(&path, dek, content.as_bytes())?;
        let plain = dir.join(format!("{id}.md"));
        if plain.is_file() {
            let _ = fs::remove_file(plain);
        }
    } else {
        fs::write(dir.join(format!("{id}.md")), content)?;
        let enc = dir.join(format!("{id}.md.enc"));
        if enc.is_file() {
            let _ = fs::remove_file(enc);
        }
    }
    Ok(())
}

fn workspace_folder(data_dir: &Path, folder: &str) -> PathBuf {
    let root = db::workspace_dir(data_dir);
    if folder.is_empty() {
        root
    } else {
        root.join(folder)
    }
}

fn folder_candidates(primary: &str) -> Vec<String> {
    let mut out = Vec::new();
    for c in [primary, "inbox", ""] {
        if !out.iter().any(|x| x == c) {
            out.push(c.to_string());
        }
    }
    out
}

fn relative_doc_path(folder: &str, id: &str, encrypted: bool) -> String {
    let name = if encrypted {
        format!("{id}.md.enc")
    } else {
        format!("{id}.md")
    };
    if folder.is_empty() {
        name
    } else {
        format!("{folder}/{name}")
    }
}

fn read_encrypted_bytes(path: &Path, dek: &[u8; DEK_LEN]) -> Result<Vec<u8>, VaultError> {
    let data = fs::read(path)?;
    if data.len() < NONCE_LEN {
        return Err(VaultError::InvalidData);
    }
    let mut nonce = [0u8; NONCE_LEN];
    nonce.copy_from_slice(&data[..NONCE_LEN]);
    decrypt(dek, &nonce, &data[NONCE_LEN..]).map_err(|_| VaultError::InvalidData)
}

fn write_encrypted_bytes(path: &Path, dek: &[u8; DEK_LEN], plaintext: &[u8]) -> Result<(), VaultError> {
    let (nonce, ciphertext) = encrypt(dek, plaintext).map_err(|_| VaultError::InvalidData)?;
    let mut payload = Vec::with_capacity(NONCE_LEN + ciphertext.len());
    payload.extend_from_slice(&nonce);
    payload.extend_from_slice(&ciphertext);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, payload)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::backup::export_vault;
    use crate::vault::VaultService;
    use std::env;

    fn temp_dir() -> PathBuf {
        let dir = env::temp_dir().join(format!("lizhi-merge-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn merge_imports_newer_document_only() {
        let source = temp_dir();
        let mut svc = VaultService::new(source.clone());
        svc.create_vault(String::new(), None, None).unwrap();
        db::open_plaintext_connection(&source).unwrap();

        let target = temp_dir();
        let mut svc2 = VaultService::new(target.clone());
        svc2.create_vault(String::new(), None, None).unwrap();
        let target_conn = db::open_plaintext_connection(&target).unwrap();
        target_conn
            .execute(
                "INSERT INTO documents (id, title, path, folder, created_at, updated_at, word_count)
                 VALUES ('keep', '本地', 'inbox/keep.md', 'inbox', 1, 100, 0)",
                [],
            )
            .unwrap();
        let ws = db::workspace_dir(&target);
        fs::create_dir_all(ws.join("inbox")).unwrap();
        fs::write(ws.join("inbox/keep.md"), "# 本地").unwrap();

        let src_ws = db::workspace_dir(&source);
        fs::create_dir_all(src_ws.join("inbox")).unwrap();
        fs::write(src_ws.join("inbox/new.md"), "# 新文档").unwrap();
        let src_conn = db::open_plaintext_connection(&source).unwrap();
        src_conn
            .execute(
                "INSERT INTO documents (id, title, path, folder, created_at, updated_at, word_count)
                 VALUES ('new', '新', 'inbox/new.md', 'inbox', 1, 50, 0)",
                [],
            )
            .unwrap();
        src_conn
            .execute(
                "INSERT INTO documents (id, title, path, folder, created_at, updated_at, word_count)
                 VALUES ('keep', '备份旧', 'inbox/keep.md', 'inbox', 1, 50, 0)",
                [],
            )
            .unwrap();
        fs::write(src_ws.join("inbox/keep.md"), "# 备份旧").unwrap();

        let backup_path = source.join("backup.lizhi");
        export_vault(&source, &backup_path, None).unwrap();

        let stats = merge_documents_from_staging(&target, &source, "", None).unwrap();
        assert_eq!(stats.documents, 1);

        let content = fs::read_to_string(ws.join("inbox/keep.md")).unwrap();
        assert!(content.contains("本地"));
        assert!(ws.join("inbox/new.md").is_file());

        let _ = fs::remove_dir_all(source);
        let _ = fs::remove_dir_all(target);
    }

    #[test]
    fn merge_imports_credential_and_launch_records() {
        let source = temp_dir();
        let mut svc = VaultService::new(source.clone());
        svc.create_vault(String::new(), None, None).unwrap();
        let src_conn = db::open_plaintext_connection(&source).unwrap();
        src_conn
            .execute(
                "INSERT INTO credential_entries
                 (id, title, category, environment, username, password, url, notes,
                  is_favorite, sort_order, created_at, updated_at)
                 VALUES ('cred-1', '生产 DB', 'database', 'prod', 'root', 'secret', NULL, NULL, 1, 0, 1, 200)",
                [],
            )
            .unwrap();
        src_conn
            .execute(
                "INSERT INTO launch_records
                 (id, record_number, title, environment, status, created_at, updated_at)
                 VALUES ('launch-1', 'REL-20260709-001', 'v1.0 发版', 'production', 'live', 1, 200)",
                [],
            )
            .unwrap();

        let target = temp_dir();
        let mut svc2 = VaultService::new(target.clone());
        svc2.create_vault(String::new(), None, None).unwrap();

        let stats = merge_documents_from_staging(&target, &source, "", None).unwrap();
        assert_eq!(stats.documents, 0);

        let target_conn = db::open_plaintext_connection(&target).unwrap();
        let cred_title: String = target_conn
            .query_row(
                "SELECT title FROM credential_entries WHERE id = 'cred-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(cred_title, "生产 DB");

        let launch_title: String = target_conn
            .query_row(
                "SELECT title FROM launch_records WHERE id = 'launch-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(launch_title, "v1.0 发版");

        let _ = fs::remove_dir_all(source);
        let _ = fs::remove_dir_all(target);
    }
}
