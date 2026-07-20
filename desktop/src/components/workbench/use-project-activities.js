import { useCallback, useEffect, useState } from "react";

export function useProjectActivities({ planLoading, snapshot, tasks, terminalRunningId, taskStatuses }) {
  const [projectActivities, setProjectActivities] = useState({});
  useEffect(() => {
    const projectId = snapshot.currentProjectId;
    if (!projectId) return;
    const relatedTasks = tasks.filter((task) => task.projectId === projectId || task.projectPath === snapshot.currentProjectPath || task.projectName === snapshot.projectName);
    const activity = planLoading || relatedTasks.some((task) => task.id === terminalRunningId)
      ? { tone: "running", label: "进行中" }
      : relatedTasks.some((task) => [taskStatuses.failed, "interrupted", "canceled", "cancelled", "error"].includes(task.status))
        ? { tone: "danger", label: "任务或会话中断" }
        : null;
    setProjectActivities((current) => {
      const next = { ...current };
      if (activity) next[projectId] = activity;
      else delete next[projectId];
      return next;
    });
  }, [snapshot.currentProjectId, snapshot.currentProjectPath, snapshot.projectName, tasks, planLoading, terminalRunningId, taskStatuses.failed]);
  const markProjectActivitySeen = useCallback((projectId) => {
    if (!projectId) return;
    setProjectActivities((current) => {
      const activity = current[projectId];
      if (!activity?.tone || ["danger", "running"].includes(activity.tone)) return current;
      const next = { ...current };
      delete next[projectId];
      return next;
    });
  }, []);
  const markProjectActivityCompleted = useCallback((task, fallbackProjectId) => {
    if (task?.status !== taskStatuses.done) return;
    const projectId = task.projectId || fallbackProjectId;
    if (!projectId) return;
    setProjectActivities((current) => ({ ...current, [projectId]: { tone: "success", label: "有新完成结果", taskId: task.id } }));
  }, [taskStatuses.done]);
  return { markProjectActivityCompleted, markProjectActivitySeen, projectActivities };
}
