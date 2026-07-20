import { ChevronLeft, ChevronRight, Target } from "lucide-react";
import { Button } from "../ui/button";
import { Tooltip } from "../ui/tooltip";

export function TaskConversationContext({
  goalName,
  onNextTask,
  onPreviousTask,
  position,
  statusLabel,
  task,
}) {
  if (!task) return null;
  const hasNavigation = position.total > 1;
  return (
    <section className="taskConversationContext" aria-label="当前任务对话">
      <Target aria-hidden="true" />
      <div>
        <span className="taskConversationGoal">目标 · {goalName}</span>
        <strong>{task.title || "未命名任务"}</strong>
        <span className="taskConversationStatus">{statusLabel}</span>
      </div>
      <span className="taskConversationPosition">第 {position.current} / {position.total} 项</span>
      {hasNavigation ? (
        <div className="taskConversationNavigation" aria-label="切换同目标任务">
          <Tooltip content="上一个任务">
            <Button aria-label="上一个任务" disabled={!onPreviousTask} size="icon" type="button" variant="ghost" onClick={onPreviousTask}>
              <ChevronLeft aria-hidden="true" />
            </Button>
          </Tooltip>
          <Tooltip content="下一个任务">
            <Button aria-label="下一个任务" disabled={!onNextTask} size="icon" type="button" variant="ghost" onClick={onNextTask}>
              <ChevronRight aria-hidden="true" />
            </Button>
          </Tooltip>
        </div>
      ) : null}
    </section>
  );
}
