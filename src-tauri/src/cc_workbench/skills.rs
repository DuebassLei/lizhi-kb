use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use super::providers::CcSkillEntry;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CcSkillToggleRequest {
    pub name: String,
    pub scope: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CcSkillImportRequest {
    pub scope: String,
    pub source_paths: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CcSkillDeleteRequest {
    pub name: String,
    pub scope: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CcSkillImportResult {
    pub imported: Vec<String>,
    pub errors: Vec<String>,
}

pub fn disabled_skills_root(data_dir: &Path) -> PathBuf {
    data_dir.join("cc-skills-disabled")
}

fn active_skills_dir(scope: &str, project_path: Option<&str>) -> Result<PathBuf, String> {
    match scope {
        "global" => dirs::home_dir()
            .map(|h| h.join(".claude").join("skills"))
            .ok_or_else(|| "无法定位用户主目录".to_string()),
        "project" => {
            let path = project_path
                .filter(|p| !p.trim().is_empty())
                .ok_or_else(|| "请先在设置中选择项目目录".to_string())?;
            Ok(PathBuf::from(path).join(".claude").join("skills"))
        }
        _ => Err(format!("未知 scope: {scope}")),
    }
}

fn disabled_skills_dir(data_dir: &Path, scope: &str, project_path: Option<&str>) -> Result<PathBuf, String> {
    let root = disabled_skills_root(data_dir);
    match scope {
        "global" => Ok(root.join("global")),
        "project" => {
            let path = project_path
                .filter(|p| !p.trim().is_empty())
                .ok_or_else(|| "请先在设置中选择项目目录".to_string())?;
            let key = project_path_key(path);
            Ok(root.join("project").join(key))
        }
        _ => Err(format!("未知 scope: {scope}")),
    }
}

fn project_path_key(path: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    path.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

pub fn list_all_skills(data_dir: &Path, project_path: Option<&str>) -> Vec<CcSkillEntry> {
    let mut skills = Vec::new();
    if let Ok(dir) = active_skills_dir("global", project_path) {
        scan_skills_dir(&dir, "global", true, &mut skills);
    }
    if let Ok(dir) = disabled_skills_dir(data_dir, "global", project_path) {
        scan_skills_dir(&dir, "global", false, &mut skills);
    }
    if project_path.filter(|p| !p.trim().is_empty()).is_some() {
        if let Ok(dir) = active_skills_dir("project", project_path) {
            scan_skills_dir(&dir, "project", true, &mut skills);
        }
        if let Ok(dir) = disabled_skills_dir(data_dir, "project", project_path) {
            scan_skills_dir(&dir, "project", false, &mut skills);
        }
    }
    skills.sort_by(|a, b| a.name.cmp(&b.name));
    skills
}

fn scan_skills_dir(dir: &Path, scope: &str, enabled: bool, out: &mut Vec<CcSkillEntry>) {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let skill_md = locate_skill_md(&path);
        let description = skill_md
            .as_ref()
            .and_then(|p| read_skill_description(p));
        out.push(CcSkillEntry {
            id: format!("{scope}-{name}"),
            name: name.clone(),
            scope: scope.to_string(),
            path: path.display().to_string(),
            enabled,
            description,
        });
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

const DESCRIPTION_MAX_LEN: usize = 1024;

fn read_skill_description(skill_md: &Path) -> Option<String> {
    let raw = fs::read_to_string(skill_md).ok()?;
    if let Some(desc) = description_from_frontmatter(&raw) {
        return Some(truncate_description(desc));
    }
    if let Some(desc) = first_paragraph_after_frontmatter(&raw) {
        return Some(truncate_description(desc));
    }
    legacy_description_after_title(&raw).map(truncate_description)
}

fn truncate_description(desc: String) -> String {
    if desc.chars().count() <= DESCRIPTION_MAX_LEN {
        desc
    } else {
        desc.chars().take(DESCRIPTION_MAX_LEN).collect()
    }
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
            let rest = rest.trim();
            if rest.is_empty() {
                continue;
            }
            let value = parse_yaml_scalar(rest);
            if !value.is_empty() {
                return Some(value);
            }
        }
    }
    None
}

fn parse_yaml_scalar(raw: &str) -> String {
    let s = raw.trim();
    if s.len() >= 2 {
        if (s.starts_with('\'') && s.ends_with('\'')) || (s.starts_with('"') && s.ends_with('"')) {
            return s[1..s.len() - 1].to_string();
        }
    }
    s.to_string()
}

fn first_paragraph_after_frontmatter(content: &str) -> Option<String> {
    let body = body_after_frontmatter(content)?;
    if body.is_empty() {
        return None;
    }
    let paragraph = body.split("\n\n").next().unwrap_or(body).trim();
    let paragraph = paragraph
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())?
        .trim_start_matches('#')
        .trim();
    if paragraph.is_empty() {
        None
    } else {
        Some(paragraph.to_string())
    }
}

fn body_after_frontmatter(content: &str) -> Option<&str> {
    if !content.starts_with("---") {
        return None;
    }
    let rest = content.get(3..)?;
    let closing = rest.find("\n---")?;
    Some(rest.get(closing + 4..)?.trim_start())
}

fn legacy_description_after_title(content: &str) -> Option<String> {
    content
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty() && !line.starts_with('#') && !line.starts_with("---"))
        .map(|s| s.to_string())
}

pub fn toggle_skill(
    data_dir: &Path,
    project_path: Option<&str>,
    name: &str,
    scope: &str,
    target_enabled: bool,
) -> Result<(), String> {
    let active_root = active_skills_dir(scope, project_path)?;
    let disabled_root = disabled_skills_dir(data_dir, scope, project_path)?;
    fs::create_dir_all(&active_root).map_err(|e| e.to_string())?;
    fs::create_dir_all(&disabled_root).map_err(|e| e.to_string())?;

    let (from, to) = if target_enabled {
        (disabled_root.join(name), active_root.join(name))
    } else {
        (active_root.join(name), disabled_root.join(name))
    };

    if !from.is_dir() {
        return Err(format!("未找到 Skill 目录: {}", from.display()));
    }
    if to.exists() {
        return Err(format!("目标路径已存在: {}", to.display()));
    }

    fs::rename(&from, &to).map_err(|e| {
        format!(
            "移动 Skill 失败: {e}（从 {} 到 {}）",
            from.display(),
            to.display()
        )
    })
}

pub fn delete_skill(
    data_dir: &Path,
    project_path: Option<&str>,
    name: &str,
    scope: &str,
    enabled: bool,
) -> Result<(), String> {
    let root = if enabled {
        active_skills_dir(scope, project_path)?
    } else {
        disabled_skills_dir(data_dir, scope, project_path)?
    };
    let target = root.join(name);
    if !target.is_dir() {
        return Err(format!("未找到 Skill 目录: {}", target.display()));
    }
    fs::remove_dir_all(&target).map_err(|e| format!("删除 Skill 失败: {e}"))
}

pub fn import_skills(
    _data_dir: &Path,
    project_path: Option<&str>,
    scope: &str,
    source_paths: &[String],
) -> CcSkillImportResult {
    let mut imported = Vec::new();
    let mut errors = Vec::new();
    let target = match active_skills_dir(scope, project_path) {
        Ok(p) => p,
        Err(e) => {
            errors.push(e);
            return CcSkillImportResult { imported, errors };
        }
    };
    if let Err(e) = fs::create_dir_all(&target) {
        errors.push(e.to_string());
        return CcSkillImportResult { imported, errors };
    }

    for source in source_paths {
        let src = PathBuf::from(source.trim());
        if !src.exists() {
            errors.push(format!("路径不存在: {source}"));
            continue;
        }
        let name = src
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "skill".to_string());
        let dest = target.join(&name);
        if dest.exists() {
            errors.push(format!("已存在同名 Skill: {name}"));
            continue;
        }
        match copy_recursive(&src, &dest) {
            Ok(()) => imported.push(name),
            Err(e) => errors.push(format!("{source}: {e}")),
        }
    }
    CcSkillImportResult { imported, errors }
}

