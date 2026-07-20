use std::sync::Arc;
use std::time::Duration;

use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;

use super::config::{find_provider, AiConfig};
use super::network_gate::{effective_allowed_hosts, ensure_allowed_url};
use super::secrets::{get_cloud_api_key, AiSecrets};
use super::types::{ChatMessage, StreamEvent};

#[derive(Debug, Clone)]
pub struct LlmEndpoint {
    pub base_url: String,
    pub model: String,
    pub api_key: Option<String>,
}

pub fn resolve_endpoint(
    config: &AiConfig,
    secrets: &AiSecrets,
    cloud_provider_id: Option<&str>,
) -> Result<LlmEndpoint, String> {
    if let Some(provider_id) = cloud_provider_id {
        if !config.cloud_enabled {
            return Err("云端 API 未启用，请在设置中开启".into());
        }
        let provider = find_provider(config, provider_id)
            .ok_or_else(|| format!("未找到云端配置: {provider_id}"))?;
        if !provider.enabled {
            return Err(format!("云端模型「{}」已停用", provider.name));
        }
        let api_key = get_cloud_api_key(secrets, provider_id)
            .ok_or_else(|| format!("未配置「{}」的 API Key", provider.name))?;
        return Ok(LlmEndpoint {
            base_url: provider.base_url.clone(),
            model: provider.model.clone(),
            api_key: Some(api_key),
        });
    }

    if !config.local_enabled {
        return Err("本地 Ollama 已停用，请在设置中启用或改用云端模型".into());
    }

    Ok(LlmEndpoint {
        base_url: config.local_base_url.clone(),
        model: config.local_model.clone(),
        api_key: None,
    })
}

#[derive(Debug, Serialize)]
struct StreamOptions {
    include_usage: bool,
}

#[derive(Debug, Serialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<ChatMessage>,
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream_options: Option<StreamOptions>,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: Option<ChatResponseMessage>,
}

#[derive(Debug, Deserialize, Default)]
struct ChatResponseMessage {
    #[serde(default)]
    content: Option<String>,
    #[serde(default, alias = "reasoningContent")]
    reasoning_content: Option<String>,
    #[serde(default)]
    reasoning: Option<String>,
    #[serde(default)]
    thinking: Option<String>,
}

fn agent_llm_reply_text(message: &ChatResponseMessage) -> String {
    let content = message.content.as_deref().unwrap_or("").trim();
    if !content.is_empty() {
        return content.to_string();
    }
    for extra in [
        message.reasoning_content.as_deref(),
        message.reasoning.as_deref(),
        message.thinking.as_deref(),
    ] {
        if let Some(s) = extra.map(str::trim).filter(|s| !s.is_empty()) {
            return s.to_string();
        }
    }
    String::new()
}

#[derive(Debug, Deserialize)]
struct StreamUsage {
    #[serde(default, alias = "prompt_tokens")]
    input_tokens: Option<u64>,
    #[serde(default, alias = "completion_tokens")]
    output_tokens: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct StreamChunk {
    #[serde(default)]
    choices: Vec<StreamChoice>,
    usage: Option<StreamUsage>,
}

#[derive(Debug, Deserialize)]
struct StreamChoice {
    delta: Option<StreamDelta>,
    message: Option<StreamDeltaMessage>,
}

#[derive(Debug, Deserialize)]
struct StreamDeltaMessage {
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct StreamDelta {
    content: Option<String>,
    /// DeepSeek R1 / Qwen thinking 等 OpenAI 兼容扩展字段
    #[serde(default, alias = "reasoningContent")]
    reasoning_content: Option<String>,
    #[serde(default)]
    reasoning: Option<String>,
    #[serde(default)]
    thinking: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OllamaStreamChunk {
    message: Option<StreamDeltaMessage>,
    response: Option<String>,
    done: Option<bool>,
    prompt_eval_count: Option<u64>,
    eval_count: Option<u64>,
}

fn http_client() -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_secs(120))
        .connect_timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())
}

fn test_http_client() -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_secs(20))
        .connect_timeout(Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())
}

fn format_request_error(e: reqwest::Error, url: &str) -> String {
    if e.is_timeout() {
        return format!("连接超时: {url}（请检查网络或代理设置）");
    }
    if e.is_connect() {
        return format!(
            "无法建立连接: {url}（请检查网络、防火墙或系统代理/VPN 是否已开启）"
        );
    }
    format!("连接失败: {e}")
}

