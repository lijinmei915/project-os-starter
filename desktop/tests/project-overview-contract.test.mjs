import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { validateProjectOverviewContract } from "../src/project-overview-contract.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const contract = JSON.parse(fs.readFileSync(path.join(repoRoot, "schemas/project-overview-contract.v0.1.json"), "utf8"));
const progressContract = JSON.parse(fs.readFileSync(path.join(repoRoot, "schemas/project-progress-contract.v0.1.json"), "utf8"));
const runbookContract = JSON.parse(fs.readFileSync(path.join(repoRoot, "schemas/project-runbook-contract.v0.1.json"), "utf8"));

test("accepts the project overview contract", () => {
  assert.deepEqual(validateProjectOverviewContract(contract), []);
});

test("accepts progress and runbook slot contracts", () => {
  assert.deepEqual(validateProjectOverviewContract(progressContract), []);
  assert.deepEqual(validateProjectOverviewContract(runbookContract), []);
});

test("rejects duplicate slots and unregistered runtime references", () => {
  const invalid = structuredClone(contract);
  invalid.slots.push({ ...invalid.slots[0], selector: "unknownSelector", component: "UnknownComponent" });
  const errors = validateProjectOverviewContract(invalid);
  assert.ok(errors.includes("duplicate slot id: project-overview.header"));
  assert.ok(errors.includes("unknown selector: unknownSelector"));
  assert.ok(errors.includes("unknown component: UnknownComponent"));
});

test("rejects unknown fact dependencies and invalid event order", () => {
  const invalid = structuredClone(contract);
  invalid.slots[0].dependencies.push("project.unknown");
  invalid.eventOrder = [...invalid.eventOrder].reverse();
  const errors = validateProjectOverviewContract(invalid);
  assert.ok(errors.includes("unknown fact dependency: project.unknown"));
  assert.ok(errors.includes("invalid fact event order"));
});
