import React from "react";
import { Badge } from "../ui/badge";
import { Panel } from "../ui/panel";
import { cn } from "../../lib/cn";

export function TaskCard({ body, className, progress, status, tone, title, ...props }) {
  const showProgress = typeof progress === "number";

  return (
    <Panel
      as="article"
      className={cn("taskCard", tone === "accent" && "taskCard-accent", className)}
      padding="sm"
      {...props}
    >
      <div className="taskCardHead">
        <strong>{title}</strong>
        {status ? <Badge className="taskCardBadge">{status}</Badge> : null}
      </div>
      {showProgress ? (
        <div className="taskCardProgress" aria-hidden="true">
          <span style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }} />
        </div>
      ) : null}
      {body ? <p>{body}</p> : null}
    </Panel>
  );
}
