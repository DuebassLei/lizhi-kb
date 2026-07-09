use once_cell::sync::Lazy;
use pinyin::ToPinyin;
use regex::Regex;

static WIKI_LINK_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]").expect("wiki link regex"));

pub fn normalize_title(title: &str) -> String {
    title.trim().to_lowercase()
}

pub fn extract_wiki_links(content: &str) -> Vec<String> {
    WIKI_LINK_RE
        .captures_iter(content)
        .filter_map(|cap| {
            cap.get(1)
                .map(|m| m.as_str().trim())
                .filter(|s| !s.is_empty())
                .map(str::to_string)
        })
        .collect()
}

pub fn strip_wiki_links(content: &str) -> String {
    WIKI_LINK_RE.replace_all(content, "").to_string()
}

pub fn mentions_title(stripped: &str, title: &str) -> bool {
    let t = title.trim();
    if t.is_empty() {
        return false;
    }
    stripped.contains(t) || stripped.to_lowercase().contains(&t.to_lowercase())
}

pub fn extract_h1_title(content: &str) -> Option<String> {
    let line = content.lines().find(|l| !l.trim().is_empty())?;
    let trimmed = line.trim();
    if trimmed.starts_with("##") {
        return None;
    }
    let title = trimmed.strip_prefix('#')?.trim();
    if title.is_empty() {
        return None;
    }
    Some(title.chars().take(80).collect())
}

pub fn replace_wiki_link_title(content: &str, old_title: &str, new_title: &str) -> String {
    let old_norm = normalize_title(old_title);
    let new_norm = normalize_title(new_title);
    if old_norm.is_empty() || old_norm == new_norm {
        return content.to_string();
    }

    WIKI_LINK_RE
        .replace_all(content, |caps: &regex::Captures| {
            let link_title = caps.get(1).map(|m| m.as_str()).unwrap_or("");
            if normalize_title(link_title) != old_norm {
                return caps.get(0).map(|m| m.as_str()).unwrap_or("").to_string();
            }
            if let Some(alias) = caps.get(2).map(|m| m.as_str()) {
                format!("[[{new_title}|{alias}]]")
            } else {
                format!("[[{new_title}]]")
            }
        })
        .to_string()
}

