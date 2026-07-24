export const agentRunSchemaVersion = "omnidesk.agent-run.v0.1";

export const agentRunStatuses = Object.freeze({
  queued: "queued",
  running: "running",
  awaitingApproval: "awaiting-approval",
  awaitingUserInput: "awaiting-user-input",
  applying: "applying",
  verifying: "verifying",
  succeeded: "succeeded",
  failed: "failed",
  cancelled: "cancelled",
  interrupted: "interrupted",
});

export const toolCallStatuses = Object.freeze({
  requested: "requested",
  awaitingApproval: "awaiting-approval",
  running: "running",
  completed: "completed",
  failed: "failed",
  cancelled: "cancelled",
});

export const toolRiskLevels = Object.freeze({ read: "read", write: "write", execute: "execute" });

export const agentRunFinalStatuses = Object.freeze([
  agentRunStatuses.succeeded,
  agentRunStatuses.failed,
  agentRunStatuses.cancelled,
]);

const finalStatuses = new Set(agentRunFinalStatuses);

const runTransitions = Object.freeze({
  [agentRunStatuses.queued]: [agentRunStatuses.running, agentRunStatuses.cancelled, agentRunStatuses.interrupted],
  [agentRunStatuses.running]: [agentRunStatuses.awaitingApproval, agentRunStatuses.awaitingUserInput, agentRunStatuses.applying, agentRunStatuses.verifying, agentRunStatuses.succeeded, agentRunStatuses.failed, agentRunStatuses.cancelled, agentRunStatuses.interrupted],
  [agentRunStatuses.awaitingApproval]: [agentRunStatuses.running, agentRunStatuses.applying, agentRunStatuses.failed, agentRunStatuses.cancelled, agentRunStatuses.interrupted],
  [agentRunStatuses.awaitingUserInput]: [agentRunStatuses.queued, agentRunStatuses.failed, agentRunStatuses.cancelled],
  [agentRunStatuses.applying]: [agentRunStatuses.verifying, agentRunStatuses.succeeded, agentRunStatuses.failed, agentRunStatuses.cancelled, agentRunStatuses.interrupted],
  [agentRunStatuses.verifying]: [agentRunStatuses.running, agentRunStatuses.succeeded, agentRunStatuses.failed, agentRunStatuses.cancelled, agentRunStatuses.interrupted],
  [agentRunStatuses.interrupted]: [agentRunStatuses.queued, agentRunStatuses.awaitingApproval, agentRunStatuses.failed, agentRunStatuses.cancelled],
});

const agentRunKeys = new Set(["schemaVersion", "id", "requestId", "conversationId", "taskId", "projectId", "executorId", "status", "step", "maxSteps", "attempt", "revision", "createdAt", "updatedAt", "summary", "prompt", "approval", "approvalToken", "repairAttempt", "evidence", "interactions", "checkpoint"]);

function required(value, name) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`agent runtime requires ${name}`);
  return text;
}

function isoTimestamp(value) {
  const timestamp = value || new Date().toISOString();
  if (Number.isNaN(Date.parse(timestamp))) throw new Error("agent runtime timestamp must be ISO date-time");
  return timestamp;
}

function checkpoint(input = {}, status = agentRunStatuses.queued) {
  const value = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  return Object.freeze({
    phase: String(value.phase || status),
    contextSummary: String(value.contextSummary || ""),
    lastConfirmation: value.lastConfirmation && typeof value.lastConfirmation === "object" && !Array.isArray(value.lastConfirmation) ? value.lastConfirmation : null,
    nextAction: String(value.nextAction || "start"),
    toolName: String(value.toolName || ""),
    toolArguments: value.toolArguments && typeof value.toolArguments === "object" && !Array.isArray(value.toolArguments) ? value.toolArguments : {},
    toolResult: value.toolResult === undefined ? null : value.toolResult,
    interaction: value.interaction && typeof value.interaction === "object" && !Array.isArray(value.interaction) ? value.interaction : null,
    allowedFiles: Array.isArray(value.allowedFiles) ? value.allowedFiles.map(String) : [],
    completedCheckIds: Array.isArray(value.completedCheckIds) ? value.completedCheckIds.map(String) : [],
    remainingRepairBudget: Number.isInteger(value.remainingRepairBudget) && value.remainingRepairBudget >= 0 ? value.remainingRepairBudget : 2,
  });
}

