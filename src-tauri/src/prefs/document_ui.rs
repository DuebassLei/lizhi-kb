use std::collections::HashSet;
use std::path::Path;

use serde_json::{json, Map, Value};

use super::{load_ui_state, save_ui_state};

const FOLDER_INBOX: &str = "inbox";
const FOLDER_PROJECTS: &str = "projects";

/// 与前端 `slugifyFolderName` 对齐（ASCII 小写 + 保留汉字）。
pub fn slugify_folder_name(name: &str) -> String {
    let lowered: String = name.trim().chars().flat_map(|c| c.to_lowercase()).collect();
    let spaced = lowered.split_whitespace().collect::<Vec<_>>().join("-");
    let mut out = String::new();
    for c in spaced.chars() {
        let ok = c.is_ascii_alphanumeric()
            || c == '_'
            || c == '-'
            || ('\u{4e00}'..='\u{9fff}').contains(&c);
        if ok {
            out.push(c);
        }
    }
    let clipped: String = out.chars().take(32).collect();
    if clipped.is_empty() {
        "folder".into()
    } else {
        clipped
    }
}

/// 规范化文档 folder id：系统根须为 inbox/projects；其余段做 slugify。
/// 若首段不是系统根，自动挂到 `projects/` 下。
pub fn normalize_folder_id(folder: &str) -> String {
    let mut parts: Vec<String> = folder
        .split('/')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .collect();

    if parts.is_empty() {
        return FOLDER_INBOX.to_string();
    }

    if parts[0] != FOLDER_INBOX && parts[0] != FOLDER_PROJECTS {
        parts.insert(0, FOLDER_PROJECTS.to_string());
    }

    let mut out = vec![parts[0].clone()];
    for seg in parts.iter().skip(1) {
        out.push(slugify_folder_name(seg));
    }
    out.join("/")
}

fn system_folders() -> Vec<Value> {
    vec![
        json!({
            "id": FOLDER_INBOX,
            "label": "收件箱",
            "parentId": null,
            "system": true
        }),
        json!({
            "id": FOLDER_PROJECTS,
            "label": "知识库",
            "parentId": null,
            "system": true
        }),
    ]
}

fn empty_folder_tree() -> Value {
    json!({
        "folders": system_folders(),
        "folderOrder": {},
        "order": {},
        "expanded": {
            "inbox": true,
            "projects": true
        }
    })
}

fn folder_id_set(folders: &[Value]) -> HashSet<String> {
    folders
        .iter()
        .filter_map(|f| f.get("id").and_then(|v| v.as_str()).map(str::to_string))
        .collect()
}

fn append_folder_order(tree: &mut Map<String, Value>, parent_id: &str, child_id: &str) {
    let folder_order = tree
        .entry("folderOrder".to_string())
        .or_insert_with(|| json!({}))
        .as_object_mut();
    let Some(order_map) = folder_order else {
        return;
    };
    let list = order_map
        .entry(parent_id.to_string())
        .or_insert_with(|| json!([]));
    let Some(arr) = list.as_array_mut() else {
        *list = json!([child_id]);
        return;
    };
    let exists = arr.iter().any(|v| v.as_str() == Some(child_id));
    if !exists {
        arr.push(Value::String(child_id.to_string()));
    }
}

fn set_expanded(tree: &mut Map<String, Value>, folder_id: &str) {
    let expanded = tree
        .entry("expanded".to_string())
        .or_insert_with(|| json!({}))
        .as_object_mut();
    if let Some(map) = expanded {
        map.insert(folder_id.to_string(), Value::Bool(true));
    }
}

