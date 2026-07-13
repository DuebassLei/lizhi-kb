use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;

const MAX_COMMAND_SCAN_DEPTH: usize = 10;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CcSlashCommandEntry {
    pub id: String,
    pub name: String,
    pub description: String,
    pub source: String,
}

const BUILTIN_COMMANDS: &[(&str, &str, &str)] = &[
    ("/clear", "清空对话并创建新会话", "local"),
    (
        "/compact",
        "总结对话以释放上下文",
        "builtin",
    ),
    (
        "/context",
        "可视化当前上下文用量（彩色网格）",
        "builtin",
    ),
    (
        "/init",
        "初始化 CLAUDE.md 代码库文档",
        "builtin",
    ),
    ("/plan", "切换到规划模式", "builtin"),
    ("/resume", "恢复之前的对话", "builtin"),
    ("/review", "审查 Pull Request", "builtin"),
    (
        "/batch",
        "在隔离 worktree 中并行执行大规模变更",
        "bundled",
    ),
    (
        "/claude-api",
        "使用 Claude API 或 Anthropic SDK 构建应用",
        "bundled",
    ),
    (
        "/debug",
        "启用调试日志并诊断会话问题",
        "bundled",
    ),
    (
        "/loop",
        "按固定间隔重复执行提示词或命令",
        "bundled",
    ),
    (
        "/simplify",
        "审查变更代码的可复用性、质量与效率",
        "bundled",
    ),
    (
        "/update-config",
        "配置 settings.json（hooks、权限、环境变量）",
        "bundled",
    ),
];

fn claude_dir(scope: &str, project_path: Option<&str>) -> Option<PathBuf> {
    match scope {
        "global" => dirs::home_dir().map(|h| h.join(".claude")),
        "project" => project_path
            .filter(|p| !p.trim().is_empty())
            .map(|p| PathBuf::from(p).join(".claude")),
        _ => None,
    }
}

fn format_source_label(source: &str) -> String {
    match source {
        "local" => "本地".to_string(),
        "builtin" => "内置".to_string(),
        "bundled" => "bundled".to_string(),
        "skill" => "skill".to_string(),
        "command" => "command".to_string(),
        other if other.starts_with("skill:") => format!("skill [{other}]"),
        other if other.starts_with("command:") => format!("command [{other}]"),
        other => other.to_string(),
    }
}

fn push_command(
    merged: &mut HashMap<String, CcSlashCommandEntry>,
    name: &str,
    description: &str,
    source: &str,
) {
    let normalized = if name.starts_with('/') {
        name.to_string()
    } else {
        format!("/{name}")
    };
    let id = normalized.trim_start_matches('/').to_string();
    merged.insert(
        normalized.clone(),
        CcSlashCommandEntry {
            id,
            name: normalized,
            description: description.to_string(),
            source: format_source_label(source),
        },
    );
}

pub fn list_slash_commands(project_path: Option<&str>) -> Vec<CcSlashCommandEntry> {
    let mut merged: HashMap<String, CcSlashCommandEntry> = HashMap::new();

    for (name, desc, source) in BUILTIN_COMMANDS {
        push_command(&mut merged, name, desc, source);
    }

    for scope in ["project", "global"] {
        if let Some(claude) = claude_dir(scope, project_path) {
            let skills_dir = claude.join("skills");
            scan_skills_as_commands(&skills_dir, scope, &mut merged);
            let commands_dir = claude.join("commands");
            scan_commands_dir(&commands_dir, scope, &mut merged);
        }
    }

    let mut out: Vec<CcSlashCommandEntry> = merged.into_values().collect();
    out.sort_by(|a, b| a.name.cmp(&b.name));
    out
}

fn scan_skills_as_commands(dir: &Path, scope: &str, out: &mut HashMap<String, CcSlashCommandEntry>) {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let dir_name = entry.file_name().to_string_lossy().to_string();
        if dir_name.starts_with('.') {
            continue;
        }
        let skill_md = locate_skill_md(&path);
        let Some(skill_md) = skill_md else {
            continue;
        };
        let raw = match fs::read_to_string(&skill_md) {
            Ok(s) => s,
            Err(_) => continue,
        };
        let meta = parse_skill_frontmatter(&raw, &dir_name);
        if !meta.user_invocable {
            continue;
        }
        let source = if scope == "global" {
            "skill:global".to_string()
        } else {
            "skill:project".to_string()
        };
        push_command(out, &meta.name, &meta.description, &source);
    }
}

fn locate_skill_md(skill_dir: &Path) -> Option<PathBuf> {
    let upper = skill_dir.join("SKILL.md");
    if upper.is_file() {
        return Some(upper);
    }
    let lower = skill_dir.join("skill.md");
    if lower.is_file() {
        return Some(lower);
    }
    None
}

struct SkillMeta {
    name: String,
    description: String,
    user_invocable: bool,
}

