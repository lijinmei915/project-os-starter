import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("routes CLI and Tauri governance actions through the shared Runtime operation", () => {
  const root = path.resolve(import.meta.dirname, "../..");
  const cli = fs.readFileSync(path.join(root, "cli/src/main.rs"), "utf8");
  const app = fs.readFileSync(path.join(root, "desktop/src-tauri/src/runtime/app.rs"), "utf8");
  const governance = fs.readFileSync(path.join(root, "desktop/src-tauri/src/runtime/governance.rs"), "utf8");

  assert.match(cli, /mod governance/);
  assert.match(cli, /governance::execute/);
  assert.doesNotMatch(cli, /run_legacy_command/);
  assert.match(app, /runtime::governance::execute/);
  assert.match(governance, /"scan"/);
  assert.match(governance, /"recommend"/);
  assert.match(governance, /"report"/);
});
