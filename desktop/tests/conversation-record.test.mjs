import assert from "node:assert/strict";
import test from "node:test";
import { buildChatRequestContext, buildConversationRecord, buildDialogueContextState, contextualizeUserMessage, derivePendingAction, followUpDecision, isEphemeralConversation, isEphemeralConversationTurn, mergeConversationRecords } from "../src/lib/conversation-record.js";
import { buildTurnSummary } from "../src/conversation-runtime/summary.js";

test("builds a compact project conversation record", () => {
  const record = buildConversationRecord({
    id: "conv-1",
    updatedAt: "2026-07-11T00:00:00Z",
    turns: [{ id: "u1", role: "user", text: "  检查   对话持久化  " }, { id: "a1", responseMode: "legacy-json", role: "assistant", text: "已完成。" }],
  });
  assert.equal(record.title, "检查 对话持久化");
  assert.equal(record.preview, "已完成。");
  assert.equal(record.contextState.currentTopic, "检查 对话持久化");
  assert.equal(record.contextState.previousConclusion, "已完成。");
  assert.equal(record.summary.version, "omnidesk.turn-summary.v0.1");
  assert.equal(record.summary.coveredTurnCount, 0);
  assert.equal(record.turns[1].responseMode, "legacy-json");
});

test("keeps model and connection status turns out of durable conversation context", () => {
  const statusUser = { id: "u-status", role: "user", text: "当前使用什么模型" };
  const statusAssistant = { ephemeral: true, id: "a-status", intent: "model-status", role: "assistant", text: "当前使用的模型是 gpt-5.5。" };
  assert.equal(isEphemeralConversationTurn(statusUser), true);
  assert.equal(isEphemeralConversationTurn(statusAssistant), true);
  assert.equal(isEphemeralConversation({ id: "status-only", turns: [statusUser, statusAssistant] }), true);
  const request = buildChatRequestContext([statusUser, statusAssistant, { id: "u", role: "user", text: "检查项目风险" }]);
  assert.deepEqual(request.recentTurns.map((turn) => turn.text), ["检查项目风险"]);
});

test("summarizes older turns and keeps only the recent context window", () => {
  const turns = [
    { id: "u1", role: "user", text: "优化桌面对话体验" },
    { id: "a1", role: "assistant", text: "先统一对话运行时。" },
    { id: "u2", role: "user", text: "必须保留用户已有改动，不要重做 UI。" },
    { id: "a2", outcome: "succeeded", requestId: "r1", role: "assistant", taskId: "t1", text: "运行时检查已通过。" },
    { id: "u3", role: "user", text: "那怎么办？" },
    { id: "a3", role: "assistant", text: "先迁移动作决策。" },
    { id: "u4", role: "user", text: "继续" },
    { id: "a4", role: "assistant", text: "已迁移计划动作。" },
    { id: "u5", role: "user", text: "然后呢" },
    { id: "a5", role: "assistant", text: "下沉执行器。" },
    { id: "u6", role: "user", text: "继续" },
    { id: "a6", role: "assistant", text: "开始处理摘要。" },
  ];
  const request = buildChatRequestContext(turns, 8);
  assert.equal(request.recentTurns.length, 8);
  assert.equal(request.summary.coveredTurnCount, 4);
  assert.equal(request.summary.currentTopic, "优化桌面对话体验");
  assert.deepEqual(request.summary.constraints, ["必须保留用户已有改动，不要重做 UI。"]);
  assert.equal(request.summary.executionResults[0].outcome, "succeeded");
  assert.equal(request.contextState.currentTopic, "优化桌面对话体验");
});

test("merges a persisted summary when only recent turns are restored", () => {
  const previous = buildTurnSummary([
    { id: "u1", role: "user", text: "修复长对话上下文" },
    { id: "a1", role: "assistant", text: "先生成结构化摘要。" },
  ], { recentLimit: 0 });
  const request = buildChatRequestContext([
    { id: "u2", role: "user", text: "继续" },
    { id: "a2", role: "assistant", text: "正在继续。" },
  ], 8, previous);
  assert.equal(request.summary.currentTopic, "修复长对话上下文");
  assert.equal(request.contextState.currentTopic, "修复长对话上下文");
});

test("persists processing progress with the assistant turn", () => {
  const events = [{ id: "context", label: "读取项目上下文", status: "current" }];
  const record = buildConversationRecord({
    id: "conv-progress",
    updatedAt: "2026-07-13T00:00:00Z",
    turns: [{ durationMs: 14000, events, id: "a1", intent: "task", role: "assistant", text: "正在处理" }],
  });
  assert.equal(record.turns[0].durationMs, 14000);
  assert.deepEqual(record.turns[0].events, events);
});

test("persists bounded Provider stream metadata with its assistant turn", () => {
  const providerStreamTrace = { charCount: 320, deltaCount: 4, firstDeltaMs: 900, lastDeltaMs: 1400 };
  const record = buildConversationRecord({
    id: "conv-stream-trace",
    updatedAt: "2026-07-27T00:00:00Z",
    turns: [{ id: "a1", providerStreamTrace, requestId: "request-1", role: "assistant", text: "回答" }],
  });
  assert.deepEqual(record.turns[0].providerStreamTrace, providerStreamTrace);
  assert.equal(record.turns[0].requestId, "request-1");
});

