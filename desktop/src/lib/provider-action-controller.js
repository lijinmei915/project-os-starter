export function createProviderActionController({
  beginActionFeedback,
  fallbackProvider,
  finishActionFeedback,
  getProviderStatus,
  providerClient,
  setProvider,
  setProviderError,
}) {
  const readPersistedStatus = async (status) => {
    if (typeof getProviderStatus !== "function") return status;
    try {
      return await getProviderStatus({ ...fallbackProvider, ...status });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`连接已写入，但重新读取校验失败：${message}`);
    }
  };

  const verifyProfileName = (status, form) => {
    const expectedName = String(form?.profileName || "").trim();
    if (!expectedName) return;
    const profileId = String(form?.profileId || status?.activeProfileId || "").trim();
    const profile = Array.isArray(status?.profiles)
      ? status.profiles.find((item) => item.id === profileId)
      : null;
    if (Array.isArray(status?.profiles) && !profile) {
      throw new Error(`连接名称保存未生效：未找到连接“${profileId || "当前连接"}”。请重启桌面端后重试。`);
    }
    if (profile && String(profile.name || "").trim() !== expectedName) {
      throw new Error(`连接名称保存未生效：预期“${expectedName}”，实际为“${String(profile.name || "未命名连接")}"。请重启桌面端后重试。`);
    }
  };

  const saveProvider = async (form) => {
    const feedbackKey = "save-provider";
    beginActionFeedback(feedbackKey, "正在保存连接...");
    setProviderError("");
    try {
      const status = await providerClient.saveProviderConfig(form);
      const persistedStatus = await readPersistedStatus(status);
      verifyProfileName(persistedStatus, form);
      setProvider({ ...fallbackProvider, ...persistedStatus });
      finishActionFeedback(feedbackKey, "success", "连接配置已保存。");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setProviderError(message);
      finishActionFeedback(feedbackKey, "failed", `保存连接失败：${message}`);
      return false;
    }
  };

  const saveProviderSecret = async (apiKeyEnv, apiKey) => {
    const feedbackKey = "save-provider-secret";
    beginActionFeedback(feedbackKey, "正在保存 API Key...");
    setProviderError("");
    try {
      const status = await providerClient.saveProviderSecret({ apiKeyEnv, apiKey });
      const persistedStatus = await readPersistedStatus(status);
      setProvider({ ...fallbackProvider, ...persistedStatus });
      finishActionFeedback(feedbackKey, "success", "API Key 已保存。");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setProviderError(message);
      finishActionFeedback(feedbackKey, "failed", `保存 API Key 失败：${message}`);
      return false;
    }
  };

  const deleteProviderProfile = async (profileId) => {
    const feedbackKey = "delete-provider";
    beginActionFeedback(feedbackKey, "正在删除连接...");
    setProviderError("");
    try {
      const status = await providerClient.deleteProviderProfile(profileId);
      setProvider({ ...fallbackProvider, ...status });
      finishActionFeedback(feedbackKey, "success", "连接已删除。");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const displayMessage = message.includes("delete_provider_profile") && message.includes("not found")
        ? "当前桌面进程还没加载删除连接命令，请重启桌面 dev 进程后再删。"
        : message;
      setProviderError(displayMessage);
      finishActionFeedback(feedbackKey, "failed", `删除连接失败：${displayMessage}`);
      return false;
    }
  };

  return { deleteProviderProfile, saveProvider, saveProviderSecret };
}
