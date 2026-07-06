import React, { useMemo, useState } from "react";
import { Bot, BookOpen, Brain, CheckCircle2, ChevronsDownUp, ChevronsUpDown, ClipboardList, FileStack, Package, Settings, ShieldCheck, TerminalSquare, Wrench } from "lucide-react";
import { Button } from "../ui/button";
import { SectionTitle } from "../ui/section-title";
import { Tooltip } from "../ui/tooltip";

const iconMap = {
  book: BookOpen,
  bot: Bot,
  brain: Brain,
  check: CheckCircle2,
  clipboard: ClipboardList,
  files: FileStack,
  package: Package,
  settings: Settings,
  shield: ShieldCheck,
  terminal: TerminalSquare,
  wrench: Wrench,
};

function iconFor(node) {
  return iconMap[node.icon] || ClipboardList;
}

function topicKey(parts) {
  return parts.filter(Boolean).join("/");
}

function nodeKey(node, fallback = "") {
  return node?.id || fallback || node?.title || "";
}

function itemKey({ child, item, node }) {
  return item.id || topicKey([nodeKey(node, node.title), child ? nodeKey(child, child.title) : "", item.title]);
}

function collectTopicKeys(outline) {
  return outline.flatMap((node) => {
    const childKeys = (node.children || []).flatMap((child) => (
      child.items || []
    ).map((item) => itemKey({ child, item, node })));
    const ownKeys = (node.items || []).map((item) => itemKey({ item, node }));
    return [...childKeys, ...ownKeys];
  });
}

