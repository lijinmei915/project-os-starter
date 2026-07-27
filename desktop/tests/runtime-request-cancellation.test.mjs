import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(here, "..");
const read = (relative) => fs.readFileSync(path.join(desktopRoot, relative), "utf8");

test("carries the active request id through chat, plan, and the native cancellation boundary", () => {
  const chatResult = read("src/lib/conversation-chat-result.js");
  const plan = read("src/components/workbench/use-plan-action.js");
  const requestState = read("src/components/workbench/use-conversation-request-state.js");
  const client = read("src/lib/desktop-conversation-client.js");
  const runtime = read("src-tauri/src/runtime/app.rs");
  const chatRuntime = read("src-tauri/src/runtime/chat_runtime.rs");
  const acpExecution = read("src-tauri/src/runtime/acp_execution.rs");
  const hermesAdapter = read("src-tauri/src/runtime/hermes_executor.rs");

  assert.match(chatResult, /requestId,/);
  assert.match(plan, /cancelRuntimeRequest\?\.\(requestId\)/);
  assert.match(requestState, /cancelRuntimeRequest\?\.\(requestId\)/);
  assert.match(client, /cancel_runtime_request/);
  assert.match(runtime, /chat_runtime::\{emit_conversation_event, RuntimeRequestState\}/);
  assert.match(chatRuntime, /pub struct RuntimeRequestState/);
  assert.match(chatRuntime, /pub fn emit_conversation_event/);
  assert.match(runtime, /tokio::select!/);
  assert.match(runtime, /cancellation,/);
  assert.match(runtime, /executor\.execute\(AgentExecutionRequest/);
  assert.match(hermesAdapter, /request\.cancellation\.as_ref\(\)/);
  assert.match(acpExecution, /CancellationToken::is_cancelled/);
  assert.match(runtime, /runtime_requests\.finish\(&request_id\)/);
});
