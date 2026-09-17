import { useEffect, useState } from "react";
import { InfoCallout } from "../workbench/info-callout";
import { ProviderAdvancedSettings } from "../workbench/provider-advanced-settings";
import { ProviderConnectionSummary } from "../workbench/provider-connection-summary";
import { ProviderConnections } from "../workbench/provider-connections";
import { ProviderFormFields } from "../workbench/provider-form-fields";
import { ProviderSubmitControls } from "../workbench/provider-submit-controls";
import { Panel } from "../ui/panel";
import { providerFormForPreset, providerFormForProfile, providerFormFromStatus } from "../../lib/provider-form-state";
import { activeProviderProfileName, classifyProviderFailure, isolatedProviderKeyEnv, providerConnectionLabel, providerTestStatusLabel } from "../../lib/provider-presentation";

const defaultProfileId = () => `profile-${Date.now()}`;
const defaultSecretReference = (_form, profileId) => isolatedProviderKeyEnv("PROVIDER_API_KEY", profileId);

export function ProviderConnectionSettings({
  catalog = { providers: [] },
  confirmDelete,
  createProfileId = defaultProfileId,
  disabledHint = "关闭后，宿主应用不会使用当前连接。",
  error = "",
  modelTestRecord,
  onDeleteProfile,
  onModelTestRecorded,
  onProbeModels,
  onSaveProfile,
  onSaveSecret,
  onTestModel,
  profileLabel = providerConnectionLabel,
  prepareProfileForSave = (profile) => profile,
  readOnly = false,
  readOnlyNotice = "当前环境只允许查看连接设置。",
  secretReferenceForProfile = defaultSecretReference,
  status = {},
  submitLabel = "保存并启用",
}) {
  const [form, setForm] = useState(status);
  const [apiKey, setApiKey] = useState("");
  const [customModel, setCustomModel] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [detectedModels, setDetectedModels] = useState([]);
  const [probeLoading, setProbeLoading] = useState(false);
  const [probeError, setProbeError] = useState("");
  const [modelTestLoading, setModelTestLoading] = useState(false);
  const [modelTestCheckedAt, setModelTestCheckedAt] = useState("");
  const [modelTestStatus, setModelTestStatus] = useState("untested");
  const catalogProviders = Array.isArray(catalog?.providers) ? catalog.providers : [];
  const profiles = Array.isArray(status?.profiles) ? status.profiles : [];
  const activePreset =
    catalogProviders.find((preset) => preset.apiBase === form.apiBase && preset.apiKeyEnv === form.apiKeyEnv) ||
    catalogProviders.find((preset) => preset.id === selectedProviderId) ||
    catalogProviders.find((preset) => preset.id === form.profileId) ||
    catalogProviders[0];
  const modelOptions = Array.from(new Set([
    form.model,
    ...(detectedModels.length ? detectedModels : (activePreset?.models || [])),
  ].filter(Boolean)));
  const savedProfile = profiles.find((profile) => profile.id === form.profileId);
  const isCreatingProfile = Boolean(form.profileId) && !savedProfile;
  const currentHasApiKey = isCreatingProfile ? Boolean(apiKey.trim()) : Boolean(savedProfile?.hasApiKey ?? status.hasApiKey);
  const usesCatalogPreset = Boolean(activePreset && form.apiBase === activePreset.apiBase && form.apiKeyEnv === activePreset.apiKeyEnv);

  useEffect(() => {
    setForm(providerFormFromStatus(status));
    setSelectedProviderId(
      catalogProviders.find((preset) => preset.apiBase === status.apiBase && preset.apiKeyEnv === status.apiKeyEnv)?.id ||
      status.profileId || status.activeProfileId || catalogProviders[0]?.id || ""
    );
    setDetectedModels([]);
    setProbeError("");
    setModelTestCheckedAt(modelTestRecord?.checkedAt || "");
    setModelTestStatus(modelTestRecord?.status || "untested");
    setCustomModel(false);
  }, [status, catalog, modelTestRecord]);

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const createProfile = () => {
    const id = createProfileId();
    const preset = activePreset || catalogProviders[0];
    const draft = {
      ...form,
      provider: preset?.provider || "openai-compatible",
      model: "",
      apiBase: "",
      enabled: true,
      profileId: id,
      profileName: "",
      profileNote: "",
      profileWebsite: "",
    };
    setApiKey("");
    setCustomModel(true);
    setDetectedModels([]);
    setProbeError("");
    setSelectedProviderId(preset?.id || "");
    setForm({ ...draft, apiKeyEnv: secretReferenceForProfile(draft, id) });
  };

  const editProfile = async (profile) => {
    const nextForm = providerFormForProfile(form, profile);
    setSelectedProviderId(catalogProviders.find((preset) => preset.apiBase === profile.apiBase && preset.apiKeyEnv === profile.apiKeyEnv)?.id || "");
    setCustomModel(false);
    setForm(nextForm);
    if (!readOnly) await onSaveProfile?.(prepareProfileForSave(nextForm, profiles));
  };

  const deleteProfile = async (profile) => {
    if (!profile || readOnly) return;
    if (confirmDelete && !(await confirmDelete(profile))) return;
    const ok = await onDeleteProfile?.(profile.id);
    if (ok) {
      setApiKey("");
      setCustomModel(false);
      setDetectedModels([]);
      setProbeError("");
    }
  };

  const selectPreset = (event) => {
    const preset = catalogProviders.find((item) => item.id === event.target.value);
    if (!preset) return;
    setCustomModel(false);
    setSelectedProviderId(preset.id);
    setForm((current) => providerFormForPreset(current, status, preset));
  };

  const selectModel = (event) => {
    if (event.target.value === "__custom") {
      setCustomModel(true);
      updateField("model", "");
    } else {
      setCustomModel(false);
      updateField("model", event.target.value);
    }
  };

  const probeModels = async () => {
    if (typeof onProbeModels !== "function") return true;
    setProbeError("");
    setProbeLoading(true);
    try {
      const previousModel = form.model;
      const result = await onProbeModels({ apiBase: form.apiBase, apiKeyEnv: form.apiKeyEnv, apiKey });
      const models = Array.isArray(result?.models) ? result.models : [];
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
    if (readOnly || !form.apiBase || !form.apiKeyEnv || !currentHasApiKey) return;
    void probeModels();
  }, [form.profileId, form.apiBase, form.apiKeyEnv, currentHasApiKey, readOnly]);

  const testCurrentModel = async () => {
    if (readOnly || typeof onTestModel !== "function") return false;
    setProbeError("");
    setModelTestStatus("testing");
    setModelTestLoading(true);
    try {
      const result = await onTestModel({ apiBase: form.apiBase, apiKeyEnv: form.apiKeyEnv, model: form.model, apiKey });
      const checkedAt = Date.now();
      const message = result?.message || "当前连接可用";
      setModelTestStatus("available");
      setModelTestCheckedAt(checkedAt);
      onModelTestRecorded?.({ apiBase: form.apiBase, apiKeyEnv: form.apiKeyEnv, checkedAt, message, model: form.model, status: "available" });
      return true;
    } catch (err) {
      const checkedAt = Date.now();
      const message = err instanceof Error ? err.message : String(err);
      const failure = classifyProviderFailure(message);
      setModelTestStatus(failure);
      setModelTestCheckedAt(checkedAt);
      setProbeError(message);
      onModelTestRecorded?.({ apiBase: form.apiBase, apiKeyEnv: form.apiKeyEnv, checkedAt, message, model: form.model, status: failure });
      return false;
    } finally {
      setModelTestLoading(false);
    }
  };

  const submitProvider = async (event) => {
    event.preventDefault();
    if (readOnly) return;
    const nextForm = prepareProfileForSave(form, profiles);
    if (nextForm !== form) setForm(nextForm);
    const ok = await onSaveProfile?.(nextForm);
    if (ok && apiKey.trim() && await onSaveSecret?.({ apiKeyEnv: nextForm.apiKeyEnv, apiKey })) setApiKey("");
  };

  return (
    <Panel as="form" className={`providerPanel${isCreatingProfile ? " providerPanel-creating" : ""}`} onSubmit={submitProvider}>
      <ProviderConnectionSummary connectionName={form.profileName || activeProviderProfileName(status)} enabled={form.enabled} hasApiKey={currentHasApiKey} isPreview={readOnly} model={form.model} onTest={testCurrentModel} status={modelTestStatus} statusLabel={providerTestStatusLabel(modelTestStatus, modelTestCheckedAt || modelTestRecord?.checkedAt)} testing={modelTestLoading} />
      {readOnly && readOnlyNotice ? <InfoCallout>{readOnlyNotice}</InfoCallout> : null}
      <ProviderConnections activeProfileId={form.profileId} disabled={readOnly} onCreate={createProfile} onDelete={deleteProfile} onEdit={editProfile} profileLabel={profileLabel} profiles={profiles} providerError={error} />
      <ProviderFormFields apiKey={apiKey} apiKeyHint={currentHasApiKey && !isCreatingProfile ? "已保存，可留空；填写新 Key 会覆盖当前连接。" : "新连接需要填写 API Key。"} catalogProviders={catalogProviders} customModel={customModel} disabled={readOnly} form={form} modelOptions={modelOptions} onApiKeyChange={setApiKey} onFieldChange={updateField} onModelChange={selectModel} onProviderChange={selectPreset} selectedProviderId={selectedProviderId || activePreset?.id} />
      <ProviderAdvancedSettings form={form} onFieldChange={updateField} readOnly={readOnly || (usesCatalogPreset && !isCreatingProfile)} usesCatalogPreset={usesCatalogPreset} />
      <ProviderSubmitControls disabledHint={disabledHint} enabled={form.enabled} isPreview={readOnly} onEnabledChange={(checked) => updateField("enabled", checked)} probeError={probeError} probeLoading={probeLoading} submitLabel={submitLabel} />
    </Panel>
  );
}
