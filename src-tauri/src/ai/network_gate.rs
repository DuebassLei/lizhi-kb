use url::Url;

use super::config::AiConfig;

/// 校验 base URL 的 host 是否在白名单内（含端口无关的 host 比较）
pub fn ensure_allowed_url(base_url: &str, allowed_hosts: &[String]) -> Result<Url, String> {
    let parsed = Url::parse(base_url.trim()).map_err(|e| format!("无效的 URL: {e}"))?;
    let host = parsed
        .host_str()
        .ok_or_else(|| "URL 缺少 host".to_string())?
        .to_lowercase();

    let allowed: Vec<String> = allowed_hosts
        .iter()
        .map(|h| h.trim().to_lowercase())
        .filter(|h| !h.is_empty())
        .collect();

    if allowed.iter().any(|h| h == &host) {
        return Ok(parsed);
    }

    Err(format!("不允许访问的主机: {host}"))
}

fn push_host_from_url(out: &mut Vec<String>, url: &str) {
    if let Ok(parsed) = Url::parse(url.trim()) {
        if let Some(host) = parsed.host_str() {
            let h = host.to_lowercase();
            if !h.is_empty() && !out.iter().any(|x| x == &h) {
                out.push(h);
            }
        }
    }
}

/// `network_hosts` ∪ 本地 base_url host ∪ 已配置云端供应商 base_url host
pub fn effective_allowed_hosts(config: &AiConfig) -> Vec<String> {
    let mut hosts: Vec<String> = config
        .network_hosts
        .iter()
        .map(|h| h.trim().to_lowercase())
        .filter(|h| !h.is_empty())
        .collect();

    push_host_from_url(&mut hosts, &config.local_base_url);

    for provider in &config.cloud_providers {
        push_host_from_url(&mut hosts, &provider.base_url);
    }

    hosts
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::config::{AiConfig, CloudProvider};

    #[test]
    fn allows_localhost() {
        let hosts = vec!["127.0.0.1".into(), "localhost".into()];
        assert!(ensure_allowed_url("http://127.0.0.1:11434", &hosts).is_ok());
    }

    #[test]
    fn blocks_unknown_host() {
        let hosts = vec!["127.0.0.1".into()];
        assert!(ensure_allowed_url("http://192.168.1.1:11434", &hosts).is_err());
    }

    #[test]
    fn blocks_unconfigured_https() {
        let hosts = vec!["127.0.0.1".into()];
        assert!(ensure_allowed_url("https://evil.example/v1", &hosts).is_err());
    }

    #[test]
    fn allows_configured_cloud_host() {
        let mut config = AiConfig::default();
        config.cloud_providers.push(CloudProvider {
            id: "p1".into(),
            name: "Demo".into(),
            base_url: "https://api.openai.com/v1".into(),
            model: "gpt-4o".into(),
            image_model: String::new(),
            enabled: true,
        });
        let hosts = effective_allowed_hosts(&config);
        assert!(ensure_allowed_url("https://api.openai.com/v1", &hosts).is_ok());
        assert!(ensure_allowed_url("https://evil.example/v1", &hosts).is_err());
    }

    #[test]
    fn effective_includes_local_base_url_host() {
        let mut config = AiConfig::default();
        config.local_base_url = "http://10.0.0.5:11434".into();
        let hosts = effective_allowed_hosts(&config);
        assert!(hosts.iter().any(|h| h == "10.0.0.5"));
    }
}
