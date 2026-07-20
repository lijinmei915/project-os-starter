import assert from "node:assert/strict";
import test from "node:test";

import { createAgentTopicGoalActions } from "../src/lib/agent-topic-goal-actions.js";

test("uses injected Workspace goal actions and reloads only after success", async () => {
  const calls = [];
  const actions = createAgentTopicGoalActions({
    archiveWorkspaceGoal: async (id) => calls.push(`archive:${id}`),
    archivingGoal: { id: "goal-1" },
    mergeTargetGoalId: "goal-2",
    mergeWorkspaceGoal: async (source, target) => calls.push(`merge:${source}:${target}`),
    mergingGoal: { id: "goal-1" },
    reload: () => calls.push("reload"),
    restoreWorkspaceGoal: async (id) => calls.push(`restore:${id}`),
    setMutationError: (message) => calls.push(`error:${message}`),
  });

  assert.equal(await actions.archiveGoal(), true);
  assert.equal(await actions.mergeGoal(), true);
  assert.equal(await actions.restoreGoal({ id: "goal-3" }), true);
  assert.deepEqual(calls, [
    "archive:goal-1", "reload",
    "merge:goal-1:goal-2", "reload",
    "restore:goal-3", "reload",
  ]);
});

test("reports invalid and failed workspace goal actions without reloading", async () => {
  const calls = [];
  const actions = createAgentTopicGoalActions({
    archiveWorkspaceGoal: async () => { throw new Error("archive failed"); },
    archivingGoal: { id: "goal-1" },
    mergeTargetGoalId: "",
    mergeWorkspaceGoal: async () => {},
    mergingGoal: { id: "goal-1" },
    reload: () => calls.push("reload"),
    restoreWorkspaceGoal: async () => {},
    setMutationError: (message) => calls.push(message),
  });

  assert.equal(await actions.mergeGoal(), false);
  assert.equal(await actions.archiveGoal(), false);
  assert.deepEqual(calls, ["请选择接收目标。", "archive failed"]);
});
