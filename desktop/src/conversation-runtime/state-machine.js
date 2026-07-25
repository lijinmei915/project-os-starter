import { derivePendingAction } from "../lib/conversation-record.js";
import { conversationTurnWorkflowState, taskWorkflowState, workflowStates } from "../lib/workflow-state.js";
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
  const latestAssistantTurn = [...turns].reverse().find((turn) => turn.role === "assistant" && turn.outcome);
  if (loading) return { pendingAction, state: conversationStates.thinking };
  if (pendingAction) return { pendingAction, state: conversationStates.awaitingConfirmation };
  const taskState = taskWorkflowState(activeTask);
  const turnState = conversationTurnWorkflowState(latestAssistantTurn, activeTask);
  const taskStateIsAuthoritative = [
    workflowStates.working,
    workflowStates.verifying,
    workflowStates.completed,
    workflowStates.verified,
    workflowStates.failed,
    workflowStates.cancelled,
    workflowStates.interrupted,
  ].includes(taskState);
  const workflowState = taskStateIsAuthoritative || turnState === workflowStates.idle ? taskState : turnState;
  if ([workflowStates.working, workflowStates.verifying].includes(workflowState)) return { pendingAction: null, state: conversationStates.executing };
  if ([workflowStates.planned, workflowStates.waitingApproval, workflowStates.waitingUser].includes(workflowState)) return { pendingAction: null, state: conversationStates.awaitingConfirmation };
  if ([workflowStates.completed, workflowStates.verified].includes(workflowState)) return { pendingAction: null, state: conversationStates.completed };
  if ([workflowStates.failed, workflowStates.interrupted].includes(workflowState)) return { pendingAction: null, state: conversationStates.failed };
  if (workflowState === workflowStates.cancelled) return { pendingAction: null, state: conversationStates.cancelled };
  return { pendingAction: null, state: conversationStates.idle };
}
