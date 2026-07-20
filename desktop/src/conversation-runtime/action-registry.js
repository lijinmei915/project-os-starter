const definitions = [
  { confirmation: "none", id: "generate-plan", kind: "command", risk: "read-only", targetRequired: false },
  { id: "confirm-active-task", kind: "command", targetRequired: false },
  { confirmation: "none", id: "generate-patch", kind: "command", risk: "read-only-draft", targetRequired: false },
  { confirmation: "required", id: "apply-patch", kind: "command", risk: "writes-files", targetRequired: true },
  { confirmation: "required", id: "create-stage-goal", kind: "command", risk: "writes-governance", targetRequired: false },
  { confirmation: "none", id: "run-check", kind: "command", risk: "read-only", targetRequired: true },
  { confirmation: "none", id: "create-repair-task", kind: "command", risk: "writes-task", targetRequired: true },
  { id: "open-reference", kind: "navigation", targetRequired: true },
  { id: "open-topic", kind: "navigation", targetRequired: true },
  { id: "cancel", kind: "lifecycle", targetRequired: false },
  { id: "retry", kind: "lifecycle", targetRequired: false },
];

export const conversationActionRegistry = Object.freeze(Object.fromEntries(definitions.map((item) => [item.id, Object.freeze(item)])));

export function conversationActionDefinition(action) {
  const definition = conversationActionRegistry[action?.id];
  if (!definition) return null;
  if (definition.targetRequired && !action.target && !action.taskId && !action.checkId) return null;
  return definition;
}

export function conversationActionDecision(message) {
  const text = String(message || "").trim();
  const compact = text.replace(/[。！？!?,，\s]/g, "").toLowerCase();
  const requestsExecution = /^(运行|执行|跑|开始)(一轮|一下|一次)?/.test(compact);
  const requestsBaseCheck = /(基础检查|runtime检查|运行时检查|检查runtime)/i.test(compact)
    || (requestsExecution && /^(运行|执行|跑)(一轮|一下|一次)?检查$/.test(compact));
  const requestsPatchDraft = !/(计划|方案|待办|分析|审查|检查|报告)/.test(compact)
    && /(帮我|请|直接|继续)?(改|修|优化|实现|新增|添加|删除|移除|接入|配置|调整|重构|做成)/.test(compact);
  const requestsPlan = !/(是什么|为什么|怎么|如何|风险|问题|进度|看看|看一下)/.test(compact)
    && (/(生成|制定|整理|创建).{0,16}(计划|方案|待办)/.test(compact)
      || /(帮我|请)?(给|出)(我)?(一份|一个|个)?(执行)?(计划|方案|待办)/.test(compact)
      || /(帮我|请)?(规划|拆解)(一下)?(这个|这项)?(任务|需求|工作)?/.test(compact));
  const action = requestsExecution && requestsBaseCheck
    ? { checkId: "runtime", id: "run-check" }
    : requestsPatchDraft
      ? { id: "generate-patch", task: text }
      : requestsPlan
        ? { id: "generate-plan", task: text }
        : null;
  if (!action) return null;
  const definition = conversationActionDefinition(action);
  return definition ? {
    action,
    confirmation: definition.confirmation,
    mode: "execute",
    risk: definition.risk,
  } : null;
}

export function isApplicablePatchDraft(patchDraft) {
  const diff = String(patchDraft?.diff || "");
  return patchDraft?.notApplicable !== true
    && !diff.includes("PATCH_DRAFT_PENDING")
    && /^---\s+\S+/m.test(diff)
    && /^\+\+\+\s+\S+/m.test(diff)
    && /^@@(?:\s|$)/m.test(diff);
}

export async function executeRegisteredConversationAction(action, handlers = {}) {
  const definition = conversationActionDefinition(action);
  if (!definition) return false;
  const handler = handlers[action.id];
  return handler ? await handler(action, definition) : false;
}
