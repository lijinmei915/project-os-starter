import { conversationEventTypes, createConversationEvent } from "../conversation-runtime/event-contract.js";
import { agentRunStatuses, toolCallStatuses } from "./contract.js";

const runEventProjection = Object.freeze({
  [agentRunStatuses.queued]: [conversationEventTypes.inputAccepted, "input", "pending"],
  [agentRunStatuses.running]: [conversationEventTypes.requestProgress, "execution", "running"],
  [agentRunStatuses.awaitingApproval]: [conversationEventTypes.approvalRequired, "approval", "pending"],
  [agentRunStatuses.awaitingUserInput]: [conversationEventTypes.inputAccepted, "input", "pending"],
  [agentRunStatuses.applying]: [conversationEventTypes.requestProgress, "execution", "running"],
  [agentRunStatuses.verifying]: [conversationEventTypes.requestProgress, "execution", "running"],
  [agentRunStatuses.succeeded]: [conversationEventTypes.requestCompleted, "result", "completed"],
  [agentRunStatuses.failed]: [conversationEventTypes.requestFailed, "result", "failed"],
  [agentRunStatuses.cancelled]: [conversationEventTypes.requestCancelled, "result", "cancelled"],
  [agentRunStatuses.interrupted]: [conversationEventTypes.requestFailed, "result", "failed"],
});

function eventIdentity(run, suffix, sequence) {
  return { id: `${run.id}:${suffix}:${sequence}`, requestId: run.requestId, sequence };
}

export function agentRunConversationEvent(run, { detail = "", sequence = 0, text = "" } = {}) {
  const projected = runEventProjection[run?.status];
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
