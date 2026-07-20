import assert from "node:assert/strict";
import test from "node:test";

import { collapseDuplicateOpenTasks, findOpenTaskDuplicate, taskProgressSummary, taskUpdatedLabel, taskVerificationStatusLabel } from "../src/lib/task-presentation.js";

test("collapses same-title unfinished tasks within one goal and keeps the latest", () => {
  const tasks = [
    { id: "old", goalId: "goal-1", status: "planned", title: "运行一轮基础检查", updatedAt: "2026-07-13T09:00:00Z" },
    { id: "new", goalId: "goal-1", status: "running", title: " 运行一轮基础检查 ", updatedAt: "2026-07-13T10:00:00Z" },
  ];

  assert.deepEqual(collapseDuplicateOpenTasks(tasks).map((task) => task.id), ["new"]);
});

test("preserves completed history and same-title tasks from different goals", () => {
  const tasks = [
    { id: "done", goalId: "goal-1", status: "done", title: "基础检查" },
    { id: "open-1", goalId: "goal-1", status: "planned", title: "基础检查" },
    { id: "open-2", goalId: "goal-2", status: "planned", title: "基础检查" },
  ];

  assert.deepEqual(collapseDuplicateOpenTasks(tasks).map((task) => task.id), ["done", "open-1", "open-2"]);
});

test("finds only an active duplicate in the same goal", () => {
  const candidate = { id: "candidate", goalId: "goal-1", status: "planned", title: "运行 一轮基础检查" };
  const duplicate = { id: "existing", goalId: "goal-1", status: "running", title: "运行一轮基础检查" };
  assert.equal(findOpenTaskDuplicate([duplicate], candidate)?.id, "existing");
  assert.equal(findOpenTaskDuplicate([{ ...duplicate, archivedAt: "2026-07-17T00:00:00Z" }], candidate), null);
  assert.equal(findOpenTaskDuplicate([{ ...duplicate, goalId: "goal-2" }], candidate), null);
});

test("summarizes task steps and successful checks", () => {
  assert.deepEqual(taskProgressSummary({
    plan: { steps: ["读取上下文", "运行检查"] },
    runs: [{ success: true }, { success: false }],
  }), {
    passedChecks: 1,
    stepCount: 2,
    steps: ["读取上下文", "运行检查"],
  });
});

test("keeps task verification and update labels in the task presentation domain", () => {
  assert.equal(taskVerificationStatusLabel({ status: "done" }), "已完成");
  assert.equal(taskVerificationStatusLabel({ status: "failed" }), "有失败项");
  assert.equal(taskVerificationStatusLabel({ verificationSummary: "Web build 已通过", status: "planned" }), "Web build 已通过");
  assert.equal(taskUpdatedLabel({ updatedAt: "not-a-date" }), "not-a-date");
});
