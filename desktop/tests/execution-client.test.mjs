import assert from "node:assert/strict";
import test from "node:test";

import { buildApprovedAgentContinuationPrompt, generatePatchDraft, runGuardedCheck, runHermesAgent, submitAgentInteraction } from "../src/lib/execution-client.js";

test("continues an approved Agent Run with the controlled tool outcome", () => {
  const prompt = buildApprovedAgentContinuationPrompt(
    { prompt: "修复 README", requestId: "run-1" },
    { success: true, summary: "Patch 已应用" },
  );
  assert.match(prompt, /修复 README/);
  assert.match(prompt, /Patch 已应用/);
  assert.match(prompt, /不要重复该操作/);
  assert.throws(() => buildApprovedAgentContinuationPrompt({}, {}), /缺少原始任务/);
});

test("allows only read-only patch drafts in Preview", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push([url, JSON.parse(options.body)]);
    return { ok: true, json: async () => ({ success: true }) };
  };
  try {
    await assert.rejects(() => runGuardedCheck("runtime"), /桌面 App/);
    await generatePatchDraft({ id: "task-1" });
    assert.deepEqual(requests, [["/__omnidesk/generate-patch-draft", { task: { id: "task-1" } }]]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("binds Hermes runs to their conversation and submits a persisted user interaction", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push([url, JSON.parse(options.body)]);
    return { ok: true, json: async () => ({ id: "run-1", status: "queued" }) };
  };
  try {
    await assert.rejects(
      () => runHermesAgent("需要确认", "request-1", 4, "", { conversationId: "conversation-1", taskId: "task-1" }),
      /桌面 App/,
    );
    await assert.rejects(
      () => submitAgentInteraction({ id: "run-1", checkpoint: { interaction: { id: "ask-user-1" } } }, { answers: { scope: "team" } }),
      /桌面 App/,
    );
    assert.equal(requests.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
