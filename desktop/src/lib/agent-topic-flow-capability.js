const stages = {
  "project-identity": ["认识项目", "项目身份、用途和阶段。"], "project-progress": ["认识项目", "当前进度和下一步。"], "project-runbook": ["认识项目", "启动入口与运行环境。"], "project-risks": ["认识项目", "已知风险和边界。"], "local-project-state": ["认识项目", "项目是否已接入并可继续治理。"],
  "current-goal": ["定义目标", "当前目标、范围和优先级。"], "acceptance-criteria": ["定义目标", "完成判断和检查条件。"], "goal-history": ["定义目标", "目标历史和完成记录。"],
  "collaboration-boundary": ["工作规则", "AI 和用户如何分工。"], "execution-permissions": ["工作规则", "自动执行和确认边界。"], "documentation-rules": ["工作规则", "信息归属和命名规则。"],
  "system-architecture": ["设计实现", "模块、依赖和架构关系。"], "data-contracts": ["设计实现", "对象、状态和结构化契约。"], "ui-standards": ["设计实现", "组件、视觉规范和设计 token。"], "code-structure": ["设计实现", "目录、模块职责和实现入口。"],
  "validation-checks": ["验证交付", "当前项目可运行检查。"], "validation-report": ["验证交付", "目标验收和检查结果。"], "run-records": ["验证交付", "检查、扫描和执行历史。"],
  "handoff-records": ["复盘沉淀", "继续工作上下文。"], "decision-records": ["复盘沉淀", "重要取舍记录。"], "lessons-learned": ["复盘沉淀", "踩坑、修正和新增约束。"],
};

export function flowCapabilitySpec(topicId, topic) {
  const stage = stages[topicId];
  if (!stage) return null;
  return {
    files: topic?.relatedFiles || [],
    next: topic?.nextAction || "补齐状态源、操作入口和闭环验证。",
    status: topic?.maturity || "只读",
    title: topic?.title || stage[0],
    tone: ["闭环", "状态化", "可验证"].includes(topic?.maturity) ? "success" : "info",
    value: `属于「${stage[0]}」阶段，用来让接入项目明确${stage[1]}`,
  };
}