fn chat_completions_url(base_url: &str) -> String {
    let trimmed = base_url.trim_end_matches('/');
    if trimmed.ends_with("/chat/completions") {
        trimmed.to_string()
    } else if trimmed.ends_with("/v1") {
        format!("{trimmed}/chat/completions")
    } else {
        format!("{trimmed}/v1/chat/completions")
    }
}

#[cfg(test)]
mod chat_url_tests {
    use super::chat_completions_url;

    #[test]
    fn appends_chat_completions_after_v1() {
        assert_eq!(
            chat_completions_url("https://lab.iwhalecloud.com/gpt-proxy/v1"),
            "https://lab.iwhalecloud.com/gpt-proxy/v1/chat/completions"
        );
    }

    #[test]
    fn keeps_full_chat_completions_path() {
        assert_eq!(
            chat_completions_url("https://lab.iwhalecloud.com/gpt-proxy/v1/chat/completions"),
            "https://lab.iwhalecloud.com/gpt-proxy/v1/chat/completions"
        );
    }

    #[test]
    fn inserts_v1_segment_when_missing() {
        assert_eq!(
            chat_completions_url("https://api.deepseek.com"),
            "https://api.deepseek.com/v1/chat/completions"
        );
    }

    #[test]
    fn stream_delta_deserializes_reasoning_fields() {
        let delta: super::StreamDelta = serde_json::from_str(
            r#"{"reasoning_content":"step one","content":"answer"}"#,
        )
        .unwrap();
        assert_eq!(delta.reasoning_content.as_deref(), Some("step one"));
        assert_eq!(delta.content.as_deref(), Some("answer"));
    }
}

pub async fn test_connection(
    config: &AiConfig,
    secrets: &AiSecrets,
    provider_id: Option<&str>,
) -> super::types::ConnectionResult {
    let endpoint = match resolve_endpoint(config, secrets, provider_id) {
        Ok(e) => e,
        Err(message) => {
            return super::types::ConnectionResult {
                ok: false,
                message,
                model: None,
            };
        }
    };

    if let Err(message) = ensure_allowed_url(&endpoint.base_url, &effective_allowed_hosts(config)) {
        return super::types::ConnectionResult {
            ok: false,
            message,
            model: None,
        };
    }

    let client = match test_http_client() {
        Ok(c) => c,
        Err(e) => {
            return super::types::ConnectionResult {
                ok: false,
                message: e.to_string(),
                model: None,
            };
        }
    };

    let url = chat_completions_url(&endpoint.base_url);
    let body = ChatCompletionRequest {
        model: endpoint.model.clone(),
        messages: vec![ChatMessage {
            role: "user".into(),
            content: "ping".into(),
        }],
        stream: false,
        stream_options: None,
    };

    let mut req = client.post(&url).json(&body);
    if let Some(key) = &endpoint.api_key {
        req = req.bearer_auth(key);
    }

    match req.send().await {
        Ok(resp) => {
            if !resp.status().is_success() {
                let status = resp.status();
                let text = resp.text().await.unwrap_or_default();
                return super::types::ConnectionResult {
                    ok: false,
                    message: format!("HTTP {status}: {text}"),
                    model: Some(endpoint.model),
                };
            }
            super::types::ConnectionResult {
                ok: true,
                message: "连接成功".into(),
                model: Some(endpoint.model),
            }
        }
        Err(e) => super::types::ConnectionResult {
            ok: false,
            message: format_request_error(e, &url),
            model: Some(endpoint.model),
        },
    }
}

fn emit_usage(on_event: &Channel<StreamEvent>, input_tokens: u64, output_tokens: u64) {
    if input_tokens > 0 || output_tokens > 0 {
        let _ = on_event.send(StreamEvent::Usage {
            input_tokens,
            output_tokens,
            context_total_tokens: None,
            context_max_tokens: None,
            context_percentage: None,
        });
    }
}

