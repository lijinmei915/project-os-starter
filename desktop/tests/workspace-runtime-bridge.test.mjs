import assert from "node:assert/strict";
import test from "node:test";

import {
  copyTextToSystemClipboard,
  loadWorkspaceSnapshot,
  pickProjectDirectory,
  refreshWorkspaceFactsPreview,
} from "../src/lib/workspace-runtime-bridge.js";

const response = (payload, ok = true) => ({ ok, json: async () => payload });

test("loads Preview and native Workspace snapshots through their explicit transports", async () => {
  const preview = await loadWorkspaceSnapshot({
    fetchImpl: async () => response({ projectName: "Preview" }),
    isTauri: false,
  });
  assert.equal(preview.projectName, "Preview");

  const calls = [];
  const native = await loadWorkspaceSnapshot({
    invoke: async (...args) => {
      calls.push(args);
      return { projectName: "Native" };
    },
    isTauri: true,
  });
  assert.equal(native.projectName, "Native");
  assert.deepEqual(calls, [["get_workspace_snapshot"]]);
});

test("falls back to the read-only Preview client and refreshes only projected facts", async () => {
  const fetchImpl = async () => response({}, false);
  const previewCalls = [];
  const snapshot = await loadWorkspaceSnapshot({
    fetchImpl,
    isTauri: false,
    loadPreview: async (receivedFetch) => {
      previewCalls.push(receivedFetch);
      return { workspaceFacts: { status: "fresh" } };
    },
  });
  assert.equal(snapshot.workspaceFacts.status, "fresh");
  assert.deepEqual(previewCalls, [fetchImpl]);

  const refreshed = await refreshWorkspaceFactsPreview({
    isTauri: false,
    loadSnapshot: async () => snapshot,
    now: () => "2026-07-22T00:00:00.000Z",
  });
  assert.deepEqual(refreshed, { status: "fresh", generatedAt: "2026-07-22T00:00:00.000Z" });
});

test("keeps system clipboard and directory selection behind the native boundary", async () => {
  const calls = [];
  const result = await copyTextToSystemClipboard("hello", {
    invoke: async (...args) => calls.push(args),
    isTauri: true,
    location: { hostname: "app.localhost" },
  });
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(calls, [["copy_text_to_clipboard", { text: "hello" }]]);

  await assert.rejects(
    () => pickProjectDirectory({ isTauri: false }),
    /浏览器预览模式暂不支持系统目录选择器/,
  );
});
