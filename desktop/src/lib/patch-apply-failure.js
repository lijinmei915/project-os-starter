export function patchApplyFailureTask(task, message, finishedAt) {
  if (task?.applyResult?.success) {
    return {
      ...task,
      status: "failed",
      verificationSummary: message,
    };
  }
  return {
    ...task,
    status: "failed",
    applyResult: {
      finishedAt,
      message,
      success: false,
    },
  };
}

export async function persistPatchApplyFailure({ finishedAt, message, persistTask, task }) {
  const failedTask = patchApplyFailureTask(task, message, finishedAt);
  return persistTask(failedTask, { durable: true });
}
