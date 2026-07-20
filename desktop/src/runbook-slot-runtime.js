import { createSlotRuntime } from "./slot-runtime.js";
import { runbookSelectors } from "./runbook-selectors.js";

export function compileRunbookSlots({ capabilityManifest, components, contract, store }) {
  return createSlotRuntime({ componentRegistry: components, selectorRegistry: runbookSelectors })
    .compile({ capabilityManifest, contract, store, surface: "project-runbook" });
}
