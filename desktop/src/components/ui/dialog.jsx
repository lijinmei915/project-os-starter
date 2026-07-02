import React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "../../lib/cn";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({ children, className, title, description, ...props }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="uiDialogOverlay" />
      <DialogPrimitive.Content className={cn("uiDialogContent", className)} {...props}>
        {title || description ? (
          <div className="uiDialogHeader">
            {title ? <DialogPrimitive.Title className="uiDialogTitle">{title}</DialogPrimitive.Title> : null}
            {description ? (
              <DialogPrimitive.Description className="uiDialogDescription">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
        ) : null}
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
