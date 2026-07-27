import assert from "node:assert/strict";
import test from "node:test";
import { recommendedActionFromChatResult } from "../src/lib/conversation-recommended-action.js";

test("maps only native structured recommendations to a controlled Agent action", () => {
  assert.deepEqual(recommendedActionFromChatResult({
    recommendedAction: { task: "在会话消息旁加入统一任务状态标签" },
    responseMode: "native-recommendation-call",
  }, "request-1"), {
    id: "recommend-agent-request-1",
    task: "在会话消息旁加入统一任务状态标签",
    type: "start-agent",
  });
  assert.equal(recommendedActionFromChatResult({
    recommendedAction: { task: "自然语言猜测出的动作" },
    responseMode: "native-text",
  }, "request-2"), null);
  assert.equal(recommendedActionFromChatResult({
    responseMode: "native-recommendation-call",
  }, "request-3"), null);
});
