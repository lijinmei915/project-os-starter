import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("keeps retired governance tooling out of the Desktop Runtime", () => {
  const root = path.resolve(import.meta.dirname, "../..");
  const app = fs.readFileSync(path.join(root, "desktop/src-tauri/src/runtime/app.rs"), "utf8");
  const runtimeModules = fs.readFileSync(path.join(root, "desktop/src-tauri/src/runtime/mod.rs"), "utf8");

  assert.equal(fs.existsSync(path.join(root, "cli/Cargo.toml")), false);
  assert.equal(fs.existsSync(path.join(root, "desktop/src-tauri/src/runtime/governance.rs")), false);
  assert.doesNotMatch(app, /run_project_os_action|runtime::governance/);
  assert.doesNotMatch(runtimeModules, /pub mod governance/);
  assert.doesNotMatch(app, /scripts\/(check-runtime|check-doc-structure|check-ai-project|recommend-next)\.sh/);
});
