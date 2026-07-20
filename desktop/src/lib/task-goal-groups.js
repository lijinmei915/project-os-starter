export function groupTasksByGoal(tasks = [], goalLabel = () => "未关联目标") {
  const groups = new Map();
  for (const task of tasks) {
    const label = goalLabel(task);
    const id = task?.goalId || `unlinked:${label}`;
    if (!groups.has(id)) groups.set(id, { id, label, tasks: [] });
    groups.get(id).tasks.push(task);
  }
  return [...groups.values()];
}

export function tasksForWorkspaceGoal(tasks = [], task, goalTaskIds = []) {
  if (!task?.id) return [];
  const related = tasks.filter((item) => {
    if (!item?.id || item.archivedAt) return false;
    if (!task.goalId) return item.id === task.id;
    return item.goalId === task.goalId;
  });
  const preferredOrder = new Map(goalTaskIds.map((id, index) => [id, index]));
  return collapseDuplicateOpenTasks(related).sort((left, right) => {
    const leftOrder = preferredOrder.has(left.id) ? preferredOrder.get(left.id) : Number.MAX_SAFE_INTEGER;
    const rightOrder = preferredOrder.has(right.id) ? preferredOrder.get(right.id) : Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    const leftCreated = Date.parse(left.createdAt || "") || 0;
    const rightCreated = Date.parse(right.createdAt || "") || 0;
    return leftCreated - rightCreated || String(left.id).localeCompare(String(right.id));
  });
}

export function taskPositionInGoal(tasks = [], taskId) {
  const index = tasks.findIndex((item) => item.id === taskId);
  return {
    current: index >= 0 ? index + 1 : 1,
    index: index >= 0 ? index : 0,
    total: Math.max(tasks.length, 1),
  };
}

export function sortTasksForGoal(tasks = [], goalTaskIds = []) {
  const order = new Map(goalTaskIds.map((id, index) => [id, index]));
  return [...tasks].sort((left, right) => {
    const leftOrder = order.has(left.id) ? order.get(left.id) : Number.MAX_SAFE_INTEGER;
    const rightOrder = order.has(right.id) ? order.get(right.id) : Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return String(left.createdAt || "").localeCompare(String(right.createdAt || ""));
  });
}
import { collapseDuplicateOpenTasks } from "./task-presentation.js";
