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
