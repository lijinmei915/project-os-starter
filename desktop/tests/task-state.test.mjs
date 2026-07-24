import assert from "node:assert/strict";
import test from "node:test";

import { activeAgentRunForTask, agentRunConversationId, agentRunsForConversation, recoverTaskRuntime, removeTaskState } from "../src/lib/task-state.js";

test("binds a new Agent Run to the conversation that launched it", () => {
  assert.equal(agentRunConversationId("conversation-current", { conversationId: "conversation-old" }), "conversation-current");
  assert.equal(agentRunConversationId("", { conversationId: "conversation-old" }), "conversation-old");
});

test("prefers current conversation runs and uses only the latest task fallback", () => {
  const oldRun = { conversationId: "conversation-old", taskId: "task-1", updatedAt: "2026-07-24T06:56:02Z" };
  const currentRun = { conversationId: "conversation-current", taskId: "task-1", updatedAt: "2026-07-24T07:03:17Z" };
  assert.deepEqual(agentRunsForConversation([oldRun, currentRun], "conversation-current", "task-1"), [currentRun]);
  assert.deepEqual(agentRunsForConversation([oldRun, currentRun], "conversation-missing", "task-1"), [currentRun]);
  assert.deepEqual(agentRunsForConversation([oldRun], "conversation-missing", "task-2"), []);
});

test("shows only the latest run per task and prevents concurrent Agent starts", () => {
  const failed = { conversationId: "conversation-1", status: "failed", taskId: "task-1", updatedAt: "2026-07-24T07:33:03Z" };
  const running = { conversationId: "conversation-1", status: "running", taskId: "task-1", updatedAt: "2026-07-24T07:31:47Z" };
  const waiting = { conversationId: "conversation-1", status: "awaiting-user-input", taskId: "task-1", updatedAt: "2026-07-24T07:32:37Z" };
  assert.deepEqual(agentRunsForConversation([failed, running, waiting], "conversation-1", "task-1"), [waiting]);
  assert.equal(activeAgentRunForTask([failed, running, waiting], "task-1"), waiting);
  assert.equal(activeAgentRunForTask([failed], "task-1"), null);
});

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
