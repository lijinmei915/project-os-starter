export function assetCapabilitySpec(topicId, { assetDomainFileCount, assetDomainRiskCount, domains, snapshot }) {
  const { engineeringDomain, governanceDomain, reportDomain, schemaDomain } = domains;
  const specs = {
    "engineering-files": {
      title: "工程文件", status: assetDomainFileCount(engineeringDomain) ? "已发现" : "待扫描", tone: assetDomainFileCount(engineeringDomain) ? "success" : "warning",
      value: "让 Agent 快速定位源码入口、配置文件和工程目录，减少从零扫目录的成本。",
      next: "优先标注入口文件、运行配置、核心模块和高频修改区域。", files: engineeringDomain?.files || ["desktop/*", "package.json"],
    },
    "governance-files": {
      title: "治理文件", status: assetDomainRiskCount(governanceDomain) ? "需关注" : "已接入", tone: assetDomainRiskCount(governanceDomain) ? "warning" : "success",
      value: "让 Agent 知道项目规则、当前状态、交接记录和文档边界。",
      next: "把缺失、过期或变更中的治理文件标成待确认事项。", files: governanceDomain?.files || ["PROJECT.md", "HANDOFF.md", "AGENTS.md", "docs/*"],
    },
    "report-artifacts": {
      title: "报告产物", status: snapshot?.goalValidationReport?.status || "待生成", tone: snapshot?.goalValidationReport?.status === "failed" ? "danger" : snapshot?.goalValidationReport?.status ? "success" : "warning",
      value: "让接入项目保留写入、审批、检查、修复和验收的运行证据。",
      next: "从失败证据生成受限的修复草稿，或查看已通过的验收记录。", files: reportDomain?.files || [".omnidesk/evidence/runs/*", ".omnidesk/evidence/goal-validation-report.json"],
    },
    "schema-assets": {
      title: "Schema", status: assetDomainFileCount(schemaDomain) ? "已发现" : "待补齐", tone: assetDomainFileCount(schemaDomain) ? "success" : "warning",
      value: "让 Agent 按结构化契约读取状态、生成报告和校验配置。",
      next: "展示每个 schema/manifest 约束的数据对象和使用场景。", files: schemaDomain?.files || ["schemas/*", "docs/data/*"],
    },
  };
  return specs[topicId] || null;
}
