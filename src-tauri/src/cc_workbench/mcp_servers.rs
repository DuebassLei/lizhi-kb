use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::process_utils::hidden_command;
use super::types::BridgeMcpServer;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CcMcpServerSpec {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub r#type: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub args: Vec<String>,
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub env: HashMap<String, String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub headers: Option<HashMap<String, String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CcMcpServer {
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    pub server: CcMcpServerSpec,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub homepage: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub docs: Option<String>,
}

fn default_enabled() -> bool {
    true
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CcMcpServerStatusInfo {
    pub name: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub server_info: Option<CcMcpServerInfo>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CcMcpServerInfo {
    pub name: String,
    pub version: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CcMcpServerInput {
    pub id: String,
    #[serde(default)]
    pub name: Option<String>,
    pub server: CcMcpServerSpec,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub homepage: Option<String>,
    #[serde(default)]
    pub docs: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CcMcpServerToggleRequest {
    pub id: String,
    pub enabled: bool,
}

fn claude_json_path() -> Result<PathBuf, String> {
    dirs::home_dir()
        .map(|h| h.join(".claude.json"))
        .ok_or_else(|| "无法定位用户主目录".to_string())
}

fn read_claude_json() -> Result<Value, String> {
    let path = claude_json_path()?;
    if !path.is_file() {
        return Ok(json!({}));
    }
    let raw = fs::read_to_string(&path).map_err(|e| format!("读取 ~/.claude.json 失败: {e}"))?;
    serde_json::from_str(&raw).map_err(|e| format!("解析 ~/.claude.json 失败: {e}"))
}

fn write_claude_json(value: &Value) -> Result<(), String> {
    let path = claude_json_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| format!("写入 ~/.claude.json 失败: {e}"))
}

fn disabled_server_ids(config: &Value, project_path: Option<&str>) -> HashSet<String> {
    let mut disabled = HashSet::new();
    if let Some(arr) = config.get("disabledMcpServers").and_then(Value::as_array) {
        for item in arr {
            if let Some(id) = item.as_str() {
                disabled.insert(id.to_string());
            }
        }
    }
    if let Some(project_path) = project_path.filter(|p| !p.trim().is_empty()) {
        if let Some(arr) = config
            .pointer(&format!("/projects/{}/disabledMcpServers", json_pointer_escape(project_path)))
            .and_then(Value::as_array)
        {
            for item in arr {
                if let Some(id) = item.as_str() {
                    disabled.insert(id.to_string());
                }
            }
        }
    }
    disabled
}

fn project_config_key(project_path: &str) -> String {
    super::path_utils::project_registry_key(project_path)
}

fn mcp_servers_parent<'a>(
    config: &'a mut Value,
    project_path: Option<&str>,
) -> Result<&'a mut serde_json::Map<String, Value>, String> {
    let root = config
        .as_object_mut()
        .ok_or_else(|| "配置格式无效".to_string())?;
    if let Some(project_path) = project_path.filter(|p| !p.trim().is_empty()) {
        let key = project_config_key(project_path);
        let projects = root
            .entry("projects")
            .or_insert_with(|| json!({}));
        if !projects.is_object() {
            *projects = json!({});
        }
        let project = projects
            .as_object_mut()
            .ok_or_else(|| "配置格式无效".to_string())?
            .entry(key)
            .or_insert_with(|| json!({}));
        if !project.is_object() {
            *project = json!({});
        }
        Ok(project
            .as_object_mut()
            .ok_or_else(|| "配置格式无效".to_string())?)
    } else {
        Ok(root)
    }
}

fn ensure_mcp_servers_map(parent: &mut serde_json::Map<String, Value>) -> &mut Value {
    let servers = parent
        .entry("mcpServers")
        .or_insert_with(|| json!({}));
    if !servers.is_object() {
        *servers = json!({});
    }
    servers
}

fn json_pointer_escape(path: &str) -> String {
    project_config_key(path)
        .replace('~', "~0")
        .replace('/', "~1")
}

fn merged_mcp_server_specs(
    config: &Value,
    project_path: Option<&str>,
) -> HashMap<String, Value> {
    let mut merged = HashMap::new();
    if let Some(global) = config.get("mcpServers").and_then(Value::as_object) {
        for (id, spec) in global {
            merged.insert(id.clone(), spec.clone());
        }
    }
    if let Some(project_path) = project_path.filter(|p| !p.trim().is_empty()) {
        if let Some(project) = config
            .pointer(&format!("/projects/{}/mcpServers", json_pointer_escape(project_path)))
            .and_then(Value::as_object)
        {
            for (id, spec) in project {
                merged.insert(id.clone(), spec.clone());
            }
        }
    }
    merged
}

fn spec_to_server_spec(spec: &Value) -> CcMcpServerSpec {
    let mut server: CcMcpServerSpec = serde_json::from_value(spec.clone()).unwrap_or(CcMcpServerSpec {
        r#type: None,
        command: None,
        args: Vec::new(),
        env: HashMap::new(),
        url: None,
        headers: None,
        cwd: None,
        extra: HashMap::new(),
    });
    if server.r#type.is_none() {
        server.r#type = if server.command.is_some() {
            Some("stdio".into())
        } else if server.url.is_some() {
            Some("http".into())
        } else {
            None
        };
    }
    server
}

