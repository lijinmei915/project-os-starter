import { taskExecutionNextAction } from "./task-execution-mode.js";
import { taskHasVerificationEvidence } from "./workflow-state.js";

const flowSteps = [
  { id: "draft", label: "生成 AI 建议" },
  { id: "review", label: "查看并确认" },
  { id: "verify", label: "自动验证" },
  { id: "handoff", label: "更新交接" },
];

export function taskNextAction(task) {
  if (!task) {
    return {
      action: "none",
      detail: "先在对话里说清楚想完成什么，OmniDesk 会生成第一项任务。",
      label: "还没有任务",
      step: "draft",
    };
  }
  if (task.status === "failed") {
    return {
      action: "open-task",
      detail: "这项任务有失败结果，先查看原因再决定是否重试。",
      label: "查看需要处理的问题",
      step: "verify",
    };
  }
  if (task.status === "repair failed") {
    return { action: "open-task", detail: "两轮受控修复均未通过。请查看失败证据并手动调整范围。", label: "查看失败证据", step: "verify" };
  }
  if (task.status === "repair pending") {
    return { action: "generate-draft", detail: `将基于失败输出生成第 ${task.repair?.attempt || 1} 轮最小修复草稿，不会写入文件。`, label: "生成修复草稿", step: "draft" };
  }
  if (task.status === "waiting repair approval") {
    return { action: "apply-draft", detail: "修复草稿已生成。请核对后独立确认应用。", label: "确认应用修复", step: "review" };
  }
  if (task.patchDraft?.notApplicable) {
    const next = taskExecutionNextAction(task);
    if (next.id === "run-check") {
      return { action: "run-check", detail: "任务尚无实际工程改动；先运行已登记检查，再决定是否需要修复。", label: next.label, step: "verify" };
    }
    return { action: "open-task", detail: "当前计划未声明可应用的工程改动。请查看任务范围并在需要时调整计划。", label: "查看任务详情", step: "draft" };
  }
  if (!task.patchDraft) {
    return {
      action: "generate-draft",
      detail: "AI 会先准备建议的改动，不会写入文件。",
      label: "生成 AI 建议改动",
      step: "draft",
    };
  }
  if (!task.applyResult?.success) {
    return {
      action: "apply-draft",
      detail: "请先核对下方的改前改后；确认无误后才会写入文件。",
      label: "确认应用改动",
      step: "review",
    };
  }
  if (!taskHasVerificationEvidence(task)) {
    return {
      action: "run-check",
      detail: "改动已应用，下一步运行已经登记的检查。",
      label: "运行验证",
      step: "verify",
    };
  }
  if (!task.handoffMerge) {
    return {
      action: "merge-handoff",
      detail: "验证结果已生成，可以把本轮结果更新到交接记录。",
      label: "更新交接记录",
      step: "handoff",
    };
  }
  return {
    action: "none",
    detail: "本轮改动、验证和交接都已完成。",
    label: "任务已完成",
    step: "handoff",
  };
}

export function taskConversationAction(task) {
  if (task?.status === "done") {
    return {
      action: "none",
      detail: "任务结果已经确认，可以继续查看对话、验证记录和交接结果。",
      label: "任务已完成",
      step: "done",
    };
  }
  if (task?.status === "failed") {
    const hasChecks = Array.isArray(task?.plan?.checks) && task.plan.checks.length > 0;
    return hasChecks ? {
      action: "run-check",
      detail: "任务存在失败结果，重新运行已登记验证，确认问题是否仍然存在。",
      label: "重新运行验证",
      step: "verify",
    } : {
      action: "continue-chat",
      detail: "任务存在失败结果，先结合已有记录分析原因，再决定修复或重试。",
      label: "分析失败原因",
      step: "analysis",
    };
  }
  const title = String(task?.title || "");
  const summary = String(task?.plan?.summary || task?.description || "");
  const analysisTask = /(检查|梳理|分析|评估|盘点|审阅|查看|调研|判断)/.test(`${title} ${summary}`);
  if (analysisTask && !task?.patchDraft && !task?.applyResult) {
    return {
      action: "continue-chat",
      detail: "继续围绕当前任务分析，并把新的结论、限制和下一步同步回任务。",
      label: "继续分析",
      step: "analysis",
    };
  }
  return taskNextAction(task);
}

export function taskExecutionFlow(task) {
  const current = taskNextAction(task).step;
  const currentIndex = flowSteps.findIndex((step) => step.id === current);
  const completed = Boolean(task?.handoffMerge);
  return flowSteps.map((step, index) => ({
    ...step,
    status: completed || index < currentIndex ? "done" : index === currentIndex ? "current" : "pending",
  }));
}
