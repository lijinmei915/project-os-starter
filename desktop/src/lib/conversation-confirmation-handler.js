export function addConversationConfirmationHandler({
  activeProjectGoalTitle,
  executePendingPatchApply,
  executePendingPlan,
  executionReadyEvents,
  handlers,
  onChatTurnsChange,
  onRunChatAction,
  pendingAction,
  projectExecutionEvent,
  requestBaseTurns,
  requestId,
  resolveStageGoalTurn,
  userTurn,
  clearSubmittedInput,
}) {
  if (pendingAction?.type === "create-stage-goal") {
    handlers["confirm-action"] = async () => {
      const completed = await onRunChatAction?.({ id: "create-stage-goal", summary: pendingAction.summary, title: pendingAction.title });
      if (!completed) return false;
      const resolvedTurns = requestBaseTurns.map((turn) => turn.pendingAction?.id === pendingAction.id
        ? resolveStageGoalTurn(turn, pendingAction, activeProjectGoalTitle)
        : turn);
      onChatTurnsChange([...resolvedTurns, userTurn]);
      clearSubmittedInput();
      return true;
    };
  } else if (pendingAction?.type === "generate-plan") {
    handlers["confirm-action"] = async () => executePendingPlan?.(pendingAction) || false;
  } else if (pendingAction?.type === "confirm-active-task") {
    handlers["confirm-action"] = async () => {
      if (!await onRunChatAction?.({ id: "confirm-active-task", taskId: pendingAction.taskId })) return false;
      const nextAction = pendingAction.nextAction || { id: "generate-patch", label: "生成文件改动", taskId: pendingAction.taskId };
      const targetRequestId = pendingAction.requestId || requestBaseTurns.find((turn) => turn.pendingAction?.id === pendingAction.id)?.requestId;
      const resolvedTurns = requestBaseTurns.map((turn) => turn.pendingAction?.id === pendingAction.id
        ? { ...turn, actions: [], pendingAction: null, resolvedActionId: pendingAction.id }
        : turn);
      const projectedTurns = projectExecutionEvent([...resolvedTurns, userTurn], {
        events: executionReadyEvents(),
        outcome: "awaiting-confirmation",
        requestId: targetRequestId,
        text: `计划已确认。下一步${nextAction.label}。`,
      });
      onChatTurnsChange(projectedTurns.map((turn) => turn.requestId === targetRequestId && turn.role === "assistant"
        ? { ...turn, actions: [{ ...nextAction, taskId: pendingAction.taskId }] }
        : turn));
      clearSubmittedInput();
      return true;
    };
  } else if (pendingAction?.type === "apply-patch") {
    handlers["confirm-action"] = async () => {
      const handled = await executePendingPatchApply({ action: { id: "apply-patch", taskId: pendingAction.taskId }, baseTurns: [...requestBaseTurns, userTurn], pendingAction });
      if (!handled) return false;
      clearSubmittedInput();
      return true;
    };
  }
  return handlers;
}
