import { TerminalSquare } from "lucide-react";
import { taskProgressSummary } from "../../lib/task-presentation";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Panel } from "../ui/panel";
import { Tooltip } from "../ui/tooltip";

export function TaskRailDetail({ task, onMarkTaskWaiting, onSendTaskToChat, onSendTaskToTerminal }) {
  const summary = taskProgressSummary(task);
  return <div className="taskRailDetail" aria-label={`${task.title} 执行详情`}>
    <span className="taskRailGoal">{task.goalTitle ? `属于：${task.goalTitle}` : "未归属目标"}</span>
    {task.plan?.summary ? <p>{task.plan.summary}</p> : null}
    {summary.steps.length ? <ol>{summary.steps.slice(0, 3).map((step, index) => <li key={`${task.id}-rail-step-${index}`}>{step}</li>)}</ol> : null}
    <div className="taskRailMeta"><span>{summary.stepCount ? `${summary.stepCount} 个步骤` : "尚未拆解步骤"}</span>{summary.passedChecks ? <span>{summary.passedChecks} 项检查通过</span> : null}</div>
    <div className="taskRailActions">
      {task.status === "planned" ? <Button size="sm" variant="primary" type="button" onClick={() => onMarkTaskWaiting?.(task.id)}>开始执行</Button> : null}
      <Button size="sm" variant="ghost" type="button" onClick={() => onSendTaskToChat?.(task)}>在对话中继续</Button>
      <Tooltip content="发送到终端"><Button size="icon" variant="ghost" type="button" aria-label="发送到终端" onClick={() => onSendTaskToTerminal?.(task)}><TerminalSquare strokeWidth={1.8} aria-hidden="true" /></Button></Tooltip>
    </div>
  </div>;
}

export function TaskQueueItem({ active, onMarkTaskWaiting, onSelectTask, statusLabel, task }) {
  return <Panel as="article" className={`queueCard taskQueueItem${active ? " active" : ""}`} padding="none">
    <button aria-label={`打开对话：${task.title}`} className="taskQueueButton" type="button" onClick={() => onSelectTask(task.id)}>
      <div className="queueHead"><strong>{task.title}</strong><Badge status={statusLabel(task)}>{statusLabel(task)}</Badge></div>
      <p>{task.projectName} · {task.createdAt}</p>
    </button>
    <div className="taskActions"><Button size="sm" variant="primary" type="button" onClick={() => onMarkTaskWaiting(task.id)} disabled={task.status !== "planned"}>开始执行</Button></div>
  </Panel>;
}
