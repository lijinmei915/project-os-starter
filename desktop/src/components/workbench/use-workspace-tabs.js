import { useCallback, useEffect, useState } from "react";
import { measureDesktopPerformance } from "../../lib/performance-baseline";
import { clearTransientWorkspaceTabs, closeWorkspaceTabState, initialWorkspaceTabs, upsertWorkspaceFileTab, workspaceTabSelection } from "../../lib/workspace-tab-state";

export function useWorkspaceTabs({ onSelectEngineeringFile, onSelectTask, selectedEngineeringFile, workspaceFileTabId, workspaceFileTabTitle }) {
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState("plan");
  const [workspaceTabs, setWorkspaceTabs] = useState(initialWorkspaceTabs);
  const [pendingRouteMeasure, setPendingRouteMeasure] = useState(null);

  useEffect(() => {
    if (!pendingRouteMeasure || pendingRouteMeasure.tabId !== activeWorkspaceTab) return;
    pendingRouteMeasure.finish({ tabId: activeWorkspaceTab });
    setPendingRouteMeasure(null);
  }, [activeWorkspaceTab, pendingRouteMeasure]);

  useEffect(() => {
    if (!selectedEngineeringFile) {
      setActiveWorkspaceTab("plan");
      return;
    }
    const id = workspaceFileTabId(selectedEngineeringFile);
    setWorkspaceTabs((current) => upsertWorkspaceFileTab(current, selectedEngineeringFile, { id, title: workspaceFileTabTitle(selectedEngineeringFile) }));
    setActiveWorkspaceTab(id);
  }, [selectedEngineeringFile, workspaceFileTabId, workspaceFileTabTitle]);

  const closeWorkspaceTab = useCallback((event, tabId) => {
    event.preventDefault();
    event.stopPropagation();
    setWorkspaceTabs((current) => {
      const next = closeWorkspaceTabState({ activeTabId: activeWorkspaceTab, tabId, tabs: current });
      setActiveWorkspaceTab(next.activeTabId);
      return next.tabs;
    });
  }, [activeWorkspaceTab]);

  const changeWorkspaceTab = useCallback((tabId) => {
    setPendingRouteMeasure({ finish: measureDesktopPerformance("workspace-route"), tabId });
    setActiveWorkspaceTab(tabId);
    const nextTab = workspaceTabSelection(workspaceTabs, tabId);
    if (nextTab?.kind === "file" && nextTab.file) onSelectEngineeringFile?.(nextTab.file);
    if (nextTab?.kind === "task" && nextTab.taskId) onSelectTask?.(nextTab.taskId, { preserveWorkspace: true });
  }, [onSelectEngineeringFile, onSelectTask, workspaceTabs]);

  const resetWorkspaceTabs = useCallback(() => {
    setActiveWorkspaceTab("plan");
    setWorkspaceTabs(clearTransientWorkspaceTabs);
  }, []);

  return { activeWorkspaceTab, changeWorkspaceTab, closeWorkspaceTab, resetWorkspaceTabs, setActiveWorkspaceTab, setWorkspaceTabs, workspaceTabs };
}
