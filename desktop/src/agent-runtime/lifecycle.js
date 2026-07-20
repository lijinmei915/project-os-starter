import {
  agentRunStatuses,
  assertAgentRun,
  createTerminalOutcome,
  isAgentRunFinal,
  transitionAgentRun,
} from "./contract.js";

const recoverableStatuses = new Set([
  agentRunStatuses.queued,
  agentRunStatuses.running,
  agentRunStatuses.applying,
  agentRunStatuses.verifying,
]);

export function serializeAgentRun(run) {
  assertAgentRun(run);
  return `${JSON.stringify(run, null, 2)}\n`;
}

export function deserializeAgentRun(serialized) {
  let value;
  try {
    value = typeof serialized === "string" ? JSON.parse(serialized) : serialized;
  } catch {
    throw new Error("agent run persistence contains invalid JSON");
  }
  assertAgentRun(value);
  return Object.freeze({ ...value });
}

export function recoverAgentRun(run, timestamp) {
  assertAgentRun(run);
  if (!recoverableStatuses.has(run.status)) return run;
  return transitionAgentRun(run, agentRunStatuses.interrupted, timestamp);
}

export function resumeAgentRun(run, timestamp) {
  assertAgentRun(run);
  if (run.status !== agentRunStatuses.interrupted) throw new Error(`agent run is not resumable from status: ${run.status}`);
  return transitionAgentRun(run, agentRunStatuses.queued, timestamp);
}

export function settleAgentRun(run, { attempt = run?.attempt, status, summary, timestamp } = {}) {
  assertAgentRun(run);
  if (isAgentRunFinal(run)) return Object.freeze({ accepted: false, outcome: null, run, reason: "already-final" });
  if (attempt !== run.attempt) return Object.freeze({ accepted: false, outcome: null, run, reason: "stale-attempt" });
  if (run.status === agentRunStatuses.interrupted) return Object.freeze({ accepted: false, outcome: null, run, reason: "interrupted" });
  const settled = transitionAgentRun(run, status, timestamp);
  return Object.freeze({
    accepted: true,
    outcome: createTerminalOutcome({ completedAt: settled.updatedAt, runId: settled.id, status, summary }),
    run: settled,
    reason: "accepted",
  });
}
