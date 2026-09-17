import assert from "node:assert/strict";
import test from "node:test";

import { agentInteractionAnswerSummary, agentInteractionPresentation, agentRunActivityPresentation, agentRunForTurn, composerResponseForPendingInteraction, conversationReadonlyPlanTaskId, conversationTranscriptItems, hasActiveAgentRun, projectConversationAgentEvents, shouldShowConversationAgentTimeline } from "../src/lib/conversation-agent-events.js";

test("renders a readonly plan only after confirmation becomes actionable", () => {
  assert.equal(conversationReadonlyPlanTaskId({
    events: [{ id: "confirmation", status: "pending" }],
    taskId: "task-failed",
  }), "");
  assert.equal(conversationReadonlyPlanTaskId({
    events: [{ id: "confirmation", status: "current" }],
    taskId: "task-waiting",
  }), "task-waiting");
  assert.equal(conversationReadonlyPlanTaskId({
    events: [{ id: "confirmation", status: "done" }],
    taskId: "task-confirmed",
  }), "");
  assert.equal(conversationReadonlyPlanTaskId({
    pendingAction: { taskId: "task-action", type: "confirm-active-task" },
  }), "task-action");
  assert.equal(conversationReadonlyPlanTaskId({
    events: [{ id: "confirmation", status: "current" }],
  }), "");
});

test("keeps a pending plan card separate from Agent execution progress", () => {
  assert.equal(shouldShowConversationAgentTimeline({
    intent: "task",
    pendingAction: { type: "confirm-active-task" },
    events: [{ id: "confirmation", status: "current" }],
  }, []), false);

  assert.equal(shouldShowConversationAgentTimeline({
    intent: "task",
    events: [{ id: "execution-ready", status: "current" }],
  }, []), true);
});

test("keeps a pending Agent form after its task instead of moving it to the transcript top", () => {
  const run = { id: "run-1", status: "awaiting-user-input", taskId: "task-1" };
  const interaction = { id: "ask-1", requestedAt: "2026-07-26T08:21:47Z", status: "pending" };
  const items = conversationTranscriptItems([
    { id: "1785054901528-assistant", role: "assistant", taskId: "task-1", text: "Agent 已开始处理。" },
  ], [{ interaction, run }]);
  assert.deepEqual(items.map((item) => item.type), ["turn", "interaction"]);
  assert.equal(hasActiveAgentRun({ taskId: "task-1" }, [{ interaction, run }]), true);
  assert.equal(shouldShowConversationAgentTimeline({ intent: "task", taskId: "task-1" }, [{ interaction, run }]), false);
});

test("replaces a stale execution event while the same Task waits for user input", () => {
  const turn = {
    taskId: "task-1",
    events: [
      { id: "confirmation", label: "任务已确认", status: "done" },
      { id: "execution-ready", label: "Agent 正在处理", status: "current" },
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
  assert.match(presentation.summary, /已跳过此问题/);
  assert.equal(presentation.detail, "Hermes 读取工具失败：工具 search_project 不接受参数：maxResults");
});

test("keeps the submitted choice and explains a continuation timeout in plain language", () => {
  const interaction = {
    fields: [{ id: "review_scope", label: "本次审查范围", options: [{ label: "审查当前全部 19 个改动项", value: "all_19" }] }],
    response: { action: "submit", answers: { review_scope: "all_19" } },
    status: "submitted",
  };
  assert.equal(agentInteractionAnswerSummary(interaction), "本次审查范围：审查当前全部 19 个改动项");
  const presentation = agentInteractionPresentation(interaction, { status: "failed", summary: "ACP 请求超时；Hermes: noisy logs" });
  assert.match(presentation.summary, /已保存你的选择/);
  assert.match(presentation.summary, /尚未开始后续工作，也没有修改文件/);
  assert.equal(presentation.detail, "等待 Agent 响应超时。");
});

test("projects persisted Agent evidence into a compact expandable activity stream", () => {
  const activity = agentRunActivityPresentation({
    evidence: [
      { id: "event-1", kind: "scheduling", recordedAt: "2026-07-28T10:37:22Z", status: "queued" },
      { id: "event-2", kind: "model", recordedAt: "2026-07-28T10:37:25Z", status: "running" },
      { details: { name: "git_status" }, id: "event-3", kind: "tool-call", recordedAt: "2026-07-28T10:37:26Z", status: "requested" },
      { details: { success: true, name: "git_status" }, id: "event-4", kind: "tool-result", recordedAt: "2026-07-28T10:37:27Z", status: "succeeded" },
      { id: "event-5", kind: "user-interaction", recordedAt: "2026-07-28T10:37:30Z", status: "awaiting-user-input" },
      { id: "event-6", kind: "user-interaction", recordedAt: "2026-07-28T10:38:00Z", status: "queued" },
      { id: "event-7", kind: "model", recordedAt: "2026-07-28T10:38:05Z", status: "running" },
      { id: "event-8", kind: "result", recordedAt: "2026-07-28T10:40:25Z", status: "failed", summary: "ACP 请求超时" },
    ],
    status: "failed",
  });
  assert.equal(activity.summary, "已处理，但本轮未完成");
  assert.equal(activity.durationMs, 183000);
  assert.deepEqual(activity.conversationEvents.map((event) => event.payload.label), ["读取项目状态（只读）"]);
  assert.match(activity.conversationEvents[0].detail, /不会修改文件/);
  assert.deepEqual(activity.events.map((event) => [event.label, event.status]), [
    ["正在排队", "done"], ["正在了解任务", "done"], ["等待你的回答", "done"], ["已保存你的选择", "done"], ["正在继续处理", "done"], ["本轮未完成", "failed"],
  ]);
  assert.equal(activity.events.at(-1).label, "本轮未完成");
  assert.equal(activity.events.at(-1).detail, "等待 Agent 响应超时。");
});

test("shows the latest matching background Agent Run on its conversation turn", () => {
  const turn = { taskId: "task-1" };
  const older = { id: "run-old", taskId: "task-1", updatedAt: "2026-07-28T09:00:00Z" };
  const active = {
    evidence: [{ id: "model", kind: "model", recordedAt: "2026-07-28T10:00:00Z", status: "running" }],
    id: "run-active",
    status: "running",
    taskId: "task-1",
    updatedAt: "2026-07-28T10:00:00Z",
  };
  assert.equal(agentRunForTurn(turn, [older, active]), active);
  const activity = agentRunActivityPresentation(active);
  assert.equal(activity.summary, "正在读取项目并分析任务");
  assert.deepEqual(activity.events.map((event) => [event.label, event.status]), [["正在了解任务", "current"]]);
  assert.match(activity.events[0].detail, /可以继续使用工作台/);
});

test("shows live Agent tool events before the model stage completes", () => {
  const activity = agentRunActivityPresentation({
    evidence: [{
      details: { agentEvent: { details: { name: "read_file", step: 1 }, kind: "tool-call", sequence: 2, status: "requested", summary: "Agent 请求读取项目文件。" } },
      id: "live-1",
      kind: "result",
      recordedAt: "2026-07-29T10:00:00Z",
      status: "running",
    }],
    status: "running",
    summary: "Agent 请求读取项目文件。",
  });
  assert.equal(activity.summary, "Agent 请求读取项目文件。");
  assert.deepEqual(activity.conversationEvents.map((event) => event.payload.label), ["读取项目文件（只读）"]);
  assert.equal(activity.conversationEvents[0].status, "running");
});
