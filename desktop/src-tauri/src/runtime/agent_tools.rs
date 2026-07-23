use serde_json::{json, Value};
use std::collections::VecDeque;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::process::Command;

pub fn list_files(root: &Path, relative: &str) -> Result<Value, String> {
    const MAX_ITEMS: usize = 200;
    const MAX_DEPTH: usize = 4;
    let root = canonical_root(root)?;
    let start = resolve_path(&root, relative, true)?;
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
            if is_ignored_under_root(&root, &path) {
                continue;
            }
            let Ok(canonical) = path.canonicalize() else {
                continue;
            };
            if !canonical.starts_with(&root) {
                continue;
            }
            let kind = if canonical.is_dir() {
                "directory"
            } else if canonical.is_file() {
                "file"
            } else {
                continue;
            };
            items.push(json!({ "path": relative_path(&root, &canonical), "kind": kind }));
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
    let root = canonical_root(root)?;
    let path = resolve_path(&root, relative, false)?;
    let bytes = fs::read(&path).map_err(|err| err.to_string())?;
    if bytes.iter().take(512).any(|byte| *byte == 0) {
        return Err("不支持读取二进制文件".to_string());
    }
    let truncated = bytes.len() > MAX_BYTES;
    let content = String::from_utf8_lossy(&bytes[..bytes.len().min(MAX_BYTES)]).to_string();
    Ok(
        json!({ "summary": format!("读取 {}", relative_path(&root, &path)), "path": relative_path(&root, &path), "content": content, "size": bytes.len(), "truncated": truncated }),
    )
}

pub fn search_project(root: &Path, relative: &str, query: &str) -> Result<Value, String> {
    const MAX_FILES: usize = 1000;
    const MAX_HITS: usize = 100;
    const MAX_FILE_BYTES: u64 = 256 * 1024;
    let root = canonical_root(root)?;
    let start = resolve_path(&root, relative, true)?;
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
            if is_ignored_under_root(&root, &path) {
                continue;
            }
            let Ok(canonical) = path.canonicalize() else {
                continue;
            };
            if !canonical.starts_with(&root) {
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
                    hits.push(json!({ "path": relative_path(&root, &canonical), "line": index + 1, "text": line.chars().take(500).collect::<String>() }));
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

/// Executes only the registered read-only Agent tools. The Tauri adapter owns
/// selecting the current project root; this module owns argument validation and dispatch.
pub fn execute_read_tool(root: &Path, name: &str, arguments: &Value) -> Result<Value, String> {
    let arguments = arguments
        .as_object()
        .ok_or_else(|| "工具参数格式错误".to_string())?;
    let path = arguments.get("path").and_then(Value::as_str).unwrap_or(".");
    match name.trim() {
        "list_files" => list_files(root, path),
        "read_file" => read_file(root, path),
        "search_project" => search_project(
            root,
            path,
            arguments.get("query").and_then(Value::as_str).unwrap_or(""),
        ),
        "git_status" => git_status(root),
        _ => Err("Native Core 只接受已登记的只读 Agent Tool".to_string()),
    }
}

/// Hermes ACP uses the same registered read-only tools as the native command.
/// Keep its protocol-specific error boundary here so ACP cannot duplicate path
/// or query argument handling.
pub fn execute_hermes_read_tool(
    root: &Path,
    name: &str,
    arguments: &Value,
) -> Result<Value, String> {
    execute_read_tool(root, name, arguments)
        .map_err(|error| format!("Hermes 读取工具失败：{error}"))
}

fn is_ignored(path: &Path) -> bool {
    path.components().any(|component| {
        matches!(
            component.as_os_str().to_string_lossy().as_ref(),
            ".git"
                | ".project-os"
                | ".omnidesk"
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

fn canonical_root(root: &Path) -> Result<PathBuf, String> {
    root.canonicalize()
        .map_err(|err| format!("项目目录不可访问: {}", err))
}

fn resolve_path(root: &Path, relative: &str, directory: bool) -> Result<PathBuf, String> {
    let root = canonical_root(root)?;
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_root(label: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        std::env::temp_dir().join(format!("omnidesk-agent-tools-{label}-{nonce}"))
    }

    #[test]
    fn read_tools_hide_both_runtime_state_namespaces() {
        let root = test_root("state-boundary");
        fs::create_dir_all(root.join("src")).unwrap();
        fs::create_dir_all(root.join(".project-os")).unwrap();
        fs::create_dir_all(root.join(".omnidesk/data")).unwrap();
        fs::write(root.join("src/main.rs"), "fn main() {}\n").unwrap();
        fs::write(root.join(".project-os/state.json"), "{}\n").unwrap();
        fs::write(root.join(".omnidesk/data/state.json"), "{}\n").unwrap();

        let listing = list_files(&root, ".").unwrap();
        let paths = listing["items"]
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|item| item["path"].as_str())
            .collect::<Vec<_>>();
        assert!(paths.contains(&"src"), "listed paths: {paths:?}");
        assert!(!paths.iter().any(|path| path.starts_with(".project-os")));
        assert!(!paths.iter().any(|path| path.starts_with(".omnidesk")));
        assert!(read_file(&root, ".project-os/state.json").is_err());
        assert!(read_file(&root, ".omnidesk/data/state.json").is_err());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn dispatch_rejects_unknown_tools_before_they_access_a_project() {
        let root = test_root("dispatch");
        fs::create_dir_all(&root).unwrap();
        assert!(execute_read_tool(&root, "write_file", &json!({})).is_err());
        assert!(execute_read_tool(&root, "list_files", &json!([])).is_err());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn hermes_dispatch_shares_the_registered_read_only_boundary() {
        let root = test_root("hermes-dispatch");
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("README.md"), "hello\n").unwrap();
        assert!(
            execute_hermes_read_tool(&root, "read_file", &json!({ "path": "README.md" })).is_ok()
        );
        assert!(execute_hermes_read_tool(&root, "shell", &json!({})).is_err());
        fs::remove_dir_all(root).unwrap();
    }
}
