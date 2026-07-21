import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  displayStateRelativePath,
  resolvedStateRelativePath,
} from "../src/lib/state-namespace.js";
import {
  readJsonAt,
  resolvedProjectRelativePath,
} from "../vite.config.js";

test("accepts native partition paths without a legacy translation layer", () => {
  assert.equal(resolvedStateRelativePath(".omnidesk/data/state.json"), ".omnidesk/data/state.json");
  assert.equal(displayStateRelativePath(".omnidesk/data/tasks/task.json"), ".omnidesk/data/tasks/task.json");
  assert.throws(() => resolvedStateRelativePath("../outside.json"), /项目根目录/);
});

test("preview reads only native state partitions", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "omnidesk-preview-native-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, ".omnidesk/data"), { recursive: true });
  fs.writeFileSync(path.join(root, ".omnidesk/data/state.json"), JSON.stringify({ source: "omnidesk" }));
  fs.writeFileSync(path.join(root, ".omnidesk/namespace.json"), JSON.stringify({
    schemaVersion: "omnidesk.state-namespace.v1",
    activeNamespace: "omnidesk",
    readMode: "omnidesk-primary",
  }));

  assert.equal(resolvedProjectRelativePath(root, ".omnidesk/data/state.json"), ".omnidesk/data/state.json");
  assert.deepEqual(readJsonAt(root, ".omnidesk/data/state.json", null), { source: "omnidesk" });
});
