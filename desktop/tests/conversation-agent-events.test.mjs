import assert from "node:assert/strict";
import test from "node:test";

import { agentInteractionPresentation, composerResponseForPendingInteraction, conversationTranscriptItems, projectConversationAgentEvents } from "../src/lib/conversation-agent-events.js";

test("replaces a stale execution event while the same Task waits for user input", () => {
  const turn = {
    taskId: "task-1",
    events: [
      { id: "confirmation", label: "任务已确认", status: "done" },
      { id: "execution-ready", label: "Agent 已启动", status: "current" },
    ],
  };
  const events = projectConversationAgentEvents(turn, [{ run: { status: "awaiting-user-input", taskId: "task-1" } }]);
  assert.deepEqual(events.map(({ id, status }) => [id, status]), [
    ["confirmation", "done"],
    ["user-interaction", "current"],
  ]);
  assert.equal(events.at(-1).label, "等待你的回答");
});

test("does not project another Task interaction into the current turn", () => {
  const events = [{ id: "execution-ready", status: "current" }];
  assert.equal(projectConversationAgentEvents(
    { events, taskId: "task-1" },
    [{ run: { status: "awaiting-user-input", taskId: "task-2" } }],
  ), events);
});

test("places an earlier ask_user form before a later composer message", () => {
  const run = { id: "run-1", status: "awaiting-user-input" };
  const interaction = { id: "ask-1", requestedAt: "2026-07-26T08:21:47Z" };
  const items = conversationTranscriptItems(
    [{ id: "1785054901527-user", role: "user", text: "根据现有的能力更新" }],
    [{ interaction, run }],
  );
  assert.deepEqual(items.map((item) => item.type), ["interaction", "turn"]);
});

test("uses the composer as the answer for one pending text interaction", () => {
  const run = { id: "run-1", status: "awaiting-user-input" };
  const interaction = { fields: [{ id: "details", type: "text" }], id: "ask-1", status: "pending" };
  assert.deepEqual(composerResponseForPendingInteraction([{ interaction, run }], "  使用现有能力更新  "), {
    interaction,
    response: { action: "submit", answers: { details: "使用现有能力更新" } },
    run,
  });
  assert.equal(composerResponseForPendingInteraction([{ interaction, run }], "回答", 1), null);
});

test("shows continuation failure instead of hiding it behind a skipped form", () => {
  const presentation = agentInteractionPresentation(
    { response: { action: "skip", answers: {} }, status: "submitted" },
    { status: "failed", summary: "Hermes 读取工具失败：工具 search_project 不接受参数：maxResults；Hermes: noisy logs" },
  );
  assert.equal(presentation.collapsed, true);
  assert.equal(presentation.label, "未完成");
  assert.match(presentation.summary, /继续执行时遇到问题/);
  assert.equal(presentation.detail, "Hermes 读取工具失败：工具 search_project 不接受参数：maxResults");
});
