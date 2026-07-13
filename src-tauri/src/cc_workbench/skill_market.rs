use std::path::PathBuf;
use std::sync::OnceLock;

use serde::{Deserialize, Serialize};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};

static SKILL_MARKET_PATH: OnceLock<Option<PathBuf>> = OnceLock::new();

/// 应用启动时解析并缓存技能市场 JSON 路径。
pub fn init_skill_market(app: &AppHandle) {
    let path = resolve_skill_market_uncached(Some(app));
    let _ = SKILL_MARKET_PATH.set(path);
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CcSkillMarketEntry {
    pub id: String,
    pub name: String,
    pub description: String,
    pub repo_url: String,
    pub install_hint: String,
}

pub fn list_skill_market() -> Result<Vec<CcSkillMarketEntry>, String> {
    let path = SKILL_MARKET_PATH
        .get()
        .cloned()
        .unwrap_or_else(|| resolve_skill_market_uncached(None))
        .ok_or_else(|| "未找到技能市场目录文件 cc-skill-market.json".to_string())?;

    let raw = std::fs::read_to_string(&path).map_err(|e| format!("读取技能市场失败: {e}"))?;
    serde_json::from_str(&raw).map_err(|e| format!("解析技能市场 JSON 失败: {e}"))
}

fn resolve_skill_market_uncached(app: Option<&AppHandle>) -> Option<PathBuf> {
    if let Ok(custom) = std::env::var("LIZHI_CC_SKILL_MARKET") {
        let path = PathBuf::from(custom.trim());
        if path.is_file() {
            return Some(path);
        }
    }

    if let Some(app) = app {
        if let Ok(path) = app
            .path()
            .resolve("cc-skill-market.json", BaseDirectory::Resource)
        {
            if path.is_file() {
                return Some(path);
            }
        }
    }

    if let Ok(mut dir) = std::env::current_exe().and_then(|p| {
        p.parent()
            .map(PathBuf::from)
            .ok_or_else(|| std::io::Error::other("exe has no parent"))
    }) {
        for _ in 0..10 {
            for rel in [
                "resources/cc-skill-market.json",
                "cc-skill-market.json",
            ] {
                let candidate = dir.join(rel);
                if candidate.is_file() {
                    return Some(candidate);
                }
            }
            if !dir.pop() {
                break;
            }
        }
    }

    if let Ok(cwd) = std::env::current_dir() {
        for rel in ["src-tauri/resources/cc-skill-market.json"] {
            let candidate = cwd.join(rel);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }

    None
}
