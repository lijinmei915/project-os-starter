export function createConversationActionAdapters({ generatePlan, isRequestActive, runAction } = {}) {
  return {
    generatePlan,
    generatePatch: ({ action = {}, requestId, task } = {}) => runAction?.({
      ...action,
      isActive: () => Boolean(isRequestActive?.(requestId)),
      requestId,
      task,
    }),
    runCheck: ({ action = {}, requestId } = {}) => runAction?.({
      ...action,
      requestId,
    }),
  };
}