/// 确保 `folder` 路径上每一级都注册到侧栏树；返回规范化后的 folder id 与最新树。
pub fn ensure_folder_path(data_dir: &Path, folder: &str) -> Result<(String, Value), String> {
    let normalized = normalize_folder_id(folder);
    let mut state = load_ui_state(data_dir)?;
    let mut tree = state
        .folders
        .unwrap_or_else(empty_folder_tree)
        .as_object()
        .cloned()
        .unwrap_or_else(|| empty_folder_tree().as_object().cloned().unwrap());

    let mut folders = tree
        .get("folders")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    // 合并系统根
    let existing_ids = folder_id_set(&folders);
    for sys in system_folders() {
        let id = sys.get("id").and_then(|v| v.as_str()).unwrap_or_default();
        if !existing_ids.contains(id) {
            folders.push(sys);
        }
    }

    let parts: Vec<&str> = normalized.split('/').filter(|s| !s.is_empty()).collect();
    if parts.is_empty() {
        tree.insert("folders".into(), Value::Array(folders));
        let value = Value::Object(tree);
        state.folders = Some(value.clone());
        save_ui_state(data_dir, &state)?;
        return Ok((FOLDER_INBOX.to_string(), value));
    }

    // 原始路径段（用于 label）；与 normalized 同结构
    let raw_parts: Vec<String> = {
        let mut raw: Vec<String> = folder
            .split('/')
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .collect();
        if raw.is_empty() {
            raw.push(FOLDER_INBOX.to_string());
        } else if raw[0] != FOLDER_INBOX && raw[0] != FOLDER_PROJECTS {
            raw.insert(0, FOLDER_PROJECTS.to_string());
        }
        // 对齐长度：根保持，后续段用原始文案作 label
        if raw.len() < parts.len() {
            while raw.len() < parts.len() {
                raw.push(parts[raw.len()].to_string());
            }
        }
        raw
    };

    let mut known = folder_id_set(&folders);
    let mut created: Vec<String> = Vec::new();

    for i in 0..parts.len() {
        let id = parts[..=i].join("/");
        if known.contains(&id) {
            continue;
        }
        let parent_id = if i == 0 {
            None
        } else {
            Some(parts[..i].join("/"))
        };
        let label = if i == 0 {
            if id == FOLDER_INBOX {
                "收件箱".to_string()
            } else {
                "知识库".to_string()
            }
        } else {
            raw_parts
                .get(i)
                .cloned()
                .unwrap_or_else(|| parts[i].to_string())
        };
        let meta = if parent_id.is_none() {
            json!({
                "id": id,
                "label": label,
                "parentId": null,
                "system": true
            })
        } else {
            json!({
                "id": id,
                "label": label,
                "parentId": parent_id.as_deref().unwrap()
            })
        };
        folders.push(meta);
        known.insert(id.clone());
        created.push(id.clone());
        if let Some(parent) = parent_id {
            append_folder_order(&mut tree, &parent, &id);
            set_expanded(&mut tree, &parent);
        } else {
            append_folder_order(&mut tree, "__root__", &id);
        }
        set_expanded(&mut tree, &id);
    }

    tree.insert("folders".into(), Value::Array(folders));
    let value = Value::Object(tree);
    state.folders = Some(value.clone());
    save_ui_state(data_dir, &state)?;

    let _ = created; // 供调用方日志；响应体返回完整树即可
    Ok((normalized, value))
}

/// 文件夹的上级路径；根目录返回 `None`。
pub fn parent_folder_id(folder: &str) -> Option<String> {
    let folder = folder.trim().trim_matches('/');
    match folder.rsplit_once('/') {
        Some((parent, _)) if !parent.is_empty() => Some(parent.to_string()),
        _ => None,
    }
}

/// 从侧栏树删除目录（含子孙）。不可删 `inbox` / `projects`。
/// 返回：(规范化路径, 被移除的 id 列表, 最新树)。
pub fn delete_folder_path(data_dir: &Path, folder: &str) -> Result<(String, Vec<String>, Value), String> {
    let normalized = normalize_folder_id(folder);
    if normalized == FOLDER_INBOX || normalized == FOLDER_PROJECTS {
        return Err("不能删除系统根目录 inbox / projects".into());
    }

    let mut state = load_ui_state(data_dir)?;
    let mut tree = state
        .folders
        .take()
        .unwrap_or_else(empty_folder_tree);
    let Some(tree_obj) = tree.as_object_mut() else {
        return Err("folders UI 状态格式无效".into());
    };

    let removed = remove_folders_from_tree(tree_obj, &normalized)?;
    if removed.is_empty() {
        // 树里本来就没有：仍返回当前树，便于幂等清理
        let value = Value::Object(tree_obj.clone());
        state.folders = Some(value.clone());
        save_ui_state(data_dir, &state)?;
        return Ok((normalized, removed, value));
    }

    let value = Value::Object(tree_obj.clone());
    state.folders = Some(value.clone());
    save_ui_state(data_dir, &state)?;
    Ok((normalized, removed, value))
}

