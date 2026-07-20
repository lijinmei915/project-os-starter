import assert from "node:assert/strict";
import test from "node:test";
import { createTaskLifecycleController } from "../src/lib/task-lifecycle-controller.js";

function createController(overrides = {}) {
  const persisted = [];
  const selected = [];
  const controller = createTaskLifecycleController({
    activeConversationId: "conversation-1", activeConversationTaskId: "", activeTaskId: "", conversations: [],
    createTaskFromPlan: (plan, title) => ({ id: "repair-1", plan, title }),
    deleteTask: async () => {}, markProjectActivitySeen: () => {}, persistTask: async (task) => { persisted.push(task); return task; },
    readonlyPlan: null, refreshSnapshot: async () => {}, setActiveTaskId: (id) => selected.push(id), setConversations: () => {},
    setReadonlyPlan: () => {}, setSelectedEngineeringFile: () => {}, setTasks: () => {}, showToast: () => {},
    snapshot: { currentProjectId: "project-1", currentProjectPath: "/tmp/project", projectName: "Project", goals: { goals: [{ id: "goal-1", title: "目标" }] }, queue: [] },
    startNewConversation: () => {}, taskStatuses: { done: "done", planned: "planned", running: "running" }, tasks: [],
    ...overrides,
  });
  return { controller, persisted, selected };
}

test("creates a manual task as planned without candidate file changes", async () => {
  const { controller, persisted } = createController();
  const task = await controller.createManualTask({ goalId: "goal-1", summary: "核对边界", title: "整理任务" });
  assert.equal(task.status, "planned");
  assert.equal(task.goalId, "goal-1");
  assert.deepEqual(task.plan.candidateChanges, []);
  assert.equal(persisted.length, 1);
});

test("turns a queue task into a selected read-only plan without persistence", () => {
  const { controller, persisted, selected } = createController({ snapshot: { currentProjectId: "project-1", projectName: "Project", queue: [{ id: "queue-1", title: "排队任务", body: "补充说明", goalId: "goal-1" }] } });
  assert.equal(controller.selectTask("queue-1"), true);
  assert.deepEqual(selected, ["queue-1"]);
  assert.deepEqual(persisted, []);
});

test("does not create a repair task for a missing failed task", async () => {
  const { controller, persisted } = createController();
  assert.equal(await controller.createRepairTask("missing"), false);
  assert.deepEqual(persisted, []);
});
