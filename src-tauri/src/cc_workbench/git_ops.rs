use std::fs;
use std::path::Path;
use std::process::Command;

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CcGitFileStatus {
    pub path: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CcGitStatusResult {
    pub files: Vec<CcGitFileStatus>,
    pub is_repo: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CcGitFileDiffContents {
    pub path: String,
    pub old_content: String,
    pub new_content: String,
}
fn run_git(project_path: &str, args: &[&str]) -> Result<String, String> {
    let root = Path::new(project_path.trim());
    if !root.is_dir() {
        return Err("项目目录不存在".into());
    }
    let output = Command::new("git")
        .args(args)
        .current_dir(root)
        .output()
        .map_err(|e| format!("执行 git 失败: {e}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "git 命令失败".into()
        } else {
            stderr
        });
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

pub fn git_is_repo(project_path: &str) -> bool {
    run_git(project_path, &["rev-parse", "--is-inside-work-tree"])
        .map(|s| s.trim() == "true")
        .unwrap_or(false)
}

pub fn git_status(project_path: &str) -> Result<CcGitStatusResult, String> {
    if !git_is_repo(project_path) {
        return Ok(CcGitStatusResult {
            files: Vec::new(),
            is_repo: false,
        });
    }
    let stdout = run_git(project_path, &["status", "--porcelain"])?;
    let mut files = Vec::new();
    for line in stdout.lines() {
        if line.len() < 4 {
            continue;
        }
        let status = line[..2].trim().to_string();
        let path = line[3..].trim().to_string();
        if path.is_empty() {
            continue;
        }
        files.push(CcGitFileStatus { path, status });
    }
    Ok(CcGitStatusResult {
        files,
        is_repo: true,
    })
}

pub fn git_diff(project_path: &str, paths: &[String]) -> Result<String, String> {
    if !git_is_repo(project_path) {
        return Err("当前目录不是 Git 仓库".into());
    }
    let mut args = vec!["diff", "--no-color"];
    for path in paths {
        args.push(path.as_str());
    }
    run_git(project_path, &args)
}

/// 工作区 vs HEAD 的文件快照，供左右 diff 对比。
pub fn git_file_diff_contents(project_path: &str, path: &str) -> Result<CcGitFileDiffContents, String> {
    if !git_is_repo(project_path) {
        return Err("当前目录不是 Git 仓库".into());
    }
    let rel = path.trim();
    if rel.is_empty() {
        return Err("文件路径为空".into());
    }
    let git_path = rel.replace('\\', "/");
    let old_content = run_git(project_path, &["show", &format!("HEAD:{git_path}")]).unwrap_or_default();
    let disk_path = Path::new(project_path.trim()).join(rel);
    let new_content = if disk_path.is_file() {
        fs::read_to_string(&disk_path).map_err(|e| format!("读取工作区文件失败: {e}"))?
    } else {
        String::new()
    };
    Ok(CcGitFileDiffContents {
        path: rel.to_string(),
        old_content,
        new_content,
    })
}

pub fn git_checkout_files(project_path: &str, paths: &[String]) -> Result<(), String> {
    if !git_is_repo(project_path) {
        return Err("当前目录不是 Git 仓库".into());
    }
    if paths.is_empty() {
        return Err("没有可还原的文件".into());
    }
    let mut args = vec!["checkout", "--"];
    let path_refs: Vec<&str> = paths.iter().map(|s| s.as_str()).collect();
    args.extend(path_refs);
    run_git(project_path, &args).map(|_| ())
}

pub fn git_undo_edits(project_path: &str, paths: &[String]) -> Result<u32, String> {
    git_checkout_files(project_path, paths)?;
    Ok(paths.len() as u32)
}
