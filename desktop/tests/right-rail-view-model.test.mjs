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
    conversations: [{ id: "conversation-1", title: "当前对话" }, { id: "task-conversation", taskId: "task-running", title: "任务上下文" }],
    isNoiseTask,
    snapshot: {
      goalValidation: { criteria: ["通过检查"], goal: { id: "goal-1", status: "verified" } },
      goalValidationReport: { status: "passed" },
      goals: { activeGoalId: "goal-1", goals: [{ id: "goal-1", title: "完成工作台", status: "active", decompositionTaskIds: ["task-running", "task-done"], taskIds: ["task-running", "task-done", "historical-pollution"] }] },
      phase: "stabilizing",
    },
    taskFilter: "todo",
    taskStatuses,
    tasks: [
      { id: "task-running", goalId: "goal-1", status: "running", title: "实现状态面板" },
      { id: "task-done", goalId: "goal-1", status: "done", title: "添加回归测试" },
      { id: "historical-pollution", goalId: "goal-1", status: "planned", title: "普通对话误关联任务" },
      { id: "noise", goalId: "goal-1", status: "planned", title: "你好" },
      { id: "other-goal", goalId: "goal-2", status: "planned", title: "不应显示" },
    ],
  });

  assert.equal(model.goalTitle, "完成工作台");
  assert.equal(model.activeConversationCount, 1);
  assert.equal(model.todoMeta, 2);
  assert.equal(model.hasGoalProgress, true);
  assert.equal(model.progressValue, 50);
  assert.deepEqual(model.visibleGoalTodos.map((task) => task.id), ["task-running"]);
  assert.equal(model.goalVerified, true);
  assert.deepEqual(model.validationCriteria, ["通过检查"]);
});

test("uses only confirmed decomposition items from the snapshot queue", () => {
  const model = buildRightRailViewModel({
    activeConversationId: "conversation-1",
    conversations: [{ id: "conversation-1", title: "当前对话" }],
    isNoiseTask,
    snapshot: {
      goals: { activeGoalId: "goal-1", goals: [{ id: "goal-1", title: "新目标", status: "planned", decompositionTaskIds: ["queued"], taskIds: ["queued"] }] },
      queue: [
        { id: "queued", goalId: "goal-1", status: "planned", title: "等待拆解" },
        { id: "unrelated", goalId: "goal-1", status: "planned", title: "未确认任务" },
      ],
    },
    taskStatuses,
  });

  assert.equal(model.todoMeta, 1);
  assert.equal(model.hasGoalProgress, true);
  assert.equal(model.goalIsPlanned, false);
  assert.deepEqual(model.visibleGoalTodos.map((task) => task.id), ["queued"]);
});

test("does not expose progress before a goal has confirmed decomposition tasks", () => {
  const model = buildRightRailViewModel({
    conversations: [],
    isNoiseTask,
    snapshot: {
      goals: { activeGoalId: "goal-1", goals: [{ id: "goal-1", title: "待拆解目标", status: "planned", decompositionTaskIds: [], taskIds: [] }] },
    },
    taskStatuses,
    tasks: [],
  });

  assert.equal(model.hasGoalProgress, false);
  assert.equal(model.progressValue, 0);
  assert.deepEqual(model.goalSteps, ["暂无任务", "等待拆解", "待确认"]);
});
