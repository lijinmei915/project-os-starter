import { removeTaskState } from "./task-state.js";

export function createTaskLifecycleController({
  activeConversationId, activeConversationTaskId, activeTaskId, conversations, createTaskFromPlan,
  deleteTask, markProjectActivitySeen, persistTask, readonlyPlan, refreshSnapshot, setActiveTaskId,
  setConversations, setReadonlyPlan, setTasks, setSelectedEngineeringFile, showToast, snapshot,
  startNewConversation, taskStatuses, tasks,
}) {
  const findTask = (id) => tasks.find((task) => task.id === id);
  const now = () => new Date().toISOString();
  const selectTask = (id, options = {}) => {
    const queueItem = snapshot.queue?.find((item) => item.id === id);
    const task = findTask(id) || (queueItem ? {
      createdAt: "",
      id: queueItem.id,
      plan: {
        candidateChanges: [], checks: [], filesToRead: [],
        guardrails: ["这是目标拆解里的待办，开始执行前仍需确认具体改动范围。"],
        mode: "planned-task", projectName: snapshot.projectName,
        steps: [queueItem.body || "补齐任务执行方案。"], summary: queueItem.body || "",
        task: queueItem.title, trace: [`GOAL_TASK: ${queueItem.goalId || "current"}`],
      },
      projectId: snapshot.currentProjectId || "", projectName: snapshot.projectName,
      projectPath: snapshot.currentProjectPath || "", status: queueItem.status || taskStatuses.planned,
      title: queueItem.title,
    } : null);
    if (!task) return false;
    markProjectActivitySeen(task.projectId || snapshot.currentProjectId);
    setActiveTaskId(id);
    setReadonlyPlan(task.plan);
    if (!options.preserveWorkspace) setSelectedEngineeringFile(null);
    return true;
  };

  return {
    completeTask: async (id) => {
      const task = findTask(id);
      if (!task) return false;
      await persistTask({ ...task, completedAt: now(), status: taskStatuses.done, updatedAt: now(), verificationSummary: task.verificationSummary || "任务结果已由用户确认。" }, { durable: true });
      showToast("任务已确认完成。");
      return true;
    },
    createManualTask: async ({ goalId, summary, title }) => {
      const taskTitle = String(title || "").trim();
      if (!taskTitle) throw new Error("请填写任务名称。");
      const goals = [...(snapshot.goals?.goals || []), ...(snapshot.projectGoals?.projectGoals || [])];
      const goal = goals.find((item) => item?.id === goalId) || null;
      const createdAt = now();
      const task = {
        id: `manual-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        title: taskTitle, status: taskStatuses.planned, createdAt, updatedAt: createdAt,
        projectId: snapshot.currentProjectId || "", projectName: snapshot.projectName || "", projectPath: snapshot.currentProjectPath || "",
        goalId: goal?.id || "", goalTitle: goal?.shortTitle || goal?.title || "", origin: "manual", runs: [],
        plan: {
          task: taskTitle, projectName: snapshot.projectName || "", mode: "manual-task",
          summary: String(summary || "").trim() || `推进任务：${taskTitle}`,
          steps: ["确认任务范围与预期结果。", "通过对话或受控执行推进任务。"], candidateChanges: [], checks: [], filesToRead: [],
          guardrails: ["新建任务不改动工程文件。", "任何工程文件写入仍需用户确认。"],
        },
      };
      const persistedTask = await persistTask(task, { durable: true });
      showToast("任务已创建，并保存到当前项目。", "success");
      return persistedTask;
    },
    createRepairTask: async (failedTaskId) => {
      const failedTask = findTask(failedTaskId);
      if (!failedTask) return false;
      const repairAttempt = Number(failedTask.repair?.attempt || 0);
      if (repairAttempt >= 2) {
        showToast("该任务已达到两轮修复上限，请查看失败证据后手动调整任务。", "error");
        return false;
      }
      const failedRuns = (failedTask.runs || []).filter((run) => run?.success === false);
      const failedLabels = failedRuns.map((run) => run.label || run.id || run.command).filter(Boolean);
      const failureSummary = failedTask.applyResult?.message || failedRuns[0]?.output || failedTask.verificationSummary || "失败原因待进一步定位。";
      const sourceTitle = failedTask.title || "失败任务";
      const repair = { attempt: repairAttempt + 1, failureOutput: String(failureSummary).slice(0, 8000), phase: "pending", remaining: 2 - (repairAttempt + 1), sourceTitle };
      await persistTask({
        ...failedTask,
        patchDraft: null,
        repair,
        status: "repair pending",
        executionEvidence: [...(failedTask.executionEvidence || []), { at: now(), details: { failedChecks: failedLabels }, kind: "repair", status: "pending", summary: `第 ${repair.attempt} 轮修复已准备，等待生成草稿。` }],
      }, { durable: true });
      setActiveTaskId(failedTask.id);
      setReadonlyPlan(failedTask.plan);
      showToast("已在当前任务中准备修复草稿。", "success");
      return true;
    },
    markTaskWaiting: async (id) => {
      const task = findTask(id);
      if (!task) return false;
      await persistTask({ ...task, status: taskStatuses.waitingApproval }, { durable: true });
      return true;
    },
    removeTask: async (id) => {
      const taskConversationId = findTask(id)?.conversationId || "";
      await deleteTask(id);
      const nextState = removeTaskState({ activeConversationTaskId, activeTaskId, conversations, readonlyPlan, taskConversationId, tasks }, id);
      setTasks(nextState.tasks);
      setConversations(nextState.conversations);
      setActiveTaskId(nextState.activeTaskId);
      setReadonlyPlan(nextState.readonlyPlan);
      if (nextState.shouldResetConversation) startNewConversation();
      await refreshSnapshot();
      showToast("任务已永久删除。");
      return true;
    },
    selectTask,
  };
}
