import assert from "node:assert/strict";
import test from "node:test";
import { updateProjectCapability } from "../src/lib/workspace-capability-client.js";

test("keeps workspace capability changes desktop-only in Preview", async () => {
  await assert.rejects(
    () => updateProjectCapability({ capabilityId: "provider", modules: ["models"], status: "enabled" }),
    /桌面 App/
  );
});
