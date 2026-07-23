import assert from "node:assert/strict";
import test from "node:test";
import { topicPayloadFromOutline, workspaceFileTabId, workspaceFileTabTitle } from "../src/lib/workspace-tab-presentation.js";

test("builds stable workspace tab labels for virtual and engineering files", () => {
  assert.equal(workspaceFileTabId({ virtual: true, routeId: "project-progress" }), "route:project-progress");
  assert.equal(workspaceFileTabId({ path: "src/main.jsx" }), "file:src/main.jsx");
  assert.equal(workspaceFileTabTitle({ id: "workbench-overview" }), "工作台");
  assert.equal(workspaceFileTabTitle({ preview: { name: "main.jsx" } }), "main.jsx");
});

test("projects only registered governance routes into virtual workspace topics", () => {
  const progress = topicPayloadFromOutline("project-progress");
  assert.equal(progress?.virtual, true);
  assert.equal(progress?.routePath, "/projects/:projectId/progress");
  assert.equal(progress?.surface, "current-progress");
  assert.equal(progress?.group, "项目");
  const taskList = topicPayloadFromOutline("task-list");
  assert.equal(taskList?.group, "目标与任务");
  assert.equal(topicPayloadFromOutline("missing-route"), null);
});
