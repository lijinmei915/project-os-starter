export function previewChatResult({
  activeGoalFromSnapshot,
  hasAttachments,
  isNoiseTask,
  message,
  phaseLabel,
  snapshot = {},
  taskStatuses,
  tasks = [],
  dialogueContext = {},
}) {
  const normalized = message.trim().replace(/[。！？!?,，\s]/g, "").toLowerCase();
  const lowerMessage = message.toLowerCase();
  const explicitTask = [
    "帮我改", "帮我修", "帮我优化", "帮我生成", "帮我创建", "帮我新增", "帮我删除",
    "帮我执行", "帮我跑", "开始执行", "生成计划", "创建任务", "改代码", "修复",
    "实现", "接入", "配置", "做成", "设计", "push", "提交", "应用 patch",
    "帮我处理", "处理一下", "解决一下", "看看解决", "看下解决", "整理一下",
    "梳理一下", "制定方案", "出个方案", "给个方案", "整理待办", "处理方案",
    "直接修", "直接改", "直接做", "你来处理", "你自己处理",
  ].some((keyword) => lowerMessage.includes(keyword));
  const greeting = ["hi", "hello", "hey", "你好", "您好", "哈喽", "嗨", "在吗", "在么"].includes(normalized);
  const questionLike = [
    "为什么", "怎么", "哪些", "还有哪些", "是什么", "吗", "呢", "看一下", "看看",
    "检查当前项目还有哪些风险", "有哪些风险",
  ].some((keyword) => message.includes(keyword));
  const shouldCreatePlan = explicitTask || (hasAttachments && !questionLike);
  const currentTopic = dialogueContext?.currentTopic || message;
  const riskLike = message.includes("风险") || lowerMessage.includes("risk") || currentTopic.includes("风险");
  const statusLike = /状态|进度|下一步|总结|概况|现在/.test(message);
  const developLike = /开发|改代码|实现|任务|执行|patch|检查|构建|验证/.test(lowerMessage);
  const visibleTasks = Array.isArray(tasks) ? tasks.filter((task) => !isNoiseTask(task)) : [];
  const stateFor = (task) => taskWorkflowState(task, taskStatuses);
  const activeTasks = visibleTasks.filter((task) => workflowStateIsActive(stateFor(task)));
  const failedTasks = visibleTasks.filter((task) => workflowStateIsFailure(stateFor(task)));
  const doneTasks = visibleTasks.filter((task) => workflowStateIsFinished(stateFor(task)));
  const activeGoal = activeGoalFromSnapshot(snapshot || {});
  const validationStatus = snapshot?.goalValidationReport?.status || "待生成";
  const changedFiles = snapshot?.workspaceFacts?.git?.changedFiles || snapshot?.git?.changedFiles || [];
  const projectName = snapshot?.projectName || snapshot?.workspaceFacts?.project?.name || "当前项目";
  const phase = phaseLabel(snapshot?.phase || snapshot?.workspaceFacts?.project?.lifecycle || "stabilizing");
  const currentFocus = activeTasks[0]?.title || activeGoal?.shortTitle || activeGoal?.title || "把工作台能力继续接到真实项目治理闭环";
  const nextAction = failedTasks.length
    ? `优先处理 ${failedTasks.length} 个失败任务，再继续推进当前开发任务。`
    : activeTasks.length
      ? `先推进「${activeTasks[0].title}」，完成后运行基础检查。`
      : "先从当前目标创建一个小任务，再进入 Patch、验证和交接闭环。";
  const statusReply = `${projectName} 处在「${phase}」阶段，当前焦点是「${currentFocus}」；下一步建议：${nextAction}`;
  const developReply = `开发流程建议按四步走：先把需求生成任务计划，再看 Patch 草案，确认后应用改动，最后运行检查并沉淀交接。当前任务 ${visibleTasks.length} 个，已完成 ${doneTasks.length} 个，验收状态为 ${validationStatus}。`;
  const followUpReply = dialogueContext?.expectedNextAction === "recommend-next"
    ? `建议按这个顺序处理：先推进「${currentFocus}」；然后运行目标验收并处理失败项；最后审阅剩余 Git 变更，确认是否可以交付。`
    : dialogueContext?.expectedNextAction === "decide-next"
      ? `我判断先推进「${currentFocus}」。它是当前最直接的阻塞点，完成后立即运行目标验收，再决定是否处理其他风险。`
      : "";
  const references = riskLike
    ? [
      { kind: "file", label: "项目状态", target: "PROJECT.md" },
      { kind: "file", label: "任务清单", target: ".omnidesk/data/task-backlog.json" },
    ]
    : statusLike
      ? [
        { kind: "file", label: "项目状态", target: "PROJECT.md" },
        { kind: "file", label: "当前交接", target: "HANDOFF.md" },
      ]
      : developLike
        ? [{ kind: "file", label: "任务清单", target: ".omnidesk/data/task-backlog.json" }]
        : [];
  return {
    intent: shouldCreatePlan ? "task" : questionLike ? "question" : "chat",
    reply: shouldCreatePlan
      ? "可以，我整理成一个可执行计划。"
      : followUpReply
        ? followUpReply
        : greeting
          ? "你好，我在。"
          : riskLike
            ? `当前可确认的风险有三项：还有 ${activeTasks.length} 个活跃或待确认任务；Git 工作区有 ${changedFiles.length} 个变更文件；目标验收状态为 ${validationStatus}。建议先处理失败或进行中的任务，再运行目标验收，最后确认剩余 Git 变更是否属于本轮交付。`
            : statusLike
              ? statusReply
              : developLike
                ? developReply
                : "我可以直接回答项目问题；如果你说“帮我改/实现/优化”，我会先生成任务计划，再进入受控开发流程。",
    references,
    shouldCreatePlan,
  };
}

