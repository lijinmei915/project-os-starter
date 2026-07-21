import assert from "node:assert/strict";
import test from "node:test";

import { buildProjectFactStore } from "../src/fact-store.js";
import {
  buildProjectOverviewViewModel,
  selectCorePositioning,
  selectEngineeringStructure,
  selectProjectHeader,
  selectProjectRefreshControl,
  selectTechnologyOverview,
} from "../src/project-overview-selectors.js";

function store(overrides = {}) {
  return buildProjectFactStore({
    observedAt: "2026-07-11T23:30:00+08:00",
    snapshot: {
      currentProjectId: "omnidesk",
      projectName: "OmniDesk",
      phase: "stabilizing",
      factFreshness: { status: "fresh", updatedAt: "2026-07-11T23:20:00+08:00" },
      projectProfile: { overview: "本地 AI 工程工作台", longTermGoal: "让项目持续被理解" },
      workspaceFacts: { project: {} },
      ...overrides.snapshot,
    },
    report: {
      project: {
        version: "0.1.0",
        coreCapabilities: "治理与受控执行",
        detectedStack: ["React", "Vite", "Radix UI"],
        dependencies: ["React 19", "Lucide"],
        directories: ["desktop", "docs", "schemas", "scripts", "tests"],
        ...overrides.project,
      },
      generatedAt: "2026-07-11T23:20:00+08:00",
    },
  });
}

test("builds a serializable four-slot project overview view model", () => {
  const viewModel = buildProjectOverviewViewModel(store());
  assert.equal(viewModel.slots.length, 4);
  assert.doesNotThrow(() => JSON.stringify(viewModel));
  assert.deepEqual(viewModel.slots.map((slot) => slot.id), [
    "project-overview.header",
    "project-overview.core-positioning",
    "project-overview.technology",
    "project-overview.engineering-structure",
  ]);
});

test("selects header labels and propagates fact state without runtime dependencies", () => {
  const header = selectProjectHeader(store());
  assert.equal(header.name, "OmniDesk");
  assert.equal(header.version, "0.1.0");
  assert.equal(header.phase.label, "打磨中");
  assert.equal(header.state.freshness, "fresh");
  assert.equal(header.sources.includes(".omnidesk/data/desktop-registry.json"), true);
});

test("prefers the current registry display name over a stale snapshot identity", () => {
  const header = selectProjectHeader(store({
    snapshot: {
      projectName: "project-os-starter",
      projects: [{ id: "omnidesk", isCurrent: true, name: "OmniDesk" }],
    },
  }));
  assert.equal(header.name, "OmniDesk");
  assert.equal(header.sources.includes(".omnidesk/data/desktop-registry.json"), true);
});

test("hides data sections when all dependent facts are missing", () => {
  const emptyStore = buildProjectFactStore({ snapshot: { currentProjectId: "empty" }, report: {} });
  assert.equal(selectCorePositioning(emptyStore).render, false);
  assert.equal(selectTechnologyOverview(emptyStore).render, false);
  assert.equal(selectEngineeringStructure(emptyStore).render, false);
  assert.equal(selectProjectHeader(emptyStore).render, true);
});

test("classifies technology and directories with stable deduplication", () => {
  const factStore = store();
  const technology = selectTechnologyOverview(factStore);
  assert.deepEqual(technology.items.find((item) => item.id === "application").value, ["React 19"]);
  assert.deepEqual(technology.items.find((item) => item.id === "interface").value, ["Radix UI", "Lucide"]);
  assert.deepEqual(technology.items.find((item) => item.id === "tooling").value, ["Vite"]);
  assert.deepEqual(selectEngineeringStructure(factStore).items.map((item) => item.id), ["application", "governance", "quality"]);
});

test("surfaces conflicts for diagnostics while retaining the selected header value", () => {
  const header = selectProjectHeader(store({ project: { name: "Other Name" } }));
  assert.equal(header.name, "OmniDesk");
  assert.equal(header.state.conflicts.includes("project.name"), true);
});

test("shows refresh actions only when facts need attention or recovery", () => {
  assert.equal(selectProjectRefreshControl({ freshness: "fresh" }).mode, "icon");
  assert.deepEqual(selectProjectRefreshControl({ freshness: "stale" }), {
    actionLabel: "立即更新",
    disabled: false,
    mode: "primary",
    statusLabel: "检测到变化",
    tone: "warning",
  });
  assert.equal(selectProjectRefreshControl({ freshness: "stale", refreshing: true }).actionLabel, "更新中");
  assert.equal(selectProjectRefreshControl({ refreshState: "success" }).mode, "none");
  assert.equal(selectProjectRefreshControl({ refreshState: "error" }).actionLabel, "重试");
});
