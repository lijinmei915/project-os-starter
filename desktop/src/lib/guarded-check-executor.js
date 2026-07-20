function checkIdentity(check) {
  const descriptor = check || {};
  const id = descriptor.id || "unknown-check";
  return {
    command: descriptor.command || id,
    id,
    label: descriptor.label || id,
  };
}

export async function executeGuardedCheckCommand({ check, runCheck } = {}) {
  const identity = checkIdentity(check);
  if (!check?.id || !check?.command) {
    const message = "未注册的受控检查。";
    return {
      error: message,
      feedback: `${identity.label} 失败：${message}`,
      result: {
        code: null,
        command: identity.command,
        id: identity.id,
        label: identity.label,
        output: message,
        success: false,
      },
    };
  }
  try {
    const result = await runCheck(identity.id);
    return {
      feedback: result.success ? `${identity.label} 通过。` : `${identity.label} 失败。`,
      result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      error: message,
      feedback: `${identity.label} 失败：${message}`,
      result: {
        code: null,
        command: identity.command,
        id: identity.id,
        label: identity.label,
        output: message,
        success: false,
      },
    };
  }
}

export async function executeTaskGuardedCheckWorkflow({ check, executeCheck, now, persistTask, task } = {}) {
  const identity = checkIdentity(check);
  const result = await executeCheck(identity.id);
  if (!task) return { conversationUpdate: null, result, task: null };
  const finishedRun = {
    ...result,
    finishedAt: now(),
  };
  const projectedTask = {
    ...task,
    runs: [finishedRun, ...(task.runs || [])],
    status: result.success ? "done" : "failed",
  };
  const persistedTask = await persistTask(projectedTask);
  return {
    conversationUpdate: task.requestId ? {
      events: [{
        detail: result.output || "",
        id: `check-${identity.id}`,
        label: identity.label,
        status: result.success ? "done" : "failed",
      }],
      outcome: result.success ? "succeeded" : "failed",
      requestId: task.requestId,
      text: result.success ? `${identity.label} 已通过。` : `${identity.label} 未通过，请查看执行详情。`,
    } : null,
    result,
    task: persistedTask || projectedTask,
  };
}
