import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("keeps Workspace goal validation, confirmation, and decomposition behind injected clients", async () => {
  const source = await readFile(new URL("../src/components/workbench/use-workspace-goal-actions.js", import.meta.url), "utf8");
  assert.match(source, /goalClient\.runGoalValidation/);
  assert.match(source, /goalClient\.signOffGoalValidation/);
  assert.match(source, /goalClient\.confirmGoalDecomposition/);
  assert.match(source, /persistTask/);
  assert.match(source, /executionClient\.generateReadonlyPlan/);
  assert.equal(source.includes("runtime-api"), false);
});
