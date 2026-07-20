import assert from "node:assert/strict";
import test from "node:test";

import {
  deleteDesktopTask,
  listDesktopTasks,
  saveDesktopTask,
} from "../src/lib/desktop-task-client.js";

test("reads tasks from the preview endpoint", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => [{ id: "task-1" }] };
  };
  try {
    assert.deepEqual(await listDesktopTasks(), [{ id: "task-1" }]);
    assert.equal(request.url, "/__project-os/desktop-tasks");
    assert.equal(request.options, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("keeps task writes desktop-only in Preview", async () => {
  await assert.rejects(() => saveDesktopTask({ id: "task-1", title: "检查" }), /桌面 App/);
  await assert.rejects(() => deleteDesktopTask("task-1"), /桌面 App/);
});
