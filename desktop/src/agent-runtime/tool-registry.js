import { toolRiskLevels } from "./contract.js";

const toolDefinitions = Object.freeze([
  { id: "list_files", risk: toolRiskLevels.read, accessAction: "read-project", pathArguments: ["path"] },
  { id: "read_file", risk: toolRiskLevels.read, accessAction: "read-project", pathArguments: ["path"] },
  { id: "search_project", risk: toolRiskLevels.read, accessAction: "read-project", pathArguments: ["path"] },
  { id: "git_status", risk: toolRiskLevels.read, accessAction: "read-project", pathArguments: [] },
  { id: "generate_patch", risk: toolRiskLevels.read, accessAction: "generate-patch", pathArguments: ["paths"] },
  { id: "apply_patch", risk: toolRiskLevels.write, accessAction: "apply-patch", pathArguments: [] },
  { id: "run_check", risk: toolRiskLevels.execute, accessAction: "run-check", pathArguments: [] },
]);

function normalizeRelativePath(value) {
  const path = String(value ?? ".").trim().replaceAll("\\", "/");
  if (!path || path === ".") return ".";
  if (path.startsWith("/") || /^[a-zA-Z]:\//.test(path)) throw new Error("tool path must be relative to the project root");
  const segments = path.split("/").filter((segment) => segment && segment !== ".");
  if (segments.some((segment) => segment === "..")) throw new Error("tool path cannot escape the project root");
  if (segments.some((segment) => segment.includes("\0"))) throw new Error("tool path contains invalid characters");
  return segments.join("/") || ".";
}

function normalizeDiffPath(value) {
  const path = String(value || "").split("\t", 1)[0].trim();
  if (path === "/dev/null") return path;
  const normalized = normalizeRelativePath(path.replace(/^[ab]\//, ""));
  if (normalized.split("/").some((segment) => segment.startsWith(".env"))) {
    throw new Error("tool path cannot modify protected environment files");
  }
  return normalized;
}

function validateUnifiedDiff(diff) {
  const raw = String(diff || "");
  if (!raw.trim()) throw new Error("apply_patch requires a unified diff");
  const text = raw.endsWith("\n") ? raw : `${raw}\n`;
  const headers = text.split(/\r?\n/).filter((line) => line.startsWith("--- ") || line.startsWith("+++ "));
  const hasValidHunk = /(^|\n)@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/.test(text);
  if (headers.length < 2 || headers.length % 2 !== 0 || !hasValidHunk) throw new Error("apply_patch requires a valid unified diff");
  for (const header of headers) normalizeDiffPath(header.slice(4));
  return text;
}

export function normalizeToolArguments(definition, input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("tool arguments must be an object");
  const arguments_ = { ...input };
  for (const name of definition.pathArguments) {
    if (Array.isArray(arguments_[name])) arguments_[name] = arguments_[name].map(normalizeRelativePath);
    else arguments_[name] = normalizeRelativePath(arguments_[name]);
  }
  if (definition.id === "run_check") {
    const checkId = String(arguments_.checkId || "").trim();
    if (!checkId || !/^[a-z0-9][a-z0-9._-]*$/i.test(checkId)) throw new Error("run_check requires a registered checkId");
    if ("command" in arguments_) throw new Error("run_check does not accept arbitrary commands");
    arguments_.checkId = checkId;
  }
  if (definition.id === "search_project") {
    const query = String(arguments_.query || "").trim();
    if (!query) throw new Error("search_project requires a query");
    arguments_.query = query;
  }
  if (definition.id === "read_file" && arguments_.path === ".") throw new Error("read_file requires a file path");
  if (definition.id === "apply_patch") arguments_.diff = validateUnifiedDiff(arguments_.diff);
  return Object.freeze(arguments_);
}

export function createToolRegistry(definitions = toolDefinitions) {
  const entries = new Map();
  for (const input of definitions) {
    const definition = Object.freeze({
      ...input,
      approvalRequired: input.approvalRequired ?? input.risk !== toolRiskLevels.read,
      pathArguments: Object.freeze([...(input.pathArguments || [])]),
    });
    if (!definition.id || entries.has(definition.id)) throw new Error(`duplicate or missing tool id: ${definition.id || "unknown"}`);
    if (!Object.values(toolRiskLevels).includes(definition.risk)) throw new Error(`unsupported tool risk: ${definition.risk}`);
    entries.set(definition.id, definition);
  }
  return Object.freeze({
    get(id) { return entries.get(id) || null; },
    list() { return Object.freeze([...entries.values()]); },
  });
}

export const defaultToolRegistry = createToolRegistry();