pub fn list_cc_mcp_servers(project_path: Option<&str>) -> Result<Vec<CcMcpServer>, String> {
    let config = read_claude_json()?;
    let disabled = disabled_server_ids(&config, project_path);
    let specs = merged_mcp_server_specs(&config, project_path);

    let mut servers: Vec<CcMcpServer> = specs
        .into_iter()
        .map(|(id, spec)| {
            let server = spec_to_server_spec(&spec);
            let name = spec
                .get("name")
                .and_then(Value::as_str)
                .map(str::to_string)
                .unwrap_or_else(|| id.clone());
            CcMcpServer {
                id: id.clone(),
                name: Some(name),
                server,
                enabled: !disabled.contains(&id),
                description: spec
                    .get("description")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                tags: spec
                    .get("tags")
                    .and_then(Value::as_array)
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str().map(str::to_string))
                            .collect()
                    })
                    .unwrap_or_default(),
                homepage: spec
                    .get("homepage")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                docs: spec.get("docs").and_then(Value::as_str).map(str::to_string),
            }
        })
        .collect();

    servers.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(servers)
}

fn server_spec_to_json(spec: &CcMcpServerSpec) -> Value {
    let mut value = serde_json::to_value(spec).unwrap_or_else(|_| json!({}));
    if let Value::Object(map) = &mut value {
        map.remove("extra");
        for (k, v) in &spec.extra {
            map.insert(k.clone(), v.clone());
        }
    }
    value
}

pub fn upsert_cc_mcp_server(
    input: &CcMcpServerInput,
    project_path: Option<&str>,
) -> Result<CcMcpServer, String> {
    if input.id.trim().is_empty() {
        return Err("服务器 ID 不能为空".into());
    }
    validate_server_spec(&input.server)?;

    let mut config = read_claude_json()?;
    if !config.is_object() {
        config = json!({});
    }

    let parent = mcp_servers_parent(&mut config, project_path)?;
    let mcp_servers = ensure_mcp_servers_map(parent);

    let mut spec = server_spec_to_json(&input.server);
    if let Some(name) = &input.name {
        if let Value::Object(map) = &mut spec {
            map.insert("name".into(), json!(name));
        }
    }
    if let Some(desc) = &input.description {
        if let Value::Object(map) = &mut spec {
            map.insert("description".into(), json!(desc));
        }
    }
    if !input.tags.is_empty() {
        if let Value::Object(map) = &mut spec {
            map.insert("tags".into(), json!(input.tags));
        }
    }
    if let Some(homepage) = &input.homepage {
        if let Value::Object(map) = &mut spec {
            map.insert("homepage".into(), json!(homepage));
        }
    }
    if let Some(docs) = &input.docs {
        if let Value::Object(map) = &mut spec {
            map.insert("docs".into(), json!(docs));
        }
    }

    if let Some(map) = mcp_servers.as_object_mut() {
        if let Some(existing) = map.get(&input.id).and_then(Value::as_object) {
            let mut merged = existing.clone();
            if let Value::Object(new_spec) = spec {
                for (k, v) in new_spec {
                    merged.insert(k, v);
                }
            }
            map.insert(input.id.clone(), Value::Object(merged));
        } else if let Value::Object(new_spec) = spec {
            map.insert(input.id.clone(), Value::Object(new_spec));
        }
    }

    update_disabled_list(&mut config, &input.id, input.enabled, project_path);
    write_claude_json(&config)?;

    Ok(CcMcpServer {
        id: input.id.clone(),
        name: input.name.clone().or_else(|| Some(input.id.clone())),
        server: input.server.clone(),
        enabled: input.enabled,
        description: input.description.clone(),
        tags: input.tags.clone(),
        homepage: input.homepage.clone(),
        docs: input.docs.clone(),
    })
}

