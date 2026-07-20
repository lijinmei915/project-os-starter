import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("keeps the legacy governance bridge outside the Desktop Runtime", () => {
  const root = path.resolve(import.meta.dirname, "../..");
  const cli = fs.readFileSync(path.join(root, "cli/src/main.rs"), "utf8");
  const app = fs.readFileSync(path.join(root, "desktop/src-tauri/src/runtime/app.rs"), "utf8");
  const runtimeModules = fs.readFileSync(path.join(root, "desktop/src-tauri/src/runtime/mod.rs"), "utf8");
  const governance = fs.readFileSync(path.join(root, "desktop/src-tauri/src/runtime/governance.rs"), "utf8");

  assert.match(cli, /mod governance/);
  assert.match(cli, /governance::execute/);
  assert.match(cli, /mod state_namespace/);
  assert.match(cli, /mod runtime/);
  assert.doesNotMatch(cli, /run_legacy_command/);
  assert.doesNotMatch(app, /run_project_os_action|runtime::governance/);
  assert.doesNotMatch(runtimeModules, /pub mod governance/);
  assert.doesNotMatch(app, /scripts\/(check-runtime|check-doc-structure|check-ai-project|recommend-next)\.sh/);
  assert.match(governance, /"scan"/);
  assert.match(governance, /"recommend"/);
  assert.match(governance, /"report"/);
});
