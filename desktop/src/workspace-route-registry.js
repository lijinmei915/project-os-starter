function defineRoute({
  capabilityId = null,
  id,
  linksTo = [],
  owns = [],
  parentId = null,
  path,
  surface = "agent-topic",
  type = "page",
}) {
  return Object.freeze({
    capabilityId,
    id,
    linksTo: Object.freeze(linksTo),
    owns: Object.freeze(owns),
    parentId,
    path,
    surface,
    type,
  });
}

const routes = [
  defineRoute({ id: "workbench-overview", path: "/projects/:projectId", surface: "project-overview", type: "menu" }),
  defineRoute({ id: "project-governance", path: "/projects/:projectId/governance", type: "menu" }),
  defineRoute({ capabilityId: "project-overview", id: "understand-project", parentId: "project-governance", path: "/projects/:projectId/understand", type: "submenu" }),
  defineRoute({ capabilityId: "project-overview", id: "project-identity", owns: ["project-identity"], parentId: "understand-project", path: "/projects/:projectId/overview", surface: "project-overview" }),
  defineRoute({ capabilityId: "project-overview", id: "project-progress", linksTo: ["current-goal", "task-list", "execution-results", "project-risks"], owns: ["progress-summary", "next-action"], parentId: "understand-project", path: "/projects/:projectId/progress", surface: "current-progress" }),
  defineRoute({ capabilityId: "project-overview", id: "project-runbook", linksTo: ["execution-terminal"], owns: ["runbook-commands"], parentId: "understand-project", path: "/projects/:projectId/runbook", surface: "runbook" }),
  defineRoute({ capabilityId: "project-overview", id: "project-risks", owns: ["risk-details", "boundary-details"], parentId: "understand-project", path: "/projects/:projectId/risks", surface: "risk-boundary" }),
  defineRoute({ capabilityId: "project-overview", id: "local-project-state", owns: ["local-project-state"], parentId: "understand-project", path: "/projects/:projectId/local-state", surface: "local-project-state" }),

  defineRoute({ capabilityId: "goals", id: "define-goal", parentId: "project-governance", path: "/projects/:projectId/goals", type: "submenu" }),
  defineRoute({ capabilityId: "goals", id: "current-goal", owns: ["goal-definition", "goal-scope", "goal-next-action"], parentId: "define-goal", path: "/projects/:projectId/goals/current", surface: "current-goal" }),
  defineRoute({ capabilityId: "goals", id: "acceptance-criteria", linksTo: ["validation-report"], owns: ["acceptance-criteria", "acceptance-status"], parentId: "define-goal", path: "/projects/:projectId/goals/acceptance", surface: "acceptance-criteria" }),
  defineRoute({ capabilityId: "goals", id: "goal-history", owns: ["goal-history", "goal-signoff-records"], parentId: "define-goal", path: "/projects/:projectId/goals/history", surface: "goal-history" }),

  defineRoute({ capabilityId: "rules", id: "work-rules", parentId: "project-governance", path: "/projects/:projectId/rules", type: "submenu" }),
  defineRoute({ capabilityId: "rules", id: "collaboration-boundary", owns: ["collaboration-boundary"], parentId: "work-rules", path: "/projects/:projectId/rules/collaboration", surface: "collaboration-boundary" }),
  defineRoute({ capabilityId: "rules", id: "execution-permissions", owns: ["execution-permissions"], parentId: "work-rules", path: "/projects/:projectId/rules/permissions", surface: "execution-permissions" }),
  defineRoute({ capabilityId: "rules", id: "documentation-rules", owns: ["documentation-rules"], parentId: "work-rules", path: "/projects/:projectId/rules/documentation", surface: "documentation-rules" }),

  defineRoute({ capabilityId: "design-implementation", id: "design-implementation", parentId: "project-governance", path: "/projects/:projectId/design", type: "submenu" }),
  defineRoute({ capabilityId: "design-implementation", id: "system-architecture", owns: ["architecture-layers", "architecture-entry-context", "architecture-runtime-boundary"], parentId: "design-implementation", path: "/projects/:projectId/design/architecture", surface: "system-architecture" }),
  defineRoute({ capabilityId: "design-implementation", id: "data-contracts", owns: ["contract-state-facts", "contract-workspace-views", "contract-validation-write"], parentId: "design-implementation", path: "/projects/:projectId/design/contracts", surface: "data-contracts" }),
  defineRoute({ capabilityId: "design-implementation", id: "ui-standards", parentId: "design-implementation", path: "/projects/:projectId/design/ui", type: "submenu" }),
  defineRoute({ capabilityId: "design-implementation", id: "design-tokens", owns: ["design-tokens"], parentId: "ui-standards", path: "/projects/:projectId/design/ui/tokens", surface: "token-library" }),
  defineRoute({ capabilityId: "design-implementation", id: "component-library", owns: ["component-library"], parentId: "ui-standards", path: "/projects/:projectId/design/ui/components", surface: "component-library" }),
  defineRoute({ capabilityId: "design-implementation", id: "code-structure", owns: ["implementation-workbench-ui", "implementation-local-core", "implementation-governance-runtime"], parentId: "design-implementation", path: "/projects/:projectId/design/code", surface: "code-structure" }),

  defineRoute({ capabilityId: "validation-delivery", id: "validate-delivery", parentId: "project-governance", path: "/projects/:projectId/validation", type: "submenu" }),
  defineRoute({ capabilityId: "validation-delivery", id: "validation-checks", owns: ["check-catalog", "check-execution-boundary", "check-coverage"], parentId: "validate-delivery", path: "/projects/:projectId/validation/checks", surface: "validation-checks" }),
  defineRoute({ capabilityId: "validation-delivery", id: "validation-report", owns: ["validation-conclusion", "validation-check-results", "validation-follow-up"], parentId: "validate-delivery", path: "/projects/:projectId/validation/report", surface: "validation-report" }),
  defineRoute({ capabilityId: "validation-delivery", id: "run-records", owns: ["run-history", "run-evidence", "run-retention"], parentId: "validate-delivery", path: "/projects/:projectId/validation/runs", surface: "run-records" }),

  defineRoute({ capabilityId: "knowledge-memory", id: "retrospective-memory", parentId: "project-governance", path: "/projects/:projectId/retrospective", type: "submenu" }),
  defineRoute({ capabilityId: "knowledge-memory", id: "handoff-records", owns: ["handoff-current-context", "handoff-continuation-focus", "handoff-open-risks"], parentId: "retrospective-memory", path: "/projects/:projectId/retrospective/handoff", surface: "handoff-records" }),
  defineRoute({ capabilityId: "knowledge-memory", id: "decision-records", owns: ["decision-choice", "decision-rationale", "decision-impact"], parentId: "retrospective-memory", path: "/projects/:projectId/retrospective/decisions", surface: "decision-records" }),
  defineRoute({ capabilityId: "knowledge-memory", id: "lessons-learned", owns: ["lesson-error-pattern", "lesson-root-cause", "lesson-new-constraint"], parentId: "retrospective-memory", path: "/projects/:projectId/retrospective/lessons", surface: "lessons-learned" }),

  defineRoute({ capabilityId: "tasks", id: "task-execution", path: "/projects/:projectId/tasks", type: "menu" }),
  defineRoute({ capabilityId: "tasks", id: "task-list-menu", parentId: "task-execution", path: "/projects/:projectId/tasks/list-menu", type: "submenu" }),
  defineRoute({ capabilityId: "tasks", id: "task-list", owns: ["task-list-items", "task-detail", "task-next-action"], parentId: "task-list-menu", path: "/projects/:projectId/tasks/list", surface: "task-execution" }),
  defineRoute({ capabilityId: "tasks", id: "task-terminal-menu", parentId: "task-execution", path: "/projects/:projectId/tasks/terminal-menu", type: "submenu" }),
  defineRoute({ capabilityId: "tasks", id: "execution-terminal", owns: ["terminal-sessions", "terminal-controlled-commands", "terminal-output"], parentId: "task-terminal-menu", path: "/projects/:projectId/tasks/terminal", surface: "task-execution" }),
  defineRoute({ capabilityId: "tasks", id: "task-results-menu", parentId: "task-execution", path: "/projects/:projectId/tasks/results-menu", type: "submenu" }),
  defineRoute({ capabilityId: "tasks", id: "execution-results", owns: ["result-history", "result-failures", "result-follow-up"], parentId: "task-results-menu", path: "/projects/:projectId/tasks/results", surface: "task-execution" }),

  defineRoute({ capabilityId: "knowledge-memory", id: "memory", path: "/projects/:projectId/memory", type: "menu" }),
  defineRoute({ capabilityId: "knowledge-memory", id: "memory-facts-menu", parentId: "memory", path: "/projects/:projectId/memory/facts-menu", type: "submenu" }),
  defineRoute({ capabilityId: "knowledge-memory", id: "project-facts", owns: ["facts-profile", "facts-sources", "facts-freshness"], parentId: "memory-facts-menu", path: "/projects/:projectId/memory/facts", surface: "memory-surface" }),
  defineRoute({ capabilityId: "knowledge-memory", id: "memory-preferences-menu", parentId: "memory", path: "/projects/:projectId/memory/preferences-menu", type: "submenu" }),
  defineRoute({ capabilityId: "knowledge-memory", id: "user-preferences", owns: ["preferences-project", "preferences-global", "preferences-confirmation"], parentId: "memory-preferences-menu", path: "/projects/:projectId/memory/preferences", surface: "memory-surface" }),
  defineRoute({ capabilityId: "knowledge-memory", id: "memory-long-term-menu", parentId: "memory", path: "/projects/:projectId/memory/long-term-menu", type: "submenu" }),
  defineRoute({ capabilityId: "knowledge-memory", id: "long-term-memory", owns: ["memory-decisions", "memory-lessons", "memory-retention"], parentId: "memory-long-term-menu", path: "/projects/:projectId/memory/long-term", surface: "memory-surface" }),
  defineRoute({ capabilityId: "knowledge-memory", id: "memory-conversations-menu", parentId: "memory", path: "/projects/:projectId/memory/conversations-menu", type: "submenu" }),
  defineRoute({ capabilityId: "knowledge-memory", id: "conversation-summary", owns: ["conversation-topics", "conversation-outcomes", "conversation-pending"], parentId: "memory-conversations-menu", path: "/projects/:projectId/memory/conversations", surface: "memory-surface" }),

  defineRoute({ capabilityId: "files", id: "engineering-assets", path: "/projects/:projectId/assets", type: "menu" }),
  defineRoute({ capabilityId: "files", id: "assets-files-menu", parentId: "engineering-assets", path: "/projects/:projectId/assets/files-menu", type: "submenu" }),
  defineRoute({ capabilityId: "files", id: "engineering-files", owns: ["asset-code-entry", "asset-code-structure", "asset-code-preview"], parentId: "assets-files-menu", path: "/projects/:projectId/assets/files", surface: "asset-surface" }),
  defineRoute({ capabilityId: "files", id: "assets-governance-menu", parentId: "engineering-assets", path: "/projects/:projectId/assets/governance-menu", type: "submenu" }),
  defineRoute({ capabilityId: "files", id: "governance-files", owns: ["asset-governance-health", "asset-governance-files", "asset-governance-actions"], parentId: "assets-governance-menu", path: "/projects/:projectId/assets/governance", surface: "asset-surface" }),
  defineRoute({ capabilityId: "files", id: "assets-reports-menu", parentId: "engineering-assets", path: "/projects/:projectId/assets/reports-menu", type: "submenu" }),
  defineRoute({ capabilityId: "files", id: "report-artifacts", owns: ["asset-reports-catalog", "asset-reports-evidence", "asset-reports-retention"], parentId: "assets-reports-menu", path: "/projects/:projectId/assets/reports", surface: "asset-surface" }),
  defineRoute({ capabilityId: "files", id: "assets-advanced-menu", parentId: "engineering-assets", path: "/projects/:projectId/assets/advanced-menu", type: "submenu" }),
  defineRoute({ capabilityId: "files", id: "schema-assets", owns: ["asset-schema-catalog", "asset-schema-usage", "asset-schema-validation"], parentId: "assets-advanced-menu", path: "/projects/:projectId/assets/schemas", surface: "asset-surface" }),
  defineRoute({ capabilityId: "files", id: "script-templates", owns: ["asset-template-catalog", "asset-template-safety", "asset-template-sync"], parentId: "assets-advanced-menu", path: "/projects/:projectId/assets/templates", surface: "asset-surface" }),

  defineRoute({ capabilityId: "agent-configuration", id: "agent-config", path: "/projects/:projectId/agent", type: "menu" }),
  defineRoute({ capabilityId: "agent-configuration", id: "agent-models-menu", parentId: "agent-config", path: "/projects/:projectId/agent/models-menu", type: "submenu" }),
  defineRoute({ capabilityId: "agent-configuration", id: "model-connections", owns: ["model-provider", "model-availability", "model-default"], parentId: "agent-models-menu", path: "/projects/:projectId/agent/models", surface: "agent-config-surface" }),
  defineRoute({ capabilityId: "agent-configuration", id: "agent-tools-menu", parentId: "agent-config", path: "/projects/:projectId/agent/tools-menu", type: "submenu" }),
  defineRoute({ capabilityId: "agent-configuration", id: "tool-allowlist", owns: ["tool-allowed", "tool-confirmation", "tool-restrictions"], parentId: "agent-tools-menu", path: "/projects/:projectId/agent/tools", surface: "agent-config-surface" }),
  defineRoute({ capabilityId: "agent-configuration", id: "agent-skills-menu", parentId: "agent-config", path: "/projects/:projectId/agent/skills-menu", type: "submenu" }),
  defineRoute({ capabilityId: "agent-configuration", id: "skill-capabilities", owns: ["skill-catalog", "skill-trigger", "skill-boundary"], parentId: "agent-skills-menu", path: "/projects/:projectId/agent/skills", surface: "agent-config-surface" }),
  defineRoute({ capabilityId: "agent-configuration", id: "agent-adapters-menu", parentId: "agent-config", path: "/projects/:projectId/agent/adapters-menu", type: "submenu" }),
  defineRoute({ capabilityId: "agent-configuration", id: "adapters", owns: ["adapter-catalog", "adapter-rule-source", "adapter-sync"], parentId: "agent-adapters-menu", path: "/projects/:projectId/agent/adapters", surface: "agent-config-surface" }),
  defineRoute({ capabilityId: "agent-configuration", id: "agent-security-menu", parentId: "agent-config", path: "/projects/:projectId/agent/security-menu", type: "submenu" }),
  defineRoute({ capabilityId: "agent-configuration", id: "security-boundary", owns: ["security-data", "security-execution", "security-confirmation"], parentId: "agent-security-menu", path: "/projects/:projectId/agent/security", surface: "agent-config-surface" }),
];