fn update_disabled_list(
    config: &mut Value,
    server_id: &str,
    enabled: bool,
    project_path: Option<&str>,
) {
    let scoped = project_path.filter(|p| !p.trim().is_empty());
    if let Some(project_path) = scoped {
        let key = project_config_key(project_path);
        let root = config.as_object_mut().expect("config object");
        let projects = root.entry("projects").or_insert_with(|| json!({}));
        if let Some(projects_map) = projects.as_object_mut() {
            let project = projects_map
                .entry(key)
                .or_insert_with(|| json!({}));
            let project_disabled = project
                .as_object_mut()
                .expect("project object")
                .entry("disabledMcpServers")
                .or_insert_with(|| json!([]));
            let mut project_ids: Vec<String> = project_disabled
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(str::to_string))
                        .filter(|id| id != server_id)
                        .collect()
                })
                .unwrap_or_default();
            if !enabled {
                project_ids.push(server_id.to_string());
            }
            *project_disabled = json!(project_ids);
        }
        return;
    }

    let root = config.as_object_mut().expect("config object");
    let disabled = root
        .entry("disabledMcpServers")
        .or_insert_with(|| json!([]));
    let mut ids: Vec<String> = disabled
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(str::to_string))
                .filter(|id| id != server_id)
                .collect()
        })
        .unwrap_or_default();
    if !enabled {
        ids.push(server_id.to_string());
    }
    *disabled = json!(ids);
}

pub fn toggle_cc_mcp_server(
    request: &CcMcpServerToggleRequest,
    project_path: Option<&str>,
) -> Result<(), String> {
    let servers = list_cc_mcp_servers(project_path)?;
    let server = servers
        .into_iter()
        .find(|s| s.id == request.id)
        .ok_or_else(|| format!("未找到 MCP 服务器: {}", request.id))?;

    let input = CcMcpServerInput {
        id: server.id,
        name: server.name,
        server: server.server,
        enabled: request.enabled,
        description: server.description,
        tags: server.tags,
        homepage: server.homepage,
        docs: server.docs,
    };
    upsert_cc_mcp_server(&input, project_path)?;
    Ok(())
}

pub fn delete_cc_mcp_server(id: &str, project_path: Option<&str>) -> Result<(), String> {
    let mut config = read_claude_json()?;
    if !config.is_object() {
        return Err(format!("未找到 MCP 服务器: {id}"));
    }

    let mut removed = false;
    if let Ok(parent) = mcp_servers_parent(&mut config, project_path) {
        if let Some(map) = parent.get_mut("mcpServers").and_then(Value::as_object_mut) {
            removed = map.remove(id).is_some();
        }
    }
    if !removed {
        if let Some(root) = config.as_object_mut() {
            if let Some(map) = root.get_mut("mcpServers").and_then(Value::as_object_mut) {
                removed = map.remove(id).is_some();
            }
            if !removed {
                if let Some(projects) = root.get_mut("projects").and_then(Value::as_object_mut) {
                    for project in projects.values_mut() {
                        if let Some(map) = project.get_mut("mcpServers").and_then(Value::as_object_mut) {
                            if map.remove(id).is_some() {
                                removed = true;
                                break;
                            }
                        }
                    }
                }
            }
        }
    }
    if !removed {
        return Err(format!("未找到 MCP 服务器: {id}"));
    }

    let root = config
        .as_object_mut()
        .ok_or_else(|| "配置格式无效".to_string())?;
    if let Some(disabled) = root.get_mut("disabledMcpServers").and_then(Value::as_array_mut) {
        disabled.retain(|v| v.as_str() != Some(id));
    }
    if let Some(projects) = root.get_mut("projects").and_then(Value::as_object_mut) {
        for project in projects.values_mut() {
            if let Some(disabled) = project
                .get_mut("disabledMcpServers")
                .and_then(Value::as_array_mut)
            {
                disabled.retain(|v| v.as_str() != Some(id));
            }
        }
    }

    write_claude_json(&config)
}

