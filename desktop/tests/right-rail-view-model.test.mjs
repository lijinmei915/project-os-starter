import assert from "node:assert/strict";
import test from "node:test";
import { buildRightRailViewModel } from "../src/lib/right-rail-view-model.js";

const taskStatuses = {
  done: "done",
  failed: "failed",
  planned: "planned",
  running: "running",
  waitingApproval: "waiting approval",
};

const isNoiseTask = (task) => task?.title === "你好";

test("builds the active goal rail from task state without including noise tasks", () => {
  const model = buildRightRailViewModel({
    activeConversationId: "conversation-1",
    activeTaskId: "task-running",
    conversations: [{ id: "conversation-1", title: "当前对话" }],
    isNoiseTask,
    snapshot: {
      goalValidation: { criteria: ["通过检查"], goal: { id: "goal-1", status: "verified" } },
      goalValidationReport: { status: "passed" },
      goals: { activeGoalId: "goal-1", goals: [{ id: "goal-1", title: "完成工作台", status: "active", taskIds: ["task-running", "task-done"] }] },
      phase: "stabilizing",
    },
    taskFilter: "todo",
    taskStatuses,
    tasks: [
      { id: "task-running", goalId: "goal-1", status: "running", title: "实现状态面板" },
      { id: "task-done", goalId: "goal-1", status: "done", title: "添加回归测试" },
      { id: "noise", goalId: "goal-1", status: "planned", title: "你好" },
      { id: "other-goal", goalId: "goal-2", status: "planned", title: "不应显示" },
    ],
  });

  assert.equal(model.goalTitle, "完成工作台");
  assert.equal(model.todoMeta, 2);
  assert.equal(model.progressValue, 50);
  assert.deepEqual(model.visibleGoalTodos.map((task) => task.id), ["task-running"]);
  assert.equal(model.goalVerified, true);
  assert.deepEqual(model.validationCriteria, ["通过检查"]);
});

test("uses the snapshot queue when the active goal has no persisted tasks", () => {
  const model = buildRightRailViewModel({
    activeConversationId: "conversation-1",
    conversations: [{ id: "conversation-1", title: "当前对话" }],
    isNoiseTask,
    snapshot: {
      goals: { activeGoalId: "goal-1", goals: [{ id: "goal-1", title: "新目标", status: "planned", taskIds: [] }] },
      queue: [{ id: "queued", goalId: "goal-1", status: "planned", title: "等待拆解" }],
    },
    taskStatuses,
  });

  assert.equal(model.todoMeta, 1);
  assert.equal(model.goalIsPlanned, false);
  assert.deepEqual(model.visibleGoalTodos.map((task) => task.id), ["queued"]);
});
