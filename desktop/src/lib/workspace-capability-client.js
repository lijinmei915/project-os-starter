import { invokeRuntimeCommand } from "./runtime-api.js";

export function updateProjectCapability({ capabilityId, candidateModules = [], modules = [], status }) {
  return invokeRuntimeCommand("update_project_capability", {
    input: { capabilityId, candidateModules, modules, status },
  });
}
