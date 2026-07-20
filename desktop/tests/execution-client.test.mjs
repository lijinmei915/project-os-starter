import assert from "node:assert/strict";
import test from "node:test";

import { buildApprovedAgentContinuationPrompt, generatePatchDraft, runGuardedCheck } from "../src/lib/execution-client.js";

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
    assert.deepEqual(requests, [["/__project-os/generate-patch-draft", { task: { id: "task-1" } }]]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
