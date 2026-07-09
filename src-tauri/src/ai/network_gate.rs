use url::Url;

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
        .collect();

    if allowed.iter().any(|h| h == &host) {
        return Ok(parsed);
    }

    // 云端 API：允许 https 且 host 含点（简单 SSRF 缓解，用户 opt-in cloud）
    if parsed.scheme() == "https" && host.contains('.') {
        return Ok(parsed);
    }

    Err(format!("不允许访问的主机: {host}"))
}

#[cfg(test)]
mod tests {
    use super::*;

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
}
