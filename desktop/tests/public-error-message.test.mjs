import assert from "node:assert/strict";
import test from "node:test";

import { publicErrorMessage } from "../src/lib/public-error-message.js";

test("turns a missing project path into a bounded actionable message", () => {
  const message = publicErrorMessage("没有找到项目路径：desktop/tests/example.test.js；Hermes: [INFO] acp_adapter.entry: No .env found at /var/folders/private/.env");
  assert.equal(message, "读取的文件路径不存在，Agent 未能自动找到正确文件。可以重试。");
  assert.doesNotMatch(message, /example|Hermes|\[INFO\]|\.env|\/var\/folders/);
});

test("keeps a useful public reason while removing appended executor logs", () => {
  assert.equal(
    publicErrorMessage("Agent 响应中断；Hermes: [INFO] Starting..."),
    "Agent 响应中断",
  );
});

test("replaces a bare internal log with a public fallback", () => {
  assert.equal(
    publicErrorMessage("[INFO] acp_adapter.entry: Starting...", "计划生成未完成，可以重试。"),
    "计划生成未完成，可以重试。",
  );
});
