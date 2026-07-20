import { currentProgressSelectors } from "./current-progress-selectors.js";
import { createSlotRuntime } from "./slot-runtime.js";

export function compileCurrentProgressSlots({ capabilityManifest, components, contract, store }) {
  return createSlotRuntime({ componentRegistry: components, selectorRegistry: currentProgressSelectors })
    .compile({ capabilityManifest, contract, store, surface: "project-progress" });
}
