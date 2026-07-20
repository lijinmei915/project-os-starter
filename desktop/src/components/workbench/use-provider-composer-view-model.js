import { useMemo } from "react";

export function useProviderComposerViewModel({ catalogModelsForProvider, composerModelTests, composerModels, modelAvailabilityKey, modelCatalog, provider, providerModelHealth }) {
  const composerModelOptions = useMemo(() => (
    composerModels.length ? composerModels : catalogModelsForProvider(provider, modelCatalog)
  ), [catalogModelsForProvider, composerModels, modelCatalog, provider]);
  const composerModelAvailability = useMemo(() => Object.fromEntries(
    composerModelOptions.map((model) => [model, composerModelTests[modelAvailabilityKey(provider, model)]])
  ), [composerModelOptions, composerModelTests, modelAvailabilityKey, provider]);
  const currentProviderHealth = providerModelHealth(provider, composerModelAvailability);
  const currentProviderTestRecord = composerModelTests[modelAvailabilityKey(provider, provider?.model)];
  return { composerModelAvailability, composerModelOptions, currentProviderHealth, currentProviderTestRecord };
}
