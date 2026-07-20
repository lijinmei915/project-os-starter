import assert from "node:assert/strict";
import test from "node:test";

import { createToolGateway, defaultToolRegistry } from "../src/agent-runtime/index.js";

const request = (name, arguments_ = {}) => ({ arguments: arguments_, id: `tool-${name}`, name, requestedAt: "2026-07-18T00:00:00.000Z", runId: "run-1" });

test("registers only the bounded v1 Agent tools", () => {
  assert.deepEqual(defaultToolRegistry.list().map((tool) => tool.id), ["list_files", "read_file", "search_project", "git_status", "generate_patch", "apply_patch", "run_check"]);
});

test("allows project reads while rejecting traversal and unknown tools", () => {
  const gateway = createToolGateway({ accessMode: "browse", projectRoot: "/workspace" });
  assert.equal(gateway.prepare(request("read_file", { path: "src/main.js" })).status, "ready");
  assert.match(gateway.prepare(request("read_file", { path: "../secret" })).reason, /escape/);
  assert.match(gateway.prepare(request("shell", { command: "rm -rf ." })).reason, /未注册/);
});

test("keeps browser preview read-only and controlled execution approval-bound", async () => {
  const browser = createToolGateway({ accessMode: "controlled", projectRoot: "/workspace", surface: "browser" });
  assert.match(browser.prepare(request("apply_patch", { diff: "--- a/file.js\n+++ b/file.js\n@@ -1 +1 @@\n-old\n+new" })).reason, /浏览器预览/);

  let calls = 0;
  const desktop = createToolGateway({
    accessMode: "controlled",
    handlers: { run_check: async () => { calls += 1; return { summary: "检查通过" }; } },
    projectRoot: "/workspace",
  });
  const prepared = desktop.prepare(request("run_check", { checkId: "runtime" }));
  assert.equal(prepared.status, "awaiting-approval");
  await assert.rejects(() => desktop.execute(prepared, { approval: { approved: true } }), /independent approved request/);
  assert.equal(calls, 0);
  const result = await desktop.execute(prepared, { approval: { status: "approved", token: prepared.approval.token, toolCallId: prepared.toolCall.id } });
  assert.equal(result.observation.success, true);
  assert.equal(calls, 1);
});

test("requires controlled access for checks and engineering writes", () => {
  const governed = createToolGateway({ accessMode: "governed", projectRoot: "/workspace" });
  assert.equal(governed.prepare(request("run_check", { checkId: "runtime" })).status, "denied");
  assert.equal(governed.prepare(request("apply_patch", { diff: "--- a/file.js\n+++ b/file.js\n@@ -1 +1 @@\n-old\n+new" })).status, "denied");
});

test("rejects project-root escape attempts embedded in unified diff headers", () => {
  const gateway = createToolGateway({ accessMode: "controlled", projectRoot: "/workspace" });
  const prepared = gateway.prepare(request("apply_patch", { diff: "--- a/file.js\n+++ ../outside.js\n@@ -1 +1 @@\n-old\n+new" }));
  assert.equal(prepared.status, "denied");
  assert.match(prepared.reason, /escape/);
});

test("rejects protected environment files before an approval can be created", () => {
  const gateway = createToolGateway({ accessMode: "controlled", projectRoot: "/workspace" });
  const prepared = gateway.prepare(request("apply_patch", { diff: "--- a/.env\n+++ b/.env\n@@ -1 +1 @@\n-old\n+new" }));
  assert.equal(prepared.status, "denied");
  assert.match(prepared.reason, /protected environment files/);
});

test("preserves a terminal newline when forwarding an approved patch", () => {
  const gateway = createToolGateway({ accessMode: "controlled", projectRoot: "/workspace" });
  const prepared = gateway.prepare(request("apply_patch", { diff: "--- a/file.js\n+++ b/file.js\n@@ -1 +1 @@\n-old\n+new" }));

  assert.equal(prepared.status, "awaiting-approval");
  assert.equal(prepared.toolCall.arguments.diff, "--- a/file.js\n+++ b/file.js\n@@ -1 +1 @@\n-old\n+new\n");
});

test("rejects an incomplete hunk header before creating an approval", () => {
  const gateway = createToolGateway({ accessMode: "controlled", projectRoot: "/workspace" });
  const prepared = gateway.prepare(request("apply_patch", { diff: "--- a/file.js\n+++ b/file.js\n@@\n-old\n+new\n" }));

  assert.equal(prepared.status, "denied");
  assert.match(prepared.reason, /valid unified diff/);
});

test("run_check accepts an allowlist id but never an arbitrary command", () => {
  const gateway = createToolGateway({ accessMode: "controlled", projectRoot: "/workspace" });
  assert.equal(gateway.prepare(request("run_check", { checkId: "runtime" })).status, "awaiting-approval");
  assert.match(gateway.prepare(request("run_check", { checkId: "runtime", command: "npm test" })).reason, /arbitrary commands/);
});
