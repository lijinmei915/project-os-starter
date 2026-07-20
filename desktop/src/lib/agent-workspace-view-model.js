import { conversationRuntimeState } from "../conversation-runtime";
import { taskPositionInGoal, tasksForWorkspaceGoal } from "./task-goal-groups";

export function buildAgentWorkspaceViewModel({ activeTask, chatLoading, chatTurns, loading, pendingTurn, snapshot, tasks = [] }) {
  const activeTaskGoal = [
    ...(snapshot?.goals?.goals || []),
    ...(snapshot?.projectGoals?.projectGoals || []),
  ].find((goal) => goal.id === activeTask?.goalId);
  const activeTaskGoalTasks = activeTask
    ? tasksForWorkspaceGoal(tasks, activeTask, Array.isArray(activeTaskGoal?.taskIds) ? activeTaskGoal.taskIds : [])
    : [];
  const activeTaskPosition = taskPositionInGoal(activeTaskGoalTasks, activeTask?.id);
  return {
    activeTaskGoalTasks,
    conversationRuntime: conversationRuntimeState({
      activeTask,
      loading: chatLoading || Boolean(pendingTurn),
      turns: chatTurns,
    }),
    nextConversationTask: activeTaskGoalTasks[activeTaskPosition.index + 1],
    previousConversationTask: activeTaskGoalTasks[activeTaskPosition.index - 1],
    activeTaskPosition,
  };
}
