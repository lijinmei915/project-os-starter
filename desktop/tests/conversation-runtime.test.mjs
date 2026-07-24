import assert from "node:assert/strict";
import test from "node:test";

import { classifyConversationIntent, conversationActionDecision, conversationActionDefinition, conversationCommands, conversationError, conversationRuntimeState, conversationStates, createConversationActionAdapters, dispatchConversationCommand, executeConversationActionRequest, executeRegisteredConversationAction, guardedCheckCapability, isApplicablePatchDraft, isDuplicateSubmission, mergeExecutionEvents, migrateConversationRecord, normalizeConversationReferences, prepareConversationSubmission, projectExecutionEvent, recoverConversationRuntime, resolveConversationCommand, resolveRequestTakeover, transitionConversationState } from "../src/conversation-runtime/index.js";

test("routes action language before inspection keywords", () => {
  assert.equal(classifyConversationIntent("运行一轮基础检查"), "task");
  assert.equal(classifyConversationIntent("当前检查有什么问题"), "project-inspect");
  assert.equal(classifyConversationIntent("接下来要把对话体验打磨好"), "stage-goal");
  assert.equal(classifyConversationIntent("下一阶段应该怎么做？"), "question");
});

test("decides a safe check action before the generic task route", () => {
  assert.deepEqual(conversationActionDecision("运行一轮基础检查"), {
    action: { checkId: "runtime", id: "run-check" },
    confirmation: "none",
    mode: "execute",
    risk: "read-only",
  });
  assert.equal(conversationActionDecision("当前基础检查有什么问题"), null);
  assert.equal(guardedCheckCapability("runtime").command, "npm --prefix desktop test");
});

test("routes explicit modifications to a read-only patch draft", () => {
  assert.deepEqual(conversationActionDecision("帮我修改按钮"), {
    action: { id: "generate-patch", task: "帮我修改按钮" },
    confirmation: "none",
    mode: "execute",
    risk: "read-only-draft",
  });
  assert.deepEqual(conversationActionDecision("帮我制定修改方案"), {
    action: { id: "generate-plan", task: "帮我制定修改方案" },
    confirmation: "none",
    mode: "execute",
    risk: "read-only",
  });
  assert.equal(conversationActionDecision("当前有什么检查问题"), null);
});

test("routes an explicit missing decision through Hermes instead of drafting a patch", () => {
  assert.deepEqual(conversationActionDecision("请调整界面，但我还没决定紧凑还是舒适，请先通过选项表单询问我"), {
    action: { id: "start-agent", task: "请调整界面，但我还没决定紧凑还是舒适，请先通过选项表单询问我" },
    confirmation: "none",
    mode: "execute",
    risk: "read-only-agent",
  });
});

test("keeps plan questions out of the execution route", () => {
  assert.equal(conversationActionDecision("当前计划是什么"), null);
  assert.equal(conversationActionDecision("这个方案有什么风险"), null);
});

test("dispatches explicit planning without entering generic chat", () => {
  const submission = prepareConversationSubmission({ message: "请拆解当前任务", now: 120, random: 0.5 });
  assert.equal(submission.command.command, conversationCommands.executeAction);
  assert.deepEqual(submission.command.action, { id: "generate-plan", task: "请拆解当前任务" });
  assert.equal(submission.command.confirmation, "none");
  assert.equal(submission.pendingAction, null);
});

test("offers apply only for a concrete unified diff", () => {
  assert.equal(isApplicablePatchDraft({ diff: "--- a/file\n+++ b/file\n@@ -1 +1 @@\n-old\n+new\n" }), true);
  assert.equal(isApplicablePatchDraft({ diff: "--- /dev/null\n+++ PATCH_DRAFT_PENDING\n@@\n+placeholder\n" }), false);
  assert.equal(isApplicablePatchDraft({ diff: "not a diff" }), false);
});

test("resolves short follow-ups against the pending action", () => {
  const pendingAction = { id: "a1", taskId: "t1", type: "confirm-active-task" };
  assert.equal(resolveConversationCommand({ message: "好", pendingAction }).command, conversationCommands.confirmAction);
  assert.equal(resolveConversationCommand({ message: "然后呢", pendingAction }).command, conversationCommands.inspectAction);
  assert.equal(resolveConversationCommand({ message: "不用了", pendingAction }).command, conversationCommands.cancelAction);
});

