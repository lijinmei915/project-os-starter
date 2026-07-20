export function providerFormFromStatus(provider = {}) {
  const active = Array.isArray(provider.profiles)
    ? provider.profiles.find((profile) => profile.id === provider.activeProfileId)
    : null;
  return {
    ...provider,
    profileId: provider.activeProfileId || provider.profileId || "",
    profileName: active?.name || provider.profileName || "",
    profileNote: active?.note || provider.profileNote || "",
    profileWebsite: active?.website || provider.profileWebsite || "",
  };
}

export function providerFormForProfile(form, profile) {
  return {
    ...form,
    profileId: profile.id,
    profileName: profile.name,
    profileNote: profile.note || "",
    profileWebsite: profile.website || "",
    provider: profile.provider,
    model: profile.model,
    apiBase: profile.apiBase,
    apiKeyEnv: profile.apiKeyEnv,
    enabled: true,
  };
}

export function providerFormForPreset(current, provider, preset) {
  return {
    ...current,
    provider: preset.provider || "openai-compatible",
    model: preset.models.includes(current.model) ? current.model : preset.models[0],
    apiBase: preset.apiBase,
    apiKeyEnv: preset.apiKeyEnv,
    enabled: true,
    profileId: current.profileId || provider.activeProfileId || preset.id,
    profileName: current.profileName || preset.label,
    profileNote: preset.note || "",
    profileWebsite: preset.website || "",
  };
}
