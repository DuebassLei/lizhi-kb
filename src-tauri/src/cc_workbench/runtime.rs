use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::path::Path;
use std::process::{ChildStdin, Command, Stdio};
use std::sync::{Arc, LazyLock, Mutex};
use std::sync::mpsc;
use std::time::{Duration, Instant};

use tauri::ipc::Channel;

use crate::ai::StreamEvent;
use crate::mcp::load_mcp_config;
use crate::mcp::resolve_mcp_adapter_path;

use super::chat_input::{CcEnhancePromptResult, CcModelTestResult};
use super::config::{CcProviderMode, CcWorkbenchConfig, CwdMode};
use super::path_utils::{format_path_for_node, resolve_project_dir};
use super::paths::{is_sdk_installed, resolve_bridge_script, sdk_root_dir};
use super::process_utils::hidden_command;
use super::providers::ResolvedProvider;
use super::secrets::CcWorkbenchSecrets;
use super::types::{BridgeMcpServer, BridgePayload, CcWorkbenchRequest, CcWorkbenchStatus};

static ACTIVE_BRIDGE_PID: Mutex<Option<u32>> = Mutex::new(None);
static ACTIVE_BRIDGE_STDIN: Mutex<Option<Arc<Mutex<Option<ChildStdin>>>>> = Mutex::new(None);
static PERMISSION_WAITERS: LazyLock<Mutex<HashMap<String, mpsc::Sender<ToolPermissionDecision>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

#[derive(Debug, Clone)]
struct ToolPermissionDecision {
    behavior: String,
    message: Option<String>,
}

/// Claude Code CLI ≥ 2.1.154 sends `role: system` inside messages[], which older
/// vLLM Anthropic proxies reject (400). SDK 0.3.153 bundles CLI 2.1.153.
const CC_AGENT_SDK_VERSION: &str = "0.3.153";

pub fn locked_sdk_version() -> &'static str {
    CC_AGENT_SDK_VERSION
}

pub fn collect_status(data_dir: &Path) -> CcWorkbenchStatus {
    let (node_available, node_version) = detect_node();
    let bridge_path = resolve_bridge_script();
    CcWorkbenchStatus {
        node_available,
        node_version,
        bridge_available: bridge_path.is_some(),
        bridge_path,
        sdk_installed: is_sdk_installed(data_dir),
        sdk_path: sdk_root_dir(data_dir).display().to_string(),
        sdk_version: locked_sdk_version().to_string(),
        mcp_enabled: load_mcp_config(data_dir)
            .map(|c| c.enabled)
            .unwrap_or(false),
        mcp_adapter_path: resolve_mcp_adapter_path(),
    }
}

fn detect_node() -> (bool, Option<String>) {
    let program = if cfg!(windows) { "node.exe" } else { "node" };
    match hidden_command(program).arg("--version").output() {
        Ok(output) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            (true, Some(version))
        }
        _ => (false, None),
    }
}

pub fn install_sdk(data_dir: &Path) -> Result<String, String> {
    let status = collect_status(data_dir);
    if !status.node_available {
        return Err("未检测到 Node.js，请先安装 Node.js 18 或更高版本".into());
    }

    let sdk_root = sdk_root_dir(data_dir);
    std::fs::create_dir_all(&sdk_root).map_err(|e| e.to_string())?;

    let package_json = r#"{"name":"lizhi-claude-sdk","private":true,"type":"module"}"#;
    std::fs::write(sdk_root.join("package.json"), package_json).map_err(|e| e.to_string())?;

    let npm = if cfg!(windows) { "npm.cmd" } else { "npm" };
    let sdk_spec = format!("@anthropic-ai/claude-agent-sdk@{CC_AGENT_SDK_VERSION}");
    let output = hidden_command(npm)
        .current_dir(&sdk_root)
        .args([
            "install",
            &sdk_spec,
            "--no-fund",
            "--no-audit",
            "--loglevel=error",
        ])
        .output()
        .map_err(|e| format!("执行 npm install 失败: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(format!(
            "安装 Claude Agent SDK 失败:\n{stdout}\n{stderr}"
        ));
    }

    Ok(format!(
        "Claude Agent SDK {CC_AGENT_SDK_VERSION} 已安装到 ~/.lizhi-kb/dependencies/claude-sdk"
    ))
}

