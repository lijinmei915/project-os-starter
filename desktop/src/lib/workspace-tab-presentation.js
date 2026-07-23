import { projectGovernanceOutline } from "../workspace-outline.js";
import { workspaceRouteById } from "../workspace-route-registry.js";

export function workspaceFileTabId(file) {
  if (file?.virtual) return `route:${file.routeId || file.id || file.path || "preview"}`;
  return `file:${file?.path || file?.preview?.path || file?.topic?.title || "preview"}`;
}

export function workspaceFileTabTitle(file) {
  if (file?.id === "workbench-overview" || file?.path === "workbench-overview") return "工作台";
  return file?.preview?.name || file?.topic?.title || (file?.virtual ? file.title : "") || file?.path || "文件";
}

export function topicPayloadFromOutline(targetId) {
  const targetRoute = workspaceRouteById(targetId);
  if (!targetRoute) return null;
  const payload = (entry, group, fallbacks = {}) => ({
    description: entry.description,
    group,
    governanceRole: entry.governanceRole || fallbacks.governanceRole,
    id: targetRoute.id,
    maturity: entry.maturity || fallbacks.maturity,
    nextAction: entry.nextAction || fallbacks.nextAction,
    path: targetRoute.path,
    relatedFiles: entry.relatedFiles || entry.files || [],
    routeId: targetRoute.id,
    routePath: targetRoute.path,
    statusSource: entry.statusSource || fallbacks.statusSource,
    surface: targetRoute.surface,
    title: entry.title,
    updatesWhen: entry.updatesWhen || fallbacks.updatesWhen,
    virtual: true,
  });
  for (const node of projectGovernanceOutline) {
    if (node.routeId === targetId) return payload(node, node.title);
    for (const child of node.children || []) {
      if (child.routeId === targetId) return payload(child, child.title || node.title, node);
      for (const item of child.items || []) {
        if (item.routeId !== targetId) continue;
        return payload(item, child.title || node.title, {
          governanceRole: child.governanceRole || node.governanceRole,
          maturity: child.maturity || node.maturity,
          nextAction: child.nextAction || node.nextAction,
          statusSource: child.statusSource || node.statusSource,
          updatesWhen: child.updatesWhen || node.updatesWhen,
        });
      }
    }
    for (const item of node.items || []) {
      if (item.routeId === targetId) return payload(item, node.title, node);
    }
  }
  return null;
}
