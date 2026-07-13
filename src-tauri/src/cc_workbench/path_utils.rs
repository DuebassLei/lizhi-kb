use std::path::{Path, PathBuf};

/// Normalize user-facing / config paths before canonicalize.
pub fn normalize_config_path(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("项目路径不能为空".into());
    }

    let mut path = trimmed.to_string();
    if let Some(rest) = path.strip_prefix("file:///") {
        path = rest.to_string();
    } else if let Some(rest) = path.strip_prefix("file://") {
        path = rest.to_string();
    }

    if path.contains('/') && !path.starts_with("//") {
        path = path.replace('/', "\\");
    }

    if is_drive_only(&path) {
        return Err(format!(
            "项目路径无效：不能仅为盘符「{path}」，请在设置中选择完整项目文件夹"
        ));
    }

    Ok(path)
}

/// Strip `\\?\` extended-length prefix for Node.js / SDK compatibility.
pub fn format_path_for_node(path: &Path) -> String {
    let display = path.display().to_string();
    display
        .strip_prefix(r"\\?\")
        .unwrap_or(&display)
        .to_string()
}

/// Claude `~/.claude.json` project keys use forward slashes.
pub fn project_registry_key(path: &str) -> String {
    normalize_config_path(path)
        .unwrap_or_else(|_| path.trim().to_string())
        .replace('\\', "/")
}

pub fn resolve_project_dir(raw: &str) -> Result<PathBuf, String> {
    let normalized = normalize_config_path(raw)?;
    let canonical = Path::new(&normalized)
        .canonicalize()
        .map_err(|_| format!("项目目录不存在或无法访问: {normalized}"))?;
    if !canonical.is_dir() {
        return Err(format!("项目路径不是文件夹: {normalized}"));
    }
    Ok(canonical)
}

fn is_drive_only(path: &str) -> bool {
    let bytes = path.as_bytes();
    if bytes.len() == 2 && bytes[1] == b':' {
        return bytes[0].is_ascii_alphabetic();
    }
    if bytes.len() == 3 && bytes[1] == b':' && (bytes[2] == b'\\' || bytes[2] == b'/') {
        return bytes[0].is_ascii_alphabetic();
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_drive_only_paths() {
        assert!(normalize_config_path("D:").is_err());
        assert!(normalize_config_path("D:\\").is_err());
        assert!(normalize_config_path("C:/").is_err());
    }

    #[test]
    fn normalizes_file_uri() {
        let path = normalize_config_path("file:///D:/codes/foo").unwrap();
        assert_eq!(path, "D:\\codes\\foo");
    }

    #[test]
    fn project_registry_key_uses_forward_slashes() {
        assert_eq!(
            project_registry_key(r"D:\codes\ai-wechat-main"),
            "D:/codes/ai-wechat-main"
        );
    }
}
