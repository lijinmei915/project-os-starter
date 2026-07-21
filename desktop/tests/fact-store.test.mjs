import assert from "node:assert/strict";
import test from "node:test";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildProjectFactStore, compareProjectOverviewFacts } from "../src/fact-store.js";
import { collectProjectFactCandidates, projectFactSourceAdapters } from "../src/fact-source-adapters.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const snapshot = {
  currentProjectId: "omnidesk",
  projectName: "OmniDesk",
  phase: "stabilizing",
  factFreshness: { status: "fresh", updatedAt: "2026-07-11T23:10:04+08:00" },
  projectProfile: {
    overview: "本地 AI 工程工作台",
    longTermGoal: "让项目持续被理解和治理",
  },
  workspaceFacts: { project: {} },
};

const report = {
  generatedAt: "2026-07-11T23:10:04+08:00",
  project: {
    name: "OmniDesk Report",
    version: "0.1.0",
    lifecycle: "stabilizing",
    description: "报告描述",
    coreCapabilities: "项目治理与受控执行",
    detectedStack: ["Tauri", "React"],
    dependencies: ["React 19"],
    directories: ["desktop", "docs"],
  },
};

test("normalizes project overview facts with source evidence", () => {
  const store = buildProjectFactStore({ snapshot, report, observedAt: "2026-07-11T23:11:00+08:00" });
  assert.equal(store.facts.length, 20);
  assert.equal(store.get("project.name").value, "OmniDesk");
  assert.equal(store.get("project.name").selectedSource, ".omnidesk/data/desktop-registry.json");
  assert.equal(store.get("project.version").value, "0.1.0");
  assert.equal(store.get("technology.stack").freshness, "fresh");
});

test("uses declared fallback sources without changing source priority", () => {
  const store = buildProjectFactStore({ snapshot: { ...snapshot, projectProfile: {} }, report });
  const description = store.get("project.description");
  assert.equal(description.value, "报告描述");
  assert.equal(description.selectedSource, ".omnidesk/data/state.json");
  assert.equal(description.sources[0].role, "primary");
  assert.equal(description.sources[1].role, "fallback");
});

test("keeps missing facts explicit and serializes without runtime methods", () => {
  const store = buildProjectFactStore({ snapshot: { currentProjectId: "empty" }, report: {} });
  const version = store.get("project.version");
  assert.equal(version.status, "missing");
  assert.equal(version.value, null);
  assert.equal(version.selectedSource, null);
  const serialized = store.toJSON();
  assert.equal(serialized.projectId, "empty");
  assert.equal(typeof serialized.get, "undefined");
});

test("returns immutable fact records", () => {
  const store = buildProjectFactStore({ snapshot, report });
  assert.equal(Object.isFrozen(store), true);
  assert.equal(Object.isFrozen(store.facts), true);
  assert.equal(Object.isFrozen(store.get("project.phase")), true);
});

test("keeps source adapters explicit and independently composable", () => {
  assert.deepEqual(projectFactSourceAdapters.map((adapter) => adapter.id), [
    "registry", "profile", "state", "package-cargo", "workspace-facts", "runbook-commands", "progress-runtime", "scanner", "freshness",
  ]);
  const candidates = collectProjectFactCandidates({ snapshot, report }, [projectFactSourceAdapters[0]]);
  assert.equal(candidates.get("project.name")[0].value, "OmniDesk");
  assert.equal(candidates.has("project.version"), false);
});

test("marks incompatible confirmed evidence as conflict while retaining the selected value", () => {
  const store = buildProjectFactStore({ snapshot, report });
  const name = store.get("project.name");
  assert.equal(name.status, "conflict");
  assert.equal(name.value, "OmniDesk");
  assert.equal(name.selectedSource, ".omnidesk/data/desktop-registry.json");
  assert.equal(name.sources.some((source) => source.value === "OmniDesk Report"), true);
});

test("reports dual-run mismatches without affecting fact selection", () => {
  const store = buildProjectFactStore({ snapshot, report });
  assert.deepEqual(compareProjectOverviewFacts(store, {
    "project.name": "Legacy Name",
    "project.version": "0.1.0",
  }), [{ id: "project.name", legacyValue: "Legacy Name", factStoreValue: "OmniDesk" }]);
});

test("serializes a document that satisfies the fact store schema contract", () => {
  const storeSchema = JSON.parse(fs.readFileSync(path.join(repoRoot, "schemas/project-fact-store.schema.json"), "utf8"));
  const factSchema = JSON.parse(fs.readFileSync(path.join(repoRoot, "schemas/project-fact.schema.json"), "utf8"));
  const document = buildProjectFactStore({ snapshot, report }).toJSON();
  assert.equal(document.schemaVersion, storeSchema.properties.schemaVersion.const);
  assert.deepEqual(Object.keys(document).sort(), storeSchema.required.sort());
  for (const fact of document.facts) {
    assert.deepEqual(Object.keys(fact).sort(), [...factSchema.required, "confidence"].sort());
    assert.equal(factSchema.properties.status.enum.includes(fact.status), true);
    assert.equal(factSchema.properties.freshness.enum.includes(fact.freshness), true);
    assert.match(fact.id, new RegExp(factSchema.properties.id.pattern));
    for (const source of fact.sources) {
      assert.equal(factSchema.$defs.source.properties.role.enum.includes(source.role), true);
      assert.equal(factSchema.$defs.source.properties.status.enum.includes(source.status), true);
    }
  }
});