test("derives the visible runtime state from machine facts", () => {
  assert.equal(conversationRuntimeState({ loading: true }).state, conversationStates.thinking);
  assert.equal(conversationRuntimeState({ activeTask: { status: "running" } }).state, conversationStates.executing);
  assert.equal(conversationRuntimeState({
    activeTask: { status: "planned" },
    turns: [{ outcome: "running", role: "assistant" }],
  }).state, conversationStates.executing);
  assert.equal(conversationRuntimeState({
    turns: [{ outcome: "awaiting-confirmation", role: "assistant" }],
  }).state, conversationStates.awaitingConfirmation);
});

test("detects duplicate submissions inside the guard window", () => {
  assert.equal(isDuplicateSubmission({ key: "same", at: 100 }, { key: "same", at: 500 }), true);
  assert.equal(isDuplicateSubmission({ key: "same", at: 100 }, { key: "same", at: 1500 }), false);
});

test("classifies cancel, continue, and redirect while a request is running", () => {
  assert.equal(resolveRequestTakeover("停止", { running: true }).decision, "cancel");
  assert.equal(resolveRequestTakeover("继续原任务", { running: true }).decision, "continue-current");
  assert.equal(resolveRequestTakeover("改成只做桌面端", { running: true }).decision, "redirect");
  assert.equal(resolveRequestTakeover("补充：不要改 UI", { running: true }).decision, "redirect");
  assert.equal(resolveRequestTakeover("改成只做桌面端", { running: false }).decision, "none");
});

test("prepares one submission contract outside React", () => {
  const result = prepareConversationSubmission({ message: "运行一轮检查", now: 100, random: 0.5 });
  assert.equal(result.requestId, "100-8");
  assert.equal(result.command.command, conversationCommands.executeAction);
  assert.equal(result.command.action.id, "run-check");
  assert.equal(result.userTurn.submissionId, result.requestId);
  assert.equal(result.userTurn.text, "运行一轮检查");
});

test("rejects unknown actions and illegal state transitions", () => {
  assert.equal(conversationActionDefinition({ id: "unknown" }), null);
  assert.equal(conversationActionDefinition({ id: "confirm-active-task" }).kind, "command");
  assert.equal(conversationActionDefinition({ id: "create-stage-goal" }).risk, "writes-governance");
  assert.equal(transitionConversationState(conversationStates.thinking, "requireConfirmation"), conversationStates.awaitingConfirmation);
  assert.throws(() => transitionConversationState(conversationStates.cancelled, "confirm"), /illegal conversation transition/);
});

test("migrates and recovers interrupted conversation records", () => {
  const pendingAction = { id: "apply-1", taskId: "task-1", type: "apply-patch" };
  const migrated = migrateConversationRecord({
    id: "c1",
    summary: { currentTopic: "修复对话接管", pendingAction },
    turns: [
      { id: "user-1", role: "user", text: "修复对话接管" },
      {
        id: "assistant-1",
        outcome: "running",
        pendingAction,
        role: "assistant",
        taskId: "task-1",
        text: "正在处理",
      },
    ],
  });
  assert.equal(migrated.schemaVersion, "omnidesk.conversation.v0.3");
  assert.equal(migrated.summary.version, "omnidesk.turn-summary.v0.1");
  const recovered = recoverConversationRuntime({ ...migrated, runtimeState: "executing" });
  assert.equal(recovered.recoveryReason, "interrupted");
  assert.deepEqual(recovered.recoveryAction, { id: "retry", label: "重试", task: "修复对话接管" });
  assert.equal(recovered.runtimeState, "failed");
  assert.equal(recovered.summary.pendingAction, null);
  assert.equal(recovered.turns.at(-1).outcome, "failed");
  assert.equal(recovered.turns.at(-1).pendingAction, null);
  assert.equal(recovered.turns.at(-1).resolvedActionId, "apply-1");
  assert.deepEqual(recovered.turns.at(-1).actions, [
    { id: "retry", label: "重试", task: "修复对话接管" },
    { id: "open-topic", label: "查看任务", target: "execution", taskId: "task-1" },
  ]);
});

