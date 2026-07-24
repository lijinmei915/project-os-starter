import assert from "node:assert/strict";
import test from "node:test";

import {
  agentRunStatuses,
  agentRunConversationEvent,
  createAgentRun,
  createApprovalRequest,
  createObservation,
  createTerminalOutcome,
  createToolCall,
  observationConversationEvent,
  toolRiskLevels,
  toolCallConversationEvent,
  transitionAgentRun,
  assertAgentRun,
  deserializeAgentRun,
  isAgentRunFinal,
  recoverAgentRun,
  resumeAgentRun,
  serializeAgentRun,
  settleAgentRun,
} from "../src/agent-runtime/index.js";

const run = () => createAgentRun({ executorId: "hermes-acp", id: "run-1", projectId: "project-1", requestId: "request-1", createdAt: "2026-07-18T00:00:00.000Z" });

test("creates an immutable bounded Agent Run", () => {
  const value = run();
  assert.equal(value.status, agentRunStatuses.queued);
  assert.equal(value.maxSteps, 20);
  assert.equal(value.attempt, 0);
  assert.equal(value.revision, 0);
  assert.deepEqual(value.interactions, []);
  assert.equal(Object.isFrozen(value), true);
});

test("validates the complete persisted Agent Run shape", () => {
  assert.equal(assertAgentRun(run()).id, "run-1");
  assert.throws(() => assertAgentRun({ ...run(), status: "mystery" }), /unsupported agent run status/);
  assert.throws(() => assertAgentRun({ ...run(), extra: true }), /unsupported field/);
  assert.throws(() => deserializeAgentRun("{"), /invalid JSON/);
  assert.deepEqual(deserializeAgentRun(serializeAgentRun(run())), run());
});

test("recovers active runs as interrupted and resumes with a new attempt", () => {
  const running = transitionAgentRun(run(), agentRunStatuses.running, "2026-07-18T00:00:01.000Z");
  const interrupted = recoverAgentRun(running, "2026-07-18T00:00:02.000Z");
  assert.equal(interrupted.status, agentRunStatuses.interrupted);
  assert.equal(interrupted.step, running.step);
  assert.equal(isAgentRunFinal(interrupted), false);
  const resumed = resumeAgentRun(interrupted, "2026-07-18T00:00:03.000Z");
  assert.equal(resumed.status, agentRunStatuses.queued);
  assert.equal(resumed.attempt, 1);
});

test("accepts one final outcome and rejects late or stale attempts", () => {
  const running = transitionAgentRun(run(), agentRunStatuses.running, "2026-07-18T00:00:01.000Z");
  const settled = settleAgentRun(running, { status: agentRunStatuses.succeeded, summary: "完成", timestamp: "2026-07-18T00:00:02.000Z" });
  assert.equal(settled.accepted, true);
  assert.equal(settleAgentRun(settled.run, { status: agentRunStatuses.failed, summary: "迟到失败" }).reason, "already-final");

  const resumed = resumeAgentRun(recoverAgentRun(running, "2026-07-18T00:00:03.000Z"), "2026-07-18T00:00:04.000Z");
  assert.equal(settleAgentRun(resumed, { attempt: 0, status: agentRunStatuses.succeeded, summary: "旧进程迟到" }).reason, "stale-attempt");
});

test("enforces legal Agent Run transitions and step budget", () => {
  const running = transitionAgentRun(run(), agentRunStatuses.running, "2026-07-18T00:00:01.000Z");
  const waiting = transitionAgentRun(running, agentRunStatuses.awaitingApproval, "2026-07-18T00:00:02.000Z");
  assert.equal(waiting.step, 2);
  assert.throws(() => transitionAgentRun(waiting, agentRunStatuses.succeeded), /illegal agent run transition/);
  const exhausted = createAgentRun({ executorId: "hermes-acp", id: "run-2", maxSteps: 1, projectId: "project-1", requestId: "request-2", status: agentRunStatuses.running, step: 1 });
  assert.throws(() => transitionAgentRun(exhausted, agentRunStatuses.verifying), /step budget exhausted/);
});

test("keeps user input waiting separate from write approval and restart recovery", () => {
  const running = transitionAgentRun(run(), agentRunStatuses.running, "2026-07-18T00:00:01.000Z");
  const waiting = transitionAgentRun(running, agentRunStatuses.awaitingUserInput, "2026-07-18T00:00:02.000Z");
  assert.equal(recoverAgentRun(waiting, "2026-07-18T00:00:03.000Z"), waiting);
  assert.equal(agentRunConversationEvent(waiting).phase, "input");
  assert.equal(transitionAgentRun(waiting, agentRunStatuses.queued, "2026-07-18T00:00:04.000Z").status, agentRunStatuses.queued);
});

test("requires approval for write and execute tools but not read tools", () => {
  const read = createToolCall({ id: "tool-1", name: "read_file", runId: "run-1", risk: toolRiskLevels.read });
  const write = createToolCall({ id: "tool-2", name: "apply_patch", runId: "run-1", risk: toolRiskLevels.write });
  const execute = createToolCall({ id: "tool-3", name: "run_check", runId: "run-1", risk: toolRiskLevels.execute });
  assert.equal(read.approvalRequired, false);
  assert.equal(write.approvalRequired, true);
  assert.equal(execute.approvalRequired, true);
});

test("creates approval, observation, and exactly typed terminal outcomes", () => {
  const approval = createApprovalRequest({ id: "approval-1", reason: "写入工程文件", runId: "run-1", toolCallId: "tool-2" });
  const observation = createObservation({ id: "observation-1", runId: "run-1", success: true, summary: "读取完成", toolCallId: "tool-1" });
  const outcome = createTerminalOutcome({ runId: "run-1", status: agentRunStatuses.succeeded, summary: "验收通过" });
  assert.equal(approval.status, "pending");
  assert.equal(observation.success, true);
  assert.equal(outcome.status, agentRunStatuses.succeeded);
  assert.throws(() => createTerminalOutcome({ runId: "run-1", status: agentRunStatuses.running, summary: "未结束" }), /unsupported terminal outcome/);
});

test("projects Agent Run, approval, and observation into Conversation Events", () => {
  const running = transitionAgentRun(run(), agentRunStatuses.running, "2026-07-18T00:00:01.000Z");
  const write = createToolCall({ id: "tool-write", name: "apply_patch", requestedAt: "2026-07-18T00:00:02.000Z", risk: toolRiskLevels.write, runId: running.id });
  const observation = createObservation({ id: "observation-write", observedAt: "2026-07-18T00:00:03.000Z", runId: running.id, success: true, summary: "Patch 已校验", toolCallId: write.id });
  assert.equal(agentRunConversationEvent(running).type, "request.progress");
  assert.equal(toolCallConversationEvent(running, write).type, "approval.required");
  assert.equal(observationConversationEvent(running, observation).type, "tool.completed");
});
