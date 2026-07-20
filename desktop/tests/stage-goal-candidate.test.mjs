import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { stageGoalCandidateFromMessage } from "../src/lib/stage-goal-candidate.js";

test("creates a stage goal candidate only after a successful model response", () => {
  assert.deepEqual(stageGoalCandidateFromMessage("接下来要把对话体验打磨好，先统一目标和任务状态。", { providerStatus: "available" }), {
    summary: "接下来要把对话体验打磨好，先统一目标和任务状态。",
    title: "打磨对话体验",
  });
  assert.equal(stageGoalCandidateFromMessage("接下来要把对话体验打磨好", { providerStatus: "unavailable" }), null);
});

test("does not turn questions into stage goals", () => {
  assert.equal(stageGoalCandidateFromMessage("下一阶段应该怎么做？", { providerStatus: "available" }), null);
});

test("keeps the stage goal scope and resolves confirmation in place", () => {
  const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const source = fs.readFileSync(path.join(desktopRoot, "src/main.jsx"), "utf8");
  const controllerSource = fs.readFileSync(path.join(desktopRoot, "src/lib/conversation-action-controller.js"), "utf8");
  const projectionSource = fs.readFileSync(path.join(desktopRoot, "src/lib/conversation-result-projection.js"), "utf8");
  const actionSource = fs.readFileSync(path.join(desktopRoot, "src/components/workbench/use-conversation-turn-actions.js"), "utf8");
  const turnSource = fs.readFileSync(path.join(desktopRoot, "src/lib/stage-goal-turn.js"), "utf8");
  assert.match(projectionSource, /scope: stageGoalCandidate\.summary/);
  assert.match(source, /useConversationTurnActions/);
  assert.match(actionSource, /resolvedStageGoalTurn\(item, action/);
  assert.match(turnSource, /references: \[\]/);
  assert.match(turnSource, /补充范围/);
  assert.match(turnSource, /进入任务拆解/);
  assert.match(source, /createConversationActionController/);
  assert.match(controllerSource, /没有关联到当前项目目标/);
  assert.doesNotMatch(source, /assistant-goal-created/);
});
