function turnEvents(turn = {}) {
  return Array.isArray(turn.events) ? turn.events : [];
}

function timestampForTurn(turn = {}, fallback = 0) {
  const explicit = Date.parse(turn.createdAt || turn.requestedAt || "");
  if (Number.isFinite(explicit)) return explicit;
  const embedded = Number.parseInt(String(turn.id || "").match(/^\d+/)?.[0] || "", 10);
  return Number.isFinite(embedded) ? embedded : fallback;
}

export function conversationTranscriptItems(turns = [], interactions = []) {
  const turnItems = turns.map((turn, index) => ({
    key: turn.id,
    order: index,
    timestamp: timestampForTurn(turn, index),
    turn,
    type: "turn",
  }));
  return [
    ...turnItems,
    ...interactions.map(({ interaction, run }, index) => {
      const interactionTimestamp = timestampForTurn({ createdAt: interaction.requestedAt }, turns.length + index);
      const owner = turnItems.find((item) => item.turn?.role === "assistant" && item.turn?.taskId === run?.taskId);
      return {
      interaction,
      key: `interaction-${run.id}-${interaction.id}`,
      order: turns.length + index,
      run,
      // The turn is persisted after a long-running Agent call returns. Keep its
      // follow-up form with that task even when the form was emitted mid-call.
      timestamp: owner ? Math.max(interactionTimestamp, owner.timestamp + 1) : interactionTimestamp,
      type: "interaction",
      };
    }),
  ].sort((left, right) => left.timestamp - right.timestamp || left.order - right.order);
}

export function conversationReadonlyPlanTaskId(turn = {}) {
  const taskId = String(turn.taskId || turn.pendingAction?.taskId || "");
  if (!taskId) return "";
  if (turn.pendingAction?.type === "confirm-active-task") return taskId;
  const confirmation = turnEvents(turn).find((event) => event.id === "confirmation");
  return confirmation?.status === "current" ? taskId : "";
}

export function hasPendingAgentInteraction(turn = {}, interactions = []) {
  return interactions.some(({ interaction, run } = {}) => (
    run?.status === "awaiting-user-input"
    && interaction?.status === "pending"
    && run?.taskId
    && run.taskId === turn.taskId
  ));
}

export function hasActiveAgentRun(turn = {}, interactions = []) {
  return interactions.some(({ run } = {}) => (
    run?.taskId
    && run.taskId === turn.taskId
    && ["queued", "running", "awaiting-user-input", "awaiting-approval", "applying", "running-tool", "verifying"].includes(run.status)
  ));
}

export function agentRunForTurn(turn = {}, runs = []) {
  const taskId = String(turn.taskId || "");
  if (!taskId) return null;
  return runs
    .filter((run) => run?.taskId === taskId)
    .sort((left, right) => String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || "")))[0] || null;
}

export function composerResponseForPendingInteraction(interactions = [], text = "", attachmentCount = 0) {
  const pending = interactions.filter(({ interaction, run } = {}) => (
    run?.status === "awaiting-user-input" && interaction?.status === "pending"
  ));
  const fields = pending[0]?.interaction?.fields;
  if (pending.length !== 1 || attachmentCount > 0 || !String(text).trim() || !Array.isArray(fields) || fields.length !== 1 || fields[0]?.type !== "text") return null;
  return {
    response: { action: "submit", answers: { [fields[0].id]: String(text).trim() } },
    ...pending[0],
  };
}

function boundedFailureSummary(run = {}) {
  const value = String(run.summary || run.checkpoint?.contextSummary || "").split(/；Hermes:|\n/)[0].trim();
  return value.slice(0, 240);
}

function answerLabel(interaction = {}, field = {}, answer) {
  if (Array.isArray(answer)) return answer.map((item) => answerLabel(interaction, field, item)).join("、");
  const option = (field.options || []).find((item) => item.value === answer);
  return String(option?.label || answer || "未填写").trim();
}

export function agentInteractionAnswerSummary(interaction = {}) {
  const answers = interaction.response?.answers || {};
  const parts = (interaction.fields || []).flatMap((field) => {
    const answer = answers[field.id];
    return answer === undefined || answer === "" || (Array.isArray(answer) && !answer.length)
      ? []
      : [`${field.label}：${answerLabel(interaction, field, answer)}`];
  });
  return parts.join("；");
}

