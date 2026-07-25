use base64::Engine;
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
#[cfg(feature = "webdriver")]
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

#[derive(Default)]
pub struct TerminalState {
    pub generation: Mutex<u64>,
    pub sessions: Mutex<HashMap<String, TerminalSession>>,
    pub recovered_roots: Mutex<HashSet<PathBuf>>,
}

pub struct TerminalSession {
    pub id: String,
    pub generation: u64,
    pub child: Box<dyn Child + Send>,
    pub master: Box<dyn MasterPty + Send>,
    pub writer: Box<dyn Write + Send>,
    pub root: PathBuf,
    pub evidence: Arc<Mutex<TerminalEvidenceState>>,
    pub output_tail: Arc<Mutex<String>>,
}

#[derive(Default)]
pub struct TerminalEvidenceState {
    pub started_at: String,
    pub command_count: usize,
    pub last_command: String,
    pub input_buffer: String,
}

const TERMINAL_EVIDENCE_DIRECTORY: &str = ".omnidesk/runtime/terminal-sessions";
const TERMINAL_EVIDENCE_SCHEMA_VERSION: &str = "omnidesk.terminal-session.v0.1";
const MAX_OUTPUT_TAIL: usize = 2_000;

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSessionEvidence {
    pub schema_version: String,
    pub session_id: String,
    pub cwd: String,
    pub shell: String,
    pub generation: u64,
    pub status: String,
    pub started_at: String,
    pub updated_at: String,
    pub ended_at: String,
    pub command_count: usize,
    pub last_command_summary: String,
    pub output_tail: String,
    pub end_reason: String,
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
    recover_stale_evidence_once(state, &root)?;
    let generation = {
        let mut next_generation = state.generation.lock().map_err(|err| err.to_string())?;
        *next_generation += 1;
        *next_generation
    };
    {
        let mut sessions = state.sessions.lock().map_err(|err| err.to_string())?;
        if let Some(mut existing) = sessions.remove(&session_id) {
            terminate_session(&mut existing);
            persist_evidence(&existing, "interrupted", "restarted")?;
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
    let output_tail = Arc::new(Mutex::new(String::new()));
    let reader_output_tail = output_tail.clone();
    let evidence = Arc::new(Mutex::new(TerminalEvidenceState {
        started_at: current_timestamp(),
        ..TerminalEvidenceState::default()
    }));
    let reader_evidence = evidence.clone();
    let reader_root = root.clone();
    let reader_shell = shell.clone();
    std::thread::spawn(move || {
        let mut buffer = [0_u8; 4096];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(size) => {
                    let data = String::from_utf8_lossy(&buffer[..size]).to_string();
                    append_output_tail(&reader_output_tail, &data);
                    // The terminal may be interrupted before its next input or an
                    // orderly stop. Persist the bounded redacted tail per output.
                    let _ = persist_live_evidence(
                        &reader_root,
                        &reader_session_id,
                        generation,
                        &reader_shell,
                        &reader_evidence,
                        &reader_output_tail,
                        "running",
                        "",
                    );
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
                id: session_id.clone(),
                generation,
                child,
                master: pair.master,
                writer,
                root: root.clone(),
                evidence,
                output_tail,
            },
        );

    let sessions = state.sessions.lock().map_err(|err| err.to_string())?;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| "终端会话未创建".to_string())?;
    persist_evidence(session, "running", "")?;

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
    session.writer.flush().map_err(|err| err.to_string())?;
    if update_command_summary(session, &input.data) {
        let _ = persist_evidence(session, "running", "");
    }
    Ok(())
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
        persist_evidence(&session, "interrupted", "stopped-by-user")?;
    }
    Ok(())
}

pub fn list_evidence(root: &Path) -> Result<Vec<TerminalSessionEvidence>, String> {
    let directory =
        crate::runtime::state_namespace::state_path_for_read(root, TERMINAL_EVIDENCE_DIRECTORY)
            .unwrap_or_else(|_| root.join(TERMINAL_EVIDENCE_DIRECTORY));
    let mut records = fs::read_dir(directory)
        .ok()
        .into_iter()
        .flatten()
        .filter_map(Result::ok)
        .filter_map(|entry| fs::read_to_string(entry.path()).ok())
        .filter_map(|content| serde_json::from_str::<TerminalSessionEvidence>(&content).ok())
        .collect::<Vec<_>>();
    records.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
    records.truncate(30);
    Ok(records)
}

fn recover_stale_evidence_once(state: &TerminalState, root: &Path) -> Result<(), String> {
    let canonical = root.canonicalize().map_err(|error| error.to_string())?;
    let mut recovered = state
        .recovered_roots
        .lock()
        .map_err(|error| error.to_string())?;
    if !recovered.insert(canonical.clone()) {
        return Ok(());
    }
    for mut record in list_evidence(&canonical)? {
        if record.status != "running" {
            continue;
        }
        record.status = "interrupted".to_string();
        record.end_reason = "runtime-restarted".to_string();
        record.ended_at = current_timestamp();
        record.updated_at = record.ended_at.clone();
        persist_record(&canonical, &record)?;
    }
    Ok(())
}

fn persist_evidence(session: &TerminalSession, status: &str, reason: &str) -> Result<(), String> {
    persist_live_evidence(
        &session.root,
        &session.id,
        session.generation,
        &std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string()),
        &session.evidence,
        &session.output_tail,
        status,
        reason,
    )
}