test("does not mark a confirmed task waiting for its next action as interrupted", () => {
  const migrated = migrateConversationRecord({
    id: "c-waiting",
    runtimeState: "executing",
    summary: { currentTopic: "创建 smoke 文件", pendingAction: { id: "confirm-task-1", type: "confirm-active-task" } },
    turns: [{
      actions: [{ id: "generate-patch", label: "生成改动草稿", taskId: "task-1" }],
      outcome: "running",
      pendingAction: null,
      role: "assistant",
      taskId: "task-1",
      text: "已确认执行计划，当前等待生成改动。",
    }],
  });
  const recovered = recoverConversationRuntime(migrated);
  assert.equal(recovered.runtimeState, "awaiting-confirmation");
  assert.equal(recovered.summary.pendingAction, null);
  assert.equal(recovered.turns[0].outcome, "awaiting-confirmation");
  assert.deepEqual(recovered.turns[0].actions, [{ id: "generate-patch", label: "生成改动草稿", taskId: "task-1" }]);
});

test("normalizes references and projects execution into one assistant turn", () => {
  assert.equal(normalizeConversationReferences([
    { kind: "file", target: "A" },
    { kind: "file", target: "A" },
  ]).length, 1);
  const turns = projectExecutionEvent([{ id: "a1", requestId: "r1", role: "assistant", text: "旧" }], {
    requestId: "r1", text: "新", outcome: "running",
  });
  assert.equal(turns.length, 1);
  assert.equal(turns[0].text, "新");
});

test("projects conversation action fields for the next governed step", () => {
  const turns = projectExecutionEvent([{ id: "a1", requestId: "r1", role: "assistant", text: "草稿中" }], {
    actions: [{ id: "apply-patch", label: "确认应用改动", taskId: "task-1" }],
    pendingAction: { id: "apply-1", taskId: "task-1", type: "apply-patch" },
    requestId: "r1",
    taskId: "task-1",
    text: "草稿已生成",
  });
  assert.equal(turns[0].taskId, "task-1");
  assert.equal(turns[0].pendingAction.type, "apply-patch");
  assert.equal(turns[0].actions[0].id, "apply-patch");
});

test("keeps one stable timeline and advances the prior current step", () => {
  const events = mergeExecutionEvents([
    { id: "understand", label: "理解请求", status: "done" },
    { id: "confirmation", label: "等待确认", status: "current" },
  ], [
    { id: "execution-ready", label: "等待生成改动", status: "current" },
  ]);
  assert.deepEqual(events.map((event) => [event.id, event.status]), [
    ["understand", "done"],
    ["confirmation", "done"],
    ["execution-ready", "current"],
  ]);
  assert.equal(mergeExecutionEvents(events, [{ id: "execution-ready", status: "done" }]).length, 3);
});

test("preserves timeline and duration when an execution event only updates text", () => {
  const turns = projectExecutionEvent([{
    durationMs: 14000,
    events: [{ id: "confirmation", status: "current" }],
    id: "a1",
    requestId: "r1",
    role: "assistant",
    text: "等待确认",
  }], { requestId: "r1", text: "仍在等待", outcome: "running" });
  assert.equal(turns[0].durationMs, 14000);
  assert.deepEqual(turns[0].events, [{ id: "confirmation", status: "current" }]);
});

test("uses one normalized error contract", () => {
  assert.deepEqual(conversationError("timeout", "15s"), {
    detail: "15s", message: "响应超时，已停止等待。", recoverable: true, type: "timeout",
  });
});

test("runs the task conversation lifecycle without duplicating the assistant turn", () => {
  const submission = prepareConversationSubmission({ message: "设计一个对话状态组件", now: 100, random: 0.5 });
  assert.equal(submission.command.command, conversationCommands.startPlan);

  const pendingAction = { id: "confirm-task-1", taskId: "task-1", type: "confirm-active-task" };
  const awaitingTurns = [
    submission.userTurn,
    { id: "assistant-1", pendingAction, requestId: submission.requestId, role: "assistant", text: "计划已生成" },
  ];
  assert.equal(conversationRuntimeState({ turns: awaitingTurns }).state, conversationStates.awaitingConfirmation);

  const confirmation = prepareConversationSubmission({
    activeTask: { id: "task-1", status: "planned" },
    message: "好",
    now: 200,
    random: 0.5,
    turns: awaitingTurns,
  });
  assert.equal(confirmation.command.command, conversationCommands.confirmAction);

  const executing = projectExecutionEvent(awaitingTurns, {
    requestId: submission.requestId,
    outcome: "running",
    text: "正在执行基础检查",
  });
  const completed = projectExecutionEvent(executing, {
    requestId: submission.requestId,
    outcome: "succeeded",
    text: "基础检查已通过",
  });
  assert.equal(completed.length, awaitingTurns.length);
  assert.equal(completed.find((turn) => turn.role === "assistant").text, "基础检查已通过");
});

