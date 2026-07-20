import { isSlotCapabilityEnabled } from "./capability-policy.js";

function shouldRender(slot, viewModel, enabledSlots) {
  if (slot.renderWhen === "always") return true;
  if (slot.renderWhen === "enabled") return enabledSlots.has(slot.id);
  return viewModel.render !== false;
}

function freezeDescriptor(descriptor) {
  return Object.freeze({
    ...descriptor,
    actions: Object.freeze(descriptor.actions),
    dependencies: Object.freeze(descriptor.dependencies),
  });
}

function orderedSlots(contract, surface) {
  return [...(contract.slots || [])]
    .filter((slot) => !surface || slot.surface === surface)
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
}

export function createSlotDependencyIndex(contract, surface) {
  const index = {};
  for (const slot of orderedSlots(contract, surface)) {
    for (const factId of slot.dependencies) {
      const entry = index[factId] || { selectorIds: [], slotIds: [] };
      if (!entry.selectorIds.includes(slot.selector)) entry.selectorIds.push(slot.selector);
      if (!entry.slotIds.includes(slot.id)) entry.slotIds.push(slot.id);
      index[factId] = entry;
    }
  }
  return Object.freeze(Object.fromEntries(Object.entries(index).map(([id, entry]) => [id, Object.freeze({
    selectorIds: Object.freeze(entry.selectorIds),
    slotIds: Object.freeze(entry.slotIds),
  })])));
}

function pipelineEvents({ changedFactIds, occurredAt, projectId, selectorIds, slotIds, sourcePaths }) {
  const base = { occurredAt, projectId };
  return Object.freeze([
    Object.freeze({ ...base, type: "source.changed", sourcePaths: Object.freeze([...sourcePaths]) }),
    Object.freeze({ ...base, type: "fact.invalidated", factIds: Object.freeze([...changedFactIds]) }),
    Object.freeze({ ...base, type: "fact.updated", factIds: Object.freeze([...changedFactIds]) }),
    Object.freeze({ ...base, type: "selector.recomputed", selectorIds: Object.freeze([...selectorIds]) }),
    Object.freeze({ ...base, type: "slot.updated", slotIds: Object.freeze([...slotIds]) }),
  ]);
}

export function createSlotRuntime({ actionRegistry = {}, componentRegistry, selectorRegistry }) {
  if (!componentRegistry || !selectorRegistry) throw new Error("slot runtime requires component and selector registries");

  return Object.freeze({
    compile({ capabilityManifest, contract, enabledSlots = [], store, surface }) {
      if (!contract || !store) throw new Error("slot runtime requires contract and fact store");
      const enabled = new Set(enabledSlots);
      const slots = orderedSlots(contract, surface);

      return Object.freeze(slots.flatMap((slot) => {
        if (!isSlotCapabilityEnabled(slot.capability, capabilityManifest)) return [];
        const selector = selectorRegistry[slot.selector];
        const component = componentRegistry[slot.component];
        if (typeof selector !== "function") throw new Error(`unregistered selector: ${slot.selector}`);
        if (!component) throw new Error(`unregistered component: ${slot.component}`);
        const missingDependencies = slot.dependencies.filter((id) => !store.has(id));
        if (missingDependencies.length) throw new Error(`slot ${slot.id} has unavailable dependencies: ${missingDependencies.join(", ")}`);

        const viewModel = selector(store);
        if (viewModel?.id !== slot.id) throw new Error(`selector ${slot.selector} returned ${viewModel?.id || "no slot id"}, expected ${slot.id}`);
        if (!shouldRender(slot, viewModel, enabled)) return [];

        const actions = (slot.actions || []).map((id) => {
          if (!(id in actionRegistry)) throw new Error(`unregistered action: ${id}`);
          return Object.freeze({ id, handler: actionRegistry[id] });
        });
        return [freezeDescriptor({
          id: slot.id,
          surface: slot.surface,
          region: slot.region,
          order: slot.order,
          component,
          componentId: slot.component,
          selectorId: slot.selector,
          dependencies: [...slot.dependencies],
          actions,
          props: viewModel,
        })];
      }));
    },
    reconcile({ capabilityManifest, changedFactIds = [], contract, enabledSlots = [], occurredAt = new Date().toISOString(), previousDescriptors = [], sourcePaths = [], store, surface }) {
      const index = createSlotDependencyIndex(contract, surface);
      const affectedSlotIds = [...new Set(changedFactIds.flatMap((id) => index[id]?.slotIds || []))];
      const affectedSelectorIds = [...new Set(changedFactIds.flatMap((id) => index[id]?.selectorIds || []))];
      if (!affectedSlotIds.length) {
        return Object.freeze({
          descriptors: previousDescriptors,
          events: pipelineEvents({ changedFactIds, occurredAt, projectId: store.projectId, selectorIds: [], slotIds: [], sourcePaths }),
          recomputedSlotIds: Object.freeze([]),
        });
      }

      const affectedContract = { ...contract, slots: contract.slots.filter((slot) => affectedSlotIds.includes(slot.id)) };
      const replacements = new Map(this.compile({ capabilityManifest, contract: affectedContract, enabledSlots, store, surface }).map((descriptor) => [descriptor.id, descriptor]));
      const previous = new Map(previousDescriptors.map((descriptor) => [descriptor.id, descriptor]));
      const descriptors = Object.freeze(orderedSlots(contract, surface).flatMap((slot) => {
        if (!isSlotCapabilityEnabled(slot.capability, capabilityManifest)) return [];
        if (affectedSlotIds.includes(slot.id)) return replacements.has(slot.id) ? [replacements.get(slot.id)] : [];
        return previous.has(slot.id) ? [previous.get(slot.id)] : [];
      }));
      return Object.freeze({
        descriptors,
        events: pipelineEvents({ changedFactIds, occurredAt, projectId: store.projectId, selectorIds: affectedSelectorIds, slotIds: affectedSlotIds, sourcePaths }),
        recomputedSlotIds: Object.freeze(affectedSlotIds),
      });
    },
  });
}
