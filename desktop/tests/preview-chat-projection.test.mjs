import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPreviewPlan,
  conversationDiagnosticForResult,
  loadingEventsForMessageKind,
  localStatusReply,
  previewChatResult,
} from "../src/lib/preview-chat-projection.js";

const taskStatuses = {
  done: "done",
  failed: "failed",
};

const previewInput = {
  activeGoalFromSnapshot: () => ({ title: "收口前端领域边界" }),
  isNoiseTask: (task) => task.title === "你好",
  phaseLabel: (phase) => ({ stabilizing: "打磨中" })[phase] || phase,
  taskStatuses,
};

test("preview projection produces a controlled task plan request", () => {
  const result = previewChatResult({
    ...previewInput,
    hasAttachments: false,
    message: "帮我优化任务流",
    snapshot: {},
    tasks: [],
  });
  assert.equal(result.intent, "task");
  assert.equal(result.shouldCreatePlan, true);
  assert.equal(result.reply, "可以，我整理成一个可执行计划。");
});

test("Preview plan stays read-only and preserves the requested project scope", () => {
  const plan = buildPreviewPlan({ task: "整理工作区文件" }, { projectName: "OmniDesk" });
  assert.equal(plan.task, "整理工作区文件");
  assert.equal(plan.projectName, "OmniDesk");
  assert.deepEqual(plan.candidateChanges, ["先不写文件，只形成下一步建议。"]);
  assert.deepEqual(plan.guardrails, ["不自动写文件。", "不自动运行命令。"]);
});

test("preview projection excludes noisy tasks from status summaries", () => {
  const result = previewChatResult({
    ...previewInput,
    hasAttachments: false,
    message: "当前状态怎么样",
    snapshot: { phase: "stabilizing", projectName: "OmniDesk" },
    tasks: [
      { title: "你好", status: "failed" },
      { title: "收口对话模块", status: "running" },
    ],
  });
  assert.match(result.reply, /收口对话模块/);
  assert.doesNotMatch(result.reply, /失败任务/);
});

test("preview loading and diagnostics retain their bounded fallback behavior", () => {
  assert.deepEqual(loadingEventsForMessageKind("task", (stage) => [{ label: stage, status: "current" }]), [
    { label: "understand", status: "current" },
  ]);
  assert.deepEqual(conversationDiagnosticForResult({ providerStatus: "unavailable", providerError: "连接超时" }, {}), {
    label: "模型连接未接通",
    message: "当前回复使用本地上下文生成。可在顶部连接状态里刷新模型，或继续直接提问。",
    detail: "连接超时",
  });
  assert.equal(conversationDiagnosticForResult({ providerStatus: "available" }, {}), null);
});

test("local connection fallback remains read-only and delegates non-status replies", () => {
  const reply = localStatusReply({
    activeProviderProfileName: () => "主连接",
    kind: "connection-status",
    provider: { model: "gpt-test" },
    providerHealth: { status: "network-unavailable" },
    previewResult: () => ({ reply: "本地预览" }),
    snapshot: {},
    tasks: [],
  });
  assert.match(reply, /网络异常/);
  assert.equal(localStatusReply({
    activeProviderProfileName: () => "主连接",
    kind: "chat",
    provider: {},
    providerHealth: {},
    previewResult: () => ({ reply: "本地预览" }),
    snapshot: {},
    tasks: [],
  }), "本地预览");
});
