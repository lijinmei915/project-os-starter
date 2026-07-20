import assert from "node:assert/strict";
import test from "node:test";

import { createToolGateway, hermesLoopStatuses, runHermesToolLoop } from "../src/agent-runtime/index.js";

test("runs Hermes structured tool calls through the Gateway and returns observations", async () => {
  const gateway = createToolGateway({ accessMode: "browse", projectRoot: "/workspace", handlers: { read_file: async () => ({ content: "ok", summary: "读取完成" }) } });
  const prompts = [
    JSON.stringify({ type: "tool_call", name: "read_file", arguments: { path: "README.md" } }),
    JSON.stringify({ type: "final", result: { diff: "none" } }),
  ];
  const result = await runHermesToolLoop({ gateway, runId: "run-1", transport: { prompt: async ({ step }) => ({ text: prompts[step] }) } });
  assert.equal(result.status, hermesLoopStatuses.completed);
  assert.equal(result.observations[0].success, true);
  assert.equal(result.events[0].status, "ready");
});

test("pauses before write or execute and does not invoke the handler", async () => {
  let called = false;
  const gateway = createToolGateway({ accessMode: "controlled", projectRoot: "/workspace", handlers: { run_check: async () => { called = true; } } });
  const result = await runHermesToolLoop({ gateway, runId: "run-1", transport: { prompt: async () => ({ text: JSON.stringify({ type: "tool_call", name: "run_check", arguments: { checkId: "runtime" } }) }) }, maxSteps: 2 });
  assert.equal(result.status, hermesLoopStatuses.awaitingApproval);
  assert.equal(called, false);
  assert.equal(result.approval.toolCallId, "run-1:tool:0");
});

test("rejects malformed output, unknown tools, and runaway loops", async () => {
  const gateway = createToolGateway({ accessMode: "browse", projectRoot: "/workspace" });
  const malformed = await runHermesToolLoop({ gateway, runId: "run-1", transport: { prompt: async () => ({ text: "not json" }) } });
  assert.equal(malformed.status, hermesLoopStatuses.failed);
  const runaway = await runHermesToolLoop({ gateway, maxSteps: 2, runId: "run-1", transport: { prompt: async () => ({ text: JSON.stringify({ type: "tool_call", name: "unknown" }) }) } });
  assert.equal(runaway.status, hermesLoopStatuses.failed);
});
