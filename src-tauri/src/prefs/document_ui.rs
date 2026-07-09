use std::path::Path;

use serde_json::{json, Value};

use super::{load_ui_state, save_ui_state};

pub fn get_folder_tree(data_dir: &Path) -> Result<Value, String> {
    let state = load_ui_state(data_dir)?;
    Ok(state.folders.unwrap_or_else(|| json!({ "folders": [] })))
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
}
