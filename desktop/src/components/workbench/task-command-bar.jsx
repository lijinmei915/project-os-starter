import React from "react";
import { Button } from "../ui/button";
import { cn } from "../../lib/cn";

export function TaskCommandBar({ actions, children, className, meta }) {
  return (
    <div className={cn("taskCommandBar", className)}>
      {actions?.map((action) => (
        <Button
          disabled={action.disabled}
          key={action.key || action.label}
          onClick={action.onClick}
          size="sm"
          type="button"
          variant={action.variant || "subtle"}
        >
          {action.label}
        </Button>
      ))}
      {meta ? <span>{meta}</span> : null}
      {children}
    </div>
  );
}
