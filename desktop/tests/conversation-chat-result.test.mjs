import assert from "node:assert/strict";
import test from "node:test";
import { resolveConversationChatResult } from "../src/lib/conversation-chat-result.js";

const base = {
  attachments: [],
  chatWithModel: async () => ({ intent: "chat", reply: "模型回答" }),
  localStatusReply: () => "连接状态",
  message: "你好",
  previewChatResult: () => ({ intent: "preview", reply: "预览回答" }),
  provider: {},
  providerHealth: {},
  requestContext: { contextState: {}, recentTurns: [{ role: "user" }], summary: "" },
  snapshot: {},
  tasks: [],
  withTimeout: (promise) => promise,
};

test("uses deterministic task and local status replies before any model request", async () => {
  const task = await resolveConversationChatResult({ ...base, isTauri: true, messageKind: "task" });
  const status = await resolveConversationChatResult({ ...base, isTauri: true, messageKind: "model-status" });
  assert.equal(task.shouldCreatePlan, true);
  assert.equal(status.reply, "连接状态");
});

test("keeps preview and desktop model pathways injected", async () => {
  const preview = await resolveConversationChatResult({ ...base, isTauri: false, messageKind: "chat" });
  const desktop = await resolveConversationChatResult({ ...base, isTauri: true, messageKind: "chat" });
  assert.equal(preview.intent, "preview");
  assert.equal(desktop.reply, "模型回答");
});

test("forwards only the selected project memory to the desktop chat request", async () => {
  let input;
  await resolveConversationChatResult({
    ...base,
    isTauri: true,
    requestContext: { ...base.requestContext, projectMemory: [{ id: "memory-1", content: "不要修改生产配置" }] },
    chatWithModel: async (value) => { input = value; return { intent: "chat", reply: "模型回答" }; },
    messageKind: "chat",
  });
  assert.deepEqual(input.projectMemory, [{ id: "memory-1", content: "不要修改生产配置" }]);
});
