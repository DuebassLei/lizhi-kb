use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use crate::AppState;
use crate::vault_lock::{VaultLockGuard, VaultLockError};

use super::config::{self, McpConfig};
use super::handlers;
use super::runtime::{McpMode, McpRequestSettings};

pub struct StandaloneServer {
    _vault_lock: VaultLockGuard,
    settings: Arc<McpRequestSettings>,
    _handle: Mutex<Option<JoinHandle<()>>>,
    _timeout_handle: Mutex<Option<JoinHandle<()>>>,
}

impl StandaloneServer {
    pub fn start(
        app_state: Arc<AppState>,
        mcp_config: McpConfig,
        data_dir: &std::path::Path,
    ) -> Result<Self, String> {
        let vault_lock = VaultLockGuard::acquire(data_dir, "sidecar").map_err(|e| match e {
            VaultLockError::AlreadyHeld => {
                "狸知桌面应用或其他 Sidecar 正在运行，请先关闭后再启动 lizhi-mcpd".to_string()
            }
            VaultLockError::Io(err) => err.to_string(),
        })?;

        let last_activity = Arc::new(AtomicU64::new(chrono::Utc::now().timestamp_millis() as u64));
        let settings = Arc::new(McpRequestSettings {
            app_state: app_state.clone(),
            token: mcp_config.token.clone(),
            write_enabled: mcp_config.write_enabled,
            bridge_enabled: true,
            require_bridge_enabled: false,
            mode: McpMode::Standalone,
            last_activity: Some(last_activity.clone()),
        });

        let port = mcp_config.standalone_port;
        let addr = format!("127.0.0.1:{port}");
        let server = tiny_http::Server::http(&addr).map_err(|e| {
            format!("无法绑定 Sidecar 端口 {port}（仅 127.0.0.1）：{e}")
        })?;

        let settings_for_server = settings.clone();
        let server_handle = thread::Builder::new()
            .name("lizhi-mcp-standalone".into())
            .spawn(move || {
                for request in server.incoming_requests() {
                    handlers::handle_request(request, (*settings_for_server).clone());
                }
            })
            .map_err(|e| e.to_string())?;

        let timeout_minutes = mcp_config.session_timeout_minutes;
        let timeout_handle = if timeout_minutes > 0 {
            Some(spawn_session_timeout(
                app_state,
                last_activity,
                timeout_minutes,
            )?)
        } else {
            None
        };

        eprintln!(
            "lizhi-mcpd 已启动：http://127.0.0.1:{port}（session 超时 {timeout_minutes} 分钟）"
        );

        Ok(Self {
            _vault_lock: vault_lock,
            settings,
            _handle: Mutex::new(Some(server_handle)),
            _timeout_handle: Mutex::new(timeout_handle),
        })
    }

    pub fn settings(&self) -> Arc<McpRequestSettings> {
        self.settings.clone()
    }
}

fn spawn_session_timeout(
    app_state: Arc<AppState>,
    last_activity: Arc<AtomicU64>,
    timeout_minutes: u16,
) -> Result<JoinHandle<()>, String> {
    thread::Builder::new()
        .name("lizhi-mcp-session".into())
        .spawn(move || {
            let timeout_ms = u64::from(timeout_minutes) * 60_000;
            loop {
                thread::sleep(Duration::from_secs(30));
                let last = last_activity.load(Ordering::Relaxed);
                let now = chrono::Utc::now().timestamp_millis() as u64;
                if now.saturating_sub(last) >= timeout_ms {
                    if let Ok(mut vault) = app_state.vault_service.lock() {
                        vault.lock_vault();
                        eprintln!("lizhi-mcpd：session 超时，vault 已锁定");
                    }
                }
            }
        })
        .map_err(|e| e.to_string())
}

pub fn load_mcp_config(data_dir: &std::path::Path) -> Result<McpConfig, String> {
    config::load_config(data_dir)
}
