const surfaceFlags = {
  "acceptance-criteria": "isAcceptanceCriteriaTopic",
  "agent-config-surface": "isAgentConfigSurfaceTopic",
  "asset-surface": "isAssetSurfaceTopic",
  "code-structure": "isCodeStructureTopic",
  "collaboration-boundary": "isCollaborationBoundaryTopic",
  "component-library": "isComponentLibraryTopic",
  "current-goal": "isCurrentGoalTopic",
  "current-progress": "isCurrentProgressTopic",
  "data-contracts": "isDataContractsTopic",
  "decision-records": "isDecisionRecordsTopic",
  "design-implementation": "isDesignImplementationTopic",
  "documentation-rules": "isDocumentationRulesTopic",
  "execution-permissions": "isExecutionPermissionsTopic",
  "goal-history": "isGoalHistoryTopic",
  "governance-files": "isGovernanceFilesTopic",
  "handoff-records": "isHandoffRecordsTopic",
  "lessons-learned": "isLessonsLearnedTopic",
  "local-project-state": "isLocalProjectStateTopic",
  "memory-surface": "isMemorySurfaceTopic",
  "project-overview": "isOverviewTopic",
  "report-artifacts": "isReportTopic",
  "risk-boundary": "isRiskBoundaryTopic",
  "run-records": "isRunRecordsTopic",
  runbook: "isRunbookTopic",
  "system-architecture": "isSystemArchitectureTopic",
  "task-execution": "isTaskExecutionTopic",
  "token-library": "isTokenLibraryTopic",
  "validation-checks": "isValidationChecksTopic",
  "validation-report": "isValidationReportTopic",
};

export function resolveEngineeringTopicSurface({ dedicatedSurfaceByTopic = {}, selectedEngineeringFile = {}, workspaceRouteById }) {
  const selectedTopic = selectedEngineeringFile.topic || (selectedEngineeringFile.virtual ? selectedEngineeringFile : null);
  if (!selectedTopic) return { selectedTopic: null };
  const topicRouteId = selectedTopic.routeId || selectedTopic.id;
  const selectedRoute = workspaceRouteById(topicRouteId);
  const surface = dedicatedSurfaceByTopic[topicRouteId] || selectedRoute?.surface || selectedTopic.surface || "agent-topic";
  const flags = Object.fromEntries(Object.entries(surfaceFlags).map(([value, key]) => [key, surface === value]));
  return {
    ...flags,
    selectedRoute,
    selectedTopic,
    surface,
    topicRouteId,
    usesDedicatedSurface: selectedRoute?.type === "page" || surface !== "agent-topic",
  };
}
