import React from "react";
import { cn } from "../../lib/cn";

export function SectionTitle({ actions, className, meta, title }) {
  return (
    <div className={cn("uiSectionTitle", className)}>
      <span className="uiSectionTitleMain">
        <span>{title}</span>
        {actions ? <span className="uiSectionTitleActions">{actions}</span> : null}
      </span>
      {meta !== undefined ? <em>{meta}</em> : null}
    </div>
  );
}
