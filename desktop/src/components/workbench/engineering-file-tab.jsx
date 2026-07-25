import React, { useEffect, useState } from "react";
import { ComponentGovernancePanel } from "./component-governance-panel";
import { TokenGovernancePanel } from "./token-governance-panel";
import { AgentTopicPanel } from "./agent-topic-panel";
import { AgentConfigSurfacePanel } from "./agent-config-surface-panel";
import { ReadonlyFilePreview } from "./readonly-file-preview";
import { DesignImplementationHealthSection, GovernanceFilesHealthSection } from "./governance-health-sections";
import { EngineeringTopicFrame } from "./engineering-topic-frame";
import { EngineeringTopicSurfaceComposer } from "./engineering-topic-surface-composer";
import { AssetSurfacePanel, GovernanceSurfacePanel, MemorySurfacePanel } from "./workspace-static-surfaces";
import { CurrentProgressPanel } from "./current-progress-panel";
import { CurrentGoalPanel } from "./current-goal-panel";
import { AcceptanceCriteriaPanel, GoalHistoryPanel, LocalProjectStatePanel, RuleSourceButtons, RunRecordsPanel, ValidationReportPanel } from "./goal-validation-panels";
import { WorkspaceDashboard } from "./workspace-dashboard";
import { WorkspaceFactsPreview } from "./workspace-facts-preview";
import { RunbookPanel } from "./runbook-panel";
import { RiskBoundaryPanel } from "./risk-boundary-panel";
import { Notice } from "../ui/notice";
import { Panel } from "../ui/panel";
import { OverviewPageHeader } from "./overview-section";
import { resolveEngineeringTopicSurface } from "../../lib/engineering-topic-surface";

/**
 * Owns engineering topic routing and composition. Runtime access remains at
 * the Workbench boundary and is injected here as explicit callbacks.
 */