test("dispatches commands and registered actions without UI condition chains", async () => {
  const command = await dispatchConversationCommand({ command: conversationCommands.answer }, {
    [conversationCommands.answer]: async () => "answered",
  });
  assert.deepEqual(command, { handled: true, result: "answered" });
  assert.equal(await executeRegisteredConversationAction({ id: "retry", task: "x" }, {
    retry: async () => true,
  }), true);
  assert.deepEqual(await executeRegisteredConversationAction({ checkId: "runtime", id: "run-check" }, {
    "run-check": async () => ({ id: "runtime", success: true }),
  }), { id: "runtime", success: true });
  assert.equal(await executeRegisteredConversationAction({ id: "unknown" }, {}), false);
});

test("executes a safe check command without creating a plan or pending confirmation", async () => {
  const submission = prepareConversationSubmission({ message: "运行一轮基础检查", now: 300, random: 0.5 });
  let executedAction = null;
  const dispatched = await dispatchConversationCommand(submission.command, {
    [conversationCommands.executeAction]: async (command) => {
      executedAction = command.action;
      return executeRegisteredConversationAction(command.action, {
        "run-check": async () => ({ id: "runtime", output: "0 warnings", success: true }),
      });
    },
  });
  assert.equal(dispatched.handled, true);
  assert.deepEqual(executedAction, { checkId: "runtime", id: "run-check" });
  assert.deepEqual(dispatched.result, { id: "runtime", output: "0 warnings", success: true });
  assert.equal(submission.pendingAction, null);
});

test("adapts Workbench plan, patch, and check services for the action executor", async () => {
  const calls = [];
  const activeRequests = new Set(["request-active"]);
  const generatePlan = async (input) => ({ input, status: "succeeded" });
  const adapters = createConversationActionAdapters({
    generatePlan,
    isRequestActive: (requestId) => activeRequests.has(requestId),
    runAction: async (action) => {
      calls.push(action);
      return { success: true };
    },
  });

  assert.equal(adapters.generatePlan, generatePlan);
  await adapters.generatePatch({
    action: { id: "generate-patch", task: "original task" },
    requestId: "request-active",
    task: { id: "task-1" },
  });
  assert.deepEqual(
    { ...calls[0], isActive: calls[0].isActive() },
    {
      id: "generate-patch",
      isActive: true,
      requestId: "request-active",
      task: { id: "task-1" },
    },
  );
  activeRequests.delete("request-active");
  assert.equal(calls[0].isActive(), false);

  await adapters.runCheck({ action: { checkId: "runtime", id: "run-check" }, requestId: "request-check" });
  assert.deepEqual(calls[1], { checkId: "runtime", id: "run-check", requestId: "request-check" });

  await adapters.startAgent({ task: { id: "task-agent" } });
  assert.deepEqual(calls[2], { id: "confirm-active-task", task: { id: "task-agent" }, taskId: "task-agent" });
});

test("projects a generated plan through the runtime executor", async () => {
  const progress = [];
  let planInput = null;
  const result = await executeConversationActionRequest({
    action: { id: "generate-plan", task: "拆解任务" },
    adapters: {
      generatePlan: async (input) => {
        planInput = input;
        input.onProgress({ label: "保存任务", stage: "persist" });
        return { status: "succeeded", task: { id: "task-1" }, taskId: "task-1" };
      },
    },
    context: {
      attachments: [{ dataUrl: "data:image/png;base64,x", mimeType: "image/png", name: "screen.png" }],
      conversationId: "conversation-1",
      displayTask: "当前主题",
      input: "拆解任务",
      requestId: "request-1",
      startedAt: 100,
    },
    now: () => 200,
    onProgress: (event) => progress.push(event),
  });
  assert.equal(result.requestStatus, "succeeded");
  assert.equal(result.turn.pendingAction.type, "confirm-active-task");
  assert.equal(result.turn.actions[0].taskId, "task-1");
  assert.equal(result.turn.taskId, "task-1");
  assert.equal(progress.at(-1).label, "保存任务");
  assert.equal(planInput.conversationId, "conversation-1");
  assert.equal(planInput.displayTask, "当前主题");
  assert.equal(planInput.attachments[0].name, "screen.png");
});

