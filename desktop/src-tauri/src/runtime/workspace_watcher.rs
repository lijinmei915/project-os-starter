use notify::{
    Config as NotifyConfig, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher,
};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};

#[derive(Default)]
pub struct WorkspaceWatcherState {
    watcher: Mutex<Option<RecommendedWatcher>>,
    root: Mutex<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct WorkspaceFilesChangedEvent {
    path: String,
    root: String,
}

pub fn should_ignore_path(path: &Path) -> bool {
    let in_runtime_state = path.components().any(|component| {
        matches!(
            component.as_os_str().to_string_lossy().as_ref(),
            ".project-os" | ".omnidesk"
        )
    });
    let fact_file = path
        .file_name()
        .and_then(|value| value.to_str())
        .map(|name| {
            matches!(
                name,
                "README.md"
                    | "PROJECT.md"
                    | "HANDOFF.md"
                    | "AGENTS.md"
                    | "package.json"
                    | "Cargo.toml"
                    | "schema.sql"
            )
        })
        .unwrap_or(false);
    let fact_directory = path.components().any(|component| {
        matches!(
            component.as_os_str().to_string_lossy().as_ref(),
            "src"
                | "src-tauri"
                | "server"
                | "backend"
                | "api"
                | "prisma"
                | "migrations"
                | "tests"
                | "workflows"
        )
    });
    if in_runtime_state || (!fact_file && !fact_directory) {
        return true;
    }
    path.components().any(|component| {
        let name = component.as_os_str().to_string_lossy();
        matches!(
            name.as_ref(),
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
                | ".DS_Store"
                | "entry-contexts"
                | "locks"
        )
    }) || path
        .file_name()
        .and_then(|value| value.to_str())
        .map(|name| {
            name.starts_with(".env") || name.ends_with(".lock") || name == "desktop-theme.json"
        })
        .unwrap_or(false)
}

pub fn event_should_refresh(event: &Event) -> bool {
    matches!(
        event.kind,
        EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_) | EventKind::Any
    ) && event.paths.iter().any(|path| !should_ignore_path(path))
}

pub fn start(
    app: AppHandle,
    state: State<WorkspaceWatcherState>,
    root: PathBuf,
) -> Result<String, String> {
    let root = root
        .canonicalize()
        .map_err(|err| format!("项目目录不可访问: {err}"))?;
    let root_text = root.to_string_lossy().to_string();

    {
        let current_root = state.root.lock().map_err(|err| err.to_string())?;
        if *current_root == root_text {
            return Ok(root_text);
        }
    }

    let last_emit = Arc::new(Mutex::new(Instant::now() - Duration::from_secs(10)));
    let emit_root = root.clone();
    let emit_root_text = root_text.clone();
    let emit_app = app.clone();
    let emit_guard = Arc::clone(&last_emit);
    let mut watcher = RecommendedWatcher::new(
        move |result: Result<Event, notify::Error>| {
            let Ok(event) = result else {
                return;
            };
            if !event_should_refresh(&event) {
                return;
            }
            let Ok(mut last) = emit_guard.lock() else {
                return;
            };
            if last.elapsed() < Duration::from_millis(1200) {
                return;
            }
            *last = Instant::now();
            let relative = event
                .paths
                .iter()
                .find(|path| !should_ignore_path(path))
                .and_then(|path| path.strip_prefix(&emit_root).ok())
                .map(|path| path.to_string_lossy().replace('\\', "/"))
                .unwrap_or_else(|| "project".to_string());
            let _ = emit_app.emit(
                "workspace://files-changed",
                WorkspaceFilesChangedEvent {
                    path: relative,
                    root: emit_root_text.clone(),
                },
            );
        },
        NotifyConfig::default(),
    )
    .map_err(|err| format!("无法启动工程文件监听: {err}"))?;
    watcher
        .watch(&root, RecursiveMode::Recursive)
        .map_err(|err| format!("无法监听项目目录: {err}"))?;

    {
        let mut watcher_slot = state.watcher.lock().map_err(|err| err.to_string())?;
        *watcher_slot = Some(watcher);
    }
    {
        let mut current_root = state.root.lock().map_err(|err| err.to_string())?;
        *current_root = root_text.clone();
    }

    Ok(root_text)
}

#[cfg(test)]
mod tests {
    use super::should_ignore_path;
    use std::path::Path;

    #[test]
    fn keeps_source_and_facts_but_ignores_runtime_and_build_artifacts() {
        assert!(!should_ignore_path(Path::new("src/main.rs")));
        assert!(!should_ignore_path(Path::new("README.md")));
        assert!(should_ignore_path(Path::new(".omnidesk/data/state.json")));
        assert!(should_ignore_path(Path::new("node_modules/pkg/index.js")));
        assert!(should_ignore_path(Path::new(".env.local")));
    }
}
