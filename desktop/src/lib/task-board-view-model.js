import { groupTasksByGoal, sortTasksForGoal } from "./task-goal-groups.js";
import { collapseDuplicateOpenTasks } from "./task-presentation.js";

const completedGoalStatuses = new Set(["archived", "merged", "done"]);

function taskMatchesFilter(task, filter, statuses) {
  if (filter === "all") return true;
  if (filter === "pending") return [statuses.planned, statuses.waitingApproval, statuses.repairPending, statuses.waitingRepairApproval].includes(task.status);
  if (filter === "running") return task.status === statuses.running;
  if (filter === "verify") return task.status === statuses.done && (!task.verificationSummary || task.verificationSummary.includes("待验证"));
  if (filter === "done") return task.status === statuses.done && Boolean(task.verificationSummary) && !task.verificationSummary.includes("待验证");
  if (filter === "failed") return [statuses.failed, statuses.repairFailed].includes(task.status);
  return true;
}

function taskTimeValue(task, key) {
  const value = Date.parse(task?.[key] || "");
  return Number.isNaN(value) ? 0 : value;
}

function taskStatusRank(task, statuses) {
  return {
    [statuses.failed]: 0,
    [statuses.repairFailed]: 0,
    [statuses.repairPending]: 1,
    [statuses.waitingRepairApproval]: 2,
    [statuses.running]: 1,
    [statuses.waitingApproval]: 2,
    [statuses.planned]: 3,
    [statuses.done]: 4,
  }[task.status] ?? 5;
}

export function buildTaskBoardViewModel({ activeTaskId, filter, isNoiseTask, snapshot, sort, statuses, tasks }) {
  const visibleTasks = collapseDuplicateOpenTasks((tasks || []).filter((task) => !isNoiseTask(task) && !task.archivedAt));
  const activeTasks = visibleTasks.filter((task) => ![statuses.done, statuses.failed, statuses.repairFailed].includes(task.status));
  const doneTasks = visibleTasks.filter((task) => task.status === statuses.done);
  const failedTasks = visibleTasks.filter((task) => [statuses.failed, statuses.repairPending, statuses.repairFailed].includes(task.status));
  const stageGoals = snapshot?.goals?.goals || [];
  const projectGoals = snapshot?.projectGoals?.projectGoals || [];
  const taskGoalOptions = [...stageGoals.filter((goal) => !completedGoalStatuses.has(goal.status)), ...projectGoals]
    .filter((goal, index, rows) => goal?.id && rows.findIndex((item) => item.id === goal.id) === index);
  const goalTitleForTask = (task) => {
    if (task?.goalTitle) return task.goalTitle;
    const goalId = task?.goalId || "";
    const goal = [...stageGoals, ...projectGoals].find((item) => item.id === goalId);
    return goal?.shortTitle || goal?.title || "未关联目标";
  };
  const boardTasks = visibleTasks
    .filter((task) => taskMatchesFilter(task, filter, statuses))
    .sort((left, right) => {
      if (sort === "goal") return 0;
      if (sort === "created") return taskTimeValue(left, "createdAt") - taskTimeValue(right, "createdAt");
      if (sort === "status") return taskStatusRank(left, statuses) - taskStatusRank(right, statuses) || taskTimeValue(right, "updatedAt") - taskTimeValue(left, "updatedAt");
      return taskTimeValue(right, "updatedAt") - taskTimeValue(left, "updatedAt");
    });
  const taskGroups = groupTasksByGoal(boardTasks, goalTitleForTask).map((group) => {
    const goal = taskGoalOptions.find((item) => item.id === group.id);
    return sort === "goal" ? { ...group, tasks: sortTasksForGoal(group.tasks, goal?.taskIds || []) } : group;
  });

  return {
    activeTasks,
    currentTask: visibleTasks.find((task) => task.id === activeTaskId) || null,
    doneTasks,
    failedTasks,
    mergeGoalOptions: stageGoals.filter((goal) => !completedGoalStatuses.has(goal.status)),
    recentResultTasks: [...doneTasks, ...failedTasks].slice(0, 5),
    goalTitleForTask,
    taskGoalOptions,
    taskGroups,
    visibleTasks,
  };
}