/// 删除 `start` 及其空祖先链（无子文件夹登记时向上清理，直到系统根）。
pub fn prune_empty_folder_chain(data_dir: &Path, start: &str) -> Result<Vec<String>, String> {
    let mut pruned = Vec::new();
    let mut cursor = Some(normalize_folder_id(start));
    while let Some(id) = cursor {
        if id == FOLDER_INBOX || id == FOLDER_PROJECTS {
            break;
        }
        let tree = get_folder_tree(data_dir)?;
        let has_child = tree
            .get("folders")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter().any(|f| {
                    f.get("parentId").and_then(|v| v.as_str()) == Some(id.as_str())
                })
            })
            .unwrap_or(false);
        let exists = tree
            .get("folders")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().any(|f| f.get("id").and_then(|v| v.as_str()) == Some(id.as_str())))
            .unwrap_or(false);

        let parent = parent_folder_id(&id);
        if exists && !has_child {
            let (_, removed, _) = delete_folder_path(data_dir, &id)?;
            pruned.extend(removed);
        } else if exists && has_child {
            break;
        }
        cursor = parent;
    }
    Ok(pruned)
}

fn remove_folders_from_tree(
    tree_obj: &mut Map<String, Value>,
    root_id: &str,
) -> Result<Vec<String>, String> {
    let Some(folders) = tree_obj.get_mut("folders").and_then(|v| v.as_array_mut()) else {
        return Ok(Vec::new());
    };

    let remove_ids: Vec<String> = folders
        .iter()
        .filter_map(|f| f.get("id").and_then(|v| v.as_str()).map(str::to_string))
        .filter(|id| id == root_id || id.starts_with(&format!("{root_id}/")))
        .collect();

    if remove_ids.is_empty() {
        return Ok(remove_ids);
    }

    let remove_set: HashSet<&str> = remove_ids.iter().map(String::as_str).collect();
    folders.retain(|f| {
        f.get("id")
            .and_then(|v| v.as_str())
            .map(|id| !remove_set.contains(id))
            .unwrap_or(true)
    });

    // 清理 folderOrder / order / expanded
    for key in ["folderOrder", "order", "expanded"] {
        scrub_tree_map_keys(tree_obj, key, &remove_set);
    }

    // 从各父级 folderOrder 列表中去掉已删 id
    if let Some(order_map) = tree_obj
        .get_mut("folderOrder")
        .and_then(|v| v.as_object_mut())
    {
        for (_parent, list) in order_map.iter_mut() {
            if let Some(arr) = list.as_array_mut() {
                arr.retain(|v| {
                    v.as_str()
                        .map(|id| !remove_set.contains(id))
                        .unwrap_or(true)
                });
            }
        }
    }

    Ok(remove_ids)
}

fn scrub_tree_map_keys(tree: &mut Map<String, Value>, field: &str, remove_set: &HashSet<&str>) {
    let Some(map_val) = tree.get(field).cloned() else {
        return;
    };
    let Some(map) = map_val.as_object() else {
        return;
    };
    let mut next = Map::new();
    for (key, val) in map {
        if remove_set.contains(key.as_str()) {
            continue;
        }
        if let Some(arr) = val.as_array() {
            let filtered: Vec<Value> = arr
                .iter()
                .filter(|v| {
                    v.as_str()
                        .map(|id| !remove_set.contains(id))
                        .unwrap_or(true)
                })
                .cloned()
                .collect();
            next.insert(key.clone(), Value::Array(filtered));
        } else {
            next.insert(key.clone(), val.clone());
        }
    }
    tree.insert(field.into(), Value::Object(next));
}

fn remap_folder_id(id: &str, old_prefix: &str, new_prefix: &str) -> String {
    if id == old_prefix {
        new_prefix.to_string()
    } else if let Some(rest) = id.strip_prefix(&format!("{old_prefix}/")) {
        format!("{new_prefix}/{rest}")
    } else {
        id.to_string()
    }
}

