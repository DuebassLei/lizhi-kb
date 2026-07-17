//! AI 隐私护栏：剥离 `:::ai-private` 围栏、整篇 `ai_exclude` 检查。

use crate::documents::{DocumentMeta, SearchHit};

/// 与前端 `aiPrivacy.ts` 的 `/^:::\s*ai-private\b/i` 对齐。
fn is_ai_private_open(line: &str) -> bool {
    let t = line.trim();
    let lower = t.to_ascii_lowercase();
    let Some(after_colon) = lower.strip_prefix(":::") else {
        return false;
    };
    let after_ws = after_colon.trim_start();
    let Some(after_name) = after_ws.strip_prefix("ai-private") else {
        return false;
    };
    // `\b`：结束，或下一字符非 [A-Za-z0-9_]
    match after_name.chars().next() {
        None => true,
        Some(c) => !(c.is_ascii_alphanumeric() || c == '_'),
    }
}

fn is_module_close(line: &str) -> bool {
    line.trim() == ":::"
}

/// 删除全部 `:::ai-private` … `:::` 块；未闭合块从起始行到文末均删除。
pub fn strip_ai_private_blocks(content: &str) -> String {
    let lines: Vec<&str> = content.lines().collect();
    let mut out: Vec<&str> = Vec::new();
    let mut i = 0;

    while i < lines.len() {
        if is_ai_private_open(lines[i]) {
            i += 1;
            while i < lines.len() && !is_module_close(lines[i]) {
                i += 1;
            }
            if i < lines.len() {
                i += 1;
            }
            while out.last().is_some_and(|l| l.trim().is_empty()) {
                out.pop();
            }
            continue;
        }
        out.push(lines[i]);
        i += 1;
    }

    collapse_blank_lines(&out.join("\n"))
}

fn collapse_blank_lines(text: &str) -> String {
    let mut result = String::new();
    let mut blank_run = 0usize;
    for line in text.lines() {
        if line.trim().is_empty() {
            blank_run += 1;
            if blank_run <= 2 && !result.is_empty() {
                result.push('\n');
            }
        } else {
            blank_run = 0;
            if !result.is_empty() {
                result.push('\n');
            }
            result.push_str(line);
        }
    }
    result
}

/// 供 AI 出口使用的正文：删除敏感围栏块。
pub fn sanitize_for_ai(content: &str) -> String {
    strip_ai_private_blocks(content)
}

pub fn is_ai_excluded(meta: &DocumentMeta) -> bool {
    meta.ai_exclude
}

pub fn filter_search_hits_for_ai(metas: &[DocumentMeta], hits: Vec<SearchHit>) -> Vec<SearchHit> {
    let excluded: std::collections::HashSet<&str> = metas
        .iter()
        .filter(|m| is_ai_excluded(m))
        .map(|m| m.id.as_str())
        .collect();
    hits.into_iter()
        .filter(|h| !excluded.contains(h.id.as_str()))
        .map(|mut h| {
            h.snippet = sanitize_for_ai(&h.snippet);
            h
        })
        .collect()
}

/// MCP 图谱：去掉 ai_exclude 节点及其边（中心若被排除则返回空图）。
pub fn filter_graph_for_ai(
    metas: &[DocumentMeta],
    mut graph: crate::link_index::GraphPayload,
) -> crate::link_index::GraphPayload {
    let excluded: std::collections::HashSet<&str> = metas
        .iter()
        .filter(|m| is_ai_excluded(m))
        .map(|m| m.id.as_str())
        .collect();
    if excluded.contains(graph.center_id.as_str()) {
        return crate::link_index::GraphPayload {
            center_id: graph.center_id,
            depth: graph.depth,
            nodes: Vec::new(),
            edges: Vec::new(),
        };
    }
    graph.nodes.retain(|n| !excluded.contains(n.id.as_str()));
    let keep: std::collections::HashSet<&str> =
        graph.nodes.iter().map(|n| n.id.as_str()).collect();
    graph
        .edges
        .retain(|e| keep.contains(e.from.as_str()) && keep.contains(e.to.as_str()));
    graph
}

pub fn filter_link_mentions_for_ai(
    metas: &[DocumentMeta],
    mentions: Vec<crate::link_index::LinkMention>,
) -> Vec<crate::link_index::LinkMention> {
    let excluded: std::collections::HashSet<&str> = metas
        .iter()
        .filter(|m| is_ai_excluded(m))
        .map(|m| m.id.as_str())
        .collect();
    mentions
        .into_iter()
        .filter(|m| !excluded.contains(m.id.as_str()))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strip_closed_block() {
        let md = "公开\n:::ai-private\n密码: secret\n:::\n继续";
        assert_eq!(strip_ai_private_blocks(md), "公开\n继续");
    }

    #[test]
    fn strip_unclosed_block_to_eof() {
        let md = "公开\n:::ai-private\n密码: secret\n尾部";
        assert_eq!(strip_ai_private_blocks(md), "公开");
    }

    #[test]
    fn strip_multiple_blocks() {
        let md = "a\n:::ai-private\n1\n:::\nb\n:::ai-private\n2\n:::\nc";
        assert_eq!(strip_ai_private_blocks(md), "a\nb\nc");
    }

    #[test]
    fn sanitize_removes_secrets() {
        let md = "标题\n:::ai-private\nuser: admin\n:::\n正文";
        let out = sanitize_for_ai(md);
        assert!(!out.contains("admin"));
        assert!(out.contains("正文"));
    }

    #[test]
    fn strip_allows_space_after_colons() {
        let md = "公开\n::: ai-private\n密码: x\n:::\n继续";
        assert_eq!(strip_ai_private_blocks(md), "公开\n继续");
    }

    #[test]
    fn strip_allows_bracket_title() {
        let md = "公开\n:::ai-private[账号]\n密码: x\n:::\n继续";
        assert_eq!(strip_ai_private_blocks(md), "公开\n继续");
    }

    #[test]
    fn strip_ignores_similar_module_names() {
        let md = "公开\n:::ai-privatex\n不是敏感\n:::\n继续";
        let out = strip_ai_private_blocks(md);
        assert!(out.contains("不是敏感"));
    }
}
