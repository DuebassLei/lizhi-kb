use chrono::Local;
use rusqlite::{params, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::documents::DocumentService;
use crate::AppError;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchRecord {
    pub id: String,
    pub record_number: String,
    pub title: String,
    pub version: Option<String>,
    pub environment: String,
    pub status: String,
    pub risk_level: Option<String>,
    pub client_name: Option<String>,
    pub project_name: Option<String>,
    pub scheduled_at: Option<i64>,
    pub launched_at: Option<i64>,
    pub rolled_back_at: Option<i64>,
    pub operator: Option<String>,
    pub owner: Option<String>,
    pub approver: Option<String>,
    pub change_summary: Option<String>,
    pub release_notes: Option<String>,
    pub rollback_reason: Option<String>,
    pub verification_status: Option<String>,
    pub verification_notes: Option<String>,
    pub linked_requirement_ids: Option<Vec<String>>,
    pub linked_document_ids: Option<Vec<String>>,
    pub tags: Option<Vec<String>>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateLaunchRecordInput {
    pub title: String,
    pub version: Option<String>,
    pub environment: Option<String>,
    pub status: Option<String>,
    pub risk_level: Option<String>,
    pub client_name: Option<String>,
    pub project_name: Option<String>,
    pub scheduled_at: Option<i64>,
    pub launched_at: Option<i64>,
    pub rolled_back_at: Option<i64>,
    pub operator: Option<String>,
    pub owner: Option<String>,
    pub approver: Option<String>,
    pub change_summary: Option<String>,
    pub release_notes: Option<String>,
    pub rollback_reason: Option<String>,
    pub verification_status: Option<String>,
    pub verification_notes: Option<String>,
    pub linked_requirement_ids: Option<Vec<String>>,
    pub linked_document_ids: Option<Vec<String>>,
    pub tags: Option<Vec<String>>,
    /// localStorage 迁移
    pub id: Option<String>,
    pub record_number: Option<String>,
    pub created_at: Option<i64>,
    pub updated_at: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateLaunchRecordPatch {
    pub title: Option<String>,
    pub version: Option<Option<String>>,
    pub environment: Option<String>,
    pub status: Option<String>,
    pub risk_level: Option<Option<String>>,
    pub client_name: Option<Option<String>>,
    pub project_name: Option<Option<String>>,
    pub scheduled_at: Option<Option<i64>>,
    pub launched_at: Option<Option<i64>>,
    pub rolled_back_at: Option<Option<i64>>,
    pub operator: Option<Option<String>>,
    pub owner: Option<Option<String>>,
    pub approver: Option<Option<String>>,
    pub change_summary: Option<Option<String>>,
    pub release_notes: Option<Option<String>>,
    pub rollback_reason: Option<Option<String>>,
    pub verification_status: Option<Option<String>>,
    pub verification_notes: Option<Option<String>>,
    pub linked_requirement_ids: Option<Option<Vec<String>>>,
    pub linked_document_ids: Option<Option<Vec<String>>>,
    pub tags: Option<Option<Vec<String>>>,
}

const LIST_SQL: &str = "SELECT id, record_number, title, version, environment, status, risk_level,
    client_name, project_name, scheduled_at, launched_at, rolled_back_at,
    operator, owner, approver, change_summary, release_notes, rollback_reason,
    verification_status, verification_notes, linked_requirement_ids, linked_document_ids, tags,
    created_at, updated_at
    FROM launch_records
    ORDER BY COALESCE(launched_at, scheduled_at, created_at) DESC";

const BY_ID_SQL: &str = "SELECT id, record_number, title, version, environment, status, risk_level,
    client_name, project_name, scheduled_at, launched_at, rolled_back_at,
    operator, owner, approver, change_summary, release_notes, rollback_reason,
    verification_status, verification_notes, linked_requirement_ids, linked_document_ids, tags,
    created_at, updated_at
    FROM launch_records WHERE id = ?1";

impl DocumentService {
    pub fn list_launch_records(&self) -> Result<Vec<LaunchRecord>, AppError> {
        let mut stmt = self.conn()?.prepare(LIST_SQL)?;
        let rows = stmt.query_map([], map_launch_record_row)?;
        rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
    }

    pub fn create_launch_record(&mut self, input: CreateLaunchRecordInput) -> Result<LaunchRecord, AppError> {
        let id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
        let now = now_millis();
        let created_at = input.created_at.unwrap_or(now);
        let updated_at = input.updated_at.unwrap_or(now);

        let title = input.title.trim().to_string();
        if title.is_empty() {
            return Err(AppError::LaunchRecordValidation("标题不能为空".into()));
        }

        let record_number = match input.record_number {
            Some(n) => n,
            None => generate_launch_record_number(self.conn()?)?,
        };

        let environment = input.environment.unwrap_or_else(|| "production".to_string());
        let status = input.status.unwrap_or_else(|| "planned".to_string());

        self.conn()?.execute(
            "INSERT INTO launch_records (
                id, record_number, title, version, environment, status, risk_level,
                client_name, project_name, scheduled_at, launched_at, rolled_back_at,
                operator, owner, approver, change_summary, release_notes, rollback_reason,
                verification_status, verification_notes, linked_requirement_ids, linked_document_ids, tags,
                created_at, updated_at
            ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24,?25)",
            params![
                id,
                record_number,
                title,
                normalize_optional_text(input.version),
                environment,
                status,
                normalize_optional_text(input.risk_level),
                normalize_optional_text(input.client_name),
                normalize_optional_text(input.project_name),
                input.scheduled_at,
                input.launched_at,
                input.rolled_back_at,
                normalize_optional_text(input.operator),
                normalize_optional_text(input.owner),
                normalize_optional_text(input.approver),
                normalize_optional_text(input.change_summary),
                normalize_optional_text(input.release_notes),
                normalize_optional_text(input.rollback_reason),
                normalize_optional_text(input.verification_status),
                normalize_optional_text(input.verification_notes),
                serialize_json_array(&input.linked_requirement_ids),
                serialize_json_array(&input.linked_document_ids),
                serialize_json_array(&input.tags),
                created_at,
                updated_at,
            ],
        )?;

        self.get_launch_record(&id)
    }

    pub fn update_launch_record(
        &mut self,
        id: &str,
        patch: UpdateLaunchRecordPatch,
    ) -> Result<LaunchRecord, AppError> {
        let existing = self.get_launch_record(id)?;
        let now = now_millis();

        let title = patch
            .title
            .map(|t| t.trim().to_string())
            .unwrap_or(existing.title);
        if title.is_empty() {
            return Err(AppError::LaunchRecordValidation("标题不能为空".into()));
        }

        let version = patch.version.unwrap_or(existing.version);
        let environment = patch.environment.unwrap_or(existing.environment);
        let status = patch.status.unwrap_or(existing.status);
        let risk_level = patch.risk_level.unwrap_or(existing.risk_level);
        let client_name = patch.client_name.unwrap_or(existing.client_name);
        let project_name = patch.project_name.unwrap_or(existing.project_name);
        let scheduled_at = patch.scheduled_at.unwrap_or(existing.scheduled_at);
        let launched_at = patch.launched_at.unwrap_or(existing.launched_at);
        let rolled_back_at = patch.rolled_back_at.unwrap_or(existing.rolled_back_at);
        let operator = patch.operator.unwrap_or(existing.operator);
        let owner = patch.owner.unwrap_or(existing.owner);
        let approver = patch.approver.unwrap_or(existing.approver);
        let change_summary = patch.change_summary.unwrap_or(existing.change_summary);
        let release_notes = patch.release_notes.unwrap_or(existing.release_notes);
        let rollback_reason = patch.rollback_reason.unwrap_or(existing.rollback_reason);
        let verification_status = patch.verification_status.unwrap_or(existing.verification_status);
        let verification_notes = patch.verification_notes.unwrap_or(existing.verification_notes);
        let linked_requirement_ids = patch
            .linked_requirement_ids
            .unwrap_or(existing.linked_requirement_ids);
        let linked_document_ids = patch
            .linked_document_ids
            .unwrap_or(existing.linked_document_ids);
        let tags = patch.tags.unwrap_or(existing.tags);

        let updated = self.conn_mut()?.execute(
            "UPDATE launch_records SET
                title = ?1, version = ?2, environment = ?3, status = ?4, risk_level = ?5,
                client_name = ?6, project_name = ?7, scheduled_at = ?8, launched_at = ?9, rolled_back_at = ?10,
                operator = ?11, owner = ?12, approver = ?13, change_summary = ?14, release_notes = ?15,
                rollback_reason = ?16, verification_status = ?17, verification_notes = ?18,
                linked_requirement_ids = ?19, linked_document_ids = ?20, tags = ?21,
                updated_at = ?22
            WHERE id = ?23",
            params![
                title,
                version,
                environment,
                status,
                risk_level,
                client_name,
                project_name,
                scheduled_at,
                launched_at,
                rolled_back_at,
                operator,
                owner,
                approver,
                change_summary,
                release_notes,
                rollback_reason,
                verification_status,
                verification_notes,
                serialize_json_array(&linked_requirement_ids),
                serialize_json_array(&linked_document_ids),
                serialize_json_array(&tags),
                now,
                id
            ],
        )?;

        if updated == 0 {
            return Err(AppError::LaunchRecordNotFound(id.to_string()));
        }

        self.get_launch_record(id)
    }

    pub fn delete_launch_record(&mut self, id: &str) -> Result<(), AppError> {
        let deleted = self
            .conn_mut()?
            .execute("DELETE FROM launch_records WHERE id = ?1", params![id])?;
        if deleted == 0 {
            return Err(AppError::LaunchRecordNotFound(id.to_string()));
        }
        Ok(())
    }

    fn get_launch_record(&self, id: &str) -> Result<LaunchRecord, AppError> {
        self.conn()?
            .query_row(BY_ID_SQL, params![id], map_launch_record_row)
            .optional()?
            .ok_or_else(|| AppError::LaunchRecordNotFound(id.to_string()))
    }
}

fn map_launch_record_row(row: &Row<'_>) -> rusqlite::Result<LaunchRecord> {
    Ok(LaunchRecord {
        id: row.get(0)?,
        record_number: row.get(1)?,
        title: row.get(2)?,
        version: row.get(3)?,
        environment: row.get(4)?,
        status: row.get(5)?,
        risk_level: row.get(6)?,
        client_name: row.get(7)?,
        project_name: row.get(8)?,
        scheduled_at: row.get(9)?,
        launched_at: row.get(10)?,
        rolled_back_at: row.get(11)?,
        operator: row.get(12)?,
        owner: row.get(13)?,
        approver: row.get(14)?,
        change_summary: row.get(15)?,
        release_notes: row.get(16)?,
        rollback_reason: row.get(17)?,
        verification_status: row.get(18)?,
        verification_notes: row.get(19)?,
        linked_requirement_ids: deserialize_json_array(row.get(20)?),
        linked_document_ids: deserialize_json_array(row.get(21)?),
        tags: deserialize_json_array(row.get(22)?),
        created_at: row.get(23)?,
        updated_at: row.get(24)?,
    })
}

fn serialize_json_array(value: &Option<Vec<String>>) -> Option<String> {
    value.as_ref().and_then(|items| {
        if items.is_empty() {
            None
        } else {
            serde_json::to_string(items).ok()
        }
    })
}

fn deserialize_json_array(raw: Option<String>) -> Option<Vec<String>> {
    raw.and_then(|json| serde_json::from_str::<Vec<String>>(&json).ok())
        .filter(|items| !items.is_empty())
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

fn generate_launch_record_number(conn: &rusqlite::Connection) -> Result<String, AppError> {
    let prefix = format!("REL-{}-", date_prefix());
    let mut stmt = conn.prepare("SELECT record_number FROM launch_records WHERE record_number LIKE ?1")?;
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use std::env;
    use std::path::PathBuf;
    use uuid::Uuid;

    fn test_service() -> (DocumentService, PathBuf) {
        let dir = env::temp_dir().join(format!("lizhi-launch-test-{}", Uuid::new_v4()));
        db::init(&dir).unwrap();
        let mut svc = DocumentService::new(dir.clone());
        svc.connect_plaintext().unwrap();
        (svc, dir)
    }

    #[test]
    fn crud_launch_records() {
        let (mut svc, dir) = test_service();

        let a = svc
            .create_launch_record(CreateLaunchRecordInput {
                title: "v1.0 首发".into(),
                version: Some("1.0.0".into()),
                environment: None,
                status: None,
                risk_level: None,
                client_name: None,
                project_name: None,
                scheduled_at: None,
                launched_at: None,
                rolled_back_at: None,
                operator: None,
                owner: None,
                approver: None,
                change_summary: None,
                release_notes: None,
                rollback_reason: None,
                verification_status: None,
                verification_notes: None,
                linked_requirement_ids: None,
                linked_document_ids: None,
                tags: None,
                id: None,
                record_number: None,
                created_at: None,
                updated_at: None,
            })
            .unwrap();
        assert!(a.record_number.starts_with("REL-"));

        let updated = svc
            .update_launch_record(
                &a.id,
                UpdateLaunchRecordPatch {
                    status: Some("live".into()),
                    launched_at: Some(Some(now_millis())),
                    ..Default::default()
                },
            )
            .unwrap();
        assert_eq!(updated.status, "live");
        assert!(updated.launched_at.is_some());

        svc.delete_launch_record(&a.id).unwrap();
        assert!(svc.list_launch_records().unwrap().is_empty());

        let _ = std::fs::remove_dir_all(dir);
    }
}