export const workspaceRouteRegistry = Object.freeze(routes);

const routeById = new Map(workspaceRouteRegistry.map((route) => [route.id, route]));

export function workspaceRouteById(routeId) {
  return routeById.get(routeId) || null;
}

export function requireWorkspaceRoute(routeId) {
  const route = workspaceRouteById(routeId);
  if (!route) throw new Error(`workspace route is not registered: ${routeId}`);
  return route;
}

export function validateWorkspaceRouteRegistry(outline = []) {
  const errors = [];
  const seenIds = new Set();
  const seenPaths = new Set();
  const ownerByFeature = new Map();

  for (const route of workspaceRouteRegistry) {
    if (seenIds.has(route.id)) errors.push(`duplicate route id: ${route.id}`);
    if (seenPaths.has(route.path)) errors.push(`duplicate route path: ${route.path}`);
    seenIds.add(route.id);
    seenPaths.add(route.path);
    if (route.parentId && !routeById.has(route.parentId)) errors.push(`missing parent route: ${route.id} -> ${route.parentId}`);
    for (const targetId of route.linksTo) {
      if (!routeById.has(targetId)) errors.push(`missing linked route: ${route.id} -> ${targetId}`);
    }
    for (const featureId of route.owns) {
      if (ownerByFeature.has(featureId)) errors.push(`duplicate feature owner: ${featureId} -> ${ownerByFeature.get(featureId)}, ${route.id}`);
      ownerByFeature.set(featureId, route.id);
    }
  }

  const visit = (entry) => {
    if (!routeById.has(entry.id)) errors.push(`unregistered menu route: ${entry.id}`);
    (entry.children || []).forEach(visit);
    (entry.items || []).forEach(visit);
  };
  outline.forEach(visit);
  return errors;
}
