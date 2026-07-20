import React from "react";
import { ArrowRight, FileText, RefreshCw } from "lucide-react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Tooltip } from "../ui/tooltip";
import { selectProjectRefreshControl } from "../../project-overview-selectors";
import { OverviewPageHeader, OverviewSection, OverviewTagList } from "./overview-section";

function actionMap(actions) {
  return Object.fromEntries(actions.map((action) => [action.id, action.handler]));
}

export function ProjectOverviewHeader({ actions, model, refreshError, refreshState, refreshing }) {
  const handlers = actionMap(actions);
  const refreshControl = selectProjectRefreshControl({
    freshness: model.state.freshness,
    refreshing,
    refreshState,
  });
  const updatedAt = model.updatedAt
    ? new Date(model.updatedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "尚未记录";
  return (
    <OverviewPageHeader
      title={model.name}
      description={model.description}
      meta={(
        <>
          <Badge className="projectOverviewVersionBadge">{model.version ? `v${model.version}` : "版本待补充"}</Badge>
          <span>更新于 {updatedAt}</span>
          {refreshControl.statusLabel ? <span className={`projectOverviewRefreshStatus tone-${refreshControl.tone}`}>{refreshControl.statusLabel}</span> : null}
        </>
      )}
      status={<Badge>{model.phase.label}</Badge>}
      actions={(
        <>
          {refreshControl.tone === "danger" ? (
            <span className="projectOverviewRefreshError" role="alert" title={refreshError || "项目事实更新失败，请重试。"}>
              {refreshError || "项目事实更新失败"}
            </span>
          ) : null}
          {refreshControl.mode === "primary" ? (
            <Button size="sm" variant="primary" type="button" disabled={refreshControl.disabled} onClick={handlers["refresh-project-facts"]}>
              {refreshControl.actionLabel}
            </Button>
          ) : null}
          {refreshControl.mode === "icon" ? (
            <Tooltip content="重新扫描项目">
              <Button aria-label="重新扫描项目" size="icon" variant="ghost" type="button" onClick={handlers["refresh-project-facts"]}>
                <RefreshCw aria-hidden="true" size={15} />
              </Button>
            </Tooltip>
          ) : null}
        </>
      )}
      sources={(
        <div aria-label="项目概览来源">
          {model.sources.length ? model.sources.map((source) => (
            <button type="button" key={source} onClick={() => handlers["open-source"]?.(source)}>
              <FileText aria-hidden="true" size={12} />
              <span>{source}</span>
            </button>
          )) : <span>项目档案</span>}
        </div>
      )}
    />
  );
}

export function ProjectOverviewSectionSlot({ actions, model }) {
  const handlers = actionMap(actions);
  const mono = model.id === "project-overview.engineering-structure";
  return (
    <OverviewSection
      title={model.title}
      subtitle={model.subtitle}
      actions={model.action === "open-architecture" ? (
        <Button size="sm" type="button" variant="ghost" onClick={handlers["open-architecture"]}>查看架构详情<ArrowRight size={13} /></Button>
      ) : null}
      items={model.items.map((item) => ({
        id: item.id,
        label: item.label,
        content: Array.isArray(item.value) ? <OverviewTagList mono={mono} items={item.value} /> : item.value,
      }))}
    />
  );
}

export function ProjectOverviewSlotRenderer({ descriptors, refreshError, refreshState, refreshing }) {
  return descriptors.map((descriptor) => {
    const Component = descriptor.component;
    return (
      <Component
        key={descriptor.id}
        actions={descriptor.actions}
        model={descriptor.props}
        refreshError={refreshError}
        refreshState={refreshState}
        refreshing={refreshing}
      />
    );
  });
}
