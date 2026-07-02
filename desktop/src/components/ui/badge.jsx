import React from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/cn";

const badgeVariants = cva("uiBadge", {
  variants: {
    variant: {
      default: "uiBadge-default",
      planned: "uiBadge-planned",
      waiting: "uiBadge-waiting",
      running: "uiBadge-running",
      done: "uiBadge-done",
      failed: "uiBadge-failed",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const statusVariantMap = {
  planned: "planned",
  "waiting approval": "waiting",
  running: "running",
  done: "done",
  failed: "failed",
};

export function Badge({ className, status, variant, ...props }) {
  return (
    <span
      className={cn(badgeVariants({ variant: variant || statusVariantMap[status] || "default" }), className)}
      {...props}
    />
  );
}
