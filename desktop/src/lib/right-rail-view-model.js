import { resolveWorkspaceContext } from "./workspace-context.js";
import { collapseDuplicateOpenTasks } from "./task-presentation.js";
import { groupConversations } from "./conversation-list.js";
import {
  goalMetaFromStatus,
  goalValidationStatusFromActiveGoal,
  progressFromTodos,
  projectProfileItems,
  snapshotQueueTodos,
  taskDisplayStatus,
  taskSubtasks,
} from "./goal-presentation.js";

const dialogueTaskIds = new Set([
  "dialogue-context-state",
  "dialogue-context-assembler",
  "dialogue-grounded-answer-contract",
  "dialogue-reference-action-loop",
  "dialogue-multiturn-evaluation",
]);

export function buildRightRailViewModel({
  activeConversationId,
  activeTaskId,
  conversations = [],
  isNoiseTask,
  planLoading = false,
  snapshot = {},
  taskFilter = "todo",
  taskStatuses,
  tasks = [],
  terminalRunningId = "",
}) {
  const { goal: activeGoal } = resolveWorkspaceContext({
    activeConversationId,
    activeTaskId,
    conversations,
    snapshot,
    tasks,
  });
  const activeGoalTaskIds = new Set(Array.isArray(activeGoal?.taskIds) ? activeGoal.taskIds : []);
  const belongsToActiveGoal = (item) => {
    if (!activeGoal?.id) return true;
    if (item.goalId) return item.goalId === activeGoal.id;
    return activeGoalTaskIds.size ? activeGoalTaskIds.has(item.id) : true;
  };
  const visibleTasks = collapseDuplicateOpenTasks(tasks.filter((task) => !isNoiseTask(task) && belongsToActiveGoal(task)));
  const snapshotTodos = collapseDuplicateOpenTasks(
    snapshotQueueTodos(snapshot, { isNoiseTask, taskStatuses }).filter(belongsToActiveGoal),
  );
  const goalTodos = visibleTasks.length
    ? visibleTasks.map((task) => {
        const displayStatus = taskDisplayStatus(task, { activeTaskId, planLoading, terminalRunningId }, taskStatuses);
        return {
          description: task.plan?.summary || task.projectName || "",
          displayStatus,
          conversationId: task.conversationId || "",
          goalId: task.goalId || "",
          id: task.id,
          status: displayStatus,
          subtasks: taskSubtasks(task, taskStatuses),
          task,
          title: task.title,
        };
      })
    : snapshotTodos.map((task) => ({ ...task, subtasks: taskSubtasks(task, taskStatuses) }));
  const doneCount = goalTodos.filter((todo) => todo.status === taskStatuses.done).length;
  const runningCount = goalTodos.filter((todo) => [taskStatuses.running, taskStatuses.waitingApproval].includes(todo.status)).length;
  const validationGoal = snapshot.goalValidation?.goal || {};
  const validationReportStatus = snapshot.goalValidationReport?.status || "missing";
  const validationStatus = goalValidationStatusFromActiveGoal(activeGoal, validationGoal, validationReportStatus);
  const visibleGoalTodos = taskFilter === "all"
    ? goalTodos
    : taskFilter === "done"
      ? goalTodos.filter((todo) => todo.status === taskStatuses.done)
      : goalTodos.filter((todo) => todo.status !== taskStatuses.done);
  const currentPhaseTodos = visibleGoalTodos.filter((todo) => dialogueTaskIds.has(todo.id));

  return {
    activeGoal,
    activeConversationCount: conversations.filter((conversation) => !conversation.archivedAt).length,
    conversationGroups: groupConversations(conversations),
    currentPhaseTodos,
    doneCount,
    futurePhaseTodos: visibleGoalTodos.filter((todo) => !dialogueTaskIds.has(todo.id)),
    goalIsDraft: activeGoal?.status === "draft",
    goalIsPlanned: activeGoal?.status === "planned" && !goalTodos.length,
    goalMeta: runningCount || (activeGoal?.status === "planned" && goalTodos.length)
      ? "进行中"
      : goalMetaFromStatus(activeGoal?.status || validationStatus, validationReportStatus, goalTodos, snapshot.phase, { phaseLabel, taskStatuses }),
    goalNeedsVerification: goalTodos.length > 0 && goalTodos.every((todo) => todo.status === taskStatuses.done),
    goalSignedOff: validationStatus === "signed-off",
    goalSteps: goalTodos.length
      ? [`完成 ${doneCount}`, `进行 ${runningCount}`, `待办 ${Math.max(goalTodos.length - doneCount - runningCount, 0)}`]
      : ["暂无任务", "等待拆解", "待确认"],
    goalTitle: activeGoal?.shortTitle || activeGoal?.title || snapshot.stage || snapshot.projectName || "当前项目",
    goalTodos,
    goalVerified: validationStatus === "verified",
    hasActiveWorkGoal: Boolean(activeGoal) && validationStatus !== "signed-off",
    profileItems: projectProfileItems(snapshot),
    progressValue: progressFromTodos(goalTodos, taskStatuses),
    snapshotTodos,
    todoMeta: visibleTasks.length || snapshotTodos.length,
    useDialoguePhaseGroups: currentPhaseTodos.length > 1,
    validationCriteria: Array.isArray(snapshot.goalValidation?.criteria) ? snapshot.goalValidation.criteria : [],
    validationStatus,
    visibleGoalTodos,
    visibleTasks,
  };
}

function phaseLabel(phase) {
  return {
    archived: "已归档",
    init: "启动中",
    maintenance: "维护中",
    shipping: "交付中",
    stabilizing: "打磨中",
  }[phase] || phase || "进行中";
}
