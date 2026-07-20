import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { markTaskPersisted, recoverDesktopTaskStorage, writeFileAtomicSync } from "../task-storage.js";

test("marks the persisted request trace with storage-owned facts", () => {
  const task = markTaskPersisted({
    id: "task-1",
    requestTrace: { requestId: "request-1", startedAt: "start" },
  }, "persisted", "preview");
  assert.deepEqual(task.requestTrace, {
    outcome: "succeeded",
    persistedAt: "persisted",
    requestId: "request-1",
    runtime: "preview",
    startedAt: "start",
    taskId: "task-1",
  });
});

test("atomically replaces a task file without leaving temp files", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "project-os-task-storage-"));
  try {
    const target = path.join(dir, "task.json");
    writeFileAtomicSync(target, '{"id":"task-1"}\n');
    assert.equal(fs.readFileSync(target, "utf8"), '{"id":"task-1"}\n');
    assert.deepEqual(fs.readdirSync(dir), ["task.json"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("removes stale temps, preserves recent temps, and quarantines corrupt tasks", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "project-os-task-recovery-"));
  const now = Date.now();
  try {
    const stale = path.join(dir, "stale.tmp");
    const recent = path.join(dir, "recent.tmp");
    fs.writeFileSync(stale, "partial");
    fs.writeFileSync(recent, "partial");
    fs.utimesSync(stale, new Date(now - 2 * 60 * 60 * 1000), new Date(now - 2 * 60 * 60 * 1000));
    fs.writeFileSync(path.join(dir, "broken.json"), "{");
    fs.writeFileSync(path.join(dir, "valid.json"), '{"id":"valid"}\n');

    const result = recoverDesktopTaskStorage(dir, now);

    assert.deepEqual(result.removedTemps, ["stale.tmp"]);
    assert.deepEqual(result.quarantined, [`broken.json.${now}.corrupt`]);
    assert.equal(fs.existsSync(stale), false);
    assert.equal(fs.existsSync(recent), true);
    assert.equal(fs.existsSync(path.join(dir, "valid.json")), true);
    assert.equal(fs.existsSync(path.join(dir, "quarantine", `broken.json.${now}.corrupt`)), true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
