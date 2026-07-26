import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const workflow = fs.readFileSync(path.resolve(import.meta.dirname, "../../.github/workflows/agent-eval.yml"), "utf8");
const indexBuilder = fs.readFileSync(path.resolve(import.meta.dirname, "../scripts/build-agent-eval-artifact-index.mjs"), "utf8");

test("keeps protected Agent Eval independently rerunnable with one artifact index", () => {
  for (const target of ["p1", "p3", "p4", "suite"]) {
    assert.match(workflow, new RegExp(`matrix\\.target == '${target}'`));
    assert.match(workflow, new RegExp(`agent-eval-\\$\\{\\{ matrix\\.target \\}\\}`));
  }
  assert.match(workflow, /fail-fast: false/);
  assert.match(workflow, /build-agent-eval-artifact-index\.mjs/);
  assert.match(indexBuilder, /omnidesk\.agent-eval-artifact-index\.v0\.1/);
  assert.match(indexBuilder, /sha256/);
  assert.match(workflow, /needs: real-agent-eval/);
});
