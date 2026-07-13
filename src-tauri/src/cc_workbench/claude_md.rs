use std::fs;
use std::path::PathBuf;

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CcClaudeMdPreview {
    pub path: String,
    pub content: String,
    pub exists: bool,
}

fn resolve_claude_md_path(scope: &str, project_path: Option<&str>) -> Result<PathBuf, String> {
    match scope {
        "global" => dirs::home_dir()
            .map(|h| h.join(".claude").join("CLAUDE.md"))
            .ok_or_else(|| "无法定位用户主目录".to_string()),
        "project" => {
            let raw = project_path
                .filter(|p| !p.trim().is_empty())
                .ok_or_else(|| "请先在设置中选择项目目录".to_string())?;
            Ok(PathBuf::from(raw).join("CLAUDE.md"))
        }
        other => Err(format!("未知 scope: {other}")),
    }
}

pub fn get_claude_md(scope: &str, project_path: Option<&str>) -> Result<CcClaudeMdPreview, String> {
    let path = resolve_claude_md_path(scope, project_path)?;
    let display = path.display().to_string();
    if path.is_file() {
        let content = fs::read_to_string(&path).map_err(|e| format!("读取 CLAUDE.md 失败: {e}"))?;
        Ok(CcClaudeMdPreview {
            path: display,
            content,
            exists: true,
        })
    } else {
        Ok(CcClaudeMdPreview {
            path: display,
            content: String::new(),
            exists: false,
        })
    }
}

pub fn save_claude_md(
    scope: &str,
    content: &str,
    project_path: Option<&str>,
) -> Result<CcClaudeMdPreview, String> {
    let path = resolve_claude_md_path(scope, project_path)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {e}"))?;
    }
    fs::write(&path, content).map_err(|e| format!("写入 CLAUDE.md 失败: {e}"))?;
    get_claude_md(scope, project_path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_unknown_scope() {
        assert!(get_claude_md("invalid", None).is_err());
    }

    #[test]
    fn project_scope_requires_path() {
        assert!(get_claude_md("project", None).is_err());
    }
}
