import assert from "node:assert/strict";
import test from "node:test";

import { taskConversationAction, taskExecutionFlow, taskNextAction } from "../src/lib/task-next-action.js";

test("guides a confirmed task to generate a read-only AI suggestion first", () => {
  assert.deepEqual(taskNextAction({ id: "task-1", status: "waiting approval" }), {
    action: "generate-draft",
    detail: "AI 会先准备建议的改动，不会写入文件。",
    label: "生成 AI 建议改动",
    step: "draft",
  });
});

test("requires explicit confirmation after a generated draft is visible", () => {
  const next = taskNextAction({ id: "task-1", patchDraft: { diff: "--- a/file" }, status: "waiting approval" });
  assert.equal(next.action, "apply-draft");
  assert.equal(next.step, "review");
  assert.deepEqual(taskExecutionFlow({ id: "task-1", patchDraft: { diff: "--- a/file" } }).map((step) => step.status), ["done", "current", "pending", "pending"]);
});

test("runs checks instead of offering an inapplicable draft for a validation task", () => {
  const next = taskNextAction({
    id: "task-check",
    patchDraft: { notApplicable: true },
    plan: { candidateChanges: ["先不写文件，只形成下一步建议。"], checks: ["npm --prefix desktop test"] },
    status: "planned",
  });
  assert.equal(next.action, "run-check");
  assert.equal(next.label, "运行基础检查");
});

test("routes analysis tasks back to contextual conversation", () => {
  assert.deepEqual(taskConversationAction({ id: "risk-1", title: "检查当前项目还有哪些风险", status: "running" }), {
    action: "continue-chat",
    detail: "继续围绕当前任务分析，并把新的结论、限制和下一步同步回任务。",
    label: "继续分析",
    step: "analysis",
  });
});

test("keeps implementation tasks on the controlled patch workflow", () => {
  assert.equal(taskConversationAction({ id: "ui-1", title: "修复任务详情弹窗布局", status: "running" }).action, "generate-draft");
});

test("does not restart completed task workflows", () => {
  assert.equal(taskConversationAction({ id: "done-1", title: "检查风险", status: "done" }).action, "none");
});

test("prioritizes failed task recovery over analysis classification", () => {
  assert.equal(taskConversationAction({ id: "failed-check", title: "检查风险", status: "failed", plan: { checks: ["runtime"] } }).action, "run-check");
  assert.equal(taskConversationAction({ id: "failed-analysis", title: "分析原因", status: "failed" }).label, "分析失败原因");
});
