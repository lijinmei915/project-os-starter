import assert from "node:assert/strict";
import test from "node:test";

import { providerFormForPreset, providerFormForProfile, providerFormFromStatus } from "../src/lib/provider-form-state.js";

test("derives the active provider profile into one editable form", () => {
  const form = providerFormFromStatus({
    activeProfileId: "team",
    profiles: [{ id: "team", name: "团队网关", note: "共享", website: "https://example.test" }],
  });
  assert.equal(form.profileId, "team");
  assert.equal(form.profileName, "团队网关");
  assert.equal(form.profileNote, "共享");
});

test("keeps provider preset and profile transitions data-only", () => {
  const preset = { id: "openai", provider: "openai-compatible", models: ["gpt-5"], apiBase: "https://api.example.test/v1", apiKeyEnv: "OPENAI_API_KEY", label: "OpenAI" };
  const presetForm = providerFormForPreset({ model: "other", profileName: "" }, { activeProfileId: "team" }, preset);
  assert.equal(presetForm.model, "gpt-5");
  assert.equal(presetForm.profileId, "team");
  const profileForm = providerFormForProfile(presetForm, { id: "personal", name: "个人", provider: "openai-compatible", model: "gpt-5", apiBase: "https://x", apiKeyEnv: "PERSONAL_KEY" });
  assert.equal(profileForm.profileId, "personal");
  assert.equal(profileForm.apiKeyEnv, "PERSONAL_KEY");
});
