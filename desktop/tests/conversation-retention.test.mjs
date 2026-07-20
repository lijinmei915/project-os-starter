import assert from "node:assert/strict";
import test from "node:test";

import { conversationRetention, retainConversationTurns } from "../src/lib/conversation-retention.js";

test("retains a bounded recent conversation window and summarizes evicted turns", () => {
  const turns = Array.from({ length: conversationRetention.recentTurnLimit + 2 }, (_, index) => ({
    id: `turn-${index}`,
    role: index % 2 ? "assistant" : "user",
    text: index === 0 ? "建立性能与内存基线" : `消息 ${index}`,
  }));
  const result = retainConversationTurns(turns);
  assert.equal(result.evictedTurnCount, 2);
  assert.equal(result.turns.length, conversationRetention.recentTurnLimit);
  assert.equal(result.turns[0].id, "turn-2");
  assert.equal(result.summary.currentTopic, "建立性能与内存基线");
  assert.equal(result.summary.coveredTurnCount, 2);
});

test("keeps the prior summary when a restored conversation is already within the window", () => {
  const result = retainConversationTurns([{ id: "turn-1", role: "user", text: "继续" }], {
    previousSummary: { currentTopic: "性能基线", version: "project-os.turn-summary.v0.1" },
  });
  assert.equal(result.evictedTurnCount, 0);
  assert.equal(result.summary.currentTopic, "性能基线");
});
