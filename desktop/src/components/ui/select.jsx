import React from "react";
import { cn } from "../../lib/cn";

export function Select({ className, children, ...props }) {
  return (
    <select className={cn("uiSelect", className)} {...props}>
      {children}
    </select>
  );
}
