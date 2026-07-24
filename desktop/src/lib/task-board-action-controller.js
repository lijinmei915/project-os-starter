function actionError(error) {
  return error instanceof Error ? error.message : String(error);
}

export function createTaskBoardActionController(deps) {
  const {
    checksForPlan, deletingTask, editingGoal, editingGoalSummary, editingGoalTitle, editingTask,
    editingTaskGoalId, editingTaskSummary, editingTaskTitle, onApplyPatchDraft, onDeleteTask,
    onEnsureModelAvailable, onGeneratePatchDraft, onMarkTaskWaiting, onMergeHandoff,
    onOpenTaskConversation, onRunGuardedCheck, onSelectTask, reload, saveDesktopTask, setDeletingTask, setEditingGoal,
    setEditingGoalSummary, setEditingGoalTitle, setEditingTask, setEditingTaskGoalId,
    setEditingTaskSummary, setEditingTaskTitle, setMutationError, setTaskActionDialog,
    setTaskModelPreflight, taskActionDialog, taskCardPrimaryAction, taskGoalOptions,
    taskNextAction, updateWorkspaceGoal,
  } = deps;
  const selectTask = (taskId) => onSelectTask?.(taskId, { preserveWorkspace: true });
  const runChecksForTask = async (task) => {
    if (!task) return false;
    const checks = checksForPlan(task.plan);
    if (!checks.length) return false;
    for (const check of checks) if (!await onRunGuardedCheck?.(task.id, check.id)) return false;
    return true;
  };
  const failedRunsForTask = (task) => (task?.runs || []).filter((run) => run && run.success === false);

  return {
    adjustTaskInConversation(task) {
      if (!task) return;
      setTaskActionDialog(null);
      selectTask(task.id);
      onOpenTaskConversation?.(task.id);
    },
    archiveTask: async (task) => {
      await saveDesktopTask({ ...task, archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      reload();
    },
    executeTaskDetailAction: async (task) => {
      if (!task) return;
      const next = taskNextAction(task);
      setMutationError("");
      try {
        if (next.action === "generate-draft") await onGeneratePatchDraft?.(task.id);
        if (next.action === "apply-draft") await onApplyPatchDraft?.(task.id);
        if (next.action === "run-check") await runChecksForTask(task);
        if (next.action === "merge-handoff") await onMergeHandoff?.(task.id);
        if (next.action === "open-task") selectTask(task.id);
        setTaskActionDialog(null);
      } catch (error) { setMutationError(actionError(error)); }
    },
    failureSummaryForTask(task) {
      const failedRuns = failedRunsForTask(task);
      if (task?.applyResult && !task.applyResult.success) return task.applyResult.message || "应用改动失败";
      if (failedRuns.length) return failedRuns[0].output || `${failedRuns[0].label || failedRuns[0].id || "检查"} 失败`;
      return task?.verificationSummary || "任务失败，等待定位原因";
    },
    openGoalEditor(group) {
      const goal = taskGoalOptions.find((item) => item.id === group.id);
      if (!goal) return;
      setEditingGoal(goal);
      setEditingGoalTitle(goal.title || goal.shortTitle || "");
      setEditingGoalSummary(goal.summary || "");
      setMutationError("");
    },
    openTaskEditor(task) {
      setEditingTask(task);
      setEditingTaskTitle(task.title || "");
      setEditingTaskSummary(task.plan?.summary || task.description || "");
      setEditingTaskGoalId(task.goalId || "");
      setMutationError("");
    },
    openTaskPrimaryAction(task) {
      setMutationError("");
      const { mode } = taskCardPrimaryAction(task.status);
      if (mode === "detail") {
        selectTask(task.id);
        onOpenTaskConversation?.(task.id);
        return;
      }
      setTaskActionDialog({ mode, task });
    },
    permanentlyDeleteTask: async () => {
      if (!deletingTask) return;
      try {
        if (await onDeleteTask?.(deletingTask.id) === false) throw new Error("任务删除未完成，请重试。");
        setTaskActionDialog(null);
        setEditingTask(null);
        setDeletingTask(null);
      } catch (error) { setMutationError(actionError(error)); }
    },
    rerunFailedChecks: async (task) => {
      const failedRuns = failedRunsForTask(task);
      const checkIds = failedRuns.map((run) => run.id).filter(Boolean);
      const fallbackIds = checksForPlan(task?.plan).map((check) => check.id);
      const ids = [...new Set(checkIds.length ? checkIds : fallbackIds)];
      if (!task || !ids.length) return false;
      for (const checkId of ids) if (!await onRunGuardedCheck?.(task.id, checkId)) return false;
      return true;
    },
    restoreTask: async (task) => {
      try {
        await saveDesktopTask({ ...task, archivedAt: null, updatedAt: new Date().toISOString() });
        reload();
      } catch (error) { setMutationError(actionError(error)); }
    },
    saveGoalEdit: async (event) => {
      event.preventDefault();
      if (!editingGoal || !editingGoalTitle.trim()) return setMutationError("请填写目标名称。");
      try {
        await updateWorkspaceGoal({ id: editingGoal.id, title: editingGoalTitle.trim(), summary: editingGoalSummary.trim() });
        reload();
      } catch (error) { setMutationError(actionError(error)); }
    },
    saveTaskEdit: async (event) => {
      event.preventDefault();
      const title = editingTaskTitle.trim();
      if (!editingTask || !title) return setMutationError("请填写任务名称。");
      const goal = taskGoalOptions.find((item) => item.id === editingTaskGoalId);
      try {
        await saveDesktopTask({ ...editingTask, title, goalId: goal?.id || "", goalTitle: goal?.shortTitle || goal?.title || "", updatedAt: new Date().toISOString(), plan: { ...(editingTask.plan || {}), summary: editingTaskSummary.trim() } });
        reload();
      } catch (error) { setMutationError(actionError(error)); }
    },
    startTaskFromDialog: async ({ isolate = false } = {}) => {
      const task = taskActionDialog?.task;
      if (!task) return;
      try {
        setTaskModelPreflight(true);
        if (!await onEnsureModelAvailable?.()) return setMutationError("当前模型实时检测不可用，任务没有开始。请更新 Key 或切换连接后重试。");
        if (task.executionMode !== (isolate ? "isolated" : "direct")) {
          await saveDesktopTask({ ...task, executionMode: isolate ? "isolated" : "direct", updatedAt: new Date().toISOString() });
        }
        if (await onMarkTaskWaiting?.(task.id) === false) return setMutationError("任务未能开始，请检查当前状态。");
        setTaskActionDialog(null);
        selectTask(task.id);
      } catch (error) { setMutationError(actionError(error)); }
      finally { setTaskModelPreflight(false); }
    },
  };
}
