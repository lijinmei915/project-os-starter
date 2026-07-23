use base64::Engine;
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
#[cfg(feature = "webdriver")]
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

#[derive(Default)]
pub struct TerminalState {
    pub generation: Mutex<u64>,
    pub sessions: Mutex<HashMap<String, TerminalSession>>,
}

pub struct TerminalSession {
    pub child: Box<dyn Child + Send>,
    pub master: Box<dyn MasterPty + Send>,
    pub writer: Box<dyn Write + Send>,
}

// portable-pty creates an isolated Unix session for each terminal. Killing
// only its shell leaves foreground tools and their children alive.
pub fn terminate_session(session: &mut TerminalSession) {
    #[cfg(unix)]
    if let Some(group_leader) = session.master.process_group_leader() {
        if group_leader > 0 {
            // A negative PID targets the process group created by setsid.
            unsafe {
                libc::kill(-group_leader, libc::SIGKILL);
            }
        }
    }
    let _ = session.child.kill();
}

pub fn default_session_id() -> String {
    "main".to_string()
}

pub const fn default_cols() -> u16 {
    100
}

pub const fn default_rows() -> u16 {
    28
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartTerminalSessionInput {
    #[serde(default = "default_session_id")]
    pub session_id: String,
    #[serde(default = "default_cols")]
    pub cols: u16,
    #[serde(default = "default_rows")]
    pub rows: u16,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteTerminalSessionInput {
    #[serde(default = "default_session_id")]
    pub session_id: String,
    pub data: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResizeTerminalSessionInput {
    #[serde(default = "default_session_id")]
    pub session_id: String,
    #[serde(default = "default_cols")]
    pub cols: u16,
    #[serde(default = "default_rows")]
    pub rows: u16,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StopTerminalSessionInput {
    #[serde(default = "default_session_id")]
    pub session_id: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSessionResult {
    pub session_id: String,
    pub cwd: String,
    pub generation: u64,
    pub shell: String,
    pub running: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TerminalOutputEvent {
    session_id: String,
    generation: u64,
    data: String,
}

pub fn save_image(root: &Path, name: &str, data_url: &str) -> Result<String, String> {
    let extension = Path::new(name)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("png")
        .to_ascii_lowercase();
    if !matches!(
        extension.as_str(),
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg"
    ) {
        return Err("终端图片只支持 PNG、JPG、GIF、WebP 或 SVG".to_string());
    }
    let (mime, encoded) = data_url
        .split_once(',')
        .ok_or_else(|| "图片数据格式无效".to_string())?;
    if !mime.starts_with("data:image/") {
        return Err("终端只接受图片数据".to_string());
    }
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .map_err(|err| format!("图片解码失败：{err}"))?;
    if bytes.len() > 8 * 1024 * 1024 {
        return Err("终端图片不能超过 8 MB".to_string());
    }
    let dir = crate::runtime::state_namespace::state_path_for_write(
        root,
        ".omnidesk/cache/terminal-images",
    )?;
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    let safe_name: String = name
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '.' | '-' | '_'))
        .collect();
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|err| err.to_string())?
        .as_millis();
    let file_name = format!(
        "omnidesk-image-{stamp}.{}",
        if safe_name.is_empty() {
            extension.clone()
        } else {
            extension
        }
    );
    let path = dir.join(file_name);
    fs::write(&path, bytes).map_err(|err| err.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

pub fn start_session(
    app: AppHandle,
    state: &TerminalState,
    root: PathBuf,
    input: StartTerminalSessionInput,
) -> Result<TerminalSessionResult, String> {
    if !root.exists() || !root.is_dir() {
        return Err("当前项目路径不存在或不是目录".to_string());
    }
    let session_id = normalized_session_id(&input.session_id);
    let generation = {
        let mut next_generation = state.generation.lock().map_err(|err| err.to_string())?;
        *next_generation += 1;
        *next_generation
    };
    {
        let mut sessions = state.sessions.lock().map_err(|err| err.to_string())?;
        if let Some(mut existing) = sessions.remove(&session_id) {
            terminate_session(&mut existing);
        }
    }

    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    let cols = input.cols.clamp(20, 400);
    let rows = input.rows.clamp(8, 200);
    let pair = native_pty_system()
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|err| err.to_string())?;
    let mut command = CommandBuilder::new(shell.clone());
    command.cwd(root.clone());
    command.env("TERM", "xterm-256color");
    command.env("COLORTERM", "truecolor");
    command.env("PROMPT_EOL_MARK", "");

    let child = pair
        .slave
        .spawn_command(command)
        .map_err(|err| err.to_string())?;
    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|err| err.to_string())?;
    let writer = pair.master.take_writer().map_err(|err| err.to_string())?;
    let reader_session_id = session_id.clone();
    std::thread::spawn(move || {
        let mut buffer = [0_u8; 4096];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(size) => {
                    let data = String::from_utf8_lossy(&buffer[..size]).to_string();
                    let _ = app.emit(
                        "terminal://output",
                        TerminalOutputEvent {
                            session_id: reader_session_id.clone(),
                            generation,
                            data,
                        },
                    );
                }
                Err(_) => break,
            }
        }
    });
    state
        .sessions
        .lock()
        .map_err(|err| err.to_string())?
        .insert(
            session_id.clone(),
            TerminalSession {
                child,
                master: pair.master,
                writer,
            },
        );

    Ok(TerminalSessionResult {
        session_id,
        cwd: root.to_string_lossy().to_string(),
        generation,
        shell,
        running: true,
    })
}

pub fn write_session(
    state: &TerminalState,
    input: WriteTerminalSessionInput,
) -> Result<(), String> {
    let session_id = normalized_session_id(&input.session_id);
    let mut sessions = state.sessions.lock().map_err(|err| err.to_string())?;
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| "终端还没有启动".to_string())?;
    session
        .writer
        .write_all(input.data.as_bytes())
        .map_err(|err| err.to_string())?;
    session.writer.flush().map_err(|err| err.to_string())
}

