export function statusLabel(status) {
  return {
    confirmed: "已确认",
    inferred: "推断",
    missing: "缺失",
    stale: "需更新",
    conflict: "冲突",
    draft: "草稿",
    "needs-review": "待审阅",
    connected: "已接入",
    "preview-managed": "预览治理",
    "ready-to-confirm": "已接入",
    blocked: "受阻",
  }[status] || status || "未知";
}

export function actionLabel(action) {
  return {
    "auto-managed": "自动治理",
    "preview-only": "仅预览",
    "confirm-workspace": "已自动接入",
    "keep-readonly": "仅预览",
    "request-more-info": "需要补充信息",
    "block-workspace": "暂不建议接入",
  }[action] || action || "建议";
}

export function governanceFileStatusLabel(status) {
  return {
    found: "已识别",
    missing: "缺失",
    changed: "有变更",
    stale: "可能过期",
    generated: "生成记录",
    ignored: "规则",
  }[status] || status || "未知";
}

export function governanceFileHealthLabel(status) {
  return {
    found: "正常",
    missing: "缺失",
    changed: "有本地变更",
    stale: "可能过期",
    generated: "生成产物",
    ignored: "规则/目录",
  }[status] || "待确认";
}

export const designImplementationTopics = {
  "code-structure": { files: ["docs/ARCHITECTURE.md", "desktop/src/main.jsx", "desktop/src-tauri/src/main.rs"], task: "审阅实现结构" },
  "data-contracts": { files: ["schemas/", "docs/data/"], task: "审阅数据契约" },
  "system-architecture": { files: ["docs/ARCHITECTURE.md"], task: "审阅系统架构" },
  "ui-standards": { files: ["docs/DESIGN_STANDARDS.md", "desktop/src/styles.css"], task: "审阅界面规范" },
};

export function governanceFileHealthSummary(domains = []) {
  const counts = { found: 0, missing: 0, changed: 0, stale: 0, generated: 0, ignored: 0, total: 0 };
  domains.forEach((domain) => {
    const files = Array.isArray(domain.files) ? domain.files : [];
    const fileStatuses = Array.isArray(domain.fileStatuses)
      ? domain.fileStatuses
      : files.map((file) => ({
        path: file,
        previewable: !file.includes("*") && !file.endsWith("/"),
        status: file.includes("*") || file.endsWith("/") ? "ignored" : "found",
      }));
    fileStatuses.forEach((file) => {
      const status = file.status || "found";
      counts[status] = (counts[status] || 0) + 1;
      counts.total += 1;
    });
  });
  const riskCount = counts.missing + counts.changed + counts.stale;
  return {
    ...counts,
    riskCount,
    status: riskCount ? "watch" : "healthy",
    label: riskCount ? `${riskCount} 项需关注` : "治理文件正常",
  };
}

export function governanceStatusSummaryText(summary, fallbackCount = 0) {
  if (!summary) return `${fallbackCount} 个文件`;
  return [
    summary.found ? `${summary.found} found` : "",
    summary.changed ? `${summary.changed} changed` : "",
    summary.missing ? `${summary.missing} missing` : "",
    summary.generated ? `${summary.generated} generated` : "",
    summary.ignored ? `${summary.ignored} ignored` : "",
  ].filter(Boolean).join(" / ") || `${fallbackCount} 个文件`;
}
