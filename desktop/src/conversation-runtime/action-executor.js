import { conversationActionDefinition, executeRegisteredConversationAction, isApplicablePatchDraft } from "./action-registry.js";
import { guardedCheckCapability } from "./capabilities.js";

const terminalStatuses = new Set(["cancelled", "failed", "succeeded", "timed-out"]);

const planProgressStages = [
  { currentDetail: "正在识别当前请求和需要完成的动作。", doneDetail: "已识别为需要进入受控开发流程的任务。", id: "understand", label: "理解请求" },
  { currentDetail: "正在读取项目状态、目标和任务记录。", doneDetail: "已使用项目状态、目标和任务记录。", id: "context", label: "读取项目上下文" },
  { currentDetail: "正在把请求整理为可执行步骤和检查项。", doneDetail: "已生成执行步骤、影响范围和验证方式。", id: "generate", label: "生成执行计划" },
  { currentDetail: "正在持久化任务和请求追踪信息。", doneDetail: "计划已保存为本地任务。", id: "persist", label: "保存任务" },
  { currentDetail: "确认后进入改动和验证链路。", doneDetail: "已确认执行计划。", id: "confirmation", label: "计划待确认" },
];

const changeDraftStages = [
  { id: "context", label: "读取项目上下文" },
  { id: "generate", label: "生成执行计划" },
  { id: "persist", label: "保存任务" },
  { id: "patch", label: "生成改动草稿" },
  { id: "review", label: "等待确认应用" },
];

export function planProgressEvents(currentStage, detail = "", currentStatus = "current") {
  const currentIndex = planProgressStages.findIndex((stage) => stage.id === currentStage);
  return planProgressStages.map((stage, index) => {
    const status = index < currentIndex ? "done" : index === currentIndex ? currentStatus : "pending";
    return {
      detail: status === "done" ? stage.doneDetail : status === "pending" ? "" : detail || stage.currentDetail,
      id: stage.id,
      label: stage.label,
      status,
    };
  });
}

export function planningAgentEvents(status = "current", detail = "") {
  return planProgressEvents("generate", detail, status);
}

export function completedPlanAgentEvents() {
  return planProgressEvents("confirmation");
}

export function executionReadyAgentEvents() {
  return [
    { detail: "已确认执行计划。", id: "confirmation", label: "计划已确认", status: "done" },
    { detail: "任务已进入受控执行态，当前尚未改动文件。", id: "execution-ready", label: "等待生成改动", status: "current" },
  ];
}

export function checkProgressEvents(checkLabel, currentStage = "run", currentStatus = "current", detail = "") {
  const stages = [
    { detail: "已匹配受控检查能力，该动作不修改项目文件。", id: "resolve", label: "识别执行动作" },
    { detail: `已执行${checkLabel}。`, id: "run", label: `运行${checkLabel}` },
    { detail: "已将检查结果回流到当前对话。", id: "result", label: "汇总检查结果" },
  ];
  const currentIndex = stages.findIndex((stage) => stage.id === currentStage);
  return stages.map((stage, index) => {
    const status = index < currentIndex ? "done" : index === currentIndex ? currentStatus : "pending";
    return {
      detail: index === currentIndex && detail ? detail : status === "done" ? stage.detail : "",
      id: `direct-check-${stage.id}`,
      label: stage.label,
      status,
    };
  });
}

export function changeDraftProgressEvents(currentStage, currentStatus = "current", detail = "") {
  const currentIndex = changeDraftStages.findIndex((stage) => stage.id === currentStage);
  return changeDraftStages.map((stage, index) => ({
    detail: index === currentIndex ? detail : "",
    id: `change-draft-${stage.id}`,
    label: stage.label,
    status: index < currentIndex ? "done" : index === currentIndex ? currentStatus : "pending",
  }));
}

function checkOutputSummary(output = "") {
  const lines = String(output).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const resultLine = [...lines].reverse().find((line) => /^(Result:|Documentation structure valid:)/.test(line));
  const summary = (resultLine || lines.at(-1) || "").replace(/^Result:\s*/i, "").slice(0, 180);
  if (/completed with 0 warning\(s\)/i.test(summary)) return "未发现 Runtime 文档告警。";
  return summary;
}

