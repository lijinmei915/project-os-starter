import React from "react";
import { Check, Loader2 } from "lucide-react";
import { SectionGroup } from "../ui/section-title";

export function RailDisclosure({ children, className = "", defaultOpen = false, meta, title }) {
  const metaIsAction = React.isValidElement(meta);
  return <SectionGroup actions={metaIsAction ? meta : undefined} bodyClassName="railDisclosureBody" className={`railSection railDisclosure ${className}`} defaultOpen={defaultOpen} meta={metaIsAction ? undefined : meta} title={title}>{children}</SectionGroup>;
}

export function GoalStatusIcon({ displayStatus, status, taskStatuses }) {
  const currentStatus = displayStatus || status;
  const done = currentStatus === taskStatuses.done;
  const running = currentStatus === taskStatuses.running;
  const failed = currentStatus === taskStatuses.failed;
  const label = failed ? "失败" : running ? "进行中" : done ? "已完成" : "待开始";
  return <span className="goalTodoStatus" aria-label={label}>{done ? <Check strokeWidth={2.25} aria-hidden="true" /> : running ? <Loader2 strokeWidth={2} aria-hidden="true" /> : null}</span>;
}

export function GoalTaskItem({ active, detail, displayStatus, index, onSelect, status, taskStatuses, title }) {
  const currentStatus = displayStatus || status;
  const done = currentStatus === taskStatuses.done;
  const running = currentStatus === taskStatuses.running;
  const failed = currentStatus === taskStatuses.failed;
  const content = <><span className="goalTodoIndex">{index + 1}</span><span className="goalTodoText"><span className="goalTodoTitle">{title}</span></span><GoalStatusIcon displayStatus={displayStatus} status={status} taskStatuses={taskStatuses} /></>;
  return <li className={`goalTodoItem${active ? " active" : ""}${done ? " done" : ""}${running ? " running" : ""}${failed ? " failed" : ""}`}><div className="goalTodoRow">{onSelect ? <button className="goalTodoButton" type="button" onClick={onSelect}>{content}</button> : <div className="goalTodoButton">{content}</div>}</div>{detail}</li>;
}

export function ProjectProfileItem({ body, missing, title }) {
  return <div className={`contextItem${missing ? " missing" : ""}`}><div><strong>{title}</strong><p>{body || "待补充到项目文档"}</p></div></div>;
}
