import { taskHasVerificationEvidence } from "./workflow-state.js";

export const taskExecutionBoundaries = Object.freeze([
  Object.freeze({ detail: "当前步骤。只查看项目并整理方案，不修改文件。", id: "plan", label: "只读计划" }),
  Object.freeze({ detail: "确认计划后生成具体差异，仍不修改文件。", id: "draft", label: "改动草稿" }),
  Object.freeze({ detail: "看过草稿并再次确认后，才会修改项目文件。", id: "write", label: "写入文件" }),
  Object.freeze({ detail: "文件修改后单独确认，才会运行受控检查。", id: "check", label: "运行检查" }),
]);

function planItems(value) {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
}

function hasEngineeringChange(plan = {}) {
  return planItems(plan.candidateChanges || plan.candidate_changes)
    .some((item) => !/(先不写文件|不自动写文件|只形成.*建议|不修改文件)/.test(item));
}

export function taskExecutionNextAction(task = {}) {
  const plan = task.plan || {};
  const checks = planItems(plan.checks);
  if (hasEngineeringChange(plan)) {
    return { id: "generate-patch", label: "生成改动草稿", taskId: task.id || "" };
  }
  if (checks.length) {
    if (taskHasVerificationEvidence(task)) {
      return { id: "open-topic", label: "查看检查结果", target: "execution", taskId: task.id || "" };
    }
    return { checkId: "runtime", id: "run-check", label: "运行基础检查", taskId: task.id || "" };
  }
  return { id: "open-topic", label: "查看任务详情", target: "execution", taskId: task.id || "" };
}
