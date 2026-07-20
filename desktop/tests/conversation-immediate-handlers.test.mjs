import assert from "node:assert/strict";
import test from "node:test";
import { createBasicConversationImmediateHandlers } from "../src/lib/conversation-immediate-handlers.js";

test("projects inspect and cancel commands without entering execution", async () => {
  const updates = [];
  const handlers = createBasicConversationImmediateHandlers({
    activeTask: null,
    clearSubmittedInput: () => {},
    createCancelledTurn: ({ id, requestId }) => ({ id, requestId, role: "assistant", text: "已取消" }),
    onChatTurnsChange: (turns) => updates.push(turns),
    onRunChatAction: async () => true,
    pendingAction: { taskId: "task-1", type: "apply-patch" },
    requestBaseTurns: [],
    requestId: "request-1",
    runningTaskStatus: "running",
    userTurn: { id: "user-1", role: "user" },
  });
  assert.equal(await handlers["inspect-action"](), true);
  assert.equal(updates[0][1].actions[0].label, "应用改动");
  assert.equal(await handlers["cancel-action"](), true);
  assert.equal(updates[1][1].text, "已取消");
});