export function createAgentRun(input = {}) {
  const run = {
    schemaVersion: agentRunSchemaVersion,
    id: required(input.id, "id"),
    requestId: required(input.requestId, "requestId"),
    conversationId: String(input.conversationId || ""),
    taskId: String(input.taskId || ""),
    projectId: required(input.projectId, "projectId"),
    executorId: required(input.executorId, "executorId"),
    status: input.status || agentRunStatuses.queued,
    step: Number.isInteger(input.step) && input.step >= 0 ? input.step : 0,
    maxSteps: Number.isInteger(input.maxSteps) && input.maxSteps > 0 ? input.maxSteps : 20,
    attempt: Number.isInteger(input.attempt) && input.attempt >= 0 ? input.attempt : 0,
    revision: Number.isInteger(input.revision) && input.revision >= 0 ? input.revision : 0,
    createdAt: isoTimestamp(input.createdAt),
    updatedAt: isoTimestamp(input.updatedAt || input.createdAt),
    summary: String(input.summary || ""),
    prompt: String(input.prompt || ""),
    approval: input.approval && typeof input.approval === "object" && !Array.isArray(input.approval) ? input.approval : null,
    approvalToken: String(input.approvalToken || ""),
    repairAttempt: Number.isInteger(input.repairAttempt) && input.repairAttempt >= 0 ? input.repairAttempt : 0,
    evidence: Array.isArray(input.evidence) ? input.evidence : [],
    interactions: Array.isArray(input.interactions) ? input.interactions : [],
    checkpoint: checkpoint(input.checkpoint, input.status || agentRunStatuses.queued),
  };
  assertAgentRun(run);
  return Object.freeze(run);
}

export function transitionAgentRun(run, status, timestamp) {
  if (!runTransitions[run?.status]?.includes(status)) throw new Error(`illegal agent run transition: ${run?.status} -> ${status}`);
  if (run.step >= run.maxSteps && !finalStatuses.has(status) && status !== agentRunStatuses.interrupted) throw new Error("agent run step budget exhausted");
  const resumed = run.status === agentRunStatuses.interrupted
    && (status === agentRunStatuses.queued || status === agentRunStatuses.awaitingApproval);
  return Object.freeze({
    ...run,
    attempt: resumed ? run.attempt + 1 : run.attempt,
    revision: run.revision + 1,
    status,
    step: status === agentRunStatuses.interrupted ? run.step : run.step + 1,
    updatedAt: isoTimestamp(timestamp),
  });
}

export function isAgentRunFinal(runOrStatus) {
  return finalStatuses.has(typeof runOrStatus === "string" ? runOrStatus : runOrStatus?.status);
}

