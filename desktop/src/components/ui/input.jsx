import React from "react";
import { cn } from "../../lib/cn";

export function Input({ className, ...props }) {
  return <input className={cn("uiInput", className)} {...props} />;
}
