import assert from "node:assert/strict";
import test from "node:test";

import { selectCurrentProgress } from "../src/current-progress-selectors.js";
import { buildProjectFactStore } from "../src/fact-store.js";

function progressStore() {
  return buildProjectFactStore({
    snapshot: {
      currentProjectId: "progress",
      phase: "stabilizing",
      goals: { activeGoalId: "goal-1", goals: [{ id: "goal-1", shortTitle: "稳定内核", status: "active" }] },
      goalValidation: { goal: { id: "goal-1" }, criteria: [{ id: "runtime" }, { id: "browser" }] },
      goalValidationReport: { status: "passed", generatedAt: "2026-07-15T10:00:00Z" },
      workspaceFacts: { project: { milestone: "内核稳定性验收" } },
    },
    report: {
      summary: { currentProgress: { body: "正在稳定事实运行时。", status: "confirmed", confidence: 0.9 } },
      project: { milestone: "内核稳定性验收" },
      findings: { risks: [{ title: "仍有跨工具差异" }] },
      governanceDomains: [{ id: "current-progress", fileStatuses: [{ path: "HANDOFF.md", status: "changed" }] }],
    },
    tasks: [
      { id: "done-1", title: "完成事实层", status: "done", updatedAt: "今天" },
      { id: "open-1", title: "迁移进度页", status: "running", updatedAt: "2026-07-15T10:00:00Z" },
      { id: "open-duplicate", title: "迁移进度页", status: "planned", updatedAt: "2026-07-14T10:00:00Z" },
      { id: "failed-1", title: "失败检查", status: "failed" },
      { id: "noise", title: "你好", status: "planned" },
    ],
  });
}

test("derives a read-only progress projection with links to owning routes", () => {
  const store = progressStore();
  const model = selectCurrentProgress(store);
  assert.equal("phase" in model, false);
  assert.equal("progressValue" in model, false);
  assert.equal("stats" in model, false);
  assert.equal(store.has("progress.tasks"), false);
  assert.equal(store.has("progress.backlog"), false);
  assert.equal(model.milestone, "内核稳定性验收");
  assert.equal(model.goal.title, "稳定内核");
  assert.equal(model.goal.routeId, "current-goal");
  assert.equal(model.stage.currentId, "executing");
  assert.equal(model.acceptance.label, "2 项标准");
  assert.equal("action" in model.acceptance, false);
  assert.equal(model.validation.label, "已通过");
  assert.equal(model.risks.count, 1);
  assert.equal(model.nextAction.id, "advance-goal");
  assert.equal(model.nextAction.routeId, "current-goal");
});

test("returns stable project progress values without inventing completion", () => {
  const store = buildProjectFactStore({ snapshot: { currentProjectId: "empty", workspaceFacts: { project: {} } }, report: {} });
  const model = selectCurrentProgress(store);
  assert.equal("progressValue" in model, false);
  assert.equal(model.goal.title, "暂无目标");
  assert.equal(model.goal.status, "待建立");
  assert.equal(model.acceptance.label, "--");
  assert.equal(model.acceptance.kind, "empty");
  assert.equal(model.validation.label, "--");
  assert.equal(model.validation.kind, "empty");
  assert.equal(model.nextAction.id, "create-goal");
});

test("ignores validation evidence owned by an older goal", () => {
  const store = buildProjectFactStore({
    snapshot: {
      currentProjectId: "mismatch",
      goals: { activeGoalId: "goal-new", goals: [{ id: "goal-new", title: "新目标", status: "planned" }] },
      goalValidation: { goal: { id: "goal-old" }, criteria: [{ id: "old" }] },
      goalValidationReport: { status: "passed" },
      workspaceFacts: { project: { milestone: "新里程碑" } },
    },
    report: {},
  });
  const model = selectCurrentProgress(store);
  assert.equal(model.acceptance.label, "缺少验收标准");
  assert.equal(model.acceptance.kind, "missing-required");
  assert.equal("action" in model.acceptance, false);
  assert.equal(model.validation.label, "--");
  assert.equal(model.validation.kind, "empty");
  assert.equal(model.nextAction.id, "decompose-goal");
});
