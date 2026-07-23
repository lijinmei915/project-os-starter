export function profileFieldText(profile, key) {
  const value = profile?.fields?.[key]?.value;
  if (Array.isArray(value)) return value.filter(Boolean).join("、");
  if (typeof value === "string") return value.trim();
  return "";
}

export function previewProjectProfile(profile, fallbackProfile = {}) {
  if (!profile?.fields) return fallbackProfile;
  const overview = profileFieldText(profile, "identity.summary") || profileFieldText(profile, "identity.uniqueDescription");
  const next = {
    overview,
    phaseSummary: profileFieldText(profile, "identity.lifecycle"),
    architectureSummary: profileFieldText(profile, "engineering.architecture"),
    checkCommands: profileFieldText(profile, "engineering.testing"),
    collaborationRules: profileFieldText(profile, "governance.permissions") || profileFieldText(profile, "user.communicationStyle"),
    intro: overview,
    longTermGoal: profileFieldText(profile, "product.longTermGoal"),
    targetUsers: profileFieldText(profile, "product.targetUsers"),
    useCases: profileFieldText(profile, "product.useCases"),
    userPreferences: profileFieldText(profile, "user.globalPreferences") || profileFieldText(profile, "user.communicationStyle"),
  };
  const missingFields = [
    ["项目概览", next.overview],
    ["当前阶段", next.phaseSummary],
    ["技术架构", next.architectureSummary],
    ["检查命令", next.checkCommands],
    ["协作规则", next.collaborationRules],
  ].filter(([, value]) => !value).map(([label]) => label);
  return { ...next, missingFields };
}
