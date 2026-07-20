import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  migratedStateRelativePath,
  displayStateRelativePath,
  resolvedStateRelativePath,
} from "../src/lib/state-namespace.js";
import {
  readJsonAt,
  resolvedProjectRelativePath,
} from "../vite.config.js";

test("maps legacy state into the same four partitions as the native runtime", () => {
  assert.equal(migratedStateRelativePath(".project-os/state.json"), ".omnidesk/data/state.json");
  assert.equal(migratedStateRelativePath(".project-os/runs/desktop-tasks/task.json"), ".omnidesk/data/tasks/task.json");
  assert.equal(migratedStateRelativePath(".project-os/runs/desktop-conversations/conv.json"), ".omnidesk/data/conversations/conv.json");
  assert.equal(migratedStateRelativePath(".project-os/runs/agent-runs/run.json"), ".omnidesk/data/agent-runs/run.json");
  assert.equal(migratedStateRelativePath(".project-os/events/event.json"), ".omnidesk/runtime/events/event.json");
  assert.equal(migratedStateRelativePath(".project-os/workspace-facts.json"), ".omnidesk/cache/workspace-facts.json");
  assert.equal(migratedStateRelativePath(".project-os/goal-validation-report.json"), ".omnidesk/evidence/goal-validation-report.json");
  assert.equal(displayStateRelativePath(".project-os/runs/desktop-summary.md"), ".omnidesk/evidence/runs/desktop-summary.md");
});

test("keeps legacy paths until the namespace manifest is active", () => {
  assert.equal(resolvedStateRelativePath(".project-os/goals.json", false), ".project-os/goals.json");
  assert.equal(resolvedStateRelativePath(".project-os/goals.json", true), ".omnidesk/data/goals.json");
  assert.throws(() => migratedStateRelativePath("../outside.json"), /项目根目录/);
});

test("preview reads legacy state while migration is inactive", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "omnidesk-preview-legacy-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, ".project-os"), { recursive: true });
  fs.mkdirSync(path.join(root, ".omnidesk"), { recursive: true });
  fs.writeFileSync(path.join(root, ".project-os/state.json"), JSON.stringify({ source: "legacy" }));
  fs.writeFileSync(path.join(root, ".omnidesk/namespace.json"), JSON.stringify({
    schemaVersion: "omnidesk.state-namespace.v1",
    activeNamespace: "legacy",
    readMode: "legacy-primary",
  }));

  assert.equal(resolvedProjectRelativePath(root, ".project-os/state.json"), ".project-os/state.json");
  assert.deepEqual(readJsonAt(root, ".project-os/state.json", null), { source: "legacy" });
});

test("preview prefers active OmniDesk state without mutating legacy data", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "omnidesk-preview-active-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, ".project-os"), { recursive: true });
  fs.mkdirSync(path.join(root, ".omnidesk/data"), { recursive: true });
  fs.writeFileSync(path.join(root, ".project-os/state.json"), JSON.stringify({ source: "legacy" }));
  fs.writeFileSync(path.join(root, ".omnidesk/data/state.json"), JSON.stringify({ source: "omnidesk" }));
  fs.writeFileSync(path.join(root, ".omnidesk/namespace.json"), JSON.stringify({
    schemaVersion: "omnidesk.state-namespace.v1",
    activeNamespace: "omnidesk",
    readMode: "omnidesk-primary",
  }));

  assert.equal(resolvedProjectRelativePath(root, ".project-os/state.json"), ".omnidesk/data/state.json");
  assert.deepEqual(readJsonAt(root, ".project-os/state.json", null), { source: "omnidesk" });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, ".project-os/state.json"), "utf8")), { source: "legacy" });
});
