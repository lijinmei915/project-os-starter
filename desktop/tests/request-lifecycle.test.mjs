import assert from "node:assert/strict";
import test from "node:test";

import { beginRequest, isRequestRunning, requestOutcome, settleRequest, taskIdForRequest } from "../src/lib/request-lifecycle.js";

test("allows exactly one terminal outcome for a request", () => {
  const ref = { current: null };
  beginRequest(ref, "request-1", 100);
  assert.equal(isRequestRunning(ref, "request-1"), true);
  assert.equal(settleRequest(ref, "request-1", "timed-out"), true);
  assert.equal(settleRequest(ref, "request-1", "succeeded"), false);
  assert.equal(ref.current.status, "timed-out");
});

test("ignores late outcomes from an older request", () => {
  const ref = { current: null };
  beginRequest(ref, "old");
  beginRequest(ref, "new");
  assert.equal(settleRequest(ref, "old", "failed"), false);
  assert.equal(isRequestRunning(ref, "new"), true);
});

test("ignores a late success after cancellation", () => {
  const ref = { current: null };
  beginRequest(ref, "request-1");
  assert.equal(settleRequest(ref, "request-1", "cancelled"), true);
  assert.equal(settleRequest(ref, "request-1", "succeeded"), false);
  assert.equal(ref.current.status, "cancelled");
});

test("lets a new request take over and rejects the old late result", () => {
  const ref = { current: null };
  beginRequest(ref, "old", 100);
  assert.equal(settleRequest(ref, "old", "cancelled"), true);
  beginRequest(ref, "new", 200);
  assert.equal(isRequestRunning(ref, "old"), false);
  assert.equal(isRequestRunning(ref, "new"), true);
  assert.equal(settleRequest(ref, "old", "succeeded"), false);
  assert.equal(settleRequest(ref, "new", "succeeded"), true);
});

test("rejects non-terminal settlement states", () => {
  const ref = { current: null };
  beginRequest(ref, "request-1");
  assert.throws(() => settleRequest(ref, "request-1", "running"), /invalid request terminal status/);
  assert.equal(isRequestRunning(ref, "request-1"), true);
});

test("creates immutable structured outcomes", () => {
  const outcome = requestOutcome("timed-out", "计划生成等待超时", { requestId: "request-1" });
  assert.deepEqual(outcome, { message: "计划生成等待超时", requestId: "request-1", status: "timed-out" });
  assert.equal(Object.isFrozen(outcome), true);
  assert.throws(() => requestOutcome("running"), /invalid request outcome status/);
});

test("derives one stable task id from a request id", () => {
  assert.equal(taskIdForRequest("req:1/a", "fallback"), "request-req-1-a");
  assert.equal(taskIdForRequest("req:1/a", "other"), "request-req-1-a");
  assert.equal(taskIdForRequest("", "fallback"), "fallback");
});
