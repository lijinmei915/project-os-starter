import { conversationEventTypes, createConversationEvent } from "../conversation-runtime/event-contract.js";
import { agentRunWorkflowState, workflowStates } from "../lib/workflow-state.js";
import { toolCallStatuses } from "./contract.js";

function runEventProjection(run) {
  const state = agentRunWorkflowState(run);
  if (state === workflowStates.planned) return [conversationEventTypes.inputAccepted, "input", "pending"];
  if (state === workflowStates.waitingUser) return [conversationEventTypes.inputAccepted, "input", "pending"];
  if (state === workflowStates.waitingApproval) return [conversationEventTypes.approvalRequired, "approval", "pending"];
  if ([workflowStates.working, workflowStates.verifying].includes(state)) return [conversationEventTypes.requestProgress, "execution", "running"];
  if ([workflowStates.completed, workflowStates.verified].includes(state)) return [conversationEventTypes.requestCompleted, "result", "completed"];
  if (state === workflowStates.failed || state === workflowStates.interrupted) return [conversationEventTypes.requestFailed, "result", "failed"];
  if (state === workflowStates.cancelled) return [conversationEventTypes.requestCancelled, "result", "cancelled"];
  return null;
}

function eventIdentity(run, suffix, sequence) {
  return { id: `${run.id}:${suffix}:${sequence}`, requestId: run.requestId, sequence };
}

export function agentRunConversationEvent(run, { detail = "", sequence = 0, text = "" } = {}) {
  const projected = runEventProjection(run);
  if (!projected) throw new Error(`unsupported Agent Run event status: ${run?.status}`);
  return createConversationEvent({
    ...eventIdentity(run, "run", sequence),
    actor: "assistant",
    conversationId: run.conversationId,
    phase: projected[1],
    status: projected[2],
    taskId: run.taskId,
    timestamp: run.updatedAt,
    type: projected[0],
    payload: { data: { executorId: run.executorId, runId: run.id, step: run.step }, detail, outcome: run.status, text },
  });
}

export function toolCallConversationEvent(run, toolCall, { sequence = 0 } = {}) {
  const awaitingApproval = toolCall.status === toolCallStatuses.awaitingApproval;
  return createConversationEvent({
    ...eventIdentity(run, `tool-${toolCall.id}`, sequence),
    actionId: toolCall.id,
    actor: awaitingApproval ? "assistant" : "tool",
    conversationId: run.conversationId,
    phase: awaitingApproval ? "approval" : "execution",
    status: awaitingApproval ? "pending" : "running",
    taskId: run.taskId,
    timestamp: toolCall.requestedAt,
    type: awaitingApproval ? conversationEventTypes.approvalRequired : conversationEventTypes.toolStarted,
    payload: { data: { approvalRequired: toolCall.approvalRequired, name: toolCall.name, risk: toolCall.risk, runId: run.id, toolCallId: toolCall.id } },
  });
}

export function observationConversationEvent(run, observation, { sequence = 0 } = {}) {
  return createConversationEvent({
    ...eventIdentity(run, `observation-${observation.id}`, sequence),
    actionId: observation.toolCallId,
    actor: "tool",
    conversationId: run.conversationId,
    phase: "execution",
    status: observation.success ? "completed" : "failed",
    taskId: run.taskId,
    timestamp: observation.observedAt,
    type: observation.success ? conversationEventTypes.toolCompleted : conversationEventTypes.toolFailed,
    payload: { data: { observationId: observation.id, runId: run.id, success: observation.success, toolCallId: observation.toolCallId }, detail: observation.summary },
  });
}
