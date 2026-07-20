import assert from "node:assert/strict";
import test from "node:test";
import { createWorkspaceGoal, runGoalValidation, signOffGoalValidation, switchWorkspaceGoal } from "../src/lib/workspace-goal-client.js";

test("keeps Workspace goal mutations desktop-only in Preview", async () => {
  const snapshot = async () => ({ projectName: "OmniDesk" });
  for (const operation of [
    () => runGoalValidation({ goalId: "goal-current", loadWorkspaceSnapshot: snapshot }),
    () => signOffGoalValidation({ goalId: "goal-current", loadWorkspaceSnapshot: snapshot }),
    () => createWorkspaceGoal({ input: { summary: "收口", title: "Desktop 模块化" }, loadWorkspaceSnapshot: snapshot }),
    () => switchWorkspaceGoal({ input: { id: "goal-2" }, loadWorkspaceSnapshot: snapshot }),
  ]) await assert.rejects(operation, /桌面 App/);
});
