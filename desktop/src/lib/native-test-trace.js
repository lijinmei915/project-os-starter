const traceKey = "omnidesk.native-terminal-trace";
const traceLimit = 30;
const enabled = typeof window !== "undefined"
  && Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__ || window.__TAURI_METADATA__)
  && window.location?.port === "1422";

function readTrace() {
  if (typeof window === "undefined") return [];
  try {
    const trace = JSON.parse(window.localStorage.getItem(traceKey) || "[]");
    return Array.isArray(trace) ? trace : [];
  } catch {
    return [];
  }
}

// This is intentionally test-build-only. Never put terminal data, commands,
// workspace paths, provider configuration, or errors into this trace.
export function traceNativeTerminalStage(stage) {
  if (!enabled || typeof window === "undefined" || typeof stage !== "string") return;
  const entries = readTrace();
  if (entries.some((entry) => entry?.stage === stage)) return;
  const next = [...entries, { at: Date.now(), stage }].slice(-traceLimit);
  try {
    window.localStorage.setItem(traceKey, JSON.stringify(next));
  } catch {
    // Diagnostics must never affect the production terminal lifecycle.
  }
  // The test-only native command mirrors only stage IDs to the isolated
  // fixture, so a crashed WebDriver session still leaves useful evidence.
  void invoke("record_native_terminal_trace", { stage }).catch(() => {});
}

export function readNativeTerminalTrace() {
  return enabled ? readTrace() : [];
}

export function clearNativeTerminalTrace() {
  if (!enabled || typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(traceKey);
  } catch {
    // Best-effort test cleanup only.
  }
}
import { invoke } from "@tauri-apps/api/core";
