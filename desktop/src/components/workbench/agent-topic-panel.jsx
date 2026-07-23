import { AgentTopicPanelContent } from "./agent-topic-panel-content";
import { useAgentTopicTaskActions } from "./use-agent-topic-task-actions";
import { useAgentTopicTaskBoard } from "./use-agent-topic-task-board";
import { buildAgentTopicViewModel, canPreviewAgentTopicFile } from "../../lib/agent-topic-view-model";
import { taskCardPrimaryAction } from "../../lib/task-card-action";
import { goalStatusLabelText } from "../../lib/goal-presentation";

export function AgentTopicPanel({
  agentRuns = [],
  onApproveAgentRun,
  onResumeAgentRun,
  activeTaskId,
  provider,
  topic,
  tasks = [],
  snapshot,
  composerModelAvailability = {},
  runnerLoadingId,
  handoffLoading,
  onGeneratePatchDraft,
  onApplyPatchDraft,
  onMergeHandoff,
  onRunGuardedCheck,
  onSelectTask,
  onMarkTaskWaiting,
  onEnsureModelAvailable,
  onCreateTask,
  onCreateGoal,
  onDeleteTask,
  onArchiveGoal,
  onMergeGoal,
  onRestoreGoal,
  onPersistTask,
  onUpdateGoal,
  onCreateRepairTask,
  onOpenCapabilityFile,
  onOpenTaskConversation,
  onRefreshWorkspace,
  presentation,
  compact = false,
}) {
  const {
    activeGoalFromSnapshot,
    checksForPlan,
    isNoiseTask,
    phaseLabel,
    statuses: taskStatuses,
    taskStatusLabel,
    taskUpdatedLabel,
  } = presentation;
  const id = topic?.id || "";
  const boardState = useAgentTopicTaskBoard({
    activeTaskId,
    isNoiseTask,
    snapshot,
    statuses: taskStatuses,
    tasks,
  });
  const {
    archivingGoal, archivingTask, createGoalOpen, createTaskError, createTaskOpen,
    deletingTask, editingGoal, editingGoalSummary, editingGoalTitle, editingTask,
    editingTaskGoalId, editingTaskSummary, editingTaskTitle, goalHistoryOpen,
    mergeTargetGoalId, mergingGoal, mutationError, newGoalTitle, newTaskGoalId,
    newTaskSummary, newTaskTitle, setArchivingGoal, setArchivingTask, setCreateGoalOpen,
    setCreateTaskError, setCreateTaskOpen, setDeletingTask, setEditingGoal,
    setEditingGoalSummary, setEditingGoalTitle, setEditingTask, setEditingTaskGoalId,
    setEditingTaskSummary, setEditingTaskTitle, setGoalHistoryOpen, setMergeTargetGoalId,
    setMergingGoal, setMutationError, setNewGoalTitle, setNewTaskGoalId, setNewTaskSummary,
    setNewTaskTitle, setTaskActionDialog, setTaskFilter, setTaskModelPreflight, setTaskSort,
    taskActionDialog, taskFilter, taskModelPreflight, taskSort,
    activeTasks, currentTask, doneTasks, failedTasks, mergeGoalOptions, recentResultTasks,
    goalTitleForTask, taskGoalOptions, taskGroups, visibleTasks,
  } = boardState;
  const taskFilterLabel = {
    all: "全部", done: "已完成", failed: "失败", pending: "待处理", running: "进行中", verify: "待验证",
  }[taskFilter] || "全部";
  const taskSortLabel = {
    created: "创建时间", goal: "目标顺序", status: "任务状态", updated: "最近更新",
  }[taskSort] || "最近更新";
  const { activeCapabilitySpec, activeGoal, archivedGoals, archivedTasks, capabilityKind, cards, currentChecks, currentPlan, doneGoals, modelAvailable } = buildAgentTopicViewModel({
    activeGoalFromSnapshot, activeTasks, checksForPlan, composerModelAvailability, currentTask, doneTasks, failedTasks,
    goalStatusLabel: goalStatusLabelText, phaseLabel, provider, recentResultTasks, snapshot, taskNextAction: presentation.taskNextAction, tasks, topic, visibleTasks,
  });
  if (!cards) return null;
  const {
    archiveGoal, archiveTask, executeTaskDetailAction, failedRunsForTask, failureSummaryForTask,
    mergeGoal, openCreateTaskForGoal, openGoalEditor, openTaskEditor, openTaskPrimaryAction,
    openTaskFromCard, permanentlyDeleteTask, restoreGoal, restoreTask, rerunFailedChecks,
    runChecksForTask, saveGoalEdit, saveTaskEdit, selectTaskInWorkspace, startTaskFromDialog,
    submitNewGoal, submitNewTask,
  } = useAgentTopicTaskActions({
    activeGoal,
    boardState,
    helpers: { checksForPlan, goalTitleForTask, isTaskNoise: isNoiseTask, taskGoalOptions },
    modelAvailable,
    onApplyPatchDraft,
    onArchiveGoal,
    onCreateGoal,
    onCreateRepairTask,
    onCreateTask,
    onDeleteTask,
    onEnsureModelAvailable,
    onGeneratePatchDraft,
    onMarkTaskWaiting,
    onMergeGoal,
    onMergeHandoff,
    onOpenTaskConversation,
    onPersistTask,
    onRefreshWorkspace,
    onRestoreGoal,
    onRunGuardedCheck,
    onSelectTask,
    onUpdateGoal,
  });

  return <AgentTopicPanelContent
    activeCapabilitySpec={activeCapabilitySpec}
    canPreviewAgentTopicFile={canPreviewAgentTopicFile}
    capabilityKind={capabilityKind}
    cards={cards}
    compact={compact}
    currentTaskDetailProps={{ currentChecks, currentPlan, currentTask, goalTitleForTask, onApplyPatchDraft, onGeneratePatchDraft, onMergeHandoff, onOpenTask: selectTaskInWorkspace, onRunChecks: runChecksForTask, taskStatusLabel }}
    executionResultsProps={{ agentRuns, failedRunsForTask, failureSummaryForTask, onApproveAgentRun, onCreateRepairTask, onOpenTask: selectTaskInWorkspace, onResumeAgentRun, onRerunFailedChecks: rerunFailedChecks, recentResultTasks, runnerLoadingId, taskStatuses, taskStatusLabel }}
    id={id}
    onOpenCapabilityFile={onOpenCapabilityFile}
    taskBoardProps={{
      archiveGoal, archiveTask, archivedGoals, archivedTasks, archivingGoal, archivingTask, createGoalOpen,
      createTaskError, createTaskOpen, deletingTask, doneGoals, editingGoal, editingGoalSummary, editingGoalTitle,
      editingTask, editingTaskGoalId, editingTaskSummary, editingTaskTitle, failureSummaryForTask, goalHistoryOpen,
      goalTitleForTask, mergeGoal, mergeGoalOptions, mergeTargetGoalId, mergingGoal, modelAvailable, mutationError,
      newGoalTitle, newTaskGoalId, newTaskSummary, newTaskTitle,
      onArchiveGoal: (group) => { setMutationError(""); setArchivingGoal(taskGoalOptions.find((goal) => goal.id === group.id) || null); },
      onArchiveTask: setArchivingTask, onCreateTask: openCreateTaskForGoal, onDeleteTask: setDeletingTask,
      onEditGoal: openGoalEditor, onEditTask: openTaskEditor,
      onMergeGoal: (group) => { const goal = mergeGoalOptions.find((item) => item.id === group.id) || null; setMutationError(""); setMergingGoal(goal); setMergeTargetGoalId(mergeGoalOptions.find((item) => item.id !== group.id)?.id || ""); },
      onPrimaryAction: openTaskPrimaryAction, onOpenTask: selectTaskInWorkspace,
      onConfirmStart: startTaskFromDialog, onExecuteDetail: executeTaskDetailAction,
      onApplyPatchDraft, onGeneratePatchDraft,
      onMergeHandoff, onRepair: (task) => { setTaskActionDialog(null); onCreateRepairTask?.(task.id); },
      onRerunFailed: rerunFailedChecks, onRestoreGoal: restoreGoal, onRestoreTask: restoreTask,
      onRunChecks: runChecksForTask, onSubmitGoal: submitNewGoal, onSubmitTask: submitNewTask,
      openTaskFromCard, permanentlyDeleteTask, primaryActionLabel: (task) => taskCardPrimaryAction(task.status).label, runnerLoadingId,
      saveGoalEdit, saveTaskEdit, setArchivingGoal, setArchivingTask, setCreateGoalOpen, setCreateTaskOpen,
      setDeletingTask, setEditingGoal, setEditingGoalSummary, setEditingGoalTitle, setEditingTask, setEditingTaskGoalId,
      setEditingTaskSummary, setEditingTaskTitle, setGoalHistoryOpen, setMergeTargetGoalId, setNewGoalTitle,
      setNewTaskGoalId, setNewTaskSummary, setNewTaskTitle, setTaskActionDialog, setTaskFilter, setTaskSort,
      taskActionDialog, taskFilter, taskFilterLabel, taskGoalOptions, taskGroups, taskModelPreflight, taskSort,
      taskSortLabel, taskStatusLabel, taskUpdatedLabel, currentTask,
    }}
    topic={topic}
  />;
}
