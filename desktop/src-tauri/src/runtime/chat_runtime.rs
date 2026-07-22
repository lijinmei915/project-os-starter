use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use tokio_util::sync::CancellationToken;

/// Tracks only active network requests. Durable conversation and task state belongs to
/// their own Runtime services, so cancelling a request never discards user history.
#[derive(Default)]
pub struct RuntimeRequestState {
    requests: Mutex<HashMap<String, CancellationToken>>,
}

impl RuntimeRequestState {
    pub fn start(&self, request_id: &str) -> CancellationToken {
        let token = CancellationToken::new();
        self.requests
            .lock()
            .expect("request registry lock poisoned")
            .insert(request_id.to_string(), token.clone());
        token
    }

    pub fn finish(&self, request_id: &str) {
        self.requests
            .lock()
            .expect("request registry lock poisoned")
            .remove(request_id);
    }

    pub fn cancel(&self, request_id: &str) -> bool {
        let token = self
            .requests
            .lock()
            .expect("request registry lock poisoned")
            .get(request_id)
            .cloned();
        if let Some(token) = token {
            token.cancel();
            true
        } else {
            false
        }
    }
}

pub fn emit_conversation_event(
    app: &AppHandle,
    request_id: &str,
    event_type: &str,
    phase: &str,
    status: &str,
    payload: Value,
) {
    if request_id.is_empty() {
        return;
    }
    let timestamp = timestamp_string();
    let _ = app.emit(
        "runtime://conversation-event",
        json!({
            "schemaVersion": "omnidesk.conversation-event.v0.1",
            "id": format!("{}:{}:{}", request_id, event_type, timestamp),
            "type": event_type,
            "phase": phase,
            "status": status,
            "actor": "assistant",
            "requestId": request_id,
            "timestamp": timestamp,
            "payload": payload,
        }),
    );
}

fn timestamp_string() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::RuntimeRequestState;

    #[test]
    fn cancels_only_active_requests_and_releases_finished_ones() {
        let state = RuntimeRequestState::default();
        let token = state.start("request-a");

        assert!(state.cancel("request-a"));
        assert!(token.is_cancelled());

        state.finish("request-a");
        assert!(!state.cancel("request-a"));
        assert!(!state.cancel("unknown"));
    }
}
