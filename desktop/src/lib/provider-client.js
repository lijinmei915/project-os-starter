import { invokeRuntimeCommand, invokeTauriCommand, isTauriRuntime } from "./runtime-api.js";

export function getProviderStatus(fallbackProvider) {
  if (isTauriRuntime()) return invokeTauriCommand("get_provider_status");
  return loadPreviewJson("/__project-os/provider-status", fallbackProvider);
}

export function getModelCatalog(fallbackModelCatalog) {
  if (isTauriRuntime()) return invokeTauriCommand("get_model_catalog");
  return loadPreviewJson("/.omnidesk/data/model-catalog.json", fallbackModelCatalog);
}

export function getModelHealth(fallbackModelHealth = { schemaVersion: "project-os.model-health.v0.1", entries: [] }) {
  if (isTauriRuntime()) return invokeTauriCommand("get_model_health");
  return loadPreviewJson("/.omnidesk/cache/model-health.json", fallbackModelHealth);
}

export function saveProviderConfig(input) {
  return invokeRuntimeCommand("save_provider_config", { input });
}

export function saveProviderSecret(input) {
  return invokeRuntimeCommand("save_provider_secret", { input });
}

export function testProviderModel(input) {
  return invokeRuntimeCommand("test_provider_model_with_cache", { input });
}

export function probeProviderModels(input) {
  return invokeRuntimeCommand("probe_provider_models", { input });
}

export function deleteProviderProfile(profileId) {
  return invokeRuntimeCommand("delete_provider_profile", { input: { profileId } });
}

async function loadPreviewJson(path, fallback) {
  try {
    const response = await fetch(path);
    if (!response.ok) return fallback;
    return { ...fallback, ...(await response.json()) };
  } catch {
    return fallback;
  }
}
