export const initialWorkspaceTabs = [
  { id: "plan", title: "对话", kind: "conversation", closable: false },
  { id: "terminal", title: "终端", kind: "terminal", closable: false },
];

export function upsertWorkspaceFileTab(tabs, file, { id, title }) {
  const nextTab = { file, id, title, kind: "file", closable: true };
  return tabs.some((tab) => tab.id === id)
    ? tabs.map((tab) => (tab.id === id ? { ...tab, ...nextTab } : tab))
    : [...tabs, nextTab];
}

export function closeWorkspaceTabState({ activeTabId, tabId, tabs }) {
  const tab = tabs.find((item) => item.id === tabId);
  if (!tab?.closable) return { activeTabId, tabs };
  return {
    activeTabId: activeTabId === tabId ? "plan" : activeTabId,
    tabs: tabs.filter((item) => item.id !== tabId),
  };
}

export function clearTransientWorkspaceTabs(tabs) {
  return tabs.filter((tab) => !["file", "task"].includes(tab.kind));
}

export function workspaceTabSelection(tabs, tabId) {
  return tabs.find((tab) => tab.id === tabId) || null;
}
