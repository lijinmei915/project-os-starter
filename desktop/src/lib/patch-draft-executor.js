function cancelledPatchDraftResult(task) {
  return {
    cancelled: true,
    feedback: "改动草稿请求已被新方向取代。",
    success: false,
    task,
  };
}

export async function executePatchDraftWorkflow({ generatePatch, isActive, persistTask, task } = {}) {
  if (!task) return { error: "找不到需要生成改动的任务。", success: false };
  try {
    const patchDraft = await generatePatch(task);
    if (isActive && !isActive()) return cancelledPatchDraftResult(task);
    const repairAttempt = Number(task?.repair?.attempt || 0);
    const isRepair = task?.status === "repair pending" || repairAttempt > 0;
    const evidence = [...(task.executionEvidence || []), {
      at: new Date().toISOString(),
      kind: "draft",
      status: "ready",
      summary: isRepair ? `第 ${repairAttempt} 轮修复草稿已生成，尚未写入文件。` : "初始改动草稿已生成，尚未写入文件。",
      details: { allowedFiles: patchDraft?.allowedFiles || patchDraft?.files || [], failureReason: patchDraft?.failureReason || "" },
    }];
    const projectedTask = {
      ...task,
      patchDraft,
      executionEvidence: evidence,
      repair: isRepair ? { ...(task.repair || {}), phase: "awaiting-approval", attempt: repairAttempt } : task.repair,
      status: isRepair ? "waiting repair approval" : "waiting approval",
    };
    const persistedTask = await persistTask(projectedTask, { durable: true });
    return {
      feedback: "改动草稿已生成。",
      patchDraft,
      success: true,
      task: persistedTask || projectedTask,
    };
  } catch (error) {
    if (isActive && !isActive()) return cancelledPatchDraftResult(task);
    const message = error instanceof Error ? error.message : String(error);
    return {
      error: message,
      feedback: `生成改动失败：${message}`,
      success: false,
      task,
    };
  }
}
