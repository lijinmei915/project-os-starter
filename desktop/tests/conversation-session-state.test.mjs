import assert from "node:assert/strict";
import test from "node:test";

import { conversationRetention } from "../src/lib/conversation-retention.js";
import { deleteConversationState, newConversationState, openTaskConversationState, selectConversationState } from "../src/lib/conversation-session-state.js";

test("opens one dedicated conversation for a task without consuming general history", () => {
  const result = openTaskConversationState({
    conversations: [{ id: "general", turns: [{ text: "general" }] }, { id: "task-conv", taskId: "task-1", turns: [{ text: "task" }] }],
    task: { id: "task-1", plan: { summary: "plan" } },
  });
  assert.equal(result.activeConversationId, "task-conv");
  assert.equal(result.activeConversationTaskId, "task-1");
  assert.deepEqual(result.turns, [{ text: "task" }]);
});

test("selects the owning task only for task conversations", () => {
  const tasks = [{ conversationId: "task-conv", id: "task-1", plan: { summary: "plan" } }];
  assert.equal(selectConversationState({ conversations: [{ id: "general" }], id: "general", tasks }).activeTaskId, "");
  assert.equal(selectConversationState({ conversations: [{ id: "task-conv" }], id: "task-conv", tasks }).activeTaskId, "task-1");
});

test("moves to the next conversation or creates an empty conversation after deletion", () => {
  const conversations = [{ id: "first" }, { id: "second", taskId: "task-2" }];
  const next = deleteConversationState({ activeConversationId: "first", conversations, id: "first", tasks: [{ id: "task-2" }] });
  assert.equal(next.next.activeConversationId, "second");
  const empty = deleteConversationState({ activeConversationId: "first", conversations: [{ id: "first" }], id: "first", now: 12 });
  assert.equal(empty.next.activeConversationId, "conv-12");
  assert.deepEqual(newConversationState(13).turns, []);
});

test("bounds restored legacy conversation turns before entering the active session", () => {
  const turns = Array.from({ length: conversationRetention.recentTurnLimit + 1 }, (_, index) => ({ id: `turn-${index}`, text: `消息 ${index}` }));
  const result = selectConversationState({ conversations: [{ id: "long", turns }], id: "long" });
  assert.equal(result.turns.length, conversationRetention.recentTurnLimit);
  assert.equal(result.turns[0].id, "turn-1");
});
