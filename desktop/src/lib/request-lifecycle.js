const terminalStatuses = new Set(["succeeded", "failed", "timed-out", "cancelled"]);

export function beginRequest(ref, id, startedAt = Date.now()) {
  ref.current = { id, startedAt, status: "running" };
  return ref.current;
}

export function isRequestRunning(ref, id) {
  return ref.current?.id === id && ref.current?.status === "running";
}

export function settleRequest(ref, id, status) {
  if (!terminalStatuses.has(status)) throw new Error(`invalid request terminal status: ${status}`);
  if (!isRequestRunning(ref, id)) return false;
  ref.current = { ...ref.current, finishedAt: Date.now(), status };
  return true;
}

export function requestOutcome(status, message = "", metadata = {}) {
  if (![...terminalStatuses].includes(status)) {
    throw new Error(`invalid request outcome status: ${status}`);
  }
  return Object.freeze({ ...metadata, message, status });
}

export function taskIdForRequest(requestId, fallbackId) {
  const normalized = String(requestId || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-");
  return normalized ? `request-${normalized}` : fallbackId;
}
