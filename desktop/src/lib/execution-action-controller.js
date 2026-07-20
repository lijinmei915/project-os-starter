export function createExecutionActionController({
  appendTerminalLog, beginActionFeedback, chatTurns, executeGuardedCheckCommand,
  executeTaskGuardedCheckWorkflow, finishActionFeedback, guardedCheckCapability,
  persistTask, projectExecutionEvent, runCheck, setRunnerError, setRunnerLoadingId,
  setTasks, taskStatuses, tasks, updateChatTurns,
}) {
  const executeGuardedCheck = async (checkId, feedbackKey = `check-${checkId}-${Date.now()}`) => {
    const check = guardedCheckCapability(checkId);
    const checkLabel = check?.label || checkId;
    beginActionFeedback(feedbackKey, `正在运行检查：${checkLabel}`);
    setRunnerError("");
    setRunnerLoadingId(checkId);
    try {
      const execution = await executeGuardedCheckCommand({ check, runCheck });
      appendTerminalLog(execution.result);
      if (execution.error) setRunnerError(execution.error);
      finishActionFeedback(feedbackKey, execution.result.success ? "success" : "failed", execution.feedback);
      return execution.result;
    } finally {
      setRunnerLoadingId("");
    }
  };

  return {
    executeGuardedCheck,
    runGuardedCheck: async (taskId, checkId) => {
      setTasks((current) => current.map((task) => task.id === taskId ? { ...task, status: taskStatuses.running } : task));
      const task = tasks.find((item) => item.id === taskId);
      const workflow = await executeTaskGuardedCheckWorkflow({
        check: guardedCheckCapability(checkId),
        executeCheck: (nextCheckId) => executeGuardedCheck(nextCheckId, `check-${taskId}-${nextCheckId}`),
        now: () => new Date().toISOString(),
        persistTask,
        task,
      });
      if (workflow.conversationUpdate) updateChatTurns(projectExecutionEvent(chatTurns, workflow.conversationUpdate));
      return true;
    },
  };
}
