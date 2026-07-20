import { useEffect, useState } from "react";
import { InfoCallout } from "./info-callout";
import { ProviderAdvancedSettings } from "./provider-advanced-settings";
import { ProviderConnectionSummary } from "./provider-connection-summary";
import { ProviderConnections } from "./provider-connections";
import { ProviderFormFields } from "./provider-form-fields";
import { ProviderSubmitControls } from "./provider-submit-controls";
import { Panel } from "../ui/panel";
import * as providerClient from "../../lib/provider-client";
import { providerFormForPreset, providerFormForProfile, providerFormFromStatus } from "../../lib/provider-form-state";
import { activeProviderProfileName, classifyProviderFailure, formatModelTestTime, isolatedProviderKeyEnv, providerConnectionLabel } from "../../lib/provider-presentation";

export function ProviderPanel({ fallbackModelCatalog, modelCatalog, modelTestRecord, onDeleteProviderProfile, onModelTestRecorded, onSaveProvider, onSaveProviderSecret, provider, providerError, source }) {
  const [form, setForm] = useState(provider);
  const [apiKey, setApiKey] = useState("");
  const [customModel, setCustomModel] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [detectedModels, setDetectedModels] = useState([]);
  const [probeLoading, setProbeLoading] = useState(false);
  const [probeError, setProbeError] = useState("");
  const [modelTestLoading, setModelTestLoading] = useState(false);
  const [modelTestCheckedAt, setModelTestCheckedAt] = useState("");
  const [modelTestMessage, setModelTestMessage] = useState("");
  const [modelTestStatus, setModelTestStatus] = useState("untested");
  const catalogProviders =
    Array.isArray(modelCatalog?.providers) && modelCatalog.providers.length
      ? modelCatalog.providers
      : fallbackModelCatalog.providers;
  const profiles = Array.isArray(provider.profiles) ? provider.profiles : [];
  const activePreset =
    catalogProviders.find((preset) => preset.apiBase === form.apiBase && preset.apiKeyEnv === form.apiKeyEnv) ||
    catalogProviders.find((preset) => preset.id === selectedProviderId) ||
    catalogProviders.find((preset) => preset.id === form.profileId) ||
    catalogProviders.find((preset) => preset.id === "gateway") ||
    catalogProviders[0];
  const modelOptions = Array.from(new Set([
    form.model,
    ...(detectedModels.length ? detectedModels : (activePreset?.models || [])),
  ].filter(Boolean)));
  const isPreview = source !== "tauri";
  const lastTestTime = formatModelTestTime(modelTestCheckedAt || modelTestRecord?.checkedAt);
  const connectionTestLabel = modelTestStatus === "testing"
    ? "正在测试当前连接"
    : modelTestStatus === "available"
      ? `${modelTestMessage || "当前连接可用"}${lastTestTime ? ` · ${lastTestTime}` : ""}`
      : modelTestStatus === "quota-exhausted"
        ? `当前连接额度不足${lastTestTime ? ` · ${lastTestTime}` : ""}`
        : modelTestStatus === "authentication-failed"
          ? `当前连接认证失败${lastTestTime ? ` · ${lastTestTime}` : ""}`
          : modelTestStatus === "model-unavailable"
            ? `当前模型不可用${lastTestTime ? ` · ${lastTestTime}` : ""}`
            : modelTestStatus === "network-unavailable"
              ? `当前连接网络异常${lastTestTime ? ` · ${lastTestTime}` : ""}`
        : modelTestStatus === "unavailable"
          ? `当前连接不可用${lastTestTime ? ` · ${lastTestTime}` : ""}`
        : lastTestTime
          ? `最后测试 · ${lastTestTime}`
          : "当前连接尚未测试";
  const savedProfile = profiles.find((profile) => profile.id === form.profileId);
  const isCreatingProfile = Boolean(form.profileId) && !savedProfile;
  const currentHasApiKey = isCreatingProfile ? Boolean(apiKey.trim()) : Boolean(savedProfile?.hasApiKey ?? provider.hasApiKey);
  const currentConnectionName = form.profileName || activeProviderProfileName(provider);
  const usesCatalogPreset = Boolean(activePreset && form.apiBase === activePreset.apiBase && form.apiKeyEnv === activePreset.apiKeyEnv);
  const advancedFieldsReadOnly = usesCatalogPreset && !isCreatingProfile;

  useEffect(() => {
    setForm(providerFormFromStatus(provider));
    setSelectedProviderId(
      catalogProviders.find((preset) => preset.apiBase === provider.apiBase && preset.apiKeyEnv === provider.apiKeyEnv)?.id ||
      provider.profileId ||
      provider.activeProfileId ||
      "gateway"
    );
    setDetectedModels([]);
    setProbeError("");
    setModelTestCheckedAt(modelTestRecord?.checkedAt || "");
    setModelTestMessage(modelTestRecord?.message || "");
    setModelTestStatus(modelTestRecord?.status || "untested");
    setCustomModel(false);
  }, [provider, modelCatalog, modelTestRecord]);

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const createProfile = () => {
    const id = `profile-${Date.now()}`;
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    const preset = activePreset || catalogProviders.find((item) => item.id === "gateway") || catalogProviders[0];
    setApiKey("");
    setCustomModel(true);
    setDetectedModels([]);
    setProbeError("");
    setModelTestMessage("");
    setSelectedProviderId(preset?.id || "gateway");
    setForm((current) => ({
      ...current,
      provider: preset?.provider || "openai-compatible",
      model: "",
      apiBase: "",
      apiKeyEnv: `OMNIDESK_API_KEY_${suffix}`,
      enabled: true,
      profileId: id,
      profileName: "",
      profileNote: "",
      profileWebsite: "",
    }));
  };

  const editProfile = async (profile) => {
    const nextForm = providerFormForProfile(form, profile);
    setSelectedProviderId(catalogProviders.find((preset) => preset.apiBase === profile.apiBase && preset.apiKeyEnv === profile.apiKeyEnv)?.id || "gateway");
    setCustomModel(false);
    setForm(nextForm);
    await onSaveProvider?.(nextForm);
  };

  const deleteProfile = async (profile) => {
    if (!profile) return;
    const confirmed = window.confirm(`删除连接「${profile.name || "未命名连接"}」？\n如果这个 Key 没有被其他连接共用，也会从 .env.local 移除。`);
    if (!confirmed) return;
    const ok = await onDeleteProviderProfile?.(profile.id);
    if (ok) {
      setApiKey("");
      setCustomModel(false);
      setDetectedModels([]);
      setProbeError("");
      setModelTestMessage("");
    }
  };

  const selectPreset = (event) => {
    const preset = catalogProviders.find((item) => item.id === event.target.value);
    if (!preset) return;
    setCustomModel(false);
    setSelectedProviderId(preset.id);
    setForm((current) => providerFormForPreset(current, provider, preset));
  };

  const selectModel = (event) => {
    if (event.target.value === "__custom") {
      setCustomModel(true);
      updateField("model", "");
      return;
    }
    setCustomModel(false);
    updateField("model", event.target.value);
  };

  const probeModels = async () => {
    setProbeError("");
    setModelTestMessage("");
    setProbeLoading(true);
    try {
      const previousModel = form.model;
      const result = await providerClient.probeProviderModels({ apiBase: form.apiBase, apiKeyEnv: form.apiKeyEnv, apiKey });
      const models = Array.isArray(result.models) ? result.models : [];
      setDetectedModels(models);
      if (models.length && (!previousModel || !models.includes(previousModel))) {
        setCustomModel(false);
        updateField("model", models[0]);
      }
      return true;
    } catch (err) {
      setProbeError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setProbeLoading(false);
    }
  };

  useEffect(() => {
    if (!form.apiBase || !form.apiKeyEnv || !currentHasApiKey) return;
    void probeModels();
  }, [form.profileId, form.apiBase, form.apiKeyEnv, currentHasApiKey]);

  const testCurrentModel = async () => {
    if (isPreview) {
      setModelTestStatus("untested");
      return false;
    }
    setProbeError("");
    setModelTestStatus("testing");
    setModelTestLoading(true);
    try {
      const result = await providerClient.testProviderModel({ apiBase: form.apiBase, apiKeyEnv: form.apiKeyEnv, model: form.model, apiKey });
      const checkedAt = Date.now();
      const message = result.message || "当前连接可用";
      setModelTestStatus("available");
      setModelTestCheckedAt(checkedAt);
      setModelTestMessage(message);
      onModelTestRecorded?.({ apiBase: form.apiBase, apiKeyEnv: form.apiKeyEnv, checkedAt, message, model: form.model, status: "available" });
      return true;
    } catch (err) {
      const checkedAt = Date.now();
      const message = err instanceof Error ? err.message : String(err);
      setModelTestStatus(classifyProviderFailure(message));
      setModelTestCheckedAt(checkedAt);
      setModelTestMessage("");
      setProbeError(message);
      onModelTestRecorded?.({ apiBase: form.apiBase, apiKeyEnv: form.apiKeyEnv, checkedAt, message, model: form.model, status: classifyProviderFailure(message) });
      return false;
    } finally {
      setModelTestLoading(false);
    }
  };

  const submitProvider = async (event) => {
    event.preventDefault();
    if (isPreview) {
      setProbeError("");
      return;
    }
    const envUsedByAnotherProfile = profiles.some((profile) => profile.id !== form.profileId && profile.apiKeyEnv === form.apiKeyEnv);
    const nextForm = envUsedByAnotherProfile ? { ...form, apiKeyEnv: isolatedProviderKeyEnv(form.apiKeyEnv, form.profileId) } : form;
    if (nextForm !== form) setForm(nextForm);
    if (apiKey.trim()) await probeModels();
    const ok = await onSaveProvider(nextForm);
    if (ok && apiKey.trim() && await onSaveProviderSecret(nextForm.apiKeyEnv, apiKey)) setApiKey("");
  };

  return (
    <Panel as="form" className={`providerPanel${isCreatingProfile ? " providerPanel-creating" : ""}`} onSubmit={submitProvider}>
      <ProviderConnectionSummary connectionName={currentConnectionName} enabled={form.enabled} hasApiKey={currentHasApiKey} isPreview={isPreview} model={form.model} onTest={testCurrentModel} status={modelTestStatus} statusLabel={connectionTestLabel} testing={modelTestLoading} />
      {isPreview ? <InfoCallout>当前是浏览器预览；切换连接会保存，写入 Key 和刷新模型需要在桌面 App 窗口中操作。</InfoCallout> : null}
      <ProviderConnections activeProfileId={form.profileId} onCreate={createProfile} onDelete={deleteProfile} onEdit={editProfile} profileLabel={providerConnectionLabel} profiles={profiles} providerError={providerError} />
      <ProviderFormFields apiKey={apiKey} apiKeyHint={currentHasApiKey && !isCreatingProfile ? "已保存，可留空；填写新 Key 会覆盖当前连接。" : "新连接需要填写 API Key。"} catalogProviders={catalogProviders} customModel={customModel} form={form} modelOptions={modelOptions} onApiKeyChange={setApiKey} onFieldChange={updateField} onModelChange={selectModel} onProviderChange={selectPreset} selectedProviderId={selectedProviderId || activePreset?.id} />
      <ProviderAdvancedSettings form={form} onFieldChange={updateField} readOnly={advancedFieldsReadOnly} usesCatalogPreset={usesCatalogPreset} />
      <ProviderSubmitControls enabled={form.enabled} isPreview={isPreview} onEnabledChange={(checked) => updateField("enabled", checked)} probeError={probeError} />
    </Panel>
  );
}
