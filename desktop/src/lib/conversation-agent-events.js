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
  return [
    ...turns.map((turn, index) => ({ key: turn.id, order: index, timestamp: timestampForTurn(turn, index), turn, type: "turn" })),
    ...interactions.map(({ interaction, run }, index) => ({
      interaction,
      key: `interaction-${run.id}-${interaction.id}`,
      order: turns.length + index,
      run,
      timestamp: timestampForTurn({ createdAt: interaction.requestedAt }, turns.length + index),
      type: "interaction",
    })),
  ].sort((left, right) => left.timestamp - right.timestamp || left.order - right.order);
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

export function agentInteractionPresentation(interaction = {}, run = {}) {
  const submitted = interaction.status === "submitted";
  const skipped = interaction.response?.action === "skip";
  const failed = run.workflowFailed ?? ["failed", "interrupted"].includes(run.status);
  return {
    collapsed: submitted,
    detail: failed ? boundedFailureSummary(run) || "Agent 未能从该回答继续执行。" : "",
    label: failed ? "未完成" : skipped ? "已跳过" : submitted ? "已提交" : "等待你的回答",
    summary: failed
      ? `${skipped ? "回答已跳过" : "回答已保存"}，Agent 继续执行时遇到问题。`
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
