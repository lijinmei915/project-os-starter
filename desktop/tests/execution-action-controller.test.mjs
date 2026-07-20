import assert from "node:assert/strict";
import test from "node:test";
import { createExecutionActionController } from "../src/lib/execution-action-controller.js";

test("runs a task check through the injected Execution workflow and projects its conversation update", async () => {
  const updates = [];
  const controller = createExecutionActionController({
    appendTerminalLog: () => {}, beginActionFeedback: () => {}, chatTurns: [{ id: "turn-1" }],
    executeGuardedCheckCommand: async () => ({ error: "", feedback: "通过", result: { success: true } }),
    executeTaskGuardedCheckWorkflow: async ({ task }) => ({ conversationUpdate: { requestId: task.requestId } }),
    finishActionFeedback: () => {}, guardedCheckCapability: (id) => ({ id, label: id }), persistTask: async () => {},
    projectExecutionEvent: (turns, event) => ({ turns, event }), runCheck: async () => ({ success: true }),
    setRunnerError: () => {}, setRunnerLoadingId: () => {}, setTasks: () => {}, taskStatuses: { running: "running" },
    tasks: [{ id: "task-1", requestId: "request-1" }], updateChatTurns: (value) => updates.push(value),
  });
  assert.equal(await controller.runGuardedCheck("task-1", "runtime"), true);
  assert.deepEqual(updates, [{ turns: [{ id: "turn-1" }], event: { requestId: "request-1" } }]);
});
