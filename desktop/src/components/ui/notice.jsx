import React from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/cn";

const noticeVariants = cva("uiNotice", {
  variants: {
    variant: {
      info: "uiNotice-info",
      success: "uiNotice-success",
      danger: "uiNotice-danger",
      muted: "uiNotice-muted",
    },
  },
  defaultVariants: {
    variant: "info",
  },
});

export function Notice({ className, variant, ...props }) {
  const role = variant === "danger" ? "alert" : "status";
  return <div className={cn(noticeVariants({ variant }), className)} role={role} {...props} />;
}