export function buildPreviewPlan(input, snapshot = {}) {
  const task = displayText(input?.task, "未命名任务").trim() || "未命名任务";
  return {
    task,
    projectName: snapshot.projectName,
    mode: "plan",
    summary: `我会先围绕「${task}」理清范围，再给出最小下一步。`,
    steps: [
      "确认用户真正想解决的问题。",
      "读取当前项目状态和交接记录。",
      "列出最小可执行改动和风险。",
      "用户确认后再进入具体改动和检查。",
    ],
    filesToRead: ["PROJECT.md", "HANDOFF.md", "AGENTS.md"],
    candidateChanges: ["先不写文件，只形成下一步建议。"],
    checks: ["npm --prefix desktop test"],
    guardrails: ["不自动写文件。", "不自动运行命令。"],
    trace: ["PREVIEW: browser-only local plan."],
  };
}

function displayText(value, fallback = "") {
  if (typeof value === "string") return value;
  if (value == null) return fallback;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function loadingLabelForMessageKind(kind) {
  return {
    "connection-status": "检查连接状态",
    "model-status": "读取模型状态",
    "project-inspect": "检查项目风险",
    "project-status": "整理项目状态",
    question: "组织回答",
    "stage-goal": "识别阶段目标",
    chat: "组织回答",
    task: "整理计划",
  }[kind] || "组织回答";
}

export function loadingEventsForMessageKind(kind, planProgressEvents) {
  if (kind === "project-inspect") {
    return [
      { label: "读取项目状态", status: "current" },
      { label: "检查风险线索", status: "pending" },
      { label: "汇总回答", status: "pending" },
    ];
  }
  if (kind === "project-status") {
    return [
      { label: "读取项目状态", status: "current" },
      { label: "整理进度", status: "pending" },
    ];
  }
  if (kind === "model-status" || kind === "connection-status") {
    return [
      { label: "读取连接配置", status: "current" },
      { label: "查看健康状态", status: "pending" },
    ];
  }
  if (kind === "task") return planProgressEvents("understand");
  return [
    { label: "读取上下文", status: "current" },
    { label: "组织回答", status: "pending" },
  ];
}

export function agentEventsForMessageKind(kind, chatResult, createAgentEvent) {
  const events = [];
  if (kind === "project-inspect") {
    events.push(createAgentEvent("context", "done", "读取项目状态", "已结合当前项目阶段、目标、任务和治理记录。"));
    events.push(createAgentEvent("check", "done", "检查风险线索", "优先查看交接膨胀、执行状态、模型连接和验证反馈。"));
    events.push(createAgentEvent("result", "done", "汇总风险回答", "已把结果整理成可读回复。"));
  } else if (kind === "project-status") {
    events.push(createAgentEvent("context", "done", "读取项目状态", "已读取当前项目、目标、任务和验收状态。"));
    events.push(createAgentEvent("result", "done", "整理项目状态", "已生成当前状态摘要。"));
  } else if (kind === "model-status") {
    events.push(createAgentEvent("context", "done", "读取模型配置", "已读取当前连接、模型名称和健康状态。"));
  } else if (kind === "connection-status") {
    events.push(createAgentEvent("context", "done", "读取连接状态", "已读取当前模型连接健康状态。"));
  } else if (kind === "question" || kind === "chat") {
    events.push(createAgentEvent("thinking", "done", "组织回答", "已按当前对话上下文生成回复。"));
  }
  if (["interrupted", "request-failed", "timed-out"].includes(chatResult?.providerStatus)) {
    const label = chatResult.providerStatus === "interrupted" ? "回答生成中断" : chatResult.providerStatus === "timed-out" ? "本轮响应超时" : "本轮请求失败";
    events.push(createAgentEvent("error", "failed", label, chatResult.providerError || "本轮请求没有完整结束。"));
  } else if (chatResult?.providerStatus && chatResult.providerStatus !== "available") {
    events.push(createAgentEvent("error", "failed", "模型连接未接通", chatResult.providerError || "Provider 暂时不可用，已切换为本地上下文回复。"));
  }
  return events;
}

export function localStatusReply({ activeProviderProfileName, kind, provider, providerHealth, previewResult, snapshot, tasks }) {
  const modelName = provider?.model || "未选择模型";
  const connectionName = activeProviderProfileName(provider) || "当前连接";
  const healthStatus = providerHealth?.status || "unknown";
  if (kind === "model-status") {
    if (!provider?.enabled) return `当前没有启用模型连接。已配置模型是 ${modelName}，但对话会先使用本地项目上下文。`;
    if (healthStatus === "available") return `当前使用的模型是 ${modelName}，连接为「${connectionName}」，状态可用。`;
    if (healthStatus === "quota-exhausted") return `当前连接「${connectionName}」额度不足，系统会尝试已保存的其它可用连接；暂时无法切换时我会先用本地上下文回答。`;
    if (healthStatus === "authentication-failed") return `当前连接「${connectionName}」认证失败，请检查 Key；我会先用本地上下文回答。`;
    if (healthStatus === "model-unavailable") return `当前连接「${connectionName}」不支持模型 ${modelName}，请切换模型或连接。`;
    if (healthStatus === "network-unavailable") return `当前连接「${connectionName}」网络暂时不可用，我会先用本地上下文回答。`;
    if (healthStatus === "unavailable") return `当前配置的模型是 ${modelName}，连接为「${connectionName}」，但刚才检测不可用。我会先用本地上下文回答。`;
    return `当前配置的模型是 ${modelName}，连接为「${connectionName}」。可用性还在检测中，我会先按本地上下文回答。`;
  }
  if (kind === "connection-status") {
    if (healthStatus === "available") return `模型连接现在是可用状态：${modelName}。`;
    if (healthStatus === "quota-exhausted") return `模型连接额度不足：${modelName}。系统会尝试已保存的可用连接。`;
    if (healthStatus === "authentication-failed") return `模型连接认证失败：${modelName}。请检查当前连接的 Key。`;
    if (healthStatus === "model-unavailable") return `当前连接不支持模型：${modelName}。请切换模型或连接。`;
    if (healthStatus === "network-unavailable") return `模型连接网络异常：${modelName}。恢复前会继续使用本地上下文。`;
    if (healthStatus === "unavailable") return `模型连接还没恢复：${modelName} 当前不可用。你可以刷新模型连接；在此之前我会继续用本地上下文回答。`;
    return `我不能直接判断整台机器的网络，但当前模型连接还没有明确可用结果。你可以刷新顶部连接状态，或继续问项目问题。`;
  }
  return previewResult({ message: "", hasAttachments: false, snapshot, tasks }).reply;
}

export function conversationDiagnosticForResult(chatResult, providerHealth) {
  if (!chatResult?.providerStatus || chatResult.providerStatus === "available") return null;
  if (["interrupted", "request-failed", "timed-out"].includes(chatResult.providerStatus)) {
    return {
      label: chatResult.providerStatus === "interrupted" ? "回答生成中断" : chatResult.providerStatus === "timed-out" ? "本轮响应超时" : "本轮请求失败",
      message: "这只影响当前回答，不代表 API Key 或模型连接失效。",
      detail: chatResult.providerError || "",
    };
  }
  return {
    label: "模型连接未接通",
    message: "当前回复使用本地上下文生成。可在顶部连接状态里刷新模型，或继续直接提问。",
    detail: chatResult.providerError || providerHealth?.message || "",
  };
}
import { taskWorkflowState, workflowStateIsActive, workflowStateIsFailure, workflowStateIsFinished } from "./workflow-state.js";
