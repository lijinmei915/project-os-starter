export function normalizeConversationReferences(references = []) {
  const seen = new Set();
  return references.filter((reference) => {
    const key = `${reference?.kind || ""}:${reference?.target || ""}`;
    if (!reference?.kind || !reference?.target || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
