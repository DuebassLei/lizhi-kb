use std::collections::HashMap;
use std::path::Path;

use serde::{Deserialize, Serialize};

use super::config::{CcProviderMode, CcWorkbenchConfig, normalize_base_url};
use super::secrets::CcWorkbenchSecrets;

pub const OFFICIAL_PROVIDER_ID: &str = "__official__";
pub const LOCAL_SETTINGS_PROVIDER_ID: &str = "__local_settings_json__";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CcProviderEntry {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub remark: String,
    #[serde(default)]
    pub preset_id: Option<String>,
    #[serde(default)]
    pub provider_mode: CcProviderMode,
    #[serde(default)]
    pub base_url: String,
    #[serde(default)]
    pub model: String,
    #[serde(default)]
    pub fast_model: String,
    #[serde(default)]
    pub sonnet_model: String,
    #[serde(default)]
    pub opus_model: String,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub env_extras: HashMap<String, String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub settings_config: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CcProviderPublic {
    pub id: String,
    pub name: String,
    pub remark: String,
    pub preset_id: Option<String>,
    pub provider_mode: CcProviderMode,
    pub base_url: String,
    pub model: String,
    pub fast_model: String,
    pub sonnet_model: String,
    pub opus_model: String,
    pub api_key_masked: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    pub is_active: bool,
    pub is_builtin: bool,
    pub source: Option<String>,
    #[serde(skip_serializing_if = "HashMap::is_empty", default)]
    pub env_extras: HashMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub settings_config: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CcProviderInput {
    pub id: Option<String>,
    pub name: String,
    #[serde(default)]
    pub remark: Option<String>,
    pub preset_id: Option<String>,
    pub provider_mode: CcProviderMode,
    #[serde(default)]
    pub base_url: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub fast_model: Option<String>,
    #[serde(default)]
    pub sonnet_model: Option<String>,
    #[serde(default)]
    pub opus_model: Option<String>,
    #[serde(default)]
    pub api_key: Option<String>,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub env_extras: Option<HashMap<String, String>>,
    #[serde(default)]
    pub settings_config: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CcSkillEntry {
    pub id: String,
    pub name: String,
    pub scope: String,
    pub path: String,
    pub enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

pub fn ensure_providers_migrated(config: &mut CcWorkbenchConfig) {
    if !config.providers.is_empty() {
        return;
    }

    let has_legacy = config.provider_mode != CcProviderMode::Official
        || !config.base_url.trim().is_empty()
        || !config.model.trim().is_empty()
        || !config.fast_model.trim().is_empty();

    if !has_legacy {
        config.providers.push(default_official_provider());
        config.active_provider_id = Some(OFFICIAL_PROVIDER_ID.to_string());
        return;
    }

    let id = format!("provider-{}", chrono_like_id());
    config.providers.push(CcProviderEntry {
        id: id.clone(),
        name: if config.base_url.is_empty() {
            "Anthropic 官方".to_string()
        } else {
            "自定义供应商".to_string()
        },
        remark: String::new(),
        preset_id: None,
        provider_mode: config.provider_mode,
        base_url: config.base_url.clone(),
        model: config.model.clone(),
        fast_model: config.fast_model.clone(),
        sonnet_model: config.model.clone(),
        opus_model: config.model.clone(),
        source: None,
        env_extras: HashMap::new(),
        settings_config: None,
    });
    config.active_provider_id = Some(id);
}

fn default_official_provider() -> CcProviderEntry {
    CcProviderEntry {
        id: OFFICIAL_PROVIDER_ID.to_string(),
        name: "Anthropic 官方".to_string(),
        remark: "直连 api.anthropic.com".to_string(),
        preset_id: Some("official".to_string()),
        provider_mode: CcProviderMode::Official,
        base_url: String::new(),
        model: String::new(),
        fast_model: String::new(),
        sonnet_model: String::new(),
        opus_model: String::new(),
        source: None,
        env_extras: HashMap::new(),
        settings_config: None,
    }
}

fn chrono_like_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    format!("{ms}")
}

pub fn to_provider_public(
    entry: &CcProviderEntry,
    secrets: &CcWorkbenchSecrets,
    active_id: Option<&str>,
    reveal_key: bool,
    provider_id_for_reveal: Option<&str>,
) -> CcProviderPublic {
    let key = secrets.get_provider_key(&entry.id);
    let reveal_this = reveal_key && provider_id_for_reveal == Some(entry.id.as_str());
    CcProviderPublic {
        id: entry.id.clone(),
        name: entry.name.clone(),
        remark: entry.remark.clone(),
        preset_id: entry.preset_id.clone(),
        provider_mode: entry.provider_mode,
        base_url: entry.base_url.clone(),
        model: entry.model.clone(),
        fast_model: entry.fast_model.clone(),
        sonnet_model: entry.sonnet_model.clone(),
        opus_model: entry.opus_model.clone(),
        api_key_masked: mask_key(key.as_deref()),
        api_key: if reveal_this { key } else { None },
        is_active: active_id == Some(entry.id.as_str()),
        is_builtin: entry.id == OFFICIAL_PROVIDER_ID || entry.id == LOCAL_SETTINGS_PROVIDER_ID,
        source: entry.source.clone(),
        env_extras: entry.env_extras.clone(),
        settings_config: entry.settings_config.clone(),
    }
}

pub fn upsert_provider(
    config: &mut CcWorkbenchConfig,
    secrets: &mut CcWorkbenchSecrets,
    input: &CcProviderInput,
) -> Result<CcProviderEntry, String> {
    let id = input
        .id
        .clone()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| format!("provider-{}", chrono_like_id()));

    if id == LOCAL_SETTINGS_PROVIDER_ID {
        return Err("该供应商为内置模式，不可编辑".into());
    }

    let model = input.model.clone().unwrap_or_default().trim().to_string();
    let prev_extras = config
        .providers
        .iter()
        .find(|p| p.id == id)
        .map(|p| p.env_extras.clone())
        .unwrap_or_default();
    let env_extras = input.env_extras.clone().unwrap_or(prev_extras);
    let prev_settings = config
        .providers
        .iter()
        .find(|p| p.id == id)
        .and_then(|p| p.settings_config.clone());
    let settings_config = if let Some(raw) = input.settings_config.as_deref() {
        match validate_settings_config(raw) {
            Ok(text) if text.is_empty() => prev_settings,
            Ok(text) => Some(text),
            Err(e) => return Err(e),
        }
    } else {
        prev_settings
    };
    let entry = CcProviderEntry {
        id: id.clone(),
        name: input.name.trim().to_string(),
        remark: input.remark.clone().unwrap_or_default().trim().to_string(),
        preset_id: input.preset_id.clone(),
        provider_mode: input.provider_mode,
        base_url: normalize_base_url(input.base_url.as_deref().unwrap_or("")),
        model: model.clone(),
        fast_model: input
            .fast_model
            .clone()
            .unwrap_or_default()
            .trim()
            .to_string(),
        sonnet_model: input
            .sonnet_model
            .clone()
            .unwrap_or_default()
            .trim()
            .to_string(),
        opus_model: input
            .opus_model
            .clone()
            .unwrap_or_default()
            .trim()
            .to_string(),
        source: input.source.clone(),
        env_extras,
        settings_config,
    };

    if entry.name.is_empty() {
        return Err("供应商名称不能为空".into());
    }
    if entry.provider_mode == CcProviderMode::Custom && entry.base_url.is_empty() {
        return Err("自定义供应商需填写 Base URL".into());
    }

    if let Some(key) = &input.api_key {
        let normalized = super::secrets::normalize_api_key(key);
        if normalized.is_empty() {
            secrets.remove_provider_key(&id);
        } else {
            secrets.set_provider_key(&id, normalized);
        }
    }

    if let Some(idx) = config.providers.iter().position(|p| p.id == id) {
        config.providers[idx] = entry.clone();
    } else {
        config.providers.push(entry.clone());
        if !config.provider_order.contains(&id) {
            config.provider_order.push(id.clone());
        }
        if config.active_provider_id.is_none() {
            config.active_provider_id = Some(id);
        }
    }

    sync_legacy_from_active(config, secrets);
    Ok(entry)
}

pub fn delete_provider(
    config: &mut CcWorkbenchConfig,
    secrets: &mut CcWorkbenchSecrets,
    id: &str,
) -> Result<(), String> {
    if id == OFFICIAL_PROVIDER_ID || id == LOCAL_SETTINGS_PROVIDER_ID {
        return Err("内置供应商不可删除".into());
    }
    let idx = config
        .providers
        .iter()
        .position(|p| p.id == id)
        .ok_or_else(|| "供应商不存在".to_string())?;
    config.providers.remove(idx);
    config.provider_order.retain(|pid| pid != id);
    secrets.remove_provider_key(id);

    if config.active_provider_id.as_deref() == Some(id) {
        config.active_provider_id = config
            .providers
            .first()
            .map(|p| p.id.clone())
            .or_else(|| Some(OFFICIAL_PROVIDER_ID.to_string()));
        if config.providers.is_empty() {
            config.providers.push(default_official_provider());
        }
    }
    sync_legacy_from_active(config, secrets);
    Ok(())
}

pub fn switch_provider(
    config: &mut CcWorkbenchConfig,
    secrets: &mut CcWorkbenchSecrets,
    id: &str,
) -> Result<(), String> {
    if id == LOCAL_SETTINGS_PROVIDER_ID {
        super::claude_settings::load_claude_settings_env()?;
        config.active_provider_id = Some(LOCAL_SETTINGS_PROVIDER_ID.to_string());
        return Ok(());
    }
    if !config.providers.iter().any(|p| p.id == id) {
        return Err("供应商不存在".into());
    }
    config.active_provider_id = Some(id.to_string());
    sync_legacy_from_active(config, secrets);
    Ok(())
}

pub fn resolve_active_provider<'a>(
    config: &'a CcWorkbenchConfig,
    secrets: &'a CcWorkbenchSecrets,
) -> Result<ResolvedProvider<'a>, String> {
    let active_id = config.active_provider_id.as_deref().unwrap_or(OFFICIAL_PROVIDER_ID);
    if active_id == LOCAL_SETTINGS_PROVIDER_ID {
        let env = super::claude_settings::load_claude_settings_env()?;
        let api_key = super::claude_settings::resolve_local_api_key(&env)
            .ok_or_else(|| "settings.json 中未配置 ANTHROPIC_AUTH_TOKEN 或 ANTHROPIC_API_KEY".to_string())?;
        return Ok(ResolvedProvider::Local { env, api_key });
    }
    let entry = config
        .providers
        .iter()
        .find(|p| p.id == active_id)
        .ok_or_else(|| "未找到激活的供应商".to_string())?;
    let key = secrets
        .get_provider_key(&entry.id)
        .filter(|k| !k.is_empty())
        .ok_or_else(|| format!("请为「{}」配置 API Key / Auth Token", entry.name))?;
    Ok(ResolvedProvider::Managed {
        entry,
        api_key: key,
    })
}

