use std::fs::{File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

use fs4::fs_std::FileExt;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum VaultLockError {
    #[error("VAULT_LOCK_HELD")]
    AlreadyHeld,
    #[error(transparent)]
    Io(#[from] std::io::Error),
}

pub fn lock_path(data_dir: &Path) -> PathBuf {
    let dir_name = data_dir
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("lizhi-kb");
    data_dir
        .parent()
        .unwrap_or(data_dir)
        .join(format!(".{dir_name}.lock"))
}

/// 进程级 vault 独占锁；Drop 时自动释放。
pub struct VaultLockGuard {
    _file: File,
}

impl VaultLockGuard {
    pub fn acquire(data_dir: &Path, role: &str) -> Result<Self, VaultLockError> {
        let path = lock_path(data_dir);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let file = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(true)
            .open(&path)?;

        file.try_lock_exclusive()
            .map_err(|_| VaultLockError::AlreadyHeld)?;

        let mut write_handle = file.try_clone()?;
        writeln!(
            write_handle,
            "pid={}\nrole={role}\n",
            std::process::id()
        )?;

        Ok(Self { _file: file })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Barrier};
    use std::thread;

    #[test]
    fn exclusive_lock_blocks_second_acquire() {
        let dir = std::env::temp_dir().join(format!("lizhi-lock-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let _g1 = VaultLockGuard::acquire(&dir, "test").unwrap();
        assert!(matches!(
            VaultLockGuard::acquire(&dir, "test"),
            Err(VaultLockError::AlreadyHeld)
        ));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn lock_released_after_drop() {
        let dir = std::env::temp_dir().join(format!("lizhi-lock-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        {
            let _g = VaultLockGuard::acquire(&dir, "test").unwrap();
        }
        let _g2 = VaultLockGuard::acquire(&dir, "test").unwrap();
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn parallel_second_thread_fails() {
        let dir = Arc::new(std::env::temp_dir().join(format!(
            "lizhi-lock-test-{}",
            uuid::Uuid::new_v4()
        )));
        std::fs::create_dir_all(dir.as_path()).unwrap();
        let barrier = Arc::new(Barrier::new(2));
        let dir2 = dir.clone();
        let b1 = barrier.clone();
        let t1 = thread::spawn(move || {
            let _g = VaultLockGuard::acquire(dir2.as_path(), "test").unwrap();
            b1.wait();
            std::thread::sleep(std::time::Duration::from_millis(100));
        });
        barrier.wait();
        assert!(matches!(
            VaultLockGuard::acquire(dir.as_path(), "test"),
            Err(VaultLockError::AlreadyHeld)
        ));
        t1.join().unwrap();
        let _ = std::fs::remove_dir_all(dir.as_path());
    }
}
