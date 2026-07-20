import assert from "node:assert/strict";
import test from "node:test";
import { buildTaskBoardViewModel } from "../src/lib/task-board-view-model.js";

const statuses = { planned: "planned", waitingApproval: "waiting approval", running: "running", done: "done", failed: "failed" };
const snapshot = {
  goals: { goals: [{ id: "goal-a", title: "目标 A", status: "active", taskIds: ["second", "first"] }, { id: "done-goal", title: "已完成", status: "done" }] },
  projectGoals: { projectGoals: [{ id: "project-goal", title: "项目目标" }] },
};

test("builds the task board from one filtered, goal-ordered task sequence", () => {
  const model = buildTaskBoardViewModel({
    activeTaskId: "second",
    filter: "all",
    isNoiseTask: (task) => task.title === "你好",
    snapshot,
    sort: "goal",
    statuses,
    tasks: [
      { id: "first", title: "第一项", goalId: "goal-a", status: statuses.planned, createdAt: "2026-07-17T10:00:00Z" },
      { id: "second", title: "第二项", goalId: "goal-a", status: statuses.running, createdAt: "2026-07-17T11:00:00Z" },
      { id: "noise", title: "你好", status: statuses.planned },
      { id: "archived", title: "已归档", status: statuses.done, archivedAt: "2026-07-17T12:00:00Z" },
    ],
  });
  assert.equal(model.currentTask.id, "second");
  assert.deepEqual(model.visibleTasks.map((task) => task.id), ["first", "second"]);
  assert.deepEqual(model.taskGroups[0].tasks.map((task) => task.id), ["second", "first"]);
  assert.deepEqual(model.taskGoalOptions.map((goal) => goal.id), ["goal-a", "project-goal"]);
});

test("filters completed tasks by verified evidence", () => {
  const model = buildTaskBoardViewModel({
    activeTaskId: "",
    filter: "done",
    isNoiseTask: () => false,
    snapshot,
    sort: "updated",
    statuses,
    tasks: [
      { id: "verified", title: "已验证", status: statuses.done, verificationSummary: "自动验证通过", updatedAt: "2026-07-17T12:00:00Z" },
      { id: "pending", title: "待验证", status: statuses.done, verificationSummary: "待验证", updatedAt: "2026-07-17T13:00:00Z" },
    ],
  });
  assert.deepEqual(model.visibleTasks.map((task) => task.id), ["verified", "pending"]);
  assert.deepEqual(model.taskGroups.flatMap((group) => group.tasks).map((task) => task.id), ["verified"]);
});
