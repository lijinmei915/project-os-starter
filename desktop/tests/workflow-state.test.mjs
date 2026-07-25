import assert from "node:assert/strict";
import test from "node:test";
import {
  agentRunWorkflowState,
  conversationTurnWorkflowState,
  taskHasPassedVerification,
  taskHasVerificationEvidence,
  taskWorkflowState,
  workflowStatePresentation,
  workflowStateIsActive,
  workflowStateIsFailure,
  workflowStateIsFinished,
  workflowStates,
} from "../src/lib/workflow-state.js";

test("does not present a successful model or operation result as verified", () => {
  const task = { id: "task-1", status: "done", verificationSummary: "任务结果已由用户确认。" };
  assert.equal(taskHasPassedVerification(task), false);
  assert.equal(taskWorkflowState(task), workflowStates.completed);
  assert.equal(conversationTurnWorkflowState({ outcome: "succeeded" }, task), workflowStates.completed);
  assert.equal(workflowStatePresentation(workflowStates.completed).label, "处理完成");
});

test("requires successful check evidence before presenting verification", () => {
  const task = {
    status: "done",
    executionEvidence: [{ kind: "apply", status: "succeeded" }, { kind: "check", status: "succeeded" }],
  };
  assert.equal(taskHasPassedVerification(task), true);
  assert.equal(taskHasVerificationEvidence(task), true);
  assert.equal(taskWorkflowState(task), workflowStates.verified);
  assert.equal(conversationTurnWorkflowState({ outcome: "succeeded" }, task), workflowStates.verified);
  assert.equal(workflowStatePresentation(workflowStates.verified).label, "验证通过");
});

test("keeps failed check evidence distinct from passed verification", () => {
  const task = { status: "done", verificationSummary: "自动验证有失败项", executionEvidence: [{ kind: "check", status: "failed" }] };
  assert.equal(taskHasVerificationEvidence(task), true);
  assert.equal(taskHasPassedVerification(task), false);
  assert.equal(taskWorkflowState(task), workflowStates.completed);
});

test("projects legacy Task waiting values by their actual workflow meaning", () => {
  assert.equal(taskWorkflowState({ status: "waiting approval" }), workflowStates.working);
  assert.equal(taskWorkflowState({ status: "repair pending" }), workflowStates.waitingUser);
  assert.equal(taskWorkflowState({ status: "waiting repair approval" }), workflowStates.waitingApproval);
});

test("projects waiting, running, terminal, and recovery Agent Run states", () => {
  assert.equal(agentRunWorkflowState("awaiting-user-input"), workflowStates.waitingUser);
  assert.equal(agentRunWorkflowState("awaiting-approval"), workflowStates.waitingApproval);
  assert.equal(agentRunWorkflowState("running-tool"), workflowStates.working);
  assert.equal(agentRunWorkflowState("verifying"), workflowStates.verifying);
  assert.equal(agentRunWorkflowState("succeeded"), workflowStates.completed);
  assert.equal(agentRunWorkflowState("interrupted"), workflowStates.interrupted);
});

test("keeps task evidence separate from a newer conversation execution event", () => {
  assert.equal(taskWorkflowState({ status: "planned" }), workflowStates.planned);
  assert.equal(conversationTurnWorkflowState({ outcome: "running" }, { status: "planned" }), workflowStates.working);
});

test("classifies normalized workflow groups for every surface", () => {
  assert.equal(workflowStateIsActive(workflowStates.waitingUser), true);
  assert.equal(workflowStateIsActive(workflowStates.completed), false);
  assert.equal(workflowStateIsFinished(workflowStates.completed), true);
  assert.equal(workflowStateIsFinished(workflowStates.verified), true);
  assert.equal(workflowStateIsFailure(workflowStates.interrupted), true);
  assert.equal(workflowStateIsFailure(workflowStates.cancelled), false);
});
