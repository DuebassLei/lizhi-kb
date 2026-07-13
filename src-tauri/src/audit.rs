use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditEvent {
    pub id: String,
    pub event_type: String,
    pub detail: Option<String>,
    pub created_at: i64,
}

fn audit_path(data_dir: &Path) -> PathBuf {
    data_dir.join("audit-events.jsonl")
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub fn log_event(data_dir: &Path, event_type: &str, detail: Option<&str>) -> std::io::Result<()> {
    let path = audit_path(data_dir);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let event = AuditEvent {
        id: uuid::Uuid::new_v4().to_string(),
        event_type: event_type.to_string(),
        detail: detail.map(str::to_string),
        created_at: now_ms(),
    };
    let line = serde_json::to_string(&event).unwrap_or_default();
    let mut file = OpenOptions::new().create(true).append(true).open(path)?;
    writeln!(file, "{line}")?;
    Ok(())
}

pub fn list_events(data_dir: &Path, limit: usize) -> Vec<AuditEvent> {
    let path = audit_path(data_dir);
    if !path.is_file() {
        return Vec::new();
    }
    let file = match fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return Vec::new(),
    };
    let reader = BufReader::new(file);
    let mut events: Vec<AuditEvent> = reader
        .lines()
        .map_while(Result::ok)
        .filter_map(|line| serde_json::from_str(&line).ok())
        .collect();
    events.sort_by_key(|b| std::cmp::Reverse(b.created_at));
    events.truncate(limit);
    events
}