test("keeps a preview patch draft read-only in the runtime executor", async () => {
  const result = await executeConversationActionRequest({
    action: { id: "generate-patch", task: "修改按钮" },
    adapters: {
      generatePlan: async () => ({ status: "succeeded", task: { id: "task-2" }, taskId: "task-2" }),
      generatePatch: async () => ({ patchDraft: { diff: "--- /dev/null\n+++ PATCH_DRAFT_PENDING\n@@\n+placeholder\n" }, success: true }),
    },
    context: { input: "修改按钮", requestId: "request-2", startedAt: 100 },
    now: () => 200,
  });
  assert.equal(result.requestStatus, "succeeded");
  assert.equal(result.turn.pendingAction, null);
  assert.deepEqual(result.turn.actions, [{ id: "open-topic", label: "查看改动草稿", target: "execution", taskId: "task-2" }]);
});

test("starts Hermes directly when an engineering request needs a user decision", async () => {
  let startedTask = null;
  const task = { id: "task-question" };
  const result = await executeConversationActionRequest({
    action: { id: "start-agent", task: "先用表单询问我" },
    adapters: {
      generatePlan: async () => ({ status: "succeeded", task, taskId: task.id }),
      startAgent: async ({ task: nextTask }) => {
        startedTask = nextTask;
        return true;
      },
    },
    context: { input: "先用表单询问我", requestId: "request-question", startedAt: 100 },
    now: () => 200,
  });
  assert.equal(startedTask, task);
  assert.equal(result.requestStatus, "succeeded");
  assert.equal(result.turn.taskId, task.id);
  assert.match(result.turn.text, /当前对话中询问/);
});

test("requires confirmation for an applicable patch in the runtime executor", async () => {
  const result = await executeConversationActionRequest({
    action: { id: "generate-patch", task: "修改按钮" },
    adapters: {
      generatePlan: async () => ({ status: "succeeded", task: { id: "task-3" }, taskId: "task-3" }),
      generatePatch: async () => ({ patchDraft: { diff: "--- a/file\n+++ b/file\n@@ -1 +1 @@\n-old\n+new\n" }, success: true }),
    },
    context: { input: "修改按钮", requestId: "request-3", startedAt: 100 },
    now: () => 200,
  });
  assert.equal(result.requestStatus, "succeeded");
  assert.equal(result.turn.outcome, "awaiting-confirmation");
  assert.equal(result.turn.pendingAction.type, "apply-patch");
  assert.deepEqual(result.turn.actions, [
    { id: "open-topic", label: "查看 AI 建议的改动", target: "execution", taskId: "task-3" },
    { id: "apply-patch", label: "确认应用改动", taskId: "task-3" },
  ]);
  assert.match(result.turn.text, /请先查看内容/);
});

test("projects guarded check evidence through the runtime executor", async () => {
  const result = await executeConversationActionRequest({
    action: { checkId: "runtime", id: "run-check" },
    adapters: { runCheck: async () => ({ output: "Result: completed with 0 warning(s).", success: true }) },
    context: { input: "运行检查", requestId: "request-3", startedAt: 100 },
    now: () => 200,
  });
  assert.equal(result.requestStatus, "succeeded");
  assert.equal(result.turn.references[0].target, "desktop/package.json");
  assert.match(result.turn.text, /未发现 Runtime 文档告警/);
});

test("settles unexpected adapter errors as a recoverable failure turn", async () => {
  const result = await executeConversationActionRequest({
    action: { id: "generate-plan", task: "拆解任务" },
    adapters: { generatePlan: async () => { throw new Error("provider disconnected"); } },
    context: { input: "拆解任务", requestId: "request-4", startedAt: 100 },
    now: () => 200,
  });
  assert.equal(result.requestStatus, "failed");
  assert.equal(result.turn.outcome, "failed");
  assert.equal(result.turn.pendingAction, null);
  assert.match(result.turn.diagnostic.detail, /provider disconnected/);
});
