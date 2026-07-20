import { useCallback } from "react";

export function useWorkspaceCapabilityActions({ capabilityLabels, refreshSnapshot, showToast, updateProjectCapability }) {
  return useCallback(async (capabilityId, status, modules = [], candidateModules = []) => {
    await updateProjectCapability({ capabilityId, status, modules, candidateModules });
    await refreshSnapshot();
    showToast(status === "enabled"
      ? `${capabilityLabels[capabilityId] || "项目能力"}已启用。`
      : `已暂时隐藏${capabilityLabels[capabilityId] || "这项能力"}。`);
  }, [capabilityLabels, refreshSnapshot, showToast, updateProjectCapability]);
}
