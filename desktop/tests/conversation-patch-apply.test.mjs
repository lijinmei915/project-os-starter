import assert from "node:assert/strict";
import test from "node:test";
import { applyPendingConversationPatch } from "../src/lib/conversation-patch-apply.js";

test("projects pending Patch Apply progress through injected conversation actions", async () => {
  const updates = [];
  const ref = { current: false };
  const turns = [{ id: "assistant-1", pendingAction: { id: "apply-1", taskId: "task-1" } }];
  const success = await applyPendingConversationPatch({
    action: { id: "apply-patch" },
    baseTurns: turns,
    isApplyingRef: ref,
    onChatTurnsChange: (next) => updates.push(next),
    onRunChatAction: async (action) => {
      action.onProgress({ text: "正在验证" });
      return true;
    },
    pendingAction: turns[0].pendingAction,
    projectExecutionEvent: (next, progress) => next.map((turn) => ({ ...turn, progress: progress.text })),
  });
  assert.equal(success, true);
  assert.equal(ref.current, false);
  assert.equal(updates.at(-1)[0].progress, "正在验证");
});

test("restores original turns when Patch Apply fails", async () => {
  const updates = [];
  const turns = [{ id: "assistant-1", pendingAction: { id: "apply-1", taskId: "task-1" } }];
  const success = await applyPendingConversationPatch({
    action: { id: "apply-patch" },
    baseTurns: turns,
    isApplyingRef: { current: false },
    onChatTurnsChange: (next) => updates.push(next),
    onRunChatAction: async () => false,
    pendingAction: turns[0].pendingAction,
    projectExecutionEvent: (next) => next,
  });
  assert.equal(success, false);
  assert.equal(updates.at(-1), turns);
});

test("offers a repair task after a failed Apply terminal event", async () => {
  const events = [];
  const turns = [{ id: "assistant-1", pendingAction: { id: "apply-1", taskId: "task-1" } }];
  await applyPendingConversationPatch({
    action: { id: "apply-patch" },
    baseTurns: turns,
    isApplyingRef: { current: false },
    onChatTurnsChange: () => {},
    onRunChatAction: async (action) => {
      action.onProgress({ outcome: "failed", text: "应用失败" });
      return false;
    },
    pendingAction: turns[0].pendingAction,
    projectExecutionEvent: (next, progress) => { events.push(progress); return next; },
  });
  assert.equal(events[0].actions[0].id, "create-repair-task");
});
