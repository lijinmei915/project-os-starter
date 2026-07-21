export const projectAccessModes = Object.freeze({
  browse: "browse",
  governed: "governed",
  controlled: "controlled",
});

const labels = Object.freeze({
  browse: "仅浏览",
  governed: "接入治理",
  controlled: "允许受控修改",
});

export function normalizeProjectAccessMode(value) {
  return Object.values(projectAccessModes).includes(value) ? value : projectAccessModes.browse;
}

export function projectAccessPresentation(value) {
  const mode = normalizeProjectAccessMode(value);
  return {
    mode,
    label: labels[mode],
    summary: mode === projectAccessModes.browse
      ? "只读取项目，不写入治理文件或工程文件。"
      : mode === projectAccessModes.governed
        ? "可写入 .omnidesk Runtime 记录，不修改工程文件。"
        : "可在每次确认后应用工程变更并运行验证。",
  };
}

export function canProjectAccess(mode, action) {
  const normalized = normalizeProjectAccessMode(mode);
  if (["read-project", "scan-project", "generate-plan", "generate-patch", "run-check"].includes(action)) return true;
  if (["write-governance", "write-memory", "write-task"].includes(action)) return normalized !== projectAccessModes.browse;
  if (["apply-patch", "write-engineering", "git-commit", "publish"].includes(action)) return normalized === projectAccessModes.controlled;
  return false;
}

export function projectAccessError(mode, action) {
  if (canProjectAccess(mode, action)) return "";
  const current = projectAccessPresentation(mode);
  return action === "apply-patch"
    ? `当前项目处于“${current.label}”模式，不能修改工程文件。请先在项目接入设置中选择“允许受控修改”。`
    : `当前项目处于“${current.label}”模式，不能执行此操作。`;
}
