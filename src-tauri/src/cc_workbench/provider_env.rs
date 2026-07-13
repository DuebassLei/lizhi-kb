use std::collections::HashMap;

use super::secrets::normalize_api_key;

const MANAGED_ENV_KEYS: &[&str] = &[
    "ANTHROPIC_BASE_URL",
    "ANTHROPIC_AUTH_TOKEN",
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_MODEL",
    "ANTHROPIC_DEFAULT_SONNET_MODEL",
    "ANTHROPIC_DEFAULT_OPUS_MODEL",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL",
    "ANTHROPIC_SMALL_FAST_MODEL",
];

pub fn read_env_string(env: &serde_json::Map<String, serde_json::Value>, key: &str) -> Option<String> {
    env.get(key)
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

pub fn read_fast_model(env: &serde_json::Map<String, serde_json::Value>) -> Option<String> {
    read_env_string(env, "ANTHROPIC_DEFAULT_HAIKU_MODEL")
        .or_else(|| read_env_string(env, "ANTHROPIC_SMALL_FAST_MODEL"))
}

pub fn collect_env_extras(env: &serde_json::Map<String, serde_json::Value>) -> HashMap<String, String> {
    env.iter()
        .filter_map(|(key, value)| {
            if MANAGED_ENV_KEYS.contains(&key.as_str()) {
                return None;
            }
            let text = value.as_str()?.trim();
            if text.is_empty() {
                None
            } else {
                Some((key.clone(), text.to_string()))
            }
        })
        .collect()
}

pub fn normalize_api_key_from_env(env: &serde_json::Map<String, serde_json::Value>) -> Option<String> {
    read_env_string(env, "ANTHROPIC_AUTH_TOKEN")
        .or_else(|| read_env_string(env, "ANTHROPIC_API_KEY"))
        .map(|k| normalize_api_key(&k))
        .filter(|k| !k.is_empty())
}