fn validate_server_spec(spec: &CcMcpServerSpec) -> Result<(), String> {
    let conn_type = spec
        .r#type
        .as_deref()
        .unwrap_or(if spec.command.is_some() {
            "stdio"
        } else {
            "http"
        });

    match conn_type {
        "stdio" => {
            let command = spec
                .command
                .as_deref()
                .filter(|c| !c.trim().is_empty())
                .ok_or_else(|| "stdio 类型需填写 command".to_string())?;
            if command_contains_shell_metachar(command) {
                return Err("command 包含不安全的 shell 字符".into());
            }
        }
        "http" | "sse" => {
            let url = spec
                .url
                .as_deref()
                .filter(|u| !u.trim().is_empty())
                .ok_or_else(|| format!("{conn_type} 类型需填写 url"))?;
            if !url.starts_with("http://") && !url.starts_with("https://") {
                return Err("url 需以 http:// 或 https:// 开头".into());
            }
        }
        other => return Err(format!("不支持的连接类型: {other}")),
    }
    Ok(())
}

fn command_contains_shell_metachar(command: &str) -> bool {
    command.contains(';') || command.contains('|') || command.contains('&') || command.contains('`')
}

pub fn get_cc_mcp_server_status(project_path: Option<&str>) -> Result<Vec<CcMcpServerStatusInfo>, String> {
    let servers = list_cc_mcp_servers(project_path)?;
    let mut statuses = Vec::new();
    for server in servers {
        if !server.enabled {
            statuses.push(CcMcpServerStatusInfo {
                name: server.id.clone(),
                status: "failed".into(),
                error: Some("已禁用".into()),
                server_info: None,
            });
            continue;
        }

        let status = probe_server_sync(&server);
        statuses.push(CcMcpServerStatusInfo {
            name: server.id.clone(),
            status: status.0,
            error: status.1,
            server_info: status.2,
        });
    }
    Ok(statuses)
}

fn probe_server_sync(
    server: &CcMcpServer,
) -> (String, Option<String>, Option<CcMcpServerInfo>) {
    let conn_type = server
        .server
        .r#type
        .as_deref()
        .unwrap_or(if server.server.command.is_some() {
            "stdio"
        } else {
            "http"
        });

    match conn_type {
        "stdio" => probe_stdio(&server.server),
        "http" | "sse" => probe_http(&server.server),
        _ => (
            "failed".into(),
            Some("未知连接类型".into()),
            None,
        ),
    }
}

fn probe_stdio(spec: &CcMcpServerSpec) -> (String, Option<String>, Option<CcMcpServerInfo>) {
    let command = match spec.command.as_deref() {
        Some(c) if !c.trim().is_empty() => c,
        _ => return ("failed".into(), Some("缺少 command".into()), None),
    };

    if command_exists(command) {
        (
            "connected".into(),
            None,
            Some(CcMcpServerInfo {
                name: command.to_string(),
                version: "stdio".into(),
            }),
        )
    } else {
        (
            "failed".into(),
            Some(format!("未找到命令: {command}")),
            None,
        )
    }
}

fn command_exists(command: &str) -> bool {
    if Path::new(command).is_file() {
        return true;
    }
    let which_cmd = if cfg!(windows) { "where" } else { "which" };
    if hidden_command(which_cmd)
        .arg(command)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
    {
        return true;
    }
    if cfg!(windows) && !command.ends_with(".cmd") && !command.ends_with(".exe") {
        let cmd_variant = format!("{command}.cmd");
        if Path::new(&cmd_variant).is_file() {
            return true;
        }
        return hidden_command(which_cmd)
            .arg(&cmd_variant)
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);
    }
    false
}

fn probe_http(spec: &CcMcpServerSpec) -> (String, Option<String>, Option<CcMcpServerInfo>) {
    let url = match spec.url.as_deref() {
        Some(u) if !u.trim().is_empty() => u,
        _ => return ("failed".into(), Some("缺少 url".into()), None),
    };

    let client = match reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return (
                "failed".into(),
                Some(format!("HTTP 客户端初始化失败: {e}")),
                None,
            )
        }
    };

    let mut req = client.get(url);
    if let Some(headers) = &spec.headers {
        for (k, v) in headers {
            if let Ok(name) = reqwest::header::HeaderName::from_bytes(k.as_bytes()) {
                if let Ok(value) = reqwest::header::HeaderValue::from_str(v) {
                    req = req.header(name, value);
                }
            }
        }
    }

    match req.send() {
        Ok(resp) if resp.status().is_success() || resp.status().is_redirection() => (
            "connected".into(),
            None,
            Some(CcMcpServerInfo {
                name: url.to_string(),
                version: format!("HTTP {}", resp.status().as_u16()),
            }),
        ),
        Ok(resp) => (
            "failed".into(),
            Some(format!("HTTP {}", resp.status().as_u16())),
            None,
        ),
        Err(e) => ("failed".into(), Some(format!("连接失败: {e}")), None),
    }
}

