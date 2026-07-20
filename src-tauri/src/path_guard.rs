//! 导出 / 外部读文件路径沙箱：禁止读写 vault data_dir 内路径。

use std::path::{Component, Path, PathBuf};

/// 规范化绝对路径（解析 `.` / `..`，不访问磁盘）。
pub fn normalize_absolute(path: &Path) -> Result<PathBuf, String> {
    if !path.is_absolute() {
        return Err("路径必须是绝对路径".into());
    }

    let mut out = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Prefix(p) => out.push(p.as_os_str()),
            Component::RootDir => out.push(component.as_os_str()),
            Component::CurDir => {}
            Component::ParentDir => {
                if !out.pop() {
                    return Err("路径无效".into());
                }
            }
            Component::Normal(s) => out.push(s),
        }
    }

    if !out.is_absolute() {
        return Err("路径无效".into());
    }
    Ok(out)
}

fn normalize_data_dir(data_dir: &Path) -> Result<PathBuf, String> {
    if data_dir.is_absolute() {
        normalize_absolute(data_dir)
    } else {
        let cwd = std::env::current_dir().map_err(|e| e.to_string())?;
        normalize_absolute(&cwd.join(data_dir))
    }
}

/// `path` 是否位于 `data_dir` 或其子路径下。
pub fn is_under_data_dir(path: &Path, data_dir: &Path) -> Result<bool, String> {
    let path = normalize_absolute(path)?;
    let data_dir = normalize_data_dir(data_dir)?;

    #[cfg(windows)]
    {
        let path_s = path.to_string_lossy().to_lowercase();
        let dir_s = data_dir.to_string_lossy().to_lowercase();
        Ok(path_s == dir_s || path_s.starts_with(&(dir_s + std::path::MAIN_SEPARATOR_STR)))
    }
    #[cfg(not(windows))]
    {
        Ok(path == data_dir || path.starts_with(&data_dir))
    }
}

/// 导出写入路径：绝对路径、非目录、且不得落在 vault data_dir。
pub fn assert_export_write_path(path: &Path, data_dir: &Path) -> Result<PathBuf, String> {
    let path = normalize_absolute(path)?;
    if path.as_os_str().is_empty() {
        return Err("导出路径无效".into());
    }
    if is_under_data_dir(&path, data_dir)? {
        return Err("不能导出到知识库数据目录内".into());
    }
    Ok(path)
}

/// 外部读文件：绝对路径、且不得读 vault data_dir。
pub fn assert_export_read_path(path: &Path, data_dir: &Path) -> Result<PathBuf, String> {
    let path = normalize_absolute(path)?;
    if is_under_data_dir(&path, data_dir)? {
        return Err("不能读取知识库数据目录内的文件".into());
    }
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn normalize_resolves_parent() {
        #[cfg(windows)]
        {
            let p = PathBuf::from(r"C:\a\b\..\c\file.txt");
            let n = normalize_absolute(&p).unwrap();
            assert_eq!(n, PathBuf::from(r"C:\a\c\file.txt"));
        }
        #[cfg(not(windows))]
        {
            let p = PathBuf::from("/a/b/../c/file.txt");
            let n = normalize_absolute(&p).unwrap();
            assert_eq!(n, PathBuf::from("/a/c/file.txt"));
        }
    }

    #[test]
    fn rejects_under_data_dir() {
        #[cfg(windows)]
        {
            let data = PathBuf::from(r"C:\Users\me\.lizhi-kb");
            let inside = PathBuf::from(r"C:\Users\me\.lizhi-kb\keys.enc");
            let outside = PathBuf::from(r"C:\Users\me\Desktop\out.md");
            assert!(assert_export_write_path(&inside, &data).is_err());
            assert!(assert_export_write_path(&outside, &data).is_ok());
            assert!(assert_export_read_path(&inside, &data).is_err());
            assert!(assert_export_read_path(&outside, &data).is_ok());
        }
        #[cfg(not(windows))]
        {
            let data = PathBuf::from("/home/me/.lizhi-kb");
            let inside = PathBuf::from("/home/me/.lizhi-kb/keys.enc");
            let outside = PathBuf::from("/home/me/Desktop/out.md");
            assert!(assert_export_write_path(&inside, &data).is_err());
            assert!(assert_export_write_path(&outside, &data).is_ok());
            assert!(assert_export_read_path(&inside, &data).is_err());
            assert!(assert_export_read_path(&outside, &data).is_ok());
        }
    }

    #[test]
    fn rejects_traversal_into_data_dir() {
        #[cfg(windows)]
        {
            let data = PathBuf::from(r"C:\Users\me\.lizhi-kb");
            let sneaky = PathBuf::from(r"C:\Users\me\Desktop\..\..\.lizhi-kb\vault.db");
            // After normalize may still land under data_dir depending on path layout;
            // use direct child traversal:
            let sneak2 = PathBuf::from(r"C:\Users\me\.lizhi-kb\..\..\Windows\out.txt");
            let n = normalize_absolute(&sneak2).unwrap();
            assert!(!is_under_data_dir(&n, &data).unwrap());
            let sneak3 = PathBuf::from(r"C:\Users\me\.lizhi-kb\workspace\a.md");
            assert!(assert_export_write_path(&sneak3, &data).is_err());
            let _ = sneaky;
        }
        #[cfg(not(windows))]
        {
            let data = PathBuf::from("/home/me/.lizhi-kb");
            let sneak = PathBuf::from("/tmp/../home/me/.lizhi-kb/keys.enc");
            assert!(assert_export_write_path(&sneak, &data).is_err());
        }
    }
}
