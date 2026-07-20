#[path = "../runtime/patch.rs"]
mod patch;

use serde::{Deserialize, Serialize};
use std::io::{self, Read};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct NormalizeRequest {
    diff: String,
    contexts: Vec<PatchContext>,
}

#[derive(Deserialize)]
struct PatchContext {
    path: String,
    content: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NormalizeResponse {
    normalized_diff: String,
}

fn main() {
    let mut input = String::new();
    if let Err(error) = io::stdin().read_to_string(&mut input) {
        fail(format!("无法读取标准输入：{error}"));
    }

    let request: NormalizeRequest = match serde_json::from_str(&input) {
        Ok(request) => request,
        Err(error) => fail(format!("规范化请求不是合法 JSON：{error}")),
    };
    let contexts = request
        .contexts
        .into_iter()
        .map(|context| (context.path, context.content))
        .collect::<Vec<_>>();
    let normalized_diff = match patch::normalize_hermes_unified_diff(&request.diff, &contexts) {
        Ok(diff) => diff,
        Err(error) => fail(error),
    };
    println!(
        "{}",
        serde_json::to_string(&NormalizeResponse { normalized_diff })
            .expect("normalizer response must serialize")
    );
}

fn fail(error: String) -> ! {
    eprintln!("{error}");
    std::process::exit(2);
}
