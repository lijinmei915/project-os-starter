import React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "../../lib/cn";

export function Switch({ className, ...props }) {
  return (
    <SwitchPrimitive.Root className={cn("uiSwitch", className)} {...props}>
      <SwitchPrimitive.Thumb className="uiSwitchThumb" />
    </SwitchPrimitive.Root>
  );
}
