import React from "react";
import { Notice } from "../ui/notice";
import { TabsContent } from "../ui/tabs";

const TerminalDock = React.lazy(() => import("./terminal-dock").then((module) => ({ default: module.TerminalDock })));

export function AgentWorkspaceAuxiliaryTabs({
  activeWorkspaceTab,
  renderFileTab,
  terminal,
  tabs,
  trace = [],
}) {
  return tabs.filter((tab) => tab.id !== "plan").map((tab) => {
    if (tab.kind === "file") return renderFileTab(tab);
    if (tab.kind === "terminal") {
      return (
        <TabsContent className="workspaceTabContent terminalWorkspace" key={tab.id} value={tab.id}>
          <React.Suspense fallback={<Notice variant="muted">正在载入本地终端...</Notice>}>
            <TerminalDock active={activeWorkspaceTab === tab.id} {...terminal} />
          </React.Suspense>
        </TabsContent>
      );
    }
    if (tab.kind === "diff") return <TabsContent className="workspaceTabContent agentCanvas emptyWorkspacePanel" key={tab.id} value={tab.id}><Notice variant="muted">生成改动后，会在这里预览。</Notice></TabsContent>;
    if (tab.kind === "checks") return <TabsContent className="workspaceTabContent agentCanvas emptyWorkspacePanel" key={tab.id} value={tab.id}><Notice variant="muted">运行检查会在确认计划后显示可执行项。</Notice></TabsContent>;
    if (tab.kind === "trace") return <TabsContent className="workspaceTabContent agentCanvas emptyWorkspacePanel" key={tab.id} value={tab.id}><div className="terminal conversationTerminal">{trace.map((line) => <div key={line}>{line}</div>)}</div></TabsContent>;
    return null;
  });
}
