const finishedStatuses = new Set(["done", "failed", "cancelled"]);

function normalizedTaskTitle(title) {
  return String(title || "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, "")
    .toLocaleLowerCase("zh-CN");
}

function taskTimestamp(task) {
  const value = task?.updatedAt || task?.createdAt || task?.requestTrace?.startedAt || "";
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isUnfinishedTask(task) {
  return !task?.archivedAt && !finishedStatuses.has(task?.status);
}

export function taskDuplicateKey(task) {
  const title = normalizedTaskTitle(task?.title);
  return title ? `${task?.goalId || "ungrouped"}::${title}` : "";
}

export function findOpenTaskDuplicate(tasks = [], candidate) {
  if (!isUnfinishedTask(candidate)) return null;
  const key = taskDuplicateKey(candidate);
  if (!key) return null;
  return tasks.find((task) => task?.id !== candidate?.id && isUnfinishedTask(task) && taskDuplicateKey(task) === key) || null;
}

export function collapseDuplicateOpenTasks(tasks = []) {
  const visible = [];
  const openTaskIndex = new Map();

  for (const task of tasks) {
    if (!isUnfinishedTask(task)) {
      visible.push(task);
      continue;
    }

    const key = taskDuplicateKey(task);
    if (!key) {
      visible.push(task);
      continue;
    }

    const existingIndex = openTaskIndex.get(key);
    if (existingIndex === undefined) {
      openTaskIndex.set(key, visible.length);
      visible.push(task);
      continue;
    }

    const existing = visible[existingIndex];
    if (taskTimestamp(task) >= taskTimestamp(existing)) {
      visible[existingIndex] = task;
    }
  }

  return visible;
}

export function taskProgressSummary(task) {
  const steps = Array.isArray(task?.plan?.steps) ? task.plan.steps.filter(Boolean) : [];
  const runs = Array.isArray(task?.runs) ? task.runs : [];
  const passedChecks = runs.filter((run) => run?.success).length;
  return {
    passedChecks,
    stepCount: steps.length,
    steps,
  };
}

export function taskUpdatedLabel(task) {
  const value = task?.updatedAt || task?.createdAt || "";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return String(value).replace("T", " ").slice(0, 16) || "无更新时间";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(parsed)).replaceAll("/", "-");
}

export function taskVerificationStatusLabel(task, { doneStatus = "done", failedStatus = "failed" } = {}) {
  if (task?.verificationSummary) return task.verificationSummary;
  if (task?.status === doneStatus) return "已完成";
  if (task?.status === failedStatus) return "有失败项";
  return "待验证";
}

export function taskGoalName(task, snapshot) {
  if (task?.goalTitle) return task.goalTitle;
  const goals = [
    ...(snapshot?.goals?.goals || []),
    ...(snapshot?.projectGoals?.projectGoals || []),
  ];
  const goal = goals.find((item) => item.id === task?.goalId);
  return goal?.shortTitle || goal?.title || "未关联目标";
}
