use reqwest::blocking::Client;
use serde::de::DeserializeOwned;
use std::time::Duration;

pub fn fetch_remote_catalog<T: DeserializeOwned>(url: &str) -> Result<Vec<T>, String> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return Err("市场 URL 不能为空".into());
    }
    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {e}"))?;
    let response = client
        .get(trimmed)
        .send()
        .map_err(|e| format!("请求市场 catalog 失败: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("市场 catalog 返回 HTTP {}", response.status()));
    }
    response
        .json::<Vec<T>>()
        .map_err(|e| format!("解析市场 catalog JSON 失败: {e}"))
}
