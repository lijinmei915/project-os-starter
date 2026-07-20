import { ArrowUpDown, Filter, Plus } from "lucide-react";
import { PatchDraft } from "./plan-views";
import { AgentTopicTaskGroups } from "./agent-topic-task-groups";
import { AgentTopicTaskDialogs } from "./agent-topic-task-dialogs";
import { TaskActionDialog } from "./task-action-dialog";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";

const taskFilters = [["all", "全部任务"], ["pending", "待确认"], ["running", "进行中"], ["verify", "待验证"], ["done", "已完成"], ["failed", "有失败项"]];
const taskSorts = [["goal", "目标顺序"], ["updated", "最近更新"], ["created", "最早创建"], ["status", "状态优先"]];

export function AgentTopicTaskBoard({
  archiveGoal, archiveTask, archivedGoals, archivedTasks, archivingGoal, archivingTask, currentChecks, currentPlan, currentTask,
  createGoalOpen, createTaskError, createTaskOpen, deletingTask, doneGoals, editingGoal,
  editingGoalSummary, editingGoalTitle, editingTask, editingTaskGoalId, editingTaskSummary,
  editingTaskTitle, failureSummaryForTask, goalHistoryOpen, goalTitleForTask, mergeGoal,
  mergeGoalOptions, mergeTargetGoalId, mergingGoal, modelAvailable, mutationError, newGoalTitle,
  newTaskGoalId, newTaskSummary, newTaskTitle, onApplyPatchDraft, onArchiveGoal, onArchiveTask,
  onConfirmStart, onCreateRepairTask, onCreateTask, onDeleteTask, onEditGoal, onEditTask,
  onExecuteDetail, onGeneratePatchDraft, onMergeGoal, onMergeHandoff, onOpenTask,
  onOpenTaskFromCard, onPrimaryAction, onRepair, onRestoreGoal, onRestoreTask, onRerunFailed,
  onRunChecks, onSubmitGoal, onSubmitTask, openTaskFromCard, permanentlyDeleteTask,
  primaryActionLabel, recentResultTasks, renderPatchDraft, rerunFailedChecks, runnerLoadingId,
  saveGoalEdit, saveTaskEdit, setArchivingGoal, setArchivingTask, setCreateGoalOpen,
  setCreateTaskOpen, setDeletingTask, setEditingGoal, setEditingGoalSummary, setEditingGoalTitle,
  setEditingTask, setEditingTaskGoalId, setEditingTaskSummary, setEditingTaskTitle,
  setGoalHistoryOpen, setMergeTargetGoalId, setNewGoalTitle, setNewTaskGoalId, setNewTaskSummary,
  setNewTaskTitle, setTaskActionDialog, setTaskFilter, setTaskSort, taskActionDialog,
  taskFilter, taskFilterLabel, taskGoalOptions, taskGroups, taskModelPreflight, taskSort,
  taskSortLabel, taskStatusLabel, taskUpdatedLabel,
}) {
  return <>
    <div className="taskBoardToolbar">
      <div className="taskBoardControls">
        <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="outline"><Filter aria-hidden="true" />{taskFilterLabel}</Button></DropdownMenuTrigger><DropdownMenuContent>{taskFilters.map(([value, label]) => <DropdownMenuItem key={value} onSelect={() => setTaskFilter(value)}>{label}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
        <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="outline"><ArrowUpDown aria-hidden="true" />{taskSortLabel}</Button></DropdownMenuTrigger><DropdownMenuContent>{taskSorts.map(([value, label]) => <DropdownMenuItem key={value} onSelect={() => setTaskSort(value)}>{label}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
      </div>
      <div className="taskBoardActions"><Button type="button" variant="outline" onClick={() => setGoalHistoryOpen(true)}>目标历史</Button><Button type="button" variant="primary" disabled={!modelAvailable} title={modelAvailable ? "新建目标" : "请先测试当前模型可用性"} onClick={() => { setNewGoalTitle(""); setCreateGoalOpen(true); }}><Plus />新建目标</Button></div>
    </div>
    <AgentTopicTaskGroups
      currentTaskId={currentTask?.id} mergeGoalOptions={mergeGoalOptions} modelAvailable={modelAvailable}
      onArchiveGoal={onArchiveGoal} onArchiveTask={onArchiveTask} onCreateTask={onCreateTask}
      onDeleteTask={onDeleteTask} onEditGoal={onEditGoal} onEditTask={onEditTask}
      onMergeGoal={onMergeGoal} onPrimaryAction={onPrimaryAction} openTaskFromCard={openTaskFromCard}
      primaryActionLabel={primaryActionLabel} taskGroups={taskGroups} taskStatusLabel={taskStatusLabel}
      taskUpdatedLabel={taskUpdatedLabel}
    />
    <AgentTopicTaskDialogs
      archiveGoal={archiveGoal} archiveTask={archiveTask} archivingGoal={archivingGoal} archivingTask={archivingTask}
      archivedGoals={archivedGoals} archivedTasks={archivedTasks} createGoalOpen={createGoalOpen} createTaskError={createTaskError}
      createTaskOpen={createTaskOpen} deletingTask={deletingTask} doneGoals={doneGoals} editingGoal={editingGoal}
      editingGoalSummary={editingGoalSummary} editingGoalTitle={editingGoalTitle} editingTask={editingTask}
      editingTaskGoalId={editingTaskGoalId} editingTaskSummary={editingTaskSummary} editingTaskTitle={editingTaskTitle}
      goalHistoryOpen={goalHistoryOpen} goalTitleForTask={goalTitleForTask} mergeGoal={mergeGoal}
      mergeGoalOptions={mergeGoalOptions} mergeTargetGoalId={mergeTargetGoalId} mergingGoal={mergingGoal}
      mutationError={mutationError} newGoalTitle={newGoalTitle} newTaskGoalId={newTaskGoalId} newTaskSummary={newTaskSummary}
      newTaskTitle={newTaskTitle} onRestoreGoal={onRestoreGoal} onRestoreTask={onRestoreTask} onSubmitGoal={onSubmitGoal}
      onSubmitTask={onSubmitTask} permanentlyDeleteTask={permanentlyDeleteTask} saveGoalEdit={saveGoalEdit}
      saveTaskEdit={saveTaskEdit} setArchivingGoal={setArchivingGoal} setArchivingTask={setArchivingTask}
      setCreateGoalOpen={setCreateGoalOpen} setCreateTaskOpen={setCreateTaskOpen} setDeletingTask={setDeletingTask}
      setEditingGoal={setEditingGoal} setEditingGoalSummary={setEditingGoalSummary} setEditingGoalTitle={setEditingGoalTitle}
      setEditingTask={setEditingTask} setEditingTaskGoalId={setEditingTaskGoalId} setEditingTaskSummary={setEditingTaskSummary}
      setEditingTaskTitle={setEditingTaskTitle} setGoalHistoryOpen={setGoalHistoryOpen} setMergeTargetGoalId={setMergeTargetGoalId}
      setNewGoalTitle={setNewGoalTitle} setNewTaskGoalId={setNewTaskGoalId} setNewTaskSummary={setNewTaskSummary}
      setNewTaskTitle={setNewTaskTitle} taskGoalOptions={taskGoalOptions}
    />
    <TaskActionDialog action={taskActionDialog} failureSummary={failureSummaryForTask} goalTitle={goalTitleForTask}
      modelAvailable={modelAvailable} modelChecking={taskModelPreflight} mutationError={mutationError}
      onAdjust={onOpenTask} onClose={() => setTaskActionDialog(null)} onConfirmStart={onConfirmStart}
      onExecuteDetail={onExecuteDetail} onOpenTask={onOpenTask} onRepair={onRepair}
      onRerunFailed={onRerunFailed} renderPatchDraft={(draft) => <section className="taskDraftReview" aria-label="待确认的改动草稿"><div className="runnerHeader"><strong>待确认的改动草稿</strong><span>尚未写入文件</span></div><PatchDraft draft={draft} /></section>} runnerLoading={runnerLoadingId} />
  </>;
}
