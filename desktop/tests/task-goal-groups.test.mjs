import assert from "node:assert/strict";
import test from "node:test";

import { groupTasksByGoal, sortTasksForGoal, taskPositionInGoal, tasksForWorkspaceGoal } from "../src/lib/task-goal-groups.js";

test("groups tasks by stable goal id and keeps unlinked tasks visible", () => {
  const groups = groupTasksByGoal([
    { goalId: "goal-a", id: "task-1" },
    { goalId: "goal-a", id: "task-2" },
    { id: "task-3" },
  ], (task) => task.goalId === "goal-a" ? "对话体验" : "未关联目标");
  assert.deepEqual(groups.map((group) => [group.id, group.label, group.tasks.length]), [
    ["goal-a", "对话体验", 2],
    ["unlinked:未关联目标", "未关联目标", 1],
  ]);
});

test("orders workspace tasks by the goal task list and excludes archived tasks", () => {
  const task = { id: "task-b", goalId: "goal-a" };
  const tasks = tasksForWorkspaceGoal([
    { id: "task-a", goalId: "goal-a", createdAt: "2026-07-17T09:00:00Z" },
    task,
    { id: "task-c", goalId: "goal-a", archivedAt: "2026-07-17T10:00:00Z" },
    { id: "task-other", goalId: "goal-b" },
  ], task, ["task-b", "task-a", "task-c"]);

  assert.deepEqual(tasks.map((item) => item.id), ["task-b", "task-a"]);
  assert.deepEqual(taskPositionInGoal(tasks, "task-a"), { current: 2, index: 1, total: 2 });
});

test("keeps an unlinked task as a one-item workspace sequence", () => {
  const task = { id: "task-a" };
  assert.deepEqual(tasksForWorkspaceGoal([task, { id: "task-b" }], task), [task]);
  assert.deepEqual(taskPositionInGoal([], "missing"), { current: 1, index: 0, total: 1 });
});

test("uses the goal task sequence before creation time", () => {
  const ordered = sortTasksForGoal([
    { id: "task-a", createdAt: "2026-07-17T10:00:00Z" },
    { id: "task-b", createdAt: "2026-07-17T09:00:00Z" },
  ], ["task-a", "task-b"]);
  assert.deepEqual(ordered.map((task) => task.id), ["task-a", "task-b"]);
});
