import assert from "node:assert/strict";
import test from "node:test";
import { createWorkspaceRegistryActions } from "../src/lib/workspace-registry-actions.js";

function setup({ projects = [{ id: "one", isCurrent: true, name: "One" }], registryClient = {} } = {}) {
  const applied = [];
  const resets = [];
  const errors = [];
  const toasts = [];
  const loading = [];
  return {
    applied,
    errors,
    loading,
    resets,
    toasts,
    actions: createWorkspaceRegistryActions({
      applySnapshot: (snapshot) => applied.push(snapshot),
      fallbackSnapshot: { projectName: "fallback" },
      loadWorkspaceSnapshot: async () => ({}),
      pickProjectDirectory: async () => "/tmp/new-project",
      registryClient,
      resetWorkspaceEphemeralState: (snapshot) => resets.push(snapshot),
      setLoading: (value) => loading.push(value),
      setProjectActionError: (value) => errors.push(value),
      showToast: (value) => toasts.push(value),
      snapshot: { projects },
    }),
  };
}

test("applies and resets state after a successful registry project switch", async () => {
  const nextSnapshot = { projectName: "Two", projects: [] };
  const { actions, applied, resets, toasts } = setup({
    projects: [{ id: "one", isCurrent: true, name: "One" }, { id: "two", name: "Two" }],
    registryClient: { switchWorkspaceProject: async () => nextSnapshot },
  });
  await actions.switchProject("two");
  assert.deepEqual(applied, [nextSnapshot]);
  assert.deepEqual(resets, [{ projectName: "Two", projects: [] }]);
  assert.deepEqual(toasts, ["已切换到 Two"]);
});

test("keeps the final project and reports the action boundary", async () => {
  const { actions, errors } = setup();
  await actions.removeProject("one");
  assert.equal(errors.at(-1), "至少保留一个工作台项目；可以先添加新项目，再移除这个项目。");
});

test("does not apply a snapshot after a failed registry mutation", async () => {
  const { actions, applied, errors } = setup({
    registryClient: { addWorkspaceProject: async () => { throw new Error("目录不可用"); } },
  });
  assert.equal(await actions.addProject("/missing"), false);
  assert.deepEqual(applied, []);
  assert.equal(errors.at(-1), "目录不可用");
});

test("selects a directory for scanning without registering it", async () => {
  let registrations = 0;
  const { actions, applied, loading } = setup({
    registryClient: { addWorkspaceProject: async () => { registrations += 1; return { projectName: "Unexpected" }; } },
  });
  const path = await actions.pickProject({ scanOnly: true });
  assert.equal(path, "/tmp/new-project");
  assert.equal(registrations, 0);
  assert.deepEqual(applied, []);
  assert.deepEqual(loading, []);
});

test("reports an existing project as opened instead of added", async () => {
  const { actions, toasts } = setup({
    projects: [{ id: "one", isCurrent: true, name: "Existing", path: "/tmp/new-project" }],
    registryClient: { addWorkspaceProject: async () => ({ currentProjectId: "one", projectName: "Existing", projects: [{ id: "one", isCurrent: true, name: "Existing" }] }) },
  });
  assert.equal(await actions.addProject("/tmp/new-project"), true);
  assert.deepEqual(toasts, ["已打开 Existing"]);
});

test("reports an existing canonical project as opened when the selected path differs", async () => {
  const { actions, toasts } = setup({
    projects: [{ id: "canonical-id", isCurrent: true, name: "Existing", path: "/tmp/real-project" }],
    registryClient: { addWorkspaceProject: async () => ({ currentProjectId: "canonical-id", projectName: "Existing", projects: [{ id: "canonical-id", isCurrent: true, name: "Existing", path: "/tmp/real-project" }] }) },
  });
  assert.equal(await actions.addProject("/tmp/project-link"), true);
  assert.deepEqual(toasts, ["已打开 Existing"]);
});

test("does not report a selected project path when registration fails", async () => {
  const { actions, applied, errors } = setup({
    registryClient: { addWorkspaceProject: async () => { throw new Error("没有写入权限"); } },
  });
  assert.equal(await actions.pickProject({ accessMode: "browse", path: "/tmp/new-project" }), null);
  assert.deepEqual(applied, []);
  assert.equal(errors.at(-1), "没有写入权限");
});

test("never registers a project without an explicit scan or access mode", async () => {
  let registrations = 0;
  const { actions, errors } = setup({
    registryClient: { addWorkspaceProject: async () => { registrations += 1; return {}; } },
  });
  assert.equal(await actions.pickProject({ path: "/tmp/new-project" }), null);
  assert.equal(registrations, 0);
  assert.equal(errors.at(-1), "添加项目必须先完成扫描并明确选择接入权限。");
});

test("forwards an explicit permission change when reopening an existing project", async () => {
  const calls = [];
  const { actions } = setup({
    projects: [{ id: "one", isCurrent: true, name: "One", path: "/tmp/project" }],
    registryClient: { addWorkspaceProject: async (input) => { calls.push(input); return { projects: [{ id: "one", isCurrent: true, name: "One", accessMode: input.accessMode }], currentProjectId: "one" }; } },
  });
  assert.equal(await actions.pickProject({ accessMode: "governed", path: "/tmp/project" }), "/tmp/project");
  assert.equal(calls[0].accessMode, "governed");
  assert.equal(calls[0].path, "/tmp/project");
});
