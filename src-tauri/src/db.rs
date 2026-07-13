use rusqlite::{Connection, Result as SqliteResult};
use std::path::{Path, PathBuf};

use crate::crypto::DEK_LEN;
use crate::AppError;

const MIGRATIONS: &[&str] = &[
    "
    CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        folder TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    );
    ",
    "
    CREATE TABLE IF NOT EXISTS edit_activity (
        date TEXT PRIMARY KEY NOT NULL,
        edit_count INTEGER NOT NULL DEFAULT 0
    );
    ",
    "
    CREATE TABLE IF NOT EXISTS requirements (
        id TEXT PRIMARY KEY NOT NULL,
        number TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'todo',
        priority TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        due_at INTEGER
    );
    ",
    "
    CREATE TABLE IF NOT EXISTS journal_entries (
        id TEXT PRIMARY KEY NOT NULL,
        day_date TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_journal_entries_day_created
        ON journal_entries (day_date DESC, created_at DESC);
    ",
    "
    CREATE TABLE IF NOT EXISTS credential_entries (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'other',
        environment TEXT NOT NULL DEFAULT 'local',
        username TEXT NOT NULL DEFAULT '',
        password TEXT NOT NULL DEFAULT '',
        url TEXT,
        notes TEXT,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_credential_env_updated
        ON credential_entries (environment, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_credential_category_sort
        ON credential_entries (category, sort_order, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_credential_favorite
        ON credential_entries (is_favorite DESC, updated_at DESC);
    ",
    "
    CREATE TABLE IF NOT EXISTS launch_records (
        id TEXT PRIMARY KEY NOT NULL,
        record_number TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        version TEXT,
        environment TEXT NOT NULL DEFAULT 'production',
        status TEXT NOT NULL DEFAULT 'planned',
        risk_level TEXT,
        client_name TEXT,
        project_name TEXT,
        scheduled_at INTEGER,
        launched_at INTEGER,
        rolled_back_at INTEGER,
        operator TEXT,
        owner TEXT,
        approver TEXT,
        change_summary TEXT,
        release_notes TEXT,
        rollback_reason TEXT,
        verification_status TEXT,
        verification_notes TEXT,
        linked_requirement_ids TEXT,
        linked_document_ids TEXT,
        tags TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_launch_records_launched_at ON launch_records(launched_at DESC);
    CREATE INDEX IF NOT EXISTS idx_launch_records_status ON launch_records(status);
    CREATE INDEX IF NOT EXISTS idx_launch_records_client ON launch_records(client_name);
    ",
];

pub fn data_dir() -> Result<PathBuf, AppError> {
    if let Ok(custom) = std::env::var("LIZHI_KB_DATA_DIR") {
        let trimmed = custom.trim();
        if !trimmed.is_empty() {
            return Ok(PathBuf::from(trimmed));
        }
    }
    let home = dirs::home_dir().ok_or(AppError::DataDirUnavailable)?;
    Ok(home.join(".lizhi-kb"))
}

pub fn workspace_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("workspace")
}

pub fn db_path(data_dir: &Path) -> PathBuf {
    data_dir.join("lizhi-kb.db")
}

pub fn vault_db_path(data_dir: &Path) -> PathBuf {
    data_dir.join("vault.db")
}

pub fn init(data_dir: &Path) -> Result<(), AppError> {
    std::fs::create_dir_all(workspace_dir(data_dir))?;
    std::fs::create_dir_all(crate::assets::assets_dir(data_dir))?;
    let conn = open_plaintext_connection(data_dir)?;
    run_migrations(&conn)?;
    drop(conn);
    Ok(())
}

/// Plain SQLite connection (legacy / encryption disabled).
pub fn open_plaintext_connection(data_dir: &Path) -> Result<Connection, AppError> {
    let path = db_path(data_dir);
    open_connection_at(&path, None)
}

/// SQLCipher vault.db when `dek` is Some; plain file otherwise (dev fallback).
pub fn open_vault_connection(data_dir: &Path, dek: &[u8; DEK_LEN]) -> Result<Connection, AppError> {
    let path = vault_db_path(data_dir);
    open_connection_at(&path, Some(dek))
}

fn open_connection_at(path: &Path, dek: Option<&[u8; DEK_LEN]>) -> Result<Connection, AppError> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let conn = Connection::open(path)?;
    if let Some(dek) = dek {
        apply_sqlcipher_key(&conn, dek)?;
    }
    conn.execute("PRAGMA foreign_keys = ON;", [])?;
    run_migrations(&conn)?;
    Ok(conn)
}

#[cfg(feature = "sqlcipher")]
fn apply_sqlcipher_key(conn: &Connection, dek: &[u8; DEK_LEN]) -> Result<(), AppError> {
    let hex_key = hex::encode(dek);
    conn.execute_batch(&format!("PRAGMA key = \"x'{hex_key}'\";"))?;
    conn.query_row("SELECT count(*) FROM sqlite_master", [], |_| Ok(()))
        .map_err(AppError::from)?;
    Ok(())
}

#[cfg(not(feature = "sqlcipher"))]
fn apply_sqlcipher_key(_conn: &Connection, _dek: &[u8; DEK_LEN]) -> Result<(), AppError> {
    Ok(())
}

/// Convenience alias for plaintext vault DB access.
#[allow(dead_code)]
pub fn open_connection(data_dir: &Path) -> Result<Connection, AppError> {
    open_plaintext_connection(data_dir)
}

fn run_migrations(conn: &Connection) -> SqliteResult<()> {
    for sql in MIGRATIONS {
        conn.execute_batch(sql)?;
    }
    migrate_documents_columns(conn)?;
    migrate_requirements_columns(conn)?;
    Ok(())
}

/// 为已有 documents 表追加 word_count（兼容已迁移过的库）
fn migrate_documents_columns(conn: &Connection) -> SqliteResult<()> {
    let mut stmt = conn.prepare("PRAGMA table_info(documents)")?;
    let cols: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .filter_map(|r| r.ok())
        .collect();

    if !cols.iter().any(|c| c == "word_count") {
        conn.execute(
            "ALTER TABLE documents ADD COLUMN word_count INTEGER NOT NULL DEFAULT 0",
            [],
        )?;
    }
    Ok(())
}

/// 为已有 requirements 表追加 v1.1+ 字段（nullable，兼容旧数据）
fn migrate_requirements_columns(conn: &Connection) -> SqliteResult<()> {
    let mut stmt = conn.prepare("PRAGMA table_info(requirements)")?;
    let cols: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .filter_map(|r| r.ok())
        .collect();

    let add = |name: &str| -> SqliteResult<()> {
        if !cols.iter().any(|c| c == name) {
            conn.execute(
                &format!("ALTER TABLE requirements ADD COLUMN {name} INTEGER"),
                [],
            )?;
        }
        Ok(())
    };

    add("proposed_at")?;
    add("expected_launch_at")?;
    add("actual_launch_at")?;

    let add_text = |name: &str| -> SqliteResult<()> {
        if !cols.iter().any(|c| c == name) {
            conn.execute(
                &format!("ALTER TABLE requirements ADD COLUMN {name} TEXT"),
                [],
            )?;
        }
        Ok(())
    };

    add_text("title")?;
    add_text("progress_description")?;
    add_text("remarks")?;
    add_text("requester")?;
    add_text("owner")?;
    add_text("source")?;

    if !cols.iter().any(|c| c == "linked_document_ids") {
        conn.execute(
            "ALTER TABLE requirements ADD COLUMN linked_document_ids TEXT",
            [],
        )?;
    }
    Ok(())
}
