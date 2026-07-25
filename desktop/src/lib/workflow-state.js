export const workflowStates = Object.freeze({
  idle: "idle",
  planned: "planned",
  working: "working",
  waitingUser: "waiting-user",
  waitingApproval: "waiting-approval",
  verifying: "verifying",
  completed: "completed",
  verified: "verified",
  failed: "failed",
  cancelled: "cancelled",
  interrupted: "interrupted",
});

const presentation = Object.freeze({
  [workflowStates.idle]: { label: "待开始", tone: "neutral" },
  [workflowStates.planned]: { label: "待确认", tone: "warning" },
  [workflowStates.working]: { label: "进行中", tone: "info" },
  [workflowStates.waitingUser]: { label: "等待回答", tone: "warning" },
  [workflowStates.waitingApproval]: { label: "等待批准", tone: "warning" },
  [workflowStates.verifying]: { label: "验证中", tone: "info" },
  [workflowStates.completed]: { label: "处理完成", tone: "success" },
  [workflowStates.verified]: { label: "验证通过", tone: "success" },
  [workflowStates.failed]: { label: "需要处理", tone: "danger" },
  [workflowStates.cancelled]: { label: "已取消", tone: "neutral" },
  [workflowStates.interrupted]: { label: "已中断", tone: "warning" },
});

export function workflowStatePresentation(state) {
  return presentation[state] || presentation[workflowStates.idle];
}

export function workflowStateIsActive(state) {
  return [workflowStates.planned, workflowStates.working, workflowStates.waitingUser, workflowStates.waitingApproval, workflowStates.verifying].includes(state);
}

export function workflowStateIsFinished(state) {
  return [workflowStates.completed, workflowStates.verified].includes(state);
}

export function workflowStateIsFailure(state) {
  return [workflowStates.failed, workflowStates.interrupted].includes(state);
}

export function taskHasPassedVerification(task) {
  const evidence = Array.isArray(task?.executionEvidence) ? task.executionEvidence : [];
  return evidence.some((item) => item?.kind === "check" && item?.status === "succeeded");
}

export function taskHasVerificationEvidence(task) {
  const evidence = Array.isArray(task?.executionEvidence) ? task.executionEvidence : [];
  return evidence.some((item) => item?.kind === "check" && ["succeeded", "failed"].includes(item?.status));
}

function matchesStatus(status, ...candidates) {
  return status !== undefined && status !== null && candidates.some((candidate) => candidate !== undefined && candidate !== null && status === candidate);
}

export function taskWorkflowState(task, taskStatuses = {}) {
  if (!task) return workflowStates.idle;
  const status = task.status;
  if (matchesStatus(status, taskStatuses.planned, "planned")) return workflowStates.planned;
  // The legacy Task value "waiting approval" means its plan was already confirmed and execution may continue.
  if (matchesStatus(status, taskStatuses.waitingApproval, "waiting approval")) return workflowStates.working;
  if (matchesStatus(status, taskStatuses.repairPending, "repair-pending", "repair pending")) return workflowStates.waitingUser;
  if (matchesStatus(status, taskStatuses.waitingRepairApproval, "waiting-repair-approval", "waiting repair approval")) return workflowStates.waitingApproval;
  if (matchesStatus(status, taskStatuses.running, "running")) return workflowStates.working;
  if (matchesStatus(status, taskStatuses.failed, taskStatuses.repairFailed, "failed", "repair-failed")) return workflowStates.failed;
  if (["cancelled", "canceled"].includes(status)) return workflowStates.cancelled;
  if (status === "interrupted") return workflowStates.interrupted;
  if (matchesStatus(status, taskStatuses.done, "done", "succeeded")) {
    return taskHasPassedVerification(task) ? workflowStates.verified : workflowStates.completed;
  }
  return workflowStates.idle;
}

export function conversationTurnWorkflowState(turn, task) {
  if (turn?.pendingAction) {
    return turn.pendingAction.type === "ask-user" ? workflowStates.waitingUser : workflowStates.waitingApproval;
  }
  if (turn?.outcome === "running") return workflowStates.working;
  if (turn?.outcome === "awaiting-confirmation") return workflowStates.waitingApproval;
  if (turn?.outcome === "failed") return workflowStates.failed;
  if (turn?.outcome === "cancelled") return workflowStates.cancelled;
  if (turn?.outcome === "interrupted") return workflowStates.interrupted;
  if (turn?.outcome === "succeeded") {
    return taskHasPassedVerification(task) ? workflowStates.verified : workflowStates.completed;
  }
  return workflowStates.idle;
}

export function agentRunWorkflowState(runOrStatus) {
  const status = typeof runOrStatus === "string" ? runOrStatus : runOrStatus?.status;
  return {
    queued: workflowStates.planned,
    running: workflowStates.working,
    "awaiting-user-input": workflowStates.waitingUser,
    "awaiting-approval": workflowStates.waitingApproval,
    applying: workflowStates.working,
    "running-tool": workflowStates.working,
    verifying: workflowStates.verifying,
    succeeded: workflowStates.completed,
    failed: workflowStates.failed,
    cancelled: workflowStates.cancelled,
    interrupted: workflowStates.interrupted,
  }[status] || workflowStates.idle;
}