pub fn resolve_cwd(data_dir: &Path, config: &CcWorkbenchConfig) -> Result<String, String> {
    match config.cwd_mode {
        CwdMode::Vault => Ok(format_path_for_node(data_dir)),
        CwdMode::Project => {
            let path = config
                .project_path
                .as_ref()
                .filter(|p| !p.trim().is_empty())
                .ok_or_else(|| "请先在设置中选择项目目录".to_string())?;
            let canonical = resolve_project_dir(path)?;
            Ok(format_path_for_node(&canonical))
        }
    }
}

pub fn abort_active_stream() -> Result<(), String> {
    clear_permission_waiters("会话已终止");
    let pid = ACTIVE_BRIDGE_PID
        .lock()
        .map_err(|e| e.to_string())?
        .take();
    clear_bridge_stdin();
    let Some(pid) = pid else {
        return Ok(());
    };
    kill_process_tree(pid)
}

fn kill_process_tree(pid: u32) -> Result<(), String> {
    #[cfg(windows)]
    {
        let status = hidden_command("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .status()
            .map_err(|e| format!("终止 Agent 进程失败: {e}"))?;
        if !status.success() {
            return Err("终止 Agent 进程失败".into());
        }
    }
    #[cfg(not(windows))]
    {
        let status = hidden_command("kill")
            .arg(pid.to_string())
            .status()
            .map_err(|e| format!("终止 Agent 进程失败: {e}"))?;
        if !status.success() {
            return Err("终止 Agent 进程失败".into());
        }
    }
    Ok(())
}

fn track_bridge_child(child: &std::process::Child) {
    if let Ok(mut guard) = ACTIVE_BRIDGE_PID.lock() {
        *guard = Some(child.id());
    }
}

fn clear_bridge_child() {
    if let Ok(mut guard) = ACTIVE_BRIDGE_PID.lock() {
        *guard = None;
    }
    clear_bridge_stdin();
    clear_permission_waiters("会话已结束");
}

fn track_bridge_stdin(stdin: ChildStdin) {
    let wrapped = Arc::new(Mutex::new(Some(stdin)));
    if let Ok(mut guard) = ACTIVE_BRIDGE_STDIN.lock() {
        *guard = Some(wrapped);
    }
}

fn clear_bridge_stdin() {
    if let Ok(mut guard) = ACTIVE_BRIDGE_STDIN.lock() {
        *guard = None;
    }
}

fn register_permission_waiter(request_id: &str) -> mpsc::Receiver<ToolPermissionDecision> {
    let (tx, rx) = mpsc::channel();
    if let Ok(mut map) = PERMISSION_WAITERS.lock() {
        map.insert(request_id.to_string(), tx);
    }
    rx
}

fn clear_permission_waiters(deny_message: &str) {
    if let Ok(mut map) = PERMISSION_WAITERS.lock() {
        for (_, tx) in map.drain() {
            let _ = tx.send(ToolPermissionDecision {
                behavior: "deny".into(),
                message: Some(deny_message.to_string()),
            });
        }
    }
}

fn signal_permission_waiter(
    request_id: &str,
    behavior: &str,
    message: Option<String>,
) -> Result<(), String> {
    let tx = PERMISSION_WAITERS
        .lock()
        .map_err(|e| e.to_string())?
        .remove(request_id);
    let Some(tx) = tx else {
        return Err("未找到对应的工具权限请求".into());
    };
    tx.send(ToolPermissionDecision {
        behavior: behavior.to_string(),
        message,
    })
    .map_err(|_| "权限响应通道已关闭".to_string())
}

fn write_bridge_stdin_line(line: &str) -> Result<(), String> {
    let guard = ACTIVE_BRIDGE_STDIN
        .lock()
        .map_err(|e| e.to_string())?;
    let Some(arc) = guard.as_ref() else {
        return Err("无活跃的 Agent 会话".into());
    };
    let mut stdin_opt = arc.lock().map_err(|e| e.to_string())?;
    let Some(stdin) = stdin_opt.as_mut() else {
        return Err("Agent stdin 不可用".into());
    };
    stdin
        .write_all(line.as_bytes())
        .map_err(|e| format!("写入 Agent stdin 失败: {e}"))?;
    stdin
        .write_all(b"\n")
        .map_err(|e| format!("写入 Agent stdin 失败: {e}"))?;
    stdin.flush().map_err(|e| format!("刷新 Agent stdin 失败: {e}"))?;
    Ok(())
}

pub fn respond_tool_permission(
    request_id: &str,
    behavior: &str,
    message: Option<&str>,
) -> Result<(), String> {
    let trimmed_id = request_id.trim();
    if trimmed_id.is_empty() {
        return Err("requestId 不能为空".into());
    }
    let normalized = if behavior.trim() == "allow" {
        "allow"
    } else {
        "deny"
    };
    let payload = serde_json::json!({
        "type": "toolPermissionResponse",
        "requestId": trimmed_id,
        "behavior": normalized,
        "message": message.filter(|m| !m.trim().is_empty()),
    });
    write_bridge_stdin_line(&payload.to_string())?;
    signal_permission_waiter(
        trimmed_id,
        normalized,
        message.filter(|m| !m.trim().is_empty()).map(str::to_string),
    )
}

/// Set bridge child process env: override path vars and strip drive-only inherited values.
fn apply_bridge_process_env(cmd: &mut Command, data_dir: &Path, project_cwd: &str) {
    let data_str = format_path_for_node(data_dir);
    for key in [
        "IDEA_PROJECT_PATH",
        "PROJECT_PATH",
        "LIZHI_PROJECT_PATH",
        "LIZHI_DATA_DIR",
    ] {
        cmd.env_remove(key);
    }
    cmd.env("LIZHI_DATA_DIR", &data_str);
    cmd.env("LIZHI_PROJECT_PATH", project_cwd);
    cmd.env("PROJECT_PATH", project_cwd);
    cmd.env("IDEA_PROJECT_PATH", project_cwd);
}

fn sanitize_opened_files_for_project(cwd: &str, files: &[String]) -> Vec<String> {
    use std::path::{Component, Path};

    let base = match Path::new(cwd).canonicalize() {
        Ok(p) => p,
        Err(_) => return Vec::new(),
    };

    let mut out = Vec::new();
    for raw in files {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            continue;
        }
        let rel = Path::new(trimmed);
        if rel
            .components()
            .any(|c| matches!(c, Component::Prefix(_) | Component::RootDir))
        {
            continue;
        }
        let full = base.join(rel);
        let Ok(canonical) = full.canonicalize() else {
            continue;
        };
        if !canonical.starts_with(&base) {
            continue;
        }
        if canonical.is_file() {
            out.push(trimmed.to_string());
        }
    }
    out
}

