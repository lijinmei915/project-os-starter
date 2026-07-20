export function isolatedProviderKeyEnv(base, profileId) {
  const normalizedBase = String(base || "OMNIDESK_API_KEY").trim().replace(/_+$/g, "") || "OMNIDESK_API_KEY";
  const suffix = String(profileId || "profile").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "PROFILE";
  return `${normalizedBase}_${suffix}`;
}

export function formatModelTestTime(value) {
  if (value === null || value === undefined || value === "") return "";
  const numeric = typeof value === "number" || /^\d+$/.test(String(value));
  const timestamp = numeric ? Number(value) * (Number(value) < 10 ** 12 ? 1000 : 1) : Date.parse(value);
  if (!Number.isFinite(timestamp)) return "";
  return new Date(timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

export function activeProviderProfileName(provider) {
  const activeProfile = provider?.profiles?.find((profile) => profile.id === provider?.activeProfileId);
  return activeProfile?.name || provider?.profileName || provider?.apiBase || "当前 API";
}

export function providerConnectionLabel(profile) {
  return profile?.name || profile?.apiBase || "未命名连接";
}

export function providerModelUpdate(provider, model) {
  return {
    ...provider,
    model,
    profileId: provider?.profileId || provider?.activeProfileId || "",
  };
}

export function classifyProviderFailure(message) {
  const text = String(message || "").toLowerCase();
  if (/(insufficient_user_quota|quota\s*insufficient|subscription quota|额度不足|订阅额度)/i.test(text)) return "quota-exhausted";
  if (/(http\s*401|http\s*403|invalid api key|invalid token|unauthorized|认证失败)/i.test(text)) return "authentication-failed";
  if (/(model_not_found|model not found|unknown model|模型不存在|模型不可用)/i.test(text)) return "model-unavailable";
  if (/(timed out|timeout|connection|dns|网络|连接)/i.test(text)) return "network-unavailable";
  return "unavailable";
}
