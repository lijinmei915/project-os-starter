const PHASE_LABELS = Object.freeze({
  init: "启动中",
  stabilizing: "打磨中",
  shipping: "交付中",
  maintenance: "维护中",
  archived: "已归档",
});

export function selectProjectRefreshControl({ freshness = "unknown", refreshing = false, refreshState = "idle" } = {}) {
  if (refreshing || refreshState === "loading") {
    return Object.freeze({ actionLabel: "更新中", disabled: true, mode: "primary", statusLabel: "正在更新", tone: "progress" });
  }
  if (refreshState === "error") {
    return Object.freeze({ actionLabel: "重试", disabled: false, mode: "primary", statusLabel: "更新失败", tone: "danger" });
  }
  if (refreshState === "success") {
    return Object.freeze({ actionLabel: "", disabled: false, mode: "none", statusLabel: "已更新", tone: "success" });
  }
  if (freshness === "stale") {
    return Object.freeze({ actionLabel: "立即更新", disabled: false, mode: "primary", statusLabel: "检测到变化", tone: "warning" });
  }
  return Object.freeze({ actionLabel: "重新扫描项目", disabled: false, mode: "icon", statusLabel: "", tone: "neutral" });
}

function valueOf(store, id) {
  return store.get(id)?.value ?? null;
}

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && value !== "";
}

function factState(store, factIds) {
  const facts = factIds.map((id) => store.get(id)).filter(Boolean);
  return {
    freshness: facts.some((fact) => fact.freshness === "stale") ? "stale" : facts.every((fact) => fact.freshness === "fresh") ? "fresh" : "unknown",
    conflicts: facts.filter((fact) => fact.status === "conflict").map((fact) => fact.id),
    missing: facts.filter((fact) => fact.status === "missing").map((fact) => fact.id),
  };
}

function unique(items) {
  return [...new Set((Array.isArray(items) ? items : []).filter(Boolean))];
}

function preferVersionedLabels(items) {
  return Object.values(unique(items).reduce((groups, item) => {
    const key = String(item).toLowerCase().replace(/\s*\d+(?:\.\d+)*/g, "").trim();
    if (!groups[key] || (/\d/.test(item) && !/\d/.test(groups[key]))) groups[key] = item;
    return groups;
  }, {}));
}

function section(id, title, subtitle, items, state, action = null) {
  const visibleItems = items.filter((item) => hasValue(item.value));
  return Object.freeze({ id, title, subtitle, render: visibleItems.length > 0, items: visibleItems, state, ...(action ? { action } : {}) });
}

export function selectProjectHeader(store) {
  const dependencies = ["project.name", "project.version", "project.phase", "project.description", "project.updated-at"];
  const phase = valueOf(store, "project.phase");
  const sources = unique(dependencies.map((id) => store.get(id)?.selectedSource).filter((source) => source && !source.startsWith("scanner:")));
  return Object.freeze({
    id: "project-overview.header",
    render: true,
    name: valueOf(store, "project.name") || "当前项目",
    version: valueOf(store, "project.version"),
    phase: { value: phase, label: PHASE_LABELS[phase] || "阶段待确认" },
    description: valueOf(store, "project.description") || "尚未形成项目概览。",
    updatedAt: valueOf(store, "project.updated-at"),
    sources,
    state: factState(store, dependencies),
    action: "refresh-project-facts",
  });
}

export function selectCorePositioning(store) {
  const dependencies = ["product.goal", "product.core-capabilities"];
  return section("project-overview.core-positioning", "核心定位", "产品目标与能力边界", [
    { id: "goal", label: "产品目标", value: valueOf(store, "product.goal") },
    { id: "capabilities", label: "核心能力", value: valueOf(store, "product.core-capabilities") },
  ], factState(store, dependencies));
}

export function selectTechnologyOverview(store) {
  const dependencies = ["technology.stack", "technology.dependencies"];
  const items = preferVersionedLabels([...unique(valueOf(store, "technology.stack")), ...unique(valueOf(store, "technology.dependencies"))]);
  const groups = [
    { id: "application", label: "应用框架", value: items.filter((item) => !/(radix|lucide|shadcn|tailwind|vite|eslint|typescript|rust crates)/i.test(item)) },
    { id: "interface", label: "UI 组件", value: items.filter((item) => /(radix|lucide|shadcn|tailwind)/i.test(item)) },
    { id: "tooling", label: "工程工具", value: items.filter((item) => /(vite|eslint|typescript|rust crates)/i.test(item)) },
  ];
  return section("project-overview.technology", "技术组成", "技术栈与依赖", groups, factState(store, dependencies), "open-architecture");
}

export function selectEngineeringStructure(store) {
  const dependencies = ["engineering.directories"];
  const directories = unique(valueOf(store, "engineering.directories"));
  return section("project-overview.engineering-structure", "工程结构", "关键目录", [
    { id: "application", label: "应用代码", value: directories.filter((item) => /^(src|app|apps|desktop|cli|packages)$/i.test(item)) },
    { id: "governance", label: "治理与文档", value: directories.filter((item) => /^(\.project-os|docs|schemas)$/i.test(item)) },
    { id: "quality", label: "构建与质量", value: directories.filter((item) => /^(scripts|tests|templates|\.github)$/i.test(item)) },
  ], factState(store, dependencies));
}

export const projectOverviewSelectors = Object.freeze({
  selectProjectHeader,
  selectCorePositioning,
  selectTechnologyOverview,
  selectEngineeringStructure,
});

export function buildProjectOverviewViewModel(store) {
  return Object.freeze({
    schemaVersion: "project-os.project-overview-view-model.v0.1",
    projectId: store.projectId,
    observedAt: store.observedAt,
    slots: Object.freeze([
      selectProjectHeader(store),
      selectCorePositioning(store),
      selectTechnologyOverview(store),
      selectEngineeringStructure(store),
    ]),
  });
}