pub fn enabled_bridge_servers(project_path: Option<&str>) -> HashMap<String, BridgeMcpServer> {
    let Ok(servers) = list_cc_mcp_servers(project_path) else {
        return HashMap::new();
    };

    servers
        .into_iter()
        .filter(|s| s.enabled)
        .filter_map(|s| {
            let bridge = spec_to_bridge(&s.server)?;
            Some((s.id, bridge))
        })
        .collect()
}

fn spec_to_bridge(spec: &CcMcpServerSpec) -> Option<BridgeMcpServer> {
    let conn_type = spec
        .r#type
        .as_deref()
        .unwrap_or(if spec.command.is_some() {
            "stdio"
        } else {
            "http"
        });

    match conn_type {
        "stdio" => {
            let command = spec.command.clone()?;
            let cwd = spec
                .cwd
                .as_ref()
                .filter(|p| !p.trim().is_empty())
                .and_then(|p| super::path_utils::normalize_config_path(p).ok())
                .and_then(|p| super::path_utils::resolve_project_dir(&p).ok())
                .map(|p| super::path_utils::format_path_for_node(&p));
            Some(BridgeMcpServer {
                r#type: Some("stdio".into()),
                command: Some(command),
                args: spec.args.clone(),
                env: spec.env.clone(),
                url: None,
                headers: None,
                cwd,
            })
        }
        "http" | "sse" => {
            let url = spec.url.clone()?;
            Some(BridgeMcpServer {
                r#type: Some(conn_type.to_string()),
                command: None,
                args: Vec::new(),
                env: HashMap::new(),
                url: Some(url),
                headers: spec.headers.clone(),
                cwd: None,
            })
        }
        _ => None,
    }
}

pub fn copy_config_snippet(server: &CcMcpServer) -> String {
    let mut spec = server_spec_to_json(&server.server);
    if let Value::Object(map) = &mut spec {
        if let Some(env) = map.get_mut("env").and_then(Value::as_object_mut) {
            for value in env.values_mut() {
                *value = json!("***");
            }
        }
        if let Some(headers) = map.get_mut("headers").and_then(Value::as_object_mut) {
            for value in headers.values_mut() {
                *value = json!("***");
            }
        }
    }
    serde_json::to_string_pretty(&json!({
        "mcpServers": {
            (server.id.clone()): spec
        }
    }))
    .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_stdio_requires_command() {
        let spec = CcMcpServerSpec {
            r#type: Some("stdio".into()),
            command: None,
            args: Vec::new(),
            env: HashMap::new(),
            url: None,
            headers: None,
            cwd: None,
            extra: HashMap::new(),
        };
        assert!(validate_server_spec(&spec).is_err());
    }

    #[test]
    fn project_disabled_list_uses_forward_slash_registry_key() {
        let mut config = json!({
            "mcpServers": {
                "demo": { "command": "npx", "args": ["-y", "pkg"] }
            }
        });
        update_disabled_list(
            &mut config,
            "demo",
            false,
            Some(r"D:\codes\demo-project"),
        );
        let key = project_config_key(r"D:\codes\demo-project");
        let disabled = config
            .get("projects")
            .and_then(|v| v.get(&key))
            .and_then(|v| v.get("disabledMcpServers"))
            .and_then(Value::as_array)
            .expect("project disabled list");
        assert_eq!(disabled, &[json!("demo")]);
        // 项目作用域更新不得改写 / 创建全局 disabled 列表
        assert!(
            config.get("disabledMcpServers").is_none(),
            "global disabledMcpServers should remain untouched when project_path is set"
        );
    }

    #[test]
    fn copy_config_redacts_secrets() {
        let server = CcMcpServer {
            id: "test".into(),
            name: Some("Test".into()),
            server: CcMcpServerSpec {
                r#type: Some("stdio".into()),
                command: Some("npx".into()),
                args: vec!["-y".into(), "pkg".into()],
                env: HashMap::from([("API_KEY".into(), "secret".into())]),
                url: None,
                headers: None,
                cwd: None,
                extra: HashMap::new(),
            },
            enabled: true,
            description: None,
            tags: Vec::new(),
            homepage: None,
            docs: None,
        };
        let snippet = copy_config_snippet(&server);
        assert!(snippet.contains("\"***\""));
        assert!(!snippet.contains("secret"));
    }
}
