//! Vault 写作风格包：`{data_dir}/writing-styles/{id}.md`

use std::fs;
use std::path::{Path, PathBuf};

use regex::Regex;
use serde::{Deserialize, Serialize};

pub const WRITING_STYLES_DIR: &str = "writing-styles";
pub const STYLE_BODY_MAX: usize = 12_000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WritingStylePackDto {
    pub id: String,
    pub label: String,
    pub hint: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub word_range: Option<String>,
    pub order: i32,
    pub body: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WritingStylePackWrite {
    pub id: String,
    pub label: String,
    pub hint: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub word_range: Option<String>,
    pub order: i32,
    pub body: String,
}

fn styles_dir(data_dir: &Path) -> PathBuf {
    data_dir.join(WRITING_STYLES_DIR)
}

fn id_ok(id: &str) -> bool {
    static RE: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
    let re = RE.get_or_init(|| Regex::new(r"^[a-z][a-zA-Z0-9_-]*$").expect("style id re"));
    re.is_match(id)
}

fn pack_path(data_dir: &Path, id: &str) -> Result<PathBuf, String> {
    if !id_ok(id) {
        return Err("风格 id 不合法".into());
    }
    if id.contains("..") || id.contains('/') || id.contains('\\') {
        return Err("风格 id 不合法".into());
    }
    let dir = styles_dir(data_dir);
    let path = dir.join(format!("{id}.md"));
    let canon_dir = fs::canonicalize(&dir).unwrap_or(dir.clone());
    if let Ok(canon) = fs::canonicalize(&path) {
        if !canon.starts_with(&canon_dir) {
            return Err("路径非法".into());
        }
    } else {
        // 文件尚不存在：校验父目录
        if path.parent() != Some(dir.as_path()) && path.parent().map(|p| p != dir.as_path()).unwrap_or(true) {
            // join of dir + id.md should always be under dir
        }
    }
    Ok(path)
}

pub fn list_vault_packs(data_dir: &Path) -> Result<Vec<WritingStylePackDto>, String> {
    let dir = styles_dir(data_dir);
    if !dir.is_dir() {
        return Ok(vec![]);
    }
    let mut out = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }
        let raw = match fs::read_to_string(&path) {
            Ok(s) => s,
            Err(_) => continue,
        };
        if let Some(pack) = parse_pack(&raw) {
            out.push(pack);
        }
    }
    out.sort_by(|a, b| a.order.cmp(&b.order).then(a.id.cmp(&b.id)));
    Ok(out)
}

pub fn get_vault_pack(data_dir: &Path, id: &str) -> Result<Option<WritingStylePackDto>, String> {
    let path = pack_path(data_dir, id)?;
    if !path.is_file() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    Ok(parse_pack(&raw))
}

pub fn save_vault_pack(data_dir: &Path, pack: &WritingStylePackWrite) -> Result<(), String> {
    if !id_ok(&pack.id) {
        return Err("风格 id 须以小写字母开头，仅含字母、数字、_、-".into());
    }
    if pack.label.trim().is_empty() {
        return Err("风格名称不能为空".into());
    }
    if pack.body.len() > STYLE_BODY_MAX {
        return Err(format!("风格规范过长（最多 {STYLE_BODY_MAX} 字符）"));
    }
    let dir = styles_dir(data_dir);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = pack_path(data_dir, &pack.id)?;
    let content = serialize_pack(pack);
    fs::write(&path, content).map_err(|e| e.to_string())
}

pub fn delete_vault_pack(data_dir: &Path, id: &str) -> Result<bool, String> {
    let path = pack_path(data_dir, id)?;
    if !path.is_file() {
        return Ok(false);
    }
    fs::remove_file(&path).map_err(|e| e.to_string())?;
    Ok(true)
}

/// 合并备份中的 writing-styles：备份有则覆盖本地同名；本地独有保留
pub fn merge_from_staging(data_dir: &Path, staging: &Path) -> Result<(), String> {
    let src = staging.join(WRITING_STYLES_DIR);
    if !src.is_dir() {
        return Ok(());
    }
    let dest = styles_dir(data_dir);
    fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(&src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or_else(|| "无效文件名".to_string())?;
        if !name.ends_with(".md") {
            continue;
        }
        fs::copy(&path, dest.join(name)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn parse_pack(raw: &str) -> Option<WritingStylePackDto> {
    let text = raw.trim_start_matches('\u{feff}');
    let rest = text.strip_prefix("---")?;
    let (fm, body) = rest.split_once("\n---")?;
    let fm = fm.trim_start_matches('\n');
    let body = body.trim_start_matches('\n').trim();
    let mut id = String::new();
    let mut label = String::new();
    let mut hint = String::new();
    let mut word_range: Option<String> = None;
    let mut order = 100i32;
    for line in fm.lines() {
        let Some((k, v)) = line.split_once(':') else {
            continue;
        };
        let k = k.trim();
        let v = v.trim();
        match k {
            "id" => id = v.to_string(),
            "label" => label = v.to_string(),
            "hint" => hint = v.to_string(),
            "wordRange" => {
                if !v.is_empty() {
                    word_range = Some(v.to_string());
                }
            }
            "order" => {
                if let Ok(n) = v.parse::<i32>() {
                    order = n;
                }
            }
            _ => {}
        }
    }
    if !id_ok(&id) || label.is_empty() {
        return None;
    }
    Some(WritingStylePackDto {
        id,
        label,
        hint,
        word_range,
        order,
        body: body.to_string(),
    })
}

fn serialize_pack(pack: &WritingStylePackWrite) -> String {
    let mut s = String::from("---\n");
    s.push_str(&format!("id: {}\n", pack.id));
    s.push_str(&format!("label: {}\n", pack.label));
    s.push_str(&format!("hint: {}\n", pack.hint));
    if let Some(wr) = &pack.word_range {
        if !wr.is_empty() {
            s.push_str(&format!("wordRange: {wr}\n"));
        }
    }
    s.push_str(&format!("order: {}\n", pack.order));
    s.push_str("---\n\n");
    s.push_str(pack.body.trim());
    s.push('\n');
    s
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    fn temp_dir() -> PathBuf {
        let dir = env::temp_dir().join(format!(
            "lizhi-ws-test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn roundtrip_save_list() {
        let data = temp_dir();
        save_vault_pack(
            &data,
            &WritingStylePackWrite {
                id: "viral".into(),
                label: "爆款".into(),
                hint: "提示".into(),
                word_range: Some("2500".into()),
                order: 2,
                body: "规范正文".into(),
            },
        )
        .unwrap();
        let list = list_vault_packs(&data).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, "viral");
        assert_eq!(list[0].body, "规范正文");
        assert!(delete_vault_pack(&data, "viral").unwrap());
        assert!(list_vault_packs(&data).unwrap().is_empty());
        let _ = fs::remove_dir_all(&data);
    }

    #[test]
    fn reject_bad_id() {
        let data = temp_dir();
        let err = save_vault_pack(
            &data,
            &WritingStylePackWrite {
                id: "../x".into(),
                label: "x".into(),
                hint: "".into(),
                word_range: None,
                order: 1,
                body: "a".into(),
            },
        );
        assert!(err.is_err());
        let _ = fs::remove_dir_all(&data);
    }
}
