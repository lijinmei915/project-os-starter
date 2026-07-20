import assert from "node:assert/strict";
import test from "node:test";
import { flowCapabilitySpec } from "../src/lib/agent-topic-flow-capability.js";

test("maps flow topics without inventing unknown stages", () => {
  assert.equal(flowCapabilitySpec("validation-report", { maturity: "可验证" }).tone, "success");
  assert.equal(flowCapabilitySpec("unknown", {}), null);
});
