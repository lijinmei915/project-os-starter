function validTaskFileName(value) {
  const file = String(value || "").trim();
  return file.endsWith(".json") && file !== "manifest.json";
}

export function reconcileTaskFileNames(manifestFiles = [], directoryFiles = []) {
  const seen = new Set();
  return [...manifestFiles, ...directoryFiles].filter((file) => {
    if (!validTaskFileName(file) || seen.has(file)) return false;
    seen.add(file);
    return true;
  });
}