fn persist_live_evidence(
    root: &Path,
    session_id: &str,
    generation: u64,
    shell: &str,
    evidence: &Arc<Mutex<TerminalEvidenceState>>,
    output_tail: &Arc<Mutex<String>>,
    status: &str,
    reason: &str,
) -> Result<(), String> {
    let now = current_timestamp();
    let output_tail = output_tail
        .lock()
        .map(|value| value.clone())
        .unwrap_or_default();
    let evidence = evidence.lock().map_err(|error| error.to_string())?;
    let record = TerminalSessionEvidence {
        schema_version: TERMINAL_EVIDENCE_SCHEMA_VERSION.to_string(),
        session_id: session_id.to_string(),
        cwd: root.to_string_lossy().to_string(),
        shell: shell.to_string(),
        generation,
        status: status.to_string(),
        started_at: evidence.started_at.clone(),
        updated_at: now.clone(),
        ended_at: if reason.is_empty() {
            String::new()
        } else {
            now
        },
        command_count: evidence.command_count,
        last_command_summary: evidence.last_command.clone(),
        output_tail,
        end_reason: reason.to_string(),
    };
    persist_record(root, &record)
}

fn persist_record(root: &Path, record: &TerminalSessionEvidence) -> Result<(), String> {
    let path = crate::runtime::state_namespace::state_path_for_write(
        root,
        &format!(
            "{TERMINAL_EVIDENCE_DIRECTORY}/{}.json",
            safe_session_id(&record.session_id)
        ),
    )?;
    if let Ok(existing) = fs::read_to_string(&path) {
        if let Ok(existing) = serde_json::from_str::<TerminalSessionEvidence>(&existing) {
            if existing.generation > record.generation {
                // A terminated reader can emit one final buffered chunk. It must never
                // overwrite the evidence created by a newer session with the same id.
                return Ok(());
            }
        }
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let temporary = path.with_extension("json.tmp");
    fs::write(
        &temporary,
        serde_json::to_vec(record).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())?;
    fs::rename(temporary, path).map_err(|error| error.to_string())
}

fn append_output_tail(tail: &Arc<Mutex<String>>, data: &str) {
    let Ok(mut tail) = tail.lock() else {
        return;
    };
    let cleaned = redact_terminal_output(data);
    tail.push_str(&cleaned);
    if tail.chars().count() > MAX_OUTPUT_TAIL {
        *tail = tail
            .chars()
            .rev()
            .take(MAX_OUTPUT_TAIL)
            .collect::<String>()
            .chars()
            .rev()
            .collect();
    }
}

fn update_command_summary(session: &TerminalSession, input: &str) -> bool {
    let Ok(mut evidence) = session.evidence.lock() else {
        return false;
    };
    evidence.input_buffer.push_str(input);
    if !evidence.input_buffer.contains(['\n', '\r']) {
        evidence.input_buffer = evidence
            .input_buffer
            .chars()
            .rev()
            .take(512)
            .collect::<String>()
            .chars()
            .rev()
            .collect();
        return false;
    }
    let submitted = evidence
        .input_buffer
        .split(['\n', '\r'])
        .next()
        .unwrap_or("")
        .chars()
        .filter(|character| !character.is_control())
        .collect::<String>();
    evidence.input_buffer.clear();
    let command = submitted.trim();
    if command.is_empty() || command.starts_with('#') {
        return false;
    }
    evidence.command_count += 1;
    evidence.last_command = if looks_sensitive(command) {
        "[sensitive command omitted]".to_string()
    } else {
        command.chars().take(240).collect()
    };
    true
}

fn looks_sensitive(command: &str) -> bool {
    let lower = command.to_lowercase();
    lower.contains("api_key")
        || lower.contains("apikey")
        || lower.contains("token")
        || lower.contains("secret")
        || lower.contains("password")
        || lower.contains("sk-")
}

fn redact_terminal_output(data: &str) -> String {
    data.lines()
        .map(|line| {
            let cleaned = line
                .chars()
                .filter(|character| !character.is_control())
                .collect::<String>();
            if looks_sensitive(&cleaned) || cleaned.to_lowercase().contains("bearer ") {
                "[sensitive output omitted]".to_string()
            } else {
                cleaned
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn safe_session_id(value: &str) -> String {
    let result = value
        .chars()
        .filter(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
        .take(80)
        .collect::<String>();
    if result.is_empty() {
        "terminal".to_string()
    } else {
        result
    }
}

fn current_timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .to_string()
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

    #[test]
    fn terminal_evidence_is_recovered_as_interrupted_without_full_screen_output() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-terminal-evidence-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ));
        std::fs::create_dir_all(&root).unwrap();
        crate::runtime::state_namespace::ensure_active_state_namespace(&root).unwrap();
        let record = TerminalSessionEvidence {
            schema_version: TERMINAL_EVIDENCE_SCHEMA_VERSION.to_string(),
            session_id: "main".to_string(),
            cwd: root.to_string_lossy().to_string(),
            shell: "/bin/zsh".to_string(),
            generation: 1,
            status: "running".to_string(),
            started_at: "1".to_string(),
            updated_at: "1".to_string(),
            ended_at: String::new(),
            command_count: 1,
            last_command_summary: "npm test".to_string(),
            output_tail: "only a bounded tail".to_string(),
            end_reason: String::new(),
        };
        persist_record(&root, &record).unwrap();
        recover_stale_evidence_once(&TerminalState::default(), &root).unwrap();
        let recovered = list_evidence(&root).unwrap();
        assert_eq!(recovered[0].status, "interrupted");
        assert_eq!(recovered[0].end_reason, "runtime-restarted");
        assert_eq!(recovered[0].output_tail, "only a bounded tail");
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn sensitive_command_detection_never_keeps_the_secret_value() {
        assert!(looks_sensitive("export API_KEY=secret-value"));
        assert!(looks_sensitive("curl -H 'Authorization: Bearer sk-value'"));
        assert!(!looks_sensitive("npm test"));
        assert_eq!(safe_session_id("../../unsafe"), "unsafe");
        assert_eq!(
            redact_terminal_output("API_KEY=value\npassed"),
            "[sensitive output omitted]\npassed"
        );
    }

    #[test]
    fn live_output_updates_the_persisted_terminal_evidence() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-terminal-live-evidence-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ));
        std::fs::create_dir_all(&root).unwrap();
        crate::runtime::state_namespace::ensure_active_state_namespace(&root).unwrap();
        let evidence = Arc::new(Mutex::new(TerminalEvidenceState {
            started_at: "1".to_string(),
            command_count: 1,
            last_command: "npm test".to_string(),
            input_buffer: String::new(),
        }));
        let output = Arc::new(Mutex::new(String::new()));
        append_output_tail(&output, "API_KEY=never-store\nall tests passed\n");
        persist_live_evidence(
            &root, "main", 2, "/bin/zsh", &evidence, &output, "running", "",
        )
        .unwrap();
        let record = list_evidence(&root).unwrap().remove(0);
        assert_eq!(record.command_count, 1);
        assert_eq!(record.last_command_summary, "npm test");
        assert_eq!(
            record.output_tail,
            "[sensitive output omitted]\nall tests passed"
        );
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn stale_terminal_output_cannot_overwrite_a_newer_generation() {
        let root = std::env::temp_dir().join(format!(
            "omnidesk-terminal-generation-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ));
        std::fs::create_dir_all(&root).unwrap();
        crate::runtime::state_namespace::ensure_active_state_namespace(&root).unwrap();
        let newest = TerminalSessionEvidence {
            schema_version: TERMINAL_EVIDENCE_SCHEMA_VERSION.to_string(),
            session_id: "main".to_string(),
            cwd: root.to_string_lossy().to_string(),
            shell: "/bin/zsh".to_string(),
            generation: 2,
            status: "running".to_string(),
            started_at: "2".to_string(),
            updated_at: "2".to_string(),
            ended_at: String::new(),
            command_count: 0,
            last_command_summary: String::new(),
            output_tail: "new output".to_string(),
            end_reason: String::new(),
        };
        persist_record(&root, &newest).unwrap();
        let stale = TerminalSessionEvidence {
            generation: 1,
            output_tail: "stale output".to_string(),
            ..newest.clone()
        };
        persist_record(&root, &stale).unwrap();
        let record = list_evidence(&root).unwrap().remove(0);
        assert_eq!(record.generation, 2);
        assert_eq!(record.output_tail, "new output");
        std::fs::remove_dir_all(root).unwrap();
    }
}
