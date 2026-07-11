import assert from "node:assert/strict";
import test from "node:test";
import { buildConversationRecord, buildDialogueContextState, mergeConversationRecords } from "../src/lib/conversation-record.js";

test("builds a compact project conversation record", () => {
  const record = buildConversationRecord({
    id: "conv-1",
    updatedAt: "2026-07-11T00:00:00Z",
    turns: [{ id: "u1", role: "user", text: "  检查   对话持久化  " }, { id: "a1", role: "assistant", text: "已完成。" }],
  });
  assert.equal(record.title, "检查 对话持久化");
  assert.equal(record.preview, "已完成。");
  assert.equal(record.contextState.currentTopic, "检查 对话持久化");
  assert.equal(record.contextState.previousConclusion, "已完成。");
});

test("keeps the prior conclusion and user delegation for follow-up turns", () => {
  const state = buildDialogueContextState([
    { id: "u1", role: "user", text: "这个项目当前有什么风险？" },
    { id: "a1", role: "assistant", text: "当前主要风险是对话缺少连续状态。" },
    { id: "u2", role: "user", text: "你自己判断，直接修" },
  ]);
  assert.equal(state.currentTopic, "这个项目当前有什么风险？");
  assert.equal(state.previousConclusion, "当前主要风险是对话缺少连续状态。");
  assert.equal(state.userDelegation, "你自己判断，直接修");
  assert.equal(state.expectedNextAction, "apply-fix");
  assert.equal(state.lastIntent, "task");
});

test("keeps the latest record and removes same-title duplicates", () => {
  const record = { id: "conv-new", title: "同一任务" };
  const merged = mergeConversationRecords([{ id: "conv-old", title: "同一任务" }, { id: "other", title: "其他" }], record);
  assert.deepEqual(merged, [record, { id: "other", title: "其他" }]);
});
