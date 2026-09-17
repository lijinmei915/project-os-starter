const toolNames = new Set(["read_file", "search_project", "list_files", "git_status"]);

function settleCurrent(events = []) {
  return events.map((event) => event.status === "current" ? { ...event, status: "done" } : event);
}

function appendCurrent(events, event) {
  const settled = settleCurrent(events);
  const existing = settled.findIndex((item) => item.id === event.id);
  if (existing < 0) return [...settled, event];
  return settled.map((item, index) => index === existing ? { ...item, ...event } : item);
}

function toolIdentity(payload = {}) {
  const details = payload.details || {};
  return `${details.name || "tool"}:${details.path || details.query || ""}`;
}

function toolText(payload = {}, completed = false) {
  const details = payload.details || {};
  const path = String(details.path || "");
  if (details.name === "read_file") return `${completed ? "已读取" : "正在读取"} ${path || "相关文件"}`;
  if (details.name === "search_project") return completed ? "已找到相关实现" : "正在查找相关实现";
  if (details.name === "list_files") return completed ? "已查看项目文件" : "正在查看项目文件";
  if (details.name === "git_status") return completed ? "已确认项目改动状态" : "正在确认项目改动状态";
  return completed ? "已取得项目上下文" : "正在查看项目上下文";
}

export function initialPlanActivityEvents() {
  return [{
    detail: "已经了解你的要求。",
    id: "plan-understand",
    label: "了解你的要求",
    status: "done",
  }];
}

export function mergePlanWorkflowProgress(events = [], snapshot = []) {
  const current = snapshot.find((event) => event?.status === "current" || event?.status === "failed");
  if (!current) return events;
  if (current.id === "context" || current.id === "generate") {
    const existingContext = events.find((event) => event.id === "plan-context");
    if (existingContext) return events;
    return appendCurrent(events, {
      detail: current.detail || "正在判断需要查看哪些项目内容；不会修改文件。",
      id: "plan-context",
      label: "分析项目（只读）",
      status: current.status,
    });
  }
  if (current.id === "persist") {
    return appendCurrent(events, {
      detail: current.detail || "方案已经生成，正在保存到当前任务。",
      id: "plan-persist",
      label: "保存只读方案",
      status: current.status,
    });
  }
  return events;
}

export function recordPlanPhase(events = [], payload = {}) {
  if (payload.phase !== "vision-context") return events;
  const completed = payload.status === "succeeded";
  const existing = events.findIndex((event) => event.id === "plan-vision");
  const next = {
    detail: completed ? "已取得与本次任务有关的界面线索。" : "正在理解图片中的界面和文字线索。",
    id: "plan-vision",
    label: completed ? "已理解图片" : "正在理解图片",
    status: completed ? "done" : "current",
  };
  if (existing >= 0) return events.map((event, index) => index === existing ? next : event);
  return completed ? [...settleCurrent(events), next] : appendCurrent(events, next);
}

export function recordPlanTool(events = [], payload = {}, completed = false) {
  const details = payload.details || {};
  if (!toolNames.has(String(details.name || ""))) return events;
  const identity = toolIdentity(payload);
  if (completed) {
    const index = events.findLastIndex((event) => event.toolIdentity === identity && event.status === "current");
    const next = {
      detail: "只读操作已完成，没有修改文件。",
      id: index >= 0 ? events[index].id : `plan-tool-${payload.sequence || Date.now()}`,
      label: toolText(payload, true),
      status: "done",
      toolIdentity: identity,
    };
    return index >= 0
      ? events.map((event, eventIndex) => eventIndex === index ? next : event)
      : [...settleCurrent(events), next];
  }
  return appendCurrent(events, {
    detail: "只读操作，不会修改文件。",
    id: `plan-tool-${payload.sequence || Date.now()}`,
    label: toolText(payload, false),
    status: "current",
    toolIdentity: identity,
  });
}

export function recordPlanComposition(events = [], detail = "正在根据已读取的信息整理具体方案。") {
  return appendCurrent(events, {
    detail,
    id: "plan-compose",
    label: "整理具体方案",
    status: "current",
  });
}

export function recordPlanPersistence(events = []) {
  return appendCurrent(events, {
    detail: "方案已经生成，正在保存到当前任务。",
    id: "plan-persist",
    label: "保存只读方案",
    status: "current",
  });
}
