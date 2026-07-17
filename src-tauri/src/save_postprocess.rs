//! 自动保存后的重活：未链接扫描 + revision，合并调度避免打字卡顿。

use std::collections::HashMap;
use std::sync::{Arc, LazyLock, Mutex};
use std::thread;
use std::time::Duration;

use crate::crypto::DEK_LEN;
use crate::AppState;

const COALESCE_MS: u64 = 120;

#[derive(Clone)]
struct PendingJob {
    generation: u64,
    content: String,
    dek: Option<[u8; DEK_LEN]>,
}

static PENDING: LazyLock<Mutex<HashMap<String, PendingJob>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// 合并同一文档的连续保存；仅最新一代会真正跑重索引。
pub fn schedule(app: Arc<AppState>, doc_id: String, content: String, dek: Option<[u8; DEK_LEN]>) {
    let generation = {
        let Ok(mut map) = PENDING.lock() else {
            return;
        };
        let entry = map.entry(doc_id.clone()).or_insert(PendingJob {
            generation: 0,
            content: String::new(),
            dek: None,
        });
        entry.generation = entry.generation.saturating_add(1);
        entry.content = content;
        entry.dek = dek;
        entry.generation
    };

    thread::spawn(move || {
        thread::sleep(Duration::from_millis(COALESCE_MS));

        let job = {
            let Ok(map) = PENDING.lock() else {
                return;
            };
            map.get(&doc_id).cloned()
        };
        let Some(job) = job else {
            return;
        };
        if job.generation != generation {
            return;
        }

        {
            let Ok(mut map) = PENDING.lock() else {
                return;
            };
            if map.get(&doc_id).map(|j| j.generation) != Some(generation) {
                return;
            }
            map.remove(&doc_id);
        }

        let Ok(svc) = app.document_service.lock() else {
            return;
        };
        let _ = svc.complete_deferred_save_index(&doc_id, &job.content, job.dek.as_ref());
    });
}