fn emit_stream_tokens(on_event: &Channel<StreamEvent>, data: &str) -> bool {
    if data == "[DONE]" {
        return true;
    }

    if let Ok(chunk) = serde_json::from_str::<StreamChunk>(data) {
        if let Some(usage) = chunk.usage {
            emit_usage(
                on_event,
                usage.input_tokens.unwrap_or(0),
                usage.output_tokens.unwrap_or(0),
            );
        }
        for choice in chunk.choices {
            if let Some(delta) = choice.delta {
                let reasoning = delta
                    .reasoning_content
                    .or(delta.reasoning)
                    .or(delta.thinking)
                    .filter(|c| !c.is_empty());
                if let Some(thinking) = reasoning {
                    let _ = on_event.send(StreamEvent::Thinking { content: thinking });
                }
                if let Some(content) = delta.content.filter(|c| !c.is_empty()) {
                    let _ = on_event.send(StreamEvent::Token { content });
                }
            }
            if let Some(message) = choice.message {
                if let Some(content) = message.content.filter(|c| !c.is_empty()) {
                    let _ = on_event.send(StreamEvent::Token { content });
                }
            }
        }
        return false;
    }

    if let Ok(chunk) = serde_json::from_str::<OllamaStreamChunk>(data) {
        if let Some(message) = chunk.message {
            if let Some(content) = message.content.filter(|c| !c.is_empty()) {
                let _ = on_event.send(StreamEvent::Token { content });
            }
        }
        if let Some(response) = chunk.response.filter(|c| !c.is_empty()) {
            let _ = on_event.send(StreamEvent::Token { content: response });
        }
        if chunk.done.unwrap_or(false) {
            emit_usage(
                on_event,
                chunk.prompt_eval_count.unwrap_or(0),
                chunk.eval_count.unwrap_or(0),
            );
            return true;
        }
        return false;
    }

    false
}

pub async fn chat_stream(
    config: Arc<AiConfig>,
    secrets: Arc<AiSecrets>,
    messages: Vec<ChatMessage>,
    cloud_provider_id: Option<String>,
    on_event: Channel<StreamEvent>,
) -> Result<(), String> {
    if !config.enabled {
        return Err("AI 助手未启用".into());
    }

    let provider_ref = cloud_provider_id.as_deref();
    let endpoint = resolve_endpoint(&config, &secrets, provider_ref)?;
    ensure_allowed_url(&endpoint.base_url, &effective_allowed_hosts(config.as_ref()))?;

    let client = http_client()?;

    let url = chat_completions_url(&endpoint.base_url);
    let body = ChatCompletionRequest {
        model: endpoint.model,
        messages,
        stream: true,
        stream_options: Some(StreamOptions {
            include_usage: true,
        }),
    };

    let mut req = client.post(&url).json(&body);
    if let Some(key) = endpoint.api_key {
        req = req.bearer_auth(key);
    }

    let response = req
        .send()
        .await
        .map_err(|e| format!("请求失败: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        let _ = on_event.send(StreamEvent::Error {
            message: format!("HTTP {status}: {text}"),
        });
        return Err(format!("HTTP {status}"));
    }

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        let bytes = chunk.map_err(|e| e.to_string())?;
        buffer.push_str(&String::from_utf8_lossy(&bytes));

        while let Some(pos) = buffer.find('\n') {
            let line = buffer[..pos].trim().to_string();
            buffer = buffer[pos + 1..].to_string();

            if line.is_empty() || line.starts_with(':') {
                continue;
            }
            let data = line.strip_prefix("data:").map(str::trim).unwrap_or(&line);
            if emit_stream_tokens(&on_event, data) {
                let _ = on_event.send(StreamEvent::Done);
                return Ok(());
            }
        }
    }

    // 处理无换行结尾的残余缓冲
    let tail = buffer.trim();
    if !tail.is_empty() {
        let data = tail.strip_prefix("data:").map(str::trim).unwrap_or(tail);
        let _ = emit_stream_tokens(&on_event, data);
    }

    let _ = on_event.send(StreamEvent::Done);
    Ok(())
}

pub async fn chat_once(
    config: &AiConfig,
    secrets: &AiSecrets,
    messages: Vec<ChatMessage>,
    cloud_provider_id: Option<&str>,
) -> Result<String, String> {
    if !config.enabled {
        return Err("AI 助手未启用".into());
    }

    let endpoint = resolve_endpoint(config, secrets, cloud_provider_id)?;
    ensure_allowed_url(&endpoint.base_url, &effective_allowed_hosts(config))?;

    let client = http_client()?;

    let url = chat_completions_url(&endpoint.base_url);
    let body = ChatCompletionRequest {
        model: endpoint.model.clone(),
        messages,
        stream: false,
        stream_options: None,
    };

    let mut req = client.post(&url).json(&body);
    if let Some(key) = &endpoint.api_key {
        req = req.bearer_auth(key);
    }

    let response = req
        .send()
        .await
        .map_err(|e| format!("请求失败: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("HTTP {status}: {text}"));
    }

    let parsed: ChatCompletionResponse = response.json().await.map_err(|e| e.to_string())?;
    Ok(parsed
        .choices
        .into_iter()
        .next()
        .and_then(|c| c.message)
        .map(|m| agent_llm_reply_text(&m))
        .unwrap_or_default())
}
