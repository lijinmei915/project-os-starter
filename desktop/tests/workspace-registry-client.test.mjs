import assert from "node:assert/strict";
import test from "node:test";
import { addWorkspaceProject, relocateWorkspaceProject, removeWorkspaceProject, renameWorkspaceProject, switchWorkspaceProject, previewWorkspaceProject } from "../src/lib/workspace-registry-client.js";

test("keeps Workspace registry mutations desktop-only in Preview", async () => {
  const snapshot = async () => ({ projectName: "OmniDesk" });
  for (const operation of [
    () => addWorkspaceProject({ accessMode: "browse", path: "/tmp/next", loadWorkspaceSnapshot: snapshot }),
    () => switchWorkspaceProject({ id: "workspace-2", loadWorkspaceSnapshot: snapshot }),
    () => relocateWorkspaceProject({ id: "workspace-2", path: "/tmp/next", loadWorkspaceSnapshot: snapshot }),
    () => renameWorkspaceProject({ id: "workspace-2", name: "Next", loadWorkspaceSnapshot: snapshot }),
    () => removeWorkspaceProject({ id: "workspace-2", loadWorkspaceSnapshot: snapshot }),
  ]) await assert.rejects(operation, /桌面 App/);
});

test("keeps project path scanning available as a Preview read operation", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ project: { name: "Preview" } }) });
  try { assert.deepEqual(await previewWorkspaceProject({ path: "/tmp/preview" }), { project: { name: "Preview" } }); } finally { globalThis.fetch = originalFetch; }
});