fn parse_provider_settings(raw: Option<&str>) -> Option<serde_json::Value> {
    let text = raw?.trim();
    if text.is_empty() {
        return None;
    }
    serde_json::from_str(text).ok()
}
fn build_mcp_servers(
    data_dir: &Path,
    project_path: Option<&str>,
    include_user_servers: bool,
) -> Option<std::collections::HashMap<String, BridgeMcpServer>> {
    let mut servers = if include_user_servers {
        super::mcp_servers::enabled_bridge_servers(project_path)
    } else {
        std::collections::HashMap::new()
    };

    if let Ok(mcp_config) = load_mcp_config(data_dir) {
        if mcp_config.enabled {
            if let Some(adapter) = resolve_mcp_adapter_path() {
                let mut env = std::collections::HashMap::new();
                env.insert("LIZHI_MCP_BACKEND".into(), "http_bridge".into());
                env.insert(
                    "LIZHI_MCP_URL".into(),
                    format!("http://127.0.0.1:{}", mcp_config.port),
                );
                env.insert("LIZHI_MCP_TOKEN".into(), mcp_config.token);
                env.insert(
                    "LIZHI_DATA_DIR".into(),
                    data_dir.display().to_string(),
                );

                let node = "node";
                servers.insert(
                    "lizhi-kb".into(),
                    BridgeMcpServer {
                        r#type: Some("stdio".into()),
                        command: Some(node.into()),
                        args: vec![adapter],
                        env,
                        url: None,
                        headers: None,
                        cwd: None,
                    },
                );
            }
        }
    }

    if servers.is_empty() {
        None
    } else {
        Some(servers)
    }
}

