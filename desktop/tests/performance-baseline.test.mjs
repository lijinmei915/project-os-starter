import assert from "node:assert/strict";
import test from "node:test";

import { createDesktopPerformanceRecorder, desktopPerformanceBudget } from "../src/lib/performance-baseline.js";

test("records bounded, text-free runtime performance samples", () => {
  let now = 10;
  const recorder = createDesktopPerformanceRecorder({ clock: () => now, maxSamples: 2, memory: () => 4096 });
  const finish = recorder.measure("workspace-route", { tabId: "plan" });
  now = 36;
  finish({ tabId: "terminal" });
  recorder.record({ durationMs: 3, name: "conversation-update", payload: { retainedTurnCount: 12 } });
  recorder.record({ durationMs: 4, name: "terminal-output", payload: { textLength: 80 } });
  const samples = recorder.snapshot();
  assert.equal(samples.length, 2);
  assert.deepEqual(samples.map((sample) => sample.name), ["conversation-update", "terminal-output"]);
  assert.equal(samples[0].memoryBytes, 4096);
  assert.equal(samples[1].payload.textLength, 80);
  assert.equal(desktopPerformanceBudget.maxSamples, 60);
});
