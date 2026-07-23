import assert from "node:assert/strict";
import test from "node:test";
import { agentConfigCapabilitySpec } from "../src/lib/agent-topic-agent-config.js";

test("derives model connection capability from current Provider state", () => {
  assert.equal(agentConfigCapabilitySpec("model-connections", { enabled: true, model: "gpt" }).status, "已接入");
  assert.equal(agentConfigCapabilitySpec("model-connections", { enabled: false }).status, "待配置");
  assert.equal(agentConfigCapabilitySpec("unknown", {}), null);
});

test("describes only the Runtime controlled-tool boundary", () => {
  const spec = agentConfigCapabilitySpec("tool-allowlist", {});
  assert.equal(spec.status, "规则已接入");
  assert.match(spec.value, /固定的 Runtime 检查/);
  assert.deepEqual(spec.files, [
    "desktop/src-tauri/src/runtime/execution.rs",
    "desktop/src-tauri/src/runtime/patch.rs",
    "desktop/src-tauri/src/runtime/agent_runs.rs",
  ]);
});
