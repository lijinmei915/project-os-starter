export const desktopPerformanceBudget = Object.freeze({
  maxSamples: 60,
  routeCommitMs: 250,
  workbenchReadyMs: 3000,
});

function browserClock() {
  return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
}

function browserMemory() {
  const memory = typeof performance !== "undefined" ? performance.memory : null;
  return Number.isFinite(memory?.usedJSHeapSize) ? Math.round(memory.usedJSHeapSize) : null;
}

export function createDesktopPerformanceRecorder({ clock = browserClock, memory = browserMemory, maxSamples = desktopPerformanceBudget.maxSamples } = {}) {
  const samples = [];
  const limit = Math.max(1, Number(maxSamples) || desktopPerformanceBudget.maxSamples);
  const record = ({ durationMs = 0, name, payload = {} }) => {
    const sample = Object.freeze({
      durationMs: Math.max(0, Math.round(Number(durationMs) || 0)),
      memoryBytes: memory(),
      name: String(name || "unknown"),
      payload: { ...payload },
      timestamp: Math.round(clock()),
    });
    samples.push(sample);
    if (samples.length > limit) samples.splice(0, samples.length - limit);
    return sample;
  };
  return {
    clear: () => { samples.splice(0, samples.length); },
    measure: (name, payload = {}) => {
      const startedAt = clock();
      return (nextPayload = {}) => record({ durationMs: clock() - startedAt, name, payload: { ...payload, ...nextPayload } });
    },
    record,
    snapshot: () => samples.map((sample) => ({ ...sample, payload: { ...sample.payload } })),
  };
}

export const desktopPerformanceRecorder = createDesktopPerformanceRecorder();

export function measureDesktopPerformance(name, payload) {
  return desktopPerformanceRecorder.measure(name, payload);
}

export function recordWorkbenchReady() {
  const navigation = typeof performance !== "undefined" && typeof performance.getEntriesByType === "function"
    ? performance.getEntriesByType("navigation")[0]
    : null;
  return desktopPerformanceRecorder.record({
    durationMs: navigation?.duration || browserClock(),
    name: "workbench-ready",
    payload: { source: navigation ? "navigation" : "runtime" },
  });
}

export function exposeDesktopPerformanceBaseline() {
  if (typeof window === "undefined") return;
  window.__omniDeskPerformance = Object.freeze({
    clear: desktopPerformanceRecorder.clear,
    snapshot: desktopPerformanceRecorder.snapshot,
  });
}
