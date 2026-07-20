import assert from "node:assert/strict";
import test from "node:test";
import { resolvedStageGoalTurn } from "../src/lib/stage-goal-turn.js";

test("projects a confirmed stage goal into one resolved conversation turn", () => {
  const result = resolvedStageGoalTurn({ id: "turn-1", pendingAction: { id: "stage-1" } }, { summary: "收口模块边界", title: "架构收口" }, "OmniDesk Desktop");
  assert.equal(result.pendingAction, null);
  assert.equal(result.stageGoal.parentTitle, "OmniDesk Desktop");
  assert.equal(result.resolvedActionId, "stage-1");
  assert.equal(result.actions.length, 2);
});
