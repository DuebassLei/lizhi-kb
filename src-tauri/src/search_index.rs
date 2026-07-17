use rusqlite::{params, Connection};

use crate::documents::SearchHit;
use crate::text_util::{
    best_matching_term, extract_search_terms, markdown_to_plain_text, score_search_hit,
    search_snippet, text_matches_any_term, text_matches_query,
};
use crate::AppError;

const FTS_DDL_TRIGRAM: &str = "
CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
    document_id UNINDEXED,
    title,
    body,
    tokenize='trigram'
);
";

const FTS_DDL_UNICODE61: &str = "
CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
    document_id UNINDEXED,
    title,
    body,
    tokenize='unicode61'
);
";

/// Bumped to 4: FTS body 不含 :::ai-private / ai_exclude 正文（隐私护栏）。
const FTS_INDEX_FORMAT_VERSION: i64 = 4;

pub fn ensure_fts_schema(conn: &Connection) -> Result<(), AppError> {
    let exists: bool = conn
        .query_row(
            "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='documents_fts'",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map(|c| c > 0)
        .unwrap_or(false);

    if !exists {
        create_fts_table(conn)?;
    }

    conn.execute(
        "CREATE TABLE IF NOT EXISTS search_index_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;
    Ok(())
}

/// Create FTS table with trigram tokenizer, falling back to unicode61
/// if trigram is not supported by the bundled SQLite.
fn create_fts_table(conn: &Connection) -> Result<(), AppError> {
    if conn.execute_batch(FTS_DDL_TRIGRAM).is_err() {
        conn.execute_batch(FTS_DDL_UNICODE61)?;
    }
    Ok(())
}

/// Drop and recreate the FTS table. Called during index rebuild to migrate
/// from unicode61 to trigram tokenizer.
pub fn rebuild_fts_table(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch("DROP TABLE IF EXISTS documents_fts")?;
    create_fts_table(conn)?;
    Ok(())
}

/// Check if the FTS table uses the trigram tokenizer.
fn fts_uses_trigram(conn: &Connection) -> bool {
    conn.query_row(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='documents_fts'",
        [],
        |row| row.get::<_, String>(0),
    )
    .map(|sql| sql.to_lowercase().contains("trigram"))
    .unwrap_or(false)
}

pub fn upsert_document(
    conn: &Connection,
    document_id: &str,
    title: &str,
    content: &str,
) -> Result<(), AppError> {
    ensure_fts_schema(conn)?;
    let plain = markdown_to_plain_text(content);
    conn.execute(
        "DELETE FROM documents_fts WHERE document_id = ?1",
        params![document_id],
    )?;
    conn.execute(
        "INSERT INTO documents_fts(document_id, title, body) VALUES (?1, ?2, ?3)",
        params![document_id, title, plain],
    )?;
    Ok(())
}

pub fn remove_document(conn: &Connection, document_id: &str) -> Result<(), AppError> {
    ensure_fts_schema(conn)?;
    conn.execute(
        "DELETE FROM documents_fts WHERE document_id = ?1",
        params![document_id],
    )?;
    Ok(())
}

pub fn needs_rebuild(conn: &Connection) -> Result<bool, AppError> {
    ensure_fts_schema(conn)?;
    let stored_version: String = conn
        .query_row(
            "SELECT value FROM search_index_meta WHERE key = 'fts_format_version'",
            [],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "0".to_string());
    if stored_version.parse::<i64>().unwrap_or(0) < FTS_INDEX_FORMAT_VERSION {
        return Ok(true);
    }
    let doc_count: i64 = conn.query_row("SELECT count(*) FROM documents", [], |row| row.get(0))?;
    let fts_count: i64 = conn
        .query_row("SELECT count(*) FROM documents_fts", [], |row| row.get(0))
        .unwrap_or(0);
    Ok(doc_count != fts_count)
}

pub fn mark_rebuild_complete(conn: &Connection) -> Result<(), AppError> {
    ensure_fts_schema(conn)?;
    conn.execute(
        "INSERT OR REPLACE INTO search_index_meta (key, value) VALUES ('fts_format_version', ?1)",
        params![FTS_INDEX_FORMAT_VERSION.to_string()],
    )?;
    Ok(())
}

pub fn search(
    conn: &Connection,
    query: &str,
    limit: usize,
) -> Result<Vec<SearchHit>, AppError> {
    ensure_fts_schema(conn)?;
    let q = query.trim();
    if q.is_empty() {
        return Ok(Vec::new());
    }

    let terms = extract_search_terms(q);
    let mut hits = fts_search(conn, &terms, q, limit)?;

    if hits.is_empty() {
        hits = fallback_substring_search(conn, &terms, q, limit)?;
    }

    // Final fallback: direct search on documents table (title only).
    // Catches cases where FTS index is out of sync or missing documents entirely.
    if hits.is_empty() {
        hits = direct_title_search(conn, &terms, q, limit)?;
    }

    Ok(hits)
}

fn fts_search(
    conn: &Connection,
    terms: &[String],
    raw_query: &str,
    limit: usize,
) -> Result<Vec<SearchHit>, AppError> {
    let fts_query = build_fts_query(conn, terms);
    if fts_query.is_empty() {
        return Ok(Vec::new());
    }

    let mut stmt = conn.prepare(
        "SELECT f.document_id, d.title,
                snippet(documents_fts, 2, '', '', '…', 64) AS body_snippet,
                bm25(documents_fts) AS rank
         FROM documents_fts f
         JOIN documents d ON d.id = f.document_id
         WHERE documents_fts MATCH ?1
         ORDER BY rank
         LIMIT ?2",
    )?;

    let q_lower = raw_query.to_lowercase();
    let rows = stmt.query_map(params![fts_query, limit as i64], |row| {
        let id: String = row.get(0)?;
        let title: String = row.get(1)?;
        let body_snippet: String = row.get(2)?;
        Ok((id, title, body_snippet))
    })?;

    let mut hits = Vec::new();
    for row in rows {
        let (id, title, body_snippet) = row?;
        let title_match = text_matches_any_term(&title, terms) || title.to_lowercase().contains(&q_lower);
        let body_match = !body_snippet.is_empty();
        let score = score_search_hit(title_match, body_match);
        let match_in = if title_match && body_match {
            "both"
        } else if title_match {
            "title"
        } else {
            "body"
        };
        let snippet_term = best_matching_term(&title, terms)
            .or_else(|| best_matching_term(&body_snippet, terms))
            .unwrap_or(raw_query);
        let snippet = if body_snippet.is_empty() {
            search_snippet(&title, snippet_term, 120)
        } else {
            body_snippet
        };
        hits.push(SearchHit {
            id,
            title,
            snippet,
            match_in: match_in.to_string(),
            score,
        });
    }

    Ok(hits)
}

fn fallback_substring_search(
    conn: &Connection,
    terms: &[String],
    raw_query: &str,
    limit: usize,
) -> Result<Vec<SearchHit>, AppError> {
    if terms.is_empty() {
        return Ok(Vec::new());
    }

    let mut stmt = conn.prepare(
        "SELECT f.document_id, d.title, f.body
         FROM documents_fts f
         JOIN documents d ON d.id = f.document_id
         ORDER BY d.updated_at DESC",
    )?;

    let rows = stmt.query_map([], |row| {
        let id: String = row.get(0)?;
        let title: String = row.get(1)?;
        let body: String = row.get(2)?;
        Ok((id, title, body))
    })?;

    let mut hits = Vec::new();
    for row in rows {
        let (id, title, body) = row?;
        let title_match = text_matches_any_term(&title, terms);
        let body_match = text_matches_any_term(&body, terms);
        if !title_match && !body_match {
            continue;
        }

        let matched = terms
            .iter()
            .filter(|term| {
                text_matches_query(&title, term) || text_matches_query(&body, term)
            })
            .count() as i32;

        let score = score_search_hit(title_match, body_match) + matched * 10;
        let snippet_term = best_matching_term(&body, terms)
            .or_else(|| best_matching_term(&title, terms))
            .unwrap_or(raw_query);
        let snippet = if body_match {
            search_snippet(&body, snippet_term, 120)
        } else {
            search_snippet(&title, snippet_term, 120)
        };

        hits.push(SearchHit {
            id,
            title,
            snippet,
            match_in: if title_match && body_match {
                "both".to_string()
            } else if title_match {
                "title".to_string()
            } else {
                "body".to_string()
            },
            score,
        });
    }

    hits.sort_by_key(|b| std::cmp::Reverse(b.score));
    hits.truncate(limit);
    Ok(hits)
}

/// 直接查 documents 表的标题（不依赖 FTS 索引），作为最终兜底。
fn direct_title_search(
    conn: &Connection,
    terms: &[String],
    raw_query: &str,
    limit: usize,
) -> Result<Vec<SearchHit>, AppError> {
    if terms.is_empty() {
        return Ok(Vec::new());
    }

    let mut stmt = conn.prepare(
        "SELECT id, title FROM documents ORDER BY updated_at DESC",
    )?;

    let rows = stmt.query_map([], |row| {
        let id: String = row.get(0)?;
        let title: String = row.get(1)?;
        Ok((id, title))
    })?;

    let q_lower = raw_query.to_lowercase();
    let mut hits = Vec::new();
    for row in rows {
        let (id, title) = row?;
        let title_ref = title.as_str();
        let title_match =
            text_matches_any_term(title_ref, terms) || title_ref.to_lowercase().contains(&q_lower);
        if !title_match {
            continue;
        }

        let snippet_term = best_matching_term(title_ref, terms).unwrap_or(raw_query);
        let snippet = search_snippet(title_ref, snippet_term, 120);
        hits.push(SearchHit {
            id,
            title,
            snippet,
            match_in: "title".to_string(),
            score: 100,
        });
    }

    hits.sort_by_key(|b| std::cmp::Reverse(b.score));
    hits.truncate(limit);
    Ok(hits)
}

/// 判断字符是否为 CJK 汉字
fn is_cjk_char(ch: char) -> bool {
    matches!(ch,
        '\u{3400}'..='\u{4DBF}'
            | '\u{4E00}'..='\u{9FFF}'
            | '\u{F900}'..='\u{FAFF}'
    )
}

/// Build FTS5 MATCH query string.
///
/// With trigram tokenizer: simple phrase queries (`"大模型"`) — trigram
/// handles CJK substring matching natively, no prefix or splitting needed.
///
/// With unicode61 fallback: prefix queries (`"hello"*`) plus CJK character
/// splitting (`"大" AND "模" AND "型"`) since unicode61 tokenizes CJK into
/// single-character tokens.
fn build_fts_query(conn: &Connection, terms: &[String]) -> String {
    let use_trigram = fts_uses_trigram(conn);

    terms
        .iter()
        .filter_map(|term| {
            let escaped = term.replace('"', "");
            if escaped.is_empty() {
                return None;
            }

            if use_trigram {
                // trigram: simple phrase query, handles CJK substrings natively
                Some(format!("\"{escaped}\""))
            } else {
                // unicode61: need * prefix and CJK character splitting
                let chars: Vec<char> = escaped.chars().collect();
                if chars.len() >= 2 && chars.iter().all(|c| is_cjk_char(*c)) {
                    let char_and: String = chars
                        .iter()
                        .map(|c| format!("\"{c}\""))
                        .collect::<Vec<_>>()
                        .join(" AND ");
                    Some(format!("\"{escaped}\"* OR ({char_and})"))
                } else {
                    Some(format!("\"{escaped}\"*"))
                }
            }
        })
        .collect::<Vec<_>>()
        .join(" OR ")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::text_util::extract_search_terms;

    #[test]
    fn builds_fts_query_trigram() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(FTS_DDL_TRIGRAM).unwrap();
        let terms = extract_search_terms("大模型");
        let q = build_fts_query(&conn, &terms);
        // trigram: simple phrase query, no CJK splitting
        assert!(q.contains("\"大模型\""));
        assert!(!q.contains("AND"));
    }

    #[test]
    fn builds_fts_query_trigram_ascii() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(FTS_DDL_TRIGRAM).unwrap();
        let terms = extract_search_terms("hello world");
        let q = build_fts_query(&conn, &terms);
        assert!(q.contains("\"hello\""));
        assert!(q.contains("\"world\""));
        // trigram doesn't use * prefix
        assert!(!q.contains("*"));
    }

    #[test]
    fn builds_fts_query_unicode61_cjk() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(FTS_DDL_UNICODE61).unwrap();
        let terms = extract_search_terms("大模型");
        let q = build_fts_query(&conn, &terms);
        // unicode61: CJK splitting into individual char AND query
        assert!(q.contains("\"大\" AND \"模\" AND \"型\""));
    }

    #[test]
    fn builds_fts_query_unicode61_ascii() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(FTS_DDL_UNICODE61).unwrap();
        let terms = extract_search_terms("hello world");
        let q = build_fts_query(&conn, &terms);
        assert!(q.contains("\"hello\"*"));
        assert!(q.contains("\"world\"*"));
    }

    #[test]
    fn builds_fts_query_unicode61_hyphenated() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(FTS_DDL_UNICODE61).unwrap();
        let terms = extract_search_terms("SD-WAN");
        let q = build_fts_query(&conn, &terms);
        assert!(q.contains("\"sd\"*"));
        assert!(q.contains("\"wan\"*"));
    }

    #[test]
    fn fts_uses_trigram_detects_tokenizer() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(FTS_DDL_TRIGRAM).unwrap();
        assert!(fts_uses_trigram(&conn));

        let conn2 = Connection::open_in_memory().unwrap();
        conn2.execute_batch(FTS_DDL_UNICODE61).unwrap();
        assert!(!fts_uses_trigram(&conn2));
    }
}
