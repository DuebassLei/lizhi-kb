use chrono::Local;
use rusqlite::{params, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::documents::DocumentService;
use crate::AppError;

const VALID_ENVIRONMENTS: &[&str] = &["test", "prod", "local", "public"];
const VALID_CATEGORIES: &[&str] = &["personal", "system", "database", "cloud", "intranet", "other"];
const PASSWORD_MASK: &str = "••••••••";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialEntry {
    pub id: String,
    pub title: String,
    pub category: String,
    pub environment: String,
    pub username: String,
    pub password: String,
    pub url: Option<String>,
    pub notes: Option<String>,
    pub is_favorite: bool,
    pub sort_order: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialEntryListItem {
    pub id: String,
    pub title: String,
    pub category: String,
    pub environment: String,
    pub username: String,
    pub password_masked: String,
    pub url: Option<String>,
    pub notes: Option<String>,
    pub is_favorite: bool,
    pub sort_order: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct CredentialListFilter {
    pub category: Option<String>,
    pub environment: Option<String>,
    pub favorites_only: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCredentialEntryInput {
    pub title: String,
    pub category: Option<String>,
    pub environment: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub url: Option<String>,
    pub notes: Option<String>,
    pub is_favorite: Option<bool>,
    pub sort_order: Option<i64>,
    /// 一次性 localStorage 迁移
    pub id: Option<String>,
    pub created_at: Option<i64>,
    pub updated_at: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateCredentialEntryPatch {
    pub title: Option<String>,
    pub category: Option<String>,
    pub environment: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub url: Option<String>,
    pub notes: Option<String>,
    pub is_favorite: Option<bool>,
    pub sort_order: Option<i64>,
}

const CREDENTIAL_LIST_SQL: &str =
    "SELECT id, title, category, environment, username, password, url, notes,
            is_favorite, sort_order, created_at, updated_at
     FROM credential_entries
     ORDER BY is_favorite DESC, updated_at DESC";

const CREDENTIAL_BY_ID_SQL: &str =
    "SELECT id, title, category, environment, username, password, url, notes,
            is_favorite, sort_order, created_at, updated_at
     FROM credential_entries WHERE id = ?1";

impl DocumentService {
    pub fn list_credential_entries(
        &self,
        filter: CredentialListFilter,
    ) -> Result<Vec<CredentialEntryListItem>, AppError> {
        let mut stmt = self.conn()?.prepare(CREDENTIAL_LIST_SQL)?;
        let rows = stmt.query_map([], map_credential_row)?;
        let mut items: Vec<CredentialEntryListItem> = rows
            .filter_map(|r| r.ok())
            .map(|row| to_list_item(&row))
            .collect();

        if let Some(ref cat) = filter.category {
            if cat != "all" && cat != "favorites" {
                items.retain(|e| e.category == *cat);
            }
        }
        if filter.category.as_deref() == Some("favorites") || filter.favorites_only == Some(true) {
            items.retain(|e| e.is_favorite);
        }
        if let Some(ref env) = filter.environment {
            if env != "all" {
                items.retain(|e| e.environment == *env);
            }
        }

        Ok(items)
    }

    pub fn get_credential_entry(&self, id: &str) -> Result<CredentialEntry, AppError> {
        self.conn()?
            .query_row(CREDENTIAL_BY_ID_SQL, params![id], map_credential_row)
            .optional()?
            .ok_or_else(|| AppError::CredentialNotFound(id.to_string()))
    }

    pub fn create_credential_entry(
        &mut self,
        input: CreateCredentialEntryInput,
    ) -> Result<CredentialEntry, AppError> {
        let id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
        let now = now_millis();
        let created_at = input.created_at.unwrap_or(now);
        let updated_at = input.updated_at.unwrap_or(now);

        let title = input.title.trim().to_string();
        if title.is_empty() {
            return Err(AppError::CredentialValidation("名称不能为空".into()));
        }
        if title.len() > 120 {
            return Err(AppError::CredentialValidation("名称不能超过 120 字".into()));
        }

        let category = normalize_category(input.category.as_deref().unwrap_or("other"))?;
        let environment = normalize_environment(input.environment.as_deref().unwrap_or("local"))?;
        let username = input.username.unwrap_or_default();
        let password = input.password.unwrap_or_default();
        let url = normalize_optional_text(input.url);
        let notes = normalize_optional_text(input.notes);
        if notes.as_ref().is_some_and(|n| n.len() > 2000) {
            return Err(AppError::CredentialValidation("备注不能超过 2000 字".into()));
        }
        let is_favorite = input.is_favorite.unwrap_or(false);
        let sort_order = input.sort_order.unwrap_or(0);

        self.conn()?.execute(
            "INSERT INTO credential_entries
             (id, title, category, environment, username, password, url, notes,
              is_favorite, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                id,
                title,
                category,
                environment,
                username,
                password,
                url,
                notes,
                is_favorite as i64,
                sort_order,
                created_at,
                updated_at
            ],
        )?;

        self.get_credential_entry(&id)
    }

    pub fn update_credential_entry(
        &mut self,
        id: &str,
        patch: UpdateCredentialEntryPatch,
    ) -> Result<CredentialEntry, AppError> {
        let existing = self.get_credential_entry(id)?;
        let now = now_millis();

        let title = patch
            .title
            .map(|t| t.trim().to_string())
            .unwrap_or(existing.title);
        if title.is_empty() {
            return Err(AppError::CredentialValidation("名称不能为空".into()));
        }
        if title.len() > 120 {
            return Err(AppError::CredentialValidation("名称不能超过 120 字".into()));
        }

        let category = if let Some(c) = patch.category {
            normalize_category(&c)?
        } else {
            existing.category
        };
        let environment = if let Some(e) = patch.environment {
            normalize_environment(&e)?
        } else {
            existing.environment
        };
        let username = patch.username.unwrap_or(existing.username);
        let password = patch.password.unwrap_or(existing.password);
        let url = if patch.url.is_some() {
            normalize_optional_text(patch.url)
        } else {
            existing.url
        };
        let notes = if patch.notes.is_some() {
            let n = normalize_optional_text(patch.notes);
            if n.as_ref().is_some_and(|v| v.len() > 2000) {
                return Err(AppError::CredentialValidation("备注不能超过 2000 字".into()));
            }
            n
        } else {
            existing.notes
        };
        let is_favorite = patch.is_favorite.unwrap_or(existing.is_favorite);
        let sort_order = patch.sort_order.unwrap_or(existing.sort_order);

        let updated = self.conn_mut()?.execute(
            "UPDATE credential_entries SET
             title = ?1, category = ?2, environment = ?3, username = ?4, password = ?5,
             url = ?6, notes = ?7, is_favorite = ?8, sort_order = ?9, updated_at = ?10
             WHERE id = ?11",
            params![
                title,
                category,
                environment,
                username,
                password,
                url,
                notes,
                is_favorite as i64,
                sort_order,
                now,
                id
            ],
        )?;

        if updated == 0 {
            return Err(AppError::CredentialNotFound(id.to_string()));
        }

        self.get_credential_entry(id)
    }

    pub fn delete_credential_entry(&mut self, id: &str) -> Result<(), AppError> {
        let deleted = self
            .conn_mut()?
            .execute("DELETE FROM credential_entries WHERE id = ?1", params![id])?;
        if deleted == 0 {
            return Err(AppError::CredentialNotFound(id.to_string()));
        }
        Ok(())
    }
}

fn map_credential_row(row: &Row<'_>) -> rusqlite::Result<CredentialEntry> {
    Ok(CredentialEntry {
        id: row.get(0)?,
        title: row.get(1)?,
        category: row.get(2)?,
        environment: row.get(3)?,
        username: row.get(4)?,
        password: row.get(5)?,
        url: row.get(6)?,
        notes: row.get(7)?,
        is_favorite: row.get::<_, i64>(8)? != 0,
        sort_order: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
    })
}

fn to_list_item(entry: &CredentialEntry) -> CredentialEntryListItem {
    CredentialEntryListItem {
        id: entry.id.clone(),
        title: entry.title.clone(),
        category: entry.category.clone(),
        environment: entry.environment.clone(),
        username: entry.username.clone(),
        password_masked: if entry.password.is_empty() {
            String::new()
        } else {
            PASSWORD_MASK.to_string()
        },
        url: entry.url.clone(),
        notes: entry.notes.clone(),
        is_favorite: entry.is_favorite,
        sort_order: entry.sort_order,
        created_at: entry.created_at,
        updated_at: entry.updated_at,
    }
}

fn normalize_environment(value: &str) -> Result<String, AppError> {
    let v = value.trim();
    if VALID_ENVIRONMENTS.contains(&v) {
        Ok(v.to_string())
    } else {
        Err(AppError::CredentialValidation(format!(
            "无效的环境标签: {v}"
        )))
    }
}

fn normalize_category(value: &str) -> Result<String, AppError> {
    let v = value.trim();
    if VALID_CATEGORIES.contains(&v) {
        Ok(v.to_string())
    } else {
        Err(AppError::CredentialValidation(format!(
            "无效的分类: {v}"
        )))
    }
}

fn normalize_optional_text(value: Option<String>) -> Option<String> {
    value.and_then(|v| {
        let t = v.trim().to_string();
        if t.is_empty() {
            None
        } else {
            Some(t)
        }
    })
}

fn now_millis() -> i64 {
    Local::now().timestamp_millis()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use std::env;
    use std::path::PathBuf;
    use uuid::Uuid;

    fn test_service() -> (DocumentService, PathBuf) {
        let dir = env::temp_dir().join(format!("lizhi-credential-test-{}", Uuid::new_v4()));
        db::init(&dir).unwrap();
        let mut svc = DocumentService::new(dir.clone());
        svc.connect_plaintext().unwrap();
        (svc, dir)
    }

    #[test]
    fn crud_credential_entries() {
        let (mut svc, dir) = test_service();

        let entry = svc
            .create_credential_entry(CreateCredentialEntryInput {
                title: "生产 MySQL".into(),
                category: Some("database".into()),
                environment: Some("prod".into()),
                username: Some("root".into()),
                password: Some("secret".into()),
                url: Some("db.prod.local:3306".into()),
                notes: None,
                is_favorite: Some(true),
                sort_order: None,
                id: None,
                created_at: None,
                updated_at: None,
            })
            .unwrap();
        assert_eq!(entry.environment, "prod");

        let list = svc
            .list_credential_entries(CredentialListFilter {
                environment: Some("prod".into()),
                ..Default::default()
            })
            .unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].password_masked, PASSWORD_MASK);

        let full = svc.get_credential_entry(&entry.id).unwrap();
        assert_eq!(full.password, "secret");

        svc.delete_credential_entry(&entry.id).unwrap();
        assert!(svc
            .list_credential_entries(CredentialListFilter::default())
            .unwrap()
            .is_empty());

        let _ = std::fs::remove_dir_all(dir);
    }
}
