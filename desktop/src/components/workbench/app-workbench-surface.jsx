import React from "react";
import { AppShell } from "./app-shell";

/** Composes the three Workbench slots without owning domain state. */
export function AppWorkbenchSurface({
  actionFeedback,
  agentWorkspace,
  leftCollapsed,
  leftWidth,
  projectSidebar,
  rightCollapsed,
  rightRail,
  rightWidth,
  statusBar,
  toast,
  topBar,
}) {
  return (
    <AppShell
      actionFeedback={actionFeedback}
      agentWorkspace={agentWorkspace}
      leftCollapsed={leftCollapsed}
      leftWidth={leftWidth}
      projectSidebar={projectSidebar}
      rightCollapsed={rightCollapsed}
      rightRail={rightRail}
      rightWidth={rightWidth}
      statusBar={statusBar}
      toast={toast}
      topBar={topBar}
    />
  );
}
