import assert from "node:assert/strict";
import test from "node:test";

import { recoverTaskRuntime, removeTaskState } from "../src/lib/task-state.js";

const statuses = { failed: "failed", planned: "planned", running: "running", waitingApproval: "waiting approval" };

test("removes a deleted task from task, conversation, and active state", () => {
  const result = removeTaskState({
    activeConversationTaskId: "task-a",
    activeTaskId: "task-a",
    conversations: [{ id: "conversation-a", taskId: "task-a" }, { id: "conversation-b", taskId: "task-b" }],
    readonlyPlan: { summary: "current" },
    tasks: [{ id: "task-a" }, { id: "task-b" }],
  }, "task-a");
  assert.deepEqual(result, {
    activeConversationTaskId: "",
    activeTaskId: "",
    conversations: [{ id: "conversation-b", taskId: "task-b" }],
    readonlyPlan: null,
    tasks: [{ id: "task-b" }],
    shouldResetConversation: true,
  });
});

test("keeps unrelated active state intact", () => {
  const result = removeTaskState({
    activeConversationTaskId: "task-b",
    activeTaskId: "task-b",
    conversations: [{ id: "conversation-a", taskId: "task-a" }],
    readonlyPlan: { summary: "other" },
    tasks: [{ id: "task-a" }, { id: "task-b" }],
  }, "task-a");
  assert.equal(result.activeTaskId, "task-b");
  assert.equal(result.activeConversationTaskId, "task-b");
  assert.equal(result.shouldResetConversation, false);
});

test("removes a legacy task conversation through the recorded conversation id", () => {
  const result = removeTaskState({
    conversations: [{ id: "legacy-conversation" }, { id: "general-conversation" }],
    taskConversationId: "legacy-conversation",
    tasks: [{ conversationId: "legacy-conversation", id: "task-a" }],
  }, "task-a");
  assert.deepEqual(result.conversations, [{ id: "general-conversation" }]);
});

test("restores a settled task with a pending draft action without treating it as running", () => {
  const recovered = recoverTaskRuntime({
    id: "task-1",
    requestTrace: { outcome: "succeeded" },
    status: "running",
  }, [{
    turns: [{ actions: [{ id: "generate-patch", taskId: "task-1" }], role: "assistant", taskId: "task-1" }],
  }], statuses);
  assert.equal(recovered.status, statuses.waitingApproval);
  assert.equal(recovered.recoveryReason, "awaiting-user-action");
});

test("does not leave an unrecoverable process request in a permanent running state", () => {
  const recovered = recoverTaskRuntime({ id: "task-1", status: "running" }, [], statuses);
  assert.equal(recovered.status, statuses.failed);
  assert.equal(recovered.recoveryReason, "interrupted");
});
