use serde::{Deserialize, Serialize};

use super::config::CwdMode;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CcWorkbenchStatus {
    pub node_available: bool,
    pub node_version: Option<String>,
    pub bridge_available: bool,
    pub bridge_path: Option<String>,
    pub sdk_installed: bool,
    pub sdk_path: String,
    pub sdk_version: String,
    pub mcp_enabled: bool,
    pub mcp_adapter_path: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CcWorkbenchRequest {
    pub prompt: String,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub selected_model: Option<String>,
    #[serde(default)]
    pub selected_model_slot: Option<String>,
    #[serde(default)]
    pub reasoning_effort: Option<String>,
    #[serde(default)]
    pub permission_mode: Option<String>,
    #[serde(default)]
    pub opened_files: Vec<String>,
    #[serde(default)]
    pub attachments: Vec<String>,
    #[serde(default)]
    pub agent_prompt: Option<String>,
    #[serde(default)]
    pub disable_thinking: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeMcpServer {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub r#type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub args: Vec<String>,
    #[serde(default, skip_serializing_if = "std::collections::HashMap::is_empty")]
    pub env: std::collections::HashMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub headers: Option<std::collections::HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgePayload {
    pub prompt: String,
    pub session_id: Option<String>,
    pub cwd: String,
    pub cwd_mode: String,
    pub provider_mode: String,
    pub api_key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fast_model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sonnet_model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opus_model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extra_env: Option<std::collections::HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub selected_model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub selected_model_slot: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning_effort: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub permission_mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mcp_servers: Option<std::collections::HashMap<String, BridgeMcpServer>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub settings: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub opened_files: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub opened_file_contents: Vec<super::context::OpenedFileContent>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachment_contents: Vec<super::context::AttachmentContent>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disable_thinking: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CcToolPermissionResponse {
    pub request_id: String,
    pub behavior: String,
    #[serde(default)]
    pub message: Option<String>,
}

impl BridgePayload {
    pub fn cwd_mode_str(mode: CwdMode) -> &'static str {
        match mode {
            CwdMode::Vault => "vault",
            CwdMode::Project => "project",
        }
    }

    pub fn provider_mode_str(mode: super::config::CcProviderMode) -> &'static str {
        match mode {
            super::config::CcProviderMode::Official => "official",
            super::config::CcProviderMode::Custom => "custom",
        }
    }
}
