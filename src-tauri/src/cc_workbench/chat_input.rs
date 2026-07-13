use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use super::config::CwdMode;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CcAgentEntry {
    pub id: String,
    pub name: String,
    pub description: String,
    pub prompt: String,
    pub scope: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CcPromptEntry {
    pub id: String,
    pub name: String,
    pub description: String,
    pub content: String,
    pub scope: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CcContextFileEntry {
    pub path: String,
    pub name: String,
    pub kind: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CcListContextFilesRequest {
    pub cwd_mode: String,
    pub project_path: Option<String>,
    pub query: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CcEnhancePromptRequest {
    pub prompt: String,
    pub selected_model: Option<String>,
    #[serde(default)]
    pub selected_model_slot: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CcModelTestRequest {
    pub model: String,
    #[serde(default)]
    pub model_slot: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CcModelTestResult {
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CcEnhancePromptResult {
    pub success: bool,
    pub enhanced_prompt: String,
    pub error: Option<String>,
}

const BUILTIN_PROMPTS: &[(&str, &str, &str)] = &[
    (
        "review",
        "代码审查",
        "请审查当前变更，关注安全性、spec 一致性与边界情况，列出问题与改进建议。",
    ),
    (
        "explain",
        "解释代码",
        "请解释相关代码的作用、数据流、依赖关系与潜在风险。",
    ),
    (
        "refactor",
        "重构建议",
        "在保持行为不变的前提下，给出最小 diff 的重构方案并说明理由。",
    ),
    (
        "test",
        "补充测试",
        "为当前功能设计测试用例，覆盖正常路径与关键边界情况。",
    ),
    (
        "bugfix",
        "排查 Bug",
        "根据现象系统化排查根因，给出复现步骤、修复方案与验证方式。",
    ),
];

fn agents_dir(scope: &str, project_path: Option<&str>) -> Option<PathBuf> {
    match scope {
        "global" => dirs::home_dir().map(|h| h.join(".claude").join("agents")),
        "project" => project_path
            .filter(|p| !p.trim().is_empty())
            .map(|p| PathBuf::from(p).join(".claude").join("agents")),
        _ => None,
    }
}

fn parse_agent_file(path: &Path, scope: &str) -> Option<CcAgentEntry> {
    let raw = fs::read_to_string(path).ok()?;
    let stem = path.file_stem()?.to_string_lossy().to_string();
    let (frontmatter, body) = split_frontmatter(&raw);
    let mut name = stem.clone();
    let mut description = String::new();
    if let Some(fm) = frontmatter {
        for line in fm.lines() {
            let line = line.trim();
            if let Some(rest) = line.strip_prefix("name:") {
                name = rest.trim().trim_matches('"').to_string();
            } else if let Some(rest) = line.strip_prefix("description:") {
                description = rest.trim().trim_matches('"').to_string();
            }
        }
    }
    Some(CcAgentEntry {
        id: stem,
        name,
        description,
        prompt: body.trim().to_string(),
        scope: scope.to_string(),
    })
}

fn split_frontmatter(raw: &str) -> (Option<&str>, &str) {
    let trimmed = raw.trim_start();
    if !trimmed.starts_with("---") {
        return (None, raw);
    }
    let rest = trimmed.strip_prefix("---").unwrap_or(trimmed);
    if let Some(end) = rest.find("\n---") {
        let fm = rest[..end].trim();
        let body = rest[end + 4..].trim_start_matches('\n');
        return (Some(fm), body);
    }
    (None, raw)
}

pub fn list_agents(project_path: Option<&str>) -> Vec<CcAgentEntry> {
    let mut agents = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for scope in ["project", "global"] {
        let Some(dir) = agents_dir(scope, project_path) else {
            continue;
        };
        if !dir.is_dir() {
            continue;
        }
        let Ok(entries) = fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("md") {
                continue;
            }
            if let Some(agent) = parse_agent_file(&path, scope) {
                if seen.insert(agent.id.clone()) {
                    agents.push(agent);
                }
            }
        }
    }
    agents.sort_by(|a, b| a.name.cmp(&b.name));
    agents
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CcAgentInput {
    pub id: Option<String>,
    pub name: String,
    pub description: String,
    pub prompt: String,
    pub scope: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CcAgentDeleteRequest {
    pub id: String,
    pub scope: String,
}

fn slugify_agent_id(name: &str) -> String {
    let mut out = String::new();
    let mut prev_dash = false;
    for ch in name.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
            prev_dash = false;
        } else if (ch.is_whitespace() || ch == '-' || ch == '_') && !prev_dash && !out.is_empty() {
            out.push('-');
            prev_dash = true;
        }
    }
    out.trim_matches('-').to_string()
}

pub fn save_agent(project_path: Option<&str>, input: &CcAgentInput) -> Result<CcAgentEntry, String> {
    let scope = input.scope.as_str();
    if scope != "global" && scope != "project" {
        return Err(format!("未知 scope: {scope}"));
    }
    let name = input.name.trim();
    if name.is_empty() {
        return Err("名称不能为空".into());
    }
    let prompt = input.prompt.trim();
    if prompt.is_empty() {
        return Err("指令内容不能为空".into());
    }
    let id = input
        .id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| slugify_agent_id(name));
    if id.is_empty() {
        return Err("无法生成 Agent ID".into());
    }
    let Some(dir) = agents_dir(scope, project_path) else {
        return Err("无法定位 agents 目录".into());
    };
    fs::create_dir_all(&dir).map_err(|e| format!("创建目录失败: {e}"))?;
    let path = dir.join(format!("{id}.md"));
    let description = input.description.trim();
    let content = format!(
        "---\nname: \"{}\"\ndescription: \"{}\"\n---\n\n{}",
        name.replace('"', "\\\""),
        description.replace('"', "\\\""),
        prompt
    );
    fs::write(&path, content).map_err(|e| format!("写入失败: {e}"))?;
    parse_agent_file(&path, scope).ok_or_else(|| "保存后解析失败".into())
}

pub fn delete_agent(project_path: Option<&str>, id: &str, scope: &str) -> Result<(), String> {
    let id = id.trim();
    if id.is_empty() {
        return Err("Agent ID 不能为空".into());
    }
    if scope != "global" && scope != "project" {
        return Err(format!("未知 scope: {scope}"));
    }
    let Some(dir) = agents_dir(scope, project_path) else {
        return Err("无法定位 agents 目录".into());
    };
    let path = dir.join(format!("{id}.md"));
    if !path.is_file() {
        return Err(format!("未找到 Agent: {id}"));
    }
    fs::remove_file(&path).map_err(|e| format!("删除失败: {e}"))
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CcAgentImportRequest {
    pub scope: String,
    pub source_paths: Vec<String>,
    #[serde(default = "default_agent_conflict_mode")]
    pub conflict_mode: String,
}

fn default_agent_conflict_mode() -> String {
    "skip".to_string()
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CcAgentImportResult {
    pub imported: Vec<String>,
    pub skipped: Vec<String>,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CcImportPreviewItem {
    pub id: String,
    pub name: String,
    pub status: String,
    pub source_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CcImportPreview {
    pub items: Vec<CcImportPreviewItem>,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CcAgentExportRequest {
    pub agents: Vec<CcAgentDeleteRequest>,
    pub dest_dir: String,
    pub format: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CcAgentExportResult {
    pub exported: Vec<String>,
    pub errors: Vec<String>,
}

fn resolve_agent_dest_id(
    requested_id: &str,
    dest: &Path,
    conflict_mode: &str,
) -> Result<String, String> {
    let base = requested_id.trim();
    if base.is_empty() {
        return Err("Agent ID 无效".into());
    }
    if !dest.join(format!("{base}.md")).exists() {
        return Ok(base.to_string());
    }
    match conflict_mode {
        "overwrite" => Ok(base.to_string()),
        "rename" => {
            for n in 2..100 {
                let candidate = format!("{base}-{n}");
                if !dest.join(format!("{candidate}.md")).exists() {
                    return Ok(candidate);
                }
            }
            Err(format!("无法为 {base} 生成不重名 ID"))
        }
        _ => Err(format!("已存在同名 Agent: {base}")),
    }
}

fn collect_agent_source_files(source: &Path, out: &mut Vec<PathBuf>) {
    if source.is_file() {
        let ext = source.extension().and_then(|e| e.to_str()).unwrap_or("");
        if ext == "md" || ext == "json" {
            out.push(source.to_path_buf());
        }
        return;
    }
    if !source.is_dir() {
        return;
    }
    let Ok(entries) = fs::read_dir(source) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_agent_source_files(&path, out);
        } else {
            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
            if ext == "md" || ext == "json" {
                out.push(path);
            }
        }
    }
}

fn agent_id_from_source(path: &Path) -> String {
    path.file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "agent".to_string())
}

fn write_agent_file(
    dest: &Path,
    id: &str,
    name: &str,
    description: &str,
    prompt: &str,
) -> Result<(), String> {
    fs::create_dir_all(dest).map_err(|e| format!("创建目录失败: {e}"))?;
    let path = dest.join(format!("{id}.md"));
    let content = format!(
        "---\nname: \"{}\"\ndescription: \"{}\"\n---\n\n{}",
        name.replace('"', "\\\""),
        description.replace('"', "\\\""),
        prompt.trim()
    );
    fs::write(&path, content).map_err(|e| format!("写入失败: {e}"))
}

fn import_agent_md_file(
    src: &Path,
    dest: &Path,
    conflict_mode: &str,
    imported: &mut Vec<String>,
    skipped: &mut Vec<String>,
    errors: &mut Vec<String>,
) {
    let Some(parsed) = parse_agent_file(src, "import") else {
        errors.push(format!("无法解析 Agent 文件: {}", src.display()));
        return;
    };
    let requested_id = agent_id_from_source(src);
    match resolve_agent_dest_id(&requested_id, dest, conflict_mode) {
        Ok(dest_id) => {
            if let Err(e) = write_agent_file(
                dest,
                &dest_id,
                &parsed.name,
                &parsed.description,
                &parsed.prompt,
            ) {
                errors.push(format!("{}: {e}", src.display()));
                return;
            }
            imported.push(dest_id);
        }
        Err(msg) => {
            if conflict_mode == "skip" {
                skipped.push(requested_id);
            } else {
                errors.push(format!("{}: {msg}", src.display()));
            }
        }
    }
}

fn import_agent_json_file(
    src: &Path,
    dest: &Path,
    conflict_mode: &str,
    imported: &mut Vec<String>,
    skipped: &mut Vec<String>,
    errors: &mut Vec<String>,
) {
    let raw = match fs::read_to_string(src) {
        Ok(s) => s,
        Err(e) => {
            errors.push(format!("{}: {e}", src.display()));
            return;
        }
    };
    let value: serde_json::Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(e) => {
            errors.push(format!("{}: JSON 解析失败: {e}", src.display()));
            return;
        }
    };
    let items: Vec<serde_json::Value> = match value {
        serde_json::Value::Array(arr) => arr,
        obj @ serde_json::Value::Object(_) => vec![obj],
        _ => {
            errors.push(format!("{}: JSON 格式无效", src.display()));
            return;
        }
    };
    for item in items {
        let Some(obj) = item.as_object() else {
            continue;
        };
        let name = obj
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("Agent")
            .trim()
            .to_string();
        let description = obj
            .get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .to_string();
        let prompt = obj
            .get("prompt")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .to_string();
        if prompt.is_empty() {
            errors.push(format!("{}: 缺少 prompt 字段", src.display()));
            continue;
        }
        let requested_id = obj
            .get("id")
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string)
            .unwrap_or_else(|| slugify_agent_id(&name));
        match resolve_agent_dest_id(&requested_id, dest, conflict_mode) {
            Ok(dest_id) => {
                if let Err(e) = write_agent_file(dest, &dest_id, &name, &description, &prompt) {
                    errors.push(format!("{}: {e}", src.display()));
                    continue;
                }
                imported.push(dest_id);
            }
            Err(msg) => {
                if conflict_mode == "skip" {
                    skipped.push(requested_id);
                } else {
                    errors.push(format!("{}: {msg}", src.display()));
                }
            }
        }
    }
}

pub fn import_agents(
    project_path: Option<&str>,
    scope: &str,
    source_paths: &[String],
    conflict_mode: &str,
) -> CcAgentImportResult {
    let mut imported = Vec::new();
    let mut skipped = Vec::new();
    let mut errors = Vec::new();
    let mode = match conflict_mode {
        "overwrite" | "rename" | "skip" => conflict_mode,
        _ => "skip",
    };
    let Some(dest) = agents_dir(scope, project_path) else {
        errors.push("无法定位 agents 目录".into());
        return CcAgentImportResult {
            imported,
            skipped,
            errors,
        };
    };

    let mut files = Vec::new();
    for source in source_paths {
        let src = PathBuf::from(source.trim());
        if !src.exists() {
            errors.push(format!("路径不存在: {source}"));
            continue;
        }
        collect_agent_source_files(&src, &mut files);
    }

    for file in files {
        let ext = file.extension().and_then(|e| e.to_str()).unwrap_or("");
        if ext == "json" {
            import_agent_json_file(&file, &dest, mode, &mut imported, &mut skipped, &mut errors);
        } else {
            import_agent_md_file(&file, &dest, mode, &mut imported, &mut skipped, &mut errors);
        }
    }

    CcAgentImportResult {
        imported,
        skipped,
        errors,
    }
}

fn preview_agent_item(
    requested_id: &str,
    name: &str,
    source_path: &str,
    dest: &std::path::Path,
) -> CcImportPreviewItem {
    let status = if dest.join(format!("{requested_id}.md")).exists() {
        "conflict"
    } else {
        "new"
    };
    CcImportPreviewItem {
        id: requested_id.to_string(),
        name: name.to_string(),
        status: status.to_string(),
        source_path: source_path.to_string(),
        message: None,
    }
}

pub fn preview_agents_import(
    project_path: Option<&str>,
    scope: &str,
    source_paths: &[String],
) -> CcImportPreview {
    let mut items = Vec::new();
    let mut errors = Vec::new();
    let Some(dest) = agents_dir(scope, project_path) else {
        errors.push("无法定位 agents 目录".into());
        return CcImportPreview { items, errors };
    };

    let mut files = Vec::new();
    for source in source_paths {
        let src = PathBuf::from(source.trim());
        if !src.exists() {
            errors.push(format!("路径不存在: {source}"));
            continue;
        }
        collect_agent_source_files(&src, &mut files);
    }

    for file in files {
        let ext = file.extension().and_then(|e| e.to_str()).unwrap_or("");
        if ext == "json" {
            let raw = match fs::read_to_string(&file) {
                Ok(s) => s,
                Err(e) => {
                    errors.push(format!("{}: {e}", file.display()));
                    continue;
                }
            };
            let value: serde_json::Value = match serde_json::from_str(&raw) {
                Ok(v) => v,
                Err(e) => {
                    errors.push(format!("{}: JSON 解析失败: {e}", file.display()));
                    continue;
                }
            };
            let list: Vec<serde_json::Value> = match value {
                serde_json::Value::Array(arr) => arr,
                obj @ serde_json::Value::Object(_) => vec![obj],
                _ => {
                    errors.push(format!("{}: JSON 格式无效", file.display()));
                    continue;
                }
            };
            for item in list {
                let Some(obj) = item.as_object() else {
                    continue;
                };
                let name = obj
                    .get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Agent")
                    .trim()
                    .to_string();
                let requested_id = obj
                    .get("id")
                    .and_then(|v| v.as_str())
                    .map(str::trim)
                    .filter(|s| !s.is_empty())
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| agent_id_from_source(&file));
                items.push(preview_agent_item(
                    &requested_id,
                    &name,
                    &file.display().to_string(),
                    &dest,
                ));
            }
        } else {
            let Some(parsed) = parse_agent_file(&file, "import") else {
                errors.push(format!("无法解析 Agent 文件: {}", file.display()));
                continue;
            };
            let requested_id = agent_id_from_source(&file);
            items.push(preview_agent_item(
                &requested_id,
                &parsed.name,
                &file.display().to_string(),
                &dest,
            ));
        }
    }

    CcImportPreview { items, errors }
}

pub fn export_agents(
    project_path: Option<&str>,
    agents: &[CcAgentDeleteRequest],
    dest_dir: &str,
    format: &str,
) -> CcAgentExportResult {
    let mut exported = Vec::new();
    let mut errors = Vec::new();
    let dest = PathBuf::from(dest_dir.trim());
    if dest_dir.trim().is_empty() {
        errors.push("导出目录不能为空".into());
        return CcAgentExportResult { exported, errors };
    }
    if let Err(e) = fs::create_dir_all(&dest) {
        errors.push(format!("创建导出目录失败: {e}"));
        return CcAgentExportResult { exported, errors };
    }

    let all = list_agents(project_path);
    let selected: Vec<CcAgentEntry> = agents
        .iter()
        .filter_map(|req| {
            all.iter()
                .find(|a| a.id == req.id && a.scope == req.scope)
                .cloned()
        })
        .collect();

    if selected.is_empty() {
        errors.push("未找到要导出的 Agent".into());
        return CcAgentExportResult { exported, errors };
    }

    if format == "json" {
        let payload: Vec<serde_json::Value> = selected
            .iter()
            .map(|a| {
                serde_json::json!({
                    "id": a.id,
                    "name": a.name,
                    "description": a.description,
                    "prompt": a.prompt,
                    "scope": a.scope,
                })
            })
            .collect();
        let path = dest.join("agents-export.json");
        match serde_json::to_string_pretty(&payload) {
            Ok(json) => {
                if let Err(e) = fs::write(&path, json) {
                    errors.push(format!("写入 JSON 失败: {e}"));
                } else {
                    exported.push(path.display().to_string());
                }
            }
            Err(e) => errors.push(format!("序列化 JSON 失败: {e}")),
        }
        return CcAgentExportResult { exported, errors };
    }

    if format == "zip" {
        use std::io::Write;
        let zip_path = dest.join("agents-export.zip");
        let file = match fs::File::create(&zip_path) {
            Ok(f) => f,
            Err(e) => {
                errors.push(format!("创建 ZIP 失败: {e}"));
                return CcAgentExportResult { exported, errors };
            }
        };
        let mut zip = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);
        for agent in &selected {
            let filename = format!("{}.md", agent.id);
            let content = format!(
                "---\nname: \"{}\"\ndescription: \"{}\"\n---\n\n{}",
                agent.name.replace('"', "\\\""),
                agent.description.replace('"', "\\\""),
                agent.prompt.trim()
            );
            if let Err(e) = zip.start_file(&filename, options) {
                errors.push(format!("{}: {e}", agent.id));
                continue;
            }
            if let Err(e) = zip.write_all(content.as_bytes()) {
                errors.push(format!("{}: {e}", agent.id));
                continue;
            }
            exported.push(filename);
        }
        if let Err(e) = zip.finish() {
            errors.push(format!("完成 ZIP 失败: {e}"));
        } else {
            exported.clear();
            exported.push(zip_path.display().to_string());
        }
        return CcAgentExportResult { exported, errors };
    }

    for agent in selected {
        let path = dest.join(format!("{}.md", agent.id));
        if let Err(e) = write_agent_file(&dest, &agent.id, &agent.name, &agent.description, &agent.prompt)
        {
            errors.push(format!("{}: {e}", agent.id));
            continue;
        }
        exported.push(path.display().to_string());
    }

    CcAgentExportResult { exported, errors }
}

fn prompts_dir(scope: &str, project_path: Option<&str>) -> Option<PathBuf> {
    match scope {
        "global" => dirs::home_dir().map(|h| h.join(".claude").join("prompts")),
        "project" => project_path
            .filter(|p| !p.trim().is_empty())
            .map(|p| PathBuf::from(p).join(".claude").join("prompts")),
        _ => None,
    }
}

fn parse_prompt_file(path: &Path, scope: &str) -> Option<CcPromptEntry> {
    let raw = fs::read_to_string(path).ok()?;
    let stem = path.file_stem()?.to_string_lossy().to_string();
    let (frontmatter, body) = split_frontmatter(&raw);
    let mut name = stem.replace('-', " ");
    let mut description = String::new();
    if let Some(fm) = frontmatter {
        for line in fm.lines() {
            let line = line.trim();
            if let Some(rest) = line.strip_prefix("name:") {
                name = rest.trim().trim_matches('"').to_string();
            } else if let Some(rest) = line.strip_prefix("description:") {
                description = rest.trim().trim_matches('"').to_string();
            }
        }
    }
    Some(CcPromptEntry {
        id: stem,
        name,
        description,
        content: body.trim().to_string(),
        scope: scope.to_string(),
    })
}

fn write_prompt_file(
    dest: &Path,
    id: &str,
    name: &str,
    description: &str,
    content: &str,
) -> Result<(), String> {
    fs::create_dir_all(dest).map_err(|e| format!("创建目录失败: {e}"))?;
    let path = dest.join(format!("{id}.md"));
    let body = format!(
        "---\nname: \"{}\"\ndescription: \"{}\"\n---\n\n{}",
        name.replace('"', "\\\""),
        description.replace('"', "\\\""),
        content.trim()
    );
    fs::write(&path, body).map_err(|e| format!("写入失败: {e}"))
}

pub fn list_prompts(project_path: Option<&str>) -> Vec<CcPromptEntry> {
    let mut prompts: Vec<CcPromptEntry> = BUILTIN_PROMPTS
        .iter()
        .map(|(id, name, content)| CcPromptEntry {
            id: (*id).to_string(),
            name: (*name).to_string(),
            description: String::new(),
            content: (*content).to_string(),
            scope: "builtin".to_string(),
        })
        .collect();

    for scope in ["project", "global"] {
        let Some(dir) = prompts_dir(scope, project_path) else {
            continue;
        };
        if !dir.is_dir() {
            continue;
        }
        let Ok(entries) = fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
            if ext != "md" && ext != "txt" {
                continue;
            }
            if let Some(prompt) = parse_prompt_file(&path, scope) {
                prompts.push(prompt);
            }
        }
    }
    prompts.sort_by(|a, b| {
        a.scope
            .cmp(&b.scope)
            .then_with(|| a.name.cmp(&b.name))
    });
    prompts
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CcPromptInput {
    pub id: Option<String>,
    pub name: String,
    pub description: String,
    pub content: String,
    pub scope: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CcPromptDeleteRequest {
    pub id: String,
    pub scope: String,
}

pub fn save_prompt(project_path: Option<&str>, input: &CcPromptInput) -> Result<CcPromptEntry, String> {
    let scope = input.scope.as_str();
    if scope != "global" && scope != "project" {
        return Err(format!("未知 scope: {scope}"));
    }
    let name = input.name.trim();
    if name.is_empty() {
        return Err("名称不能为空".into());
    }
    let content = input.content.trim();
    if content.is_empty() {
        return Err("模板内容不能为空".into());
    }
    let id = input
        .id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| slugify_agent_id(name));
    if id.is_empty() {
        return Err("无法生成提示词 ID".into());
    }
    let Some(dir) = prompts_dir(scope, project_path) else {
        return Err("无法定位 prompts 目录".into());
    };
    let description = input.description.trim();
    write_prompt_file(&dir, &id, name, description, content)?;
    let path = dir.join(format!("{id}.md"));
    parse_prompt_file(&path, scope).ok_or_else(|| "保存后解析失败".into())
}

pub fn delete_prompt(project_path: Option<&str>, id: &str, scope: &str) -> Result<(), String> {
    let id = id.trim();
    if id.is_empty() {
        return Err("提示词 ID 不能为空".into());
    }
    if scope != "global" && scope != "project" {
        return Err(format!("未知 scope: {scope}"));
    }
    let Some(dir) = prompts_dir(scope, project_path) else {
        return Err("无法定位 prompts 目录".into());
    };
    let md = dir.join(format!("{id}.md"));
    let txt = dir.join(format!("{id}.txt"));
    if md.is_file() {
        fs::remove_file(&md).map_err(|e| format!("删除失败: {e}"))
    } else if txt.is_file() {
        fs::remove_file(&txt).map_err(|e| format!("删除失败: {e}"))
    } else {
        Err(format!("未找到提示词: {id}"))
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CcPromptImportRequest {
    pub scope: String,
    pub source_paths: Vec<String>,
    #[serde(default = "default_agent_conflict_mode")]
    pub conflict_mode: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CcPromptImportResult {
    pub imported: Vec<String>,
    pub skipped: Vec<String>,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CcPromptExportRequest {
    pub prompts: Vec<CcPromptDeleteRequest>,
    pub dest_dir: String,
    pub format: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CcPromptExportResult {
    pub exported: Vec<String>,
    pub errors: Vec<String>,
}

fn collect_prompt_source_files(source: &Path, out: &mut Vec<PathBuf>) {
    if source.is_file() {
        let ext = source.extension().and_then(|e| e.to_str()).unwrap_or("");
        if ext == "md" || ext == "json" || ext == "txt" {
            out.push(source.to_path_buf());
        }
        return;
    }
    if !source.is_dir() {
        return;
    }
    let Ok(entries) = fs::read_dir(source) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_prompt_source_files(&path, out);
        } else {
            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
            if ext == "md" || ext == "json" || ext == "txt" {
                out.push(path);
            }
        }
    }
}

fn import_prompt_md_file(
    src: &Path,
    dest: &Path,
    conflict_mode: &str,
    imported: &mut Vec<String>,
    skipped: &mut Vec<String>,
    errors: &mut Vec<String>,
) {
    let Some(parsed) = parse_prompt_file(src, "import") else {
        errors.push(format!("无法解析提示词文件: {}", src.display()));
        return;
    };
    let requested_id = src
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| slugify_agent_id(&parsed.name));
    match resolve_agent_dest_id(&requested_id, dest, conflict_mode) {
        Ok(dest_id) => {
            if let Err(e) = write_prompt_file(
                dest,
                &dest_id,
                &parsed.name,
                &parsed.description,
                &parsed.content,
            ) {
                errors.push(format!("{}: {e}", src.display()));
                return;
            }
            imported.push(dest_id);
        }
        Err(msg) => {
            if conflict_mode == "skip" {
                skipped.push(requested_id);
            } else {
                errors.push(format!("{}: {msg}", src.display()));
            }
        }
    }
}

fn import_prompt_json_file(
    src: &Path,
    dest: &Path,
    conflict_mode: &str,
    imported: &mut Vec<String>,
    skipped: &mut Vec<String>,
    errors: &mut Vec<String>,
) {
    let raw = match fs::read_to_string(src) {
        Ok(s) => s,
        Err(e) => {
            errors.push(format!("{}: {e}", src.display()));
            return;
        }
    };
    let value: serde_json::Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(e) => {
            errors.push(format!("{}: JSON 解析失败: {e}", src.display()));
            return;
        }
    };
    let items: Vec<serde_json::Value> = match value {
        serde_json::Value::Array(arr) => arr,
        obj @ serde_json::Value::Object(_) => vec![obj],
        _ => {
            errors.push(format!("{}: JSON 格式无效", src.display()));
            return;
        }
    };
    for item in items {
        let Some(obj) = item.as_object() else {
            continue;
        };
        let name = obj
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("提示词")
            .trim()
            .to_string();
        let description = obj
            .get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .to_string();
        let content = obj
            .get("content")
            .or_else(|| obj.get("prompt"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .to_string();
        if content.is_empty() {
            errors.push(format!("{}: 缺少 content 字段", src.display()));
            continue;
        }
        let requested_id = obj
            .get("id")
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string)
            .unwrap_or_else(|| slugify_agent_id(&name));
        match resolve_agent_dest_id(&requested_id, dest, conflict_mode) {
            Ok(dest_id) => {
                if let Err(e) =
                    write_prompt_file(dest, &dest_id, &name, &description, &content)
                {
                    errors.push(format!("{}: {e}", src.display()));
                    continue;
                }
                imported.push(dest_id);
            }
            Err(msg) => {
                if conflict_mode == "skip" {
                    skipped.push(requested_id);
                } else {
                    errors.push(format!("{}: {msg}", src.display()));
                }
            }
        }
    }
}

pub fn import_prompts(
    project_path: Option<&str>,
    scope: &str,
    source_paths: &[String],
    conflict_mode: &str,
) -> CcPromptImportResult {
    let mut imported = Vec::new();
    let mut skipped = Vec::new();
    let mut errors = Vec::new();
    let mode = match conflict_mode {
        "overwrite" | "rename" | "skip" => conflict_mode,
        _ => "skip",
    };
    let Some(dest) = prompts_dir(scope, project_path) else {
        errors.push("无法定位 prompts 目录".into());
        return CcPromptImportResult {
            imported,
            skipped,
            errors,
        };
    };
    let mut files = Vec::new();
    for src in source_paths {
        collect_prompt_source_files(&PathBuf::from(src), &mut files);
    }
    for src in files {
        let ext = src.extension().and_then(|e| e.to_str()).unwrap_or("");
        if ext == "json" {
            import_prompt_json_file(&src, &dest, mode, &mut imported, &mut skipped, &mut errors);
        } else {
            import_prompt_md_file(&src, &dest, mode, &mut imported, &mut skipped, &mut errors);
        }
    }
    CcPromptImportResult {
        imported,
        skipped,
        errors,
    }
}

pub fn preview_prompts_import(
    project_path: Option<&str>,
    scope: &str,
    source_paths: &[String],
) -> CcImportPreview {
    let mut items = Vec::new();
    let mut errors = Vec::new();
    let Some(dest) = prompts_dir(scope, project_path) else {
        errors.push("无法定位 prompts 目录".into());
        return CcImportPreview { items, errors };
    };
    let mut files = Vec::new();
    for src in source_paths {
        collect_prompt_source_files(&PathBuf::from(src), &mut files);
    }
    for file in files {
        let ext = file.extension().and_then(|e| e.to_str()).unwrap_or("");
        if ext == "json" {
            let raw = match fs::read_to_string(&file) {
                Ok(s) => s,
                Err(e) => {
                    errors.push(format!("{}: {e}", file.display()));
                    continue;
                }
            };
            let value: serde_json::Value = match serde_json::from_str(&raw) {
                Ok(v) => v,
                Err(e) => {
                    errors.push(format!("{}: JSON 解析失败: {e}", file.display()));
                    continue;
                }
            };
            let list: Vec<serde_json::Value> = match value {
                serde_json::Value::Array(arr) => arr,
                obj @ serde_json::Value::Object(_) => vec![obj],
                _ => {
                    errors.push(format!("{}: JSON 格式无效", file.display()));
                    continue;
                }
            };
            for item in list {
                let Some(obj) = item.as_object() else {
                    continue;
                };
                let name = obj
                    .get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("提示词")
                    .trim()
                    .to_string();
                let requested_id = obj
                    .get("id")
                    .and_then(|v| v.as_str())
                    .map(str::trim)
                    .filter(|s| !s.is_empty())
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| slugify_agent_id(&name));
                let status = if dest.join(format!("{requested_id}.md")).exists()
                    || dest.join(format!("{requested_id}.txt")).exists()
                {
                    "conflict"
                } else {
                    "new"
                };
                items.push(CcImportPreviewItem {
                    id: requested_id,
                    name,
                    status: status.to_string(),
                    source_path: file.display().to_string(),
                    message: None,
                });
            }
        } else {
            let Some(parsed) = parse_prompt_file(&file, "import") else {
                errors.push(format!("无法解析提示词文件: {}", file.display()));
                continue;
            };
            let requested_id = file
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_else(|| slugify_agent_id(&parsed.name));
            let status = if dest.join(format!("{requested_id}.md")).exists()
                || dest.join(format!("{requested_id}.txt")).exists()
            {
                "conflict"
            } else {
                "new"
            };
            items.push(CcImportPreviewItem {
                id: requested_id,
                name: parsed.name,
                status: status.to_string(),
                source_path: file.display().to_string(),
                message: None,
            });
        }
    }
    CcImportPreview { items, errors }
}

pub fn export_prompts(
    project_path: Option<&str>,
    selected: &[CcPromptDeleteRequest],
    dest_dir: &str,
    format: &str,
) -> CcPromptExportResult {
    let mut exported = Vec::new();
    let mut errors = Vec::new();
    let dest = PathBuf::from(dest_dir);
    if !dest.is_dir() {
        errors.push("导出目录不存在".into());
        return CcPromptExportResult { exported, errors };
    }
    let all = list_prompts(project_path);
    let format = format.trim().to_lowercase();

    if format == "json" {
        let mut items = Vec::new();
        for req in selected {
            let Some(p) = all
                .iter()
                .find(|p| p.scope == req.scope && p.id == req.id)
            else {
                errors.push(format!("未找到提示词: {} ({})", req.id, req.scope));
                continue;
            };
            items.push(serde_json::json!({
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "content": p.content,
                "scope": p.scope,
            }));
        }
        if !items.is_empty() {
            let path = dest.join("prompts-export.json");
            match serde_json::to_string_pretty(&items) {
                Ok(json) => {
                    if let Err(e) = fs::write(&path, json) {
                        errors.push(format!("写入 JSON 失败: {e}"));
                    } else {
                        exported.push(path.display().to_string());
                    }
                }
                Err(e) => errors.push(format!("序列化 JSON 失败: {e}")),
            }
        }
        return CcPromptExportResult { exported, errors };
    }

    for req in selected {
        let Some(p) = all
            .iter()
            .find(|p| p.scope == req.scope && p.id == req.id)
        else {
            errors.push(format!("未找到提示词: {} ({})", req.id, req.scope));
            continue;
        };
        if let Err(e) = write_prompt_file(&dest, &p.id, &p.name, &p.description, &p.content) {
            errors.push(format!("{}: {e}", p.id));
            continue;
        }
        exported.push(dest.join(format!("{}.md", p.id)).display().to_string());
    }
    CcPromptExportResult { exported, errors }
}

const SKIP_DIRS: &[&str] = &[
    ".git",
    "node_modules",
    "target",
    "dist",
    ".lizhi-kb",
    "__pycache__",
    ".next",
];

pub fn should_skip_dir(name: &str) -> bool {
    SKIP_DIRS.contains(&name) || name.starts_with('.')
}

fn collect_project_files(
    root: &Path,
    current: &Path,
    query: &str,
    out: &mut Vec<CcContextFileEntry>,
    limit: usize,
) {
    if out.len() >= limit {
        return;
    }
    let Ok(entries) = fs::read_dir(current) else {
        return;
    };
    let mut dirs = Vec::new();
    let mut files = Vec::new();
    for entry in entries.flatten() {
        let Ok(meta) = entry.metadata() else {
            continue;
        };
        let name = entry.file_name().to_string_lossy().to_string();
        if meta.is_dir() {
            if !should_skip_dir(&name) {
                dirs.push(entry.path());
            }
        } else if meta.is_file() {
            files.push(entry.path());
        }
    }
    dirs.sort();
    files.sort();
    for path in files {
        if out.len() >= limit {
            return;
        }
        let rel = path
            .strip_prefix(root)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");
        let file_name = path
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| rel.clone());
        if query.is_empty()
            || rel.to_lowercase().contains(query)
            || file_name.to_lowercase().contains(query)
        {
            out.push(CcContextFileEntry {
                path: rel,
                name: file_name,
                kind: "file".to_string(),
            });
        }
    }
    for dir in dirs {
        collect_project_files(root, &dir, query, out, limit);
        if out.len() >= limit {
            return;
        }
    }
}

pub fn list_context_files_project(project_path: &str, query: &str) -> Result<Vec<CcContextFileEntry>, String> {
    let root = PathBuf::from(project_path);
    if !root.is_dir() {
        return Err("项目目录不存在".into());
    }
    let q = query.trim().to_lowercase();
    let mut out = Vec::new();
    collect_project_files(&root, &root, &q, &mut out, 200);
    out.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(out)
}

pub fn list_context_files_vault(
    document_paths: &[String],
    query: &str,
) -> Vec<CcContextFileEntry> {
    let q = query.trim().to_lowercase();
    let mut out: Vec<CcContextFileEntry> = document_paths
        .iter()
        .filter_map(|path| {
            let name = Path::new(path)
                .file_name()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_else(|| path.clone());
            if !q.is_empty()
                && !path.to_lowercase().contains(&q)
                && !name.to_lowercase().contains(&q)
            {
                return None;
            }
            Some(CcContextFileEntry {
                path: path.clone(),
                name,
                kind: "document".to_string(),
            })
        })
        .collect();
    out.sort_by(|a, b| a.path.cmp(&b.path));
    out.truncate(200);
    out
}

pub fn cwd_mode_from_str(raw: &str) -> CwdMode {
    if raw == "project" {
        CwdMode::Project
    } else {
        CwdMode::Vault
    }
}