/// 同步侧栏树上的 folder 前缀迁移（与文档 migrate 对齐）。
pub fn migrate_folder_prefix_in_tree(
    data_dir: &Path,
    old_prefix: &str,
    new_prefix: &str,
) -> Result<Value, String> {
    let old_prefix = normalize_folder_id(old_prefix);
    let new_prefix = normalize_folder_id(new_prefix);
    if old_prefix == new_prefix {
        return get_folder_tree(data_dir);
    }

    // 确保目标前缀路径存在
    let (_, mut tree) = ensure_folder_path(data_dir, &new_prefix)?;
    let mut state = load_ui_state(data_dir)?;

    let Some(tree_obj) = tree.as_object_mut() else {
        return Ok(tree);
    };

    if let Some(folders) = tree_obj.get_mut("folders").and_then(|v| v.as_array_mut()) {
        for item in folders.iter_mut() {
            let Some(obj) = item.as_object_mut() else {
                continue;
            };
            if let Some(id) = obj.get("id").and_then(|v| v.as_str()) {
                let new_id = remap_folder_id(id, &old_prefix, &new_prefix);
                if new_id != id {
                    obj.insert("id".into(), Value::String(new_id));
                }
            }
            if let Some(parent) = obj.get("parentId").and_then(|v| v.as_str()) {
                let new_parent = remap_folder_id(parent, &old_prefix, &new_prefix);
                if new_parent != parent {
                    obj.insert("parentId".into(), Value::String(new_parent));
                }
            }
        }
        // 去重：同 id 保留后者
        let mut by_id: std::collections::HashMap<String, Value> =
            std::collections::HashMap::new();
        for item in folders.drain(..) {
            if let Some(id) = item.get("id").and_then(|v| v.as_str()) {
                by_id.insert(id.to_string(), item);
            }
        }
        *folders = by_id.into_values().collect();
    }

    for key in ["folderOrder", "order", "expanded"] {
        remap_tree_map_keys(tree_obj, key, &old_prefix, &new_prefix);
    }

    let value = Value::Object(tree_obj.clone());
    state.folders = Some(value.clone());
    save_ui_state(data_dir, &state)?;

    // 迁移后旧前缀已重命名；清理可能残留的空祖先（如只迁走子夹留下的空父夹）
    if let Some(parent) = parent_folder_id(&old_prefix) {
        let _ = prune_empty_folder_chain(data_dir, &parent);
    }

    get_folder_tree(data_dir)
}

fn remap_tree_map_keys(
    tree: &mut Map<String, Value>,
    field: &str,
    old_prefix: &str,
    new_prefix: &str,
) {
    let Some(map_val) = tree.get(field).cloned() else {
        return;
    };
    let Some(map) = map_val.as_object() else {
        return;
    };
    let mut next = Map::new();
    for (key, val) in map {
        let new_key = remap_folder_id(key, old_prefix, new_prefix);
        let remapped = if let Some(arr) = val.as_array() {
            Value::Array(
                arr.iter()
                    .map(|v| match v.as_str() {
                        Some(id) => Value::String(remap_folder_id(id, old_prefix, new_prefix)),
                        None => v.clone(),
                    })
                    .collect(),
            )
        } else {
            val.clone()
        };
        next.insert(new_key, remapped);
    }
    tree.insert(field.into(), Value::Object(next));
}

pub fn get_folder_tree(data_dir: &Path) -> Result<Value, String> {
    let state = load_ui_state(data_dir)?;
    Ok(state.folders.unwrap_or_else(empty_folder_tree))
}

pub fn get_document_tags(data_dir: &Path, doc_id: &str) -> Result<Vec<String>, String> {
    let state = load_ui_state(data_dir)?;
    let Some(tags_value) = state.document_tags else {
        return Ok(Vec::new());
    };
    let Some(arr) = tags_value.get(doc_id).and_then(|v| v.as_array()) else {
        return Ok(Vec::new());
    };
    Ok(arr
        .iter()
        .filter_map(|v| v.as_str().map(str::to_string))
        .collect())
}

pub fn set_document_tags(data_dir: &Path, doc_id: &str, tags: &[String]) -> Result<Vec<String>, String> {
    let mut state = load_ui_state(data_dir)?;
    let mut map = state
        .document_tags
        .unwrap_or_else(|| json!({}))
        .as_object()
        .cloned()
        .unwrap_or_default();

    let cleaned: Vec<String> = tags
        .iter()
        .map(|t| t.trim())
        .filter(|t| !t.is_empty())
        .map(str::to_string)
        .collect();

    if cleaned.is_empty() {
        map.remove(doc_id);
    } else {
        map.insert(doc_id.to_string(), json!(cleaned));
    }

    state.document_tags = Some(Value::Object(map));
    save_ui_state(data_dir, &state)?;
    Ok(cleaned)
}

