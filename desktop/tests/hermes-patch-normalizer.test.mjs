import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

test("desktop patch normalizer repairs a malformed Hermes hunk only within supplied context", () => {
  const desktopRoot = path.resolve(import.meta.dirname, "..");
  const request = {
    diff: "--- README.md\n+++ README.md\n@@ -1,1 +1,1 @@\n-npm run old-check\n+npm test\n",
    contexts: [{ path: "README.md", content: "# Eval Fixture\n\nRun the project checks with:\n\n```sh\nnpm run old-check\n```\n" }],
  };
  const result = spawnSync(
    "cargo",
    ["run", "--quiet", "--manifest-path", "src-tauri/Cargo.toml", "--bin", "omnidesk-patch-normalizer"],
    { cwd: desktopRoot, encoding: "utf8", input: JSON.stringify(request), timeout: 90_000 },
  );
  assert.equal(result.status, 0, result.stderr);
  const response = JSON.parse(result.stdout);
  assert.match(response.normalizedDiff, /@@ -5,3 \+5,3 @@/);
  assert.match(response.normalizedDiff, /\+npm test/);
});