export function WorkspaceTree({ activeTopicPath, onSelectTopic, outline }) {
  const [sectionOpen, setSectionOpen] = useState(true);
  const firstNode = outline[0];
  const [activeNodeId, setActiveNodeId] = useState(firstNode?.id || firstNode?.title || "");
  const [activeChildByNode, setActiveChildByNode] = useState({});
  const [nodeOpenByKey, setNodeOpenByKey] = useState({});
  const [topicOpenByKey, setTopicOpenByKey] = useState({});
  const allTopicKeys = useMemo(() => collectTopicKeys(outline), [outline]);
  const allTopicsOpen = allTopicKeys.length > 0 && allTopicKeys.every((key) => topicOpenByKey[key]);

  const isNodeOpen = (key) => nodeOpenByKey[key] !== false;
  const isTopicOpen = (key) => topicOpenByKey[key] === true;
  const expandedMode = allTopicsOpen;

  const toggleAllTopics = () => {
    const nextOpen = !allTopicsOpen;
    setTopicOpenByKey(Object.fromEntries(allTopicKeys.map((key) => [key, nextOpen])));
    if (nextOpen) {
      setNodeOpenByKey(Object.fromEntries(outline.map((node) => [node.id || node.title, true])));
    } else {
      setNodeOpenByKey({});
    }
  };

  const openTopic = ({ child, item, node }) => {
    const path = itemKey({ child, item, node });
    onSelectTopic({
      description: item.description,
      group: child?.title || node.title,
      id: item.id,
      path,
      statusSource: item.statusSource || child?.statusSource || node.statusSource,
      updatesWhen: item.updatesWhen || child?.updatesWhen || node.updatesWhen,
      relatedFiles: item.relatedFiles || [],
      title: item.title,
      virtual: true,
    });
  };

  const renderTopics = (node, child) => {
    const items = child.items || [];
    if (!items.length) return null;

    return (
      <div className="treeDetail" aria-label={`${child.title}事项`}>
        <div className="treeFileList">
          {items.map((item) => {
            const path = itemKey({ child, item, node });
            return (
              <button
                className={`treeFile treeTopic${activeTopicPath === path ? " active" : ""}`}
                key={path}
                onClick={() => openTopic({ child, item, node })}
                title={item.description}
                type="button"
              >
                {item.title}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="leftRailSection">
      <SectionTitle
        title="工作区"
        open={sectionOpen}
        onToggle={() => setSectionOpen((value) => !value)}
        toggleLabel={sectionOpen ? "收起工作区" : "展开工作区"}
        actions={(
          <Tooltip content={allTopicsOpen ? "收起全部子项" : "展开全部子项"}>
            <Button
              className="sectionIconAction"
              size="icon"
              variant="ghost"
              type="button"
              onClick={toggleAllTopics}
              aria-label={allTopicsOpen ? "收起全部子项" : "展开全部子项"}
            >
              {allTopicsOpen
                ? <ChevronsDownUp strokeWidth={2.25} aria-hidden="true" />
                : <ChevronsUpDown strokeWidth={2.25} aria-hidden="true" />}
            </Button>
          </Tooltip>
        )}
      />
      {sectionOpen ? (
      <nav className="flowNav workspaceTree" aria-label="工作区">
      {outline.map((node) => {
        const NodeIcon = iconFor(node);
        const nodeId = nodeKey(node);
        const isActive = activeNodeId === nodeId || expandedMode;
        const children = node.children || [];
        const hasChildren = children.length > 0;
        const showChildren = hasChildren && isActive && isNodeOpen(nodeId);
        const activeChild = activeChildByNode[nodeId] || nodeKey(children[0]);
        const ownTopicOpen = (node.items || []).some((item) => isTopicOpen(itemKey({ item, node })));

        return (
          <div className="workspaceGroup treeNode treeNode-root" key={nodeId}>
            <button
              className={`flowItem treeRow${isActive ? " active" : ""}`}
              onClick={() => {
                if (isActive) {
                  if (hasChildren) {
                    setNodeOpenByKey((current) => ({ ...current, [nodeId]: current[nodeId] === false }));
                  } else if (node.items?.length) {
                    const keys = node.items.map((item) => topicKey([node.title, item.title]));
                    const nextOpen = !keys.every((key) => isTopicOpen(key));
                    setTopicOpenByKey((current) => ({ ...current, ...Object.fromEntries(keys.map((key) => [key, nextOpen])) }));
                  }
                  return;
                }
                setActiveNodeId(nodeId);
                if (hasChildren) setNodeOpenByKey((current) => ({ ...current, [nodeId]: true }));
              }}
              type="button"
            >
              <span className="flowIcon" aria-hidden="true">
                <NodeIcon strokeWidth={2.25} />
              </span>
              <span className="flowText">{node.title}</span>
              <span className="flowMeta">{node.meta}</span>
            </button>
            {showChildren ? (
              <div className="inlineFlowDetail treeChildren">
                <nav className="flowNav governanceNav" aria-label={`${node.title}子项`}>
                  {children.map((child) => {
                    const ChildIcon = iconFor(child);
                    const childId = nodeKey(child);
                    const childActive = childId === activeChild;
                    const childTopicKeys = (child.items || []).map((item) => itemKey({ child, item, node }));
                    const showTopics = childTopicKeys.some((key) => isTopicOpen(key));

                    return (
                      <div className="flowTreeNode treeNode" key={childId}>
                        <button
                          className={`flowItem flowItem-compact treeRow${childActive ? " active" : ""}`}
                          onClick={() => {
                            if (childActive) {
                              const nextOpen = !childTopicKeys.every((key) => isTopicOpen(key));
                              setTopicOpenByKey((current) => ({ ...current, ...Object.fromEntries(childTopicKeys.map((key) => [key, nextOpen])) }));
                              return;
                            }
                            setActiveChildByNode((current) => ({ ...current, [nodeId]: childId }));
                            setTopicOpenByKey((current) => ({ ...current, ...Object.fromEntries(childTopicKeys.map((key) => [key, true])) }));
                          }}
                          type="button"
                        >
                          <span className="flowIcon" aria-hidden="true">
                            <ChildIcon strokeWidth={2.25} />
                          </span>
                          <span className="flowText">{child.title}</span>
                          <span className="flowMeta">{child.meta}</span>
                        </button>
                        {showTopics ? (
                          <div className="flowNodeDetail treeChildren">
                            {renderTopics(node, child)}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </nav>
              </div>
            ) : ownTopicOpen ? (
              <div className="inlineFlowDetail">
                {renderTopics(node, node)}
              </div>
            ) : null}
          </div>
        );
      })}
      </nav>
      ) : null}
    </div>
  );
}
