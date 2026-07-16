use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::documents::DocumentService;
use crate::AppError;

// ── Domain types ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestionOption {
    pub label: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Question {
    pub id: String,
    pub r#type: String,
    pub title: String,
    pub options: Vec<QuestionOption>,
    pub correct_answer: Vec<String>,
    pub explanation: String,
    pub tags: Vec<String>,
    pub source: String,
    pub difficulty: u8,
    pub sort_order: i32,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateQuestionInput {
    pub r#type: String,
    pub title: String,
    pub options: Vec<QuestionOption>,
    pub correct_answer: Vec<String>,
    #[serde(default)]
    pub explanation: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub source: String,
    #[serde(default)]
    pub difficulty: u8,
    pub id: Option<String>,
    pub sort_order: Option<i32>,
    pub created_at: Option<i64>,
    pub updated_at: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateQuestionPatch {
    pub r#type: Option<String>,
    pub title: Option<String>,
    pub options: Option<Vec<QuestionOption>>,
    pub correct_answer: Option<Vec<String>>,
    pub explanation: Option<String>,
    pub tags: Option<Vec<String>>,
    pub source: Option<String>,
    pub difficulty: Option<u8>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestionSearchParams {
    pub keyword: Option<String>,
    pub r#type: Option<String>,
    pub tags: Option<Vec<String>>,
    pub difficulty: Option<u8>,
    /// default | created_desc | created_asc | updated_desc
    pub sort_by: Option<String>,
    pub page: u32,
    pub page_size: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestionSearchResult {
    pub items: Vec<Question>,
    pub total: u32,
    pub page: u32,
    pub page_size: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchImportResult {
    pub imported: u32,
    pub skipped: u32,
    pub failed: u32,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub imported: u32,
    pub updated: u32,
    pub skipped: u32,
    pub total: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestionBankStats {
    pub total: u32,
    pub by_type: Vec<TypeCount>,
    pub by_difficulty: Vec<DifficultyCount>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TypeCount {
    pub r#type: String,
    pub count: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DifficultyCount {
    pub difficulty: u8,
    pub count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestionExportData {
    pub version: String,
    pub exported_at: String,
    pub total: u32,
    pub questions: Vec<Question>,
}

// ── SQL ───────────────────────────────────────────────────────

const Q_BY_ID: &str = "SELECT id, type, title, options, correct_answer, explanation, \
     tags, source, difficulty, sort_order, created_at, updated_at FROM question_bank WHERE id = ?1";

const Q_LIST: &str = "SELECT id, type, title, options, correct_answer, explanation, \
     tags, source, difficulty, sort_order, created_at, updated_at \
     FROM question_bank ORDER BY sort_order, created_at DESC";

fn order_by_clause(sort_by: Option<&str>) -> &'static str {
    match sort_by.unwrap_or("default") {
        "created_desc" => "created_at DESC, sort_order ASC",
        "created_asc" => "created_at ASC, sort_order ASC",
        "updated_desc" => "updated_at DESC, created_at DESC",
        _ => "sort_order ASC, created_at DESC",
    }
}

// ── DocumentService impl ──────────────────────────────────────

impl DocumentService {
    // ── CRUD ──────────────────────────────────────────────

    pub fn list_questions(&self) -> Result<Vec<Question>, AppError> {
        let mut stmt = self.conn()?.prepare(Q_LIST)?;
        let rows = stmt.query_map([], map_question_row)?;
        rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
    }

    pub fn get_question(&self, id: &str) -> Result<Question, AppError> {
        self.conn()?
            .query_row(Q_BY_ID, params![id], map_question_row)
            .optional()?
            .ok_or_else(|| AppError::QuestionNotFound(id.to_string()))
    }

    pub fn create_question(&mut self, input: CreateQuestionInput) -> Result<Question, AppError> {
        let id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
        let now = now_millis();
        let created_at = input.created_at.unwrap_or(now);
        let updated_at = input.updated_at.unwrap_or(now);

        let title = input.title.trim().to_string();
        if title.is_empty() {
            return Err(AppError::QuestionValidation("题干不能为空".into()));
        }

        let r#type = validate_question_type(&input.r#type)?;
        validate_options_for_type(&r#type, &input.options)?;
        validate_correct_answer(&r#type, &input.options, &input.correct_answer)?;

        let sort_order = input.sort_order.unwrap_or(0);
        let options_json = serde_json::to_string(&input.options).unwrap_or_default();
        let correct_answer_json = serde_json::to_string(&input.correct_answer).unwrap_or_default();
        let tags_json = serde_json::to_string(&input.tags).unwrap_or_default();

        self.conn()?.execute(
            "INSERT INTO question_bank (id, type, title, options, correct_answer, explanation, \
             tags, source, difficulty, sort_order, created_at, updated_at) \
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
            params![
                id, r#type, title, options_json, correct_answer_json,
                input.explanation, tags_json, input.source, input.difficulty.min(3),
                sort_order, created_at, updated_at,
            ],
        )?;

        self.get_question(&id)
    }

    pub fn update_question(&mut self, id: &str, patch: UpdateQuestionPatch) -> Result<Question, AppError> {
        let existing = self.get_question(id)?;

        let r#type = match &patch.r#type {
            Some(t) => validate_question_type(t)?,
            None => existing.r#type.clone(),
        };
        let options = patch.options.clone().unwrap_or(existing.options.clone());
        let correct_answer = patch.correct_answer.clone().unwrap_or(existing.correct_answer.clone());

        validate_options_for_type(&r#type, &options)?;
        validate_correct_answer(&r#type, &options, &correct_answer)?;

        let title = patch.title.map(|s| s.trim().to_string()).unwrap_or(existing.title);
        if title.is_empty() {
            return Err(AppError::QuestionValidation("题干不能为空".into()));
        }

        let explanation = patch.explanation.unwrap_or(existing.explanation);
        let tags = patch.tags.unwrap_or(existing.tags);
        let source = patch.source.unwrap_or(existing.source);
        let difficulty = patch.difficulty.unwrap_or(existing.difficulty).min(3);
        let sort_order = patch.sort_order.unwrap_or(existing.sort_order);
        let now = now_millis();

        let options_json = serde_json::to_string(&options).unwrap_or_default();
        let correct_answer_json = serde_json::to_string(&correct_answer).unwrap_or_default();
        let tags_json = serde_json::to_string(&tags).unwrap_or_default();

        let updated = self.conn_mut()?.execute(
            "UPDATE question_bank SET type=?1, title=?2, options=?3, correct_answer=?4, \
             explanation=?5, tags=?6, source=?7, difficulty=?8, sort_order=?9, updated_at=?10 WHERE id=?11",
            params![
                r#type, title, options_json, correct_answer_json,
                explanation, tags_json, source, difficulty, sort_order, now, id,
            ],
        )?;

        if updated == 0 {
            return Err(AppError::QuestionNotFound(id.to_string()));
        }

        self.get_question(id)
    }

    pub fn delete_question(&mut self, id: &str) -> Result<(), AppError> {
        let deleted = self.conn_mut()?.execute("DELETE FROM question_bank WHERE id = ?1", params![id])?;
        if deleted == 0 {
            return Err(AppError::QuestionNotFound(id.to_string()));
        }
        Ok(())
    }

    /// Clear entire question bank. Returns number of deleted rows.
    pub fn clear_all_questions(&mut self) -> Result<u32, AppError> {
        let count: u32 = self.conn()?.query_row(
            "SELECT COUNT(*) FROM question_bank",
            [],
            |row| row.get(0),
        )?;
        self.conn_mut()?.execute("DELETE FROM question_bank", [])?;
        // Keep FTS content table consistent even if triggers miss edge cases
        let _ = self.conn_mut()?.execute("DELETE FROM question_bank_fts", []);
        Ok(count)
    }

    // ── Search ────────────────────────────────────────────

    pub fn search_questions(&self, params: &QuestionSearchParams) -> Result<QuestionSearchResult, AppError> {
        let page = params.page.max(1);
        let page_size = params.page_size.max(1).min(100);
        let offset = (page - 1) * page_size;
        let has_keyword = params.keyword.as_ref().map(|s| !s.trim().is_empty()).unwrap_or(false);

        if has_keyword {
            self.search_fts(params, page, page_size, offset)
        } else {
            self.search_simple(params, page, page_size, offset)
        }
    }

    /// Keyword search via LIKE substring match.
    ///
    /// FTS5 unicode61 treats a continuous CJK run as a single token, so prefix
    /// queries like `"线程不安全"*` miss titles such as `Map类集合中线程不安全的是`.
    /// LIKE substring matching is reliable for Chinese and fine at current scale.
    fn search_fts(
        &self,
        params: &QuestionSearchParams,
        page: u32,
        page_size: u32,
        offset: u32,
    ) -> Result<QuestionSearchResult, AppError> {
        let keyword = params.keyword.as_deref().unwrap_or("").trim();
        let like_pat = format!("%{}%", escape_like_pattern(keyword));
        let conn = self.conn()?;

        let mut where_parts: Vec<String> = vec![
            "(title LIKE ?1 ESCAPE '\\' OR explanation LIKE ?1 ESCAPE '\\' \
              OR tags LIKE ?1 ESCAPE '\\' OR options LIKE ?1 ESCAPE '\\' \
              OR source LIKE ?1 ESCAPE '\\')"
                .into(),
        ];
        let mut bind_values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(like_pat)];

        if let Some(ref t) = params.r#type {
            where_parts.push(format!("type = ?{}", bind_values.len() + 1));
            bind_values.push(Box::new(t.clone()));
        }
        if let Some(d) = params.difficulty {
            where_parts.push(format!("difficulty = ?{}", bind_values.len() + 1));
            bind_values.push(Box::new(d));
        }

        let where_sql = where_parts.join(" AND ");
        let refs: Vec<&dyn rusqlite::types::ToSql> = bind_values.iter().map(|b| b.as_ref()).collect();

        let count_sql = format!("SELECT COUNT(*) FROM question_bank WHERE {where_sql}");
        let total: u32 = conn.query_row(&count_sql, refs.as_slice(), |r| r.get(0))?;

        let order_sql = order_by_clause(params.sort_by.as_deref());
        let data_sql = format!(
            "SELECT id, type, title, options, correct_answer, explanation, \
             tags, source, difficulty, sort_order, created_at, updated_at \
             FROM question_bank WHERE {where_sql} \
             ORDER BY \
               CASE WHEN title LIKE ?1 ESCAPE '\\' THEN 0 ELSE 1 END, \
               {order_sql} \
             LIMIT {page_size} OFFSET {offset}"
        );
        let mut stmt = conn.prepare(&data_sql)?;
        let items = stmt
            .query_map(refs.as_slice(), map_question_row)?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(QuestionSearchResult {
            items,
            total,
            page,
            page_size,
        })
    }

    fn search_simple(
        &self,
        params: &QuestionSearchParams,
        page: u32,
        page_size: u32,
        offset: u32,
    ) -> Result<QuestionSearchResult, AppError> {
        let conn = self.conn()?;

        // Build WHERE clause and params dynamically
        let mut where_parts: Vec<String> = Vec::new();
        let mut bind_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(ref t) = params.r#type {
            where_parts.push(format!("type = ?{}", bind_values.len() + 1));
            bind_values.push(Box::new(t.clone()));
        }
        if let Some(d) = params.difficulty {
            where_parts.push(format!("difficulty = ?{}", bind_values.len() + 1));
            bind_values.push(Box::new(d));
        }

        let where_sql = if where_parts.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", where_parts.join(" AND "))
        };

        let refs: Vec<&dyn rusqlite::types::ToSql> = bind_values.iter().map(|b| b.as_ref()).collect();

        let count_sql = format!("SELECT COUNT(*) FROM question_bank {where_sql}");
        let total: u32 = if refs.is_empty() {
            conn.query_row(&count_sql, [], |r| r.get(0))?
        } else {
            conn.query_row(&count_sql, refs.as_slice(), |r| r.get(0))?
        };

        let order_sql = order_by_clause(params.sort_by.as_deref());
        let data_sql = format!(
            "SELECT id, type, title, options, correct_answer, explanation, \
             tags, source, difficulty, sort_order, created_at, updated_at \
             FROM question_bank {where_sql} \
             ORDER BY {order_sql} LIMIT {page_size} OFFSET {offset}"
        );
        let mut stmt = conn.prepare(&data_sql)?;
        let items = if refs.is_empty() {
            stmt.query_map([], map_question_row)?.collect::<Result<Vec<_>, _>>()?
        } else {
            stmt.query_map(refs.as_slice(), map_question_row)?.collect::<Result<Vec<_>, _>>()?
        };

        Ok(QuestionSearchResult { items, total, page, page_size })
    }

    // ── Batch operations ──────────────────────────────────

    pub fn batch_import_questions(&mut self, inputs: Vec<CreateQuestionInput>) -> Result<BatchImportResult, AppError> {
        let mut imported = 0u32;
        let mut skipped = 0u32;
        let mut failed = 0u32;
        let mut errors: Vec<String> = Vec::new();

        for input in inputs {
            // Skip entries with empty title
            if input.title.trim().is_empty() {
                skipped += 1;
                errors.push("题干为空，已跳过".into());
                continue;
            }
            match self.create_question(input) {
                Ok(_) => imported += 1,
                Err(e) => {
                    failed += 1;
                    errors.push(e.to_string());
                }
            }
        }

        Ok(BatchImportResult { imported, skipped, failed, errors })
    }

    pub fn export_all_questions(&self) -> Result<QuestionExportData, AppError> {
        let questions = self.list_questions()?;
        let total = questions.len() as u32;
        let exported_at = chrono::Utc::now().to_rfc3339();
        Ok(QuestionExportData { version: "1.0.0".into(), exported_at, total, questions })
    }

    pub fn import_questions_from_json(&mut self, json_data: &str, mode: &str) -> Result<ImportResult, AppError> {
        let data: QuestionExportData = serde_json::from_str(json_data)
            .map_err(|e| AppError::QuestionValidation(format!("JSON 解析失败: {e}")))?;

        let existing_map: std::collections::HashMap<String, Question> = self
            .list_questions()?
            .into_iter()
            .map(|q| (q.id.clone(), q))
            .collect();

        let is_replace = mode == "replace";
        let mut imported = 0u32;
        let mut updated = 0u32;
        let mut skipped = 0u32;

        if is_replace {
            self.conn_mut()?.execute("DELETE FROM question_bank", [])?;
            let _ = self.conn_mut()?.execute("DELETE FROM question_bank_fts", []);

            for q in &data.questions {
                let input = question_to_create_input(q);
                match self.create_question(input) {
                    Ok(_) => imported += 1,
                    Err(_) => skipped += 1,
                }
            }
        } else {
            for q in &data.questions {
                if existing_map.contains_key(&q.id) {
                    let patch = UpdateQuestionPatch {
                        r#type: Some(q.r#type.clone()),
                        title: Some(q.title.clone()),
                        options: Some(q.options.clone()),
                        correct_answer: Some(q.correct_answer.clone()),
                        explanation: Some(q.explanation.clone()),
                        tags: Some(q.tags.clone()),
                        source: Some(q.source.clone()),
                        difficulty: Some(q.difficulty),
                        sort_order: Some(q.sort_order),
                    };
                    match self.update_question(&q.id, patch) {
                        Ok(_) => updated += 1,
                        Err(_) => skipped += 1,
                    }
                } else {
                    let input = question_to_create_input(q);
                    match self.create_question(input) {
                        Ok(_) => imported += 1,
                        Err(_) => skipped += 1,
                    }
                }
            }
        }

        Ok(ImportResult { imported, updated, skipped, total: data.questions.len() as u32 })
    }

    // ── Stats ─────────────────────────────────────────────

    pub fn get_question_bank_stats(&self) -> Result<QuestionBankStats, AppError> {
        let conn = self.conn()?;

        let total: u32 = conn.query_row("SELECT COUNT(*) FROM question_bank", [], |row| row.get(0))?;

        let mut by_type_stmt =
            conn.prepare("SELECT type, COUNT(*) as cnt FROM question_bank GROUP BY type")?;
        let by_type: Vec<TypeCount> = by_type_stmt
            .query_map([], |row| Ok(TypeCount { r#type: row.get(0)?, count: row.get(1)? }))?
            .collect::<Result<Vec<_>, _>>()?;

        let mut by_diff_stmt = conn.prepare(
            "SELECT difficulty, COUNT(*) as cnt FROM question_bank GROUP BY difficulty ORDER BY difficulty",
        )?;
        let by_difficulty: Vec<DifficultyCount> = by_diff_stmt
            .query_map([], |row| Ok(DifficultyCount { difficulty: row.get(0)?, count: row.get(1)? }))?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(QuestionBankStats { total, by_type, by_difficulty })
    }
}

// ── Row mapping ───────────────────────────────────────────────

fn map_question_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Question> {
    let options_json: String = row.get(3)?;
    let correct_json: String = row.get(4)?;
    let tags_json: String = row.get(6)?;

    Ok(Question {
        id: row.get(0)?,
        r#type: row.get(1)?,
        title: row.get(2)?,
        options: serde_json::from_str(&options_json).unwrap_or_default(),
        correct_answer: serde_json::from_str(&correct_json).unwrap_or_default(),
        explanation: row.get(5)?,
        tags: serde_json::from_str(&tags_json).unwrap_or_default(),
        source: row.get(7)?,
        difficulty: row.get(8)?,
        sort_order: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
    })
}

// ── Helpers ───────────────────────────────────────────────────

fn now_millis() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

fn validate_question_type(t: &str) -> Result<String, AppError> {
    match t {
        "single" | "multi" | "truefalse" => Ok(t.to_string()),
        other => Err(AppError::QuestionValidation(format!(
            "不支持的题型: {other}，仅支持 single / multi / truefalse"
        ))),
    }
}

fn validate_options_for_type(qtype: &str, options: &[QuestionOption]) -> Result<(), AppError> {
    if qtype == "truefalse" {
        let has_true = options.iter().any(|o| o.label == "true");
        let has_false = options.iter().any(|o| o.label == "false");
        if !has_true || !has_false {
            return Err(AppError::QuestionValidation("判断题需要包含 true/false 两个选项".into()));
        }
    } else if options.len() < 2 {
        return Err(AppError::QuestionValidation("选择题至少需要 2 个选项".into()));
    }
    Ok(())
}

fn validate_correct_answer(qtype: &str, options: &[QuestionOption], answers: &[String]) -> Result<(), AppError> {
    if answers.is_empty() {
        return Err(AppError::QuestionValidation("正确答案不能为空".into()));
    }

    match qtype {
        "single" => {
            if answers.len() != 1 {
                return Err(AppError::QuestionValidation("单选题只能有一个正确答案".into()));
            }
            let valid_labels: Vec<&str> = options.iter().map(|o| o.label.as_str()).collect();
            if !valid_labels.contains(&answers[0].as_str()) {
                return Err(AppError::QuestionValidation(format!("正确答案「{}」不在选项中", answers[0])));
            }
        }
        "multi" => {
            let valid_labels: Vec<&str> = options.iter().map(|o| o.label.as_str()).collect();
            for answer in answers {
                if !valid_labels.contains(&answer.as_str()) {
                    return Err(AppError::QuestionValidation(format!("正确答案「{answer}」不在选项中")));
                }
            }
        }
        "truefalse" => {
            for answer in answers {
                if answer != "true" && answer != "false" {
                    return Err(AppError::QuestionValidation(format!(
                        "判断题答案必须为 true 或 false，得到: {answer}"
                    )));
                }
            }
        }
        _ => {}
    }

    Ok(())
}

/// Escape `%`, `_`, and `\` for SQLite LIKE … ESCAPE '\'.
fn escape_like_pattern(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    for ch in raw.chars() {
        match ch {
            '\\' | '%' | '_' => {
                out.push('\\');
                out.push(ch);
            }
            _ => out.push(ch),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::escape_like_pattern;
    use rusqlite::Connection;

    #[test]
    fn escapes_like_special_chars() {
        assert_eq!(escape_like_pattern("a%b_c\\d"), r"a\%b\_c\\d");
        assert_eq!(escape_like_pattern("线程不安全"), "线程不安全");
    }

    /// Regression: CJK substring inside a longer title must match (FTS unicode61 prefix fails here).
    #[test]
    fn like_finds_cjk_substring_in_title() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE question_bank (
                id TEXT PRIMARY KEY, type TEXT, title TEXT, options TEXT,
                correct_answer TEXT, explanation TEXT, tags TEXT, source TEXT,
                difficulty INTEGER, sort_order INTEGER, created_at INTEGER, updated_at INTEGER
            );",
        )
        .unwrap();
        conn.execute(
            "INSERT INTO question_bank VALUES (
                '1','multi','Map类集合中线程不安全的是：()',
                '[{\"label\":\"A\",\"text\":\"HashMap\"}]','[\"A\"]','','[]','',0,0,1,1
            )",
            [],
        )
        .unwrap();

        let like = format!("%{}%", escape_like_pattern("线程不安全"));
        let count: u32 = conn
            .query_row(
                "SELECT COUNT(*) FROM question_bank WHERE title LIKE ?1 ESCAPE '\\'",
                [like],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }
}

fn question_to_create_input(q: &Question) -> CreateQuestionInput {
    CreateQuestionInput {
        r#type: q.r#type.clone(),
        title: q.title.clone(),
        options: q.options.clone(),
        correct_answer: q.correct_answer.clone(),
        explanation: q.explanation.clone(),
        tags: q.tags.clone(),
        source: q.source.clone(),
        difficulty: q.difficulty,
        id: Some(q.id.clone()),
        sort_order: Some(q.sort_order),
        created_at: Some(q.created_at),
        updated_at: Some(q.updated_at),
    }
}
