#![allow(dead_code)]

#[path = "../runtime/mod.rs"]
mod runtime;

use runtime::chat_content::DialogueContextInput;
use runtime::provider::{ProviderConfig, PROVIDER_SCHEMA_VERSION};
use serde::Deserialize;
use serde_json::{json, Value};
use std::fs;
use std::io::{self, Read};
use std::path::PathBuf;
use std::time::Instant;

const REQUEST_SCHEMA: &str = "omnidesk.provider-fallback-eval-request.v0.1";
const RESULT_SCHEMA: &str = "omnidesk.provider-fallback-runtime-result.v0.1";
const CAPABILITY_PATH: &str = ".omnidesk/cache/provider-tool-capabilities.json";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct EvalRequest {
    schema_version: String,
    project_root: String,
    project_id: String,
    proxy_api_base: String,
    model: String,
}

#[tokio::main]
async fn main() {
    let mut input = String::new();
    if let Err(error) = io::stdin().read_to_string(&mut input) {
        fail(format!(
            "cannot read Provider Fallback Eval request: {error}"
        ));
    }
    let request = serde_json::from_str::<EvalRequest>(&input).unwrap_or_else(|error| {
        fail(format!(
            "invalid Provider Fallback Eval request JSON: {error}"
        ))
    });
    let result = match run(request).await {
        Ok(result) => result,
        Err(error) => fail(error),
    };
    println!(
        "{}",
        serde_json::to_string(&result).expect("Provider Fallback Eval result must serialize")
    );
}

async fn run(request: EvalRequest) -> Result<Value, String> {
    if request.schema_version != REQUEST_SCHEMA {
        return Err("unsupported Provider Fallback Eval request schema".to_string());
    }
    if request.project_id.trim().is_empty()
        || request.proxy_api_base.trim().is_empty()
        || request.model.trim().is_empty()
    {
        return Err("Provider Fallback Eval requires project, proxy, and model values".to_string());
    }
    let project_root = existing_directory(&request.project_root)?;
    runtime::state_namespace::ensure_active_state_namespace(&project_root)?;
    let provider = ProviderConfig {
        schema_version: PROVIDER_SCHEMA_VERSION.to_string(),
        provider: "openai-compatible".to_string(),
        model: request.model,
        api_base: request.proxy_api_base,
        api_key_env: "OMNIDESK_AGENT_EVAL_KEY".to_string(),
        enabled: true,
        active_profile_id: "provider-fallback-eval".to_string(),
        profiles: Vec::new(),
    };

    let fallback_started = Instant::now();
    let mut fallback_delta_events = 0_usize;
    let fallback = runtime::chat_stream::generate_provider_chat(
        &provider,
        &project_root,
        "Provider Fallback Eval",
        "stabilizing",
        "帮我改 README 中的过期启动命令。",
        &[],
        &[],
        &DialogueContextInput::default(),
        false,
        &json!({}),
        &[],
        &json!({}),
        |_, _| fallback_delta_events += 1,
    )
    .await
    .map_err(|error| error.message)?;
    let fallback_duration_ms = fallback_started.elapsed().as_millis() as u64;

    let capability = runtime::repository::Repository::new(&project_root)
        .read_json(CAPABILITY_PATH)
        .and_then(|cache| {
            cache
                .get("entries")
                .and_then(Value::as_array)
                .and_then(|entries| entries.first())
                .cloned()
        })
        .ok_or_else(|| "Provider fallback did not persist capability evidence".to_string())?;

    let mut interruption_delta_events = 0_usize;
    let interruption = runtime::chat_stream::generate_provider_chat(
        &provider,
        &project_root,
        "Provider Fallback Eval",
        "stabilizing",
        "请说明当前 README 的作用。",
        &[],
        &[],
        &DialogueContextInput::default(),
        false,
        &json!({}),
        &[],
        &json!({}),
        |_, _| interruption_delta_events += 1,
    )
    .await
    .err()
    .ok_or_else(|| "fault-injected Provider stream unexpectedly completed".to_string())?;

    Ok(json!({
        "schemaVersion": RESULT_SCHEMA,
        "projectId": request.project_id,
        "fallback": {
            "responseMode": fallback.response_mode,
            "shouldCreatePlan": fallback.should_create_plan,
            "replyChars": fallback.reply.chars().count(),
            "deltaEvents": fallback_delta_events,
            "durationMs": fallback_duration_ms,
        },
        "capability": {
            "mode": capability.get("mode").cloned().unwrap_or(Value::Null),
            "source": capability.get("source").cloned().unwrap_or(Value::Null),
        },
        "interruption": {
            "partialReplyChars": interruption.partial_reply.chars().count(),
            "deltaEvents": interruption_delta_events,
            "errorPresent": !interruption.message.trim().is_empty(),
        },
    }))
}

fn existing_directory(value: &str) -> Result<PathBuf, String> {
    let path = fs::canonicalize(value).map_err(|error| format!("invalid project root: {error}"))?;
    if !path.is_dir() {
        return Err("project root must be a directory".to_string());
    }
    Ok(path)
}

fn fail(error: String) -> ! {
    eprintln!("{error}");
    std::process::exit(2);
}
