import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const allowedSlices = new Set(["p1", "p3", "p4", "suite"]);

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function filesBelow(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const candidate = path.join(root, entry.name);
    return entry.isDirectory() ? filesBelow(candidate) : [candidate];
  });
}

function normalizedSlice(segment) {
  const value = segment.replace(/^agent-eval-/, "");
  if (!allowedSlices.has(value)) throw new Error(`Unknown Agent Eval slice: ${segment}`);
  return value;
}

export function buildArtifactIndex({ commit, root, runId }) {
  if (!runId || !commit) throw new Error("Agent Eval artifact index requires run id and commit");
  if (!root || !fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error("Agent Eval artifact directory does not exist");
  }
  const files = filesBelow(root).sort().map((file) => {
    const relativePath = path.relative(root, file).split(path.sep).join("/");
    const [sliceDirectory] = relativePath.split("/");
    return {
      slice: normalizedSlice(sliceDirectory),
      path: relativePath.replace(/^agent-eval-/, ""),
      bytes: fs.statSync(file).size,
      sha256: crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
    };
  });
  if (!files.length) throw new Error("Agent Eval artifact index cannot be empty");
  return {
    schemaVersion: "omnidesk.agent-eval-artifact-index.v0.1",
    runId,
    commit,
    slices: [...new Set(files.map(({ slice }) => slice))].sort(),
    files,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(argument("--root"));
  const output = path.resolve(argument("--output"));
  const index = buildArtifactIndex({
    commit: argument("--commit"),
    root,
    runId: argument("--run-id"),
  });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(index, null, 2)}\n`);
}
