import React from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/cn";

const panelVariants = cva("uiPanel", {
  variants: {
    variant: {
      default: "uiPanel-default",
      soft: "uiPanel-soft",
      code: "uiPanel-code",
      info: "uiPanel-info",
    },
    padding: {
      none: "uiPanel-padding-none",
      sm: "uiPanel-padding-sm",
      md: "uiPanel-padding-md",
    },
  },
  defaultVariants: {
    variant: "default",
    padding: "md",
  },
});

export function Panel({ as: Comp = "div", className, padding, variant, ...props }) {
  return <Comp className={cn(panelVariants({ variant, padding }), className)} {...props} />;
}
