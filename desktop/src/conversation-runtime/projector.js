export function executionStartedTurn({ id, requestId = "", taskId = "" }) {
  return {
    actions: [{ id: "open-topic", label: "查看执行", target: "execution" }],
    id,
    outcome: "succeeded",
    requestId,
    role: "assistant",
    taskId,
    text: "已开始执行当前任务。你可以继续留在对话中，完成后我会汇总结果。",
  };
}

export function actionCancelledTurn({ id, requestId = "" }) {
  return {
    id,
    outcome: "cancelled",
    requestId,
    role: "assistant",
    text: "已取消这一步，不会创建或执行任务。",
  };
}

export function mergeExecutionEvents(previousEvents = [], nextEvents = []) {
  if (!Array.isArray(nextEvents) || !nextEvents.length) return previousEvents;
  const nextIds = new Set(nextEvents.map((event) => event.id).filter(Boolean));
  const advancesTimeline = nextEvents.some((event) => event.status === "current");
  const merged = previousEvents.map((event) => (
    advancesTimeline && event.status === "current" && !nextIds.has(event.id)
      ? { ...event, status: "done" }
      : event
  ));
  const indexById = new Map(merged.map((event, index) => [event.id, index]));
  nextEvents.forEach((event) => {
    const index = event.id ? indexById.get(event.id) : undefined;
    if (index === undefined) {
      indexById.set(event.id, merged.length);
      merged.push(event);
    } else {
      merged[index] = { ...merged[index], ...event };
    }
  });
  return merged;
}

export function projectExecutionEvent(turns, event) {
  const index = turns.findIndex((turn) => turn.requestId && turn.requestId === event.requestId && turn.role === "assistant");
  const previousTurn = index >= 0 ? turns[index] : null;
  const conversationEvent = executionProjectionToConversationEvent(event, previousTurn?.conversationEvents || []);
  const projected = {
    actions: event.actions || previousTurn?.actions || [],
    conversationEvents: mergeConversationEvents(previousTurn?.conversationEvents || [], conversationEvent),
    durationMs: event.durationMs ?? previousTurn?.durationMs ?? 0,
    events: mergeExecutionEvents(previousTurn?.events || [], event.events),
    outcome: event.outcome || "running",
    pendingAction: event.pendingAction === undefined ? previousTurn?.pendingAction || null : event.pendingAction,
    responseMode: event.responseMode ?? previousTurn?.responseMode ?? "",
    taskId: event.taskId || previousTurn?.taskId || "",
    text: event.text || "正在处理。",
  };
  if (index < 0) return [...turns, { ...projected, id: event.id, requestId: event.requestId, role: "assistant" }];
  return turns.map((turn, turnIndex) => turnIndex === index ? { ...turn, ...projected } : turn);
}
import { executionProjectionToConversationEvent, mergeConversationEvents } from "./event-contract.js";