pub fn run_stream(
    data_dir: &Path,
    config: &CcWorkbenchConfig,
    secrets: &CcWorkbenchSecrets,
    request: CcWorkbenchRequest,
    opened_file_contents: Vec<super::context::OpenedFileContent>,
    attachment_contents: Vec<super::context::AttachmentContent>,
    on_event: Channel<StreamEvent>,
) -> Result<(), String> {
    let status = collect_status(data_dir);
    if !status.bridge_available {
        return Err("未找到 ai-bridge 脚本，请确认开发环境或安装包完整".into());
    }
    if !status.node_available {
        return Err("未检测到 Node.js，请先安装 Node.js 18+".into());
    }
    if !status.sdk_installed {
        return Err("Claude Agent SDK 未安装，请先在设置中安装运行时".into());
    }
    let resolved = super::providers::resolve_active_provider(config, secrets)?;

    let cwd = resolve_cwd(data_dir, config)?;
    let bridge_script = status.bridge_path.ok_or_else(|| "bridge path missing".to_string())?;

    let project_path = config.project_path.as_deref();
    let mcp_servers = match config.cwd_mode {
        CwdMode::Vault => {
            let servers = build_mcp_servers(data_dir, project_path, false).ok_or_else(|| {
                "vault 模式需要启用 MCP 并确保 lizhi-mcp 可用，请在设置 → AI 集成 / MCP 中开启".to_string()
            })?;
            if !servers.contains_key("lizhi-kb") {
                return Err(
                    "vault 模式需要启用 MCP 并确保 lizhi-mcp 可用，请在设置 → AI 集成 / MCP 中开启"
                        .into(),
                );
            }
            Some(servers)
        }
        CwdMode::Project => build_mcp_servers(data_dir, project_path, true),
    };

    let mut opened_files = request.opened_files.clone();
    if config.cwd_mode == CwdMode::Project {
        opened_files = sanitize_opened_files_for_project(&cwd, &opened_files);
    }

    let payload = match resolved {
        ResolvedProvider::Local { env, api_key } => {
            let provider_mode = if env.anthropic_base_url.as_deref().unwrap_or("").is_empty() {
                CcProviderMode::Official
            } else {
                CcProviderMode::Custom
            };
            let sonnet = env.anthropic_default_sonnet_model.clone();
            let fast = env
                .anthropic_default_haiku_model
                .clone()
                .or_else(|| {
                    env.anthropic_small_fast_model.clone()
                });
            BridgePayload {
                prompt: request.prompt.clone(),
                session_id: request.session_id.clone(),
                cwd: cwd.clone(),
                cwd_mode: BridgePayload::cwd_mode_str(config.cwd_mode).to_string(),
                provider_mode: BridgePayload::provider_mode_str(provider_mode).to_string(),
                api_key,
                base_url: env.anthropic_base_url,
                model: env.anthropic_model,
                fast_model: fast,
                sonnet_model: sonnet,
                opus_model: env.anthropic_default_opus_model,
                extra_env: None,
                selected_model: non_empty_option_opt(&request.selected_model),
                selected_model_slot: non_empty_option_opt(&request.selected_model_slot),
                reasoning_effort: non_empty_option_opt(&request.reasoning_effort),
                permission_mode: non_empty_option_opt(&request.permission_mode),
                mcp_servers,
                settings: None,
                opened_files: opened_files.clone(),
                opened_file_contents: opened_file_contents.clone(),
                attachments: request.attachments.clone(),
                attachment_contents: attachment_contents.clone(),
                agent_prompt: request.agent_prompt.clone(),
                disable_thinking: request.disable_thinking,
            }
        }
        ResolvedProvider::Managed { entry, api_key } => {
            if entry.provider_mode == CcProviderMode::Custom && entry.base_url.trim().is_empty() {
                return Err("自定义网关模式需填写 Base URL".into());
            }
            let extra_env = if entry.env_extras.is_empty() {
                None
            } else {
                Some(entry.env_extras.clone())
            };
            BridgePayload {
                prompt: request.prompt.clone(),
                session_id: request.session_id.clone(),
                cwd: cwd.clone(),
                cwd_mode: BridgePayload::cwd_mode_str(config.cwd_mode).to_string(),
                provider_mode: BridgePayload::provider_mode_str(entry.provider_mode).to_string(),
                api_key,
                base_url: non_empty_option(&entry.base_url),
                model: non_empty_option(&entry.model),
                fast_model: non_empty_option(
                    &if entry.fast_model.is_empty() {
                        entry.sonnet_model.clone()
                    } else {
                        entry.fast_model.clone()
                    },
                ),
                sonnet_model: non_empty_option(&entry.sonnet_model),
                opus_model: non_empty_option(&entry.opus_model),
                extra_env,
                selected_model: non_empty_option_opt(&request.selected_model),
                selected_model_slot: non_empty_option_opt(&request.selected_model_slot),
                reasoning_effort: non_empty_option_opt(&request.reasoning_effort),
                permission_mode: non_empty_option_opt(&request.permission_mode),
                mcp_servers,
                settings: parse_provider_settings(entry.settings_config.as_deref()),
                opened_files: opened_files.clone(),
                opened_file_contents: opened_file_contents.clone(),
                attachments: request.attachments.clone(),
                attachment_contents: attachment_contents.clone(),
                agent_prompt: request.agent_prompt.clone(),
                disable_thinking: request.disable_thinking,
            }
        }
    };

    let node = if cfg!(windows) { "node.exe" } else { "node" };
    let mut cmd = hidden_command(node);
    cmd.arg(&bridge_script);
    cmd.args(["claude", "send"]);
    cmd.current_dir(&cwd);
    apply_bridge_process_env(&mut cmd, data_dir, &cwd);
    let mut child = cmd
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("启动 ai-bridge 失败: {e}"))?;

    track_bridge_child(&child);

    let stdin_json = serde_json::to_string(&payload).map_err(|e| e.to_string())?;
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(stdin_json.as_bytes())
            .map_err(|e| e.to_string())?;
        stdin.write_all(b"\n").map_err(|e| e.to_string())?;
        stdin.flush().map_err(|e| e.to_string())?;
        track_bridge_stdin(stdin);
    }

    let stdout = child.stdout.take().ok_or_else(|| "stdout unavailable".to_string())?;
    let stderr = child.stderr.take().ok_or_else(|| "stderr unavailable".to_string())?;
    let reader = BufReader::new(stdout);
    let stderr_reader = BufReader::new(stderr);

    let mut saw_content = false;
    let mut saw_error = false;

    for line in reader.lines() {
        let line = line.map_err(|e| e.to_string())?;
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Ok(event) = parse_bridge_line(trimmed) {
            if let StreamEvent::ToolPermission { request_id, .. } = &event {
                let rx = register_permission_waiter(request_id);
                let _ = on_event.send(event.clone());
                let decision = rx
                    .recv_timeout(Duration::from_secs(120))
                    .unwrap_or(ToolPermissionDecision {
                        behavior: "deny".into(),
                        message: Some("权限请求超时".into()),
                    });
                if PERMISSION_WAITERS
                    .lock()
                    .ok()
                    .and_then(|mut map| map.remove(request_id))
                    .is_some()
                {
                    let payload = serde_json::json!({
                        "type": "toolPermissionResponse",
                        "requestId": request_id,
                        "behavior": decision.behavior,
                        "message": decision.message,
                    });
                    let _ = write_bridge_stdin_line(&payload.to_string());
                }
                continue;
            }

            match &event {
                StreamEvent::Token { content } if !content.is_empty() => saw_content = true,
                StreamEvent::ToolCall { .. } | StreamEvent::ToolResult { .. } => saw_content = true,
                StreamEvent::Error { .. } => saw_error = true,
                _ => {}
            }
            let is_done = matches!(event, StreamEvent::Done);
            let _ = on_event.send(event);
            if is_done {
                break;
            }
        }
    }

    let status = child.wait().map_err(|e| e.to_string())?;
    let stderr_lines: Vec<String> = stderr_reader
        .lines()
        .map_while(Result::ok)
        .map(|line| line.trim().to_string())
        .filter(|line| !line.is_empty())
        .collect();

    if !saw_error && !saw_content {
        if let Some(err) = stderr_lines
            .iter()
            .find(|line| line.contains("ERR_MODULE_NOT_FOUND") || line.contains("Error"))
            .cloned()
            .or_else(|| {
                if !status.success() {
                    Some(format!("ai-bridge 进程异常退出 (code={})", status.code().unwrap_or(-1)))
                } else {
                    None
                }
            })
        {
            let _ = on_event.send(StreamEvent::Error { message: err });
        } else if status.success() {
            let _ = on_event.send(StreamEvent::Error {
                message: "模型未返回内容，请检查供应商配置、API Key 与网络连接".into(),
            });
        }
    }

    clear_bridge_child();
    Ok(())
}

