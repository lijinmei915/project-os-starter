import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Dialog, DialogClose, DialogContent } from "../ui/dialog";
import { Field } from "../ui/field";
import { Input } from "../ui/input";
import { Notice } from "../ui/notice";
import { Select } from "../ui/select";

export function AgentTopicTaskDialogs({
  archiveGoal, archiveTask, archivingGoal, archivingTask, archivedGoals, archivedTasks,
  createGoalOpen, createTaskError, createTaskOpen, deletingTask, doneGoals, editingGoal,
  editingGoalSummary, editingGoalTitle, editingTask, editingTaskGoalId, editingTaskSummary,
  editingTaskTitle, goalHistoryOpen, goalTitleForTask, mergeGoal, mergeGoalOptions,
  mergeTargetGoalId, mergingGoal, mutationError, newGoalTitle, newTaskGoalId, newTaskSummary,
  newTaskTitle, onRestoreGoal, onRestoreTask, onSubmitGoal, onSubmitTask, permanentlyDeleteTask,
  setArchivingGoal, setArchivingTask, setCreateGoalOpen, setCreateTaskOpen, setDeletingTask,
  setEditingGoal, setEditingGoalSummary, setEditingGoalTitle, setEditingTask, setEditingTaskGoalId,
  setEditingTaskSummary, setEditingTaskTitle, setGoalHistoryOpen, setMergeTargetGoalId, setNewGoalTitle,
  setNewTaskGoalId, setNewTaskSummary, setNewTaskTitle,
  taskGoalOptions, saveGoalEdit, saveTaskEdit,
}) {
  return <>
    <Dialog open={createTaskOpen} onOpenChange={setCreateTaskOpen}>
      <DialogContent title="新建任务" description="任务会保存到当前项目，并关联到所选目标。不会改动工程文件。">
        <form className="taskCreateForm" onSubmit={onSubmitTask}>
          <Field label="关联目标">{({ id: fieldId }) => <Select id={fieldId} value={newTaskGoalId} onChange={(event) => setNewTaskGoalId(event.target.value)}><option value="">暂不关联目标</option>{taskGoalOptions.map((goal) => <option key={goal.id} value={goal.id}>{goal.shortTitle || goal.title}</option>)}</Select>}</Field>
          <Field label="任务名称" error={createTaskError}>{({ id: fieldId }) => <Input autoFocus id={fieldId} value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} placeholder="例如：补齐登录页验收标准" />}</Field>
          <Field label="任务说明" hint="可选，用于帮助后续对话或执行时理解范围。">{({ id: fieldId }) => <Input id={fieldId} value={newTaskSummary} onChange={(event) => setNewTaskSummary(event.target.value)} placeholder="写清楚预期结果或限制" />}</Field>
          <div className="taskCreateActions"><DialogClose asChild><Button type="button" variant="subtle">取消</Button></DialogClose><Button type="submit" variant="primary">创建任务</Button></div>
        </form>
      </DialogContent>
    </Dialog>
    <Dialog open={createGoalOpen} onOpenChange={setCreateGoalOpen}>
      <DialogContent title="新建目标" description="目标会保存到当前项目；后续任务将在该目标下推进。">
        <form className="taskCreateForm" onSubmit={onSubmitGoal}><Field label="目标名称">{({ id: fieldId }) => <Input autoFocus id={fieldId} value={newGoalTitle} onChange={(event) => setNewGoalTitle(event.target.value)} placeholder="例如：完成桌面端首轮交付" />}</Field><div className="taskCreateActions"><DialogClose asChild><Button type="button" variant="subtle">取消</Button></DialogClose><Button type="submit" variant="primary">创建目标</Button></div></form>
      </DialogContent>
    </Dialog>
    <Dialog open={goalHistoryOpen} onOpenChange={setGoalHistoryOpen}>
      <DialogContent title="目标历史" description={`已完成 ${doneGoals.length} 个，已归档 ${archivedGoals.length} 个目标、${archivedTasks.length} 个任务。`}>
        <div className="goalHistoryList">
          {doneGoals.map((goal) => <article key={goal.id}><div><strong>{goal.title || "未命名目标"}</strong><p>{goal.summary || "未记录目标说明。"}</p></div><Badge status="已确认">已完成</Badge></article>)}
          {archivedGoals.map((goal) => <article key={goal.id}><div><strong>{goal.title || "未命名目标"}</strong><p>{goal.summary || "未记录目标说明。"}</p></div><Button size="sm" type="button" variant="outline" onClick={() => onRestoreGoal(goal)}>恢复目标</Button></article>)}
          {archivedTasks.map((task) => <article key={task.id}><div><strong>{task.title || "未命名任务"}</strong><p>原目标：{goalTitleForTask(task)}</p></div><Button size="sm" type="button" variant="outline" onClick={() => onRestoreTask(task)}>恢复任务</Button></article>)}
          {!doneGoals.length && !archivedGoals.length && !archivedTasks.length ? <Notice variant="info">暂无目标或任务历史。</Notice> : null}
        </div>
        {mutationError ? <Notice variant="danger">{mutationError}</Notice> : null}
        <div className="taskCreateActions"><DialogClose asChild><Button type="button" variant="subtle">关闭</Button></DialogClose></div>
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(editingTask)} onOpenChange={(open) => { if (!open) setEditingTask(null); }}><DialogContent title="编辑任务" description="修改任务内容或迁移到其他目标。"><form className="taskCreateForm" onSubmit={saveTaskEdit}><Field label="任务名称">{({ id: fieldId }) => <Input id={fieldId} value={editingTaskTitle} onChange={(event) => setEditingTaskTitle(event.target.value)} />}</Field><Field label="任务说明">{({ id: fieldId }) => <Input id={fieldId} value={editingTaskSummary} onChange={(event) => setEditingTaskSummary(event.target.value)} />}</Field><Field label="关联目标">{({ id: fieldId }) => <Select id={fieldId} value={editingTaskGoalId} onChange={(event) => setEditingTaskGoalId(event.target.value)}><option value="">未关联目标</option>{taskGoalOptions.map((goal) => <option key={goal.id} value={goal.id}>{goal.shortTitle || goal.title}</option>)}</Select>}</Field>{mutationError ? <Notice variant="danger">{mutationError}</Notice> : null}<div className="taskCreateActions"><DialogClose asChild><Button type="button" variant="outline">取消</Button></DialogClose><Button type="submit" variant="primary">保存修改</Button></div></form></DialogContent></Dialog>
    <Dialog open={Boolean(archivingTask)} onOpenChange={(open) => { if (!open) setArchivingTask(null); }}><DialogContent title="归档任务" description={`归档后“${archivingTask?.title || "该任务"}”会从看板隐藏，但本地记录仍可恢复。`}><div className="taskCreateActions"><DialogClose asChild><Button type="button" variant="outline">取消</Button></DialogClose><Button type="button" variant="secondary" onClick={() => archiveTask(archivingTask)}>确认归档</Button></div></DialogContent></Dialog>
    <Dialog open={Boolean(deletingTask)} onOpenChange={(open) => { if (!open) setDeletingTask(null); }}><DialogContent title="永久删除任务" description={`“${deletingTask?.title || "该任务"}”的任务记录、专属对话和目标关联将被永久删除，且无法恢复。`}><div className="taskCreateActions"><DialogClose asChild><Button type="button" variant="outline">取消</Button></DialogClose><Button type="button" variant="danger" onClick={permanentlyDeleteTask}>永久删除</Button></div></DialogContent></Dialog>
    <Dialog open={Boolean(editingGoal)} onOpenChange={(open) => { if (!open) setEditingGoal(null); }}><DialogContent title="编辑目标" description="修改目标名称和范围说明，关联任务不会丢失。"><form className="taskCreateForm" onSubmit={saveGoalEdit}><Field label="目标名称">{({ id: fieldId }) => <Input id={fieldId} value={editingGoalTitle} onChange={(event) => setEditingGoalTitle(event.target.value)} />}</Field><Field label="范围说明">{({ id: fieldId }) => <Input id={fieldId} value={editingGoalSummary} onChange={(event) => setEditingGoalSummary(event.target.value)} />}</Field>{mutationError ? <Notice variant="danger">{mutationError}</Notice> : null}<div className="taskCreateActions"><DialogClose asChild><Button type="button" variant="outline">取消</Button></DialogClose><Button type="submit" variant="primary">保存修改</Button></div></form></DialogContent></Dialog>
    <Dialog open={Boolean(archivingGoal)} onOpenChange={(open) => { if (!open) setArchivingGoal(null); }}><DialogContent title="归档目标" description={`归档后“${archivingGoal?.title || "该目标"}”会从当前看板隐藏，历史记录仍保留。`}>{mutationError ? <Notice variant="danger">{mutationError}</Notice> : null}<div className="taskCreateActions"><DialogClose asChild><Button type="button" variant="outline">取消</Button></DialogClose><Button type="button" variant="secondary" onClick={archiveGoal}>确认归档</Button></div></DialogContent></Dialog>
    <Dialog open={Boolean(mergingGoal)} onOpenChange={(open) => { if (!open) setMergingGoal(null); }}><DialogContent title="合并目标" description={`“${mergingGoal?.title || "该目标"}”下的 ${mergingGoal?.taskIds?.length || 0} 个关联任务会迁移到接收目标，原目标保留为合并记录。`}><Field label="接收目标">{({ id: fieldId }) => <Select id={fieldId} value={mergeTargetGoalId} onChange={(event) => setMergeTargetGoalId(event.target.value)}><option value="">请选择接收目标</option>{mergeGoalOptions.filter((goal) => goal.id !== mergingGoal?.id).map((goal) => <option key={goal.id} value={goal.id}>{goal.shortTitle || goal.title}</option>)}</Select>}</Field>{mutationError ? <Notice variant="danger">{mutationError}</Notice> : null}<div className="taskCreateActions"><DialogClose asChild><Button type="button" variant="outline">取消</Button></DialogClose><Button type="button" variant="primary" disabled={!mergeTargetGoalId} onClick={mergeGoal}>确认合并</Button></div></DialogContent></Dialog>
  </>;
}
