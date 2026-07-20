import { toolCallStatuses } from "./contract.js";

export const hermesLoopStatuses = Object.freeze({
  completed: "completed",
  failed: "failed",
  awaitingApproval: "awaiting-approval",
  budgetExceeded: "budget-exceeded",
});

function parseEnvelope(text) {
  const source = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const value = JSON.parse(source);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Hermes envelope must be an object");
    return value;
  } catch {
    throw new Error("Hermes must return a JSON tool_call or final envelope");
  }
}

function toolRequest(envelope, runId, step) {
  if (envelope.type !== "tool_call") return null;
  const name = String(envelope.name || "").trim();
  if (!name) throw new Error("Hermes tool_call requires a name");
  return { arguments: envelope.arguments || {}, id: `${runId}:tool:${step}`, name, runId };
}

export async function runHermesToolLoop({ gateway, maxSteps = 20, runId, transport } = {}) {
  if (!gateway || typeof gateway.prepare !== "function" || typeof gateway.execute !== "function") throw new Error("Hermes loop requires a Tool Gateway");
  if (!transport || typeof transport.prompt !== "function") throw new Error("Hermes loop requires a prompt transport");
  const observations = [];
  const events = [];
  for (let step = 0; step < maxSteps; step += 1) {
    const response = await transport.prompt({ observations, step });
    let envelope;
    try { envelope = parseEnvelope(response?.text); } catch (error) {
      return Object.freeze({ events, observations, status: hermesLoopStatuses.failed, summary: error.message, step });
    }
    if (envelope.type === "final") return Object.freeze({ events, observations, result: envelope.result ?? envelope, status: hermesLoopStatuses.completed, step: step + 1 });
    let request;
    try { request = toolRequest(envelope, runId, step); } catch (error) {
      return Object.freeze({ events, observations, status: hermesLoopStatuses.failed, summary: error.message, step });
    }
    if (!request) return Object.freeze({ events, observations, status: hermesLoopStatuses.failed, summary: "Hermes 返回了未知 envelope 类型", step });
    const prepared = gateway.prepare(request);
    events.push({ step, tool: request.name, status: prepared.status });
    if (prepared.status === "denied") return Object.freeze({ events, observations, status: hermesLoopStatuses.failed, summary: prepared.reason, step });
    if (prepared.status === "awaiting-approval") return Object.freeze({ approval: prepared.approval, events, observations, status: hermesLoopStatuses.awaitingApproval, step });
    const result = await gateway.execute(prepared);
    const observation = result.observation;
    observations.push({ data: result.data ?? null, summary: observation.summary, success: observation.success, toolCallId: observation.toolCallId });
    if (result.toolCall.status !== toolCallStatuses.completed && !observation.success) {
      return Object.freeze({ events, observations, status: hermesLoopStatuses.failed, summary: observation.summary, step: step + 1 });
    }
  }
  return Object.freeze({ events, observations, status: hermesLoopStatuses.budgetExceeded, summary: `Hermes 工具步数超过上限（${maxSteps}）`, step: maxSteps });
}
