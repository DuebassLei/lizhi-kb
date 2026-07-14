use std::sync::Arc;

use crate::AppState;

#[derive(Clone)]
pub struct McpRequestSettings {
    pub app_state: Arc<AppState>,
    pub token: String,
    pub write_enabled: bool,
    pub bridge_enabled: bool,
}
