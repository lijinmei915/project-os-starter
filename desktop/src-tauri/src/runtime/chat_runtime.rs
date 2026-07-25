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

pub struct RuntimeRequestLease<'a> {
    state: &'a RuntimeRequestState,
    request_id: String,
    token: CancellationToken,
}

impl RuntimeRequestLease<'_> {
    pub fn token(&self) -> CancellationToken {
        self.token.clone()
    }
}

impl Drop for RuntimeRequestLease<'_> {
    fn drop(&mut self) {
        self.state.finish(&self.request_id);
    }
}

impl RuntimeRequestState {
    pub fn try_lease(&self, request_id: &str) -> Result<RuntimeRequestLease<'_>, String> {
        let token = CancellationToken::new();
        let mut requests = self
            .requests
            .lock()
            .expect("request registry lock poisoned");
        if requests.contains_key(request_id) {
            return Err("该执行请求仍在活动中，请等待或先停止当前请求。".to_string());
        }
        requests.insert(request_id.to_string(), token.clone());
        drop(requests);
        Ok(RuntimeRequestLease {
            state: self,
            request_id: request_id.to_string(),
            token,
        })
    }

    pub fn lease(&self, request_id: &str) -> RuntimeRequestLease<'_> {
        RuntimeRequestLease {
            state: self,
            request_id: request_id.to_string(),
            token: self.start(request_id),
        }
    }

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

    #[test]
    fn scoped_request_lease_cleans_up_on_early_return() {
        let state = RuntimeRequestState::default();
        {
            let lease = state.lease("request-scoped");
            assert!(state.cancel("request-scoped"));
            assert!(lease.token().is_cancelled());
        }
        assert!(!state.cancel("request-scoped"));
    }

    #[test]
    fn rejects_a_duplicate_scoped_request_without_replacing_its_token() {
        let state = RuntimeRequestState::default();
        let first = state.try_lease("request-scoped").unwrap();
        assert!(state.try_lease("request-scoped").is_err());
        assert!(state.cancel("request-scoped"));
        assert!(first.token().is_cancelled());
        drop(first);
        assert!(state.try_lease("request-scoped").is_ok());
    }
}
