use std::collections::HashSet;
use std::fs;
use std::path::Path;

use serde::Serialize;

use crate::documents::DocumentService;

use super::config::{CcWorkbenchConfig, CwdMode};
use super::path_utils::resolve_project_dir;

const MAX_FILE_CHARS: usize = 80_000;
const MAX_TOTAL_CHARS: usize = 240_000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenedFileContent {
    pub path: String,
    pub name: String,
    pub content: String,
    pub truncated: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AttachmentContent {
    pub path: String,
    pub name: String,
    pub kind: String,
    pub content: String,
    pub mime_type: Option<String>,
    pub truncated: bool,
}

const MAX_ATTACHMENT_BYTES: u64 = 512_000;
const TEXT_ATTACHMENT_EXTENSIONS: &[&str] = &[
    "md", "txt", "json", "csv", "ts", "tsx", "js", "jsx", "py", "rs", "vue", "html", "css", "xml",
    "yaml", "yml", "toml", "sql", "sh", "bat", "ps1", "go", "java", "kt", "rb", "php", "c", "cpp",
    "h", "hpp", "cs", "swift", "log",
];

pub fn resolve_attachments(paths: &[String]) -> Result<Vec<AttachmentContent>, String> {
    if paths.is_empty() {
        return Ok(Vec::new());
    }
    let mut out = Vec::new();
    let mut budget = MAX_TOTAL_CHARS;
    let mut seen = HashSet::new();

    for raw in paths {
        let trimmed = raw.trim();
        if trimmed.is_empty() || !seen.insert(trimmed.to_string()) {
            continue;
        }
        let path = Path::new(trimmed);
        if !path.is_file() {
            continue;
        }
        let name = path
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| trimmed.to_string());
        let ext = path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();
        let mime_type = attachment_mime_type(&ext);
        let kind = if ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"].contains(&ext.as_str())
        {
            "image".to_string()
        } else if TEXT_ATTACHMENT_EXTENSIONS.contains(&ext.as_str()) {
            "text".to_string()
        } else {
            "file".to_string()
        };

        let meta = fs::metadata(path).map_err(|e| format!("读取附件「{name}」失败: {e}"))?;
        let truncated_by_size = meta.len() > MAX_ATTACHMENT_BYTES;
        let content = if kind == "text" {
            let raw = fs::read_to_string(path).map_err(|e| format!("读取附件「{name}」失败: {e}"))?;
            let (content, truncated) = truncate_content(raw, &mut budget);
            if truncated || truncated_by_size {
                format!("{content}\n...(附件内容已截断)")
            } else {
                content
            }
        } else if kind == "image" {
            format!("用户附加图片：{name}\n路径：{trimmed}")
        } else {
            format!("用户附加文件：{name}\n路径：{trimmed}")
        };

        out.push(AttachmentContent {
            path: trimmed.to_string(),
            name,
            kind,
            content,
            mime_type,
            truncated: truncated_by_size,
        });
        if budget == 0 {
            break;
        }
    }
    Ok(out)
}

pub fn resolve_opened_files(
    config: &CcWorkbenchConfig,
    doc_service: &DocumentService,
    dek: Option<&[u8; 32]>,
    paths: &[String],
) -> Result<Vec<OpenedFileContent>, String> {
    if paths.is_empty() {
        return Ok(Vec::new());
    }
    match config.cwd_mode {
        CwdMode::Vault => resolve_vault_files(doc_service, dek, paths),
        CwdMode::Project => {
            let project = config
                .project_path
                .as_deref()
                .filter(|p| !p.trim().is_empty())
                .ok_or_else(|| "请先在设置中选择项目目录".to_string())?;
            resolve_project_files(&resolve_project_dir(project)?, paths)
        }
    }
}

fn truncate_content(content: String, budget: &mut usize) -> (String, bool) {
    if *budget == 0 {
        return (String::new(), true);
    }
    let char_count = content.chars().count();
    if char_count <= MAX_FILE_CHARS && char_count <= *budget {
        *budget -= char_count;
        return (content, false);
    }
    let limit = MAX_FILE_CHARS.min(*budget);
    let truncated: String = content.chars().take(limit).collect();
    *budget = budget.saturating_sub(limit);
    (truncated, true)
}

fn resolve_vault_files(
    doc_service: &DocumentService,
    dek: Option<&[u8; 32]>,
    paths: &[String],
) -> Result<Vec<OpenedFileContent>, String> {
    let metas = doc_service
        .list_documents()
        .map_err(|e| e.to_string())?;
    let all_paths: Vec<String> = metas.iter().map(|m| m.path.clone()).collect();

    let expanded = expand_vault_paths(paths, &all_paths);
    let mut out = Vec::new();
    let mut budget = MAX_TOTAL_CHARS;
    let mut seen = HashSet::new();

    for path in expanded {
        if !seen.insert(path.clone()) {
            continue;
        }
        let Some(meta) = metas.iter().find(|m| m.path == path || m.id == path) else {
            continue;
        };
        let content = doc_service
            .read_document(&meta.id, dek)
            .map_err(|e| format!("读取笔记「{}」失败: {e}", meta.title))?
            .content;
        let (content, truncated) = truncate_content(content, &mut budget);
        if content.is_empty() && truncated {
            break;
        }
        out.push(OpenedFileContent {
            name: meta.title.clone(),
            path: meta.path.clone(),
            content,
            truncated,
        });
        if budget == 0 {
            break;
        }
    }
    Ok(out)
}

