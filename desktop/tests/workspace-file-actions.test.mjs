import assert from "node:assert/strict";
import test from "node:test";
import { createWorkspaceFileActions } from "../src/lib/workspace-file-actions.js";

test("opens a virtual topic without calling the workspace file client", async () => {
  const selected = [];
  const actions = createWorkspaceFileActions({ fileClient: { readEngineeringFile: async () => { throw new Error("should not run"); } }, setActiveTaskId: () => {}, setPlanError: () => {}, setReadonlyPlan: () => {}, setSelectedEngineeringFile: (value) => selected.push(value) });
  await actions.selectEngineeringFile({ id: "topic", path: "项目流程", relatedFiles: ["PROJECT.md"], title: "项目流程", virtual: true });
  assert.equal(selected.at(-1).loading, false);
  assert.equal(selected.at(-1).topic.id, "topic");
});

test("surfaces a workspace file read error next to the selected file", async () => {
  const selected = [];
  const actions = createWorkspaceFileActions({ fileClient: { readEngineeringFile: async () => { throw new Error("读取失败"); } }, setActiveTaskId: () => {}, setPlanError: () => {}, setReadonlyPlan: () => {}, setSelectedEngineeringFile: (value) => selected.push(value) });
  await actions.selectEngineeringFile({ path: "README.md", title: "README" });
  assert.equal(selected.at(-1).error, "读取失败");
  assert.equal(selected.at(-1).loading, false);
});