export function assertAgentRun(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("agent run must be an object");
  for (const key of Object.keys(value)) if (!agentRunKeys.has(key)) throw new Error(`agent run contains unsupported field: ${key}`);
  if (value.schemaVersion !== agentRunSchemaVersion) throw new Error("unsupported agent run schema version");
  for (const key of ["id", "requestId", "projectId", "executorId"]) required(value[key], key);
  for (const key of ["conversationId", "taskId"]) if (typeof value[key] !== "string") throw new Error(`agent run ${key} must be a string`);
  if (!Object.values(agentRunStatuses).includes(value.status)) throw new Error(`unsupported agent run status: ${value.status}`);
  if (!Number.isInteger(value.step) || value.step < 0) throw new Error("agent run step must be a non-negative integer");
  if (!Number.isInteger(value.maxSteps) || value.maxSteps < 1) throw new Error("agent run maxSteps must be a positive integer");
  if (!Number.isInteger(value.attempt) || value.attempt < 0) throw new Error("agent run attempt must be a non-negative integer");
  if (!Number.isInteger(value.revision) || value.revision < 0) throw new Error("agent run revision must be a non-negative integer");
  if (!Number.isInteger(value.repairAttempt) || value.repairAttempt < 0) throw new Error("agent run repairAttempt must be a non-negative integer");
  isoTimestamp(value.createdAt);
  isoTimestamp(value.updatedAt);
  for (const key of ["summary", "prompt", "approvalToken"]) if (key in value && typeof value[key] !== "string") throw new Error("agent run text metadata must be strings");
  if ("approval" in value && value.approval !== null && (!value.approval || typeof value.approval !== "object" || Array.isArray(value.approval))) throw new Error("agent run approval must be an object or null");
  if (!Array.isArray(value.evidence)) throw new Error("agent run evidence must be an array");
  if (!Array.isArray(value.interactions)) throw new Error("agent run interactions must be an array");
  const currentCheckpoint = value.checkpoint;
  if (!currentCheckpoint || typeof currentCheckpoint !== "object" || Array.isArray(currentCheckpoint)) throw new Error("agent run checkpoint must be an object");
  for (const key of ["phase", "contextSummary", "nextAction", "toolName"]) if (typeof currentCheckpoint[key] !== "string") throw new Error("agent run checkpoint text metadata must be strings");
  for (const key of ["allowedFiles", "completedCheckIds"]) if (!Array.isArray(currentCheckpoint[key]) || currentCheckpoint[key].some((item) => typeof item !== "string")) throw new Error("agent run checkpoint collections must contain strings");
  if (!Number.isInteger(currentCheckpoint.remainingRepairBudget) || currentCheckpoint.remainingRepairBudget < 0) throw new Error("agent run checkpoint repair budget must be a non-negative integer");
  return value;
}

export function createToolCall(input = {}) {
  const risk = input.risk || toolRiskLevels.read;
  if (!Object.values(toolRiskLevels).includes(risk)) throw new Error(`unsupported tool risk: ${risk}`);
  const approvalRequired = input.approvalRequired ?? risk !== toolRiskLevels.read;
  return Object.freeze({
    id: required(input.id, "toolCall.id"),
    runId: required(input.runId, "toolCall.runId"),
    name: required(input.name, "toolCall.name"),
    arguments: input.arguments && typeof input.arguments === "object" && !Array.isArray(input.arguments) ? input.arguments : {},
    risk,
    approvalRequired,
    status: approvalRequired ? toolCallStatuses.awaitingApproval : toolCallStatuses.requested,
    requestedAt: isoTimestamp(input.requestedAt),
  });
}

export function createApprovalRequest(input = {}) {
  const token = String(input.token || (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`));
  return Object.freeze({
    id: required(input.id, "approval.id"),
    runId: required(input.runId, "approval.runId"),
    toolCallId: required(input.toolCallId, "approval.toolCallId"),
    reason: required(input.reason, "approval.reason"),
    status: input.status || "pending",
    token,
    requestedAt: isoTimestamp(input.requestedAt),
  });
}

export function createObservation(input = {}) {
  return Object.freeze({
    id: required(input.id, "observation.id"),
    runId: required(input.runId, "observation.runId"),
    toolCallId: required(input.toolCallId, "observation.toolCallId"),
    success: Boolean(input.success),
    summary: String(input.summary || ""),
    data: input.data === undefined ? null : input.data,
    observedAt: isoTimestamp(input.observedAt),
  });
}

export function createTerminalOutcome(input = {}) {
  if (!finalStatuses.has(input.status)) throw new Error(`unsupported terminal outcome: ${input.status}`);
  return Object.freeze({
    runId: required(input.runId, "outcome.runId"),
    status: input.status,
    summary: required(input.summary, "outcome.summary"),
    completedAt: isoTimestamp(input.completedAt),
  });
}
