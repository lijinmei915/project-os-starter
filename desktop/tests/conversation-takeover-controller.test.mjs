import assert from "node:assert/strict";
import test from "node:test";
import { applyConversationTakeover } from "../src/lib/conversation-takeover-controller.js";

test("cancels the old request and returns a redirected conversation projection", () => {
  const settled = [];
  const cancelled = [];
  const turns = [{ id: "old" }];
  const result = applyConversationTakeover({ cancelRequest: (id) => cancelled.push(id), chatTurns: turns, clearInput: () => {}, onChatTurnsChange: () => {}, onStopPlan: () => {}, projectExecutionEvent: () => { throw new Error("redirect must not add a cancellation message"); }, requestRef: {}, runningRequest: { id: "request-1" }, setChatLoading: () => {}, setPendingTurn: () => {}, settleRequest: (...args) => { settled.push(args); return true; }, takeover: { decision: "redirect" }, userTurn: { id: "user" } });
  assert.equal(result.handled, false);
  assert.deepEqual(settled, [[{}, "request-1", "cancelled"]]);
  assert.deepEqual(cancelled, ["request-1"]);
  assert.equal(result.turns, turns);
});

test("stops a running request and records the cancellation in the same conversation", () => {
  const events = [];
  const state = [];
  const result = applyConversationTakeover({
    chatTurns: [{ id: "old" }],
    clearInput: () => events.push("clear"),
    onChatTurnsChange: (turns) => events.push(["turns", turns]),
    onStopPlan: () => events.push("stop-plan"),
    projectExecutionEvent: (turns, event) => [...turns, event],
    requestRef: { current: "request-1" },
    runningRequest: { id: "request-1" },
    setChatLoading: (value) => state.push(["loading", value]),
    setPendingTurn: (value) => state.push(["pending", value]),
    settleRequest: () => true,
    takeover: { decision: "cancel" },
    userTurn: { id: "stop-turn" },
  });

  assert.equal(result.handled, true);
  assert.equal(result.turns.at(-1).outcome, "cancelled");
  assert.equal(result.turns.at(-1).text, "已按你的要求停止当前处理。");
  assert.deepEqual(state[0], ["loading", false]);
  assert.ok(events.includes("stop-plan"));
  assert.ok(events.includes("clear"));
});

test("keeps the transcript unchanged before the new user turn is appended", () => {
  const turns = [{ id: "old" }];
  const result = applyConversationTakeover({
    chatTurns: turns,
    clearInput: () => {},
    onChatTurnsChange: () => {},
    onStopPlan: () => {},
    projectExecutionEvent: () => { throw new Error("redirect must not add an assistant turn"); },
    requestRef: {},
    runningRequest: { id: "request-1" },
    setChatLoading: () => {},
    setPendingTurn: () => {},
    settleRequest: () => true,
    takeover: { decision: "redirect" },
    userTurn: { id: "new-turn" },
  });

  assert.equal(result.handled, false);
  assert.equal(result.turns, turns);
});
