#![allow(dead_code)]

#[path = "../runtime/mod.rs"]
mod runtime;

use runtime::agent_scheduler::ClaimOutcome;
use serde::Deserialize;
use serde_json::{json, Value};
use std::fs;
use std::io::{self, Read};
use std::path::{Path, PathBuf};
use std::sync::{mpsc, Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio_util::sync::CancellationToken;

const REQUEST_SCHEMA: &str = "omnidesk.provider-timeline-eval-request.v0.1";
const RESULT_SCHEMA: &str = "omnidesk.provider-timeline-runtime-result.v0.1";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct EvalRequest {
    schema_version: String,
    app_root: String,
    project_root: String,
    project_id: String,
    prompt: String,
    max_steps: usize,
    #[serde(default)]
    readonly_files: bool,
}

fn main() {
    let mut input = String::new();
    if let Err(error) = io::stdin().read_to_string(&mut input) {
        fail(format!(
            "cannot read Provider Timeline Eval request: {error}"
        ));
    }
    let request = serde_json::from_str::<EvalRequest>(&input).unwrap_or_else(|error| {
        fail(format!(
            "invalid Provider Timeline Eval request JSON: {error}"
        ))
    });
    let result = match run(request) {
        Ok(result) => result,
        Err(error) => fail(error),
    };
    println!(
        "{}",
        serde_json::to_string(&result).expect("Provider Timeline Eval result must serialize")
    );
}

fn run(request: EvalRequest) -> Result<Value, String> {
    if request.schema_version != REQUEST_SCHEMA {
        return Err("unsupported Provider Timeline Eval request schema".to_string());
    }
    if request.prompt.trim().is_empty() || !(1..=8).contains(&request.max_steps) {
        return Err("Provider Timeline Eval requires a bounded prompt and maxSteps".to_string());
    }
    let api_key = std::env::var("OMNIDESK_AGENT_EVAL_KEY")
        .map_err(|_| "Provider Timeline Eval key is unavailable".to_string())?;
    let api_base = std::env::var("OMNIDESK_AGENT_EVAL_API_BASE")
        .map_err(|_| "Provider Timeline Eval API base is unavailable".to_string())?;
    let model = std::env::var("OMNIDESK_AGENT_EVAL_MODEL")
        .map_err(|_| "Provider Timeline Eval model is unavailable".to_string())?;
    if api_key.trim().is_empty() || api_base.trim().is_empty() || model.trim().is_empty() {
        return Err("Provider Timeline Eval requires non-empty Provider credentials and model".to_string());
    }
    let app_root = existing_directory(&request.app_root, "app root")?;
    let project_root = existing_directory(&request.project_root, "project root")?;
    runtime::state_namespace::ensure_active_state_namespace(&app_root)?;

    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let run_id = format!("provider-timeline-eval-{nonce}");
    let started_at = timestamp();
    runtime::agent_scheduler::enqueue(&app_root, &run_id, &request.project_id, &started_at)?;
    let (claim, lease) = runtime::agent_scheduler::try_claim(&app_root, &run_id, &started_at)?;
    if claim != ClaimOutcome::Claimed {
        return Err("Provider Timeline Eval could not claim the scheduler slot".to_string());
    }
    let lease =
        lease.ok_or_else(|| "Provider Timeline Eval claimed no scheduler lease".to_string())?;
    let scheduler_during = scheduler_status(&app_root, &run_id)?;
    let prepared = runtime::agent_runs::prepare_model_run(
        &app_root,
        runtime::agent_runs::PrepareModelRunInput {
            run_id: run_id.clone(),
            request_id: format!("{run_id}-request"),
            project_id: request.project_id.clone(),
            prompt: request.prompt,
            max_steps: request.max_steps,
            approval_token: String::new(),
            conversation_id: format!("{run_id}-conversation"),
            task_id: format!("{run_id}-task"),
            resume_existing: false,
            isolation: None,
        },
        &timestamp(),
    )?;

    let model_started = Instant::now();
    let cancellation = CancellationToken::new();
    let deadline_exceeded = Arc::new(AtomicBool::new(false));
    let deadline_flag = deadline_exceeded.clone();
    let deadline_token = cancellation.clone();
    let (finished_tx, finished_rx) = mpsc::channel::<()>();
    let deadline_worker = std::thread::spawn(move || {
        if matches!(finished_rx.recv_timeout(Duration::from_secs(100)), Err(mpsc::RecvTimeoutError::Timeout)) {
            deadline_flag.store(true, Ordering::SeqCst);
            deadline_token.cancel();
        }
    });
    let live_events = Arc::new(Mutex::new(Vec::new()));
    let captured_events = live_events.clone();
    let event_sink: runtime::agent_executor::AgentEventSink = Arc::new(move |event| {
        if let Ok(mut events) = captured_events.lock() {
            events.push(event.clone());
        }
    });
    let model_result = runtime::hermes_execution::run_structured_loop_with_mode(
        &project_root,
        &api_key,
        &api_base,
        "OMNIDESK_AGENT_EVAL_KEY",
        &model,
        &prepared.execution_prompt,
        request.max_steps,
        Some(&cancellation),
        runtime::agent_executor::AgentExecutionMode::Start,
        if request.readonly_files {
            runtime::agent_executor::AgentExecutionPurpose::ReadonlyPlan
        } else {
            runtime::agent_executor::AgentExecutionPurpose::GovernedTask
        },
        Some(event_sink),
    );
    drop(finished_tx);
    let _ = deadline_worker.join();
    let model_deadline_exceeded = deadline_exceeded.load(Ordering::SeqCst);
    let captured_events = live_events.lock().map(|events| events.clone()).unwrap_or_default();
    let duration_ms = model_started.elapsed().as_millis() as u64;
    // The general timeline intentionally omits paths. Preserve only the fixed
    // non-sensitive fixture path for this explicit file-read acceptance slice.
    let readonly_tool_events = if request.readonly_files {
            captured_events.iter().filter(|event| {
                matches!(event.kind.as_str(), "tool-call" | "tool-result")
                    && event.details.get("name").and_then(Value::as_str) == Some("read_file")
                    && event.details.get("path").and_then(Value::as_str) == Some("README.md")
            }).map(|event| json!({
                "kind": event.kind,
                "status": event.status,
                "details": { "name": "read_file", "path": "README.md", "success": event.details.get("success") }
            })).collect::<Vec<_>>()
    } else {
        Vec::new()
    };
    let (status, summary, step, approval, interaction, evidence_details, usage) = match model_result
    {
        Ok(result) => {
            let transport_status = result.status.clone();
            let succeeded = transport_status == "succeeded";
            let status = if succeeded { "succeeded" } else { "failed" }.to_string();
            let summary = if succeeded {
                result.summary.clone()
            } else {
                format!(
                    "Provider Timeline Eval reached unexpected model boundary: {transport_status}"
                )
            };
            let step = Some(result.step);
            let usage = serde_json::to_value(&result.usage).map_err(|error| error.to_string())?;
            let details = json!({
                "step": result.step,
                "transportStatus": transport_status,
                "agentEvents": result.events,
                "trace": result.trace,
                "observations": result.observations,
                "interaction": result.interaction,
                "durationMs": duration_ms,
                "usage": usage,
            });
            (status, summary, step, None, None, details, usage)
        }
        Err(error) => {
            let summary = if model_deadline_exceeded {
                "Provider Timeline Eval exceeded the 100-second model deadline; execution cancelled".to_string()
            } else {
                bounded_error(&error)
            };
            (
                "failed".to_string(),
                summary.clone(),
                None,
                None,
                None,
                json!({ "error": summary, "durationMs": duration_ms, "agentEvents": captured_events, "modelDeadlineExceeded": model_deadline_exceeded }),
                Value::Null,
            )
        }
    };
    let settled = runtime::agent_runs::settle_model_run(
        &app_root,
        prepared.run,
        runtime::agent_runs::ModelRunCompletion {
            status: status.clone(),
            summary: summary.clone(),
            step,
            approval,
            interaction,
            evidence_details,
        },
        &timestamp(),
    )?;
    let scheduler_terminal = if status == "succeeded" {
        "completed"
    } else {
        "failed"
    };
    lease.settle(scheduler_terminal, &timestamp())?;
    let timeline = runtime::agent_runs::export_timeline(&app_root, &run_id, &timestamp())?;
    let scheduler_after = runtime::agent_scheduler::snapshot(&app_root)?;

    Ok(json!({
        "schemaVersion": RESULT_SCHEMA,
        "status": if status == "succeeded" { "passed" } else { "failed" },
        "runStatus": settled.status,
        "summary": summary,
        "durationMs": duration_ms,
        "modelDeadlineExceeded": model_deadline_exceeded,
        "usage": usage,
        "readonlyToolEvents": readonly_tool_events,
        "scheduler": {
            "statusDuringExecution": scheduler_during,
            "activeCountAfter": scheduler_after.active_count,
            "remainingEntriesAfter": scheduler_after.entries.len(),
        },
        "timeline": timeline["timeline"].clone(),
    }))
}

fn scheduler_status(root: &Path, run_id: &str) -> Result<String, String> {
    runtime::agent_scheduler::snapshot(root)?
        .entries
        .into_iter()
        .find(|entry| entry.run_id == run_id)
        .map(|entry| entry.status)
        .ok_or_else(|| "Provider Timeline Eval scheduler entry disappeared".to_string())
}

fn existing_directory(value: &str, label: &str) -> Result<PathBuf, String> {
    let path = fs::canonicalize(value).map_err(|error| format!("invalid {label}: {error}"))?;
    if !path.is_dir() {
        return Err(format!("{label} must be a directory"));
    }
    Ok(path)
}

fn bounded_error(error: &str) -> String {
    error.chars().take(2000).collect()
}

fn timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .to_string()
}

fn fail(error: String) -> ! {
    eprintln!("{error}");
    std::process::exit(2);
}