function friendlyFailureReason(run = {}) {
  const detail = boundedFailureSummary(run);
  if (/ACP 请求超时/.test(detail)) return "等待 Agent 响应超时。";
  if (/请求已取消|取消/.test(detail)) return "本次执行已取消。";
  return detail || "Agent 未能从该回答继续执行。";
}

function evidenceTime(value) {
  const time = Date.parse(value || "");
  return Number.isFinite(time) ? time : null;
}

function toolActivityPresentation(event = {}) {
  const name = String(event.details?.name || "");
  if (name === "git_status") return { detail: "只读取当前改动状态，不会修改文件。", label: "读取项目状态（只读）" };
  if (name === "list_files") return { detail: "只查看项目文件列表，不会修改文件。", label: "读取项目文件列表（只读）" };
  if (name === "read_file") return { detail: "只读取文件内容，不会修改文件。", label: "读取项目文件（只读）" };
  if (name === "search_project") return { detail: "只搜索项目内容，不会修改文件。", label: "搜索项目内容（只读）" };
  if (["apply_patch", "integrate_worktree"].includes(name)) return { detail: "需要你单独确认后才会修改工程文件。", label: "准备修改工程文件" };
  if (name === "run_check") return { detail: "需要你单独确认后才会运行检查；不会直接修改文件。", label: "准备运行基础检查" };
  if (name.startsWith("mcp_")) return { detail: "这是外部工具调用，需要你单独确认后才会执行。", label: "准备调用外部工具" };
  return { detail: name ? "该调用受运行规则限制；涉及修改或检查时仍需你的确认。" : "只读取完成当前任务所需的信息。", label: name ? `使用工具 ${name}` : "读取项目上下文（只读）" };
}

function runEventPresentation(event = {}, modelAttempt = 1) {
  const status = String(event.status || "");
  if (event.kind === "scheduling") return {
    detail: status === "queued" ? "已进入本地队列，轮到它后会自动开始。" : "Agent 已获得执行位置。",
    id: event.id,
    label: status === "queued" ? "正在排队" : "已开始处理",
    status: status === "queued" ? "current" : "done",
  };
  if (event.kind === "model") return {
    detail: status === "running" ? "正在了解任务和项目现状；你可以继续使用工作台。" : "",
    id: event.id,
    label: modelAttempt > 1 ? "正在继续处理" : "正在了解任务",
    status: status === "running" ? "current" : "done",
  };
  if (event.kind === "user-interaction") {
    if (status === "awaiting-user-input") return { detail: "需要你的选择后才能继续；这不会授权修改文件。", id: event.id, label: "等待你的回答", status: "current" };
    return { detail: "你的回答已保存，并准备继续处理。", id: event.id, label: "已保存你的选择", status: "done" };
  }
  if (event.kind === "result") return { detail: status === "failed" ? friendlyFailureReason({ summary: event.summary }) : "本轮处理已结束。", id: event.id, label: status === "failed" ? "本轮未完成" : "本轮处理完成", status: status === "failed" ? "failed" : "done" };
  return null;
}

function settledTimeline(events = [], terminal) {
  const latestCurrent = events.reduce((latest, event, index) => event?.status === "current" ? index : latest, -1);
  return events.map((event, index) => (
    event?.status === "current" && (terminal || index !== latestCurrent)
      ? { ...event, status: "done" }
      : event
  ));
}

function visibleToolEvidence(evidence = []) {
  return evidence.filter((event, index) => {
    if (event.kind === "tool-result") return true;
    if (event.kind !== "tool-call") return false;
    const name = String(event.details?.name || "");
    return !evidence.slice(index + 1).some((later) => later.kind === "tool-result" && String(later.details?.name || "") === name);
  });
}

// Runtime persists a compact event immediately while the Agent is working,
// then persists the complete event bundle when that model stage settles.
// Present both shapes through one projection so the conversation is live and
// does not regress to a generic spinner after completion.
function timelineEvidence(evidence = []) {
  return evidence.flatMap((event, eventIndex) => {
    const live = event?.details?.agentEvent;
    const completed = event?.details?.agentEvents;
    const embedded = Array.isArray(completed) ? completed : live ? [live] : null;
    if (!embedded) return [event];
    return embedded.map((agentEvent, index) => ({
      ...agentEvent,
      id: `${event.id || event.sequence || eventIndex}:agent-${agentEvent.sequence || index}`,
      recordedAt: event.recordedAt,
      kind: agentEvent.kind === "lifecycle" ? "model" : agentEvent.kind === "terminal" ? "result" : agentEvent.kind,
    }));
  });
}

