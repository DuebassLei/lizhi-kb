use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeSettingsEnv {
    pub anthropic_base_url: Option<String>,
    pub anthropic_auth_token: Option<String>,
    pub anthropic_api_key: Option<String>,
    pub anthropic_model: Option<String>,
    pub anthropic_default_sonnet_model: Option<String>,
    pub anthropic_default_opus_model: Option<String>,
    pub anthropic_default_haiku_model: Option<String>,
    pub anthropic_small_fast_model: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeLocalSettingsPreview {
    pub path: String,
    pub exists: bool,
    pub env: ClaudeSettingsEnv,
    pub api_key_masked: String,
}

pub fn claude_settings_path() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".claude").join("settings.json"))
}

pub fn claude_settings_exists() -> bool {
    claude_settings_path()
        .map(|p| p.is_file())
        .unwrap_or(false)
}

pub fn load_claude_settings_env() -> Result<ClaudeSettingsEnv, String> {
    let path = claude_settings_path().ok_or_else(|| "无法定位用户主目录".to_string())?;
    if !path.is_file() {
        return Err(
            "未找到 ~/.claude/settings.json，请先配置 Claude Code 或创建该文件".to_string(),
        );
    }
    let raw = fs::read_to_string(&path).map_err(|e| format!("读取 settings.json 失败: {e}"))?;
    let value: Value = serde_json::from_str(&raw).map_err(|e| format!("settings.json 格式错误: {e}"))?;
    Ok(parse_env_from_settings(&value))
}

pub fn preview_local_settings() -> ClaudeLocalSettingsPreview {
    let path = claude_settings_path()
        .map(|p| p.display().to_string())
        .unwrap_or_default();
    let exists = claude_settings_exists();
    let env = if exists {
        load_claude_settings_env().unwrap_or_default()
    } else {
        ClaudeSettingsEnv::default()
    };
    let key = env
        .anthropic_auth_token
        .as_deref()
        .or(env.anthropic_api_key.as_deref());
    ClaudeLocalSettingsPreview {
        path,
        exists,
        api_key_masked: mask_key(key),
        env,
    }
}

fn parse_env_from_settings(value: &Value) -> ClaudeSettingsEnv {
    let env = value.get("env").and_then(|v| v.as_object());
    let get = |key: &str| -> Option<String> {
        env.and_then(|e| e.get(key))
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
    };
    ClaudeSettingsEnv {
        anthropic_base_url: get("ANTHROPIC_BASE_URL"),
        anthropic_auth_token: get("ANTHROPIC_AUTH_TOKEN"),
        anthropic_api_key: get("ANTHROPIC_API_KEY"),
        anthropic_model: get("ANTHROPIC_MODEL"),
        anthropic_default_sonnet_model: get("ANTHROPIC_DEFAULT_SONNET_MODEL"),
        anthropic_default_opus_model: get("ANTHROPIC_DEFAULT_OPUS_MODEL"),
        anthropic_default_haiku_model: get("ANTHROPIC_DEFAULT_HAIKU_MODEL"),
        anthropic_small_fast_model: get("ANTHROPIC_SMALL_FAST_MODEL"),
    }
}

pub fn load_claude_settings_env_extras() -> std::collections::HashMap<String, String> {
    let path = match claude_settings_path() {
        Some(p) if p.is_file() => p,
        _ => return std::collections::HashMap::new(),
    };
    let raw = fs::read_to_string(&path).unwrap_or_default();
    let value: Value = serde_json::from_str(&raw).unwrap_or(Value::Object(Map::new()));
    let mut out = std::collections::HashMap::new();
    if let Some(env) = value.get("env").and_then(|v| v.as_object()) {
        for (key, val) in env {
            if let Some(text) = val.as_str() {
                let trimmed = text.trim();
                if !trimmed.is_empty() {
                    out.insert(key.clone(), trimmed.to_string());
                }
            }
        }
    }
    out
}

pub fn resolve_local_api_key(env: &ClaudeSettingsEnv) -> Option<String> {
    env.anthropic_auth_token
        .clone()
        .or_else(|| env.anthropic_api_key.clone())
        .filter(|k| !k.is_empty())
}

fn mask_key(key: Option<&str>) -> String {
    match key.filter(|k| !k.is_empty()) {
        None => String::new(),
        Some(k) if k.len() <= 8 => "••••••••".to_string(),
        Some(k) => format!("{}••••{}", &k[..4], &k[k.len() - 4..]),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CcClaudePermissions {
    #[serde(default)]
    pub allow: Vec<String>,
    #[serde(default)]
    pub deny: Vec<String>,
    #[serde(default)]
    pub ask: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CcClaudePermissionsPreview {
    pub path: String,
    pub exists: bool,
    pub permissions: CcClaudePermissions,
}

fn parse_string_list(value: Option<&Value>) -> Vec<String> {
    value
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.trim().to_string()))
                .filter(|s| !s.is_empty())
                .collect()
        })
        .unwrap_or_default()
}

fn load_settings_value() -> Result<(PathBuf, Value), String> {
    let path = claude_settings_path().ok_or_else(|| "无法定位用户主目录".to_string())?;
    if !path.is_file() {
        return Ok((path, Value::Object(Map::new())));
    }
    let raw = fs::read_to_string(&path).map_err(|e| format!("读取 settings.json 失败: {e}"))?;
    let value: Value = serde_json::from_str(&raw).map_err(|e| format!("settings.json 格式错误: {e}"))?;
    Ok((path, value))
}

pub fn get_permissions() -> CcClaudePermissionsPreview {
    let path = claude_settings_path()
        .map(|p| p.display().to_string())
        .unwrap_or_default();
    let exists = claude_settings_exists();
    let permissions = if exists {
        load_settings_value()
            .ok()
            .map(|(_, value)| {
                let perms = value.get("permissions");
                CcClaudePermissions {
                    allow: parse_string_list(perms.and_then(|p| p.get("allow"))),
                    deny: parse_string_list(perms.and_then(|p| p.get("deny"))),
                    ask: parse_string_list(perms.and_then(|p| p.get("ask"))),
                }
            })
            .unwrap_or_default()
    } else {
        CcClaudePermissions::default()
    };
    CcClaudePermissionsPreview {
        path,
        exists,
        permissions,
    }
}

pub fn save_permissions(permissions: &CcClaudePermissions) -> Result<CcClaudePermissionsPreview, String> {
    let (path, mut value) = load_settings_value()?;
    let obj = value.as_object_mut().ok_or_else(|| "settings.json 根节点必须是对象".to_string())?;
    obj.insert(
        "permissions".to_string(),
        serde_json::json!({
            "allow": permissions.allow,
            "deny": permissions.deny,
            "ask": permissions.ask,
        }),
    );
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {e}"))?;
    }
    let json = serde_json::to_string_pretty(&value).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| format!("写入 settings.json 失败: {e}"))?;
    Ok(get_permissions())
}
