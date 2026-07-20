import assert from "node:assert/strict";
import test from "node:test";

import { reconcileTaskFileNames } from "../src/lib/task-manifest.js";

test("recovers task files missing from the manifest", () => {
  assert.deepEqual(
    reconcileTaskFileNames(["known.json"], ["known.json", "orphan.json"]),
    ["known.json", "orphan.json"]
  );
});

test("ignores manifest metadata and invalid file names", () => {
  assert.deepEqual(
    reconcileTaskFileNames(["manifest.json", "task.json", "task.json"], ["note.txt", "other.json"]),
    ["task.json", "other.json"]
  );
});
