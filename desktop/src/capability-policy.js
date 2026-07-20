function workspaceCapabilities(manifest) {
  return manifest?.workspaceCapabilities || manifest?.capabilities || [];
}

export function isSlotCapabilityEnabled(requirement, manifest) {
  if (!requirement || !workspaceCapabilities(manifest).length) return true;
  const capability = workspaceCapabilities(manifest).find((item) => item.id === requirement.id);
  if (capability?.status !== "enabled") return false;
  if (!requirement.moduleId || !Array.isArray(capability.modules) || !capability.modules.length) return true;
  return capability.modules.some((module) => module.id === requirement.moduleId && module.status === "enabled");
}

export function capabilityManifestSignature(manifest) {
  return JSON.stringify(workspaceCapabilities(manifest).map((capability) => ({
    id: capability.id,
    status: capability.status,
    modules: (capability.modules || []).map((module) => ({ id: module.id, status: module.status })),
  })));
}
