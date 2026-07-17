//! AI 隐私护栏：剥离 `:::ai-private` 围栏、整篇 `ai_exclude` 检查。

use crate::documents::{DocumentMeta, SearchHit};

const AI_PRIVATE_OPEN: &str = ":::ai-private";

fn is_ai_private_open(line: &str) -> bool {
    let t = line.trim();
    t.eq_ignore_ascii_case(AI_PRIVATE_OPEN)
        || t.to_ascii_lowercase()
            .starts_with(":::ai-private")
            && t.len() > AI_PRIVATE_OPEN.len()
            && t.as_bytes().get(AI_PRIVATE_OPEN.len()).map(|b| b.is_ascii_whitespace()).unwrap_or(false)
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
}
