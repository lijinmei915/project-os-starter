import assert from "node:assert/strict";
import test from "node:test";
import { modelHealthUpdate } from "../src/lib/conversation-result-decision.js";

test("keeps provider failure categories visible in the conversation health projection", () => {
  assert.deepEqual(
    modelHealthUpdate({ providerError: "额度不足", providerModel: "gpt-test", providerStatus: "quota-exhausted" }, "fallback"),
    { message: "额度不足", model: "gpt-test", status: "quota-exhausted" },
  );
  assert.deepEqual(
    modelHealthUpdate({ providerError: "认证失败", providerModel: "gpt-test", providerStatus: "authentication-failed" }, "fallback"),
    { message: "认证失败", model: "gpt-test", status: "authentication-failed" },
  );
  assert.equal(modelHealthUpdate({ providerError: "本轮超时", providerStatus: "timed-out" }, "gpt-test"), null);
  assert.equal(modelHealthUpdate({ providerError: "流中断", providerStatus: "interrupted" }, "gpt-test"), null);
});
