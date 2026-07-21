import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildProjectFactStore } from "../src/fact-store.js";
import { compileCurrentProgressSlots } from "../src/current-progress-slot-runtime.js";
import { compileProjectOverviewSlots } from "../src/project-overview-slot-runtime.js";
import { compileRunbookSlots } from "../src/runbook-slot-runtime.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const readContract = (name) => JSON.parse(fs.readFileSync(path.join(repoRoot, "schemas", name), "utf8"));
const overviewContract = readContract("project-overview-contract.v0.1.json");
const progressContract = readContract("project-progress-contract.v0.1.json");
const runbookContract = readContract("project-runbook-contract.v0.1.json");

function runtimeInput(extra = {}) {
  return {
    report: {
      generatedAt: "2026-07-12T00:00:00+08:00",
      project: { name: "OmniDesk", version: "0.1.0", lifecycle: "stabilizing", description: "本地 AI 工程工作台", coreCapabilities: "项目治理", detectedStack: ["React"], dependencies: ["Vite"], directories: ["desktop", "docs"] },
      summary: { currentProgress: { body: "正在收口运行时。", status: "confirmed" }, runbook: { title: "启动方式", body: "使用项目脚本启动。", status: "confirmed" } },
      governanceDomains: [
        { id: "current-progress", fileStatuses: [{ path: "HANDOFF.md", status: "found" }] },
      ],
    },
    snapshot: {
      currentProjectId: "omnidesk",
      projectName: "OmniDesk",
      phase: "stabilizing",
      projectProfile: { overview: "本地 AI 工程工作台", longTermGoal: "持续治理项目" },
      workspaceFacts: { project: {} },
      goals: { activeGoalId: "goal", goals: [{ id: "goal", title: "稳定内核", status: "active" }] },
      runbookCommands: [{ id: "dev", label: "开发启动", command: "npm run dev", kind: "start", source: "package.json" }],
      ...extra,
    },
    tasks: [{ id: "task", title: "完成兼容验收", status: "running" }],
  };
}

test("browser preview and Tauri-equivalent inputs produce the same runtime facts", () => {
  const browserStore = buildProjectFactStore(runtimeInput());
  const tauriStore = buildProjectFactStore(runtimeInput());
  for (const id of ["project.name", "project.phase", "progress.goal", "runbook.commands"]) {
    assert.deepEqual(browserStore.get(id).value, tauriStore.get(id).value);
    assert.equal(browserStore.get(id).status, tauriStore.get(id).status);
  }
});

test("keeps the OmniDesk display name aligned across state, registry, and Preview", () => {
  const state = JSON.parse(fs.readFileSync(path.join(repoRoot, ".omnidesk/data/state.json"), "utf8"));
  const registry = JSON.parse(fs.readFileSync(path.join(repoRoot, ".omnidesk/data/desktop-registry.json"), "utf8"));
  const profile = JSON.parse(fs.readFileSync(path.join(repoRoot, ".omnidesk/data/project-profile.json"), "utf8"));
  const workspaceFacts = JSON.parse(fs.readFileSync(path.join(repoRoot, ".omnidesk/cache/workspace-facts.json"), "utf8"));
  const currentProject = registry.projects.find((project) => path.resolve(project.path) === repoRoot);
  const viteSource = fs.readFileSync(path.join(repoRoot, "desktop/vite.config.js"), "utf8");
  assert.equal(state.name, "OmniDesk");
  assert.equal(currentProject.name, "OmniDesk");
  for (const description of [state.description, profile.fields["identity.summary"].value, workspaceFacts.project.description]) {
    assert.match(description, /^OmniDesk/);
    assert.doesNotMatch(description, /OmniDesk \/ Project OS Desktop/);
  }
  assert.match(viteSource, /projectName: currentProject\.name \|\| state\.name/);
  assert.doesNotMatch(viteSource, /projectName: state\.name \|\| currentProject\.name/);
});

test("one normalized store compiles all migrated surfaces for legacy projects", () => {
  const store = buildProjectFactStore(runtimeInput());
  assert.equal(compileProjectOverviewSlots({ actions: { "refresh-project-facts": () => {}, "open-source": () => {}, "open-architecture": () => {} }, components: { ProjectOverviewHeader: "header", ProjectOverviewSectionSlot: "section" }, contract: overviewContract, store }).length, 4);
  assert.equal(compileCurrentProgressSlots({ components: { CurrentProgressSlot: "progress" }, contract: progressContract, store }).length, 1);
  assert.equal(compileRunbookSlots({ components: { RunbookSlot: "runbook" }, contract: runbookContract, store }).length, 1);
});

test("partial module activation exposes only its matching surface", () => {
  const input = runtimeInput({ projectCapabilities: { workspaceCapabilities: [{ id: "project-overview", status: "enabled", modules: [{ id: "project-runbook", status: "enabled" }] }] } });
  const store = buildProjectFactStore(input);
  const manifest = input.snapshot.projectCapabilities;
  assert.equal(compileProjectOverviewSlots({ actions: {}, capabilityManifest: manifest, components: {}, contract: overviewContract, store }).length, 0);
  assert.equal(compileCurrentProgressSlots({ capabilityManifest: manifest, components: {}, contract: progressContract, store }).length, 0);
  assert.equal(compileRunbookSlots({ capabilityManifest: manifest, components: { RunbookSlot: "runbook" }, contract: runbookContract, store }).length, 1);
});