fn expand_vault_paths(paths: &[String], all_paths: &[String]) -> Vec<String> {
    let mut out = Vec::new();
    let mut seen = HashSet::new();
    for raw in paths {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            continue;
        }
        if trimmed.ends_with('/') {
            for path in all_paths {
                if path.starts_with(trimmed) && seen.insert(path.clone()) {
                    out.push(path.clone());
                }
            }
            continue;
        }
        if seen.insert(trimmed.to_string()) {
            out.push(trimmed.to_string());
        }
    }
    out.sort();
    out
}

fn resolve_project_files(root: &Path, paths: &[String]) -> Result<Vec<OpenedFileContent>, String> {
    let canonical_root = root
        .canonicalize()
        .map_err(|e| format!("项目目录无效: {e}"))?;
    let all_files = collect_all_project_rel_paths(&canonical_root);
    let expanded = expand_project_paths(paths, &all_files);

    let mut out = Vec::new();
    let mut budget = MAX_TOTAL_CHARS;
    let mut seen = HashSet::new();

    for rel in expanded {
        if !seen.insert(rel.clone()) {
            continue;
        }
        let full = canonical_root.join(&rel);
        let canonical = match full.canonicalize() {
            Ok(p) => p,
            Err(_) => continue,
        };
        if !canonical.starts_with(&canonical_root) || !canonical.is_file() {
            continue;
        }
        let raw =
            fs::read_to_string(&canonical).map_err(|e| format!("读取文件「{rel}」失败: {e}"))?;
        let (content, truncated) = truncate_content(raw, &mut budget);
        if content.is_empty() && truncated {
            break;
        }
        let name = canonical
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| rel.clone());
        out.push(OpenedFileContent {
            path: rel.replace('\\', "/"),
            name,
            content,
            truncated,
        });
        if budget == 0 {
            break;
        }
    }
    Ok(out)
}

fn expand_project_paths(paths: &[String], all_files: &[String]) -> Vec<String> {
    let mut out = Vec::new();
    let mut seen = HashSet::new();
    for raw in paths {
        let trimmed = raw.trim().replace('\\', "/");
        if trimmed.is_empty() {
            continue;
        }
        if trimmed.ends_with('/') {
            for path in all_files {
                if path.starts_with(&trimmed) && seen.insert(path.clone()) {
                    out.push(path.clone());
                }
            }
            continue;
        }
        if seen.insert(trimmed.clone()) {
            out.push(trimmed);
        }
    }
    out.sort();
    out
}

fn collect_all_project_rel_paths(root: &Path) -> Vec<String> {
    let mut out = Vec::new();
    collect_project_rel_recursive(root, root, &mut out, 5000);
    out.sort();
    out
}

fn collect_project_rel_recursive(root: &Path, current: &Path, out: &mut Vec<String>, limit: usize) {
    if out.len() >= limit {
        return;
    }
    let Ok(entries) = fs::read_dir(current) else {
        return;
    };
    for entry in entries.flatten() {
        if out.len() >= limit {
            return;
        }
        let Ok(meta) = entry.metadata() else {
            continue;
        };
        let path = entry.path();
        if meta.is_dir() {
            let name = entry.file_name().to_string_lossy().to_string();
            if should_skip_dir(&name) {
                continue;
            }
            collect_project_rel_recursive(root, &path, out, limit);
        } else if meta.is_file() {
            if let Ok(rel) = path.strip_prefix(root) {
                out.push(rel.to_string_lossy().replace('\\', "/"));
            }
        }
    }
}

fn should_skip_dir(name: &str) -> bool {
    super::chat_input::should_skip_dir(name)
}

fn attachment_mime_type(ext: &str) -> Option<String> {
    let mime = match ext {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "bmp" => "image/bmp",
        "ico" => "image/x-icon",
        "md" => "text/markdown",
        "txt" => "text/plain",
        "json" => "application/json",
        "csv" => "text/csv",
        "html" => "text/html",
        "css" => "text/css",
        "xml" => "application/xml",
        "pdf" => "application/pdf",
        _ => return None,
    };
    Some(mime.to_string())
}

pub fn list_vault_folders(document_paths: &[String]) -> Vec<super::chat_input::CcContextFileEntry> {
    let mut folders: HashSet<String> = HashSet::new();
    for path in document_paths {
        if let Some(idx) = path.find('/') {
            let folder = format!("{}/", &path[..idx + 1]);
            folders.insert(folder);
        }
    }
    let mut out: Vec<_> = folders
        .into_iter()
        .map(|folder| {
            let name = folder
                .trim_end_matches('/')
                .rsplit('/')
                .next()
                .unwrap_or(&folder)
                .to_string();
            super::chat_input::CcContextFileEntry {
                path: folder.clone(),
                name: format!("📁 {name}"),
                kind: "folder".to_string(),
            }
        })
        .collect();
    out.sort_by(|a, b| a.path.cmp(&b.path));
    out
}
