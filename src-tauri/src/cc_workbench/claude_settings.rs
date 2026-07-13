use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
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
        return Err(format!(
            "未找到 ~/.claude/settings.json，请先配置 Claude Code 或创建该文件"
        ));
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

impl Default for ClaudeSettingsEnv {
    fn default() -> Self {
        Self {
            anthropic_base_url: None,
            anthropic_auth_token: None,
            anthropic_api_key: None,
            anthropic_model: None,
            anthropic_default_sonnet_model: None,
            anthropic_default_opus_model: None,
            anthropic_default_haiku_model: None,
            anthropic_small_fast_model: None,
        }
    }
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
