export const stateRoot = ".omnidesk";
export const namespaceManifestPath = ".omnidesk/namespace.json";

function normalizedRelativePath(value) {
  const path = String(value || "").trim().replaceAll("\\", "/").replace(/^\.\//, "");
  if (!path || path.startsWith("/") || path.split("/").some((part) => part === "..")) {
    throw new Error("状态路径必须位于项目根目录内");
  }
  return path;
}

export function resolvedStateRelativePath(relativePath) {
  return normalizedRelativePath(relativePath);
}

export function displayStateRelativePath(relativePath) {
  return normalizedRelativePath(relativePath);
}