struct ProviderBridgeContext {
    provider_mode: String,
    api_key: String,
    base_url: Option<String>,
    model: Option<String>,
    fast_model: Option<String>,
    sonnet_model: Option<String>,
    opus_model: Option<String>,
    extra_env: Option<std::collections::HashMap<String, String>>,
}

fn provider_bridge_context(resolved: &ResolvedProvider<'_>) -> ProviderBridgeContext {
    match resolved {
        ResolvedProvider::Local { env, api_key } => {
            let provider_mode = if env.anthropic_base_url.as_deref().unwrap_or("").is_empty() {
                BridgePayload::provider_mode_str(CcProviderMode::Official)
            } else {
                BridgePayload::provider_mode_str(CcProviderMode::Custom)
            };
            let sonnet = env.anthropic_default_sonnet_model.clone();
            let fast = env
                .anthropic_default_haiku_model
                .clone()
                .or_else(|| env.anthropic_small_fast_model.clone());
            ProviderBridgeContext {
                provider_mode: provider_mode.to_string(),
                api_key: api_key.clone(),
                base_url: env.anthropic_base_url.clone(),
                model: env.anthropic_model.clone(),
                fast_model: fast,
                sonnet_model: sonnet,
                opus_model: env.anthropic_default_opus_model.clone(),
                extra_env: None,
            }
        }
        ResolvedProvider::Managed { entry, api_key } => ProviderBridgeContext {
            provider_mode: BridgePayload::provider_mode_str(entry.provider_mode).to_string(),
            api_key: api_key.clone(),
            base_url: non_empty_option(&entry.base_url),
            model: non_empty_option(&entry.model),
            fast_model: non_empty_option(if entry.fast_model.is_empty() {
                &entry.sonnet_model
            } else {
                &entry.fast_model
            }),
            sonnet_model: non_empty_option(&entry.sonnet_model),
            opus_model: non_empty_option(&entry.opus_model),
            extra_env: if entry.env_extras.is_empty() {
                None
            } else {
                Some(entry.env_extras.clone())
            },
        },
    }
}

