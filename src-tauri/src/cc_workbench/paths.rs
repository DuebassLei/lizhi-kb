use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use tauri::{AppHandle, Manager};
use tauri::path::BaseDirectory;

use super::path_utils::format_path_for_node;

static BRIDGE_SCRIPT: OnceLock<Option<String>> = OnceLock::new();

/// 应用启动时解析并缓存桥接脚本路径（含 Tauri Resource 目录）。
pub fn init_bridge_script(app: &AppHandle) {
    let path = resolve_bridge_script_uncached(Some(app));
    let _ = BRIDGE_SCRIPT.set(path);
}

/// `packages/ai-bridge/channel-manager.js` 或打包后的 `resources/ai-bridge/channel-manager.js`
pub fn resolve_bridge_script() -> Option<String> {
    BRIDGE_SCRIPT
        .get()
        .cloned()
        .unwrap_or_else(|| resolve_bridge_script_uncached(None))
}

fn resolve_bridge_script_uncached(app: Option<&AppHandle>) -> Option<String> {
    if let Ok(custom) = std::env::var("LIZHI_AI_BRIDGE_SCRIPT") {
        let path = PathBuf::from(custom.trim());
        if path.is_file() {
            return canonical_display(&path);
        }
    }

    if let Some(app) = app {
        if let Ok(path) = app
            .path()
            .resolve("ai-bridge/channel-manager.js", BaseDirectory::Resource)
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
                "resources/ai-bridge/channel-manager.js",
                "ai-bridge/channel-manager.js",
                "packages/ai-bridge/channel-manager.js",
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
            "packages/ai-bridge/channel-manager.js",
            "src-tauri/resources/ai-bridge/channel-manager.js",
        ] {
            let candidate = cwd.join(rel);
            if candidate.is_file() {
                return canonical_display(&candidate);
            }
        }
    }

    None
}

pub fn sdk_root_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("dependencies").join("claude-sdk")
}

pub fn sdk_package_dir(data_dir: &Path) -> PathBuf {
    sdk_root_dir(data_dir)
        .join("node_modules")
        .join("@anthropic-ai")
        .join("claude-agent-sdk")
}

pub fn is_sdk_installed(data_dir: &Path) -> bool {
    sdk_package_dir(data_dir).is_dir()
}

/// 读取已安装 `@anthropic-ai/claude-agent-sdk` 的 package.json version。
pub fn read_installed_sdk_version(data_dir: &Path) -> Option<String> {
    let pkg_json = sdk_package_dir(data_dir).join("package.json");
    let raw = std::fs::read_to_string(pkg_json).ok()?;
    let value: serde_json::Value = serde_json::from_str(&raw).ok()?;
    value
        .get("version")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
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
    fn resolves_bridge_from_cwd_when_present() {
        let cwd = std::env::current_dir().expect("cwd");
        let candidate = cwd.join("packages/ai-bridge/channel-manager.js");
        if candidate.is_file() {
            assert!(resolve_bridge_script_uncached(None).is_some());
        }
    }
}
