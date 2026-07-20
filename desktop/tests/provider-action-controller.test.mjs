import assert from "node:assert/strict";
import test from "node:test";
import { createProviderActionController } from "../src/lib/provider-action-controller.js";

test("persists Provider actions through injected client and feedback boundary", async () => {
  const feedback = [];
  let provider = null;
  const actions = createProviderActionController({
    beginActionFeedback: (...args) => feedback.push(["begin", ...args]),
    fallbackProvider: { enabled: false },
    finishActionFeedback: (...args) => feedback.push(["finish", ...args]),
    providerClient: { saveProviderConfig: async () => ({ enabled: true, model: "test" }) },
    setProvider: (next) => { provider = next; },
    setProviderError: () => {},
  });
  assert.equal(await actions.saveProvider({ model: "test" }), true);
  assert.deepEqual(provider, { enabled: true, model: "test" });
  assert.deepEqual(feedback.at(-1), ["finish", "save-provider", "success", "连接配置已保存。"]);
});

test("re-reads the saved profile and keeps a custom connection name", async () => {
  let provider = null;
  const persisted = {
    activeProfileId: "gateway",
    profiles: [{ id: "gateway", name: "团队主网关" }],
  };
  const actions = createProviderActionController({
    beginActionFeedback: () => {},
    fallbackProvider: {},
    finishActionFeedback: () => {},
    getProviderStatus: async () => persisted,
    providerClient: { saveProviderConfig: async () => ({ activeProfileId: "gateway" }) },
    setProvider: (next) => { provider = next; },
    setProviderError: () => {},
  });

  assert.equal(await actions.saveProvider({ profileId: "gateway", profileName: "团队主网关" }), true);
  assert.deepEqual(provider, persisted);
});

test("reports when the persisted profile name does not match the submitted name", async () => {
  const errors = [];
  const feedback = [];
  const actions = createProviderActionController({
    beginActionFeedback: (...args) => feedback.push(["begin", ...args]),
    fallbackProvider: {},
    finishActionFeedback: (...args) => feedback.push(["finish", ...args]),
    getProviderStatus: async () => ({ activeProfileId: "gateway", profiles: [{ id: "gateway", name: "旧名称" }] }),
    providerClient: { saveProviderConfig: async () => ({ activeProfileId: "gateway" }) },
    setProvider: () => assert.fail("名称校验失败时不应更新 Provider 状态"),
    setProviderError: (message) => errors.push(message),
  });

  assert.equal(await actions.saveProvider({ profileId: "gateway", profileName: "新名称" }), false);
  assert.match(errors.at(-1), /连接名称保存未生效/);
  assert.equal(feedback.at(-1)[2], "failed");
});
