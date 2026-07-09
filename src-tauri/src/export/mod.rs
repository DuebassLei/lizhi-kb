use std::fs;
use std::path::{Component, Path};

use serde::Serialize;

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkdownExportFile {
    pub relative_path: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkdownFolderExportResult {
    pub file_count: u32,
    pub dest_dir: String,
}

pub fn export_markdown_folder(
    dest_dir: &Path,
    files: &[MarkdownExportFile],
) -> Result<MarkdownFolderExportResult, std::io::Error> {
    if !dest_dir.is_dir() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "目标路径不是文件夹",
        ));
    }

    let mut count = 0u32;
    for file in files {
        let rel = Path::new(&file.relative_path);
        if rel.is_absolute()
            || rel
                .components()
                .any(|c| matches!(c, Component::ParentDir | Component::RootDir | Component::Prefix(_)))
        {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "非法文件路径",
            ));
        }

        let dest = dest_dir.join(rel);
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&dest, &file.content)?;
        count += 1;
    }

    Ok(MarkdownFolderExportResult {
        file_count: count,
        dest_dir: dest_dir.to_string_lossy().into_owned(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use uuid::Uuid;

    #[test]
    fn writes_nested_markdown_files() {
        let dir = env::temp_dir().join(format!("lizhi-export-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();

        let files = vec![
            MarkdownExportFile {
                relative_path: "收件箱/笔记.md".into(),
                content: "# 笔记\n".into(),
            },
            MarkdownExportFile {
                relative_path: "知识库/计划/计划.md".into(),
                content: "# 计划\n".into(),
            },
        ];

        let result = export_markdown_folder(&dir, &files).unwrap();
        assert_eq!(result.file_count, 2);
        assert!(dir.join("收件箱/笔记.md").is_file());
        assert!(dir.join("知识库/计划/计划.md").is_file());

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn rejects_parent_dir_traversal() {
        let dir = env::temp_dir().join(format!("lizhi-export-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();

        let files = vec![MarkdownExportFile {
            relative_path: "../escape.md".into(),
            content: "bad".into(),
        }];

        assert!(export_markdown_folder(&dir, &files).is_err());
        let _ = fs::remove_dir_all(dir);
    }
}
