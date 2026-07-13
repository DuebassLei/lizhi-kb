use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct VaultLockoutState {
    pub fail_count: u32,
    pub lockout_until: Option<i64>,
}

pub fn lockout_path(data_dir: &Path) -> PathBuf {
    data_dir.join("vault-lockout.json")
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub fn load(data_dir: &Path) -> VaultLockoutState {
    let path = lockout_path(data_dir);
    if !path.is_file() {
        return VaultLockoutState::default();
    }
    match fs::read_to_string(&path) {
        Ok(raw) => serde_json::from_str(&raw).unwrap_or_default(),
        Err(_) => VaultLockoutState::default(),
    }
}

pub fn save(data_dir: &Path, state: &VaultLockoutState) -> std::io::Result<()> {
    if let Some(parent) = lockout_path(data_dir).parent() {
        fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_string_pretty(state).unwrap_or_default();
    fs::write(lockout_path(data_dir), json)
}

pub fn lockout_seconds_remaining(state: &VaultLockoutState) -> u64 {
    let Some(until) = state.lockout_until else {
        return 0;
    };
    let now = now_ms();
    if now >= until {
        return 0;
    }
    ((until - now) / 1000).max(1) as u64
}

pub fn check_lockout(data_dir: &Path) -> Result<(), u64> {
    let state = load(data_dir);
    let secs = lockout_seconds_remaining(&state);
    if secs > 0 {
        Err(secs)
    } else {
        Ok(())
    }
}

fn brute_force_lock_seconds(fail_count: u32) -> u64 {
    if fail_count >= 10 {
        24 * 60 * 60
    } else if fail_count >= 5 {
        5 * 60
    } else if fail_count >= 3 {
        30
    } else {
        0
    }
}

pub fn record_failure(data_dir: &Path) -> u64 {
    let mut state = load(data_dir);
    state.fail_count = state.fail_count.saturating_add(1);
    let secs = brute_force_lock_seconds(state.fail_count);
    if secs > 0 {
        state.lockout_until = Some(now_ms() + (secs as i64) * 1000);
    }
    let _ = save(data_dir, &state);
    lockout_seconds_remaining(&state)
}

pub fn clear_on_success(data_dir: &Path) {
    let _ = save(data_dir, &VaultLockoutState::default());
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lockout_escalates_and_persists() {
        let dir = std::env::temp_dir().join(format!("lizhi-lockout-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        let s1 = record_failure(&dir);
        assert_eq!(s1, 0);
        let s2 = record_failure(&dir);
        assert_eq!(s2, 0);
        let s3 = record_failure(&dir);
        assert!(s3 >= 29);
        let reloaded = load(&dir);
        assert_eq!(reloaded.fail_count, 3);
        clear_on_success(&dir);
        assert_eq!(load(&dir).fail_count, 0);
        let _ = fs::remove_dir_all(dir);
    }
}
