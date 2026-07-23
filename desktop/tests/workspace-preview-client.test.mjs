import assert from "node:assert/strict";
import test from "node:test";

import { loadPreviewWorkspaceSnapshot } from "../src/lib/workspace-preview-client.js";

const response = (payload, ok = true) => ({ ok, json: async () => payload });

test("uses the preview snapshot endpoint without reading fallback state files", async () => {
  const calls = [];
  const snapshot = await loadPreviewWorkspaceSnapshot(async (path) => {
    calls.push(path);
    return response({ projectName: "Demo", phase: "active" });
  });

  assert.deepEqual(calls, ["/__omnidesk/workspace-snapshot"]);
  assert.equal(snapshot.projectName, "Demo");
  assert.equal(snapshot.phase, "active");
  assert.equal(snapshot.goals.schemaVersion, "omnidesk.goals.v0.1");
});

test("projects only native OmniDesk state when the preview endpoint is unavailable", async () => {
  const payloads = new Map([
    ["/.omnidesk/data/task-backlog.json", { items: [{ id: "task-1", title: "治理", status: "" }] }],
    ["/.omnidesk/data/desktop-registry.json", {
      currentProjectId: "demo",
      projects: [{ id: "demo", name: "Demo", path: "/tmp/demo", phase: "active", accessMode: "controlled" }],
    }],
  ]);
  const calls = [];
  const snapshot = await loadPreviewWorkspaceSnapshot(async (path) => {
    calls.push(path);
    if (path === "/__omnidesk/workspace-snapshot") return response({}, false);
    return response(payloads.get(path) || {}, payloads.has(path));
  });

  assert.equal(snapshot.projectName, "Demo");
  assert.equal(snapshot.currentProjectPath, "/tmp/demo");
  assert.equal(snapshot.projects[0].accessMode, "controlled");
  assert.equal(snapshot.queue[0].status, "planned");
  assert.equal(calls.some((path) => path.includes(".project-os")), false);
  assert.equal(calls.every((path) => !path.startsWith("/") || path.startsWith("/.omnidesk/") || path.startsWith("/__omnidesk/")), true);
});
