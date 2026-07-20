export const legacyStateRoot = ".project-os";
export const stateRoot = ".omnidesk";
export const namespaceManifestPath = ".omnidesk/namespace.json";

function normalizedRelativePath(value) {
  const path = String(value || "").trim().replaceAll("\\", "/").replace(/^\.\//, "");
  if (!path || path.startsWith("/") || path.split("/").some((part) => part === "..")) {
    throw new Error("状态路径必须位于项目根目录内");
  }
  return path;
}

export function migratedStateRelativePath(relativePath) {
  const normalized = normalizedRelativePath(relativePath);
  if (normalized === stateRoot || normalized.startsWith(`${stateRoot}/`)) return normalized;
  if (normalized === legacyStateRoot) return stateRoot;
  if (!normalized.startsWith(`${legacyStateRoot}/`)) return normalized;

  const legacy = normalized.slice(legacyStateRoot.length + 1);
  const [first, ...rest] = legacy.split("/");
  const remainder = rest.join("/");
  let partition = "data";
  let mapped = legacy;

  if (["events", "transactions", "locks"].includes(first)) {
    partition = "runtime";
  } else if (["tmp", "graph", "entry-contexts", "state-bundles", "recommendations"].includes(first)
    || ["model-health.json", "fact-freshness.json", "workspace-facts.json", "native-terminal-trace.json"].includes(first)) {
    partition = "cache";
  } else if (["goal-validation-report.json", "reports", "backups"].includes(first)) {
    partition = "evidence";
  } else if (first === "runs" && (remainder === "desktop-tasks" || remainder.startsWith("desktop-tasks/"))) {
    mapped = remainder.replace(/^desktop-tasks\/?/, "tasks/").replace(/\/$/, "");
  } else if (first === "runs" && (remainder === "desktop-conversations" || remainder.startsWith("desktop-conversations/"))) {
    mapped = remainder.replace(/^desktop-conversations\/?/, "conversations/").replace(/\/$/, "");
  } else if (first === "runs" && (remainder === "agent-runs" || remainder.startsWith("agent-runs/"))) {
    mapped = remainder.replace(/^agent-runs\/?/, "agent-runs/").replace(/\/$/, "");
  } else if (first === "runs") {
    partition = "evidence";
  } else if (legacy.includes("/") && !["conversations", "agent-runs"].includes(first)) {
    partition = "evidence";
    mapped = `legacy-unclassified/${legacy}`;
  }

  return `${stateRoot}/${partition}/${mapped}`;
}

export function resolvedStateRelativePath(relativePath, namespaceActive) {
  return namespaceActive ? migratedStateRelativePath(relativePath) : normalizedRelativePath(relativePath);
}