fn build_bridge_sidecar_payload(
    ctx: &ProviderBridgeContext,
    cwd: &str,
    cwd_mode: CwdMode,
    selected_model: Option<&str>,
    selected_model_slot: Option<&str>,
) -> serde_json::Value {
    serde_json::json!({
        "cwd": cwd,
        "cwdMode": BridgePayload::cwd_mode_str(cwd_mode),
        "providerMode": ctx.provider_mode,
        "apiKey": ctx.api_key,
        "baseUrl": ctx.base_url,
        "model": ctx.model,
        "sonnetModel": ctx.sonnet_model,
        "opusModel": ctx.opus_model,
        "fastModel": ctx.fast_model,
        "extraEnv": ctx.extra_env,
        "selectedModel": selected_model.and_then(non_empty_option),
        "selectedModelSlot": selected_model_slot.and_then(non_empty_option),
        "disableThinking": true,
    })
}

fn run_bridge_sidecar_timed(
    data_dir: &Path,
    cwd: &str,
    bridge_script: &str,
    subcommand: &str,
    payload: serde_json::Value,
    timeout: Option<Duration>,
) -> Result<std::process::Output, String> {
    let node = if cfg!(windows) { "node.exe" } else { "node" };
    let mut cmd = hidden_command(node);
    cmd.arg(bridge_script);
    cmd.args(["claude", subcommand]);
    cmd.current_dir(cwd);
    apply_bridge_process_env(&mut cmd, data_dir, cwd);
    let mut child = cmd
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("启动 ai-bridge {subcommand} 失败: {e}"))?;

    if let Some(mut stdin) = child.stdin.take() {
        let json = serde_json::to_string(&payload).map_err(|e| e.to_string())?;
        stdin.write_all(json.as_bytes()).map_err(|e| e.to_string())?;
        stdin.write_all(b"\n").map_err(|e| e.to_string())?;
    }

    if let Some(limit) = timeout {
        let deadline = Instant::now() + limit;
        loop {
            match child.try_wait() {
                Ok(Some(_)) => break,
                Ok(None) => {
                    if Instant::now() >= deadline {
                        let _ = child.kill();
                        let _ = child.wait();
                        return Err(format!(
                            "ai-bridge {subcommand} 超时（{} 秒），请检查网络或 API 配置",
                            limit.as_secs()
                        ));
                    }
                    std::thread::sleep(Duration::from_millis(100));
                }
                Err(e) => return Err(format!("等待 ai-bridge {subcommand} 失败: {e}")),
            }
        }
    }

    child
        .wait_with_output()
        .map_err(|e| format!("读取 ai-bridge {subcommand} 输出失败: {e}"))
}

