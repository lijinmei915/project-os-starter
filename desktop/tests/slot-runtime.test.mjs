import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildProjectFactStore, diffProjectFactStores } from "../src/fact-store.js";
import { compileProjectOverviewSlots } from "../src/project-overview-slot-runtime.js";
import { createSlotDependencyIndex, createSlotRuntime } from "../src/slot-runtime.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const contract = JSON.parse(fs.readFileSync(path.join(repoRoot, "schemas/project-overview-contract.v0.1.json"), "utf8"));
const components = { ProjectOverviewHeader: "header-component", ProjectOverviewSectionSlot: "section-component" };
const actions = { "refresh-project-facts": () => {}, "open-architecture": () => {}, "open-source": () => {} };

function populatedStore() {
  return buildProjectFactStore({
    snapshot: {
      currentProjectId: "omnidesk",
      projectName: "OmniDesk",
      phase: "stabilizing",
      projectProfile: { overview: "本地 AI 工程工作台", longTermGoal: "持续理解项目" },
      workspaceFacts: { project: {} },
    },
    report: { project: { version: "0.1.0", coreCapabilities: "治理", detectedStack: ["React"], directories: ["desktop"] } },
  });
}

test("compiles ordered project overview descriptors from the declarative contract", () => {
  const descriptors = compileProjectOverviewSlots({ actions, components, contract, store: populatedStore() });
  assert.deepEqual(descriptors.map((item) => item.id), contract.slots.map((item) => item.id));
  assert.equal(descriptors[0].component, "header-component");
  assert.equal(descriptors[0].actions[0].id, "refresh-project-facts");
  assert.equal(descriptors[2].selectorId, "selectTechnologyOverview");
  assert.equal(Object.isFrozen(descriptors), true);
  assert.equal(Object.isFrozen(descriptors[0]), true);
});

test("applies renderWhen without leaking empty sections to the renderer", () => {
  const emptyStore = buildProjectFactStore({ snapshot: { currentProjectId: "empty" }, report: {} });
  const descriptors = compileProjectOverviewSlots({ actions, components, contract, store: emptyStore });
  assert.deepEqual(descriptors.map((item) => item.id), ["project-overview.header"]);
});

test("rejects unregistered selectors, components, and actions", () => {
  const runtime = createSlotRuntime({ componentRegistry: {}, selectorRegistry: {} });
  assert.throws(() => runtime.compile({ contract, store: populatedStore() }), /unregistered selector/);

  const unknownActionContract = structuredClone(contract);
  unknownActionContract.slots[0].actions = ["unknown-action"];
  assert.throws(() => compileProjectOverviewSlots({ actions, components, contract: unknownActionContract, store: populatedStore() }), /unregistered action/);
});

test("rejects selector output assigned to the wrong slot", () => {
  const runtime = createSlotRuntime({
    componentRegistry: { ProjectOverviewHeader: "header" },
    selectorRegistry: { selectProjectHeader: () => ({ id: "project-overview.wrong", render: true }) },
  });
  assert.throws(() => runtime.compile({ contract: { slots: [contract.slots[0]] }, store: populatedStore() }), /expected project-overview.header/);
});

test("supports enabled slots as an explicit runtime policy", () => {
  const enabledContract = structuredClone(contract);
  enabledContract.slots[1].renderWhen = "enabled";
  const hidden = compileProjectOverviewSlots({ actions, components, contract: enabledContract, store: populatedStore() });
  assert.equal(hidden.some((item) => item.id === "project-overview.core-positioning"), false);
  const runtime = createSlotRuntime({ actionRegistry: actions, componentRegistry: components, selectorRegistry: {
    selectProjectHeader: () => ({ id: "project-overview.header", render: true }),
  } });
  const singleContract = { slots: [{ ...contract.slots[0], renderWhen: "enabled" }] };
  assert.equal(runtime.compile({ contract: singleContract, enabledSlots: ["project-overview.header"], store: populatedStore() }).length, 1);
});

test("indexes fact dependencies to selectors and slots", () => {
  const index = createSlotDependencyIndex(contract, "project-overview");
  assert.deepEqual(index["project.description"].slotIds, ["project-overview.header"]);
  assert.deepEqual(index["technology.stack"].selectorIds, ["selectTechnologyOverview"]);
});

test("recomputes only slots affected by changed facts and preserves other descriptors", () => {
  const runtime = createSlotRuntime({
    actionRegistry: actions,
    componentRegistry: components,
    selectorRegistry: {
      selectProjectHeader: () => ({ id: "project-overview.header", render: true }),
      selectCorePositioning: () => ({ id: "project-overview.core-positioning", render: true }),
      selectTechnologyOverview: () => ({ id: "project-overview.technology", render: true }),
      selectEngineeringStructure: () => ({ id: "project-overview.engineering-structure", render: true }),
    },
  });
  const previous = runtime.compile({ contract, store: populatedStore(), surface: "project-overview" });
  const result = runtime.reconcile({
    changedFactIds: ["technology.stack"],
    contract,
    previousDescriptors: previous,
    sourcePaths: ["package.json"],
    store: populatedStore(),
    surface: "project-overview",
  });
  assert.deepEqual(result.recomputedSlotIds, ["project-overview.technology"]);
  assert.equal(result.descriptors[0], previous[0]);
  assert.notEqual(result.descriptors[2], previous[2]);
  assert.deepEqual(result.events.map((event) => event.type), contract.eventOrder);
  assert.deepEqual(result.events[3].selectorIds, ["selectTechnologyOverview"]);
});

test("keeps descriptors unchanged when updated facts have no slot dependency", () => {
  const runtime = createSlotRuntime({ actionRegistry: actions, componentRegistry: components, selectorRegistry: {
    selectProjectHeader: () => ({ id: "project-overview.header", render: true }),
    selectCorePositioning: () => ({ id: "project-overview.core-positioning", render: true }),
    selectTechnologyOverview: () => ({ id: "project-overview.technology", render: true }),
    selectEngineeringStructure: () => ({ id: "project-overview.engineering-structure", render: true }),
  } });
  const previous = runtime.compile({ contract, store: populatedStore() });
  const result = runtime.reconcile({ changedFactIds: ["task.count"], contract, previousDescriptors: previous, store: populatedStore() });
  assert.equal(result.descriptors, previous);
  assert.deepEqual(result.events[4].slotIds, []);
});

test("detects value, status, and freshness changes between fact stores", () => {
  const previous = populatedStore();
  const next = buildProjectFactStore({
    snapshot: { currentProjectId: "omnidesk", projectName: "OmniDesk", phase: "shipping", factFreshness: { status: "stale" }, workspaceFacts: { project: {} } },
    report: { project: { version: "0.1.0", coreCapabilities: "治理", detectedStack: ["React"], directories: ["desktop"] } },
  });
  const changed = diffProjectFactStores(previous, next);
  assert.equal(changed.includes("project.phase"), true);
  assert.equal(changed.includes("project.name"), true);
});

test("gates slots with the project capability and module policy", () => {
  const disabled = compileProjectOverviewSlots({ actions, components, contract, store: populatedStore(), capabilityManifest: {
    workspaceCapabilities: [{ id: "project-overview", status: "recommended" }],
  } });
  assert.deepEqual(disabled, []);
  const moduleDisabled = compileProjectOverviewSlots({ actions, components, contract, store: populatedStore(), capabilityManifest: {
    workspaceCapabilities: [{ id: "project-overview", status: "enabled", modules: [{ id: "project-runbook", status: "enabled" }] }],
  } });
  assert.deepEqual(moduleDisabled, []);
});
