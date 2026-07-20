import assert from "node:assert/strict";
import test from "node:test";
import { navigateWorkspaceTarget } from "../src/lib/workspace-navigation.js";

test("routes workbench navigation without accessing runtime state", async () => {
  const tabs = [];
  const files = [];
  await navigateWorkspaceTarget("terminal", {
    onSelectEngineeringFile: (file) => files.push(file),
    onSwitchProject: async () => {},
    setActiveWorkspaceTab: (tab) => tabs.push(tab),
    topicPayloadFromOutline: () => null,
  });
  await navigateWorkspaceTarget({ path: "docs/ARCHITECTURE.md", type: "file" }, {
    onSelectEngineeringFile: (file) => files.push(file),
    onSwitchProject: async () => {},
    setActiveWorkspaceTab: (tab) => tabs.push(tab),
    topicPayloadFromOutline: () => null,
  });
  assert.deepEqual(tabs, ["terminal"]);
  assert.deepEqual(files, [{ description: "来自工作台活动的工程文件。", path: "docs/ARCHITECTURE.md" }]);
});