pub fn markdown_to_plain_text(content: &str) -> String {
    let mut text = content.to_string();
    while let Some(start) = text.find("```") {
        if let Some(rel_end) = text[start + 3..].find("```") {
            let end = start + 3 + rel_end + 3;
            let raw_inner = &text[start + 3..start + 3 + rel_end];
            let code_plain = if let Some(nl) = raw_inner.find('\n') {
                raw_inner[nl + 1..]
                    .split_whitespace()
                    .collect::<Vec<_>>()
                    .join(" ")
            } else {
                raw_inner.split_whitespace().collect::<Vec<_>>().join(" ")
            };
            let replacement = if code_plain.is_empty() {
                " ".to_string()
            } else {
                format!(" {code_plain} ")
            };
            text.replace_range(start..end, &replacement);
        } else {
            break;
        }
    }
    text = text.replace('`', " ");
    for pattern in ["![", "[["] {
        while let Some(start) = text.find(pattern) {
            if let Some(end) = text[start..].find(']') {
                let end = start + end + 1;
                if pattern == "[[" {
                    let inner = &text[start + 2..end - 1];
                    let label = inner.split('|').next().unwrap_or(inner).to_string();
                    text.replace_range(start..end, &label);
                } else {
                    text.replace_range(start..end, " ");
                }
            } else {
                break;
            }
        }
    }
    text.lines()
        .map(|line| {
            let mut l = line.trim_start();
            while l.starts_with('#') {
                l = l.trim_start_matches('#').trim_start();
            }
            if let Some(rest) = l.strip_prefix('>') {
                l = rest.trim_start();
            }
            for prefix in ["- ", "* ", "+ "] {
                if let Some(rest) = l.strip_prefix(prefix) {
                    l = rest;
                    break;
                }
            }
            l.to_string()
        })
        .collect::<Vec<_>>()
        .join(" ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

pub fn content_snippet(content: &str, max_len: usize) -> String {
    let plain = content
        .lines()
        .filter(|line| !line.trim_start().starts_with('#'))
        .collect::<Vec<_>>()
        .join(" ");
    let plain = strip_wiki_links(&plain);
    let plain = plain.split_whitespace().collect::<Vec<_>>().join(" ");
    if plain.is_empty() {
        return "（空文档）".to_string();
    }
    truncate_chars(&plain, max_len)
}

pub fn search_snippet(text: &str, query: &str, max_len: usize) -> String {
    let plain = text.trim();
    if plain.is_empty() {
        return "（空文档）".to_string();
    }
    let q = query.trim();
    if q.is_empty() {
        return truncate_chars(plain, max_len);
    }
    let lower = plain.to_lowercase();
    let q_lower = q.to_lowercase();
    if let Some(idx) = lower.find(&q_lower) {
        let q_len = q.chars().count();
        let half = (max_len.saturating_sub(q_len)) / 2;
        let start = idx.saturating_sub(half);
        let snippet: String = plain.chars().skip(start).take(max_len).collect();
        let mut out = String::new();
        if start > 0 {
            out.push('…');
        }
        out.push_str(&snippet);
        if start + max_len < plain.chars().count() {
            out.push('…');
        }
        out
    } else {
        truncate_chars(plain, max_len)
    }
}

pub fn truncate_chars(text: &str, max_len: usize) -> String {
    let chars: Vec<char> = text.chars().take(max_len + 1).collect();
    if chars.len() > max_len {
        format!("{}…", chars[..max_len].iter().collect::<String>())
    } else {
        text.to_string()
    }
}

/// 围绕检索词截取正文，优先包含代码块/SQL 等命中位置
pub fn excerpt_around_terms(content: &str, terms: &[String], max_len: usize) -> String {
    let lower = content.to_lowercase();
    for term in terms {
        if term.is_empty() {
            continue;
        }
        if let Some(byte_idx) = lower.find(term) {
            let char_idx = content[..byte_idx].chars().count();
            let term_chars = term.chars().count();
            let half = (max_len.saturating_sub(term_chars)) / 2;
            let start = char_idx.saturating_sub(half);
            let snippet: String = content.chars().skip(start).take(max_len).collect();
            let mut out = String::new();
            if start > 0 {
                out.push('…');
            }
            out.push_str(&snippet);
            if start + max_len < content.chars().count() {
                out.push('…');
            }
            return out;
        }
    }
    truncate_chars(content, max_len)
}

pub fn score_search_hit(title_match: bool, body_match: bool) -> i32 {
    match (title_match, body_match) {
        (true, true) => 150,
        (true, false) => 100,
        (false, true) => 50,
        (false, false) => 0,
    }
}

const SEARCH_STOP_WORDS: &[&str] = &[
    "一下", "介绍", "关于", "查询", "搜索", "查找", "告诉", "请问", "帮我", "相关", "信息",
    "什么", "如何", "怎么", "怎样", "是否", "能否", "可以", "有没有", "哪些", "哪个", "那些",
    "这个", "那个", "我们", "你们", "他们", "它们", "以及", "还有", "或者", "如果", "因为",
    "所以", "但是", "然后", "已经", "进行", "通过", "使用", "需要", "希望", "想要", "了解",
    "知道", "说明", "解释",
    "的", "了", "吗", "呢", "啊", "吧", "呀", "嘛", "着", "过", "在", "和", "与", "或", "及",
];

/// 从自然语言问句中提取 FTS / 子串检索用词（中文 n-gram、连字符拆分、去停用词）
pub fn extract_search_terms(query: &str) -> Vec<String> {
    use std::collections::HashSet;

    let mut terms: Vec<String> = Vec::new();
    let mut seen = HashSet::new();

    let push = |terms: &mut Vec<String>, seen: &mut HashSet<String>, raw: &str| {
        let t = raw.trim().to_lowercase();
        if t.is_empty() {
            return;
        }
        let char_count = t.chars().count();
        let is_ascii_word = t.chars().all(|c| c.is_ascii_alphanumeric());
        if char_count < 2 && !is_ascii_word {
            return;
        }
        if is_search_stop_word(&t) {
            return;
        }
        if seen.insert(t.clone()) {
            terms.push(t);
        }
    };

    let expand_token =
        |terms: &mut Vec<String>, seen: &mut HashSet<String>, token: &str| {
            push(terms, seen, token);
            if token.contains('-') {
                for part in token.split('-') {
                    push(terms, seen, part);
                }
            }
            if token.contains('_') {
                for part in token.split('_') {
                    push(terms, seen, part);
                }
            }
        };

    for part in query.split_whitespace() {
        expand_token(&mut terms, &mut seen, part);
    }

    segment_mixed_text(query, &mut terms, &mut seen, &expand_token);

    terms.truncate(24);
    terms
}

fn is_search_stop_word(term: &str) -> bool {
    SEARCH_STOP_WORDS.contains(&term)
}

fn segment_mixed_text(
    text: &str,
    terms: &mut Vec<String>,
    seen: &mut std::collections::HashSet<String>,
    expand_token: &dyn Fn(&mut Vec<String>, &mut std::collections::HashSet<String>, &str),
) {
    let mut current = String::new();
    let mut kind = SegmentKind::Other;

    for ch in text.chars() {
        let next = SegmentKind::of(ch);
        if current.is_empty() || next == kind {
            current.push(ch);
            kind = next;
        } else {
            flush_segment(&current, kind, terms, seen, expand_token);
            current.clear();
            current.push(ch);
            kind = next;
        }
    }
    if !current.is_empty() {
        flush_segment(&current, kind, terms, seen, expand_token);
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum SegmentKind {
    Cjk,
    Ascii,
    Other,
}

impl SegmentKind {
    fn of(ch: char) -> Self {
        if is_cjk(ch) {
            Self::Cjk
        } else if ch.is_ascii_alphanumeric() {
            Self::Ascii
        } else {
            Self::Other
        }
    }
}

fn is_cjk(ch: char) -> bool {
    matches!(ch,
        '\u{3400}'..='\u{4DBF}'
            | '\u{4E00}'..='\u{9FFF}'
            | '\u{F900}'..='\u{FAFF}'
    )
}

fn flush_segment(
    segment: &str,
    kind: SegmentKind,
    terms: &mut Vec<String>,
    seen: &mut std::collections::HashSet<String>,
    expand_token: &dyn Fn(&mut Vec<String>, &mut std::collections::HashSet<String>, &str),
) {
    match kind {
        SegmentKind::Ascii => expand_token(terms, seen, segment),
        SegmentKind::Cjk => add_cjk_terms(segment, terms, seen),
        SegmentKind::Other => {}
    }
}

fn add_cjk_terms(
    segment: &str,
    terms: &mut Vec<String>,
    seen: &mut std::collections::HashSet<String>,
) {
    let chars: Vec<char> = segment.chars().collect();
    if chars.is_empty() {
        return;
    }

    let push = |terms: &mut Vec<String>, seen: &mut std::collections::HashSet<String>, raw: &str| {
        let t = raw.trim().to_lowercase();
        if t.chars().count() < 2 || is_search_stop_word(&t) {
            return;
        }
        if seen.insert(t.clone()) {
            terms.push(t);
        }
    };

    if chars.len() <= 4 {
        push(terms, seen, segment);
        return;
    }

    push(terms, seen, segment);

    for i in 0..=chars.len().saturating_sub(2) {
        let gram: String = chars[i..i + 2].iter().collect();
        push(terms, seen, &gram);
    }

    if chars.len() >= 6 {
        for i in 0..=chars.len().saturating_sub(3) {
            let gram: String = chars[i..i + 3].iter().collect();
            push(terms, seen, &gram);
        }
    }
}

pub fn text_matches_query(text: &str, query: &str) -> bool {
    let q = query.trim().to_lowercase();
    if q.is_empty() {
        return true;
    }

    let lower = text.to_lowercase();
    if lower.contains(&q) {
        return true;
    }

    let full_py = chinese_to_pinyin_full(text);
    if full_py.contains(&q) {
        return true;
    }

    let initials = chinese_to_pinyin_initials(text);
    if initials.contains(&q) || initials.starts_with(&q) {
        return true;
    }

    let acronym: String = text
        .split(|c: char| c.is_whitespace() || matches!(c, '-' | '_' | '/'))
        .filter(|part| !part.is_empty())
        .filter_map(|part| part.chars().next())
        .collect::<String>()
        .to_lowercase();
    acronym.contains(&q) || acronym.starts_with(&q)
}

fn chinese_to_pinyin_full(text: &str) -> String {
    text.to_pinyin()
        .filter_map(|item| item.map(|py| py.plain()))
        .collect::<Vec<_>>()
        .join("")
        .to_lowercase()
}

fn chinese_to_pinyin_initials(text: &str) -> String {
    text.to_pinyin()
        .filter_map(|item| item.and_then(|py| py.plain().chars().next()))
        .collect::<String>()
        .to_lowercase()
}

pub fn text_matches_any_term(text: &str, terms: &[String]) -> bool {
    if terms.is_empty() {
        return false;
    }
    terms
        .iter()
        .any(|term| text_matches_query(text, term))
}

pub fn best_matching_term<'a>(text: &str, terms: &'a [String]) -> Option<&'a str> {
    terms
        .iter()
        .find(|term| text_matches_query(text, term))
        .map(String::as_str)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_wiki_links() {
        let links = extract_wiki_links("见 [[Foo]] 与 [[Bar|别名]]");
        assert_eq!(links, vec!["Foo".to_string(), "Bar".to_string()]);
    }

    #[test]
    fn normalizes_title() {
        assert_eq!(normalize_title("  Hello  "), "hello");
    }

    #[test]
    fn extracts_search_terms_from_chinese_question() {
        let terms = extract_search_terms("查询天翼云sdwan相关信息");
        assert!(terms.iter().any(|t| t.contains("天翼")));
        assert!(terms.iter().any(|t| t == "sdwan" || t.contains("sdwan")));
    }

    #[test]
    fn extracts_hyphenated_terms() {
        let terms = extract_search_terms("SD-WAN 方案");
        assert!(terms.iter().any(|t| t == "sd"));
        assert!(terms.iter().any(|t| t == "wan"));
    }

    #[test]
    fn plain_text_keeps_code_block_content() {
        let md = "# Title\n\n```sql\nSELECT id FROM users\nWHERE name = 'sql'\n```\n";
        let plain = markdown_to_plain_text(md);
        assert!(plain.contains("SELECT"));
        assert!(plain.contains("users"));
        assert!(plain.contains("sql"));
    }

    #[test]
    fn text_matches_pinyin_initials() {
        assert!(text_matches_query("天翼云 SD-WAN", "tyy"));
        assert!(text_matches_query("天翼云 SD-WAN", "tianyi"));
    }
}
