use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub const DEFAULT_MCP_PORT: u16 = 13721;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpConfig {
    pub enabled: bool,
    pub write_enabled: bool,
    pub port: u16,
    pub token: String,
}

impl Default for McpConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            write_enabled: false,
            port: DEFAULT_MCP_PORT,
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
    pub token_masked: String,
    pub token: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpConfigUpdate {
    pub enabled: Option<bool>,
    pub write_enabled: Option<bool>,
    pub port: Option<u16>,
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
    // 旧配置可能含 standalonePort / sessionTimeoutMinutes，serde 默认忽略未知字段
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

/// 别名：供 cc_workbench 等模块读取 MCP 配置
pub fn load_mcp_config(data_dir: &Path) -> Result<McpConfig, String> {
    load_config(data_dir)
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

    #[test]
    fn ignores_legacy_sidecar_fields() {
        let dir = std::env::temp_dir().join(format!("lizhi-mcp-cfg-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        let path = config_path(&dir);
        fs::write(
            &path,
            r#"{
  "enabled": true,
  "writeEnabled": false,
  "port": 13721,
  "standalonePort": 13722,
  "sessionTimeoutMinutes": 30,
  "token": "abcdef12-3456-7890-abcd-ef1234567890"
}"#,
        )
        .unwrap();
        let config = load_config(&dir).unwrap();
        assert!(config.enabled);
        assert_eq!(config.port, 13721);
        let _ = fs::remove_dir_all(dir);
    }
}
