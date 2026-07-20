import assert from "node:assert/strict";
import test from "node:test";
import { runtimeCapabilitySpecs } from "../src/lib/agent-topic-runtime-capability.js";

test("derives execution and memory capability states from injected facts", () => {
  const execution = runtimeCapabilitySpecs("execution-results", { failedTaskCount: 1, snapshot: {} }).execution;
  const memory = runtimeCapabilitySpecs("long-term-memory", { memoryCount: 2, snapshot: {} }).memory;
  assert.equal(execution.status, "需处理");
  assert.equal(memory.status, "已接入");
});
