use chrono::Local;
use rusqlite::{params, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::documents::DocumentService;
use crate::AppError;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JournalEntry {
    pub id: String,
    pub day_date: String,
    pub content: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateJournalEntryInput {
    pub content: String,
    pub day_date: Option<String>,
    /// 一次性 localStorage 迁移：保留原 id / 时间戳
    pub id: Option<String>,
    pub created_at: Option<i64>,
    pub updated_at: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateJournalEntryPatch {
    pub content: Option<String>,
}

const JOURNAL_LIST_SQL: &str =
    "SELECT id, day_date, content, created_at, updated_at FROM journal_entries
     ORDER BY day_date DESC, created_at DESC";

const JOURNAL_BY_ID_SQL: &str =
    "SELECT id, day_date, content, created_at, updated_at FROM journal_entries WHERE id = ?1";

impl DocumentService {
    pub fn list_journal_entries(&self) -> Result<Vec<JournalEntry>, AppError> {
        let mut stmt = self.conn()?.prepare(JOURNAL_LIST_SQL)?;
        let rows = stmt.query_map([], map_journal_row)?;
        rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
    }

    pub fn create_journal_entry(
        &mut self,
        input: CreateJournalEntryInput,
    ) -> Result<JournalEntry, AppError> {
        let id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
        let now = now_millis();
        let created_at = input.created_at.unwrap_or(now);
        let updated_at = input.updated_at.unwrap_or(now);
        let day_date = input
            .day_date
            .unwrap_or_else(|| day_date_from_millis(created_at));

        let content = input.content.trim().to_string();
        if content.is_empty() {
            return Err(AppError::JournalValidation("小记内容不能为空".into()));
        }

        self.conn()?.execute(
            "INSERT INTO journal_entries (id, day_date, content, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, day_date, content, created_at, updated_at],
        )?;

        self.get_journal_entry(&id)
    }

    pub fn update_journal_entry(
        &mut self,
        id: &str,
        patch: UpdateJournalEntryPatch,
    ) -> Result<JournalEntry, AppError> {
        let existing = self.get_journal_entry(id)?;
        let now = now_millis();

        let content = patch
            .content
            .map(|c| c.trim().to_string())
            .unwrap_or(existing.content);
        if content.is_empty() {
            return Err(AppError::JournalValidation("小记内容不能为空".into()));
        }

        let updated = self.conn_mut()?.execute(
            "UPDATE journal_entries SET content = ?1, updated_at = ?2 WHERE id = ?3",
            params![content, now, id],
        )?;

        if updated == 0 {
            return Err(AppError::JournalNotFound(id.to_string()));
        }

        self.get_journal_entry(id)
    }

    pub fn delete_journal_entry(&mut self, id: &str) -> Result<(), AppError> {
        let deleted = self
            .conn_mut()?
            .execute("DELETE FROM journal_entries WHERE id = ?1", params![id])?;
        if deleted == 0 {
            return Err(AppError::JournalNotFound(id.to_string()));
        }
        Ok(())
    }

    fn get_journal_entry(&self, id: &str) -> Result<JournalEntry, AppError> {
        self.conn()?
            .query_row(JOURNAL_BY_ID_SQL, params![id], map_journal_row)
            .optional()?
            .ok_or_else(|| AppError::JournalNotFound(id.to_string()))
    }
}

fn map_journal_row(row: &Row<'_>) -> rusqlite::Result<JournalEntry> {
    Ok(JournalEntry {
        id: row.get(0)?,
        day_date: row.get(1)?,
        content: row.get(2)?,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
    })
}

fn now_millis() -> i64 {
    Local::now().timestamp_millis()
}

fn day_date_from_millis(ms: i64) -> String {
    let secs = ms / 1000;
    let nanos = ((ms % 1000) * 1_000_000) as u32;
    if let Some(dt) = chrono::DateTime::from_timestamp(secs, nanos) {
        return dt.with_timezone(&Local).format("%Y-%m-%d").to_string();
    }
    Local::now().format("%Y-%m-%d").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use std::env;
    use std::path::PathBuf;
    use uuid::Uuid;

    fn test_service() -> (DocumentService, PathBuf) {
        let dir = env::temp_dir().join(format!("lizhi-journal-test-{}", Uuid::new_v4()));
        db::init(&dir).unwrap();
        let mut svc = DocumentService::new(dir.clone());
        svc.connect_plaintext().unwrap();
        (svc, dir)
    }

    #[test]
    fn crud_journal_entries() {
        let (mut svc, dir) = test_service();

        let entry = svc
            .create_journal_entry(CreateJournalEntryInput {
                content: "今天的第一条小记".into(),
                day_date: None,
                id: None,
                created_at: None,
                updated_at: None,
            })
            .unwrap();
        assert!(!entry.id.is_empty());
        assert_eq!(entry.content, "今天的第一条小记");

        let updated = svc
            .update_journal_entry(
                &entry.id,
                UpdateJournalEntryPatch {
                    content: Some("已更新内容".into()),
                },
            )
            .unwrap();
        assert_eq!(updated.content, "已更新内容");

        let list = svc.list_journal_entries().unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, entry.id);

        svc.delete_journal_entry(&entry.id).unwrap();
        assert!(svc.list_journal_entries().unwrap().is_empty());

        let _ = std::fs::remove_dir_all(dir);
    }
}
