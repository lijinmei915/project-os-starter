import { ProviderConnectionSettings } from "../provider/provider-connection-settings";
import * as providerClient from "../../lib/provider-client";
import { isolatedProviderKeyEnv } from "../../lib/provider-presentation";

export function ProviderPanel({ fallbackModelCatalog, modelCatalog, modelTestRecord, onDeleteProviderProfile, onModelTestRecorded, onSaveProvider, onSaveProviderSecret, provider, providerError, source }) {
  const catalog = Array.isArray(modelCatalog?.providers) && modelCatalog.providers.length
    ? modelCatalog
    : fallbackModelCatalog;
  return (
    <ProviderConnectionSettings
      catalog={catalog}
      confirmDelete={(profile) => window.confirm(`删除连接「${profile.name || "未命名连接"}」？\n如果这个 Key 没有被其他连接共用，也会从 .env.local 移除。`)}
      disabledHint="关闭后不调用模型，改用本地规则回答。"
      error={providerError}
      modelTestRecord={modelTestRecord}
      onDeleteProfile={onDeleteProviderProfile}
      onModelTestRecorded={onModelTestRecorded}
      onProbeModels={providerClient.probeProviderModels}
      onSaveProfile={onSaveProvider}
      onSaveSecret={({ apiKeyEnv, apiKey }) => onSaveProviderSecret(apiKeyEnv, apiKey)}
      onTestModel={providerClient.testProviderModel}
      prepareProfileForSave={(form, profiles) => profiles.some((profile) => profile.id !== form.profileId && profile.apiKeyEnv === form.apiKeyEnv)
        ? { ...form, apiKeyEnv: isolatedProviderKeyEnv(form.apiKeyEnv, form.profileId) }
        : form}
      readOnly={source !== "tauri"}
      readOnlyNotice="当前是浏览器预览，仅可查看连接；保存配置、写入 Key 和刷新模型需要在桌面 App 窗口中操作。"
      secretReferenceForProfile={() => {
        const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
        return `OMNIDESK_API_KEY_${suffix}`;
      }}
      status={provider}
    />
  );
}
