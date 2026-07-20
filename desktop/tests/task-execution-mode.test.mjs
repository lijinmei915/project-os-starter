import assert from "node:assert/strict";
import test from "node:test";
import { taskExecutionNextAction } from "../src/lib/task-execution-mode.js";

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
    verificationSummary: { status: "passed" },
  }), { id: "open-topic", label: "查看检查结果", target: "execution", taskId: "task-check" });
});

test("drafts a patch only when the plan has an engineering change", () => {
  assert.deepEqual(taskExecutionNextAction({
    id: "task-patch",
    plan: { candidateChanges: ["调整 desktop/src/main.jsx 的状态提示"], checks: ["cd desktop && npm run web:build"] },
  }), { id: "generate-patch", label: "生成文件改动", taskId: "task-patch" });
});

test("keeps planning-only tasks out of the patch workflow", () => {
  assert.deepEqual(taskExecutionNextAction({ id: "task-review", plan: {} }), {
    id: "open-topic", label: "查看任务详情", target: "execution", taskId: "task-review",
  });
});