export function agentRunActivityPresentation(run = {}) {
  const evidence = Array.isArray(run.evidence) ? run.evidence : [];
  const first = evidenceTime(evidence[0]?.recordedAt);
  const last = evidenceTime(evidence.at(-1)?.recordedAt);
  const failed = ["failed", "interrupted"].includes(run.status);
  const waiting = run.status === "awaiting-user-input";
  const terminal = ["failed", "interrupted", "succeeded", "cancelled"].includes(run.status);
  let modelAttempt = 0;
  const activityEvidence = timelineEvidence(evidence);
  const events = settledTimeline(activityEvidence.map((event) => {
    if (event.kind === "model") modelAttempt += 1;
    return runEventPresentation(event, modelAttempt);
  }).filter(Boolean), terminal);
  return {
    conversationEvents: visibleToolEvidence(activityEvidence).map((event) => {
      const tool = toolActivityPresentation(event);
      const completed = event.kind === "tool-result" && event.details?.success;
      return {
        actor: "tool",
        detail: completed ? `${tool.detail} 已完成。` : tool.detail,
        id: event.id,
        payload: { label: tool.label, toolName: event.details?.name },
        status: completed || terminal ? "done" : event.status === "failed" ? "failed" : "running",
        type: `tool.${event.kind}`,
      };
    }),
    durationMs: first !== null && last !== null ? Math.max(0, last - first) : 0,
    events,
    label: waiting ? "等待你的回答" : failed ? "本轮未完成" : run.status === "queued" ? "正在排队" : run.status === "awaiting-approval" ? "等待你的批准" : "正在读取项目",
    summary: waiting ? "等待你的回答" : failed ? "已处理，但本轮未完成" : run.status === "queued" ? "Agent 正在排队" : run.status === "awaiting-approval" ? "等待你批准下一步" : String(run.summary || "正在读取项目并分析任务").slice(0, 240),
  };
}

export function agentInteractionPresentation(interaction = {}, run = {}) {
  const submitted = interaction.status === "submitted";
  const skipped = interaction.response?.action === "skip";
  const failed = run.workflowFailed ?? ["failed", "interrupted"].includes(run.status);
  const answers = agentInteractionAnswerSummary(interaction);
  const failureReason = friendlyFailureReason(run);
  return {
    collapsed: submitted,
    detail: failed ? failureReason : "",
    label: failed ? "未完成" : skipped ? "已跳过" : submitted ? "已提交" : "等待你的回答",
    summary: failed
      ? `${skipped ? "已跳过此问题" : answers ? `已保存你的选择「${answers}」` : "回答已保存"}。${failureReason}${/ACP 请求超时/.test(boundedFailureSummary(run)) ? " 尚未开始后续工作，也没有修改文件。" : ""}`
      : skipped ? "已跳过此问题。" : submitted ? "回答已保存，Agent 已继续处理。" : "",
    tone: failed ? "failed" : submitted ? "complete" : "pending",
  };
}

export function projectConversationAgentEvents(turn = {}, interactions = []) {
  const waiting = interactions.some(({ run } = {}) => (
    run?.status === "awaiting-user-input"
    && run?.taskId
    && run.taskId === turn.taskId
  ));
  if (!waiting) return turnEvents(turn);
  return [
    ...turnEvents(turn).filter((event) => event.status !== "current"),
    {
      detail: "Agent 缺少继续执行所需的信息；回答不会授权写入文件或运行检查。",
      id: "user-interaction",
      label: "等待你的回答",
      status: "current",
    },
  ];
}

export function shouldShowConversationAgentTimeline(turn = {}, interactions = []) {
  // A readonly plan is a completed preparation step. Until the user confirms it,
  // its card is the only actionable status; execution progress would be premature.
  if (turn.pendingAction?.type === "confirm-active-task") return false;
  if (hasPendingAgentInteraction(turn, interactions)) return false;
  const events = projectConversationAgentEvents(turn, interactions);
  return Boolean(
    events.length
    && (turn.intent === "task" || turn.workflow?.length || events.some((event) => ["current", "failed"].includes(event.status)))
  );
}
