import assert from "node:assert/strict";
import test from "node:test";
import { agentConfigCapabilitySpec } from "../src/lib/agent-topic-agent-config.js";

test("derives model connection capability from current Provider state", () => {
  assert.equal(agentConfigCapabilitySpec("model-connections", { enabled: true, model: "gpt" }).status, "已接入");
  assert.equal(agentConfigCapabilitySpec("model-connections", { enabled: false }).status, "待配置");
  assert.equal(agentConfigCapabilitySpec("unknown", {}), null);
});
