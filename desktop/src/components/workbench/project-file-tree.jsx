import React, { useState } from "react";
import { ChevronRight } from "lucide-react";

export function ProjectFileTree({ activePath, expanded, snapshot, onSelectFile }) {
  const [query, setQuery] = useState("");
  const [openFolders, setOpenFolders] = useState({});
  const [closedFolders, setClosedFolders] = useState({});
  const tree = Array.isArray(snapshot?.tree) ? snapshot.tree : [];
  const stack = [];
  const rows = tree.map((item, index) => {
    const depth = Number.isFinite(item.depth) ? item.depth : 0;
    const parentPath = depth <= 1 ? "" : stack[depth - 1] || "";
    const path = depth === 0 ? "" : [parentPath, item.label].filter(Boolean).join("/");
    stack[depth] = path;
    stack.length = depth + 1;
    return {
      ...item,
      depth,
      id: `${path || item.label}-${index}`,
      path,
    };
  });
  const normalizedQuery = query.trim().toLowerCase();
  const isFolderOpen = (path) => (expanded ? !closedFolders[path] : Boolean(openFolders[path]));
  const visibleByFolder = (item) => {
    if (item.depth <= 1) return true;
    const parts = item.path.split("/");
    for (let index = 1; index < parts.length; index += 1) {
      const folderPath = parts.slice(0, index).join("/");
      if (!isFolderOpen(folderPath)) return false;
    }
    return true;
  };
  const visibleRows = normalizedQuery
    ? rows.filter((item) => `${item.label} ${item.path}`.toLowerCase().includes(normalizedQuery))
    : rows.filter(visibleByFolder);

  return (
    <section className="projectFileTree" aria-label="项目文件">
      <div className="projectFileSearch">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="筛选文件..."
          aria-label="筛选文件"
        />
      </div>
      <div className="projectFileTreeList">
        {visibleRows.map((item) => {
          const isFolder = item.kind === "folder";
          const isActive = !isFolder && activePath === item.path;
          const isOpen = isFolder && isFolderOpen(item.path);
          return (
            <button
              className={`projectFileTreeRow${isFolder ? " folder" : " file"}${isActive ? " active" : ""}${isOpen ? " open" : ""}`}
              key={item.id}
              type="button"
              style={{ "--tree-depth": Math.max(item.depth - 1, 0) }}
              onClick={() => {
                if (isFolder) {
                  if (expanded) {
                    setClosedFolders((current) => ({ ...current, [item.path]: !current[item.path] }));
                  } else {
                    setOpenFolders((current) => ({ ...current, [item.path]: !current[item.path] }));
                  }
                  return;
                }
                if (!item.path) return;
                onSelectFile?.({
                  description: "当前项目文件",
                  group: "项目文件",
                  path: item.path,
                });
              }}
              title={item.path || item.label}
            >
              <span className="projectFileTreeChevron" aria-hidden="true">
                {isFolder ? <ChevronRight strokeWidth={2} /> : null}
              </span>
              <span className="projectFileTreeName">{item.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
