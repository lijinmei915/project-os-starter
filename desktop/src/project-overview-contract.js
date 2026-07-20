export function validateProjectOverviewContract(contract) {
  const errors = [];
  const facts = Array.isArray(contract?.facts) ? contract.facts : [];
  const slots = Array.isArray(contract?.slots) ? contract.slots : [];
  const factIds = new Set();
  const slotIds = new Set();

  for (const fact of facts) {
    if (!fact?.id || !fact.primary) errors.push("fact requires id and primary source");
    if (factIds.has(fact.id)) errors.push(`duplicate fact id: ${fact.id}`);
    factIds.add(fact.id);
  }
  for (const slot of slots) {
    if (slotIds.has(slot.id)) errors.push(`duplicate slot id: ${slot.id}`);
    slotIds.add(slot.id);
    if (!contract.allowedSelectors?.includes(slot.selector)) errors.push(`unknown selector: ${slot.selector}`);
    if (!contract.allowedComponents?.includes(slot.component)) errors.push(`unknown component: ${slot.component}`);
    if (slot.capability && !slot.capability.id) errors.push(`slot capability requires id: ${slot.id}`);
    for (const dependency of slot.dependencies || []) {
      if (!factIds.has(dependency)) errors.push(`unknown fact dependency: ${dependency}`);
    }
  }
  const requiredEventOrder = ["source.changed", "fact.invalidated", "fact.updated", "selector.recomputed", "slot.updated"];
  if (JSON.stringify(contract?.eventOrder) !== JSON.stringify(requiredEventOrder)) errors.push("invalid fact event order");
  return errors;
}
