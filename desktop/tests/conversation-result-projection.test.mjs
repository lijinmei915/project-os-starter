import assert from "node:assert/strict";
import test from "node:test";
import { buildNonPlanConversationTurn } from "../src/lib/conversation-result-projection.js";

const base = {
  activeProjectGoalTitle: "项目目标",
  actionPromptsForMessage: () => [],
  conversationDiagnostic: () => null,
  durationMs: 10,
  eventsForMessage: () => [],
  message: "继续",
  messageKind: "chat",
  requestId: "request-1",
  safeDisplayText: (value, fallback) => value || fallback,
  statusLabelForMessage: () => "组织回答",
};

test("projects a stage goal as a confirmation-only conversation turn", () => {
  const result = buildNonPlanConversationTurn({
    ...base,
    chatResult: { reply: "目标" },
    stageGoalCandidate: { summary: "完成登录", title: "登录闭环" },
  });
  assert.equal(result.kind, "stage-goal");
  assert.equal(result.turn.pendingAction.type, "create-stage-goal");
});

test("keeps planning results out of non-plan projection", () => {
  const result = buildNonPlanConversationTurn({ ...base, chatResult: { shouldCreatePlan: true }, stageGoalCandidate: null });
  assert.equal(result, null);
});

test("keeps an explicit recommended next step pending until the user confirms it", () => {
  const action = { id: "recommend-1", task: "运行一轮基础检查", type: "generate-plan" };
  const result = buildNonPlanConversationTurn({
    ...base,
    chatResult: { reply: "最小下一步是运行一轮基础检查。", shouldCreatePlan: false },
    recommendedAction: action,
    stageGoalCandidate: null,
  });
  assert.deepEqual(result.turn.pendingAction, action);
  assert.match(result.turn.text, /回复“可以”后生成执行计划/);
});