pub fn resize_session(
    state: &TerminalState,
    input: ResizeTerminalSessionInput,
) -> Result<(), String> {
    let session_id = normalized_session_id(&input.session_id);
    let sessions = state.sessions.lock().map_err(|err| err.to_string())?;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| "终端还没有启动".to_string())?;
    session
        .master
        .resize(PtySize {
            rows: input.rows.clamp(8, 200),
            cols: input.cols.clamp(20, 400),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|err| err.to_string())
}

pub fn stop_session(state: &TerminalState, input: StopTerminalSessionInput) -> Result<(), String> {
    let session_id = normalized_session_id(&input.session_id);
    let mut sessions = state.sessions.lock().map_err(|err| err.to_string())?;
    if let Some(mut session) = sessions.remove(&session_id) {
        terminate_session(&mut session);
    }
    Ok(())
}

#[cfg(feature = "webdriver")]
pub fn record_native_trace(root: &Path, stage: &str, timestamp: &str) -> Result<(), String> {
    const ALLOWED_STAGES: &[&str] = &[
        "terminal-session.start-before",
        "terminal-session.start-complete",
        "terminal-session.start-error",
        "terminal-session.effect-start",
        "terminal-session.output-subscribed",
        "terminal-session.effect-error",
        "terminal-session.effect-cleanup",
        "terminal-dock.mount",
        "terminal-dock.xterm-created",
        "terminal-dock.xterm-opened",
        "terminal-dock.initial-focus-start",
        "terminal-dock.initial-focus-complete",
        "terminal-dock.initial-focus-error",
        "terminal-dock.fit-start",
        "terminal-dock.fit-complete",
        "terminal-dock.fit-error",
        "terminal-dock.active-effect",
        "terminal-dock.active-focus-start",
        "terminal-dock.active-focus-complete",
        "terminal-dock.active-focus-error",
        "terminal-dock.cleanup",
    ];
    if !ALLOWED_STAGES.contains(&stage) {
        return Err("WebDriver terminal trace stage is not allowed".to_string());
    }
    let path = crate::runtime::state_namespace::state_path_for_write(
        root,
        ".omnidesk/cache/native-terminal-trace.json",
    )?;
    let mut entries = fs::read_to_string(&path)
        .ok()
        .and_then(|content| serde_json::from_str::<Vec<Value>>(&content).ok())
        .unwrap_or_default();
    if entries
        .iter()
        .any(|entry| entry.get("stage").and_then(Value::as_str) == Some(stage))
    {
        return Ok(());
    }
    entries.push(json!({ "at": timestamp, "stage": stage }));
    if entries.len() > 30 {
        entries.drain(..entries.len() - 30);
    }
    fs::write(
        &path,
        serde_json::to_vec(&entries).map_err(|err| err.to_string())?,
    )
    .map_err(|err| err.to_string())
}

fn normalized_session_id(value: &str) -> String {
    let value = value.trim();
    if value.is_empty() {
        default_session_id()
    } else {
        value.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_match_the_desktop_terminal_contract() {
        assert_eq!(default_session_id(), "main");
        assert_eq!(default_cols(), 100);
        assert_eq!(default_rows(), 28);
    }

    #[test]
    fn normalizes_empty_terminal_session_ids() {
        assert_eq!(normalized_session_id(""), "main");
        assert_eq!(normalized_session_id("  named-session  "), "named-session");
    }
}
