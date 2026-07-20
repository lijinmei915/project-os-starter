import { TooltipProvider } from "../ui/tooltip";

/** Layout-only shell. Domain surfaces are supplied as slots by App. */
export function AppShell({
  topBar,
  projectSidebar,
  agentWorkspace,
  rightRail,
  leftCollapsed,
  rightCollapsed,
  leftWidth,
  rightWidth,
  actionFeedback,
  toast,
  statusBar,
}) {
  return (
    <TooltipProvider>
      <div className="shell">
        {topBar}
        <main
          className={`workspace${leftCollapsed ? " leftCollapsed" : ""}${rightCollapsed ? " rightCollapsed" : ""}`}
          style={{
            "--desktop-layout-sidebar-left": `${leftWidth}px`,
            "--desktop-layout-sidebar-right": `${rightWidth}px`,
          }}
        >
          {projectSidebar}
          {agentWorkspace}
          {rightRail}
        </main>
        {actionFeedback}
        {toast}
        {statusBar}
      </div>
    </TooltipProvider>
  );
}
