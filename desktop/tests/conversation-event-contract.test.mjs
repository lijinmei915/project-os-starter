import assert from "node:assert/strict";
import test from "node:test";

import {
  conversationEventSchemaVersion,
  conversationEventTypes,
  createConversationEvent,
  executionProjectionToConversationEvent,
  mergeConversationEvents,
  projectExecutionEvent,
} from "../src/conversation-runtime/index.js";
import { buildConversationRecord } from "../src/lib/conversation-record.js";

const baseEvent = {
  actor: "assistant",
  id: "request-1:0",
  phase: "execution",
  requestId: "request-1",
  status: "running",
  timestamp: "2026-07-16T00:00:00.000Z",
  type: conversationEventTypes.requestProgress,
};

test("creates an immutable normalized conversation event", () => {
  const event = createConversationEvent(baseEvent);
  assert.equal(event.schemaVersion, conversationEventSchemaVersion);
  assert.equal(event.sequence, 0);
  assert.deepEqual(event.payload, {});
  assert.equal(Object.isFrozen(event), true);
  assert.throws(() => {
    event.status = "completed";
  }, TypeError);
});

test("rejects invalid conversation event contract values", () => {
  assert.throws(() => createConversationEvent({ ...baseEvent, type: "unknown" }), /unsupported conversation event type/);
  assert.throws(() => createConversationEvent({ ...baseEvent, phase: "unknown" }), /unsupported conversation event phase/);
  assert.throws(() => createConversationEvent({ ...baseEvent, status: "unknown" }), /unsupported conversation event status/);
  assert.throws(() => createConversationEvent({ ...baseEvent, actor: "unknown" }), /unsupported conversation event actor/);
  assert.throws(() => createConversationEvent({ ...baseEvent, requestId: "" }), /requires id and requestId/);
});

test("maps legacy execution outcomes to normalized event semantics", () => {
  const cases = [
    ["running", "request.progress", "execution", "running"],
    ["awaiting-confirmation", "approval.required", "approval", "pending"],
    ["succeeded", "request.completed", "result", "completed"],
    ["failed", "request.failed", "result", "failed"],
    ["timed-out", "request.failed", "result", "failed"],
    ["cancelled", "request.cancelled", "result", "cancelled"],
  ];
  cases.forEach(([outcome, type, phase, status]) => {
    const event = executionProjectionToConversationEvent({ outcome, requestId: `request-${outcome}` });
    assert.deepEqual([event.type, event.phase, event.status], [type, phase, status]);
    assert.equal(event.payload.outcome, outcome);
  });
});

test("increments event sequence and replaces duplicate event ids", () => {
  const first = createConversationEvent(baseEvent);
  const second = executionProjectionToConversationEvent({ requestId: "request-1" }, [first]);
  assert.equal(second.sequence, 1);
  assert.equal(second.id, "request-1:1");

  const replacement = createConversationEvent({ ...baseEvent, status: "completed" });
  const merged = mergeConversationEvents([first], replacement);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].status, "completed");
});

test("projects normalized events while preserving legacy turn fields", () => {
  const turns = projectExecutionEvent([], {
    durationMs: 120,
    events: [{ id: "context", status: "current" }],
    id: "assistant-1",
    outcome: "running",
    requestId: "request-1",
    text: "正在处理",
  });
  assert.equal(turns[0].text, "正在处理");
  assert.equal(turns[0].outcome, "running");
  assert.equal(turns[0].durationMs, 120);
  assert.deepEqual(turns[0].events, [{ id: "context", status: "current" }]);
  assert.equal(turns[0].conversationEvents[0].type, "request.progress");
});

test("persists normalized conversation events in conversation records", () => {
  const event = createConversationEvent(baseEvent);
  const record = buildConversationRecord({
    id: "conversation-1",
    turns: [{ conversationEvents: [event], id: "assistant-1", role: "assistant", text: "正在处理" }],
    updatedAt: "2026-07-16T00:00:00.000Z",
  });
  assert.deepEqual(record.turns[0].conversationEvents, [event]);
});
