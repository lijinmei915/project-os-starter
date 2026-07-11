import assert from "node:assert/strict";
import test from "node:test";
import { buildChatRequestContext, contextualizeUserMessage, isDialogueActionRequest } from "../src/lib/conversation-record.js";

test("keeps context and expected actions across the risk-to-fix dialogue", () => {
  const turns = [];

  turns.push({ id: "u1", role: "user", text: "这个项目当前有什么风险？" });
  let request = buildChatRequestContext(turns);
  assert.equal(request.contextState.currentTopic, "这个项目当前有什么风险？");
  assert.equal(request.contextState.expectedNextAction, "answer-question");

  turns.push({ id: "a1", role: "assistant", text: "当前风险是多轮状态没有进入模型请求。" });
  turns.push({ id: "u2", role: "user", text: "那怎么办？" });
  request = buildChatRequestContext(turns);
  assert.equal(request.contextState.currentTopic, "这个项目当前有什么风险？");
  assert.equal(request.contextState.previousConclusion, "当前风险是多轮状态没有进入模型请求。");
  assert.equal(request.contextState.expectedNextAction, "recommend-next");

  turns.push({ id: "a2", role: "assistant", text: "先接通上下文，再组装项目证据。" });
  turns.push({ id: "u3", role: "user", text: "你自己判断" });
  request = buildChatRequestContext(turns);
  assert.equal(request.contextState.expectedNextAction, "decide-next");
  assert.equal(request.contextState.userDelegation, "你自己判断");

  turns.push({ id: "a3", role: "assistant", text: "我判断先修上下文链路。" });
  turns.push({ id: "u4", role: "user", text: "直接修" });
  request = buildChatRequestContext(turns);
  assert.equal(request.contextState.expectedNextAction, "apply-fix");
  assert.equal(request.contextState.currentTopic, "这个项目当前有什么风险？");
  assert.equal(isDialogueActionRequest("直接修"), true);
  assert.equal(
    contextualizeUserMessage("直接修", request.contextState),
    "当前话题：这个项目当前有什么风险？\n上一结论：我判断先修上下文链路。\n用户当前要求：直接修"
  );
});
