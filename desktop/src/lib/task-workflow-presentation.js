import { taskWorkflowState, workflowStatePresentation } from "./workflow-state.js";

export function taskStatusLabel(taskOrStatus, taskStatuses) {
  const task = taskOrStatus && typeof taskOrStatus === "object" ? taskOrStatus : { status: taskOrStatus };
  return workflowStatePresentation(taskWorkflowState(task, taskStatuses)).label;
}

export function checksForPlan(plan, guardedCheckCapabilities) {
  const checks = Array.isArray(plan?.checks) ? plan.checks : [];
  return guardedCheckCapabilities.filter((check) =>
    checks.some((item) => item.includes(check.command) || item.includes(check.id) || item.includes(check.label)),
  );
}