fn copy_recursive(src: &Path, dest: &Path) -> Result<(), String> {
    if src.is_file() {
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::copy(src, dest).map_err(|e| e.to_string())?;
        return Ok(());
    }
    if src.is_dir() {
        fs::create_dir_all(dest).map_err(|e| e.to_string())?;
        for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let child_src = entry.path();
            let child_dest = dest.join(entry.file_name());
            copy_recursive(&child_src, &child_dest)?;
        }
        return Ok(());
    }
    Err(format!("不支持的源类型: {}", src.display()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_description_from_yaml_frontmatter() {
        let content = r#"---
name: git-commit
description: 'Execute git commit with conventional commits'
license: MIT
---

# Git Commit
"#;
        let desc = description_from_frontmatter(content).expect("description");
        assert!(desc.contains("conventional commits"));
    }

    #[test]
    fn parses_unquoted_description() {
        let content = "---\nname: foo\ndescription: Use when starting any conversation\n---\n";
        let desc = description_from_frontmatter(content).expect("description");
        assert_eq!(desc, "Use when starting any conversation");
    }

    #[test]
    fn falls_back_to_first_paragraph_without_description_field() {
        let content = r#"---
name: legacy-skill
---

First paragraph of the skill body.

More content.
"#;
        let desc = read_skill_description_from_str(content).expect("description");
        assert_eq!(desc, "First paragraph of the skill body.");
    }

    #[test]
    fn locates_skill_md_case_insensitive() {
        let dir = std::env::temp_dir().join(format!("lizhi-skill-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("skill.md"), "---\ndescription: lower case file\n---\n").unwrap();
        let path = locate_skill_md(&dir).expect("skill md");
        assert_eq!(
            path.file_name().map(|n| n.to_string_lossy().to_lowercase()),
            Some("skill.md".to_string())
        );
        let desc = read_skill_description(&path).expect("desc");
        assert_eq!(desc, "lower case file");
        let _ = fs::remove_dir_all(&dir);
    }

    fn read_skill_description_from_str(content: &str) -> Option<String> {
        if let Some(desc) = description_from_frontmatter(content) {
            return Some(truncate_description(desc));
        }
        if let Some(desc) = first_paragraph_after_frontmatter(content) {
            return Some(truncate_description(desc));
        }
        legacy_description_after_title(content).map(truncate_description)
    }
}
