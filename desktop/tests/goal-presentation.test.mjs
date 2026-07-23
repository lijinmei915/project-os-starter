import assert from "node:assert/strict";
import test from "node:test";
import {
  compactGoalTitle,
  goalMetaFromStatus,
  goalStatusLabel,
  goalValidationStatusFromActiveGoal,
  progressFromTodos,
  projectProfileItems,
  snapshotQueueTodos,
  taskDisplayStatus,
  taskSubtasks,
} from "../src/lib/goal-presentation.js";

const taskStatuses = {
  done: "done",
  failed: "failed",
  planned: "planned",
  running: "running",
  waitingApproval: "waiting approval",
};
const dependencies = { phaseLabel: (phase) => ({ stabilizing: "打磨中" })[phase] || phase, taskStatuses };

test("derives goal state from task and validation evidence", () => {
  assert.equal(goalStatusLabel([], "stabilizing", dependencies), "打磨中");
  assert.equal(goalStatusLabel([{ status: "failed" }], "stabilizing", dependencies), "需处理");
  assert.equal(goalValidationStatusFromActiveGoal({ id: "goal-1", status: "active" }, { id: "goal-1", status: "verified" }, ""), "verified");
  assert.equal(goalValidationStatusFromActiveGoal({ id: "goal-1", status: "active" }, { id: "goal-2", status: "verified" }, "passed"), "");
  assert.equal(goalMetaFromStatus("active", "", [{ status: "running" }], "stabilizing", dependencies), "进行中");
});

test("projects bounded titles, progress, queue items, and subtasks", () => {
  assert.equal(compactGoalTitle("OmniDesk 仓库文件治理与架构收敛 / 对话投影"), "对话投影");
  assert.equal(progressFromTodos([
    { status: "done" },
    { status: "running", displayStatus: "waiting approval" },
  ], taskStatuses), 75);
  assert.equal(taskDisplayStatus({ id: "task-1", status: "running" }, {}, taskStatuses), "planned");
  assert.equal(taskDisplayStatus({ id: "task-1", status: "running" }, { activeTaskId: "task-1", planLoading: true }, taskStatuses), "running");
  assert.deepEqual(snapshotQueueTodos({ queue: [{ id: "hello", title: "你好" }, { id: "task-1", title: "收口展示" }] }, {
    isNoiseTask: (task) => task.title === "你好",
    taskStatuses,
  }).map((task) => task.id), ["task-1"]);
  assert.deepEqual(taskSubtasks({ id: "task-1", status: "done", plan: { steps: ["修改模块", "运行检查"] } }, taskStatuses).map((step) => step.status), ["done", "done"]);
});

test("prefers workbench profile facts while preserving legacy fallback", () => {
  assert.deepEqual(projectProfileItems({
    phase: "stabilizing",
    projectProfile: { overview: "桌面 Runtime", missingFields: ["技术架构"] },
  }).map((item) => [item.title, item.missing]), [
    ["项目概览", false],
    ["当前阶段", false],
    ["技术架构", true],
    ["检查命令", true],
    ["协作规则", true],
  ]);
});
