import React from "react";
import { cn } from "../../lib/cn";

export function Textarea({ className, ...props }) {
  return <textarea className={cn("uiTextarea", className)} {...props} />;
}