pub enum ResolvedProvider<'a> {
    Local {
        env: super::claude_settings::ClaudeSettingsEnv,
        api_key: String,
    },
    Managed {
        entry: &'a CcProviderEntry,
        api_key: String,
    },
}

pub fn sort_providers(config: &mut CcWorkbenchConfig, ordered_ids: Vec<String>) {
    let valid: Vec<String> = ordered_ids
        .into_iter()
        .filter(|id| config.providers.iter().any(|p| p.id == *id))
        .collect();
    config.provider_order = valid;
    reorder_provider_vec(config);
}

fn reorder_provider_vec(config: &mut CcWorkbenchConfig) {
    if config.provider_order.is_empty() {
        return;
    }
    let mut ordered = Vec::with_capacity(config.providers.len());
    for id in &config.provider_order {
        if let Some(idx) = config.providers.iter().position(|p| p.id == *id) {
            ordered.push(config.providers[idx].clone());
        }
    }
    for provider in &config.providers {
        if !config.provider_order.contains(&provider.id) {
            ordered.push(provider.clone());
        }
    }
    config.providers = ordered;
}

pub fn ensure_provider_order(config: &mut CcWorkbenchConfig) {
    if config.provider_order.is_empty() {
        config.provider_order = config.providers.iter().map(|p| p.id.clone()).collect();
        return;
    }
    reorder_provider_vec(config);
    config.provider_order = config.providers.iter().map(|p| p.id.clone()).collect();
}

