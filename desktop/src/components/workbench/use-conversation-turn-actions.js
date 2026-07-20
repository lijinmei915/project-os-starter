import { useCallback } from "react";
import { executionReadyAgentEvents, projectExecutionEvent } from "../../conversation-runtime";
import { resolvedStageGoalTurn } from "../../lib/stage-goal-turn";

export function useConversationTurnActions({
  activeProjectGoalTitle,
  chatTurns,
  executePendingPatchApply,
  focusComposer,
  navigateWorkbench,
  onChatTurnsChange,
  onRunChatAction,
  setTaskInput,
}) {
  return useCallback(async (action, turn, { projectExecution = false } = {}) => {
    if (!turn) return false;
    if (action.id === "supplement-stage-goal") {
      setTaskInput(`补充阶段目标「${action.title}」的范围：`);
      requestAnimationFrame(focusComposer);
      return true;
    }
    if (action.id === "open-stage-goal-decomposition") {
      await navigateWorkbench(action.target || "current-goal");
      return true;
    }
    if (action.id === "apply-patch" && turn.pendingAction) {
      return executePendingPatchApply({ action, baseTurns: chatTurns, pendingAction: turn.pendingAction });
    }
    const completed = await onRunChatAction?.(action);
    if (!completed || !turn.pendingAction) return Boolean(completed);
    const nextTurns = chatTurns.map((item) => item.id === turn.id
      ? (action.id === "create-stage-goal"
        ? resolvedStageGoalTurn(item, action, activeProjectGoalTitle)
        : { ...item, actions: [], pendingAction: null, resolvedActionId: turn.pendingAction.id })
      : item);
    if (action.id === "create-stage-goal" || !projectExecution) {
      onChatTurnsChange(nextTurns);
      return true;
    }
    const projectedTurns = projectExecutionEvent(nextTurns, {
      events: executionReadyAgentEvents(),
      outcome: "awaiting-confirmation",
      requestId: turn.requestId,
      text: "计划已确认。下一步生成可审阅的文件改动，不会直接写入。",
    });
    onChatTurnsChange(projectedTurns.map((item) => item.requestId === turn.requestId && item.role === "assistant"
      ? { ...item, actions: [{ id: "generate-patch", label: "生成文件改动", taskId: action.taskId }] }
      : item));
    return true;
  }, [activeProjectGoalTitle, chatTurns, executePendingPatchApply, focusComposer, navigateWorkbench, onChatTurnsChange, onRunChatAction, setTaskInput]);
}
