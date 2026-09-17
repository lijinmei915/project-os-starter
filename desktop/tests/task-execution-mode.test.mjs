import assert from "node:assert/strict";
import test from "node:test";
import { taskExecutionBoundaries, taskExecutionNextAction } from "../src/lib/task-execution-mode.js";

test("explains the four independently confirmed execution boundaries", () => {
  assert.deepEqual(taskExecutionBoundaries.map(({ id, label }) => ({ id, label })), [
    { id: "plan", label: "只读计划" },
    { id: "draft", label: "改动草稿" },
    { id: "write", label: "写入文件" },
    { id: "check", label: "运行检查" },
  ]);
  assert.match(taskExecutionBoundaries[0].detail, /不修改文件/);
  assert.match(taskExecutionBoundaries[1].detail, /仍不修改文件/);
  assert.match(taskExecutionBoundaries[2].detail, /再次确认/);
  assert.match(taskExecutionBoundaries[3].detail, /单独确认/);
});

test("runs checks before drafting a patch for validation-only tasks", () => {
  assert.deepEqual(taskExecutionNextAction({
    id: "task-check",
    plan: { candidateChanges: ["先不写文件，只形成下一步建议。"], checks: ["npm --prefix desktop test"] },
  }), { checkId: "runtime", id: "run-check", label: "运行基础检查", taskId: "task-check" });
});

test("shows existing validation evidence instead of rerunning an unchanged check", () => {
  assert.deepEqual(taskExecutionNextAction({
    id: "task-check",
    plan: { candidateChanges: ["先不写文件，只形成下一步建议。"], checks: ["npm --prefix desktop test"] },
    verificationSummary: "自动验证通过",
    executionEvidence: [{ kind: "check", status: "succeeded" }],
  }), { id: "open-topic", label: "查看检查结果", target: "execution", taskId: "task-check" });
});

test("does not treat a validation summary without check evidence as completed", () => {
  assert.equal(taskExecutionNextAction({
    id: "task-check",
    plan: { checks: ["npm --prefix desktop test"] },
    verificationSummary: "自动验证通过",
  }).id, "run-check");
});

test("drafts a patch only when the plan has an engineering change", () => {
  assert.deepEqual(taskExecutionNextAction({
    id: "task-patch",
    plan: { candidateChanges: ["调整 desktop/src/main.jsx 的状态提示"], checks: ["cd desktop && npm run web:build"] },
  }), { id: "generate-patch", label: "生成改动草稿", taskId: "task-patch" });
});

test("keeps planning-only tasks out of the patch workflow", () => {
  assert.deepEqual(taskExecutionNextAction({ id: "task-review", plan: {} }), {
    id: "open-topic", label: "查看任务详情", target: "execution", taskId: "task-review",
  });
});
