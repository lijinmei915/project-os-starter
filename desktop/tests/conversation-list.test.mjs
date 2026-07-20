import assert from "node:assert/strict";
import test from "node:test";
import { groupConversations } from "../src/lib/conversation-list.js";

test("groups task conversations before general conversations", () => {
  const groups = groupConversations([
    { id: "general", title: "风险讨论", updatedAt: "2026-07-18T09:00:00Z" },
    { id: "task", taskId: "task-1", title: "修复发送", updatedAt: "2026-07-18T10:00:00Z" },
  ], { now: Date.parse("2026-07-18T11:00:00Z") });
  assert.deepEqual(groups.map((group) => group.label), ["任务对话", "今天"]);
  assert.equal(groups[0].items[0].id, "task");
});

test("keeps archived conversations out of the history list", () => {
  const conversations = [
    { id: "active", title: "当前对话", updatedAt: "2026-07-18T10:00:00Z" },
    { archivedAt: "2026-07-18T11:00:00Z", id: "archived", title: "旧对话", updatedAt: "2026-07-18T09:00:00Z" },
  ];
  assert.deepEqual(groupConversations(conversations).flatMap((group) => group.items).map((item) => item.id), ["active"]);
});
