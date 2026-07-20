export async function applyPendingConversationPatch({
  action,
  baseTurns,
  isApplyingRef,
  onChatTurnsChange,
  onRunChatAction,
  pendingAction,
  projectExecutionEvent,
}) {
  if (!pendingAction?.taskId) return false;
  if (isApplyingRef.current) return true;
  isApplyingRef.current = true;
  const requestId = pendingAction.requestId || baseTurns.find((turn) => turn.pendingAction?.id === pendingAction.id)?.requestId;
  let projectedTurns = baseTurns.map((turn) => turn.pendingAction?.id === pendingAction.id
    ? { ...turn, actions: [], pendingAction: null, resolvedActionId: pendingAction.id }
    : turn);
  onChatTurnsChange(projectedTurns);
  try {
    const result = await onRunChatAction?.({
      ...action,
      id: "apply-patch",
      taskId: pendingAction.taskId,
      onProgress: (progress) => {
        projectedTurns = projectExecutionEvent(projectedTurns, {
          ...progress,
          actions: ["succeeded", "failed"].includes(progress?.outcome)
            ? progress.outcome === "failed"
              ? [{ id: "create-repair-task", label: "生成修复任务", taskId: pendingAction.taskId }, { id: "open-topic", label: "查看执行", target: "execution", taskId: pendingAction.taskId }]
              : [{ id: "open-topic", label: "查看执行", target: "execution", taskId: pendingAction.taskId }]
            : undefined,
          requestId,
          taskId: pendingAction.taskId,
        });
        onChatTurnsChange(projectedTurns);
      },
    });
    if (!result) onChatTurnsChange(baseTurns);
    return Boolean(result);
  } catch {
    onChatTurnsChange(baseTurns);
    return false;
  } finally {
    isApplyingRef.current = false;
  }
}
