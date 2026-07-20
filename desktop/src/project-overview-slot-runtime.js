import { projectOverviewSelectors } from "./project-overview-selectors.js";
import { createSlotRuntime } from "./slot-runtime.js";

export function compileProjectOverviewSlots({ actions, capabilityManifest, components, contract, store }) {
  return createProjectOverviewSlotRuntime({ actions, components }).compile({ capabilityManifest, contract, store, surface: "project-overview" });
}

export function createProjectOverviewSlotRuntime({ actions, components }) {
  return createSlotRuntime({
    actionRegistry: actions,
    componentRegistry: components,
    selectorRegistry: projectOverviewSelectors,
  });
}
