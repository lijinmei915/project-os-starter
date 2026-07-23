import assert from "node:assert/strict";
import test from "node:test";
import { activeProviderProfileName, catalogModelsForProvider, classifyProviderFailure, compactModelLabel, formatModelTestTime, isolatedProviderKeyEnv, modelAvailabilityKey, providerConnectionLabel, providerModelHealth, providerModelKey, providerModelUpdate } from "../src/lib/provider-presentation.js";

test("keeps Provider display labels and isolated key names deterministic", () => {
  assert.equal(activeProviderProfileName({ activeProfileId: "team", profiles: [{ id: "team", name: "团队网关" }] }), "团队网关");
  assert.equal(providerConnectionLabel({ apiBase: "https://api.example.com/v1" }), "https://api.example.com/v1");
  assert.equal(isolatedProviderKeyEnv("TEAM_KEY", "profile-1"), "TEAM_KEY_PROFILE_1");
});

test("formats model test time at minute precision", () => {
  const formatted = formatModelTestTime(Date.UTC(2026, 6, 17, 9, 5));
  assert.match(formatted, /^\d{2}:\d{2}$/);
  assert.equal(formatModelTestTime("invalid"), "");
});

test("keeps the active connection identity when switching its model", () => {
  const update = providerModelUpdate({ activeProfileId: "gateway", apiKeyEnv: "LLM_GATEWAY_API_KEY", model: "gpt-5.5" }, "gpt-5.6-terra");
  assert.equal(update.profileId, "gateway");
  assert.equal(update.apiKeyEnv, "LLM_GATEWAY_API_KEY");
  assert.equal(update.model, "gpt-5.6-terra");
});

test("classifies quota failures separately from network failures", () => {
  assert.equal(classifyProviderFailure("HTTP 403 insufficient_user_quota"), "quota-exhausted");
  assert.equal(classifyProviderFailure("HTTP 401 invalid token"), "authentication-failed");
  assert.equal(classifyProviderFailure("HTTP 404 model_not_found"), "model-unavailable");
  assert.equal(classifyProviderFailure("连接超时"), "network-unavailable");
});

test("classifies provider network failures without confusing them with credentials", () => {
  assert.equal(classifyProviderFailure("request timed out"), "network-unavailable");
  assert.equal(classifyProviderFailure("认证失败"), "authentication-failed");
});

test("derives provider model options and health without touching credentials", () => {
  const provider = { activeProfileId: "team", apiBase: "https://api.example.com/v1", apiKeyEnv: "TEAM_KEY", enabled: true, model: "gpt-5.6" };
  assert.equal(compactModelLabel("gpt-5.6-terra"), "5.6");
  assert.equal(providerModelKey(provider), "https://api.example.com/v1|TEAM_KEY|team");
  assert.equal(modelAvailabilityKey(provider, "gpt-5.6"), "https://api.example.com/v1|TEAM_KEY|gpt-5.6");
  assert.deepEqual(catalogModelsForProvider(provider, {
    providers: [{ apiBase: provider.apiBase, apiKeyEnv: provider.apiKeyEnv, models: ["gpt-5.5", "gpt-5.6"] }],
  }), ["gpt-5.5", "gpt-5.6"]);
  assert.deepEqual(providerModelHealth(provider, { "gpt-5.6": { status: "available" } }), {
    label: "Work",
    status: "available",
    message: "",
  });
});
