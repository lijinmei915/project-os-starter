export function projectTasksForProject(tasks = [], project) {
  return tasks.filter((task) => {
    if (task.projectId && task.projectId === project.id) return true;
    if (task.projectPath && task.projectPath === project.path) return true;
    if (task.projectName && task.projectName === project.name) return true;
    return false;
  });
}

export function projectRuntimeStatus(project, { planLoading = false, projectActivities = {}, tasks = [], taskStatuses, terminalRunningId = "" } = {}) {
  const relatedTasks = projectTasksForProject(tasks, project);
  if ((project.isCurrent && planLoading) || relatedTasks.some((task) => task.id === terminalRunningId)) {
    return { tone: "running", label: "进行中" };
  }
  if (relatedTasks.some((task) => [taskStatuses.failed, "interrupted", "canceled", "cancelled", "error"].includes(task.status))) {
    return { tone: "danger", label: "任务或会话中断" };
  }
  const cachedActivity = projectActivities[project.id];
  if (cachedActivity?.tone) return cachedActivity;
  if (project.health === "ready") return { tone: "", label: project.statusLabel || "已就绪" };
  if (project.health === "missing") return { tone: "danger", label: project.statusLabel || "路径失效" };
  if (project.health === "partial") return { tone: "warning", label: project.statusLabel || "缺少关键文件" };
  return { tone: "", label: project.statusLabel || "普通项目" };
}

export function discoverableProjectCapabilities(snapshot, labels = {}) {
  return (snapshot?.projectCapabilities?.workspaceCapabilities || snapshot?.projectCapabilities?.capabilities || [])
    .filter((capability) => labels[capability.id] && (["available", "detected", "recommended"].includes(capability.status)
      || (capability.status === "enabled" && capability.modules?.some((module) => module.status !== "enabled"))));
}
