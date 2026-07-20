import { retainConversationTurns } from "./conversation-retention.js";

function conversationTurns(conversation) {
  return retainConversationTurns(conversation?.turns, { previousSummary: conversation?.summary }).turns;
}

export function newConversationState(now = Date.now()) {
  return {
    activeConversationId: `conv-${now}`,
    activeConversationTaskId: "",
    activeTaskId: "",
    conversationSummary: null,
    readonlyPlan: null,
    turns: [],
  };
}

export function openTaskConversationState({ conversations = [], task, now = Date.now() }) {
  if (!task?.id) return null;
  const conversation = conversations.find((item) => item?.taskId === task.id || item?.id === task.conversationId);
  return {
    activeConversationId: conversation?.id || `task-${task.id}-${now}`,
    activeConversationTaskId: task.id,
    activeTaskId: task.id,
    conversationSummary: conversation?.summary || null,
    readonlyPlan: task.plan || null,
    turns: conversationTurns(conversation),
  };
}

export function selectConversationState({ conversations = [], id, tasks = [] }) {
  const conversation = conversations.find((item) => item?.id === id);
  if (!conversation) return null;
  const task = tasks.find((item) => item?.id === conversation.taskId || item?.conversationId === conversation.id);
  return {
    activeConversationId: conversation.id,
    activeConversationTaskId: task?.id || "",
    activeTaskId: task?.id || "",
    conversationSummary: conversation.summary || null,
    readonlyPlan: task?.plan || null,
    turns: conversationTurns(conversation),
  };
}

export function deleteConversationState({ activeConversationId, conversations = [], id, tasks = [], now = Date.now() }) {
  const nextConversations = conversations.filter((item) => item?.id !== id);
  if (activeConversationId !== id) return { conversations: nextConversations, next: null };
  const selected = selectConversationState({ conversations: nextConversations, id: nextConversations[0]?.id, tasks });
  return {
    conversations: nextConversations,
    next: selected || newConversationState(now),
  };
}