test("keeps the prior conclusion and user delegation for follow-up turns", () => {
  const state = buildDialogueContextState([
    { id: "u1", role: "user", text: "这个项目当前有什么风险？" },
    { id: "a1", role: "assistant", text: "当前主要风险是对话缺少连续状态。" },
    { id: "u2", role: "user", text: "你自己判断，直接修" },
  ]);
  assert.equal(state.currentTopic, "这个项目当前有什么风险？");
  assert.equal(state.previousConclusion, "当前主要风险是对话缺少连续状态。");
  assert.equal(state.userDelegation, "你自己判断，直接修");
  assert.equal(state.expectedNextAction, "apply-fix");
  assert.equal(state.lastIntent, "task");
});

test("keeps the explicit topic through a chain of short follow-ups", () => {
  const turns = [
    { id: "u1", role: "user", text: "这个项目当前有什么风险？" },
    { id: "a1", role: "assistant", text: "当前主要风险是对话缺少连续状态。" },
    { id: "u2", role: "user", text: "那怎么办？" },
    { id: "a2", role: "assistant", text: "先接通多轮上下文。" },
    { id: "u3", role: "user", text: "你自己判断" },
  ];
  const request = buildChatRequestContext(turns);
  assert.equal(request.contextState.currentTopic, "这个项目当前有什么风险？");
  assert.equal(request.contextState.previousConclusion, "先接通多轮上下文。");
  assert.equal(request.contextState.userDelegation, "你自己判断");
  assert.deepEqual(request.recentTurns.map((turn) => turn.role), ["user", "assistant", "user", "assistant", "user"]);
  assert.equal(
    contextualizeUserMessage("直接修", request.contextState),
    "当前话题：这个项目当前有什么风险？\n上一结论：先接通多轮上下文。\n用户当前要求：直接修"
  );
});

test("keeps the latest record and removes same-title duplicates", () => {
  const record = { id: "conv-new", title: "同一任务" };
  const merged = mergeConversationRecords([{ id: "conv-old", title: "同一任务" }, { id: "other", title: "其他" }], record);
  assert.deepEqual(merged, [record, { id: "other", title: "其他" }]);
});

test("persists task conversation ownership", () => {
  const record = buildConversationRecord({
    goalId: "goal-1",
    id: "conv-task-1",
    projectId: "project-1",
    taskId: "task-1",
    taskTitle: "检查风险",
    turns: [{ id: "u1", role: "user", text: "继续分析" }],
    updatedAt: "2026-07-17T00:00:00Z",
  });
  assert.equal(record.title, "检查风险");
  assert.equal(record.taskId, "task-1");
  assert.equal(record.goalId, "goal-1");
  assert.equal(record.projectId, "project-1");
});

test("keeps one current conversation per task without removing general conversations", () => {
  const general = { id: "general", taskId: "", title: "检查风险" };
  const oldTaskConversation = { id: "task-old", taskId: "task-1", title: "旧标题" };
  const otherTaskConversation = { id: "task-2", taskId: "task-2", title: "检查风险" };
  const next = { id: "task-new", taskId: "task-1", title: "检查风险" };
  assert.deepEqual(mergeConversationRecords([general, oldTaskConversation, otherTaskConversation], next), [next, general, otherTaskConversation]);
});

test("keeps one unresolved action in conversation state", () => {
  const action = { id: "action-1", task: "运行检查", type: "generate-plan" };
  assert.deepEqual(derivePendingAction([{ role: "assistant", pendingAction: action, text: "我会处理" }]), action);
  assert.equal(derivePendingAction([
    { role: "assistant", pendingAction: action, text: "我会处理" },
    { role: "user", resolvedActionId: "action-1", text: "好" },
  ]), null);
});

test("does not infer executable actions from legacy assistant prose", () => {
  assert.equal(derivePendingAction([{
    id: "assistant-legacy",
    role: "assistant",
    text: "当前风险已整理。最小下一步是运行一轮基础检查，并补齐回归证据。",
  }]), null);
});

test("maps short follow-ups to pending-action decisions", () => {
  assert.equal(followUpDecision("好"), "confirm");
  assert.equal(followUpDecision("继续"), "confirm");
  assert.equal(followUpDecision("那开始吧"), "confirm");
  assert.equal(followUpDecision("就这么做"), "confirm");
  assert.equal(followUpDecision("然后呢"), "inspect");
  assert.equal(followUpDecision("不用了"), "cancel");
  assert.equal(followUpDecision("这个方案为什么这样设计"), "none");
});

test("keeps acknowledgements out of the current topic anchor", () => {
  const context = buildDialogueContextState([
    { role: "user", text: "分析当前对话模块，并给出三个改进建议" },
    { role: "assistant", text: "这里有三项建议。" },
    { role: "user", text: "可以" },
    { role: "assistant", text: "建议优先推进当前任务摘要。" },
    { role: "user", text: "那开始吧" },
  ]);
  assert.equal(context.currentTopic, "分析当前对话模块，并给出三个改进建议");
});
