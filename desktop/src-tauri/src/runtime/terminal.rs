use portable_pty::{Child, MasterPty};
use std::collections::HashMap;
use std::io::Write;
use std::sync::Mutex;

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_match_the_desktop_terminal_contract() {
        assert_eq!(default_session_id(), "main");
        assert_eq!(default_cols(), 100);
        assert_eq!(default_rows(), 28);
    }
}
