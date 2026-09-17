import assert from "node:assert/strict";
import test from "node:test";
import { groupConversations, isLowSignalConversationText, visibleConversationPreview } from "../src/lib/conversation-list.js";

test("keeps task-bound conversations out of the general history list", () => {
  const groups = groupConversations([
    { id: "general", title: "风险讨论", updatedAt: "2026-07-18T09:00:00Z" },
    { id: "task", taskId: "task-1", title: "修复发送", updatedAt: "2026-07-18T10:00:00Z" },
  ], { now: Date.parse("2026-07-18T11:00:00Z") });
  assert.deepEqual(groups.map((group) => group.label), ["今天"]);
  assert.deepEqual(groups[0].items.map((item) => item.id), ["general"]);
});

test("keeps archived conversations out of the history list", () => {
  const conversations = [
    { id: "active", title: "当前对话", updatedAt: "2026-07-18T10:00:00Z" },
    { archivedAt: "2026-07-18T11:00:00Z", id: "archived", title: "旧对话", updatedAt: "2026-07-18T09:00:00Z" },
  ];
  assert.deepEqual(groupConversations(conversations).flatMap((group) => group.items).map((item) => item.id), ["active"]);
});

test("groups conversations by local calendar day instead of a rolling 24-hour window", () => {
  const now = new Date(2026, 6, 28, 0, 30).getTime();
  const groups = groupConversations([
    { id: "today", title: "今天", updatedAt: new Date(2026, 6, 28, 0, 10).toISOString() },
    { id: "yesterday-recent", title: "昨天但不足 24 小时", updatedAt: new Date(2026, 6, 27, 23, 50).toISOString() },
    { id: "earlier", title: "更早", updatedAt: new Date(2026, 6, 26, 23, 50).toISOString() },
  ], { now });

  assert.deepEqual(groups.map((group) => [group.label, group.items.map((item) => item.id)]), [
    ["今天", ["today"]],
    ["昨天", ["yesterday-recent"]],
    ["更早", ["earlier"]],
  ]);
});

test("hides low-signal previews and compacts meaningful conversation text", () => {
  assert.equal(isLowSignalConversationText("你好"), true);
  assert.equal(isLowSignalConversationText("已创建执行计划"), true);
  assert.equal(visibleConversationPreview({ title: "任务", preview: "任务" }), "");
  assert.equal(visibleConversationPreview({ title: "任务", preview: "已创建执行计划" }), "");
  assert.equal(visibleConversationPreview({ title: "任务", preview: "修复原生终端恢复后无法发送任务的状态同步问题" }), "修复原生终端恢复后无法发送任务的状态同步问题");
});