fn parse_skill_frontmatter(raw: &str, fallback_name: &str) -> SkillMeta {
    let mut name = fallback_name.to_string();
    let mut description = String::new();
    let mut user_invocable = true;

    if let Some(fm) = extract_frontmatter(raw) {
        for line in fm.lines() {
            let trimmed = line.trim();
            if let Some(rest) = trimmed.strip_prefix("name:") {
                let value = parse_yaml_scalar(rest.trim());
                if !value.is_empty() {
                    name = value;
                }
            } else if let Some(rest) = trimmed.strip_prefix("description:") {
                let value = parse_yaml_scalar(rest.trim());
                if !value.is_empty() {
                    description = value;
                }
            } else if let Some(rest) = trimmed.strip_prefix("user-invocable:") {
                user_invocable = parse_yaml_bool(rest.trim(), true);
            } else if let Some(rest) = trimmed.strip_prefix("userInvocable:") {
                user_invocable = parse_yaml_bool(rest.trim(), true);
            }
        }
    }

    if description.is_empty() {
        description = first_paragraph_after_frontmatter(raw).unwrap_or_default();
    }

    SkillMeta {
        name,
        description,
        user_invocable,
    }
}

fn scan_commands_dir(base: &Path, scope: &str, out: &mut HashMap<String, CcSlashCommandEntry>) {
    if !base.is_dir() {
        return;
    }
    let source = if scope == "global" {
        "command:global".to_string()
    } else {
        "command:project".to_string()
    };
    scan_commands_recursive(base, base, &source, out, 0);
}

fn scan_commands_recursive(
    dir: &Path,
    base: &Path,
    source: &str,
    out: &mut HashMap<String, CcSlashCommandEntry>,
    depth: usize,
) {
    if depth > MAX_COMMAND_SCAN_DEPTH {
        return;
    }
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    let mut has_skill_md = false;
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.eq_ignore_ascii_case("skill.md") {
            has_skill_md = true;
            break;
        }
    }

    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        if path.is_file() {
            if name.to_lowercase().ends_with(".md") {
                if let Some(cmd) = parse_command_file(&path, base, source) {
                    push_command(out, &cmd.0, &cmd.1, source);
                }
            }
        } else if path.is_dir() && !has_skill_md {
            scan_commands_recursive(&path, base, source, out, depth + 1);
        }
    }
}

fn parse_command_file(path: &Path, base: &Path, _source: &str) -> Option<(String, String)> {
    let stem = path.file_stem()?.to_string_lossy().to_string();
    let namespace = derive_command_namespace(path, base);
    let command_name = if let Some(ns) = namespace {
        format!("/{ns}:{stem}")
    } else {
        format!("/{stem}")
    };
    let raw = fs::read_to_string(path).ok()?;
    let description = description_from_frontmatter(&raw)
        .or_else(|| first_paragraph_after_frontmatter(&raw))
        .unwrap_or_default();
    Some((command_name, description))
}

fn derive_command_namespace(path: &Path, base: &Path) -> Option<String> {
    let parent = path.parent()?;
    if parent == base {
        return None;
    }
    let relative = parent.strip_prefix(base).ok()?;
    if relative.as_os_str().is_empty() {
        return None;
    }
    Some(
        relative
            .components()
            .map(|c| c.as_os_str().to_string_lossy().to_string())
            .collect::<Vec<_>>()
            .join(":"),
    )
}

fn extract_frontmatter(content: &str) -> Option<&str> {
    if !content.starts_with("---") {
        return None;
    }
    let rest = content.get(3..)?;
    let end = rest.find("\n---")?;
    Some(rest.get(..end)?.trim())
}

fn description_from_frontmatter(content: &str) -> Option<String> {
    let fm = extract_frontmatter(content)?;
    for line in fm.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix("description:") {
            let value = parse_yaml_scalar(rest.trim());
            if !value.is_empty() {
                return Some(value);
            }
        }
    }
    None
}

fn first_paragraph_after_frontmatter(content: &str) -> Option<String> {
    let body = if content.starts_with("---") {
        let rest = content.get(3..)?;
        let closing = rest.find("\n---")?;
        rest.get(closing + 4..)?.trim_start()
    } else {
        content.trim()
    };
    let paragraph = body.split("\n\n").next()?.trim();
    let line = paragraph
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())?;
    let line = line.trim_start_matches('#').trim();
    if line.is_empty() {
        None
    } else {
        Some(line.to_string())
    }
}

fn parse_yaml_scalar(raw: &str) -> String {
    let s = raw.trim();
    if s.len() >= 2
        && ((s.starts_with('\'') && s.ends_with('\'')) || (s.starts_with('"') && s.ends_with('"')))
    {
        return s[1..s.len() - 1].to_string();
    }
    s.to_string()
}

fn parse_yaml_bool(raw: &str, default: bool) -> bool {
    match raw.trim().to_lowercase().as_str() {
        "true" | "yes" | "1" => true,
        "false" | "no" | "0" => false,
        _ => default,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_builtin_clear_command() {
        let cmds = list_slash_commands(None);
        assert!(cmds.iter().any(|c| c.name == "/clear"));
    }

    #[test]
    fn parses_user_invocable_false() {
        let raw = "---\nname: hidden-skill\nuser-invocable: false\ndescription: Hidden\n---\n";
        let meta = parse_skill_frontmatter(raw, "dir-name");
        assert!(!meta.user_invocable);
        assert_eq!(meta.name, "hidden-skill");
    }
}
