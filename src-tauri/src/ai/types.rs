use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatRequest {
    pub messages: Vec<ChatMessage>,
    /// `None` = 本地 Ollama；`Some(id)` = 指定云端提供商
    #[serde(default)]
    pub cloud_provider_id: Option<String>,
    /// 兼容旧版
    #[serde(default)]
    pub use_cloud: bool,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RagScope {
    All,
    CurrentDocument,
    CurrentFolder,
}

impl Default for RagScope {
    fn default() -> Self {
        Self::All
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RagRequest {
    pub question: String,
    #[serde(default)]
    pub scope: RagScope,
    #[serde(default)]
    pub document_id: Option<String>,
    #[serde(default)]
    pub folder: Option<String>,
    #[serde(default)]
    pub selection: Option<String>,
    #[serde(default)]
    pub cloud_provider_id: Option<String>,
    #[serde(default)]
    pub use_cloud: bool,
    /// 为 true 时仅返回 FTS 检索摘录，不调用大模型
    #[serde(default)]
    pub retrieval_only: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentRequest {
  pub instruction: String,
  #[serde(default)]
  pub messages: Vec<ChatMessage>,
  #[serde(default)]
  pub cloud_provider_id: Option<String>,
  #[serde(default)]
  pub use_cloud: bool,
}

/// 解析请求中的云端提供商：优先 `cloud_provider_id`，否则兼容 `use_cloud` + 默认激活项
pub fn resolve_cloud_provider_id(
    cloud_provider_id: Option<String>,
    use_cloud: bool,
    active_fallback: Option<&str>,
) -> Option<String> {
    if let Some(id) = cloud_provider_id.filter(|s| !s.is_empty()) {
        return Some(id);
    }
    if use_cloud {
        return active_fallback.map(str::to_string);
    }
    None
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum StreamEvent {
    #[serde(rename = "token")]
    Token { content: String },
    #[serde(rename = "citation")]
    Citation { id: String, title: String },
    #[serde(rename = "toolCall")]
    ToolCall { name: String, input: String },
    #[serde(rename = "toolResult")]
    ToolResult { name: String, output: String },
    #[serde(rename = "done")]
    Done,
    #[serde(rename = "error")]
    Error { message: String },
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionResult {
    pub ok: bool,
    pub message: String,
    pub model: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestConnectionRequest {
    pub provider_id: Option<String>,
}