function requestStatus(status) {
  return terminalStatuses.has(status) ? status : "failed";
}

function planInput(action, context, onProgress, autoContinue = false) {
  return {
    attachments: context.attachments || [],
    autoContinue,
    conversationId: context.conversationId,
    displayTask: context.displayTask || context.input,
    requestId: context.requestId,
    startedAt: new Date(context.startedAt).toISOString(),
    task: action.task || context.input,
    onProgress,
  };
}

function turnBase(context, suffix, now) {
  return {
    durationMs: now() - context.startedAt,
    id: `${now()}-assistant-${suffix}`,
    intent: "task",
    requestId: context.requestId,
    role: "assistant",
  };
}

async function executePlanAction(action, adapters, context, emitProgress, now) {
  emitProgress({ events: planProgressEvents("context"), label: "读取项目上下文" });
  const outcome = await adapters.generatePlan(planInput(action, context, ({ detail = "", label, stage }) => {
    emitProgress({ events: planProgressEvents(stage, detail), label });
  }));
  const status = requestStatus(outcome?.status);
  const succeeded = status === "succeeded" && Boolean(outcome?.taskId);
  const pendingAction = succeeded ? {
    id: `confirm-task-${outcome.taskId}`,
    requestId: context.requestId,
    taskId: outcome.taskId,
    type: "confirm-active-task",
  } : null;
  return {
    handled: true,
    requestStatus: status,
    turn: {
      ...turnBase(context, `plan-${status}`, now),
      actions: succeeded
        ? [{ id: "confirm-active-task", label: "确认并开始", taskId: outcome.taskId }]
        : [{ id: "retry", label: "重试", task: action.task || context.input }],
      diagnostic: succeeded ? null : {
        detail: outcome?.message || "计划生成失败。",
        label: status === "timed-out" ? "计划生成超时" : "计划没有生成成功",
        message: status === "cancelled" ? "计划生成已取消。" : "可以重试，或补充更具体的目标。",
      },
      events: succeeded ? completedPlanAgentEvents() : planningAgentEvents("failed", outcome?.message || "计划生成返回失败。"),
      outcome: status,
      pendingAction,
      taskId: outcome?.taskId || "",
      text: succeeded
        ? "执行计划已生成并保存。确认后才会进入改动流程。"
        : status === "cancelled"
          ? "计划生成已取消，没有继续执行。"
          : "这次计划没有生成成功，已停止后续操作。",
    },
  };
}

async function executePatchAction(action, adapters, context, emitProgress, now) {
  emitProgress({ events: changeDraftProgressEvents("context"), label: "读取项目上下文" });
  const planOutcome = await adapters.generatePlan(planInput(action, context, ({ detail = "", label, stage }) => {
    emitProgress({ events: changeDraftProgressEvents(stage, "current", detail), label });
  }, true));
  if (planOutcome?.status !== "succeeded" || !planOutcome.task) {
    const status = requestStatus(planOutcome?.status);
    return {
      handled: true,
      requestStatus: status,
      turn: {
        ...turnBase(context, "patch-plan-failed", now),
        events: changeDraftProgressEvents("generate", "failed", planOutcome?.message || "计划生成失败。"),
        outcome: status,
        text: "这次没有生成可用的改动计划，已停止后续操作。",
      },
    };
  }
  emitProgress({ events: changeDraftProgressEvents("patch"), label: "生成改动草稿" });
  const patchResult = await adapters.generatePatch({ action, requestId: context.requestId, task: planOutcome.task });
  const success = Boolean(patchResult?.success);
  const applicable = success && isApplicablePatchDraft(patchResult.patchDraft);
  const taskId = planOutcome.taskId || planOutcome.task.id;
  const pendingAction = applicable ? {
    id: `apply-task-${taskId || context.requestId}`,
    requestId: context.requestId,
    taskId,
    type: "apply-patch",
  } : null;
  return {
    handled: true,
    requestStatus: success ? "succeeded" : "failed",
    turn: {
      ...turnBase(context, "patch", now),
      actions: applicable
        ? [
          { id: "open-topic", label: "查看 AI 建议的改动", target: "execution", taskId },
          { id: "apply-patch", label: "确认应用改动", taskId },
        ]
        : [{ id: "open-topic", label: "查看改动草稿", target: "execution", taskId }],
      diagnostic: success ? null : {
        detail: patchResult?.error || "改动草稿生成失败。",
        label: "改动草稿生成失败",
        message: "计划任务已保留，可在任务详情中重试。",
      },
      events: changeDraftProgressEvents(
        applicable ? "review" : "patch",
        success ? (applicable ? "current" : "done") : "failed",
        applicable ? "草稿已就绪，确认后才会写入文件。" : patchResult?.error || "当前草稿尚不可应用。",
      ),
      outcome: applicable ? "awaiting-confirmation" : success ? "succeeded" : "failed",
      pendingAction,
      taskId,
      text: applicable
        ? "AI 已准备好建议的改动。请先查看内容；确认无误后再应用。"
        : success
          ? "已生成改动草稿，但当前还不是可应用的 diff，未提供写入操作。"
          : "改动草稿没有生成成功，未写入任何文件。",
    },
  };
}

