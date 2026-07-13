use std::path::{Path, PathBuf};

use rusqlite::{Connection, OpenFlags};
use serde::{Deserialize, Serialize};

use super::config::CcProviderMode;
use super::providers::CcProviderInput;
use super::secrets::normalize_api_key;

const DEFAULT_CC_SWITCH_DB: &str = ".cc-switch/cc-switch.db";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CcSwitchImportItem {
    pub id: String,
    pub name: String,
    pub remark: String,
    pub base_url: String,
    pub model: String,
    pub fast_model: String,
    pub sonnet_model: String,
    pub opus_model: String,
    pub api_key_masked: String,
    pub status: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CcSwitchImportPreview {
    pub db_path: String,
    pub providers: Vec<CcSwitchImportItem>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CcSwitchSaveRequest {
    pub provider_ids: Vec<String>,
    pub db_path: Option<String>,
}

fn default_cc_switch_db_path() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(DEFAULT_CC_SWITCH_DB))
}

pub fn resolve_cc_switch_db_path(custom: Option<&str>) -> Result<PathBuf, String> {
    if let Some(path) = custom.filter(|p| !p.trim().is_empty()) {
        let p = PathBuf::from(path.trim());
        if !p.is_file() {
            return Err(format!("数据库文件不存在: {}", p.display()));
        }
        return Ok(p);
    }
    let default = default_cc_switch_db_path().ok_or_else(|| "无法定位用户主目录".to_string())?;
    if !default.is_file() {
        return Err(format!(
            "未找到 cc-switch 数据库: {}（可在导入时手动选择 .db 文件）",
            default.display()
        ));
    }
    Ok(default)
}

pub fn preview_import(
    db_path: Option<&str>,
    existing_ids: &[String],
) -> Result<CcSwitchImportPreview, String> {
    let path = resolve_cc_switch_db_path(db_path)?;
    let rows = read_cc_switch_db(&path)?;
    let providers = rows
        .into_iter()
        .map(|row| {
            let status = if existing_ids.contains(&row.id) {
                "update"
            } else {
                "new"
            };
            CcSwitchImportItem {
                id: row.id,
                name: row.name,
                remark: row.remark,
                base_url: row.base_url,
                model: row.model,
                sonnet_model: row.sonnet_model,
                opus_model: row.opus_model,
                fast_model: row.fast_model,
                api_key_masked: mask_key(row.api_key.as_deref()),
                status: status.to_string(),
                source: "cc-switch".to_string(),
            }
        })
        .collect();
    Ok(CcSwitchImportPreview {
        db_path: path.display().to_string(),
        providers,
    })
}

struct CcSwitchRow {
    id: String,
    name: String,
    remark: String,
    base_url: String,
    api_key: Option<String>,
    model: String,
    sonnet_model: String,
    opus_model: String,
    fast_model: String,
    env_extras: std::collections::HashMap<String, String>,
    settings_config: Option<String>,
}

fn read_cc_switch_db(path: &Path) -> Result<Vec<CcSwitchRow>, String> {
    let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|e| format!("打开 cc-switch 数据库失败: {e}"))?;
    let mut stmt = conn
        .prepare("SELECT * FROM providers WHERE app_type = 'claude'")
        .map_err(|e| format!("查询 providers 表失败: {e}"))?;

    let column_indexes: std::collections::HashMap<String, usize> = stmt
        .column_names()
        .iter()
        .enumerate()
        .map(|(idx, name)| (name.to_string(), idx))
        .collect();

    let rows = stmt
        .query_map([], |row| {
            let get_str = |col: &str| -> Result<String, rusqlite::Error> {
                match column_indexes.get(col) {
                    Some(&idx) => row.get::<_, Option<String>>(idx).map(|v| v.unwrap_or_default()),
                    None => Ok(String::new()),
                }
            };
            let get_opt_str = |col: &str| -> Result<Option<String>, rusqlite::Error> {
                match column_indexes.get(col) {
                    Some(&idx) => row.get(idx),
                    None => Ok(None),
                }
            };
            Ok((
                get_str("id")?,
                get_str("name")?,
                get_opt_str("settings_config")?,
                get_opt_str("remark")?,
            ))
        })
        .map_err(|e| format!("读取行失败: {e}"))?;

    let mut out = Vec::new();
    for row in rows {
        let (id, name, settings_config, remark) = row.map_err(|e| e.to_string())?;
        if id.trim().is_empty() {
            continue;
        }
        let parsed = parse_settings_config(settings_config.as_deref());
        out.push(CcSwitchRow {
            id,
            name: if name.trim().is_empty() {
                "未命名供应商".to_string()
            } else {
                name
            },
            remark: remark.unwrap_or_default(),
            base_url: parsed.base_url,
            api_key: parsed.api_key,
            model: parsed.model,
            sonnet_model: parsed.sonnet_model.unwrap_or_default(),
            opus_model: parsed.opus_model.unwrap_or_default(),
            fast_model: parsed.fast_model.unwrap_or_default(),
            env_extras: parsed.env_extras,
            settings_config,
        });
    }
    Ok(out)
}

