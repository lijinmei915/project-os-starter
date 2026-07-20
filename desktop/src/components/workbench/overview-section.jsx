import React from "react";

import { cn } from "../../lib/cn";

export function OverviewTagList({ items = [], mono = false }) {
  return (
    <div className={cn("overviewTagList", mono && "overviewTagList-mono")}>
      {items.filter(Boolean).map((item) => <span key={item}>{item}</span>)}
    </div>
  );
}

export function OverviewPageHeader({ actions, description, meta, sources, status, title }) {
  return (
    <header className="projectOverviewPageHeader">
      <div className="projectOverviewPageTopline">
        <div className="projectOverviewTitleGroup">
          <h2>{title}</h2>
          {meta}
        </div>
        <div className="projectOverviewPageActions">
          {status}
          {actions}
        </div>
      </div>
      {description ? <p>{description}</p> : null}
      {sources ? <div className="projectOverviewSourceRow">{sources}</div> : null}
    </header>
  );
}

export function OverviewSection({ actions, className, items = [], subtitle, title }) {
  const visibleItems = items
    .filter((item) => item?.content !== undefined && item?.content !== null && item?.content !== "")
    .slice(0, 3);
  const hideItemLabels = visibleItems.length === 1;

  return (
    <section className={cn("overviewSection", className)}>
      <header className="overviewSectionHeader">
        <div>
          <strong>{title}</strong>
          {subtitle ? <span>{subtitle}</span> : null}
        </div>
        {actions ? <div className="overviewSectionActions">{actions}</div> : null}
      </header>
      <div className="overviewSectionGrid" style={{ "--overview-section-columns": Math.max(1, Math.min(3, visibleItems.length)) }}>
        {visibleItems.map((item, index) => {
          const Item = item.onClick ? "button" : "div";
          return (
            <Item
              className={cn("overviewSectionItem", item.className)}
              key={item.id || item.label || index}
              type={item.onClick ? "button" : undefined}
              onClick={item.onClick}
            >
              {!hideItemLabels && item.label ? <span>{item.label}</span> : null}
              {React.isValidElement(item.content)
                ? <div className="overviewSectionItemContent">{item.content}</div>
                : <p>{item.content}</p>}
            </Item>
          );
        })}
      </div>
    </section>
  );
}
