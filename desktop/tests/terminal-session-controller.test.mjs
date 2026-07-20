import assert from "node:assert/strict";
import test from "node:test";
import { appendTerminalCommandLog, clearTerminalSessionRefs, closeTerminalSessionState, nextTerminalSessionId } from "../src/lib/terminal-session-controller.js";

test("allocates a stable unused terminal session id", () => {
  assert.equal(nextTerminalSessionId([{ sessionId: "main" }, { sessionId: "term-2" }, { sessionId: "term-3" }]), "term-4");
});

test("removes a terminal session and selects an adjacent fallback", () => {
  const result = closeTerminalSessionState({ activeSessionId: "term-2", chunksBySession: { "term-2": [1] }, sessionId: "term-2", sessions: [{ sessionId: "main" }, { sessionId: "term-2" }, { sessionId: "term-3" }], textBySession: { "term-2": "old" } });
  assert.equal(result.activeSessionId, "main");
  assert.deepEqual(result.sessions.map((item) => item.sessionId), ["main", "term-3"]);
  assert.deepEqual(result.textBySession, {});
});

test("keeps terminal command output bounded and clears all session refs", () => {
  const result = appendTerminalCommandLog({ activeSessionId: "main", logs: [], now: { id: 1, timestamp: "12:00" }, output: "ok", result: { id: "check", success: true }, textBySession: {} });
  assert.equal(result.logs[0].command, "check");
  assert.match(result.textBySession.main, /\$ check/);
  const first = { current: { main: 1 } };
  const second = { current: { main: 2 } };
  clearTerminalSessionRefs({ first, second }, "main");
  assert.deepEqual(first.current, {});
  assert.deepEqual(second.current, {});
});
