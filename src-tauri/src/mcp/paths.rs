use std::path::{Path, PathBuf};

/// 解析 `packages/lizhi-mcp/dist/index.js` 的绝对路径，供 Cursor MCP 配置使用。
pub fn resolve_mcp_adapter_path() -> Option<String> {
    if let Ok(custom) = std::env::var("LIZHI_MCP_SCRIPT") {
        let path = PathBuf::from(custom.trim());
        if path.is_file() {
            return canonical_display(&path);
        }
    }

    if let Ok(mut dir) = std::env::current_exe().and_then(|p| {
        p.parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| std::io::Error::other("exe has no parent"))
    }) {
        for _ in 0..10 {
            let candidate = dir.join("packages/lizhi-mcp/dist/index.js");
            if candidate.is_file() {
                return canonical_display(&candidate);
            }
            if !dir.pop() {
                break;
            }
        }
    }

    if let Ok(cwd) = std::env::current_dir() {
        let candidate = cwd.join("packages/lizhi-mcp/dist/index.js");
        if candidate.is_file() {
            return canonical_display(&candidate);
        }
    }

    None
}

fn canonical_display(path: &Path) -> Option<String> {
    path.canonicalize()
        .ok()
        .map(|p| p.display().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_adapter_from_cwd_when_present() {
        let cwd = std::env::current_dir().expect("cwd");
        let candidate = cwd.join("packages/lizhi-mcp/dist/index.js");
        if candidate.is_file() {
            assert!(resolve_mcp_adapter_path().is_some());
        }
    }
}
