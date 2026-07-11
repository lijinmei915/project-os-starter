import assert from "node:assert/strict";
import test from "node:test";
import { invokePreviewCommand, isTauriRuntime } from "../src/lib/runtime-api.js";

test("reports a non-Tauri environment without a window", () => {
  assert.equal(isTauriRuntime(), false);
});

test("rejects unsupported preview commands instead of falling through", async () => {
  await assert.rejects(
    () => invokePreviewCommand("save_provider_config", { input: {} }),
    /浏览器预览/
  );
});

test("keeps conversation persistence inside the preview command contract", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ id: "conv-1" }) };
  };
  try {
    const result = await invokePreviewCommand("save_desktop_conversation", {
      conversation: { id: "conv-1" },
    });
    assert.equal(request.url, "/__project-os/save-desktop-conversation");
    assert.deepEqual(JSON.parse(request.options.body), { conversation: { id: "conv-1" } });
    assert.deepEqual(result, { id: "conv-1" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
