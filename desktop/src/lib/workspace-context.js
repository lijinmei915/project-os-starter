const terminalGoalStatuses = new Set(["archived", "done", "merged"]);

export function isActionableWorkspaceGoal(goal) {
  return Boolean(goal?.id) && !terminalGoalStatuses.has(goal.status);
}

export function resolveWorkspaceGoal(snapshot = {}) {
  const goals = Array.isArray(snapshot?.goals?.goals) ? snapshot.goals.goals : [];
  const selected = goals.find((goal) => goal.id === snapshot?.goals?.activeGoalId);
  return isActionableWorkspaceGoal(selected)
    ? selected
    : goals.find(isActionableWorkspaceGoal) || selected || goals[0] || null;
}

export function resolveWorkspaceContext({ activeConversationId = "", activeTaskId = "", conversations = [], snapshot = {}, tasks = [] } = {}) {
  const conversation = conversations.find((item) => item.id === activeConversationId) || null;
  const taskId = activeTaskId || conversation?.taskId || "";
  const task = tasks.find((item) => item.id === taskId) || null;
  const goals = Array.isArray(snapshot?.goals?.goals) ? snapshot.goals.goals : [];
  const taskGoal = task?.goalId ? goals.find((goal) => goal.id === task.goalId) || null : null;
  return {
    conversation,
    goal: taskGoal || resolveWorkspaceGoal(snapshot),
    goalSource: taskGoal ? "task" : "workspace",
    task,
  };
}