pub fn run_enhance_prompt(
    data_dir: &Path,
    config: &CcWorkbenchConfig,
    secrets: &CcWorkbenchSecrets,
    prompt: &str,
    selected_model: Option<&str>,
    selected_model_slot: Option<&str>,
) -> Result<CcEnhancePromptResult, String> {
    let status = collect_status(data_dir);
    if !status.bridge_available {
        return Err("未找到 ai-bridge 脚本".into());
    }
    if !status.node_available {
        return Err("未检测到 Node.js".into());
    }
    if !status.sdk_installed {
        return Err("Claude Agent SDK 未安装".into());
    }

    let resolved = super::providers::resolve_active_provider(config, secrets)?;
    let cwd = resolve_cwd(data_dir, config)?;
    let bridge_script = status.bridge_path.ok_or_else(|| "bridge path missing".to_string())?;
    let ctx = provider_bridge_context(&resolved);
    let mut payload = build_bridge_sidecar_payload(
        &ctx,
        &cwd,
        config.cwd_mode,
        selected_model,
        selected_model_slot,
    );
    if let Some(obj) = payload.as_object_mut() {
        obj.insert("prompt".to_string(), serde_json::Value::String(prompt.to_string()));
        if let Some(custom) = config
            .prompt_enhancer
            .system_prompt
            .as_ref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
        {
            obj.insert(
                "enhanceSystemPrompt".to_string(),
                serde_json::Value::String(custom.to_string()),
            );
        }
    }

    let output = run_bridge_sidecar_timed(
        data_dir,
        &cwd,
        &bridge_script,
        "enhance",
        payload,
        Some(Duration::from_secs(60)),
    )?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut enhanced = String::new();
    let mut error_msg: Option<String> = None;

    for line in stdout.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("[ENHANCED]") {
            enhanced = trimmed
                .strip_prefix("[ENHANCED]")
                .unwrap_or("")
                .replace("{{NEWLINE}}", "\n")
                .trim()
                .to_string();
        } else if let Ok(value) = serde_json::from_str::<serde_json::Value>(trimmed) {
            if value.get("success") == Some(&serde_json::Value::Bool(false)) {
                error_msg = value
                    .get("error")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
            }
        }
    }

    if !enhanced.is_empty() && !enhanced.starts_with("Enhancement failed:") {
        return Ok(CcEnhancePromptResult {
            success: true,
            enhanced_prompt: enhanced,
            error: None,
        });
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    Ok(CcEnhancePromptResult {
        success: false,
        enhanced_prompt: String::new(),
        error: Some(
            error_msg
                .or_else(|| {
                    if !enhanced.is_empty() {
                        Some(enhanced)
                    } else if !stderr.trim().is_empty() {
                        Some(stderr.trim().to_string())
                    } else if output.status.success() {
                        Some("增强失败：模型未返回内容".into())
                    } else {
                        Some(format!(
                            "增强失败 (code={})",
                            output.status.code().unwrap_or(-1)
                        ))
                    }
                })
                .unwrap_or_else(|| "增强失败：未知错误".to_string()),
        ),
    })
}

pub fn run_test_model(
    data_dir: &Path,
    config: &CcWorkbenchConfig,
    secrets: &CcWorkbenchSecrets,
    model: &str,
    model_slot: Option<&str>,
) -> Result<CcModelTestResult, String> {
    let status = collect_status(data_dir);
    if !status.bridge_available {
        return Err("未找到 ai-bridge 脚本".into());
    }
    if !status.node_available {
        return Err("未检测到 Node.js".into());
    }
    if !status.sdk_installed {
        return Err("Claude Agent SDK 未安装".into());
    }

    let resolved = super::providers::resolve_active_provider(config, secrets)?;
    let cwd = resolve_cwd(data_dir, config)?;
    let bridge_script = status.bridge_path.ok_or_else(|| "bridge path missing".to_string())?;
    let ctx = provider_bridge_context(&resolved);
    let payload = build_bridge_sidecar_payload(
        &ctx,
        &cwd,
        config.cwd_mode,
        Some(model),
        model_slot,
    );

    let output = run_bridge_sidecar_timed(
        data_dir,
        &cwd,
        &bridge_script,
        "test-model",
        payload,
        Some(Duration::from_secs(25)),
    )?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        let trimmed = line.trim();
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(trimmed) {
            if value.get("success") == Some(&serde_json::Value::Bool(true)) {
                return Ok(CcModelTestResult {
                    success: true,
                    error: None,
                });
            }
            if value.get("success") == Some(&serde_json::Value::Bool(false)) {
                let error = value
                    .get("error")
                    .and_then(|v| v.as_str())
                    .unwrap_or("模型不可用")
                    .to_string();
                return Ok(CcModelTestResult {
                    success: false,
                    error: Some(error),
                });
            }
        }
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    Ok(CcModelTestResult {
        success: false,
        error: Some(if stderr.trim().is_empty() {
            format!(
                "模型测试失败 (code={})",
                output.status.code().unwrap_or(-1)
            )
        } else {
            stderr.trim().to_string()
        }),
    })
}

fn non_empty_option_opt(value: &Option<String>) -> Option<String> {
    value.as_ref().and_then(|v| non_empty_option(v))
}

