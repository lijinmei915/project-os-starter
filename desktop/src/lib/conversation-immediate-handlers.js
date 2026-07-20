export function createBasicConversationImmediateHandlers({
  activeTask,
  clearSubmittedInput,
  createCancelledTurn,
  onChatTurnsChange,
  onRunChatAction,
  pendingAction,
  requestBaseTurns,
  requestId,
  runningTaskStatus,
  userTurn,
}) {
  return {
    "cancel-action": async () => {
      onChatTurnsChange([...requestBaseTurns, userTurn, createCancelledTurn({ id: `${Date.now()}-assistant-cancelled`, requestId })]);
      clearSubmittedInput();
      return true;
    },
    "inspect-action": async () => {
      const actionLabel = pendingAction.type === "confirm-active-task" ? "确认并开始" : pendingAction.type === "apply-patch" ? "应用改动" : "生成计划";
      const actionText = pendingAction.type === "confirm-active-task"
        ? "下一步是执行已经生成的计划。"
        : pendingAction.type === "apply-patch"
          ? "下一步是确认并应用已经生成的改动草稿。"
          : "下一步是生成这项工作的执行计划。";
      onChatTurnsChange([...requestBaseTurns, userTurn, {
        actions: [{ id: pendingAction.type, label: actionLabel, task: pendingAction.task, taskId: pendingAction.taskId }],
        id: `${Date.now()}-assistant-next-action`, pendingAction, requestId, role: "assistant", text: actionText,
      }]);
      clearSubmittedInput();
      return true;
    },
    "resume-task": async () => {
      const alreadyRunning = activeTask?.status === runningTaskStatus;
      if (!alreadyRunning && !await onRunChatAction?.({ id: "confirm-active-task", taskId: activeTask?.id })) return false;
      const statusText = alreadyRunning ? "当前任务正在执行中。" : "已开始执行当前任务。你可以继续留在对话中。";
      if ([...requestBaseTurns].reverse().find((turn) => turn.role === "assistant")?.text !== statusText) {
        onChatTurnsChange([...requestBaseTurns, userTurn, {
          actions: [{ id: "open-topic", label: "查看执行", target: "execution", taskId: activeTask?.id || "" }],
          id: `${Date.now()}-assistant-execution-resumed`, outcome: "succeeded", requestId, role: "assistant",
          taskId: activeTask?.id || "", text: statusText,
        }]);
      }
      clearSubmittedInput();
      return true;
    },
  };
}