export function EngineeringFileTab({
  selectedEngineeringFile,
  snapshot,
  tasks = [],
  agentRuns = [],
  mcpClient,
  mcpNative,
  activeTaskId,
  provider,
  composerModelAvailability = {},
  runnerLoadingId,
  handoffLoading,
  onGeneratePatchDraft,
  onApplyPatchDraft,
  onApproveAgentRun,
  onCancelAgentRun,
  onExportAgentRun,
  onMergeHandoff,
  onRunGuardedCheck,
  onSelectTask,
  onMarkTaskWaiting,
  onEnsureModelAvailable,
  onCreateTask,
  onCreateGoal,
  onDeleteTask,
  onArchiveGoal,
  onMergeGoal,
  onRestoreGoal,
  onNavigateWorkbench,
  onCreateRepairTask,
  onCreateGovernanceTask,
  onCreateDesignGovernanceTask,
  onPersistTask,
  onUpdateGoal,
  decomposingGoal,
  onConfirmDecomposition,
  onGenerateDecomposition,
  onRequestProjectAccess,
  onPrepareTerminalCommand,
  onOpenTaskConversation,
  onRefreshWorkspace,
  onReadEngineeringFile,
  onResumeAgentRun,
  onGetHermesExecutorStatus,
  onCopyText,
  onRefreshWorkspaceFacts,
  onRefreshAgentRuns,
  presentation,
}) {
  const {
    agentTopicPresentation,
    dedicatedSurfaceByTopic,
    taskStatuses,
    workspaceRouteById,
  } = presentation;
  const {
    isAcceptanceCriteriaTopic, isAgentConfigSurfaceTopic, isAssetSurfaceTopic, isCodeStructureTopic,
    isCollaborationBoundaryTopic, isComponentLibraryTopic, isCurrentGoalTopic, isCurrentProgressTopic,
    isDataContractsTopic, isDecisionRecordsTopic, isDesignImplementationTopic, isDocumentationRulesTopic,
    isExecutionPermissionsTopic, isGoalHistoryTopic, isGovernanceFilesTopic, isHandoffRecordsTopic,
    isLessonsLearnedTopic, isLocalProjectStateTopic, isMemorySurfaceTopic, isOverviewTopic,
    isRiskBoundaryTopic, isRunbookTopic, isRunRecordsTopic, isSystemArchitectureTopic,
    isTaskExecutionTopic, isTokenLibraryTopic, isValidationChecksTopic, isValidationReportTopic,
    selectedTopic, surface, topicRouteId, usesDedicatedSurface,
  } = resolveEngineeringTopicSurface({ dedicatedSurfaceByTopic, selectedEngineeringFile, workspaceRouteById });
  const selectedTopicGroupLabel = selectedEngineeringFile.group === "workbench-overview"
    ? "工作台"
    : selectedEngineeringFile.group;
  const [relatedFilePreview, setRelatedFilePreview] = useState(null);
  useEffect(() => {
    setRelatedFilePreview(null);
  }, [selectedTopic?.id, selectedEngineeringFile.path]);

  const previewRelatedFile = async (path) => {
    if (!path || path.includes("*") || path.endsWith("/")) {
      setRelatedFilePreview({ error: "这是目录或匹配规则，暂不直接预览。请选择具体文件。", path });
      return;
    }
    setRelatedFilePreview({ loading: true, path });
    try {
      const preview = await onReadEngineeringFile(path);
      setRelatedFilePreview({ path, preview });
    } catch (err) {
      setRelatedFilePreview({ error: err instanceof Error ? err.message : String(err), path });
    }
  };

  if (!selectedTopic) {
    return <Panel className="engineeringFilePreview filePreviewPanel" variant="soft">
      <ReadonlyFilePreview description={selectedEngineeringFile.description} file={selectedEngineeringFile} />
    </Panel>;
  }

  const workspaceFacts = isOverviewTopic ? snapshot?.workspaceFacts || null : null;
  const openSourceFile = (path) => onNavigateWorkbench?.({ type: "file", path });
  const sourceButtons = (callback, sources) => <RuleSourceButtons onOpenSource={callback} sources={sources} />;
  const governancePanel = (matches, type) => matches
    ? <GovernanceSurfacePanel onOpenSource={openSourceFile} renderSourceButtons={sourceButtons} type={type} />
    : null;
  const currentProgressPanel = isCurrentProgressTopic && snapshot?.workspaceFacts
    ? <CurrentProgressPanel onNavigate={onNavigateWorkbench} onOpenSource={openSourceFile} report={snapshot.workspaceFacts} snapshot={snapshot} tasks={tasks} />
    : null;
  const currentGoalPanel = isCurrentGoalTopic
    ? <CurrentGoalPanel decomposingGoal={decomposingGoal} onConfirmDecomposition={onConfirmDecomposition} onGenerateDecomposition={onGenerateDecomposition} onNavigate={onNavigateWorkbench} onOpenSource={openSourceFile} snapshot={snapshot} />
    : null;
  const acceptanceCriteriaPanel = isAcceptanceCriteriaTopic
    ? <AcceptanceCriteriaPanel onNavigate={onNavigateWorkbench} onOpenSource={openSourceFile} snapshot={snapshot} />
    : null;
  const goalHistoryPanel = isGoalHistoryTopic
    ? <GoalHistoryPanel onOpenSource={openSourceFile} snapshot={snapshot} />
    : null;
  const collaborationBoundaryPanel = governancePanel(isCollaborationBoundaryTopic, "collaboration-boundary");
  const executionPermissionsPanel = governancePanel(isExecutionPermissionsTopic, "execution-permissions");
  const documentationRulesPanel = governancePanel(isDocumentationRulesTopic, "documentation-rules");
  const systemArchitecturePanel = governancePanel(isSystemArchitectureTopic, "system-architecture");
  const dataContractsPanel = governancePanel(isDataContractsTopic, "data-contracts");
  const codeStructurePanel = governancePanel(isCodeStructureTopic, "code-structure");
  const validationChecksPanel = governancePanel(isValidationChecksTopic, "validation-checks");
  const validationReportPanel = isValidationReportTopic ? <ValidationReportPanel onOpenSource={openSourceFile} snapshot={snapshot} /> : null;
  const runRecordsPanel = isRunRecordsTopic ? <RunRecordsPanel onOpenSource={openSourceFile} snapshot={snapshot} /> : null;
  const handoffRecordsPanel = governancePanel(isHandoffRecordsTopic, "handoff-records");
  const decisionRecordsPanel = governancePanel(isDecisionRecordsTopic, "decision-records");
  const lessonsLearnedPanel = governancePanel(isLessonsLearnedTopic, "lessons-learned");
  const memorySurfacePanel = isMemorySurfaceTopic ? <MemorySurfacePanel onOpenSource={openSourceFile} renderSourceButtons={sourceButtons} type={topicRouteId} /> : null;
  const assetSurfacePanel = isAssetSurfaceTopic ? <AssetSurfacePanel onOpenSource={openSourceFile} renderSourceButtons={sourceButtons} type={topicRouteId} /> : null;
  const agentConfigSurfacePanel = isAgentConfigSurfaceTopic ? <AgentConfigSurfacePanel agentRuns={agentRuns} mcpClient={mcpClient} mcpNative={mcpNative} onApproveAgentRun={onApproveAgentRun} onCancelAgentRun={onCancelAgentRun} onExportAgentRun={onExportAgentRun} onGetHermesExecutorStatus={onGetHermesExecutorStatus} onOpenSource={openSourceFile} onRefreshAgentRuns={onRefreshAgentRuns} projectId={snapshot?.currentProjectId} projectPath={snapshot?.currentProjectPath} renderSourceButtons={sourceButtons} type={topicRouteId} /> : null;
  const runbookPanel = isRunbookTopic && snapshot?.workspaceFacts
    ? <RunbookPanel onCopyCommand={onCopyText} onOpenSource={openSourceFile} onSendToTerminal={onPrepareTerminalCommand} report={snapshot.workspaceFacts} snapshot={snapshot} />
    : null;
  const riskBoundaryPanel = isRiskBoundaryTopic && snapshot?.workspaceFacts
    ? <RiskBoundaryPanel onOpenSource={openSourceFile} report={snapshot.workspaceFacts} snapshot={snapshot} />
    : null;
  const localProjectStatePanel = isLocalProjectStateTopic && snapshot?.workspaceFacts
    ? <LocalProjectStatePanel onOpenSource={openSourceFile} report={snapshot.workspaceFacts} snapshot={snapshot} />
    : null;
  const governanceFilesPanel = isGovernanceFilesTopic && snapshot?.workspaceFacts
    ? <GovernanceFilesHealthSection onCreateGovernanceTask={onCreateGovernanceTask} onReadEngineeringFile={onReadEngineeringFile} report={snapshot.workspaceFacts} />
    : null;
  const designImplementationPanel = isDesignImplementationTopic && snapshot?.workspaceFacts
    ? <DesignImplementationHealthSection onCreateDesignGovernanceTask={onCreateDesignGovernanceTask} onReadEngineeringFile={onReadEngineeringFile} report={snapshot.workspaceFacts} topic={selectedTopic} />
    : null;
  const componentLibraryPanel = isComponentLibraryTopic ? <ComponentGovernancePanel onNavigate={onNavigateWorkbench} /> : null;
  const tokenLibraryPanel = isTokenLibraryTopic ? <TokenGovernancePanel onNavigate={onNavigateWorkbench} /> : null;
  const agentTopic = <AgentTopicPanel
    activeTaskId={activeTaskId}
    agentRuns={agentRuns}
    composerModelAvailability={composerModelAvailability}
    handoffLoading={handoffLoading}
    onApproveAgentRun={onApproveAgentRun}
    onCancelAgentRun={onCancelAgentRun}
    onExportAgentRun={onExportAgentRun}
    onApplyPatchDraft={onApplyPatchDraft}
    onArchiveGoal={onArchiveGoal}
    onCreateGoal={onCreateGoal}
    onCreateRepairTask={onCreateRepairTask}
    onCreateTask={onCreateTask}
    onDeleteTask={onDeleteTask}
    onEnsureModelAvailable={onEnsureModelAvailable}
    onGeneratePatchDraft={onGeneratePatchDraft}
    onMarkTaskWaiting={onMarkTaskWaiting}
    onMergeGoal={onMergeGoal}
    onMergeHandoff={onMergeHandoff}
    onOpenCapabilityFile={previewRelatedFile}
    onOpenTaskConversation={onOpenTaskConversation}
    onPersistTask={onPersistTask}
    onRefreshWorkspace={onRefreshWorkspace}
    onRestoreGoal={onRestoreGoal}
    onResumeAgentRun={onResumeAgentRun}
    onRunGuardedCheck={onRunGuardedCheck}
    onSelectTask={onSelectTask}
    onUpdateGoal={onUpdateGoal}
    presentation={agentTopicPresentation}
    provider={provider}
    runnerLoadingId={runnerLoadingId}
    snapshot={snapshot}
    tasks={tasks}
    topic={selectedTopic}
    compact={isTaskExecutionTopic}
  />;
  const taskTitle = { "task-list": "目标与任务", "execution-terminal": "执行终端", "execution-results": "执行结果" }[topicRouteId];
  const taskDescription = { "task-list": "按目标查看任务进展与审核状态。", "execution-terminal": "在受控终端中运行命令并查看输出。", "execution-results": "查看完成或失败任务的验证结果与后续处理。" }[topicRouteId];
  const taskExecutionPanel = isTaskExecutionTopic ? <section className="overviewSurface taskExecutionSurface"><OverviewPageHeader title={taskTitle} description={taskDescription} meta={<span>任务状态变化时自动更新</span>} sources={<RuleSourceButtons onOpenSource={openSourceFile} sources={selectedTopic.relatedFiles || [".omnidesk/data/tasks/*"]} />} />{agentTopic}</section> : null;
  const capabilityPanel = surface === "agent-topic" ? agentTopic : null;
  const topicBody = <EngineeringTopicSurfaceComposer
    capabilityPanel={capabilityPanel}
    capabilitySupplementPanels={[currentProgressPanel, runbookPanel, governanceFilesPanel, designImplementationPanel, componentLibraryPanel, tokenLibraryPanel]}
    dedicatedPanels={[agentConfigSurfacePanel, assetSurfacePanel, memorySurfacePanel, taskExecutionPanel, currentGoalPanel, acceptanceCriteriaPanel, goalHistoryPanel, collaborationBoundaryPanel, executionPermissionsPanel, documentationRulesPanel, systemArchitecturePanel, dataContractsPanel, codeStructurePanel, validationChecksPanel, validationReportPanel, runRecordsPanel, handoffRecordsPanel, decisionRecordsPanel, lessonsLearnedPanel, currentProgressPanel, runbookPanel, riskBoundaryPanel, localProjectStatePanel, governanceFilesPanel, designImplementationPanel, componentLibraryPanel, tokenLibraryPanel]}
    fallback={<Notice variant="info">这是项目治理地图。用户只看事项，OmniDesk 在背后维护对应文件、状态来源和更新时机。</Notice>}
    isOverviewTopic={isOverviewTopic}
    overviewPanel={selectedTopic.id === "workbench-overview"
      ? <WorkspaceDashboard onNavigate={onNavigateWorkbench} onRequestProjectAccess={onRequestProjectAccess} snapshot={snapshot} taskStatuses={taskStatuses} tasks={tasks} />
      : <WorkspaceFactsPreview onNavigate={onNavigateWorkbench} onRefreshFacts={onRefreshWorkspaceFacts} report={workspaceFacts} snapshot={snapshot} />}
    topicPanel={agentTopic}
  />;
  return <EngineeringTopicFrame
    isCurrentProgressTopic={isCurrentProgressTopic}
    onPreviewRelatedFile={previewRelatedFile}
    relatedFilePreview={relatedFilePreview}
    selectedTopic={selectedTopic}
    selectedTopicGroupLabel={selectedTopicGroupLabel}
    usesDedicatedSurface={usesDedicatedSurface}
  >
    {topicBody}
  </EngineeringTopicFrame>;
}
