import React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/cn";

const buttonVariants = cva("uiButton", {
  variants: {
    variant: {
      default: "uiButton-default",
      outline: "uiButton-outline",
      secondary: "uiButton-secondary",
      primary: "uiButton-primary",
      danger: "uiButton-danger",
      ghost: "uiButton-ghost",
      subtle: "uiButton-subtle",
    },
    size: {
      sm: "uiButton-sm",
      md: "uiButton-md",
      icon: "uiButton-icon",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "md",
  },
});

export function Button({ asChild = false, className, size, variant, ...props }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
