use serde_json::{json, Value};
use std::collections::VecDeque;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::process::Command;

pub fn list_files(root: &Path, relative: &str) -> Result<Value, String> {
    const MAX_ITEMS: usize = 200;
    const MAX_DEPTH: usize = 4;
    let start = resolve_path(root, relative, true)?;
    let mut queue = VecDeque::from([(start, 0usize)]);
    let mut items = Vec::new();
    let mut truncated = false;
    while let Some((directory, depth)) = queue.pop_front() {
        let mut entries = fs::read_dir(&directory)
            .map_err(|err| err.to_string())?
            .filter_map(Result::ok)
            .collect::<Vec<_>>();
        entries.sort_by_key(|entry| entry.file_name());
        for entry in entries {
            let path = entry.path();
            if is_ignored_under_root(root, &path) {
                continue;
            }
            let Ok(canonical) = path.canonicalize() else {
                continue;
            };
            if !canonical.starts_with(root) {
                continue;
            }
            let kind = if canonical.is_dir() {
                "directory"
            } else if canonical.is_file() {
                "file"
            } else {
                continue;
            };
            items.push(json!({ "path": relative_path(root, &canonical), "kind": kind }));
            if items.len() >= MAX_ITEMS {
                truncated = true;
                break;
            }
            if canonical.is_dir() && depth < MAX_DEPTH {
                queue.push_back((canonical, depth + 1));
            }
        }
        if truncated {
            break;
        }
    }
    Ok(
        json!({ "summary": format!("列出 {} 项", items.len()), "items": items, "truncated": truncated }),
    )
}

pub fn read_file(root: &Path, relative: &str) -> Result<Value, String> {
    const MAX_BYTES: usize = 80 * 1024;
    let path = resolve_path(root, relative, false)?;
    let bytes = fs::read(&path).map_err(|err| err.to_string())?;
    if bytes.iter().take(512).any(|byte| *byte == 0) {
        return Err("不支持读取二进制文件".to_string());
    }
    let truncated = bytes.len() > MAX_BYTES;
    let content = String::from_utf8_lossy(&bytes[..bytes.len().min(MAX_BYTES)]).to_string();
    Ok(
        json!({ "summary": format!("读取 {}", relative_path(root, &path)), "path": relative_path(root, &path), "content": content, "size": bytes.len(), "truncated": truncated }),
    )
}

pub fn search_project(root: &Path, relative: &str, query: &str) -> Result<Value, String> {
    const MAX_FILES: usize = 1000;
    const MAX_HITS: usize = 100;
    const MAX_FILE_BYTES: u64 = 256 * 1024;
    let start = resolve_path(root, relative, true)?;
    let needle = query.trim().to_lowercase();
    if needle.is_empty() {
        return Err("搜索内容不能为空".to_string());
    }
    let mut queue = VecDeque::from([start]);
    let mut files_scanned = 0usize;
    let mut hits = Vec::new();
    while let Some(directory) = queue.pop_front() {
        for entry in fs::read_dir(&directory)
            .map_err(|err| err.to_string())?
            .filter_map(Result::ok)
        {
            let path = entry.path();
            if is_ignored_under_root(root, &path) {
                continue;
            }
            let Ok(canonical) = path.canonicalize() else {
                continue;
            };
            if !canonical.starts_with(root) {
                continue;
            }
            if canonical.is_dir() {
                queue.push_back(canonical);
                continue;
            }
            if !canonical.is_file() {
                continue;
            }
            files_scanned += 1;
            if files_scanned > MAX_FILES {
                break;
            }
            if canonical
                .metadata()
                .map(|metadata| metadata.len() > MAX_FILE_BYTES)
                .unwrap_or(true)
            {
                continue;
            }
            let Ok(content) = fs::read_to_string(&canonical) else {
                continue;
            };
            for (index, line) in content.lines().enumerate() {
                if line.to_lowercase().contains(&needle) {
                    hits.push(json!({ "path": relative_path(root, &canonical), "line": index + 1, "text": line.chars().take(500).collect::<String>() }));
                    if hits.len() >= MAX_HITS {
                        break;
                    }
                }
            }
            if hits.len() >= MAX_HITS || files_scanned > MAX_FILES {
                break;
            }
        }
        if hits.len() >= MAX_HITS || files_scanned > MAX_FILES {
            break;
        }
    }
    Ok(
        json!({ "summary": format!("找到 {} 处匹配", hits.len()), "hits": hits, "filesScanned": files_scanned.min(MAX_FILES), "truncated": hits.len() >= MAX_HITS || files_scanned > MAX_FILES }),
    )
}

pub fn git_status(root: &Path) -> Result<Value, String> {
    let output = Command::new("git")
        .args(["status", "--short", "--untracked-files=normal"])
        .current_dir(root)
        .output()
        .map_err(|err| err.to_string())?;
    if !output.status.success() {
        return Err("当前项目不是可读取的 Git 工作区".to_string());
    }
    let mut entries = String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter(|line| !line.trim().is_empty())
        .take(200)
        .map(|line| line.chars().take(600).collect::<String>())
        .collect::<Vec<_>>();
    let total = entries.len();
    let truncated = String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter(|line| !line.trim().is_empty())
        .count()
        > total;
    Ok(
        json!({ "summary": if total == 0 { "Git 工作区干净".to_string() } else { format!("Git 工作区有 {} 个变更项", total) }, "entries": entries.drain(..).collect::<Vec<_>>(), "truncated": truncated }),
    )
}

fn is_ignored(path: &Path) -> bool {
    path.components().any(|component| {
        matches!(
            component.as_os_str().to_string_lossy().as_ref(),
            ".git"
                | "node_modules"
                | "target"
                | "dist"
                | "build"
                | ".next"
                | ".nuxt"
                | ".vite"
                | ".turbo"
                | ".cache"
                | "coverage"
                | "__pycache__"
        )
    }) || path
        .file_name()
        .and_then(|value| value.to_str())
        .map(|name| {
            name.starts_with(".env") || name.ends_with(".lock") || name == "desktop-provider.json"
        })
        .unwrap_or(false)
}

fn is_ignored_under_root(root: &Path, path: &Path) -> bool {
    path.strip_prefix(root).map(is_ignored).unwrap_or(true)
}

fn resolve_path(root: &Path, relative: &str, directory: bool) -> Result<PathBuf, String> {
    let root = root
        .canonicalize()
        .map_err(|err| format!("项目目录不可访问: {}", err))?;
    let relative = relative.trim();
    let candidate = if relative.is_empty() || relative == "." {
        root.to_path_buf()
    } else {
        let path = Path::new(relative);
        if path.is_absolute()
            || path.components().any(|part| {
                matches!(
                    part,
                    Component::ParentDir | Component::RootDir | Component::Prefix(_)
                )
            })
        {
            return Err("工具路径必须位于当前项目内".to_string());
        }
        root.join(path)
    };
    let canonical = candidate
        .canonicalize()
        .map_err(|_| format!("没有找到项目路径：{}", relative))?;
    if !canonical.starts_with(&root) || is_ignored_under_root(&root, &canonical) {
        return Err("工具路径不允许访问".to_string());
    }
    if directory && !canonical.is_dir() {
        return Err("请选择项目目录".to_string());
    }
    if !directory && !canonical.is_file() {
        return Err("请选择项目文件".to_string());
    }
    Ok(canonical)
}

fn relative_path(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}
