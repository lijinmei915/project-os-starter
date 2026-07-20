import { invokeRuntimeCommand } from "./runtime-api.js";

export function readEngineeringFile(path) {
  return invokeRuntimeCommand("read_engineering_file", { input: { path } });
}

export function updateProjectProfileFromConversation(patches) {
  return invokeRuntimeCommand("update_project_profile_from_conversation", { input: { patches } });
}
