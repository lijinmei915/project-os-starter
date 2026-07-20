import { X } from "lucide-react";
import { TabsList, TabsTrigger } from "../ui/tabs";

export function WorkspaceTabStrip({ onCloseTab, tabs }) {
  return (
    <TabsList className="tabs" aria-label="工作区视图">
      {tabs.map((tab) => {
        const tabTitle = tab.title;
        return (
          <TabsTrigger className={`tab workspaceTab ${tab.kind === "file" ? "fileTab" : ""}${tab.closable ? " closable" : ""}`} key={tab.id} value={tab.id}>
            <span>{tabTitle}</span>
            {tab.closable ? (
              <button aria-label={`关闭 ${tabTitle}`} className="workspaceTabClose" type="button" onClick={(event) => onCloseTab(event, tab.id)}>
                <X strokeWidth={2} aria-hidden="true" />
              </button>
            ) : null}
          </TabsTrigger>
        );
      })}
    </TabsList>
  );
}
