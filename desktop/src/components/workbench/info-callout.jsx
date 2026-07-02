import React from "react";
import { cn } from "../../lib/cn";

export function InfoCallout({ children, className, ...props }) {
  return (
    <div className={cn("infoCallout", className)} role="note" {...props}>
      {children}
    </div>
  );
}