struct ParsedSettings {
    base_url: String,
    api_key: Option<String>,
    model: String,
    sonnet_model: Option<String>,
    opus_model: Option<String>,
    fast_model: Option<String>,
    env_extras: std::collections::HashMap<String, String>,
}

fn parse_settings_config(raw: Option<&str>) -> ParsedSettings {
    let mut result = ParsedSettings {
        base_url: String::new(),
        api_key: None,
        model: String::new(),
        sonnet_model: None,
        opus_model: None,
        fast_model: None,
        env_extras: std::collections::HashMap::new(),
    };
    let Some(raw) = raw else { return result };
    let Ok(value) = serde_json::from_str::<serde_json::Value>(raw) else {
        return result;
    };
    if let Some(env) = value.get("env").and_then(|v| v.as_object()) {
        result.base_url = super::provider_env::read_env_string(env, "ANTHROPIC_BASE_URL")
            .unwrap_or_default();
        result.api_key = super::provider_env::normalize_api_key_from_env(env);
        result.model = super::provider_env::read_env_string(env, "ANTHROPIC_MODEL")
            .unwrap_or_default();
        result.sonnet_model = super::provider_env::read_env_string(env, "ANTHROPIC_DEFAULT_SONNET_MODEL");
        result.opus_model = super::provider_env::read_env_string(env, "ANTHROPIC_DEFAULT_OPUS_MODEL");
        result.fast_model = super::provider_env::read_fast_model(env);
        result.env_extras = super::provider_env::collect_env_extras(env);
    }
    if result.base_url.is_empty() {
        result.base_url = value
            .get("base_url")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .to_string();
    }
    if result.api_key.is_none() {
        result.api_key = value
            .get("api_key")
            .and_then(|v| v.as_str())
            .map(normalize_api_key)
            .filter(|k| !k.is_empty());
    }
    result
}

pub fn build_import_inputs(
    db_path: Option<&str>,
    provider_ids: &[String],
) -> Result<Vec<(CcProviderInput, Option<String>)>, String> {
    let path = resolve_cc_switch_db_path(db_path)?;
    let rows = read_cc_switch_db(&path)?;
    let id_set: std::collections::HashSet<_> = provider_ids.iter().cloned().collect();
    rows.into_iter()
        .filter(|r| id_set.contains(&r.id))
        .map(|row| {
            let mode = if row.base_url.is_empty() {
                CcProviderMode::Official
            } else {
                CcProviderMode::Custom
            };
            Ok((
                CcProviderInput {
                    id: Some(row.id.clone()),
                    name: row.name,
                    remark: Some(row.remark),
                    preset_id: None,
                    provider_mode: mode,
                    base_url: Some(row.base_url),
                    model: Some(row.model),
                    fast_model: Some(row.fast_model),
                    sonnet_model: Some(row.sonnet_model),
                    opus_model: Some(row.opus_model),
                    api_key: None,
                    source: Some("cc-switch".to_string()),
                    env_extras: Some(row.env_extras),
                    settings_config: row.settings_config,
                },
                row.api_key,
            ))
        })
        .collect()
}

fn mask_key(key: Option<&str>) -> String {
    match key.filter(|k| !k.is_empty()) {
        None => String::new(),
        Some(k) if k.len() <= 8 => "••••••••".to_string(),
        Some(k) => format!("{}••••{}", &k[..4], &k[k.len() - 4..]),
    }
}
