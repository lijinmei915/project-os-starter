import React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../../lib/cn";

export function SectionTitle({ actions, className, collapseControl, meta, onToggle, open, title, toggleLabel }) {
  const canToggle = typeof onToggle === "function";
  const titleContent = (
    <>
      {canToggle ? (
        <span className={`sectionChevronAction sectionChevronAction-static${open ? " open" : ""}`} aria-hidden="true">
          <ChevronRight strokeWidth={2.25} />
        </span>
      ) : collapseControl ? (
        <span className="uiSectionTitleCollapse">{collapseControl}</span>
      ) : null}
      <span>{title}</span>
    </>
  );

  return (
    <div className={cn("uiSectionTitle", canToggle && "uiSectionTitle-toggle", className)}>
      {canToggle ? (
        <button
          className="uiSectionTitleMain uiSectionTitleButton"
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={toggleLabel || (open ? `收起${title}` : `展开${title}`)}
        >
          {titleContent}
        </button>
      ) : (
        <span className="uiSectionTitleMain">{titleContent}</span>
      )}
      {actions ? <span className="uiSectionTitleActions">{actions}</span> : null}
      {meta !== undefined ? <em>{meta}</em> : null}
    </div>
  );
}
