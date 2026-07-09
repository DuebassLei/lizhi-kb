use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const UI_STATE_FILENAME: &str = "vault-ui-state.json";
pub const AI_CONFIG_FILENAME: &str = "ai-config.json";
pub const AI_SECRETS_FILENAME: &str = "ai-secrets.json";
pub const MCP_CONFIG_FILENAME: &str = "mcp-config.json";

pub const OPTIONAL_BACKUP_FILES: &[&str] = &[
    AI_CONFIG_FILENAME,
    AI_SECRETS_FILENAME,
    MCP_CONFIG_FILENAME,
    UI_STATE_FILENAME,
];

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct VaultUiState {
    #[serde(default = "default_schema_version")]
    pub schema_version: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub folders: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub document_tags: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub chat_sessions: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub insights_hero_background: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub graph_node_positions: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pinned_doc_ids: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recent_doc_ids: Option<Value>,
}

fn default_schema_version() -> u32 {
    2
}

mod document_ui;

pub use document_ui::{get_document_tags, get_folder_tree, list_all_tags, set_document_tags};

pub fn ui_state_path(data_dir: &Path) -> PathBuf {
    data_dir.join(UI_STATE_FILENAME)
}

pub fn load_ui_state(data_dir: &Path) -> Result<VaultUiState, String> {
    let path = ui_state_path(data_dir);
    if !path.is_file() {
        return Ok(VaultUiState::default());
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

pub fn save_ui_state(data_dir: &Path, state: &VaultUiState) -> Result<(), String> {
    let path = ui_state_path(data_dir);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(state).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

/// 合并备份中的 UI 状态到当前库（用于 `merge` 导入模式）。
pub fn merge_ui_state(existing: &VaultUiState, incoming: &VaultUiState) -> VaultUiState {
    let mut merged = existing.clone();
    merged.schema_version = incoming.schema_version.max(existing.schema_version);

    if let (Some(base), Some(patch)) = (&existing.folders, &incoming.folders) {
        merged.folders = Some(merge_folders_value(base, patch));
    } else if incoming.folders.is_some() {
        merged.folders = incoming.folders.clone();
    }

    if let (Some(base), Some(patch)) = (&existing.document_tags, &incoming.document_tags) {
        merged.document_tags = Some(merge_document_tags_value(base, patch));
    } else if incoming.document_tags.is_some() {
        merged.document_tags = incoming.document_tags.clone();
    }

    if let (Some(base), Some(patch)) = (&existing.chat_sessions, &incoming.chat_sessions) {
        merged.chat_sessions = Some(merge_chat_sessions_value(base, patch));
    } else if incoming.chat_sessions.is_some() {
        merged.chat_sessions = incoming.chat_sessions.clone();
    }

    merged.insights_hero_background = incoming
        .insights_hero_background
        .clone()
        .or(existing.insights_hero_background.clone());

    if let (Some(base), Some(patch)) = (&existing.graph_node_positions, &incoming.graph_node_positions) {
        merged.graph_node_positions = Some(merge_object_maps(base, patch));
    } else if incoming.graph_node_positions.is_some() {
        merged.graph_node_positions = incoming.graph_node_positions.clone();
    }

    if let (Some(base), Some(patch)) = (&existing.pinned_doc_ids, &incoming.pinned_doc_ids) {
        merged.pinned_doc_ids = Some(merge_string_arrays(base, patch));
    } else if incoming.pinned_doc_ids.is_some() {
        merged.pinned_doc_ids = incoming.pinned_doc_ids.clone();
    }

    if let (Some(base), Some(patch)) = (&existing.recent_doc_ids, &incoming.recent_doc_ids) {
        merged.recent_doc_ids = Some(merge_string_arrays_limited(base, patch, 12));
    } else if incoming.recent_doc_ids.is_some() {
        merged.recent_doc_ids = incoming.recent_doc_ids.clone();
    }

    merged
}

fn merge_folders_value(base: &Value, patch: &Value) -> Value {
    let mut out = base.clone();
    let Some(out_obj) = out.as_object_mut() else {
        return patch.clone();
    };
    let Some(patch_obj) = patch.as_object() else {
        return out;
    };

    if let (Some(base_folders), Some(patch_folders)) =
        (out_obj.get("folders"), patch_obj.get("folders"))
    {
        out_obj.insert("folders".into(), merge_folder_meta_array(base_folders, patch_folders));
    } else if let Some(patch_folders) = patch_obj.get("folders") {
        out_obj.insert("folders".into(), patch_folders.clone());
    }

    merge_string_map_array_field(out_obj, patch_obj, "folderOrder");
    merge_string_map_array_field(out_obj, patch_obj, "order");
    merge_bool_map_field(out_obj, patch_obj, "expanded");

    out
}

fn merge_folder_meta_array(base: &Value, patch: &Value) -> Value {
    let mut by_id: HashMap<String, Value> = HashMap::new();
    if let Some(items) = base.as_array() {
        for item in items {
            if let Some(id) = item.get("id").and_then(|v| v.as_str()) {
                by_id.insert(id.to_string(), item.clone());
            }
        }
    }
    if let Some(items) = patch.as_array() {
        for item in items {
            if let Some(id) = item.get("id").and_then(|v| v.as_str()) {
                by_id.insert(id.to_string(), item.clone());
            }
        }
    }
    Value::Array(by_id.into_values().collect())
}

fn merge_string_map_array_field(
    out_obj: &mut serde_json::Map<String, Value>,
    patch_obj: &serde_json::Map<String, Value>,
    key: &str,
) {
    let Some(patch_map) = patch_obj.get(key).and_then(|v| v.as_object()) else {
        return;
    };
    let base_map = out_obj
        .get(key)
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default();
    let mut merged_map = base_map;
    for (folder_key, patch_ids) in patch_map {
        let patch_arr = patch_ids
            .as_array()
            .map(|a| {
                a.iter()
                    .filter_map(|v| v.as_str().map(str::to_string))
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        let base_arr = merged_map
            .get(folder_key)
            .and_then(|v| v.as_array())
            .map(|a| {
                a.iter()
                    .filter_map(|v| v.as_str().map(str::to_string))
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        let mut seen: HashSet<String> = base_arr.iter().cloned().collect();
        let mut combined = base_arr;
        for id in patch_arr {
            if seen.insert(id.clone()) {
                combined.push(id);
            }
        }
        merged_map.insert(
            folder_key.clone(),
            Value::Array(combined.into_iter().map(Value::String).collect()),
        );
    }
    out_obj.insert(key.into(), Value::Object(merged_map));
}

fn merge_bool_map_field(
    out_obj: &mut serde_json::Map<String, Value>,
    patch_obj: &serde_json::Map<String, Value>,
    key: &str,
) {
    let Some(patch_map) = patch_obj.get(key).and_then(|v| v.as_object()) else {
        return;
    };
    let mut base_map = out_obj
        .get(key)
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default();
    for (k, v) in patch_map {
        base_map.insert(k.clone(), v.clone());
    }
    out_obj.insert(key.into(), Value::Object(base_map));
}

fn merge_document_tags_value(base: &Value, patch: &Value) -> Value {
    let mut out: HashMap<String, HashSet<String>> = HashMap::new();
    for source in [base, patch] {
        let Some(map) = source.as_object() else {
            continue;
        };
        for (doc_id, tags_val) in map {
            let entry = out.entry(doc_id.clone()).or_default();
            if let Some(arr) = tags_val.as_array() {
                for tag in arr {
                    if let Some(s) = tag.as_str() {
                        if !s.is_empty() {
                            entry.insert(s.to_string());
                        }
                    }
                }
            }
        }
    }
    let obj: serde_json::Map<String, Value> = out
        .into_iter()
        .map(|(k, set)| {
            let mut tags: Vec<_> = set.into_iter().collect();
            tags.sort();
            (k, Value::Array(tags.into_iter().map(Value::String).collect()))
        })
        .collect();
    Value::Object(obj)
}

fn merge_object_maps(base: &Value, patch: &Value) -> Value {
    let mut out = base
        .as_object()
        .cloned()
        .unwrap_or_default();
    if let Some(patch_obj) = patch.as_object() {
        for (k, v) in patch_obj {
            out.insert(k.clone(), v.clone());
        }
    }
    Value::Object(out)
}

fn merge_string_arrays(base: &Value, patch: &Value) -> Value {
    merge_string_arrays_limited(base, patch, usize::MAX)
}

fn merge_string_arrays_limited(base: &Value, patch: &Value, max: usize) -> Value {
    let mut seen = HashSet::new();
    let mut combined = Vec::new();
    for source in [base, patch] {
        if let Some(arr) = source.as_array() {
            for item in arr {
                if let Some(s) = item.as_str() {
                    if seen.insert(s.to_string()) {
                        combined.push(Value::String(s.to_string()));
                        if combined.len() >= max {
                            return Value::Array(combined);
                        }
                    }
                }
            }
        }
    }
    Value::Array(combined)
}

fn merge_chat_sessions_value(base: &Value, patch: &Value) -> Value {
    let mut out = base.clone();
    let Some(out_obj) = out.as_object_mut() else {
        return patch.clone();
    };
    let Some(patch_obj) = patch.as_object() else {
        return out;
    };
    for surface in ["workspace", "standalone"] {
        let Some(patch_bundle) = patch_obj.get(surface) else {
            continue;
        };
        let base_bundle = out_obj.get(surface).cloned().unwrap_or(Value::Null);
        out_obj.insert(surface.into(), merge_chat_surface_bundle(&base_bundle, patch_bundle));
    }
    out
}

fn merge_chat_surface_bundle(base: &Value, patch: &Value) -> Value {
    let mut sessions_by_id: HashMap<String, Value> = HashMap::new();
    if let Some(arr) = base
        .as_object()
        .and_then(|o| o.get("sessions"))
        .and_then(|v| v.as_array())
    {
        for s in arr {
            if let Some(id) = s.get("id").and_then(|v| v.as_str()) {
                sessions_by_id.insert(id.to_string(), s.clone());
            }
        }
    }
    if let Some(arr) = patch
        .as_object()
        .and_then(|o| o.get("sessions"))
        .and_then(|v| v.as_array())
    {
        for s in arr {
            let Some(id) = s.get("id").and_then(|v| v.as_str()) else {
                continue;
            };
            let incoming_updated = s.get("updatedAt").and_then(|v| v.as_i64()).unwrap_or(0);
            if let Some(existing) = sessions_by_id.get(id) {
                let existing_updated = existing
                    .get("updatedAt")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0);
                if incoming_updated >= existing_updated {
                    sessions_by_id.insert(id.to_string(), s.clone());
                }
            } else {
                sessions_by_id.insert(id.to_string(), s.clone());
            }
        }
    }
    let mut sessions: Vec<Value> = sessions_by_id.into_values().collect();
    sessions.sort_by(|a, b| {
        let ta = a.get("updatedAt").and_then(|v| v.as_i64()).unwrap_or(0);
        let tb = b.get("updatedAt").and_then(|v| v.as_i64()).unwrap_or(0);
        tb.cmp(&ta)
    });
    sessions.truncate(50);
    let active_id = patch
        .as_object()
        .and_then(|o| o.get("activeId"))
        .and_then(|v| v.as_str())
        .filter(|id| sessions.iter().any(|s| s.get("id").and_then(|v| v.as_str()) == Some(*id)))
        .or_else(|| {
            base.as_object()
                .and_then(|o| o.get("activeId"))
                .and_then(|v| v.as_str())
                .filter(|id| sessions.iter().any(|s| s.get("id").and_then(|v| v.as_str()) == Some(*id)))
        })
        .map(|s| Value::String(s.to_string()));
    serde_json::json!({
        "activeId": active_id,
        "sessions": sessions
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn merge_document_tags_unions_per_doc() {
        let base = serde_json::json!({ "a": ["x"], "b": ["y"] });
        let patch = serde_json::json!({ "a": ["y", "z"], "c": ["t"] });
        let merged = merge_document_tags_value(&base, &patch);
        assert_eq!(
            merged,
            serde_json::json!({ "a": ["x", "y", "z"], "b": ["y"], "c": ["t"] })
        );
    }

    #[test]
    fn merge_folders_by_id_prefers_patch_label() {
        let base = serde_json::json!({
            "folders": [{ "id": "projects/foo", "label": "旧名", "parentId": "projects" }],
            "folderOrder": { "projects": ["projects/foo"] },
            "order": {},
            "expanded": { "inbox": true }
        });
        let patch = serde_json::json!({
            "folders": [{ "id": "projects/foo", "label": "新名", "parentId": "projects" }],
            "folderOrder": { "projects": ["projects/bar", "projects/foo"] },
            "order": { "inbox": ["d2", "d1"] },
            "expanded": { "projects": true }
        });
        let merged = merge_folders_value(&base, &patch);
        let folders = merged["folders"].as_array().unwrap();
        assert_eq!(folders.len(), 1);
        assert_eq!(folders[0]["label"], "新名");
        let order = merged["folderOrder"]["projects"].as_array().unwrap();
        assert_eq!(order.len(), 2);
        assert_eq!(order[0], "projects/foo");
    }
}
