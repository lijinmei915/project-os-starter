import { derivePendingAction } from "../lib/conversation-record.js";
import { conversationStates } from "./contract.js";

const transitions = Object.freeze({
  [conversationStates.idle]: { submit: conversationStates.thinking },
  [conversationStates.thinking]: {
    cancel: conversationStates.cancelled,
    fail: conversationStates.failed,
    requireConfirmation: conversationStates.awaitingConfirmation,
    succeed: conversationStates.completed,
  },
  [conversationStates.awaitingConfirmation]: {
    cancel: conversationStates.cancelled,
    confirm: conversationStates.executing,
  },
  [conversationStates.executing]: {
    cancel: conversationStates.cancelled,
    fail: conversationStates.failed,
    succeed: conversationStates.completed,
  },
  [conversationStates.failed]: { retry: conversationStates.thinking },
  [conversationStates.cancelled]: { retry: conversationStates.thinking },
  [conversationStates.completed]: { submit: conversationStates.thinking },
});

export function transitionConversationState(state, event) {
  const next = transitions[state]?.[event];
  if (!next) throw new Error(`illegal conversation transition: ${state} -> ${event}`);
  return next;
}

export function conversationRuntimeState({ activeTask, loading = false, turns = [] } = {}) {
  const pendingAction = derivePendingAction(turns);
  const latestAssistantOutcome = [...turns].reverse().find((turn) => turn.role === "assistant" && turn.outcome)?.outcome;
  if (loading) return { pendingAction, state: conversationStates.thinking };
  if (pendingAction) return { pendingAction, state: conversationStates.awaitingConfirmation };
  if (activeTask?.status === "running") return { pendingAction: null, state: conversationStates.executing };
  if (activeTask?.status === "done") return { pendingAction: null, state: conversationStates.completed };
  if (activeTask?.status === "failed") return { pendingAction: null, state: conversationStates.failed };
  if (latestAssistantOutcome === "running") return { pendingAction: null, state: conversationStates.executing };
  if (latestAssistantOutcome === "awaiting-confirmation") return { pendingAction: null, state: conversationStates.awaitingConfirmation };
  if (latestAssistantOutcome === "succeeded") return { pendingAction: null, state: conversationStates.completed };
  if (latestAssistantOutcome === "failed") return { pendingAction: null, state: conversationStates.failed };
  if (latestAssistantOutcome === "cancelled") return { pendingAction: null, state: conversationStates.cancelled };
  return { pendingAction: null, state: conversationStates.idle };
}
