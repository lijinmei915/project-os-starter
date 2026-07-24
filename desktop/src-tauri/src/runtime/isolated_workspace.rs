use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::process::Command;

/// A task-scoped Git worktree. The source project remains the authority; this
/// record only binds an Agent Run to a clean detached copy until an explicit
/// integration approval applies its diff back to the source project.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IsolatedWorkspace {
    pub id: String,
    pub source_root: String,
    pub root: String,
    pub base_head: String,
}

pub fn create(source_root: &Path, run_id: &str) -> Result<IsolatedWorkspace, String> {
    let source_root = canonical_git_root(source_root)?;
    ensure_clean(&source_root)?;
    let id = safe_component(run_id);
    if id.is_empty() {
        return Err("隔离工作区缺少有效 Run id。".to_string());
    }
    let target = workspace_path(&source_root, &id);
    if target.exists() {
        let existing = IsolatedWorkspace {
            id,
            source_root: source_root.to_string_lossy().to_string(),
            root: target.to_string_lossy().to_string(),
            base_head: git_text(&source_root, &["rev-parse", "HEAD"])?,
        };
        validate(&existing, &source_root)?;
        return Ok(existing);
    }
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let base_head = git_text(&source_root, &["rev-parse", "HEAD"])?;
    git_success(
        &source_root,
        &[
            "worktree",
            "add",
            "--detach",
            target.to_string_lossy().as_ref(),
            base_head.as_str(),
        ],
    )?;
    Ok(IsolatedWorkspace {
        id,
        source_root: source_root.to_string_lossy().to_string(),
        root: target.to_string_lossy().to_string(),
        base_head,
    })
}

pub fn execution_root(
    workspace: &IsolatedWorkspace,
    source_root: &Path,
) -> Result<PathBuf, String> {
    validate(workspace, source_root)?;
    PathBuf::from(&workspace.root)
        .canonicalize()
        .map_err(|error| format!("隔离工作区不可访问：{error}"))
}

pub fn ensure_source_clean(source_root: &Path) -> Result<(), String> {
    let root = canonical_git_root(source_root)?;
    ensure_clean(&root)
}

/// Returns the complete patch that must be independently approved before it
/// can be applied to the source project. New files use Git's intent-to-add so
/// they appear in the diff without staging user-visible content.
pub fn integration_diff(
    workspace: &IsolatedWorkspace,
    source_root: &Path,
) -> Result<String, String> {
    let root = execution_root(workspace, source_root)?;
    let untracked = git_text(&root, &["ls-files", "--others", "--exclude-standard"])?;
    let files = untracked
        .lines()
        .map(str::trim)
        .filter(|path| !path.is_empty())
        .collect::<Vec<_>>();
    if !files.is_empty() {
        if files
            .iter()
            .any(|path| !crate::runtime::patch::is_context_path(path))
        {
            return Err("隔离工作区含有不允许集成的未跟踪文件。".to_string());
        }
        let mut args = vec!["add", "-N", "--"];
        args.extend(files.iter().copied());
        git_success(&root, &args)?;
    }
    let diff = git_raw(&root, &["diff", "--binary", "--no-ext-diff", "HEAD", "--"])?;
    if diff.trim().is_empty() {
        return Ok(String::new());
    }
    crate::runtime::patch::validate_apply_diff_paths(&diff)?;
    Ok(diff)
}

pub fn remove(workspace: &IsolatedWorkspace, source_root: &Path) -> Result<(), String> {
    let source_root = canonical_git_root(source_root)?;
    validate(workspace, &source_root)?;
    git_success(
        &source_root,
        &["worktree", "remove", "--force", workspace.root.as_str()],
    )
}

