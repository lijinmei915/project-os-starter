use std::io::Write;
use std::path::Path;
use std::process::{Command, Stdio};

pub fn open_project_folder(path: &Path) -> Result<(), String> {
    require_directory(
        path,
        "这个项目路径已经不存在，无法查看本地文件。",
        "这个项目不是文件夹，无法查看本地文件。",
    )?;

    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.arg(path);
        command
    };

    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("explorer");
        command.arg(path);
        command
    };

    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = {
        let mut command = Command::new("xdg-open");
        command.arg(path);
        command
    };

    command
        .spawn()
        .map_err(|err| format!("无法打开本地文件：{err}"))?;
    Ok(())
}

pub fn open_native_terminal(root: &Path) -> Result<(), String> {
    require_directory(
        root,
        "当前项目路径不存在或不是目录",
        "当前项目路径不存在或不是目录",
    )?;

    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.args(["-a", "Terminal"]);
        command.arg(root);
        command
    };

    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("cmd");
        command.args(["/C", "start", "wt", "-d"]);
        command.arg(root);
        command
    };

    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = {
        let mut command = Command::new("x-terminal-emulator");
        command.current_dir(root);
        command
    };

    command
        .spawn()
        .map_err(|err| format!("无法打开原生终端：{err}"))?;
    Ok(())
}

pub fn copy_text_to_clipboard(text: &str) -> Result<(), String> {
    if text.trim().is_empty() {
        return Err("没有可复制的内容。".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        let mut child = Command::new("pbcopy")
            .stdin(Stdio::piped())
            .spawn()
            .map_err(|err| format!("复制失败：{err}"))?;
        if let Some(stdin) = child.stdin.as_mut() {
            stdin
                .write_all(text.as_bytes())
                .map_err(|err| format!("复制失败：{err}"))?;
        }
        let status = child.wait().map_err(|err| format!("复制失败：{err}"))?;
        if status.success() {
            Ok(())
        } else {
            Err("复制失败：系统剪贴板不可用。".to_string())
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = text;
        Err("当前桌面端复制路径暂只支持 macOS。".to_string())
    }
}

fn require_directory(path: &Path, missing_message: &str, file_message: &str) -> Result<(), String> {
    if !path.exists() {
        return Err(missing_message.to_string());
    }
    if !path.is_dir() {
        return Err(file_message.to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temporary_path(label: &str) -> std::path::PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        std::env::temp_dir().join(format!("omnidesk-system-integration-{label}-{nonce}"))
    }

    #[test]
    fn rejects_missing_and_non_directory_paths_before_launching_system_apps() {
        let missing = temporary_path("missing");
        assert_eq!(
            require_directory(&missing, "missing", "file").unwrap_err(),
            "missing"
        );

        let file = temporary_path("file");
        fs::write(&file, "content").unwrap();
        assert_eq!(
            require_directory(&file, "missing", "file").unwrap_err(),
            "file"
        );
        fs::remove_file(file).unwrap();
    }

    #[test]
    fn rejects_empty_clipboard_content_without_touching_the_system_clipboard() {
        assert_eq!(
            copy_text_to_clipboard("  ").unwrap_err(),
            "没有可复制的内容。"
        );
    }
}
