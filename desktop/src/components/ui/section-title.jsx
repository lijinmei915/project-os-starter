import React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../../lib/cn";

export function SectionTitle({ actions, className, collapseControl, inlineAction, meta, onToggle, open, title, toggleLabel }) {
  const canToggle = typeof onToggle === "function";
  const titleContent = (
    <>
      {canToggle ? (
        <span className={`sectionChevronAction sectionChevronAction-static${open ? " open" : ""}`} aria-hidden="true">
          <ChevronRight strokeWidth={1.75} />
        </span>
      ) : collapseControl ? (
        <span className="uiSectionTitleCollapse">{collapseControl}</span>
      ) : null}
      <span>{title}</span>
    </>
  );

  return (
    <div className={cn("uiSectionTitle", canToggle && "uiSectionTitle-toggle", inlineAction && "uiSectionTitle-hasInlineAction", className)}>
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
      {inlineAction ? <span className="uiSectionTitleInlineAction">{inlineAction}</span> : null}
      {actions ? <span className="uiSectionTitleActions">{actions}</span> : null}
      {meta !== undefined ? <em>{meta}</em> : null}
    </div>
  );
}

export function SectionGroup({
  actions,
  bodyClassName,
  children,
  className,
  defaultOpen = true,
  inlineAction,
  meta,
  onToggle,
  open,
  title,
  titleClassName,
  toggleLabel,
}) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const isControlled = typeof open === "boolean";
  const currentOpen = isControlled ? open : internalOpen;
  const handleToggle = () => {
    if (!isControlled) setInternalOpen((value) => !value);
    onToggle?.();
  };

  return (
    <section className={className}>
      <SectionTitle
        actions={actions}
        className={titleClassName}
        inlineAction={inlineAction}
        meta={meta}
        open={currentOpen}
        onToggle={handleToggle}
        title={title}
        toggleLabel={toggleLabel || (currentOpen ? `收起${title}` : `展开${title}`)}
      />
      {currentOpen ? <div className={bodyClassName}>{children}</div> : null}
    </section>
  );
}
