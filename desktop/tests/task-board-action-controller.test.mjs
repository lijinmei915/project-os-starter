import assert from "node:assert/strict";
import test from "node:test";
import { createTaskBoardActionController } from "../src/lib/task-board-action-controller.js";

function controller(overrides = {}) {
  const calls = [];
  const actions = createTaskBoardActionController({
    checksForPlan: () => [{ id: "runtime" }, { id: "web-build" }],
    onDeleteTask: async () => true,
    onEnsureModelAvailable: async () => true,
    onMarkTaskWaiting: async () => true,
    onOpenTaskConversation: (id) => calls.push(["openConversation", id]),
    onRunGuardedCheck: async () => true,
    onSelectTask: (id, options) => calls.push(["select", id, options]),
    reload: () => calls.push(["reload"]),
    saveDesktopTask: async (task) => calls.push(["save", task]),
    setDeletingTask: (value) => calls.push(["setDeleting", value]),
    setEditingTask: (value) => calls.push(["setEditing", value]),
    setMutationError: (value) => calls.push(["error", value]),
    setTaskActionDialog: (value) => calls.push(["setDialog", value]),
    setTaskModelPreflight: (value) => calls.push(["setPreflight", value]),
    taskActionDialog: { task: { id: "task-1" } },
    taskCardPrimaryAction: () => ({ mode: "detail" }),
    taskGoalOptions: [],
    taskNextAction: () => ({ action: "open-task" }),
    updateWorkspaceGoal: async () => {},
    ...overrides,
  });
  return { actions, calls };
}

test("does not start a task when the required model is unavailable", async () => {
  const { actions, calls } = controller({ onEnsureModelAvailable: async () => false });
  await actions.startTaskFromDialog();
  assert.deepEqual(calls, [
    ["setPreflight", true],
    ["error", "当前模型实时检测不可用，任务没有开始。请更新 Key 或切换连接后重试。"],
    ["setPreflight", false],
  ]);
});

test("records an explicit isolated execution choice before starting a task", async () => {
  const waited = [];
  const { actions, calls } = controller({
    onMarkTaskWaiting: async (id) => { waited.push(id); return true; },
  });
  await actions.startTaskFromDialog({ isolate: true });
  assert.equal(calls.find(([name]) => name === "save")?.[1].executionMode, "isolated");
  assert.deepEqual(waited, ["task-1"]);
});

test("stops rerunning task checks after the first failure", async () => {
  const checked = [];
  const { actions } = controller({ onRunGuardedCheck: async (_taskId, checkId) => {
    checked.push(checkId);
    return false;
  } });
  assert.equal(await actions.rerunFailedChecks({ id: "task-1", plan: {} }), false);
  assert.deepEqual(checked, ["runtime"]);
});

test("clears task editing state after a confirmed deletion", async () => {
  const { actions, calls } = controller({ deletingTask: { id: "task-1" } });
  await actions.permanentlyDeleteTask();
  assert.deepEqual(calls, [
    ["setDialog", null],
    ["setEditing", null],
    ["setDeleting", null],
  ]);
});

test("opens the task conversation through the injected UI boundary", () => {
  const { actions, calls } = controller();
  actions.openTaskPrimaryAction({ id: "task-1", status: "done" });
  assert.deepEqual(calls, [
    ["error", ""],
    ["select", "task-1", { preserveWorkspace: true }],
    ["openConversation", "task-1"],
  ]);
});
