import React from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Dialog, DialogContent } from "../ui/dialog";
import { domainReasonsForCapability, recommendedModuleIds } from "../../domain-workspace-mapping";

export function ProjectCapabilityDialog({
  capabilities = [],
  descriptions = {},
  labels = {},
  loadingId,
  moduleLabels = {},
  onDismiss,
  onEnable,
  onOpenChange,
  onSelectedModulesChange,
  open,
  selectedModulesByCapability = {},
  snapshot,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="更多能力" description="按项目需要逐步启用；只改变工作区显示，不会创建目录或安装依赖。">
        <div className="workspaceCapabilityList">
          {capabilities.length ? capabilities.map((capability) => {
            const candidates = recommendedModuleIds(snapshot?.projectCapabilities?.domainCapabilities, capability.id);
            const selected = selectedModulesByCapability[capability.id] || candidates;
            return (
              <div key={capability.id}>
                <div>
                  <div className="workspaceCapabilityTitle"><strong>{labels[capability.id]}</strong><Badge>{capability.status === "recommended" ? "建议" : capability.status === "detected" ? "已识别" : "可用"}</Badge></div>
                  <p>{descriptions[capability.id]}</p>
                  {domainReasonsForCapability(snapshot?.projectCapabilities?.domainCapabilities, capability.id).map((reason) => (
                    <span key={`${capability.id}-${reason.domainId}`}>因检测到{reason.domainLabel}，建议：{reason.modules.join("、")}</span>
                  ))}
                  {capability.signals?.length ? <span>依据：{capability.signals.join("、")}</span> : null}
                  {candidates.length ? <div className="workspaceCapabilityModules">{candidates.map((moduleId) => (
                    <label key={moduleId}><input type="checkbox" checked={selected.includes(moduleId)} onChange={(event) => onSelectedModulesChange(capability.id, candidates, event.target.checked, moduleId)} />{moduleLabels[moduleId] || moduleId}</label>
                  ))}</div> : null}
                </div>
                <div className="workspaceCapabilityActions">
                  {capability.status !== "available" ? <Button disabled={Boolean(loadingId)} size="sm" variant="ghost" type="button" onClick={() => onDismiss(capability.id)}>暂不需要</Button> : null}
                  <Button disabled={Boolean(loadingId)} size="sm" type="button" onClick={() => onEnable(capability.id, selected, candidates)}>{loadingId === capability.id ? "处理中" : "启用所选模块"}</Button>
                </div>
              </div>
            );
          }) : <p className="workspaceCapabilitiesEmpty">当前没有待启用或建议能力。</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
