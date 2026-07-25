export const conversationEventSchemaVersion = "omnidesk.conversation-event.v0.1";

export const conversationEventTypes = Object.freeze({
  inputAccepted: "input.accepted",
  contextLoaded: "context.loaded",
  modelStarted: "model.started",
  modelDelta: "model.delta",
  actionProposed: "action.proposed",
  approvalRequired: "approval.required",
  approvalResolved: "approval.resolved",
  toolStarted: "tool.started",
  toolProgress: "tool.progress",
  toolCompleted: "tool.completed",
  toolFailed: "tool.failed",
  requestProgress: "request.progress",
  requestQueued: "request.queued",
  requestCompleted: "request.completed",
  requestFailed: "request.failed",
  requestCancelled: "request.cancelled",
});

const allowedTypes = new Set(Object.values(conversationEventTypes));
const allowedPhases = new Set(["input", "thinking", "approval", "execution", "result"]);
const allowedStatuses = new Set(["pending", "running", "completed", "failed", "cancelled"]);
const allowedActors = new Set(["user", "assistant", "system", "tool"]);

export function createConversationEvent(input = {}) {
  const event = {
    schemaVersion: conversationEventSchemaVersion,
    id: String(input.id || "").trim(),
    type: input.type,
    phase: input.phase,
    status: input.status,
    actor: input.actor || "assistant",
    conversationId: String(input.conversationId || ""),
    requestId: String(input.requestId || "").trim(),
    taskId: String(input.taskId || ""),
    actionId: String(input.actionId || ""),
    sequence: Number.isInteger(input.sequence) && input.sequence >= 0 ? input.sequence : 0,
    timestamp: input.timestamp || new Date().toISOString(),
    payload: input.payload && typeof input.payload === "object" && !Array.isArray(input.payload) ? input.payload : {},
  };
  if (!event.id || !event.requestId) throw new Error("conversation event requires id and requestId");
  if (!allowedTypes.has(event.type)) throw new Error(`unsupported conversation event type: ${event.type}`);
  if (!allowedPhases.has(event.phase)) throw new Error(`unsupported conversation event phase: ${event.phase}`);
  if (!allowedStatuses.has(event.status)) throw new Error(`unsupported conversation event status: ${event.status}`);
  if (!allowedActors.has(event.actor)) throw new Error(`unsupported conversation event actor: ${event.actor}`);
  if (Number.isNaN(Date.parse(event.timestamp))) throw new Error("conversation event timestamp must be ISO date-time");
  return Object.freeze(event);
}

export function executionProjectionToConversationEvent(projection = {}, previousEvents = []) {
  const outcome = projection.outcome || "running";
  const terminal = {
    succeeded: [conversationEventTypes.requestCompleted, "result", "completed"],
    failed: [conversationEventTypes.requestFailed, "result", "failed"],
    cancelled: [conversationEventTypes.requestCancelled, "result", "cancelled"],
    "timed-out": [conversationEventTypes.requestFailed, "result", "failed"],
    "awaiting-confirmation": [conversationEventTypes.approvalRequired, "approval", "pending"],
  }[outcome] || [conversationEventTypes.requestProgress, "execution", "running"];
  return createConversationEvent({
    actor: "assistant",
    conversationId: projection.conversationId,
    id: projection.eventId || `${projection.requestId}:${previousEvents.length}`,
    phase: terminal[1],
    requestId: projection.requestId,
    sequence: previousEvents.length,
    status: terminal[2],
    taskId: projection.taskId,
    timestamp: projection.timestamp,
    type: terminal[0],
    payload: {
      detail: projection.detail || "",
      outcome,
      text: projection.text || "",
      timeline: Array.isArray(projection.events) ? projection.events : [],
    },
  });
}

export function mergeConversationEvents(previous = [], nextEvent) {
  if (!nextEvent) return previous;
  const duplicate = previous.find((event) => event.id === nextEvent.id);
  return duplicate ? previous.map((event) => event.id === nextEvent.id ? nextEvent : event) : [...previous, nextEvent];
}
