import assert from "node:assert/strict";
import test from "node:test";

import { initialPlanActivityEvents, mergePlanWorkflowProgress, recordPlanComposition, recordPlanPersistence, recordPlanTool } from "../src/lib/conversation-plan-activity.js";

test("keeps plan activity in observed order without showing future confirmation steps", () => {
  let events = initialPlanActivityEvents();
  events = mergePlanWorkflowProgress(events, [{ id: "context", status: "current" }]);
  events = recordPlanTool(events, { details: { name: "read_file", path: "src/status-bar.jsx" }, sequence: 1 });
  events = recordPlanTool(events, { details: { name: "read_file", path: "src/status-bar.jsx" }, sequence: 2 }, true);
  events = recordPlanComposition(events);
  events = recordPlanPersistence(events);

  assert.deepEqual(events.map(({ label, status }) => [label, status]), [
    ["了解你的要求", "done"],
    ["分析项目（只读）", "done"],
    ["已读取 src/status-bar.jsx", "done"],
    ["整理具体方案", "done"],
    ["保存只读方案", "current"],
  ]);
  assert.equal(events.some((event) => /确认/.test(event.label)), false);
});

test("merges a tool completion into its request instead of adding a duplicate row", () => {
  let events = recordPlanTool(initialPlanActivityEvents(), { details: { name: "git_status" }, sequence: 10 });
  events = recordPlanTool(events, { details: { name: "git_status", success: true }, sequence: 11 }, true);
  assert.equal(events.length, 2);
  assert.equal(events.at(-1).label, "已确认项目改动状态");
  assert.equal(events.at(-1).status, "done");
});
