use std::collections::{HashMap, HashSet};
use std::sync::{LazyLock, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

use super::paths::resolve_bridge_script;
use super::process_utils::{hidden_command, kill_process_tree};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CcBridgeProcessEntry {
    pub pid: u32,
    pub kind: String,
    pub role: String,
    pub started_at_ms: Option<u64>,
    pub command_hint: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CcBridgeProcessList {
    pub processes: Vec<CcBridgeProcessEntry>,
    pub tracked_count: usize,
    pub orphan_count: usize,
}

#[derive(Debug, Clone)]
struct TrackedBridge {
    kind: String,
    started_at_ms: u64,
    is_session: bool,
}

static TRACKED: LazyLock<Mutex<HashMap<u32, TrackedBridge>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

pub fn track_bridge(pid: u32, kind: &str) {
    let is_session = kind == "session";
    if let Ok(mut map) = TRACKED.lock() {
        if is_session {
            map.retain(|_, v| !v.is_session);
        }
        map.insert(
            pid,
            TrackedBridge {
                kind: kind.to_string(),
                started_at_ms: now_ms(),
                is_session,
            },
        );
    }
}

pub fn untrack_bridge(pid: u32) {
    if let Ok(mut map) = TRACKED.lock() {
        map.remove(&pid);
    }
}

pub fn untrack_session() {
    if let Ok(mut map) = TRACKED.lock() {
        map.retain(|_, v| !v.is_session);
    }
}

pub fn session_pid() -> Option<u32> {
    TRACKED.lock().ok().and_then(|map| {
        map.iter()
            .find(|(_, v)| v.is_session)
            .map(|(pid, _)| *pid)
    })
}

/// Pure helper for tests + orphan filter.
pub fn is_lizhi_bridge_cmdline(cmdline: &str, bridge_path_hint: &str) -> bool {
    let lower = cmdline.to_lowercase();
    if !lower.contains("node") {
        return false;
    }
    if !lower.contains("channel-manager.js") {
        return false;
    }
    let hint = bridge_path_hint.replace('\\', "/").to_lowercase();
    let norm = lower.replace('\\', "/");
    if !hint.is_empty() && norm.contains(&hint) {
        return true;
    }
    norm.contains("ai-bridge/channel-manager.js")
}

fn bridge_path_hint() -> String {
    resolve_bridge_script()
        .unwrap_or_default()
        .replace('\\', "/")
        .to_lowercase()
}

fn scan_node_cmdlines() -> Vec<(u32, String)> {
    #[cfg(windows)]
    {
        let output = match hidden_command("wmic")
            .args([
                "process",
                "where",
                "name='node.exe'",
                "get",
                "ProcessId,CommandLine",
                "/FORMAT:CSV",
            ])
            .output()
        {
            Ok(o) if o.status.success() => o,
            _ => return Vec::new(),
        };
        let text = String::from_utf8_lossy(&output.stdout);
        let mut rows = Vec::new();
        for line in text.lines().skip(1) {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            // CSV: Node,CommandLine,ProcessId — PID is last field
            let mut parts = line.rsplitn(2, ',');
            let pid_s = parts.next().unwrap_or("").trim();
            let rest = parts.next().unwrap_or("").trim();
            let cmdline = rest
                .split_once(',')
                .map(|(_, c)| c)
                .unwrap_or(rest)
                .trim();
            if let Ok(pid) = pid_s.parse::<u32>() {
                if !cmdline.is_empty() && cmdline != "CommandLine" {
                    rows.push((pid, cmdline.to_string()));
                }
            }
        }
        rows
    }
    #[cfg(not(windows))]
    {
        let mut rows = Vec::new();
        let Ok(entries) = std::fs::read_dir("/proc") else {
            return rows;
        };
        for entry in entries.flatten() {
            let name = entry.file_name();
            let pid_s = name.to_string_lossy();
            let Ok(pid) = pid_s.parse::<u32>() else {
                continue;
            };
            let cmdline_path = entry.path().join("cmdline");
            let Ok(bytes) = std::fs::read(cmdline_path) else {
                continue;
            };
            let cmdline = bytes
                .split(|b| *b == 0)
                .filter(|s| !s.is_empty())
                .map(|s| String::from_utf8_lossy(s).into_owned())
                .collect::<Vec<_>>()
                .join(" ");
            if cmdline.to_lowercase().contains("node") {
                rows.push((pid, cmdline));
            }
        }
        rows
    }
}

fn shorten_cmdline(cmdline: &str) -> String {
    if cmdline.len() > 160 {
        format!("{}…", &cmdline[..160])
    } else {
        cmdline.to_string()
    }
}

/// Extract subcommand hint from cmdline (send / enhance / test-model).
fn kind_from_cmdline(cmdline: &str) -> Option<&'static str> {
    let lower = cmdline.to_lowercase();
    if lower.contains(" test-model") || lower.ends_with("test-model") {
        return Some("modelTest");
    }
    if lower.contains(" enhance") || lower.ends_with("enhance") {
        return Some("enhance");
    }
    if lower.contains(" send") || lower.ends_with("send") {
        return Some("session");
    }
    None
}

pub fn list_bridge_processes() -> CcBridgeProcessList {
    let hint = bridge_path_hint();
    let tracked_snapshot: Vec<(u32, TrackedBridge)> = TRACKED
        .lock()
        .ok()
        .map(|map| map.iter().map(|(k, v)| (*k, v.clone())).collect())
        .unwrap_or_default();

    let scanned = scan_node_cmdlines();
    let mut cmdline_by_pid: HashMap<u32, String> = HashMap::new();
    for (pid, cmdline) in &scanned {
        if is_lizhi_bridge_cmdline(cmdline, &hint) {
            cmdline_by_pid.insert(*pid, cmdline.clone());
        }
    }

    let mut processes = Vec::new();
    let mut tracked_pids = HashSet::new();

    for (pid, t) in &tracked_snapshot {
        tracked_pids.insert(*pid);
        let command_hint = cmdline_by_pid.get(pid).map(|c| shorten_cmdline(c));
        processes.push(CcBridgeProcessEntry {
            pid: *pid,
            kind: t.kind.clone(),
            role: "tracked".into(),
            started_at_ms: Some(t.started_at_ms),
            command_hint,
        });
    }

    for (pid, cmdline) in scanned {
        if tracked_pids.contains(&pid) {
            continue;
        }
        if !is_lizhi_bridge_cmdline(&cmdline, &hint) {
            continue;
        }
        processes.push(CcBridgeProcessEntry {
            pid,
            kind: kind_from_cmdline(&cmdline)
                .unwrap_or("session")
                .to_string(),
            role: "orphan".into(),
            started_at_ms: None,
            command_hint: Some(shorten_cmdline(&cmdline)),
        });
    }

    let tracked_count = processes.iter().filter(|p| p.role == "tracked").count();
    let orphan_count = processes.iter().filter(|p| p.role == "orphan").count();
    CcBridgeProcessList {
        processes,
        tracked_count,
        orphan_count,
    }
}

/// Kill a tracked or orphan lizhi ai-bridge process. Does not clear session stdin/permissions
/// (caller in commands/runtime should call `clear_session_runtime_state` when killing session).
pub fn kill_bridge_process(pid: u32) -> Result<(), String> {
    let in_tracked = TRACKED.lock().ok().and_then(|map| map.get(&pid).cloned());
    if in_tracked.is_some() {
        kill_process_tree(pid)?;
        untrack_bridge(pid);
        return Ok(());
    }

    let hint = bridge_path_hint();
    let orphan_ok = scan_node_cmdlines()
        .into_iter()
        .any(|(p, cmd)| p == pid && is_lizhi_bridge_cmdline(&cmd, &hint));
    if !orphan_ok {
        return Err("进程不属于狸知 ai-bridge".into());
    }
    kill_process_tree(pid)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::is_lizhi_bridge_cmdline;

    #[test]
    fn matches_resolved_bridge_path() {
        let hint = r"D:\codes\lizhi-kb\packages\ai-bridge\channel-manager.js";
        let cmd = r#"node.exe D:\codes\lizhi-kb\packages\ai-bridge\channel-manager.js claude send"#;
        assert!(is_lizhi_bridge_cmdline(cmd, hint));
    }

    #[test]
    fn rejects_unrelated_node() {
        let hint = r"/home/u/.lizhi-kb/x/channel-manager.js";
        assert!(!is_lizhi_bridge_cmdline("node /tmp/other-app/server.js", hint));
        assert!(!is_lizhi_bridge_cmdline("python channel-manager.js", hint));
    }

    #[test]
    fn matches_ai_bridge_path_segment() {
        let cmd = "node /app/resources/ai-bridge/channel-manager.js claude enhance";
        assert!(is_lizhi_bridge_cmdline(cmd, ""));
    }
}
