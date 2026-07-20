import assert from "node:assert/strict";
import test from "node:test";

import {
  deleteDesktopConversation,
  listDesktopConversations,
  saveDesktopConversation,
} from "../src/lib/desktop-conversation-client.js";

test("reads conversations from the preview endpoint", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => [{ id: "conv-1" }] };
  };
  try {
    assert.deepEqual(await listDesktopConversations(), [{ id: "conv-1" }]);
    assert.equal(request.url, "/__project-os/desktop-conversations");
    assert.equal(request.options, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("keeps conversation writes desktop-only in Preview", async () => {
  await assert.rejects(() => saveDesktopConversation({ id: "conv-1", title: "检查" }), /桌面 App/);
  await assert.rejects(() => deleteDesktopConversation("conv-1"), /桌面 App/);
});
