export function removeTaskState(state = {}, taskId) {
  const id = String(taskId || "");
  const taskConversationId = String(state.taskConversationId || "");
  const activeTaskDeleted = state.activeTaskId === id;
  const activeConversationDeleted = state.activeConversationTaskId === id;
  return {
    activeConversationTaskId: activeConversationDeleted ? "" : state.activeConversationTaskId || "",
    activeTaskId: activeTaskDeleted ? "" : state.activeTaskId || "",
    conversations: (state.conversations || []).filter((conversation) => (
      conversation?.taskId !== id && (!taskConversationId || conversation?.id !== taskConversationId)
    )),
    readonlyPlan: activeTaskDeleted ? null : state.readonlyPlan || null,
    tasks: (state.tasks || []).filter((task) => task?.id !== id),
    shouldResetConversation: activeConversationDeleted,
  };
}

export function agentRunConversationId(activeConversationId, task = {}) {
  return String(activeConversationId || task.conversationId || "").trim();
}

export function agentRunsForConversation(runs = [], activeConversationId, activeTaskId) {
  const conversationId = String(activeConversationId || "");
  const direct = conversationId ? runs.filter((run) => run.conversationId === conversationId) : [];
  if (direct.length) return latestRunsByTask(direct);
  const taskId = String(activeTaskId || "");
  if (!taskId) return [];
  const fallback = runs
    .filter((run) => run.taskId === taskId)
    .sort((left, right) => String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || "")));
  return fallback.length ? [fallback[0]] : [];
}

function latestRunsByTask(runs) {
  const latest = new Map();
  for (const run of runs) {
    const key = String(run.taskId || run.id || "");
    const current = latest.get(key);
    const timestamp = String(run.updatedAt || run.createdAt || "");
    const currentTimestamp = String(current?.updatedAt || current?.createdAt || "");
    const active = isActiveAgentRun(run.status);
    const currentActive = isActiveAgentRun(current?.status);
    if (!current || (active && !currentActive) || (active === currentActive && timestamp.localeCompare(currentTimestamp) > 0)) latest.set(key, run);
  }
  return [...latest.values()];
}

const isActiveAgentRun = (status) => /^(awaiting-approval|awaiting-user-input|interrupted|queued|running)$/.test(status);

export function activeAgentRunForTask(runs = [], taskId) {
  const id = String(taskId || "");
  return runs
    .filter((run) => run.taskId === id && isActiveAgentRun(run.status))
    .sort((left, right) => String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || "")))[0] || null;
}

function hasPendingPatchDraft(conversation, taskId) {
  return (conversation?.turns || []).some((turn) => turn?.role === "assistant"
    && (turn?.taskId === taskId || (turn?.actions || []).some((action) => action?.taskId === taskId))
    && (turn?.actions || []).some((action) => action?.id === "generate-patch"));
}

/**
 * A process restart cannot resume an in-memory request. Convert stale running
 * records into the durable next state instead of presenting a permanent spinner.
 */
export function recoverTaskRuntime(task = {}, conversations = [], statuses = {}) {
  if (task.status !== statuses.running) return task;
  const requestSucceeded = task.requestTrace?.outcome === "succeeded";
  if (requestSucceeded && conversations.some((conversation) => hasPendingPatchDraft(conversation, task.id))) {
    return {
      ...task,
      recoveryReason: "awaiting-user-action",
      status: statuses.waitingApproval,
    };
  }
  if (requestSucceeded) {
    return {
      ...task,
      recoveryReason: "request-settled",
      status: statuses.planned,
    };
  }
  return {
    ...task,
    recoveryReason: "interrupted",
    status: statuses.failed,
    verificationSummary: task.verificationSummary || "应用关闭时任务仍在执行，未收到可恢复的完成结果。",
  };
}
