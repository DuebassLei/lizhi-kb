use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CcUsageEntry {
    pub timestamp: i64,
    pub model: String,
    #[serde(default)]
    pub provider_id: Option<String>,
    pub input_tokens: u64,
    pub output_tokens: u64,
    #[serde(default)]
    pub duration_ms: Option<u64>,
    #[serde(default)]
    pub estimated_cost: Option<f64>,
}

pub fn usage_path(data_dir: &Path) -> std::path::PathBuf {
    data_dir.join("cc-usage.json")
}

fn load_entries(data_dir: &Path) -> Result<Vec<CcUsageEntry>, String> {
    let path = usage_path(data_dir);
    if !path.is_file() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(&path).map_err(|e| format!("读取用量记录失败: {e}"))?;
    serde_json::from_str(&raw).map_err(|e| format!("解析用量记录失败: {e}"))
}

fn save_entries(data_dir: &Path, entries: &[CcUsageEntry]) -> Result<(), String> {
    let path = usage_path(data_dir);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(entries).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| format!("写入用量记录失败: {e}"))
}

pub fn append_usage(data_dir: &Path, entry: CcUsageEntry) -> Result<(), String> {
    let mut entries = load_entries(data_dir)?;
    entries.push(entry);
    const MAX_ENTRIES: usize = 2000;
    if entries.len() > MAX_ENTRIES {
        let drain = entries.len() - MAX_ENTRIES;
        entries.drain(0..drain);
    }
    save_entries(data_dir, &entries)
}

pub fn list_usage(data_dir: &Path) -> Result<Vec<CcUsageEntry>, String> {
    load_entries(data_dir)
}