fn non_empty_option(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn json_u64(value: Option<&serde_json::Value>) -> u64 {
    let Some(v) = value else {
        return 0;
    };
    if let Some(n) = v.as_u64() {
        return n;
    }
    if let Some(n) = v.as_i64() {
        return n.max(0) as u64;
    }
    if let Some(n) = v.as_f64() {
        if n.is_finite() && n >= 0.0 {
            return n.round() as u64;
        }
    }
    if let Some(s) = v.as_str() {
        if let Ok(n) = s.parse::<u64>() {
            return n;
        }
    }
    0
}

fn json_f64(value: Option<&serde_json::Value>) -> Option<f64> {
    let v = value?;
    if let Some(n) = v.as_f64() {
        return n.is_finite().then_some(n);
    }
    if let Some(n) = v.as_u64() {
        return Some(n as f64);
    }
    if let Some(n) = v.as_i64() {
        return Some(n as f64);
    }
    if let Some(s) = v.as_str() {
        if let Ok(n) = s.parse::<f64>() {
            return n.is_finite().then_some(n);
        }
    }
    None
}

fn parse_bridge_line(line: &str) -> Result<StreamEvent, ()> {
    let value: serde_json::Value = serde_json::from_str(line).map_err(|_| ())?;
    if value.get("success") == Some(&serde_json::Value::Bool(false)) {
        let message = value
            .get("error")
            .or_else(|| value.get("message"))
            .and_then(|v| v.as_str())
            .unwrap_or("ai-bridge 返回失败");
        return Ok(StreamEvent::Error {
            message: message.to_string(),
        });
    }
    let event_type = value.get("type").and_then(|v| v.as_str()).ok_or(())?;
    match event_type {
        "thinking" => Ok(StreamEvent::Thinking {
            content: value
                .get("content")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
        }),
        "token" => Ok(StreamEvent::Token {
            content: value
                .get("content")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
        }),
        "toolCall" => Ok(StreamEvent::ToolCall {
            name: value
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("tool")
                .to_string(),
            input: value
                .get("input")
                .and_then(|v| v.as_str())
                .unwrap_or("{}")
                .to_string(),
            tool_use_id: value
                .get("toolUseId")
                .or_else(|| value.get("tool_use_id"))
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .map(str::to_string),
        }),
        "toolResult" => Ok(StreamEvent::ToolResult {
            name: value
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("tool")
                .to_string(),
            output: value
                .get("output")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            tool_use_id: value
                .get("toolUseId")
                .or_else(|| value.get("tool_use_id"))
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .map(str::to_string),
        }),
        "toolPermission" => Ok(StreamEvent::ToolPermission {
            request_id: value
                .get("requestId")
                .or_else(|| value.get("request_id"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            tool_name: value
                .get("toolName")
                .or_else(|| value.get("tool_name"))
                .and_then(|v| v.as_str())
                .unwrap_or("tool")
                .to_string(),
            input: value
                .get("input")
                .map(|v| {
                    if let Some(s) = v.as_str() {
                        s.to_string()
                    } else {
                        v.to_string()
                    }
                })
                .unwrap_or_else(|| "{}".to_string()),
        }),
        "error" => Ok(StreamEvent::Error {
            message: value
                .get("message")
                .and_then(|v| v.as_str())
                .unwrap_or("未知错误")
                .to_string(),
        }),
        "done" => Ok(StreamEvent::Done),
        "session" => Ok(StreamEvent::Session {
            session_id: value
                .get("sessionId")
                .or_else(|| value.get("session_id"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
        }),
        "usage" => {
            let context_total = json_u64(
                value
                    .get("contextTotalTokens")
                    .or_else(|| value.get("context_total_tokens")),
            );
            let context_max = json_u64(
                value
                    .get("contextMaxTokens")
                    .or_else(|| value.get("context_max_tokens")),
            );
            let context_percentage = json_f64(
                value
                    .get("contextPercentage")
                    .or_else(|| value.get("context_percentage")),
            );
            Ok(StreamEvent::Usage {
                input_tokens: json_u64(
                    value
                        .get("inputTokens")
                        .or_else(|| value.get("input_tokens")),
                ),
                output_tokens: json_u64(
                    value
                        .get("outputTokens")
                        .or_else(|| value.get("output_tokens")),
                ),
                context_total_tokens: (context_total > 0).then_some(context_total),
                context_max_tokens: (context_max > 0).then_some(context_max),
                context_percentage: context_percentage.filter(|pct| *pct > 0.0),
            })
        }
        _ => Err(()),
    }
}
