import { createTaskBoardActionController } from "../../lib/task-board-action-controller";
import { createAgentTopicGoalActions } from "../../lib/agent-topic-goal-actions";
import { taskCardPrimaryAction } from "../../lib/task-card-action";
import { taskNextAction } from "../../lib/task-next-action";

/**
 * Owns Agent topic Task/Workspace action assembly and form submissions.
 * Persistence and execution remain injected from App through the controller
 * dependencies; this hook does not access Runtime or domain clients.
 */
export function useAgentTopicTaskActions({
  boardState,
  activeGoal,
  modelAvailable,
  onApplyPatchDraft,
  onDeleteTask,
  onEnsureModelAvailable,
  onGeneratePatchDraft,
  onMarkTaskWaiting,
  onMergeHandoff,
  onOpenTaskConversation,
  onRunGuardedCheck,
  onSelectTask,
  onRefreshWorkspace,
  onPersistTask,
  onUpdateGoal,
  onArchiveGoal,
  onMergeGoal,
  onRestoreGoal,
  onCreateTask,
  onCreateGoal,
  onCreateRepairTask,
  helpers,
}) {
  const {
    checksForPlan,
    goalTitleForTask,
    isTaskNoise,
    taskGoalOptions,
  } = helpers;
  const {
    deletingTask,
    editingGoal,
    editingGoalSummary,
    editingGoalTitle,
    editingTask,
    editingTaskGoalId,
    editingTaskSummary,
    editingTaskTitle,
    mergeTargetGoalId,
    mergingGoal,
    setCreateTaskError,
    setCreateTaskOpen,
    setDeletingTask,
    setEditingGoal,
    setEditingGoalSummary,
    setEditingGoalTitle,
    setEditingTask,
    setEditingTaskGoalId,
    setEditingTaskSummary,
    setEditingTaskTitle,
    setMergeTargetGoalId,
    setMergingGoal,
    setMutationError,
    setNewTaskGoalId,
    setNewTaskSummary,
    setNewTaskTitle,
    setTaskActionDialog,
    setTaskModelPreflight,
    taskActionDialog,
  } = boardState;

  const taskActions = createTaskBoardActionController({
    checksForPlan,
    deletingTask,
    editingGoal,
    editingGoalSummary,
    editingGoalTitle,
    editingTask,
    editingTaskGoalId,
    editingTaskSummary,
    editingTaskTitle,
    onApplyPatchDraft,
    onDeleteTask,
    onEnsureModelAvailable,
    onGeneratePatchDraft,
    onMarkTaskWaiting,
    onMergeHandoff,
    onOpenTaskConversation,
    onRunGuardedCheck,
    onSelectTask,
    reload: onRefreshWorkspace,
    saveDesktopTask: onPersistTask,
    setDeletingTask,
    setEditingGoal,
    setEditingGoalSummary,
    setEditingGoalTitle,
    setEditingTask,
    setEditingTaskGoalId,
    setEditingTaskSummary,
    setEditingTaskTitle,
    setMutationError,
    setTaskActionDialog,
    setTaskModelPreflight,
    taskActionDialog,
    taskCardPrimaryAction,
    taskGoalOptions,
    taskNextAction,
    updateWorkspaceGoal: onUpdateGoal,
  });
  const goalActions = createAgentTopicGoalActions({
    archiveWorkspaceGoal: onArchiveGoal,
    archivingGoal: boardState.archivingGoal,
    mergeTargetGoalId,
    mergeWorkspaceGoal: onMergeGoal,
    mergingGoal,
    reload: onRefreshWorkspace,
    restoreWorkspaceGoal: onRestoreGoal,
    setMutationError,
  });

  const openCreateTask = () => {
    setNewTaskGoalId(activeGoal?.id || taskGoalOptions[0]?.id || "");
    setNewTaskTitle("");
    setNewTaskSummary("");
    setCreateTaskError("");
    setCreateTaskOpen(true);
  };
  const openCreateTaskForGoal = (goalId) => {
    openCreateTask();
    setNewTaskGoalId(goalId);
  };
  const submitNewTask = async (event) => {
    event.preventDefault();
    if (!modelAvailable) {
      setCreateTaskError("请先在顶部连接设置中测试当前模型，确认可用后再创建任务。");
      return;
    }
    const title = boardState.newTaskTitle.trim();
    if (!title) {
      setCreateTaskError("请填写任务名称。");
      return;
    }
    try {
      await onCreateTask?.({ goalId: boardState.newTaskGoalId, summary: boardState.newTaskSummary.trim(), title });
      setCreateTaskOpen(false);
    } catch (err) {
      setCreateTaskError(err instanceof Error ? err.message : "新建任务失败，请重试。");
    }
  };
  const submitNewGoal = async (event) => {
    event.preventDefault();
    const title = boardState.newGoalTitle.trim();
    if (!title || !modelAvailable) return;
    await onCreateGoal?.({ title, summary: "" });
    boardState.setCreateGoalOpen(false);
  };
  const onArchiveGoalGroup = (group) => {
    setMutationError("");
    boardState.setArchivingGoal(taskGoalOptions.find((goal) => goal.id === group.id) || null);
  };
  const onMergeGoalGroup = (group) => {
    const goal = boardState.mergeGoalOptions.find((item) => item.id === group.id) || null;
    setMutationError("");
    setMergingGoal(goal);
    setMergeTargetGoalId(boardState.mergeGoalOptions.find((item) => item.id !== group.id)?.id || "");
  };
  const onRepair = (task) => {
    setTaskActionDialog(null);
    onCreateRepairTask?.(task.id);
  };

  return {
    ...taskActions,
    ...goalActions,
    onArchiveGoalGroup,
    onMergeGoalGroup,
    onRepair,
    openCreateTaskForGoal,
    submitNewGoal,
    submitNewTask,
  };
}
