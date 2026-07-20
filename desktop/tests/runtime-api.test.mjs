import assert from "node:assert/strict";
import test from "node:test";
import { invokePreviewCommand, isTauriRuntime } from "../src/lib/runtime-api.js";

test("reports a non-Tauri environment without a window", () => {
  assert.equal(isTauriRuntime(), false);
});

test("does not inherit a host app Tauri bridge in browser preview", () => {
  const originalWindow = globalThis.window;
  globalThis.window = { __TAURI_INTERNALS__: {}, location: { hostname: "127.0.0.1", port: "1421", protocol: "http:" } };
  try { assert.equal(isTauriRuntime(), false); } finally { globalThis.window = originalWindow; }
});

test("accepts the OmniDesk Tauri development origin", () => {
  const originalWindow = globalThis.window;
  globalThis.window = { __TAURI_INTERNALS__: {}, location: { hostname: "127.0.0.1", port: "1420", protocol: "http:" } };
  try { assert.equal(isTauriRuntime(), true); } finally { globalThis.window = originalWindow; }
});

test("accepts the isolated native WebDriver origin only with a Tauri bridge", () => {
  const originalWindow = globalThis.window;
  globalThis.window = { __TAURI_INTERNALS__: {}, location: { hostname: "127.0.0.1", port: "1422", protocol: "http:" } };
  try { assert.equal(isTauriRuntime(), true); } finally { globalThis.window = originalWindow; }
});

test("rejects unsupported preview commands instead of falling through", async () => {
  await assert.rejects(() => invokePreviewCommand("unknown_command", { input: {} }), /浏览器预览/);
});

for (const command of [
  "save_provider_config", "test_provider_model_with_cache", "probe_provider_models", "delete_provider_profile",
  "save_desktop_conversation", "save_desktop_task", "delete_desktop_task", "delete_desktop_conversation",
  "save_project_memory", "run_guarded_check", "rename_registry_project",
  "update_project_capability", "run_goal_validation", "sign_off_goal_validation", "create_goal",
]) {
  test(`keeps ${command} desktop-only in Preview`, async () => {
    await assert.rejects(() => invokePreviewCommand(command, { input: {} }), /桌面 App/);
  });
}

test("routes patch drafts through the Preview read-only endpoint", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => { request = { url, options }; return { ok: true, json: async () => ({ diff: "PATCH_DRAFT_PENDING", files: [] }) }; };
  try {
    const task = { id: "task-1", plan: { candidateChanges: [] } };
    assert.deepEqual(await invokePreviewCommand("generate_patch_draft", { input: { task } }), { diff: "PATCH_DRAFT_PENDING", files: [] });
    assert.equal(request.url, "/__project-os/generate-patch-draft");
  } finally { globalThis.fetch = originalFetch; }
});

test("routes Hermes executor detection through the Preview read-only endpoint", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ id: "hermes", protocol: "acp", status: "not-installed" }) });
  try { assert.equal((await invokePreviewCommand("get_hermes_executor_status", {})).status, "not-installed"); } finally { globalThis.fetch = originalFetch; }
});
