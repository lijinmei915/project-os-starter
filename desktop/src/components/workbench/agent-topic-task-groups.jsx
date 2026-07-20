import { MoreVertical, Plus } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Notice } from "../ui/notice";
import { Tooltip } from "../ui/tooltip";

export function AgentTopicTaskGroups({ currentTaskId, mergeGoalOptions, modelAvailable, onArchiveGoal, onArchiveTask, onCreateTask, onDeleteTask, onEditGoal, onEditTask, onMergeGoal, onPrimaryAction, openTaskFromCard, primaryActionLabel, taskGroups, taskStatusLabel, taskUpdatedLabel }) {
  return (
    <div className="taskGoalGroups">
      {taskGroups.length ? taskGroups.map((group) => (
        <section className="taskGoalGroup" key={group.id}>
          <header>
            <div className="taskGoalIdentity"><Badge variant="neutral" className="taskGoalPill">目标</Badge><strong>{group.label}</strong></div>
            <Tooltip content={modelAvailable ? "新建任务" : "请先测试当前模型可用性"}><button className="sectionIconAction taskGoalCreateTask" type="button" disabled={!modelAvailable} onClick={() => onCreateTask(group.id)} aria-label="新建任务"><Plus strokeWidth={1.75} aria-hidden="true" /></button></Tooltip>
            <em className="taskGoalCount">{group.tasks.length}</em>
            <DropdownMenu><DropdownMenuTrigger asChild><button className="sectionIconAction" type="button" aria-label="目标更多操作"><MoreVertical aria-hidden="true" /></button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onSelect={() => onEditGoal(group)}>编辑目标</DropdownMenuItem><DropdownMenuItem disabled={!mergeGoalOptions.some((item) => item.id !== group.id)} onSelect={() => onMergeGoal(group)}>合并到其他目标</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem disabled={group.tasks.length > 0} onSelect={() => onArchiveGoal(group)}>归档目标{group.tasks.length > 0 ? "（需先迁移任务）" : ""}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
          </header>
          <div className="taskGoalTaskList">
            {group.tasks.map((task) => (
              <article className={`agentTaskQueueItem agentTaskListButton status-${task.status || "unknown"}${task.id === currentTaskId ? " active" : ""}`} key={task.id} onClick={(event) => openTaskFromCard(event, task.id)}>
                <div className="agentTaskQueueMain">
                  <div className="taskCardStatusLine"><Badge status={taskStatusLabel(task.status)}>{taskStatusLabel(task.status)}</Badge><time>{taskUpdatedLabel(task)}</time><DropdownMenu><DropdownMenuTrigger asChild><button className="sectionIconAction" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} aria-label="任务更多操作"><MoreVertical aria-hidden="true" /></button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onSelect={(event) => { event.stopPropagation(); onEditTask(task); }}>编辑任务</DropdownMenuItem><DropdownMenuItem onSelect={(event) => { event.stopPropagation(); onArchiveTask(task); }}>归档任务</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem className="dangerMenuItem" onSelect={(event) => { event.stopPropagation(); onDeleteTask(task); }}>删除任务</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
                  <strong>{task.title || "未命名任务"}</strong><p>{task.plan?.summary || task.description || task.projectName || "暂无任务摘要。"}</p>
                </div>
                <div className="taskCardActions"><Button size="sm" type="button" variant="secondary" onClick={(event) => { event.stopPropagation(); onPrimaryAction(task); }}>{primaryActionLabel(task)}</Button></div>
              </article>
            ))}
          </div>
        </section>
      )) : <Notice variant="info">没有符合当前筛选条件的任务。</Notice>}
    </div>
  );
}