async function executeCheckAction(action, adapters, context, emitProgress, now) {
  const check = guardedCheckCapability(action.checkId);
  if (!check) return { handled: false, requestStatus: "failed", turn: null };
  emitProgress({ events: checkProgressEvents(check.label), label: `运行${check.label}` });
  const result = await adapters.runCheck({ action, requestId: context.requestId });
  const success = Boolean(result?.success);
  const summary = checkOutputSummary(result?.output || result?.error);
  return {
    handled: true,
    requestStatus: success ? "succeeded" : "failed",
    turn: {
      ...turnBase(context, "check", now),
      diagnostic: success ? null : {
        detail: result?.output || result?.error || "检查执行失败。",
        label: `${check.label}未通过`,
        message: "检查已结束，可根据详细输出继续处理。",
      },
      events: checkProgressEvents(check.label, success ? "result" : "run", success ? "done" : "failed", summary),
      outcome: success ? "succeeded" : "failed",
      references: check.requiredPaths.map((target) => ({ kind: "file", label: "检查脚本", target })),
      text: success
        ? `${check.label}已通过。${summary ? ` ${summary}` : ""}`
        : `${check.label}未通过。${summary ? ` ${summary}` : "请查看详细输出。"}`,
    },
  };
}

function failedActionResult(action, context, error, now) {
  const message = error instanceof Error ? error.message : String(error || "动作执行失败。");
  const check = action?.id === "run-check" ? guardedCheckCapability(action.checkId) : null;
  const events = action?.id === "generate-patch"
    ? changeDraftProgressEvents("patch", "failed", message)
    : action?.id === "run-check"
      ? checkProgressEvents(check?.label || "检查", "run", "failed", message)
      : planningAgentEvents("failed", message);
  return {
    handled: true,
    requestStatus: "failed",
    turn: {
      ...turnBase(context, `${action?.id || "unknown"}-failed`, now),
      actions: action?.task ? [{ id: "retry", label: "重试", task: action.task }] : [],
      diagnostic: {
        detail: message,
        label: "动作执行失败",
        message: "当前请求已停止，可以重试。",
      },
      events,
      outcome: "failed",
      pendingAction: null,
      text: "这次动作没有执行完成，已停止后续操作。",
    },
  };
}

export async function executeConversationActionRequest({ action, adapters = {}, context = {}, onProgress, now = Date.now } = {}) {
  if (!conversationActionDefinition(action)) return { handled: false, requestStatus: "failed", turn: null };
  const emitProgress = (progress) => onProgress?.(progress);
  try {
    const result = await executeRegisteredConversationAction(action, {
      "generate-plan": (nextAction) => executePlanAction(nextAction, adapters, context, emitProgress, now),
      "generate-patch": (nextAction) => executePatchAction(nextAction, adapters, context, emitProgress, now),
      "run-check": (nextAction) => executeCheckAction(nextAction, adapters, context, emitProgress, now),
    });
    return result || failedActionResult(action, context, "当前动作没有可用执行器。", now);
  } catch (error) {
    return failedActionResult(action, context, error, now);
  }
}