pub fn list_all_tags(data_dir: &Path) -> Result<Vec<String>, String> {
    let state = load_ui_state(data_dir)?;
    let Some(tags_value) = state.document_tags else {
        return Ok(Vec::new());
    };
    let Some(obj) = tags_value.as_object() else {
        return Ok(Vec::new());
    };

    let mut tags = std::collections::BTreeSet::new();
    for arr in obj.values() {
        if let Some(items) = arr.as_array() {
            for item in items {
                if let Some(tag) = item.as_str() {
                    let trimmed = tag.trim();
                    if !trimmed.is_empty() {
                        tags.insert(trimmed.to_string());
                    }
                }
            }
        }
    }
    Ok(tags.into_iter().collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;
    use std::fs;

    #[test]
    fn set_and_get_document_tags() {
        let dir = std::env::temp_dir().join(format!("lizhi-tags-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        let tags = set_document_tags(&dir, "doc-a", &["alpha".into(), "beta".into()]).unwrap();
        assert_eq!(tags, vec!["alpha", "beta"]);
        assert_eq!(get_document_tags(&dir, "doc-a").unwrap(), tags);
        let all = list_all_tags(&dir).unwrap();
        assert!(all.contains(&"alpha".to_string()));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn slugify_matches_frontend_rules() {
        assert_eq!(slugify_folder_name("标准ICT"), "标准ict");
        assert_eq!(slugify_folder_name("  Foo Bar  "), "foo-bar");
        assert_eq!(slugify_folder_name("!!!"), "folder");
    }

    #[test]
    fn normalize_prefixes_under_projects() {
        assert_eq!(
            normalize_folder_id("业务梳理/北向入库"),
            "projects/业务梳理/北向入库"
        );
        assert_eq!(normalize_folder_id("inbox"), "inbox");
        assert_eq!(
            normalize_folder_id("projects/云南电信/标准ICT"),
            "projects/云南电信/标准ict"
        );
    }

    #[test]
    fn ensure_folder_path_registers_deep_tree() {
        let dir =
            std::env::temp_dir().join(format!("lizhi-folder-ensure-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();

        let (id, tree) =
            ensure_folder_path(&dir, "业务梳理/北向入库/业务流程").unwrap();
        assert_eq!(id, "projects/业务梳理/北向入库/业务流程");

        let folders = tree["folders"].as_array().unwrap();
        let ids: HashSet<_> = folders
            .iter()
            .filter_map(|f| f.get("id").and_then(|v| v.as_str()))
            .collect();
        assert!(ids.contains("projects"));
        assert!(ids.contains("projects/业务梳理"));
        assert!(ids.contains("projects/业务梳理/北向入库"));
        assert!(ids.contains("projects/业务梳理/北向入库/业务流程"));

        let order = tree["folderOrder"]["projects/业务梳理"].as_array().unwrap();
        assert!(order
            .iter()
            .any(|v| v.as_str() == Some("projects/业务梳理/北向入库")));

        // idempotent
        let (id2, _) = ensure_folder_path(&dir, &id).unwrap();
        assert_eq!(id2, id);

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn delete_folder_removes_subtree_and_prunes_empty_parent() {
        let dir =
            std::env::temp_dir().join(format!("lizhi-folder-del-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();

        ensure_folder_path(&dir, "业务梳理/北向入库/业务流程").unwrap();
        ensure_folder_path(&dir, "业务梳理/标准ICT").unwrap();

        let (id, removed, _) =
            delete_folder_path(&dir, "业务梳理/北向入库").unwrap();
        assert_eq!(id, "projects/业务梳理/北向入库");
        assert!(removed.iter().any(|x| x == "projects/业务梳理/北向入库"));
        assert!(removed
            .iter()
            .any(|x| x == "projects/业务梳理/北向入库/业务流程"));

        let tree = get_folder_tree(&dir).unwrap();
        let ids: HashSet<_> = tree["folders"]
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|f| f.get("id").and_then(|v| v.as_str()))
            .collect();
        assert!(!ids.contains("projects/业务梳理/北向入库"));
        assert!(ids.contains("projects/业务梳理/标准ict"));

        // 业务梳理仍有 标准ict 子夹，不应被 prune 掉
        assert!(ids.contains("projects/业务梳理"));

        let _ = delete_folder_path(&dir, "业务梳理/标准ICT").unwrap();
        let pruned = prune_empty_folder_chain(&dir, "业务梳理").unwrap();
        assert!(pruned.iter().any(|x| x == "projects/业务梳理"));

        let tree2 = get_folder_tree(&dir).unwrap();
        let ids2: HashSet<_> = tree2["folders"]
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|f| f.get("id").and_then(|v| v.as_str()))
            .collect();
        assert!(!ids2.contains("projects/业务梳理"));

        let _ = fs::remove_dir_all(dir);
    }
}
