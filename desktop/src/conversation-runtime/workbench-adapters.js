export function createConversationActionAdapters({ generatePlan, isRequestActive, prepareAgentTask, runAction, startAgent } = {}) {
  return {
    generatePlan,
    prepareAgentTask,
    generatePatch: ({ action = {}, requestId, task } = {}) => runAction?.({
      ...action,
      isActive: () => Boolean(isRequestActive?.(requestId)),
      requestId,
      task,
    }),
    startAgent: ({ task } = {}) => startAgent
      ? startAgent(task)
      : runAction?.({ id: "confirm-active-task", task, taskId: task?.id }),
    runCheck: ({ action = {}, requestId } = {}) => runAction?.({
      ...action,
      requestId,
    }),
  };
}
