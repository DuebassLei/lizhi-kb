use chrono::Local;
use rusqlite::{params, OptionalExtension, Row, Transaction};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::documents::DocumentService;
use crate::AppError;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct MubuDecor {
    pub bold: bool,
    pub italic: bool,
    pub underline: bool,
    pub strike: bool,
    pub color: Option<String>,
    pub highlight: Option<String>,
    pub icon: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MubuDoc {
    pub id: String,
    pub title: String,
    pub style_json: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MubuNode {
    pub id: String,
    pub doc_id: String,
    pub parent_id: Option<String>,
    pub sort_order: i32,
    pub text: String,
    /// 保留列；产品已停用备注，读写恒为空串
    pub note: String,
    pub collapsed: bool,
    pub is_todo: bool,
    pub is_done: bool,
    pub heading_level: i32,
    pub decor: MubuDecor,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateMubuDocInput {
    pub title: Option<String>,
    pub id: Option<String>,
    pub created_at: Option<i64>,
    pub updated_at: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateMubuDocPatch {
    pub title: Option<String>,
    pub style_json: Option<Option<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveMubuTreeInput {
    pub nodes: Vec<MubuNodeInput>,
    pub title: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MubuNodeInput {
    pub id: String,
    pub parent_id: Option<String>,
    pub sort_order: i32,
    pub text: String,
    pub collapsed: Option<bool>,
    pub is_todo: Option<bool>,
    pub is_done: Option<bool>,
    pub heading_level: Option<i32>,
    pub decor: Option<MubuDecor>,
    pub created_at: Option<i64>,
    pub updated_at: Option<i64>,
}

const DOC_LIST_SQL: &str =
    "SELECT id, title, style_json, created_at, updated_at FROM mubu_docs ORDER BY updated_at DESC";

const DOC_BY_ID_SQL: &str =
    "SELECT id, title, style_json, created_at, updated_at FROM mubu_docs WHERE id = ?1";

const NODES_BY_DOC_SQL: &str = "SELECT id, doc_id, parent_id, sort_order, text, note, collapsed,
     is_todo, is_done, heading_level, decor_json, created_at, updated_at
     FROM mubu_nodes WHERE doc_id = ?1
     ORDER BY parent_id IS NOT NULL, sort_order ASC, created_at ASC";

impl DocumentService {
    pub fn list_mubu_docs(&self) -> Result<Vec<MubuDoc>, AppError> {
        let mut stmt = self.conn()?.prepare(DOC_LIST_SQL)?;
        let rows = stmt.query_map([], map_doc_row)?;
        rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
    }

    pub fn create_mubu_doc(&mut self, input: CreateMubuDocInput) -> Result<MubuDoc, AppError> {
        let id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
        let now = now_millis();
        let created_at = input.created_at.unwrap_or(now);
        let updated_at = input.updated_at.unwrap_or(now);
        let title = input
            .title
            .map(|t| t.trim().to_string())
            .filter(|t| !t.is_empty())
            .unwrap_or_else(|| "未命名".to_string());

        let root_id = Uuid::new_v4().to_string();
        let conn = self.conn_mut()?;
        let tx = conn.unchecked_transaction()?;
        tx.execute(
            "INSERT INTO mubu_docs (id, title, style_json, created_at, updated_at)
             VALUES (?1, ?2, NULL, ?3, ?4)",
            params![id, title, created_at, updated_at],
        )?;
        tx.execute(
            "INSERT INTO mubu_nodes
             (id, doc_id, parent_id, sort_order, text, note, collapsed,
              is_todo, is_done, heading_level, decor_json, created_at, updated_at)
             VALUES (?1, ?2, NULL, 0, ?3, '', 0, 0, 0, 0, NULL, ?4, ?5)",
            params![root_id, id, title, created_at, updated_at],
        )?;
        tx.commit()?;

        self.get_mubu_doc(&id)
    }

    pub fn update_mubu_doc(
        &mut self,
        id: &str,
        patch: UpdateMubuDocPatch,
    ) -> Result<MubuDoc, AppError> {
        let existing = self.get_mubu_doc(id)?;
        let now = now_millis();
        let title = patch
            .title
            .map(|t| t.trim().to_string())
            .filter(|t| !t.is_empty())
            .unwrap_or(existing.title);
        let style_json = match patch.style_json {
            Some(v) => v,
            None => existing.style_json,
        };

        let updated = self.conn_mut()?.execute(
            "UPDATE mubu_docs SET title = ?1, style_json = ?2, updated_at = ?3 WHERE id = ?4",
            params![title, style_json, now, id],
        )?;
        if updated == 0 {
            return Err(AppError::MubuNotFound(id.to_string()));
        }

        let _ = self.conn_mut()?.execute(
            "UPDATE mubu_nodes SET text = ?1, updated_at = ?2
             WHERE doc_id = ?3 AND parent_id IS NULL",
            params![title, now, id],
        );

        self.get_mubu_doc(id)
    }

    pub fn delete_mubu_doc(&mut self, id: &str) -> Result<(), AppError> {
        let deleted = self
            .conn_mut()?
            .execute("DELETE FROM mubu_docs WHERE id = ?1", params![id])?;
        if deleted == 0 {
            return Err(AppError::MubuNotFound(id.to_string()));
        }
        Ok(())
    }

    pub fn get_mubu_tree(&self, doc_id: &str) -> Result<Vec<MubuNode>, AppError> {
        let _ = self.get_mubu_doc(doc_id)?;
        let mut stmt = self.conn()?.prepare(NODES_BY_DOC_SQL)?;
        let rows = stmt.query_map(params![doc_id], map_node_row)?;
        rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
    }

    pub fn save_mubu_tree(
        &mut self,
        doc_id: &str,
        input: SaveMubuTreeInput,
    ) -> Result<MubuDoc, AppError> {
        let existing = self.get_mubu_doc(doc_id)?;
        if input.nodes.is_empty() {
            return Err(AppError::MubuValidation("至少需要一个根主题".into()));
        }

        let roots: Vec<_> = input
            .nodes
            .iter()
            .filter(|n| n.parent_id.is_none())
            .collect();
        if roots.len() != 1 {
            return Err(AppError::MubuValidation("每篇幕布有且仅有一个根主题".into()));
        }

        let id_set: std::collections::HashSet<&str> =
            input.nodes.iter().map(|n| n.id.as_str()).collect();
        if id_set.len() != input.nodes.len() {
            return Err(AppError::MubuValidation("节点 id 重复".into()));
        }
        for n in &input.nodes {
            if let Some(pid) = &n.parent_id {
                if !id_set.contains(pid.as_str()) {
                    return Err(AppError::MubuValidation(format!("父节点不存在: {pid}")));
                }
            }
        }

        let now = now_millis();
        let title = input
            .title
            .map(|t| t.trim().to_string())
            .filter(|t| !t.is_empty())
            .unwrap_or_else(|| {
                let root_text = roots[0].text.trim();
                if root_text.is_empty() {
                    existing.title.clone()
                } else {
                    root_text.to_string()
                }
            });

        let conn = self.conn_mut()?;
        let tx = conn.unchecked_transaction()?;
        replace_nodes_in_tx(&tx, doc_id, &input.nodes, now)?;
        tx.execute(
            "UPDATE mubu_docs SET title = ?1, updated_at = ?2 WHERE id = ?3",
            params![title, now, doc_id],
        )?;
        tx.commit()?;

        self.get_mubu_doc(doc_id)
    }

    fn get_mubu_doc(&self, id: &str) -> Result<MubuDoc, AppError> {
        self.conn()?
            .query_row(DOC_BY_ID_SQL, params![id], map_doc_row)
            .optional()?
            .ok_or_else(|| AppError::MubuNotFound(id.to_string()))
    }
}

pub fn replace_nodes_in_tx(
    tx: &Transaction<'_>,
    doc_id: &str,
    nodes: &[MubuNodeInput],
    now: i64,
) -> Result<(), AppError> {
    tx.execute("DELETE FROM mubu_nodes WHERE doc_id = ?1", params![doc_id])?;
    for n in nodes {
        let collapsed = if n.collapsed.unwrap_or(false) { 1 } else { 0 };
        let is_todo = if n.is_todo.unwrap_or(false) { 1 } else { 0 };
        let is_done = if n.is_done.unwrap_or(false) { 1 } else { 0 };
        let heading = n.heading_level.unwrap_or(0).clamp(0, 3);
        let decor = n.decor.clone().unwrap_or_default();
        let decor_json = serde_json::to_string(&decor).ok();
        let created_at = n.created_at.unwrap_or(now);
        let updated_at = n.updated_at.unwrap_or(now);
        tx.execute(
            "INSERT INTO mubu_nodes
             (id, doc_id, parent_id, sort_order, text, note, collapsed,
              is_todo, is_done, heading_level, decor_json, created_at, updated_at)
             VALUES (?1,?2,?3,?4,?5,'',?6,?7,?8,?9,?10,?11,?12)",
            params![
                n.id,
                doc_id,
                n.parent_id,
                n.sort_order,
                n.text,
                collapsed,
                is_todo,
                is_done,
                heading,
                decor_json,
                created_at,
                updated_at
            ],
        )?;
    }
    Ok(())
}

fn map_doc_row(row: &Row<'_>) -> rusqlite::Result<MubuDoc> {
    Ok(MubuDoc {
        id: row.get(0)?,
        title: row.get(1)?,
        style_json: row.get(2)?,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
    })
}

fn map_node_row(row: &Row<'_>) -> rusqlite::Result<MubuNode> {
    let collapsed_i: i32 = row.get(6)?;
    let is_todo: i32 = row.get(7)?;
    let is_done: i32 = row.get(8)?;
    let heading_level: i32 = row.get(9)?;
    let decor_raw: Option<String> = row.get(10)?;
    let decor = decor_raw
        .as_deref()
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or_default();
    Ok(MubuNode {
        id: row.get(0)?,
        doc_id: row.get(1)?,
        parent_id: row.get(2)?,
        sort_order: row.get(3)?,
        text: row.get(4)?,
        note: String::new(),
        collapsed: collapsed_i != 0,
        is_todo: is_todo != 0,
        is_done: is_done != 0,
        heading_level,
        decor,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
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

    fn test_service() -> (DocumentService, PathBuf) {
        let dir = env::temp_dir().join(format!("lizhi-mubu-test-{}", Uuid::new_v4()));
        db::init(&dir).unwrap();
        let mut svc = DocumentService::new(dir.clone());
        svc.connect_plaintext().unwrap();
        (svc, dir)
    }

    #[test]
    fn crud_and_save_tree_with_decor() {
        let (mut svc, dir) = test_service();
        let doc = svc
            .create_mubu_doc(CreateMubuDocInput {
                title: Some("测试".into()),
                id: None,
                created_at: None,
                updated_at: None,
            })
            .unwrap();
        let tree = svc.get_mubu_tree(&doc.id).unwrap();
        let root = &tree[0];
        let child_id = Uuid::new_v4().to_string();
        svc.save_mubu_tree(
            &doc.id,
            SaveMubuTreeInput {
                title: Some("测试".into()),
                nodes: vec![
                    MubuNodeInput {
                        id: root.id.clone(),
                        parent_id: None,
                        sort_order: 0,
                        text: "测试".into(),
                        collapsed: Some(false),
                        is_todo: Some(false),
                        is_done: Some(false),
                        heading_level: Some(0),
                        decor: None,
                        created_at: Some(root.created_at),
                        updated_at: None,
                    },
                    MubuNodeInput {
                        id: child_id.clone(),
                        parent_id: Some(root.id.clone()),
                        sort_order: 0,
                        text: "子主题".into(),
                        collapsed: Some(false),
                        is_todo: Some(true),
                        is_done: Some(false),
                        heading_level: Some(2),
                        decor: Some(MubuDecor {
                            bold: true,
                            italic: false,
                            underline: false,
                            strike: false,
                            color: None,
                            highlight: Some("rgba(250, 204, 21, 0.45)".into()),
                            icon: Some("⭐".into()),
                        }),
                        created_at: None,
                        updated_at: None,
                    },
                ],
            },
        )
        .unwrap();
        let tree2 = svc.get_mubu_tree(&doc.id).unwrap();
        let child = tree2.iter().find(|n| n.id == child_id).unwrap();
        assert!(child.is_todo);
        assert_eq!(child.heading_level, 2);
        assert!(child.decor.bold);
        assert_eq!(child.decor.icon.as_deref(), Some("⭐"));
        assert!(child.note.is_empty());

        svc.delete_mubu_doc(&doc.id).unwrap();
        let _ = std::fs::remove_dir_all(dir);
    }
}
