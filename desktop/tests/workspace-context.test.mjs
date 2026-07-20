import assert from "node:assert/strict";
import test from "node:test";
import { resolveWorkspaceContext, resolveWorkspaceGoal } from "../src/lib/workspace-context.js";

const done = { id: "done", status: "done", title: "已完成" };
const active = { id: "active", status: "queued", title: "进行中" };

test("falls back from a completed active pointer to an actionable workspace goal", () => {
  assert.equal(resolveWorkspaceGoal({ goals: { activeGoalId: "done", goals: [done, active] } }).id, "active");
});

test("uses the current task goal before the workspace fallback", () => {
  const context = resolveWorkspaceContext({
    activeConversationId: "conversation-1",
    conversations: [{ id: "conversation-1", taskId: "task-1" }],
    snapshot: { goals: { activeGoalId: "done", goals: [done, active] } },
    tasks: [{ id: "task-1", goalId: "active" }],
  });
  assert.equal(context.goal.id, "active");
  assert.equal(context.goalSource, "task");
  assert.equal(context.task.id, "task-1");
});
