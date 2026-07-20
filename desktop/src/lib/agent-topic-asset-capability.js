export function assetCapabilitySpec(topicId, { assetDomainFileCount, assetDomainRiskCount, domains, snapshot }) {
  const { engineeringDomain, governanceDomain, reportDomain, schemaDomain, scriptDomain } = domains;
  const specs = {
    "engineering-files": {
      title: "工程文件", status: assetDomainFileCount(engineeringDomain) ? "已发现" : "待扫描", tone: assetDomainFileCount(engineeringDomain) ? "success" : "warning",
      value: "让 Agent 快速定位源码入口、配置文件和工程目录，减少从零扫目录的成本。",
      next: "优先标注入口文件、运行配置、核心模块和高频修改区域。", files: engineeringDomain?.files || ["desktop/*", "cli/*", "package.json"],
    },
    "governance-files": {
      title: "治理文件", status: assetDomainRiskCount(governanceDomain) ? "需关注" : "已接入", tone: assetDomainRiskCount(governanceDomain) ? "warning" : "success",
      value: "让 Agent 知道项目规则、当前状态、交接记录和文档边界。",
      next: "把缺失、过期或变更中的治理文件标成待确认事项。", files: governanceDomain?.files || ["PROJECT.md", "HANDOFF.md", "AGENTS.md", "docs/*"],
    },
    "report-artifacts": {
      title: "报告产物", status: snapshot?.goalValidationReport?.status || "待生成", tone: snapshot?.goalValidationReport?.status === "failed" ? "danger" : snapshot?.goalValidationReport?.status ? "success" : "warning",
      value: "让接入项目有评分、建议、验收和运行证据，用户能知道报告下一步能干嘛。",
      next: "把评分、建议和失败验收直接连接到修复任务。", files: reportDomain?.files || [".project-os/reports/*", ".project-os/recommendations/*", ".project-os/goal-validation-report.json"],
    },
    "schema-assets": {
      title: "Schema", status: assetDomainFileCount(schemaDomain) ? "已发现" : "待补齐", tone: assetDomainFileCount(schemaDomain) ? "success" : "warning",
      value: "让 Agent 按结构化契约读取状态、生成报告和校验配置。",
      next: "展示每个 schema/manifest 约束的数据对象和使用场景。", files: schemaDomain?.files || ["schemas/*", "docs/data/*"],
    },
    "script-templates": {
      title: "脚本模板", status: assetDomainFileCount(scriptDomain) ? "已发现" : "待整理", tone: assetDomainFileCount(scriptDomain) ? "success" : "warning",
      value: "让接入项目知道哪些检查、同步和模板命令可以被安全复用。",
      next: "区分可直接运行、需要确认、只作为模板参考的脚本。", files: scriptDomain?.files || ["scripts/*", "templates/*", "adapters/*"],
    },
  };
  return specs[topicId] || null;
}