pub fn sync_legacy_from_active(config: &mut CcWorkbenchConfig, secrets: &mut CcWorkbenchSecrets) {
    let active_id = config.active_provider_id.as_deref().unwrap_or(OFFICIAL_PROVIDER_ID);
    if active_id == LOCAL_SETTINGS_PROVIDER_ID {
        return;
    }
    if let Some(entry) = config.providers.iter().find(|p| p.id == active_id) {
        config.provider_mode = entry.provider_mode;
        config.base_url = entry.base_url.clone();
        config.model = entry.model.clone();
        config.fast_model = entry.fast_model.clone();
        if let Some(key) = secrets.get_provider_key(&entry.id) {
            secrets.set_legacy_api_key(key);
        }
    }
}

pub fn list_skills(data_dir: &Path, project_path: Option<&str>) -> Vec<CcSkillEntry> {
    super::skills::list_all_skills(data_dir, project_path)
}

fn mask_key(key: Option<&str>) -> String {
    match key.filter(|k| !k.is_empty()) {
        None => String::new(),
        Some(k) if k.len() <= 8 => "••••••••".to_string(),
        Some(k) => format!("{}••••{}", &k[..4], &k[k.len() - 4..]),
    }
}

pub fn builtin_local_settings_provider() -> CcProviderEntry {
    CcProviderEntry {
        id: LOCAL_SETTINGS_PROVIDER_ID.to_string(),
        name: "本地 settings.json".to_string(),
        remark: "读取 ~/.claude/settings.json 中的 env 配置".to_string(),
        preset_id: None,
        provider_mode: CcProviderMode::Custom,
        base_url: String::new(),
        model: String::new(),
        fast_model: String::new(),
        sonnet_model: String::new(),
        opus_model: String::new(),
        source: None,
        env_extras: HashMap::new(),
        settings_config: None,
    }
}

