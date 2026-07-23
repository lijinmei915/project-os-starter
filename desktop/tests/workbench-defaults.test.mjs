import assert from "node:assert/strict";
import test from "node:test";

import {
  fallbackModelCatalog,
  fallbackProvider,
  fallbackSnapshot,
  planCards,
  taskStatuses,
} from "../src/lib/workbench-defaults.js";

test("keeps Workbench fallback data on current OmniDesk contracts", () => {
  assert.equal(fallbackSnapshot.goals.schemaVersion, "omnidesk.goals.v0.1");
  assert.equal(fallbackModelCatalog.schemaVersion, "omnidesk.model-catalog.v0.1");
  assert.equal(fallbackProvider.provider, "openai-compatible");
  assert.equal(fallbackProvider.enabled, false);
  assert.equal(taskStatuses.waitingApproval, "waiting approval");
  assert.equal(taskStatuses.repairFailed, "repair failed");
  assert.equal(planCards.length, 3);
  assert.equal(JSON.stringify({ fallbackModelCatalog, fallbackSnapshot }).includes("project-os"), false);
});
