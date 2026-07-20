import assert from "node:assert/strict";
import test from "node:test";
import { clearTransientWorkspaceTabs, closeWorkspaceTabState, initialWorkspaceTabs, upsertWorkspaceFileTab, workspaceTabSelection } from "../src/lib/workspace-tab-state.js";

test("upserts a file tab without duplicating the workbench tabs", () => {
  const tabs = upsertWorkspaceFileTab(initialWorkspaceTabs, { path: "PROJECT.md" }, { id: "file-project", title: "PROJECT.md" });
  assert.equal(tabs.length, 3);
  assert.equal(upsertWorkspaceFileTab(tabs, { path: "PROJECT.md", preview: true }, { id: "file-project", title: "PROJECT.md" }).length, 3);
});

test("closes only closable tabs and returns the conversation fallback", () => {
  const tabs = upsertWorkspaceFileTab(initialWorkspaceTabs, { path: "PROJECT.md" }, { id: "file-project", title: "PROJECT.md" });
  assert.deepEqual(closeWorkspaceTabState({ activeTabId: "file-project", tabId: "file-project", tabs }), { activeTabId: "plan", tabs: initialWorkspaceTabs });
  assert.equal(closeWorkspaceTabState({ activeTabId: "plan", tabId: "plan", tabs }).tabs.length, 3);
  assert.equal(workspaceTabSelection(tabs, "file-project").kind, "file");
});

test("clears transient file and task tabs while preserving stable workbench tabs", () => {
  const fileTabs = upsertWorkspaceFileTab(initialWorkspaceTabs, { path: "PROJECT.md" }, { id: "file-project", title: "PROJECT.md" });
  const tabs = [...fileTabs, { id: "task-1", title: "任务", kind: "task", closable: true }];
  assert.deepEqual(clearTransientWorkspaceTabs(tabs), initialWorkspaceTabs);
});
