use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use crate::AppState;

use super::config::{self, McpConfig};
use super::handlers;

struct BridgeThread {
    shutdown: Arc<AtomicBool>,
    port: u16,
    handle: JoinHandle<()>,
}

pub struct McpBridge {
    config: Arc<Mutex<McpConfig>>,
    runtime: Mutex<Option<BridgeThread>>,
    app_state: Arc<AppState>,
}

impl McpBridge {
    pub fn new(app_state: Arc<AppState>) -> Result<Self, String> {
        let data_dir = crate::db::data_dir().map_err(|e| e.to_string())?;
        let config = config::load_config(&data_dir)?;
        Ok(Self {
            config: Arc::new(Mutex::new(config)),
            runtime: Mutex::new(None),
            app_state,
        })
    }

    pub fn start_if_needed(&self) -> Result<(), String> {
        let enabled = self
            .config
            .lock()
            .map_err(|_| "config lock poisoned".to_string())?
            .enabled;
        if enabled {
            self.ensure_running()?;
        }
        Ok(())
    }

    fn stop_bridge(&self) -> Result<(), String> {
        let mut runtime = self
            .runtime
            .lock()
            .map_err(|_| "runtime lock poisoned".to_string())?;
        if let Some(thread) = runtime.take() {
            thread.shutdown.store(true, Ordering::Relaxed);
            thread
                .handle
                .join()
                .map_err(|_| "MCP bridge 线程 join 失败".to_string())?;
        }
        Ok(())
    }

    pub fn ensure_running(&self) -> Result<(), String> {
        let port = self
            .config
            .lock()
            .map_err(|_| "config lock poisoned".to_string())?
            .port;

        {
            let runtime = self
                .runtime
                .lock()
                .map_err(|_| "runtime lock poisoned".to_string())?;
            if runtime.as_ref().is_some_and(|t| t.port == port) {
                return Ok(());
            }
        }

        self.stop_bridge()?;

        let addr = format!("127.0.0.1:{port}");
        let server = tiny_http::Server::http(&addr).map_err(|e| {
            format!("无法绑定 MCP 端口 {port}（仅 127.0.0.1）：{e}")
        })?;

        let app_state = self.app_state.clone();
        let config = self.config.clone();
        let shutdown = Arc::new(AtomicBool::new(false));
        let shutdown_for_loop = shutdown.clone();

        let join = thread::Builder::new()
            .name("lizhi-mcp-bridge".into())
            .spawn(move || {
                while !shutdown_for_loop.load(Ordering::Relaxed) {
                    match server.recv_timeout(Duration::from_millis(200)) {
                        Ok(Some(request)) => {
                            handlers::handle_bridge_request(
                                request,
                                app_state.clone(),
                                config.clone(),
                            );
                        }
                        Ok(None) => {}
                        Err(_) => break,
                    }
                }
            })
            .map_err(|e| e.to_string())?;

        let mut runtime = self
            .runtime
            .lock()
            .map_err(|_| "runtime lock poisoned".to_string())?;
        *runtime = Some(BridgeThread {
            shutdown,
            port,
            handle: join,
        });
        Ok(())
    }

    pub fn reload_config(&self, updated: McpConfig) -> Result<(), String> {
        let (was_enabled, old_port) = {
            let config = self
                .config
                .lock()
                .map_err(|_| "config lock poisoned".to_string())?;
            (config.enabled, config.port)
        };

        {
            let mut config = self
                .config
                .lock()
                .map_err(|_| "config lock poisoned".to_string())?;
            *config = updated.clone();
        }

        if !updated.enabled {
            self.stop_bridge()?;
            return Ok(());
        }

        if !was_enabled || old_port != updated.port {
            self.stop_bridge()?;
        }

        self.ensure_running()
    }

    pub fn get_config(&self) -> Result<McpConfig, String> {
        self.config
            .lock()
            .map(|c| c.clone())
            .map_err(|_| "config lock poisoned".to_string())
    }
}
