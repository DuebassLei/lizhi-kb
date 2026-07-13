use std::fs;
use std::path::PathBuf;

use serde::Serialize;
use serde_json::{json, Value};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CcHooksPreview {
    pub path: String,
    pub exists: bool,
    pub hooks_json: String,
}

fn settings_path(scope: &str, project_path: Option<&str>) -> Result<PathBuf, String> {
    match scope {
        "global" => dirs::home_dir()
            .map(|h| h.join(".claude").join("settings.json"))
            .ok_or_else(|| "无法定位用户主目录".to_string()),
        "project" => {
            let raw = project_path
                .filter(|p| !p.trim().is_empty())
                .ok_or_else(|| "请先在设置中选择项目目录".to_string())?;
            Ok(PathBuf::from(raw).join(".claude").join("settings.json"))
        }
        other => Err(format!("未知 scope: {other}")),
    }
}

fn read_settings(path: &PathBuf) -> Result<Value, String> {
    if !path.is_file() {
        return Ok(json!({}));
    }
    let raw = fs::read_to_string(path).map_err(|e| format!("读取 settings.json 失败: {e}"))?;
    serde_json::from_str(&raw).map_err(|e| format!("settings.json 格式错误: {e}"))
}

fn write_settings(path: &PathBuf, value: &Value) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {e}"))?;
    }
    let json = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| format!("写入 settings.json 失败: {e}"))
}

fn hooks_to_json_string(hooks: &Value) -> String {
    serde_json::to_string_pretty(hooks).unwrap_or_else(|_| "{}".to_string())
}

pub fn get_cc_hooks(scope: &str, project_path: Option<&str>) -> Result<CcHooksPreview, String> {
    let path = settings_path(scope, project_path)?;
    let display = path.display().to_string();
    let exists = path.is_file();
    let settings = read_settings(&path)?;
    let hooks = settings.get("hooks").cloned().unwrap_or_else(|| json!({}));
    Ok(CcHooksPreview {
        path: display,
        exists,
        hooks_json: hooks_to_json_string(&hooks),
    })
}

pub fn save_cc_hooks(
    scope: &str,
    hooks_json: &str,
    project_path: Option<&str>,
) -> Result<CcHooksPreview, String> {
    let trimmed = hooks_json.trim();
    let hooks: Value = if trimmed.is_empty() {
        json!({})
    } else {
        let parsed: Value =
            serde_json::from_str(trimmed).map_err(|e| format!("hooks JSON 格式错误: {e}"))?;
        if !parsed.is_object() {
            return Err("hooks 必须是 JSON 对象".into());
        }
        parsed
    };

    let path = settings_path(scope, project_path)?;
    let mut settings = read_settings(&path)?;
    if !settings.is_object() {
        settings = json!({});
    }
    settings
        .as_object_mut()
        .expect("settings object")
        .insert("hooks".into(), hooks);
    write_settings(&path, &settings)?;
    get_cc_hooks(scope, project_path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_non_object_hooks() {
        assert!(save_cc_hooks("global", "[]", None).is_err());
    }

    #[test]
    fn project_scope_requires_path() {
        assert!(get_cc_hooks("project", None).is_err());
    }
}
