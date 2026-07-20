use std::collections::{HashMap, HashSet, VecDeque};

use rusqlite::{params, Connection};
use serde::Serialize;

use crate::documents::DocumentMeta;
use crate::search_index;
use crate::text_util::{extract_wiki_links, mentions_title, normalize_title, strip_wiki_links};
use crate::AppError;

const LINKS_DDL: &str = "
CREATE TABLE IF NOT EXISTS document_links (
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    target_title TEXT NOT NULL,
    PRIMARY KEY (source_id, target_id)
);
CREATE INDEX IF NOT EXISTS idx_document_links_target_id ON document_links(target_id);
";

const UNLINKED_DDL: &str = "
CREATE TABLE IF NOT EXISTS document_unlinked (
    target_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    PRIMARY KEY (target_id, source_id)
);
CREATE INDEX IF NOT EXISTS idx_document_unlinked_source ON document_unlinked(source_id);
CREATE TABLE IF NOT EXISTS document_stripped (
    document_id TEXT PRIMARY KEY NOT NULL,
    stripped_text TEXT NOT NULL
);
";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HubRank {
    pub id: String,
    pub title: String,
    pub inbound: i32,
    pub outbound: i32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkStats {
    pub total_links: i64,
    pub orphan_count: usize,
    pub hub_doc: Option<LinkMention>,
    pub top_hubs: Vec<HubRank>,
    pub orphan_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkMention {
    pub id: String,
    pub title: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphNode {
    pub id: String,
    pub title: String,
    pub depth: u32,
    pub x: f64,
    pub y: f64,
    pub is_center: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphEdge {
    pub from: String,
    pub to: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphPayload {
    pub center_id: String,
    pub depth: u32,
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

pub fn ensure_links_schema(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(LINKS_DDL)?;
    conn.execute_batch(UNLINKED_DDL)?;
    Ok(())
}

fn source_has_wiki_link_to(conn: &Connection, source_id: &str, target_title: &str) -> Result<bool, AppError> {
    let titles = get_outbound_titles(conn, source_id)?;
    let target_norm = normalize_title(target_title);
    Ok(titles.iter().any(|t| normalize_title(t) == target_norm))
}

pub fn upsert_unlinked_for_document(
    conn: &Connection,
    source_id: &str,
    content: &str,
    source_title: &str,
    metas: &[DocumentMeta],
) -> Result<(), AppError> {
    ensure_links_schema(conn)?;
    let stripped = strip_wiki_links(content);
    conn.execute(
        "INSERT OR REPLACE INTO document_stripped (document_id, stripped_text) VALUES (?1, ?2)",
        params![source_id, stripped],
    )?;

    conn.execute(
        "DELETE FROM document_unlinked WHERE source_id = ?1",
        params![source_id],
    )?;

    for meta in metas {
        if meta.id == source_id {
            continue;
        }
        if source_has_wiki_link_to(conn, source_id, &meta.title)? {
            continue;
        }
        if mentions_title(&stripped, &meta.title) {
            conn.execute(
                "INSERT OR IGNORE INTO document_unlinked (target_id, source_id) VALUES (?1, ?2)",
                params![meta.id, source_id],
            )?;
        }
    }

    conn.execute(
        "DELETE FROM document_unlinked WHERE target_id = ?1",
        params![source_id],
    )?;

    let title = source_title.trim();
    if title.is_empty() {
        return Ok(());
    }

    for meta in metas {
        if meta.id == source_id {
            continue;
        }
        let stripped_other: String = conn
            .query_row(
                "SELECT stripped_text FROM document_stripped WHERE document_id = ?1",
                params![meta.id],
                |row| row.get(0),
            )
            .unwrap_or_default();
        if stripped_other.is_empty() {
            continue;
        }
        if source_has_wiki_link_to(conn, &meta.id, title)? {
            continue;
        }
        if mentions_title(&stripped_other, title) {
            conn.execute(
                "INSERT OR IGNORE INTO document_unlinked (target_id, source_id) VALUES (?1, ?2)",
                params![source_id, meta.id],
            )?;
        }
    }

    Ok(())
}

pub fn remove_unlinked_for_document(conn: &Connection, document_id: &str) -> Result<(), AppError> {
    ensure_links_schema(conn)?;
    conn.execute(
        "DELETE FROM document_unlinked WHERE source_id = ?1 OR target_id = ?1",
        params![document_id],
    )?;
    conn.execute(
        "DELETE FROM document_stripped WHERE document_id = ?1",
        params![document_id],
    )?;
    Ok(())
}

pub fn get_unlinked_mentions(conn: &Connection, target_id: &str) -> Result<Vec<LinkMention>, AppError> {
    ensure_links_schema(conn)?;
    let mut stmt = conn.prepare(
        "SELECT d.id, d.title
         FROM document_unlinked u
         JOIN documents d ON d.id = u.source_id
         WHERE u.target_id = ?1
         ORDER BY d.title COLLATE NOCASE",
    )?;
    let rows = stmt.query_map(params![target_id], |row| {
        Ok(LinkMention {
            id: row.get(0)?,
            title: row.get(1)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

pub fn get_outbound_links(conn: &Connection, source_id: &str) -> Result<Vec<LinkMention>, AppError> {
    ensure_links_schema(conn)?;
    let mut stmt = conn.prepare(
        "SELECT d.id, d.title
         FROM document_links l
         JOIN documents d ON d.id = l.target_id
         WHERE l.source_id = ?1
         ORDER BY d.title COLLATE NOCASE",
    )?;
    let rows = stmt.query_map(params![source_id], |row| {
        Ok(LinkMention {
            id: row.get(0)?,
            title: row.get(1)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

pub fn get_link_stats(conn: &Connection, metas: &[DocumentMeta]) -> Result<LinkStats, AppError> {
    ensure_links_schema(conn)?;
    let mut hubs = Vec::new();
    let mut orphan_count = 0usize;
    let mut orphan_ids = Vec::new();
    let mut hub_doc: Option<LinkMention> = None;
    let mut max_inbound = 0i32;

    for meta in metas {
        let outbound = get_outbound_links(conn, &meta.id)?.len() as i32;
        let inbound = get_backlinks(conn, &meta.id)?.len() as i32;
        if outbound == 0 && inbound == 0 {
            orphan_count += 1;
            orphan_ids.push(meta.id.clone());
        }
        if inbound > 0 || outbound > 0 {
            hubs.push(HubRank {
                id: meta.id.clone(),
                title: meta.title.clone(),
                inbound,
                outbound,
            });
        }
        if inbound > max_inbound {
            max_inbound = inbound;
            hub_doc = Some(LinkMention {
                id: meta.id.clone(),
                title: meta.title.clone(),
            });
        }
    }

    hubs.sort_by(|a, b| {
        b.inbound
            .cmp(&a.inbound)
            .then_with(|| b.outbound.cmp(&a.outbound))
    });

    let total_links: i64 = conn
        .query_row("SELECT count(*) FROM document_links", [], |row| row.get(0))
        .unwrap_or(0);

    Ok(LinkStats {
        total_links,
        orphan_count,
        hub_doc: if max_inbound > 0 { hub_doc } else { None },
        top_hubs: hubs.into_iter().take(5).collect(),
        orphan_ids,
    })
}

pub fn upsert_links_for_document(
    conn: &Connection,
    source_id: &str,
    content: &str,
    title_to_id: &HashMap<String, String>,
) -> Result<(), AppError> {
    ensure_links_schema(conn)?;
    conn.execute(
        "DELETE FROM document_links WHERE source_id = ?1",
        params![source_id],
    )?;

    for target_title in extract_wiki_links(content) {
        let Some(target_id) = title_to_id.get(&normalize_title(&target_title)) else {
            continue;
        };
        if target_id == source_id {
            continue;
        }
        conn.execute(
            "INSERT OR IGNORE INTO document_links (source_id, target_id, target_title)
             VALUES (?1, ?2, ?3)",
            params![source_id, target_id, target_title],
        )?;
    }
    Ok(())
}

pub fn index_links_and_unlinked(
    conn: &Connection,
    source_id: &str,
    content: &str,
    source_title: &str,
    title_to_id: &HashMap<String, String>,
    metas: &[DocumentMeta],
) -> Result<(), AppError> {
    upsert_links_for_document(conn, source_id, content, title_to_id)?;
    upsert_unlinked_for_document(conn, source_id, content, source_title, metas)
}

pub fn remove_links_for_document(conn: &Connection, source_id: &str) -> Result<(), AppError> {
    ensure_links_schema(conn)?;
    conn.execute(
        "DELETE FROM document_links WHERE source_id = ?1",
        params![source_id],
    )?;
    remove_unlinked_for_document(conn, source_id)
}

/// After a title rename, refresh `target_title` on inbound wiki-link rows
/// without rebuilding the whole link index.
pub fn update_inbound_link_titles(
    conn: &Connection,
    target_id: &str,
    new_title: &str,
) -> Result<(), AppError> {
    ensure_links_schema(conn)?;
    conn.execute(
        "UPDATE document_links SET target_title = ?1 WHERE target_id = ?2",
        params![new_title, target_id],
    )?;
    Ok(())
}

pub fn needs_rebuild(conn: &Connection) -> Result<bool, AppError> {
    ensure_links_schema(conn)?;
    let doc_count: i64 = conn.query_row(
        "SELECT count(*) FROM documents WHERE deleted_at IS NULL",
        [],
        |row| row.get(0),
    )?;
    let source_count: i64 = conn
        .query_row(
            "SELECT count(DISTINCT source_id) FROM document_links",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    Ok(doc_count > 0 && source_count == 0)
}

pub fn get_backlinks(conn: &Connection, document_id: &str) -> Result<Vec<LinkMention>, AppError> {
    ensure_links_schema(conn)?;
    let mut stmt = conn.prepare(
        "SELECT d.id, d.title
         FROM document_links l
         JOIN documents d ON d.id = l.source_id
         WHERE l.target_id = ?1
         ORDER BY d.title COLLATE NOCASE",
    )?;
    let rows = stmt.query_map(params![document_id], |row| {
        Ok(LinkMention {
            id: row.get(0)?,
            title: row.get(1)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

pub fn get_outbound_titles(conn: &Connection, source_id: &str) -> Result<Vec<String>, AppError> {
    ensure_links_schema(conn)?;
    let mut stmt = conn.prepare(
        "SELECT target_title FROM document_links WHERE source_id = ?1 ORDER BY target_title",
    )?;
    let rows = stmt
        .query_map(params![source_id], |row| row.get(0))?
        .collect::<Result<Vec<String>, _>>()?;
    Ok(rows)
}

pub fn build_title_map(metas: &[DocumentMeta]) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for meta in metas {
        map.insert(normalize_title(&meta.title), meta.id.clone());
    }
    map
}

pub fn get_local_graph(
    conn: &Connection,
    metas: &[DocumentMeta],
    center_id: &str,
    depth_limit: u32,
) -> Result<GraphPayload, AppError> {
    ensure_links_schema(conn)?;
    if metas.is_empty() {
        return Ok(empty_graph(center_id, depth_limit));
    }

    let meta_by_id: HashMap<&str, &DocumentMeta> =
        metas.iter().map(|m| (m.id.as_str(), m)).collect();
    if !meta_by_id.contains_key(center_id) {
        return Err(AppError::DocumentNotFound(center_id.to_string()));
    }

    let mut node_depth: HashMap<String, u32> = HashMap::new();
    let mut edges: Vec<GraphEdge> = Vec::new();
    let mut edge_keys: HashSet<String> = HashSet::new();
    let mut queue: VecDeque<String> = VecDeque::new();

    node_depth.insert(center_id.to_string(), 0);
    queue.push_back(center_id.to_string());

    while let Some(id) = queue.pop_front() {
        let depth = *node_depth.get(&id).unwrap_or(&0);
        if depth >= depth_limit {
            continue;
        }

        for target_title in get_outbound_titles(conn, &id)? {
            let Some(target) = metas
                .iter()
                .find(|m| normalize_title(&m.title) == normalize_title(&target_title))
            else {
                continue;
            };
            add_edge(&mut edges, &mut edge_keys, &id, &target.id);
            if !node_depth.contains_key(&target.id) {
                node_depth.insert(target.id.clone(), depth + 1);
                queue.push_back(target.id.clone());
            }
        }

        for mention in get_backlinks(conn, &id)? {
            add_edge(&mut edges, &mut edge_keys, &mention.id, &id);
            if !node_depth.contains_key(&mention.id) {
                node_depth.insert(mention.id.clone(), depth + 1);
                queue.push_back(mention.id.clone());
            }
        }
    }

    let mut depth_groups: HashMap<u32, Vec<String>> = HashMap::new();
    for (id, depth) in &node_depth {
        depth_groups.entry(*depth).or_default().push(id.clone());
    }

    let mut nodes = Vec::new();
    for (depth, ids) in depth_groups {
        let radius = if depth == 0 {
            0.0
        } else if depth == 1 {
            100.0
        } else {
            180.0
        };
        let count = ids.len();
        for (i, id) in ids.iter().enumerate() {
            let angle = if count == 1 {
                0.0
            } else {
                (2.0 * std::f64::consts::PI * i as f64) / count as f64 - std::f64::consts::PI / 2.0
            };
            let title = meta_by_id
                .get(id.as_str())
                .map(|m| m.title.clone())
                .unwrap_or_else(|| id.chars().take(8).collect());
            nodes.push(GraphNode {
                id: id.clone(),
                title,
                depth,
                x: radius * angle.cos(),
                y: radius * angle.sin(),
                is_center: id == center_id,
            });
        }
    }

    Ok(GraphPayload {
        center_id: center_id.to_string(),
        depth: depth_limit,
        nodes,
        edges,
    })
}

fn empty_graph(center_id: &str, depth: u32) -> GraphPayload {
    GraphPayload {
        center_id: center_id.to_string(),
        depth,
        nodes: Vec::new(),
        edges: Vec::new(),
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkIndexSnapshot {
    pub outbound_map: HashMap<String, Vec<String>>,
    pub backlink_map: HashMap<String, Vec<LinkMention>>,
    pub unlinked_map: HashMap<String, Vec<LinkMention>>,
    pub plain_text_map: HashMap<String, String>,
    pub stripped_text_map: HashMap<String, String>,
    pub snippet_map: HashMap<String, String>,
    pub orphan_ids: Vec<String>,
    pub stats: LinkStats,
}

pub fn build_link_index_snapshot(
    conn: &Connection,
    metas: &[DocumentMeta],
) -> Result<LinkIndexSnapshot, AppError> {
    ensure_links_schema(conn)?;
    search_index::ensure_fts_schema(conn)?;

    let mut outbound_map: HashMap<String, Vec<String>> = HashMap::new();
    let mut backlink_map: HashMap<String, Vec<LinkMention>> = HashMap::new();
    let mut unlinked_map: HashMap<String, Vec<LinkMention>> = HashMap::new();
    let plain_text_map: HashMap<String, String> = HashMap::new();
    let stripped_text_map: HashMap<String, String> = HashMap::new();
    let mut snippet_map: HashMap<String, String> = HashMap::new();

    // 轻量快照：仅 snippet，不把 FTS 全文 body 载入前端
    {
        let mut stmt = conn.prepare(
            "SELECT document_id,
                    snippet(documents_fts, 2, '', '', '…', 120) AS body_snippet
             FROM documents_fts",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;
        for row in rows {
            let (id, snippet) = row?;
            snippet_map.insert(id, snippet);
        }
    }

    for meta in metas {
        outbound_map.insert(
            meta.id.clone(),
            get_outbound_titles(conn, &meta.id)?,
        );
        let backlinks = get_backlinks(conn, &meta.id)?;
        if !backlinks.is_empty() {
            backlink_map.insert(meta.id.clone(), backlinks);
        }
        let unlinked = get_unlinked_mentions(conn, &meta.id)?;
        if !unlinked.is_empty() {
            unlinked_map.insert(meta.id.clone(), unlinked);
        }
        snippet_map
            .entry(meta.id.clone())
            .or_insert_with(|| "（空文档）".to_string());
    }

    let stats = get_link_stats(conn, metas)?;

    Ok(LinkIndexSnapshot {
        outbound_map,
        backlink_map,
        unlinked_map,
        plain_text_map,
        stripped_text_map,
        snippet_map,
        orphan_ids: stats.orphan_ids.clone(),
        stats,
    })
}

fn add_edge(edges: &mut Vec<GraphEdge>, keys: &mut HashSet<String>, from: &str, to: &str) {
    if from == to {
        return;
    }
    let key = format!("{from}->{to}");
    if keys.contains(&key) {
        return;
    }
    keys.insert(key);
    edges.push(GraphEdge {
        from: from.to_string(),
        to: to.to_string(),
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn mem_conn() -> Connection {
        Connection::open_in_memory().unwrap()
    }

    #[test]
    fn backlinks_and_graph() {
        let conn = mem_conn();
        conn.execute_batch(
            "CREATE TABLE documents (
                id TEXT PRIMARY KEY, title TEXT, path TEXT UNIQUE, folder TEXT,
                created_at INTEGER, updated_at INTEGER, word_count INTEGER DEFAULT 0
            );",
        )
        .unwrap();
        conn.execute(
            "INSERT INTO documents VALUES ('a','A','a.md','',0,0,0),('b','B','b.md','',0,0,0)",
            [],
        )
        .unwrap();
        let metas = vec![
            DocumentMeta {
                id: "a".into(),
                title: "A".into(),
                path: "a.md".into(),
                folder: String::new(),
                created_at: 0,
                updated_at: 0,
                ai_exclude: false,
            },
            DocumentMeta {
                id: "b".into(),
                title: "B".into(),
                path: "b.md".into(),
                folder: String::new(),
                created_at: 0,
                updated_at: 0,
                ai_exclude: false,
            },
        ];
        let map = build_title_map(&metas);
        upsert_links_for_document(&conn, "a", "link [[B]]", &map).unwrap();
        let backlinks = get_backlinks(&conn, "b").unwrap();
        assert_eq!(backlinks.len(), 1);
        assert_eq!(backlinks[0].id, "a");
        let graph = get_local_graph(&conn, &metas, "b", 2).unwrap();
        assert!(graph.nodes.len() >= 2);
    }

    #[test]
    fn unlinked_mentions_without_wiki_link() {
        let conn = mem_conn();
        conn.execute_batch(
            "CREATE TABLE documents (
                id TEXT PRIMARY KEY, title TEXT, path TEXT UNIQUE, folder TEXT,
                created_at INTEGER, updated_at INTEGER, word_count INTEGER DEFAULT 0
            );",
        )
        .unwrap();
        conn.execute(
            "INSERT INTO documents VALUES ('a','Alpha','a.md','',0,0,0),('b','Beta','b.md','',0,0,0)",
            [],
        )
        .unwrap();
        let metas = vec![
            DocumentMeta {
                id: "a".into(),
                title: "Alpha".into(),
                path: "a.md".into(),
                folder: String::new(),
                created_at: 0,
                updated_at: 0,
                ai_exclude: false,
            },
            DocumentMeta {
                id: "b".into(),
                title: "Beta".into(),
                path: "b.md".into(),
                folder: String::new(),
                created_at: 0,
                updated_at: 0,
                ai_exclude: false,
            },
        ];
        index_links_and_unlinked(&conn, "a", "mentions Beta in plain text", "Alpha", &build_title_map(&metas), &metas).unwrap();
        let mentions = get_unlinked_mentions(&conn, "b").unwrap();
        assert_eq!(mentions.len(), 1);
        assert_eq!(mentions[0].id, "a");
    }

    #[test]
    fn update_inbound_link_titles_keeps_target_id() {
        let conn = mem_conn();
        conn.execute_batch(
            "CREATE TABLE documents (
                id TEXT PRIMARY KEY, title TEXT, path TEXT UNIQUE, folder TEXT,
                created_at INTEGER, updated_at INTEGER, word_count INTEGER DEFAULT 0
            );",
        )
        .unwrap();
        conn.execute(
            "INSERT INTO documents VALUES ('a','Alpha','a.md','',0,0,0),('b','Beta','b.md','',0,0,0)",
            [],
        )
        .unwrap();
        let metas = vec![
            DocumentMeta {
                id: "a".into(),
                title: "Alpha".into(),
                path: "a.md".into(),
                folder: String::new(),
                created_at: 0,
                updated_at: 0,
                ai_exclude: false,
            },
            DocumentMeta {
                id: "b".into(),
                title: "Beta".into(),
                path: "b.md".into(),
                folder: String::new(),
                created_at: 0,
                updated_at: 0,
                ai_exclude: false,
            },
        ];
        let map = build_title_map(&metas);
        upsert_links_for_document(&conn, "a", "see [[Beta]]", &map).unwrap();
        update_inbound_link_titles(&conn, "b", "Beta Renamed").unwrap();
        let titles = get_outbound_titles(&conn, "a").unwrap();
        assert_eq!(titles, vec!["Beta Renamed".to_string()]);
        let backlinks = get_backlinks(&conn, "b").unwrap();
        assert_eq!(backlinks.len(), 1);
    }
}
