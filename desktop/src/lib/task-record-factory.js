const confirmationOnlyTitle = /^(好|好的|可以|行|继续|开始|执行|就这样|按这个来)$/;

export function taskTitleForPlan(displayTask, requestedTask, plan = {}) {
  const display = String(displayTask || "").trim();
  const requested = String(requestedTask || "").trim();
  if (display && !confirmationOnlyTitle.test(display.replace(/[。！!，,\s]/g, ""))) return display;
  if (requested && !confirmationOnlyTitle.test(requested.replace(/[。！!，,\s]/g, ""))) return requested;
  return String(plan?.task || plan?.summary || "").trim() || "未命名任务";
}

export function createTaskFromPlan(plan, taskText, snapshot = {}, options = {}, {
  now = () => new Date(),
  taskIdForRequest,
  taskStatuses,
}) {
  const title = taskText?.trim() || plan?.summary || "未命名任务";
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
    goalId: options.goalId || "",
    goalTitle: options.goalTitle || "",
    origin: options.origin || "conversation",
    projectName: snapshot.projectName,
    projectPath: snapshot.currentProjectPath || "",
    plan,
    runs: [],
  };
}
