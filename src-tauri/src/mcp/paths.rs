use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use tauri::{AppHandle, Manager};
use tauri::path::BaseDirectory;

use crate::cc_workbench::path_utils::format_path_for_node;

static MCP_ADAPTER: OnceLock<Option<String>> = OnceLock::new();

/// 应用启动时解析并缓存 MCP stdio adapter 路径（含 Tauri Resource）。
pub fn init_mcp_adapter_path(app: &AppHandle) {
    let path = resolve_mcp_adapter_path_uncached(Some(app));
    let _ = MCP_ADAPTER.set(path);
}

/// `packages/lizhi-mcp/dist/index.js` 或打包后的 `resources/lizhi-mcp/index.js`
pub fn resolve_mcp_adapter_path() -> Option<String> {
    MCP_ADAPTER
        .get()
        .cloned()
        .unwrap_or_else(|| resolve_mcp_adapter_path_uncached(None))
}

fn resolve_mcp_adapter_path_uncached(app: Option<&AppHandle>) -> Option<String> {
    if let Ok(custom) = std::env::var("LIZHI_MCP_SCRIPT") {
        let path = PathBuf::from(custom.trim());
        if path.is_file() {
            return canonical_display(&path);
        }
    }

    if let Some(app) = app {
        if let Ok(path) = app
            .path()
            .resolve("lizhi-mcp/index.js", BaseDirectory::Resource)
        {
            if path.is_file() {
                return canonical_display(&path);
            }
        }
    }

    if let Ok(mut dir) = std::env::current_exe().and_then(|p| {
        p.parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| std::io::Error::other("exe has no parent"))
    }) {
        for _ in 0..10 {
            for rel in [
                "resources/lizhi-mcp/index.js",
                "lizhi-mcp/index.js",
                "packages/lizhi-mcp/dist/index.js",
                "src-tauri/resources/lizhi-mcp/index.js",
            ] {
                let candidate = dir.join(rel);
                if candidate.is_file() {
                    return canonical_display(&candidate);
                }
            }
            if !dir.pop() {
                break;
            }
        }
    }

    if let Ok(cwd) = std::env::current_dir() {
        for rel in [
            "packages/lizhi-mcp/dist/index.js",
            "src-tauri/resources/lizhi-mcp/index.js",
        ] {
            let candidate = cwd.join(rel);
            if candidate.is_file() {
                return canonical_display(&candidate);
            }
        }
    }

    None
}

fn canonical_display(path: &Path) -> Option<String> {
    path.canonicalize()
        .ok()
        .map(|p| format_path_for_node(&p))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_adapter_from_cwd_when_present() {
        let cwd = std::env::current_dir().expect("cwd");
        let candidate = cwd.join("packages/lizhi-mcp/dist/index.js");
        let bundled = cwd.join("src-tauri/resources/lizhi-mcp/index.js");
        if candidate.is_file() || bundled.is_file() {
            assert!(resolve_mcp_adapter_path().is_some());
        }
    }
}
