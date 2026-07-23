export function createTaskFromPlan(plan, taskText, snapshot = {}, options = {}, {
  activeGoalFromSnapshot,
  now = () => new Date(),
  taskIdForRequest,
  taskStatuses,
}) {
  const title = taskText?.trim() || plan?.summary || "未命名任务";
  const activeGoal = activeGoalFromSnapshot(snapshot);
  const fallbackId = `${now().getTime()}-${Math.random().toString(16).slice(2)}`;
  const id = taskIdForRequest(options.requestId, fallbackId);
  const createdAt = now();
  return {
    id,
    title: title.length > 48 ? `${title.slice(0, 48)}...` : title,
    status: taskStatuses.planned,
    createdAt: createdAt.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    projectId: snapshot.currentProjectId || "",
    conversationId: options.conversationId || "",
    requestId: options.requestId || "",
    requestTrace: options.requestId ? {
      outcome: "pending",
      requestId: options.requestId,
      startedAt: options.startedAt || now().toISOString(),
      taskId: id,
    } : null,
    goalId: activeGoal?.id || "",
    goalTitle: activeGoal?.shortTitle || activeGoal?.title || "",
    projectName: snapshot.projectName,
    projectPath: snapshot.currentProjectPath || "",
    plan,
    runs: [],
  };
}
