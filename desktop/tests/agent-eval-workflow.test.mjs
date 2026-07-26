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

test("installs native build dependencies for every slice that compiles the Tauri runtime", () => {
  assert.match(
    workflow,
    /Install Patch Normalizer build dependencies[\s\S]*?if: matrix\.target == 'p1' \|\| matrix\.target == 'p3' \|\| matrix\.target == 'p4' \|\| matrix\.target == 'suite'/,
  );
});

test("checks out the artifact index builder before executing it", () => {
  assert.match(
    workflow,
    /artifact-index:[\s\S]*?steps:\s*\n\s*- uses: actions\/checkout@v4\s*\n\s*- uses: actions\/download-artifact@v4[\s\S]*?build-agent-eval-artifact-index\.mjs/,
  );
});