fn validate_settings_config(raw: &str) -> Result<String, String> {
    let text = raw.trim();
    if text.is_empty() {
        return Ok(String::new());
    }
    serde_json::from_str::<serde_json::Value>(text)
        .map_err(|e| format!("settingsConfig JSON 无效: {e}"))?;
    Ok(text.to_string())
}

pub fn ensure_builtin_providers(config: &mut CcWorkbenchConfig) {
    ensure_providers_migrated(config);
    if !config
        .providers
        .iter()
        .any(|p| p.id == OFFICIAL_PROVIDER_ID)
    {
        config.providers.insert(0, default_official_provider());
    }
    ensure_provider_order(config);
}

pub fn hydrate_local_settings_provider(public: &mut CcProviderPublic) {
    let env = super::claude_settings::load_claude_settings_env().unwrap_or_default();
    let extras = super::claude_settings::load_claude_settings_env_extras();
    if let Some(url) = env.anthropic_base_url {
        public.base_url = url;
    }
    if let Some(m) = env.anthropic_model {
        public.model = m;
    }
    if let Some(m) = env.anthropic_default_sonnet_model {
        public.sonnet_model = m;
    }
    if let Some(m) = env.anthropic_default_opus_model {
        public.opus_model = m;
    }
    if let Some(m) = env
        .anthropic_default_haiku_model
        .or(env.anthropic_small_fast_model)
    {
        public.fast_model = m;
    }
    public.env_extras = extras;
    if public.base_url.is_empty() {
        public.provider_mode = CcProviderMode::Official;
    } else {
        public.provider_mode = CcProviderMode::Custom;
    }
}

pub fn providers_for_public(
    config: &CcWorkbenchConfig,
    secrets: &CcWorkbenchSecrets,
    reveal_provider_id: Option<&str>,
) -> Vec<CcProviderPublic> {
    let active = config.active_provider_id.as_deref();
    let mut local = to_provider_public(
        &builtin_local_settings_provider(),
        secrets,
        active,
        false,
        None,
    );
    local.is_builtin = true;
    hydrate_local_settings_provider(&mut local);
    let mut list: Vec<CcProviderPublic> = vec![local];
    list.extend(config.providers.iter().map(|p| {
        to_provider_public(
            p,
            secrets,
            active,
            reveal_provider_id.is_some(),
            reveal_provider_id,
        )
    }));
    list
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrate_legacy_config() {
        let mut config = CcWorkbenchConfig {
            provider_mode: CcProviderMode::Custom,
            base_url: "https://api.deepseek.com/anthropic".to_string(),
            model: "deepseek-v4-pro".to_string(),
            ..Default::default()
        };
        ensure_providers_migrated(&mut config);
        assert_eq!(config.providers.len(), 1);
        assert!(config.active_provider_id.is_some());
    }
}
