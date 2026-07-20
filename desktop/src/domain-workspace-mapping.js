export const domainWorkspaceMapping = {
  frontend: {
    label: "前端",
    recommendations: [
      { capabilityId: "design-implementation", modules: ["界面规范", "实现结构"] },
      { capabilityId: "validation-delivery", modules: ["前端检查", "验收报告"] },
    ],
  },
  backend: {
    label: "后端",
    recommendations: [
      { capabilityId: "design-implementation", modules: ["系统架构", "接口契约"] },
      { capabilityId: "validation-delivery", modules: ["服务测试", "运行记录"] },
    ],
  },
  database: {
    label: "数据库",
    recommendations: [
      { capabilityId: "design-implementation", modules: ["数据模型", "迁移策略"] },
      { capabilityId: "validation-delivery", modules: ["数据验证", "迁移检查"] },
    ],
  },
  desktop: {
    label: "桌面端",
    recommendations: [
      { capabilityId: "design-implementation", modules: ["权限边界", "桌面结构"] },
      { capabilityId: "validation-delivery", modules: ["桌面构建", "安装包验证"] },
    ],
  },
  cli: {
    label: "CLI",
    recommendations: [
      { capabilityId: "design-implementation", modules: ["命令契约", "兼容边界"] },
      { capabilityId: "validation-delivery", modules: ["CLI 测试", "跨平台检查"] },
    ],
  },
  ai: {
    label: "AI",
    recommendations: [
      { capabilityId: "agent-configuration", modules: ["模型连接", "工具权限", "AI 安全"] },
      { capabilityId: "validation-delivery", modules: ["模型评测", "工具调用验证"] },
    ],
  },
  testing: {
    label: "测试",
    recommendations: [
      { capabilityId: "validation-delivery", modules: ["检查项", "验收报告", "运行记录"] },
    ],
  },
  deployment: {
    label: "部署",
    recommendations: [
      { capabilityId: "validation-delivery", modules: ["发布流程", "部署检查"] },
      { capabilityId: "project-overview", modules: ["启动方式"] },
    ],
  },
};

export function domainReasonsForCapability(domainCapabilities = [], capabilityId) {
  return domainCapabilities
    .filter((domain) => ["detected", "recommended", "enabled"].includes(domain.status))
    .flatMap((domain) => {
      const mapping = domainWorkspaceMapping[domain.id];
      if (!mapping) return [];
      return mapping.recommendations
        .filter((recommendation) => recommendation.capabilityId === capabilityId)
        .map((recommendation) => ({ domainId: domain.id, domainLabel: mapping.label, modules: recommendation.modules }));
    });
}

const moduleIdByLabel = {
  "系统架构": "system-architecture", "接口契约": "data-contracts", "数据模型": "data-contracts", "迁移策略": "data-contracts",
  "界面规范": "ui-standards", "实现结构": "code-structure", "权限边界": "system-architecture", "桌面结构": "code-structure",
  "命令契约": "data-contracts", "兼容边界": "system-architecture", "前端检查": "validation-checks", "服务测试": "validation-checks",
  "数据验证": "validation-checks", "迁移检查": "validation-checks", "桌面构建": "validation-checks", "安装包验证": "validation-report",
  "CLI 测试": "validation-checks", "跨平台检查": "validation-checks", "模型评测": "validation-checks", "工具调用验证": "validation-checks",
  "检查项": "validation-checks", "验收报告": "validation-report", "运行记录": "run-records", "发布流程": "run-records", "部署检查": "validation-checks",
  "模型连接": "model-connections", "工具权限": "tool-allowlist", "AI 安全": "security-boundary", "启动方式": "project-runbook"
};

export function recommendedModuleIds(domainCapabilities = [], capabilityId) {
  return [...new Set(domainReasonsForCapability(domainCapabilities, capabilityId)
    .flatMap((reason) => reason.modules.map((label) => moduleIdByLabel[label]).filter(Boolean)))];
}
