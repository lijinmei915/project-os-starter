import React, { useId } from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "../../lib/cn";

export function Field({ children, className, error, hint, id, label }) {
  const generatedId = useId();
  const controlId = id || generatedId;

  return (
    <div className={cn("uiField", className)}>
      {label ? (
        <LabelPrimitive.Root className="uiFieldLabel" htmlFor={controlId}>
          {label}
        </LabelPrimitive.Root>
      ) : null}
      {typeof children === "function" ? children({ id: controlId }) : children}
      {hint ? <div className="uiFieldHint">{hint}</div> : null}
      {error ? <div className="uiFieldError">{error}</div> : null}
    </div>
  );
}
