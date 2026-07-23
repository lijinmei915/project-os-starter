import assert from "node:assert/strict";
import test from "node:test";
import { clearFactRefreshFailure, factRefreshFailureStorageKey, readFactRefreshFailure, writeFactRefreshFailure } from "../src/lib/workspace-fact-refresh-store.js";

function storage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) || null, removeItem: (key) => values.delete(key), setItem: (key, value) => values.set(key, value) };
}

test("persists bounded refresh failure retry evidence per project", () => {
  const localStorage = storage();
  const options = { now: () => new Date("2026-07-22T08:00:00.000Z"), storage: localStorage };
  writeFactRefreshFailure("project/a", { message: "timeout", signature: "network" }, options);
  writeFactRefreshFailure("project/a", { message: "timeout", signature: "network" }, options);
  assert.equal(factRefreshFailureStorageKey("project/a"), "omnidesk:fact-refresh-failure:project%2Fa");
  assert.deepEqual(readFactRefreshFailure("project/a", localStorage), { attemptedAt: "2026-07-22T08:00:00.000Z", message: "timeout", retryCount: 2, signature: "network" });
  clearFactRefreshFailure("project/a", localStorage);
  assert.equal(readFactRefreshFailure("project/a", localStorage), null);
});
