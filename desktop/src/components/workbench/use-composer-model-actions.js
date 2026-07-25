import { useCallback, useEffect } from "react";
import { classifyProviderFailure, providerModelUpdate } from "../../lib/provider-presentation";

export function useComposerModelActions({
  catalogModelsForProvider,
  composerModelTests,
  composerModels,
  composerModelsKey,
  modelAvailabilityKey,
  modelCatalog,
  provider,
  providerClient,
  providerModelKey,
  saveProvider,
  setComposerModelTesting,
  setComposerModelTests,
  setComposerModels,
  setComposerModelsKey,
  setComposerModelsLoading,
  setComposerModelsSource,
  setProvider,
  source,
}) {
  const loadComposerModels = async () => {
    const key = providerModelKey(provider);
    if (composerModelsKey === key && composerModels.length) return;
    const fallbackModels = catalogModelsForProvider(provider, modelCatalog);
    setComposerModelsLoading(true);
    setComposerModelsSource(fallbackModels.length > 1 ? "来自本地模型列表" : "当前模型");
    setComposerModels(fallbackModels);
    if (source !== "tauri" || !provider?.apiBase || !provider?.apiKeyEnv) {
      setComposerModelsKey(key);
      setComposerModelsLoading(false);
      return;
    }
    try {
      const result = await providerClient.probeProviderModels({ apiBase: provider.apiBase, apiKeyEnv: provider.apiKeyEnv, apiKey: "" });
      const models = Array.isArray(result.models) ? result.models.filter(Boolean) : [];
      setComposerModels(models.length ? models : fallbackModels);
      setComposerModelsSource(models.length ? "来自当前 API 可见模型" : "来自本地模型列表");
      setComposerModelsKey(key);
    } catch {
      setComposerModels(fallbackModels);
      setComposerModelsSource(fallbackModels.length > 1 ? "来自本地模型列表" : "当前模型");
      setComposerModelsKey(key);
    } finally {
      setComposerModelsLoading(false);
    }
  };

  const selectComposerModel = async (model) => {
    if (!model || model === provider.model) return;
    if (source !== "tauri") {
      setProvider((current) => ({ ...current, model }));
      return;
    }
    await saveProvider(providerModelUpdate(provider, model));
  };

  const testComposerModel = async (model) => {
    const targetModel = model || provider?.model;
    if (!targetModel || !provider?.apiBase || !provider?.apiKeyEnv) return false;
    const key = modelAvailabilityKey(provider, targetModel);
    setComposerModelTesting(true);
    try {
      const result = await providerClient.testProviderModel({ apiBase: provider.apiBase, apiKeyEnv: provider.apiKeyEnv, model: targetModel, apiKey: "" });
      setComposerModelTests((current) => ({ ...current, [key]: { checkedAt: Date.now(), message: result.message || `${targetModel} 可用`, status: "available" } }));
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setComposerModelTests((current) => ({ ...current, [key]: { checkedAt: Date.now(), message, status: classifyProviderFailure(message) } }));
      return false;
    } finally {
      setComposerModelTesting(false);
    }
  };

  const updateComposerModelHealth = useCallback((model, status, message = "") => {
    const targetModel = model || provider?.model;
    if (!targetModel) return;
    const key = modelAvailabilityKey(provider, targetModel);
    setComposerModelTests((current) => ({ ...current, [key]: { checkedAt: Date.now(), message, status } }));
  }, [modelAvailabilityKey, provider, setComposerModelTests]);

  useEffect(() => {
    if (!provider?.enabled || !provider?.model || !provider?.apiBase || !provider?.apiKeyEnv) return undefined;
    const key = modelAvailabilityKey(provider, provider.model);
    if (!composerModelTests[key]?.status) void testComposerModel(provider.model);
    return undefined;
  }, [composerModelTests, source, provider?.enabled, provider?.apiBase, provider?.apiKeyEnv, provider?.model]);

  return { loadComposerModels, selectComposerModel, testComposerModel, updateComposerModelHealth };
}
