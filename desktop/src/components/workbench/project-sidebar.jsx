import React, { useEffect } from "react";
import {
  Activity,
  ArrowLeftRight,
  Brain,
  ClipboardList,
  ChevronsDownUp,
  ChevronsUpDown,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
} from "lucide-react";
import { Button } from "../ui/button";
import { SectionGroup } from "../ui/section-title";
import { Tooltip } from "../ui/tooltip";
import {
  projectGovernanceOutline,
  workspaceOutlineForCapabilities,
} from "../../workspace-outline";
import {
  discoverableProjectCapabilities,
  projectRuntimeStatus,
} from "../../lib/project-sidebar-view-model";
import * as workspaceRegistryClient from "../../lib/workspace-registry-client";
import { ProjectAccessDialogs } from "./project-access-dialogs";
import { ProjectCapabilityDialog } from "./project-capability-dialog";
import { ProjectFileTree } from "./project-file-tree";
import { ProjectList } from "./project-list";
import { useProjectPathCopy } from "./use-project-path-copy";
import { useProjectSidebarState } from "./use-project-sidebar-state";
import { WorkspaceTree } from "./workspace-tree";

export function ProjectSidebar({
  capabilityDescriptions,
  capabilityLabels,
  collapsed,
  copyTextToSystemClipboard,
  onOpenProjectFolder,
  onPickProject,
  onProjectActionError,
  onProjectActivitySeen,
  onProjectPathCopied,
  onRelocateProject,
  onRemoveProject,
  onRenameProject,
  onResizeStart,
  onSelectEngineeringFile,
  onSwitchProject,
  onToggleCollapsed,
  onUpdateCapability,
  planLoading,
  projectActionError,
  projectActivities = {},
  selectedEngineeringFile,
  snapshot,
  taskStatuses,
  tasks = [],
  terminalRunningId,
  workspaceModuleLabels,
}) {
  const {
    accessDialogOpen,
    accessSettingsProject,
    capabilityDialogOpen,
    capabilityLoadingId,
    confirmControlledProjectAccess,
    confirmProjectAccess,
    connectedProjectAccess,
    controlledConfirmOpen,
    dismissCapability,
    enableCapability,
    openExistingProject,
    openProjectAccessSettings,
    fileTreeExpanded,
    openRenameDialog,
    projectsOpen,
    renameName,
    renameProject,
    projectScan,
    selectedProjectAccessMode,
    selectedModulesByCapability,
    setAccessSettingsProject,
    setCapabilityDialogOpen,
    setFileTreeExpanded,
    setProjectAccessDialogOpen,
    setControlledConfirmOpen,
    setSelectedProjectAccessMode,
    setName,
    setProjectsOpen,
    setRenameProject,
    setSidebarView,
    setSelectedModulesByCapability,
    sidebarView,
    startProjectAccess,
    submitRename,
    changeProjectAccess,
  } = useProjectSidebarState({
    onPickProject,
    onPreviewProject: workspaceRegistryClient.previewWorkspaceProject,
    onRenameProject,
    onSwitchProject,
    onUpdateCapability,
    projects: snapshot.projects,
  });

  useProjectPathCopy({
    copyTextToSystemClipboard,
    onProjectActionError,
    onProjectPathCopied,
  });

  useEffect(() => {
    window.addEventListener(
      "omnidesk:request-project-access",
      startProjectAccess,
    );
    return () =>
      window.removeEventListener(
        "omnidesk:request-project-access",
        startProjectAccess,
      );
  }, [startProjectAccess]);

  const projectStatus = (project) =>
    projectRuntimeStatus(project, {
      planLoading,
      projectActivities,
      taskStatuses,
      tasks,
      terminalRunningId,
    });
  const discoverableCapabilities = discoverableProjectCapabilities(
    snapshot,
    capabilityLabels,
  );
  const recommendationCount = discoverableCapabilities.filter(
    (capability) => capability.status !== "available",
  ).length;

  if (collapsed) {
    return (
      <aside className="left left-collapsed" aria-label="左侧工作区已折叠">
        <div className="collapsedRail">
          <Tooltip content="项目">
            <button
              className="collapsedRailItem active"
              type="button"
              onClick={onToggleCollapsed}
              aria-label="项目"
            >
              <Package strokeWidth={2.15} aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip content="项目流程">
            <button
              className="collapsedRailItem"
              type="button"
              onClick={onToggleCollapsed}
              aria-label="项目流程"
            >
              <ClipboardList strokeWidth={2.15} aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip content="记忆">
            <button
              className="collapsedRailItem"
              type="button"
              onClick={onToggleCollapsed}
              aria-label="记忆"
            >
              <Brain strokeWidth={2.15} aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip content="展开工作区">
            <Button
              className="railToggleButton sideCornerButton"
              size="icon"
              variant="ghost"
              type="button"
              onClick={onToggleCollapsed}
              aria-label="展开工作区"
            >
              <PanelLeftOpen strokeWidth={1.75} aria-hidden="true" />
            </Button>
          </Tooltip>
        </div>
      </aside>
    );
  }

  return (
    <aside className="left">
      <div className="leftScroll">
        <button
          className={`uiSectionTitle leftRailSection workbenchRootLink${selectedEngineeringFile?.path === "workbench-overview" ? " active" : ""}`}
          type="button"
          onClick={() =>
            onSelectEngineeringFile?.({
              description: "跨项目状态与下一步入口。",
              group: "工作台",
              id: "workbench-overview",
              path: "workbench-overview",
              title: "工作台",
              virtual: true,
            })
          }
        >
          <Activity strokeWidth={1.8} aria-hidden="true" />
          <span>工作台</span>
        </button>
        <SectionGroup
          className="leftRailSection projectRailSection"
          title="项目"
          meta={snapshot.projects.length}
          open={projectsOpen}
          onToggle={() => setProjectsOpen((value) => !value)}
          toggleLabel={projectsOpen ? "收起项目" : "展开项目"}
          actions={
            <Tooltip content="添加项目">
              <button
                className="sectionIconAction projectAddHeaderButton"
                type="button"
                onClick={startProjectAccess}
                aria-label="添加项目"
              >
                <Plus strokeWidth={1.75} aria-hidden="true" />
              </button>
            </Tooltip>
          }
        >
          <ProjectList
            onActivitySeen={onProjectActivitySeen}
            onOpenFolder={onOpenProjectFolder}
            onRelocate={onRelocateProject}
            onRemove={onRemoveProject}
            onRename={openRenameDialog}
            onSelect={onSwitchProject}
            onSettings={openProjectAccessSettings}
            projects={snapshot.projects}
            projectStatus={projectStatus}
          />
          {projectActionError ? (
            <div className="projectError">{projectActionError}</div>
          ) : null}
        </SectionGroup>
        <ProjectAccessDialogs
          onSelectEngineeringFile={onSelectEngineeringFile}
          state={{
            accessDialogOpen,
            accessSettingsProject,
            changeProjectAccess,
            confirmControlledProjectAccess,
            confirmProjectAccess,
            connectedProjectAccess,
            controlledConfirmOpen,
            openExistingProject,
            projectScan,
            renameName,
            renameProject,
            selectedProjectAccessMode,
            setAccessSettingsProject,
            setControlledConfirmOpen,
            setName,
            setProjectAccessDialogOpen,
            setRenameProject,
            setSelectedProjectAccessMode,
            submitRename,
          }}
        />

        {sidebarView === "workspace" ? (
          <>
            <WorkspaceTree
              actions={
                <Tooltip
                  content={
                    recommendationCount
                      ? `更多能力，${recommendationCount} 项建议`
                      : "更多能力"
                  }
                >
                  <Button
                    className="sectionIconAction"
                    size="icon"
                    variant="ghost"
                    type="button"
                    onClick={() => setCapabilityDialogOpen(true)}
                    aria-label="更多能力"
                  >
                    <Plus aria-hidden="true" size={15} />
                  </Button>
                </Tooltip>
              }
              inlineAction={
                <Tooltip content="切换到项目文件">
                  <button
                    className="sectionInlineSwitch"
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setSidebarView("files");
                    }}
                    aria-label="切换到项目文件"
                  >
                    <ArrowLeftRight strokeWidth={1.5} aria-hidden="true" />
                  </button>
                </Tooltip>
              }
              activeTopicPath={selectedEngineeringFile?.path}
              onSelectTopic={onSelectEngineeringFile}
              outline={workspaceOutlineForCapabilities(
                projectGovernanceOutline
                  .filter((node) => node.id !== "workbench-overview")
                  .map((node) =>
                    node.id === "project-governance"
                      ? {
                          ...node,
                          children: (node.children || []).filter(
                            (child) => child.id !== "define-goal",
                          ),
                        }
                      : node,
                  ),
                snapshot?.projectCapabilities,
              )}
              sectionTitle="工作区"
              snapshot={snapshot}
            />
            <ProjectCapabilityDialog
              capabilities={discoverableCapabilities}
              descriptions={capabilityDescriptions}
              labels={capabilityLabels}
              loadingId={capabilityLoadingId}
              moduleLabels={workspaceModuleLabels}
              onDismiss={dismissCapability}
              onEnable={enableCapability}
              onOpenChange={setCapabilityDialogOpen}
              onSelectedModulesChange={(
                capabilityId,
                candidates,
                checked,
                moduleId,
              ) =>
                setSelectedModulesByCapability((current) => ({
                  ...current,
                  [capabilityId]: checked
                    ? [
                        ...new Set([
                          ...(current[capabilityId] || candidates),
                          moduleId,
                        ]),
                      ]
                    : (current[capabilityId] || candidates).filter(
                        (id) => id !== moduleId,
                      ),
                }))
              }
              open={capabilityDialogOpen}
              selectedModulesByCapability={selectedModulesByCapability}
              snapshot={snapshot}
            />
          </>
        ) : (
          <SectionGroup
            className="leftRailSection"
            title="项目文件"
            open
            onToggle={() => setSidebarView("workspace")}
            inlineAction={
              <Tooltip content="切换到工作区">
                <button
                  className="sectionInlineSwitch"
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setSidebarView("workspace");
                  }}
                  aria-label="切换到工作区"
                >
                  <ArrowLeftRight strokeWidth={1.5} aria-hidden="true" />
                </button>
              </Tooltip>
            }
            actions={
              <Tooltip
                content={fileTreeExpanded ? "收起全部子项" : "展开全部子项"}
              >
                <Button
                  className="sectionIconAction"
                  size="icon"
                  variant="ghost"
                  type="button"
                  onClick={() => setFileTreeExpanded((value) => !value)}
                  aria-label={
                    fileTreeExpanded ? "收起全部子项" : "展开全部子项"
                  }
                >
                  {fileTreeExpanded ? (
                    <ChevronsDownUp strokeWidth={1.75} aria-hidden="true" />
                  ) : (
                    <ChevronsUpDown strokeWidth={1.75} aria-hidden="true" />
                  )}
                </Button>
              </Tooltip>
            }
            toggleLabel="切换到工作区"
          >
            <ProjectFileTree
              activePath={selectedEngineeringFile?.path}
              expanded={fileTreeExpanded}
              snapshot={snapshot}
              onSelectFile={onSelectEngineeringFile}
            />
          </SectionGroup>
        )}
      </div>
      <Tooltip content="折叠工作区">
        <Button
          className="sideCornerButton sideCornerButton-left"
          size="icon"
          variant="ghost"
          type="button"
          onClick={onToggleCollapsed}
          aria-label="折叠工作区"
        >
          <PanelLeftClose strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </Tooltip>
      <div
        className="sidebarResizer sidebarResizer-left"
        role="separator"
        aria-label="拖拽调整左侧宽度"
        onPointerDown={onResizeStart}
      />
    </aside>
  );
}
