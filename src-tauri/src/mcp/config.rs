use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub const DEFAULT_MCP_PORT: u16 = 13721;
pub const DEFAULT_STANDALONE_PORT: u16 = 13722;
pub const DEFAULT_SESSION_TIMEOUT_MINUTES: u16 = 30;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpConfig {
    pub enabled: bool,
    pub write_enabled: bool,
    pub port: u16,
    #[serde(default = "default_standalone_port")]
    pub standalone_port: u16,
    #[serde(default = "default_session_timeout")]
    pub session_timeout_minutes: u16,
    pub token: String,
}

fn default_standalone_port() -> u16 {
    DEFAULT_STANDALONE_PORT
}

fn default_session_timeout() -> u16 {
    DEFAULT_SESSION_TIMEOUT_MINUTES
}

impl Default for McpConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            write_enabled: false,
            port: DEFAULT_MCP_PORT,
            standalone_port: DEFAULT_STANDALONE_PORT,
            session_timeout_minutes: DEFAULT_SESSION_TIMEOUT_MINUTES,
            token: Uuid::new_v4().to_string(),
        }
    }
}

/// 返回给前端的配置（token 仅首次或 regenerate 时完整返回）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpConfigPublic {
    pub enabled: bool,
    pub write_enabled: bool,
    pub port: u16,
    pub standalone_port: u16,
    pub session_timeout_minutes: u16,
    pub token_masked: String,
    pub token: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpConfigUpdate {
    pub enabled: Option<bool>,
    pub write_enabled: Option<bool>,
    pub port: Option<u16>,
    pub standalone_port: Option<u16>,
    pub session_timeout_minutes: Option<u16>,
}

pub fn config_path(data_dir: &Path) -> PathBuf {
    data_dir.join("mcp-config.json")
}

pub fn load_config(data_dir: &Path) -> Result<McpConfig, String> {
    let path = config_path(data_dir);
    if !path.is_file() {
        let config = McpConfig::default();
        save_config(data_dir, &config)?;
        return Ok(config);
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

pub fn save_config(data_dir: &Path, config: &McpConfig) -> Result<(), String> {
    let path = config_path(data_dir);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

pub fn mask_token(token: &str) -> String {
    if token.len() <= 8 {
        return "****".to_string();
    }
    format!("{}…{}", &token[..4], &token[token.len() - 4..])
}

pub fn to_public(config: &McpConfig, reveal_token: bool) -> McpConfigPublic {
    McpConfigPublic {
        enabled: config.enabled,
        write_enabled: config.write_enabled,
        port: config.port,
        standalone_port: config.standalone_port,
        session_timeout_minutes: config.session_timeout_minutes,
        token_masked: mask_token(&config.token),
        token: if reveal_token {
            Some(config.token.clone())
        } else {
            None
        },
    }
}

pub fn regenerate_token(config: &mut McpConfig) -> String {
    config.token = Uuid::new_v4().to_string();
    config.token.clone()
}

pub fn apply_update(config: &mut McpConfig, update: &McpConfigUpdate) {
    if let Some(enabled) = update.enabled {
        config.enabled = enabled;
    }
    if let Some(write_enabled) = update.write_enabled {
        config.write_enabled = write_enabled;
    }
    if let Some(port) = update.port {
        config.port = port.clamp(1024, 65535);
    }
    if let Some(port) = update.standalone_port {
        config.standalone_port = port.clamp(1024, 65535);
    }
    if let Some(minutes) = update.session_timeout_minutes {
        config.session_timeout_minutes = minutes.min(24 * 60);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_is_disabled() {
        let config = McpConfig::default();
        assert!(!config.enabled);
        assert!(!config.write_enabled);
        assert_eq!(config.port, DEFAULT_MCP_PORT);
        assert!(!config.token.is_empty());
    }
}
