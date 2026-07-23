export function goalStatusLabel(todos = [], fallbackPhase, { phaseLabel, taskStatuses }) {
  if (!todos.length) return phaseLabel(fallbackPhase);
  if (todos.every((todo) => todo.status === taskStatuses.done)) return "待验证";
  if (todos.some((todo) => todo.status === taskStatuses.failed)) return "需处理";
  if (todos.some((todo) => todo.status === taskStatuses.running)) return "进行中";
  if (todos.some((todo) => todo.status === taskStatuses.waitingApproval)) return "待确认";
  if (todos.some((todo) => todo.status === taskStatuses.planned)) return "推进中";
  return phaseLabel(fallbackPhase);
}

export function goalValidationStatusFromActiveGoal(activeGoal, validationGoal, validationReportStatus) {
  if (activeGoal?.status === "done") return "signed-off";
  if (activeGoal?.status === "pending-confirm") return "verified";
  if (activeGoal?.status === "failed") return "validation-failed";
  const validationBelongsToActiveGoal = Boolean(activeGoal?.id && validationGoal?.id === activeGoal.id);
  if (!validationBelongsToActiveGoal) return "";
  return validationGoal?.status || (validationReportStatus === "passed" ? "verified" : "");
}

export function goalMetaFromStatus(status, validationReportStatus, todos, phase, dependencies) {
  if (status === "signed-off" || status === "done") return "已完成";
  if (status === "draft" || status === "planned") return "待确认";
  if (status === "verified" || status === "pending-confirm" || validationReportStatus === "passed") return "待确认";
  if (status === "validation-failed" || status === "failed" || validationReportStatus === "failed") return "验收失败";
  return goalStatusLabel(todos, phase, dependencies);
}

export function goalStatusLabelText(status) {
  return {
    active: "进行中",
    draft: "待确认",
    planned: "待拆解",
    "pending-confirm": "待确认",
    done: "已完成",
    failed: "需处理",
    queued: "待开始",
    paused: "暂停",
  }[status] || status || "进行中";
}

export function compactGoalTitle(title, displayText = (value, fallback = "") => String(value ?? fallback)) {
  const normalized = displayText(title, "当前目标")
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, " / ")
    .trim();
  if (normalized.length <= 18) return normalized;
  const parts = normalized.split(/\s*\/\s*/).map((part) => part.trim()).filter(Boolean);
  const usefulPart = parts.find((part) => part.length <= 18) || parts[parts.length - 1];
  if (usefulPart && usefulPart.length <= 18) return usefulPart;
  return `${normalized.slice(0, 16)}...`;
}

export function progressFromTodos(todos = [], taskStatuses) {
  if (!todos.length) return 0;
  const score = todos.reduce((total, todo) => {
    if (todo.status === taskStatuses.done) return total + 1;
    if (todo.displayStatus === taskStatuses.running || todo.displayStatus === taskStatuses.waitingApproval) return total + 0.5;
    return total;
  }, 0);
  return Math.round((score / todos.length) * 100);
}

export function taskDisplayStatus(task, { activeTaskId = "", planLoading = false, terminalRunningId = "" } = {}, taskStatuses) {
  if (!task) return "";
  const isLiveRunning = task.id === terminalRunningId || (planLoading && task.id === activeTaskId);
  if (task.status === taskStatuses.running && !isLiveRunning) return taskStatuses.planned;
  return task.status;
}

export function snapshotQueueTodos(snapshot = {}, { isNoiseTask, taskStatuses }) {
  return (snapshot.queue || [])
    .filter((item) => !isNoiseTask(item))
    .map((item, index) => ({
      description: item.body || item.projectName || "",
      goalId: item.goalId || "",
      id: item.id || `snapshot-queue-${index}`,
      status: item.status || taskStatuses.planned,
      title: item.title || "未命名任务",
    }));
}

export function projectProfileItems(snapshot = {}) {
  const profile = snapshot.projectProfile || {};
  const missingFields = new Set(profile.missingFields || []);
  const workbenchItems = [
    { title: "项目概览", body: profile.overview || profile.intro },
    { title: "当前阶段", body: profile.phaseSummary || snapshot.stage || snapshot.phase },
    { title: "技术架构", body: profile.architectureSummary },
    { title: "检查命令", body: profile.checkCommands },
    { title: "协作规则", body: profile.collaborationRules || profile.userPreferences },
  ];
  const legacyItems = [
    { title: "项目简介", body: profile.intro },
    { title: "长期目标", body: profile.longTermGoal },
    { title: "目标用户", body: profile.targetUsers },
    { title: "使用场景", body: profile.useCases },
    { title: "用户偏好", body: profile.userPreferences },
  ];
  const items = workbenchItems.some((item) => item.body) ? workbenchItems : legacyItems;
  return items.map((item) => ({ ...item, missing: missingFields.has(item.title) || !item.body }));
}

export function taskSubtasks(task, taskStatuses) {
  const steps = Array.isArray(task?.plan?.steps) ? task.plan.steps : [];
  if (steps.length) {
    return steps.map((step, index) => ({
      id: `${task.id || task.title}-step-${index}`,
      status: index === 0 && task.status === taskStatuses.done ? taskStatuses.done : task.status,
      title: step,
    }));
  }
  if (task?.description) {
    return [{ id: `${task.id || task.title}-summary`, status: task.status, title: task.description }];
  }
  return [];
}
