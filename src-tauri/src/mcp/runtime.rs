use std::sync::atomic::AtomicU64;
use std::sync::Arc;

use crate::AppState;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum McpMode {
    Bridge,
    Standalone,
}

#[derive(Clone)]
pub struct McpRequestSettings {
    pub app_state: Arc<AppState>,
    pub token: String,
    pub write_enabled: bool,
    pub bridge_enabled: bool,
    pub require_bridge_enabled: bool,
    pub mode: McpMode,
    pub last_activity: Option<Arc<AtomicU64>>,
}

impl McpRequestSettings {
    pub fn touch_activity(&self) {
        if let Some(last) = &self.last_activity {
            let now = chrono::Utc::now().timestamp_millis() as u64;
            last.store(now, std::sync::atomic::Ordering::Relaxed);
        }
    }
}