fn validate(workspace: &IsolatedWorkspace, source_root: &Path) -> Result<(), String> {
    let source = canonical_git_root(source_root)?;
    let stored_source = PathBuf::from(&workspace.source_root)
        .canonicalize()
        .map_err(|_| "隔离工作区来源项目不可访问。".to_string())?;
    if source != stored_source {
        return Err("隔离工作区不属于当前项目。".to_string());
    }
    let isolated = PathBuf::from(&workspace.root)
        .canonicalize()
        .map_err(|_| "隔离工作区已不存在，不能继续执行。".to_string())?;
    if git_text(&isolated, &["rev-parse", "--show-toplevel"])? != isolated.to_string_lossy() {
        return Err("隔离工作区 Git 根目录不匹配。".to_string());
    }
    let code = Command::new("git")
        .args([
            "merge-base",
            "--is-ancestor",
            workspace.base_head.as_str(),
            "HEAD",
        ])
        .current_dir(&isolated)
        .status()
        .map_err(|error| error.to_string())?;
    if !code.success() {
        return Err("隔离工作区基线与原任务不一致。".to_string());
    }
    Ok(())
}

fn ensure_clean(root: &Path) -> Result<(), String> {
    let output = git_text(root, &["status", "--porcelain", "--untracked-files=normal"])?;
    let dirty = output.lines().any(|line| {
        let path = line.get(3..).unwrap_or("").trim_start_matches("\"");
        !path.starts_with(".omnidesk/")
    });
    if dirty {
        Err(
            "当前项目存在未提交改动；不能安全创建隔离工作区。请先提交、暂存或关闭隔离模式。"
                .to_string(),
        )
    } else {
        Ok(())
    }
}

fn canonical_git_root(root: &Path) -> Result<PathBuf, String> {
    let canonical = root
        .canonicalize()
        .map_err(|error| format!("项目目录不可访问：{error}"))?;
    let git_root = PathBuf::from(git_text(&canonical, &["rev-parse", "--show-toplevel"])?);
    let git_root = git_root
        .canonicalize()
        .map_err(|error| format!("Git 根目录不可访问：{error}"))?;
    if canonical != git_root {
        return Err("隔离执行必须从 Git 项目根目录启动。".to_string());
    }
    Ok(git_root)
}

fn git_text(root: &Path, args: &[&str]) -> Result<String, String> {
    Ok(git_raw(root, args)?.trim().to_string())
}

fn git_raw(root: &Path, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(root)
        .output()
        .map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err(format!(
            "Git 命令失败：{}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn git_success(root: &Path, args: &[&str]) -> Result<(), String> {
    git_text(root, args).map(|_| ())
}

fn workspace_path(source_root: &Path, run_id: &str) -> PathBuf {
    let mut hasher = DefaultHasher::new();
    source_root.hash(&mut hasher);
    std::env::temp_dir()
        .join("omnidesk-agent-worktrees")
        .join(format!("{:x}", hasher.finish()))
        .join(run_id)
}

fn safe_component(value: &str) -> String {
    value
        .chars()
        .filter_map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                Some(ch)
            } else {
                None
            }
        })
        .take(96)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn fixture() -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("omnidesk-isolation-test-{nonce}"));
        fs::create_dir_all(&root).unwrap();
        git_success(&root, &["init"]).unwrap();
        git_success(&root, &["config", "user.email", "test@example.invalid"]).unwrap();
        git_success(&root, &["config", "user.name", "OmniDesk Test"]).unwrap();
        fs::write(root.join("README.md"), "before\n").unwrap();
        git_success(&root, &["add", "README.md"]).unwrap();
        git_success(&root, &["commit", "-m", "initial"]).unwrap();
        root
    }

    #[test]
    fn creates_extracts_and_removes_an_isolated_worktree() {
        let root = fixture();
        let workspace = create(&root, "run-1").unwrap();
        let isolated = execution_root(&workspace, &root).unwrap();
        fs::write(isolated.join("README.md"), "after\n").unwrap();
        fs::write(isolated.join("src.rs"), "pub fn value() {}\n").unwrap();
        let diff = integration_diff(&workspace, &root).unwrap();
        assert!(diff.contains("README.md"));
        assert!(diff.contains("src.rs"));
        assert!(root.join("README.md").exists());
        assert_eq!(
            fs::read_to_string(root.join("README.md")).unwrap(),
            "before\n"
        );
        remove(&workspace, &root).unwrap();
        assert!(!Path::new(&workspace.root).exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_a_dirty_source_project() {
        let root = fixture();
        fs::write(root.join("README.md"), "dirty\n").unwrap();
        assert!(create(&root, "run-2").is_err());
        fs::remove_dir_all(root).unwrap();
    }
}
