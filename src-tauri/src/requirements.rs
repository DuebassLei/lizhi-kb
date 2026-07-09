use chrono::Local;
use rusqlite::{params, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::documents::DocumentService;
use crate::AppError;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Requirement {
    pub id: String,
    pub number: String,
    pub content: String,
    pub status: String,
    pub priority: Option<String>,
    pub sort_order: i32,
    pub created_at: i64,
    pub updated_at: i64,
    pub due_at: Option<i64>,
    pub proposed_at: Option<i64>,
    pub expected_launch_at: Option<i64>,
    pub actual_launch_at: Option<i64>,
    pub title: Option<String>,
    pub progress_description: Option<String>,
    pub remarks: Option<String>,
    pub requester: Option<String>,
    pub owner: Option<String>,
    pub source: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRequirementInput {
    pub content: String,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub due_at: Option<i64>,
    pub proposed_at: Option<i64>,
    pub expected_launch_at: Option<i64>,
    pub actual_launch_at: Option<i64>,
    pub title: Option<String>,
    pub progress_description: Option<String>,
    pub remarks: Option<String>,
    pub requester: Option<String>,
    pub owner: Option<String>,
    pub source: Option<String>,
    /// 一次性 localStorage 迁移：保留原 id / 单号 / 时间戳
    pub id: Option<String>,
    pub number: Option<String>,
    pub sort_order: Option<i32>,
    pub created_at: Option<i64>,
    pub updated_at: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateRequirementPatch {
    pub number: Option<String>,
    pub content: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub sort_order: Option<i32>,
    /// 外层 None = 未修改；Some(None) = 清空；Some(Some(v)) = 设值
    pub due_at: Option<Option<i64>>,
    pub proposed_at: Option<Option<i64>>,
    pub expected_launch_at: Option<Option<i64>>,
    pub actual_launch_at: Option<Option<i64>>,
    pub title: Option<Option<String>>,
    pub progress_description: Option<Option<String>>,
    pub remarks: Option<Option<String>>,
    pub requester: Option<Option<String>>,
    pub owner: Option<Option<String>>,
    pub source: Option<Option<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReorderItem {
    pub id: String,
    pub status: String,
    pub sort_order: i32,
}

const REQ_LIST_SQL: &str = "SELECT id, number, content, status, priority, sort_order, created_at, updated_at, due_at,
     proposed_at, expected_launch_at, actual_launch_at,
     title, progress_description, remarks, requester, owner, source
     FROM requirements ORDER BY status, sort_order";

const REQ_BY_ID_SQL: &str = "SELECT id, number, content, status, priority, sort_order, created_at, updated_at, due_at,
     proposed_at, expected_launch_at, actual_launch_at,
     title, progress_description, remarks, requester, owner, source
     FROM requirements WHERE id = ?1";

impl DocumentService {
    pub fn list_requirements(&self) -> Result<Vec<Requirement>, AppError> {
        let mut stmt = self.conn()?.prepare(REQ_LIST_SQL)?;
        let rows = stmt.query_map([], map_requirement_row)?;
        rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
    }

    pub fn create_requirement(&mut self, input: CreateRequirementInput) -> Result<Requirement, AppError> {
        let id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
        let status = input.status.unwrap_or_else(|| "todo".to_string());
        let now = now_millis();
        let created_at = input.created_at.unwrap_or(now);
        let updated_at = input.updated_at.unwrap_or(now);
        let proposed_at = input.proposed_at.or(Some(created_at));

        let number = match input.number {
            Some(n) => n,
            None => generate_requirement_number(self.conn()?)?,
        };

        let sort_order = match input.sort_order {
            Some(o) => o,
            None => next_sort_order(self.conn()?, &status)?,
        };

        let content = input.content.trim().to_string();
        if content.is_empty() {
            return Err(AppError::RequirementValidation("需求内容不能为空".into()));
        }

        self.conn()?.execute(
            "INSERT INTO requirements (id, number, content, status, priority, sort_order, created_at, updated_at, due_at,
             proposed_at, expected_launch_at, actual_launch_at,
             title, progress_description, remarks, requester, owner, source)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)",
            params![
                id,
                number,
                content,
                status,
                input.priority,
                sort_order,
                created_at,
                updated_at,
                input.due_at,
                proposed_at,
                input.expected_launch_at,
                input.actual_launch_at,
                normalize_optional_text(input.title),
                normalize_optional_text(input.progress_description),
                normalize_optional_text(input.remarks),
                normalize_optional_text(input.requester),
                normalize_optional_text(input.owner),
                normalize_optional_text(input.source),
            ],
        )?;

        self.get_requirement(&id)
    }

    pub fn update_requirement(
        &mut self,
        id: &str,
        patch: UpdateRequirementPatch,
    ) -> Result<Requirement, AppError> {
        let existing = self.get_requirement(id)?;
        let now = now_millis();

        let content = patch.content.map(|c| c.trim().to_string()).unwrap_or(existing.content);
        if content.is_empty() {
            return Err(AppError::RequirementValidation("需求内容不能为空".into()));
        }

        let number = patch
            .number
            .map(|n| n.trim().to_string())
            .unwrap_or(existing.number.clone());
        if number.is_empty() {
            return Err(AppError::RequirementValidation("需求单号不能为空".into()));
        }
        if number != existing.number {
            let dup: i32 = self.conn()?.query_row(
                "SELECT COUNT(*) FROM requirements WHERE number = ?1 AND id != ?2",
                params![number, id],
                |row| row.get(0),
            )?;
            if dup > 0 {
                return Err(AppError::RequirementValidation(format!(
                    "需求单号「{number}」已存在"
                )));
            }
        }

        let status = patch.status.unwrap_or(existing.status);
        let priority = patch.priority.or(existing.priority);
        let sort_order = patch.sort_order.unwrap_or(existing.sort_order);
        let due_at = patch.due_at.unwrap_or(existing.due_at);
        let proposed_at = patch.proposed_at.unwrap_or(existing.proposed_at);
        let expected_launch_at = patch.expected_launch_at.unwrap_or(existing.expected_launch_at);
        let actual_launch_at = patch.actual_launch_at.unwrap_or(existing.actual_launch_at);
        let title = patch.title.unwrap_or(existing.title);
        let progress_description = patch.progress_description.unwrap_or(existing.progress_description);
        let remarks = patch.remarks.unwrap_or(existing.remarks);
        let requester = patch.requester.unwrap_or(existing.requester);
        let owner = patch.owner.unwrap_or(existing.owner);
        let source = patch.source.unwrap_or(existing.source);

        let updated = self.conn_mut()?.execute(
            "UPDATE requirements SET number = ?1, content = ?2, status = ?3, priority = ?4, sort_order = ?5,
             updated_at = ?6, due_at = ?7, proposed_at = ?8, expected_launch_at = ?9, actual_launch_at = ?10,
             title = ?11, progress_description = ?12, remarks = ?13, requester = ?14, owner = ?15, source = ?16
             WHERE id = ?17",
            params![
                number,
                content,
                status,
                priority,
                sort_order,
                now,
                due_at,
                proposed_at,
                expected_launch_at,
                actual_launch_at,
                title,
                progress_description,
                remarks,
                requester,
                owner,
                source,
                id
            ],
        )?;

        if updated == 0 {
            return Err(AppError::RequirementNotFound(id.to_string()));
        }

        self.get_requirement(id)
    }

    pub fn delete_requirement(&mut self, id: &str) -> Result<(), AppError> {
        let deleted = self
            .conn_mut()?
            .execute("DELETE FROM requirements WHERE id = ?1", params![id])?;
        if deleted == 0 {
            return Err(AppError::RequirementNotFound(id.to_string()));
        }
        Ok(())
    }

    pub fn reorder_requirements(&mut self, updates: Vec<ReorderItem>) -> Result<(), AppError> {
        if updates.is_empty() {
            return Ok(());
        }
        let now = now_millis();
        let conn = self.conn_mut()?;
        let tx = conn.transaction()?;
        for item in updates {
            let updated = tx.execute(
                "UPDATE requirements SET status = ?1, sort_order = ?2, updated_at = ?3 WHERE id = ?4",
                params![item.status, item.sort_order, now, item.id],
            )?;
            if updated == 0 {
                return Err(AppError::RequirementNotFound(item.id));
            }
        }
        tx.commit()?;
        Ok(())
    }

    fn get_requirement(&self, id: &str) -> Result<Requirement, AppError> {
        self.conn()?
            .query_row(REQ_BY_ID_SQL, params![id], map_requirement_row)
            .optional()?
            .ok_or_else(|| AppError::RequirementNotFound(id.to_string()))
    }
}

fn map_requirement_row(row: &Row<'_>) -> rusqlite::Result<Requirement> {
    Ok(Requirement {
        id: row.get(0)?,
        number: row.get(1)?,
        content: row.get(2)?,
        status: row.get(3)?,
        priority: row.get(4)?,
        sort_order: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
        due_at: row.get(8)?,
        proposed_at: row.get(9)?,
        expected_launch_at: row.get(10)?,
        actual_launch_at: row.get(11)?,
        title: row.get(12)?,
        progress_description: row.get(13)?,
        remarks: row.get(14)?,
        requester: row.get(15)?,
        owner: row.get(16)?,
        source: row.get(17)?,
    })
}

fn normalize_optional_text(value: Option<String>) -> Option<String> {
    value.and_then(|s| {
        let trimmed = s.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

fn now_millis() -> i64 {
    Local::now().timestamp_millis()
}

fn date_prefix() -> String {
    Local::now().format("%Y%m%d").to_string()
}

fn generate_requirement_number(conn: &rusqlite::Connection) -> Result<String, AppError> {
    let prefix = format!("REQ-{}-", date_prefix());
    let mut stmt = conn.prepare("SELECT number FROM requirements WHERE number LIKE ?1")?;
    let pattern = format!("{prefix}%");
    let mut max_seq = 0i32;
    let rows = stmt.query_map(params![pattern], |row| row.get::<_, String>(0))?;
    for number in rows {
        let number = number?;
        if let Some(seq_str) = number.strip_prefix(&prefix) {
            if let Ok(seq) = seq_str.parse::<i32>() {
                max_seq = max_seq.max(seq);
            }
        }
    }
    Ok(format!("{prefix}{:03}", max_seq + 1))
}

fn next_sort_order(conn: &rusqlite::Connection, status: &str) -> Result<i32, AppError> {
    let count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM requirements WHERE status = ?1",
        params![status],
        |row| row.get(0),
    )?;
    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use std::env;
    use std::path::PathBuf;
    use uuid::Uuid;

    fn test_service() -> (DocumentService, PathBuf) {
        let dir = env::temp_dir().join(format!("lizhi-req-test-{}", Uuid::new_v4()));
        db::init(&dir).unwrap();
        let mut svc = DocumentService::new(dir.clone());
        svc.connect_plaintext().unwrap();
        (svc, dir)
    }

    #[test]
    fn crud_and_reorder_requirements() {
        let (mut svc, dir) = test_service();

        let a = svc
            .create_requirement(CreateRequirementInput {
                content: "第一条需求".into(),
                status: Some("todo".into()),
                priority: None,
                due_at: None,
                proposed_at: None,
                expected_launch_at: None,
                actual_launch_at: None,
                title: None,
                progress_description: None,
                remarks: None,
                requester: None,
                owner: None,
                source: None,
                id: None,
                number: None,
                sort_order: None,
                created_at: None,
                updated_at: None,
            })
            .unwrap();
        assert!(a.number.starts_with("REQ-"));
        assert_eq!(a.status, "todo");
        assert!(a.proposed_at.is_some());

        let b = svc
            .create_requirement(CreateRequirementInput {
                content: "第二条".into(),
                status: Some("todo".into()),
                priority: Some("high".into()),
                due_at: None,
                proposed_at: None,
                expected_launch_at: None,
                actual_launch_at: None,
                title: None,
                progress_description: None,
                remarks: None,
                requester: None,
                owner: None,
                source: None,
                id: None,
                number: None,
                sort_order: None,
                created_at: None,
                updated_at: None,
            })
            .unwrap();

        let updated = svc
            .update_requirement(
                &a.id,
                UpdateRequirementPatch {
                    content: Some("已更新".into()),
                    status: Some("in_progress".into()),
                    ..Default::default()
                },
            )
            .unwrap();
        assert_eq!(updated.content, "已更新");
        assert_eq!(updated.status, "in_progress");

        svc.reorder_requirements(vec![
            ReorderItem {
                id: b.id.clone(),
                status: "done".into(),
                sort_order: 0,
            },
            ReorderItem {
                id: a.id.clone(),
                status: "done".into(),
                sort_order: 1,
            },
        ])
        .unwrap();

        let list = svc.list_requirements().unwrap();
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].id, b.id);
        assert_eq!(list[0].status, "done");

        svc.delete_requirement(&b.id).unwrap();
        assert_eq!(svc.list_requirements().unwrap().len(), 1);

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn requirement_number_increments_per_day() {
        let (mut svc, dir) = test_service();
        let first = svc
            .create_requirement(CreateRequirementInput {
                content: "A".into(),
                status: None,
                priority: None,
                due_at: None,
                proposed_at: None,
                expected_launch_at: None,
                actual_launch_at: None,
                title: None,
                progress_description: None,
                remarks: None,
                requester: None,
                owner: None,
                source: None,
                id: None,
                number: None,
                sort_order: None,
                created_at: None,
                updated_at: None,
            })
            .unwrap();
        let second = svc
            .create_requirement(CreateRequirementInput {
                content: "B".into(),
                status: None,
                priority: None,
                due_at: None,
                proposed_at: None,
                expected_launch_at: None,
                actual_launch_at: None,
                title: None,
                progress_description: None,
                remarks: None,
                requester: None,
                owner: None,
                source: None,
                id: None,
                number: None,
                sort_order: None,
                created_at: None,
                updated_at: None,
            })
            .unwrap();
        let prefix = format!("REQ-{}-", date_prefix());
        assert!(first.number.starts_with(&prefix));
        assert!(second.number.starts_with(&prefix));
        let seq1: i32 = first.number[prefix.len()..].parse().unwrap();
        let seq2: i32 = second.number[prefix.len()..].parse().unwrap();
        assert_eq!(seq2, seq1 + 1);

        let _ = std::fs::remove_dir_all(dir);
    }
}
