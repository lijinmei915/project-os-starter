import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("keeps Workspace watcher, explicit refresh, and preview polling in one hook", async () => {
  const source = await readFile(new URL("../src/components/workbench/use-workspace-snapshot-refresh.js", import.meta.url), "utf8");
  assert.match(source, /workspaceRegistryClient\.subscribeWorkspaceFileChanges/);
  assert.match(source, /workspaceRegistryClient\.startWorkspaceFileWatcher/);
  assert.match(source, /project-os:snapshot-refresh-requested/);
  assert.match(source, /30000/);
  assert.equal(source.includes("runtime-api"), false);
});
