use rusqlite::{params, Connection};

use crate::documents::SearchHit;
use crate::text_util::{
    best_matching_term, extract_search_terms, markdown_to_plain_text, score_search_hit,
    search_snippet, text_matches_any_term, text_matches_query,
};
use crate::AppError;

const FTS_DDL: &str = "
CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
    document_id UNINDEXED,
    title,
    body,
    tokenize='unicode61'
);
";

const FTS_INDEX_FORMAT_VERSION: i64 = 2;

pub fn ensure_fts_schema(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(FTS_DDL)?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS search_index_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;
    Ok(())
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

    Ok(hits)
}

fn fts_search(
    conn: &Connection,
    terms: &[String],
    raw_query: &str,
    limit: usize,
) -> Result<Vec<SearchHit>, AppError> {
    let fts_query = build_fts_query(terms);
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

    hits.sort_by(|a, b| b.score.cmp(&a.score));
    hits.truncate(limit);
    Ok(hits)
}

fn build_fts_query(terms: &[String]) -> String {
    terms
        .iter()
        .map(|term| {
            let escaped = term.replace('"', "");
            if escaped.is_empty() {
                String::new()
            } else {
                format!("\"{escaped}\"*")
            }
        })
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join(" OR ")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::text_util::extract_search_terms;

    #[test]
    fn builds_fts_query() {
        let terms = extract_search_terms("hello world");
        assert_eq!(build_fts_query(&terms), "\"hello\"* OR \"world\"*");
    }

    #[test]
    fn builds_fts_query_for_hyphenated_term() {
        let terms = extract_search_terms("SD-WAN");
        let q = build_fts_query(&terms);
        assert!(q.contains("\"sd\"*"));
        assert!(q.contains("\"wan\"*"));
    }
}
