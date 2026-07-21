import assert from "node:assert/strict";
import test from "node:test";
import {
  deleteProviderProfile,
  getModelCatalog,
  getModelHealth,
  getProviderStatus,
  probeProviderModels,
  saveProviderConfig,
  testProviderModel,
} from "../src/lib/provider-client.js";

test("reads provider state from preview files without probing remote models", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(url);
    return { ok: true, json: async () => ({ enabled: true, entries: [{ model: "gpt-5" }] }) };
  };
  try {
    assert.deepEqual(await getProviderStatus({ enabled: false }), { enabled: true, entries: [{ model: "gpt-5" }] });
    assert.deepEqual(await getModelCatalog({ providers: [] }), { providers: [], enabled: true, entries: [{ model: "gpt-5" }] });
    assert.deepEqual(await getModelHealth(), { schemaVersion: "project-os.model-health.v0.1", entries: [{ model: "gpt-5" }], enabled: true });
    assert.deepEqual(requests, [
      "/__project-os/provider-status",
      "/.omnidesk/data/model-catalog.json",
      "/.omnidesk/cache/model-health.json",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("keeps Provider mutations desktop-only in Preview", async () => {
  for (const operation of [
    () => saveProviderConfig({ model: "gpt-5" }),
    () => testProviderModel({ model: "gpt-5" }),
    () => probeProviderModels({ apiBase: "https://api.example.test/v1", apiKeyEnv: "EXAMPLE_KEY" }),
    () => deleteProviderProfile("profile-1"),
  ]) await assert.rejects(operation, /桌面 App/);
});
