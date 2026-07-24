export function createConversationActionAdapters({ generatePlan, isRequestActive, runAction } = {}) {
  return {
    generatePlan,
    generatePatch: ({ action = {}, requestId, task } = {}) => runAction?.({
      ...action,
      isActive: () => Boolean(isRequestActive?.(requestId)),
      requestId,
      task,
    }),
    startAgent: ({ task } = {}) => runAction?.({ id: "confirm-active-task", task, taskId: task?.id }),
    runCheck: ({ action = {}, requestId } = {}) => runAction?.({
      ...action,
      requestId,
    }),
  };
}
