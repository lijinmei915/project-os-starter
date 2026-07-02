import React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "../../lib/cn";

export function TooltipProvider(props) {
  return <TooltipPrimitive.Provider delayDuration={280} skipDelayDuration={120} {...props} />;
}

export function Tooltip({ children, content }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content className="uiTooltipContent" sideOffset={6}>
          {content}
          <TooltipPrimitive.Arrow className="uiTooltipArrow" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export function TooltipContent({ className, ...props }) {
  return <TooltipPrimitive.Content className={cn("uiTooltipContent", className)} {...props} />;
}
