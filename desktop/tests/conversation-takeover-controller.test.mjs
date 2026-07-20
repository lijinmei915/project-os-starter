import assert from "node:assert/strict";
import test from "node:test";
import { applyConversationTakeover } from "../src/lib/conversation-takeover-controller.js";

test("cancels the old request and returns a redirected conversation projection", () => {
  const settled = [];
  const result = applyConversationTakeover({ chatTurns: [{ id: "old" }], clearInput: () => {}, onChatTurnsChange: () => {}, onStopPlan: () => {}, projectExecutionEvent: (turns, event) => ({ turns, event }), requestRef: {}, runningRequest: { id: "request-1" }, setChatLoading: () => {}, setPendingTurn: () => {}, settleRequest: (...args) => settled.push(args), takeover: { decision: "redirect" }, userTurn: { id: "user" } });
  assert.equal(result.handled, false);
  assert.deepEqual(settled, [[{}, "request-1", "cancelled"]]);
  assert.equal(result.turns.event.outcome, "cancelled");
});
