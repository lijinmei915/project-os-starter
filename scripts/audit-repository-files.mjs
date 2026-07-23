import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputArgument = process.argv.indexOf("--output");
const checkMode = process.argv.includes("--check");
const outputPath = outputArgument >= 0
  ? path.resolve(root, process.argv[outputArgument + 1])
  : path.join(root, "docs/data/repository-file-inventory.json");

const reviewPath = path.join(root, "docs/data/repository-file-review.json");
const review = JSON.parse(fs.readFileSync(reviewPath, "utf8"));
if (review.schemaVersion !== "omnidesk.repository-file-review.v1" || !Array.isArray(review.decisions) || (review.rules && !Array.isArray(review.rules))) {
  throw new Error("repository-file-review.json 格式无效");
}
const knownDecisions = new Map(review.decisions.map((item) => [item.path, item]));
const reviewRules = review.rules || [];
if (reviewRules.some((rule) => !rule.id || !rule.pathPrefix || !rule.decision || !rule.rationale || !rule.reviewStatus || !rule.verification)) {
  throw new Error("repository-file-review.json 规则缺少必填字段");
}

function decisionFor(file) {
  const exact = knownDecisions.get(file);
  if (exact) return { ...exact, source: "registry" };
  const rule = reviewRules
    .filter(({ pathPrefix }) => file.startsWith(pathPrefix))
    .sort((left, right) => right.pathPrefix.length - left.pathPrefix.length)[0];
  return rule ? { ...rule, source: `rule:${rule.id}` } : null;
}

function classify(file) {
  if (file === ".github/workflows/agent-eval.yml" || file === ".github/workflows/ci.yml") return ["ci", "Release Engineering"];
  if (file.startsWith("desktop/src-tauri/src/runtime/")) return ["runtime", "Local Agent Runtime"];
  if (file.startsWith("desktop/src-tauri/")) return ["native", "Desktop Shell"];
  if (file.startsWith("desktop/src/agent-runtime/")) return ["eval-support", "Agent Reliability"];
  if (file.startsWith("desktop/src/components/workbench/")) return ["frontend", "Workbench"];
  if (file.startsWith("desktop/src/")) return ["frontend", "Desktop Frontend"];
  if (file.startsWith("desktop/tests/")) return ["test", "Desktop Quality"];
  if (file.startsWith("desktop/evals/") || file.startsWith("desktop/scripts/run-agent-eval") || file.includes("agent-eval")) return ["eval", "Agent Reliability"];
  if (file.startsWith("desktop/")) return ["desktop-support", "Desktop Platform"];
  if (file.startsWith("docs/data/")) return ["documentation-data", "Documentation Governance"];
  if (file.startsWith("docs/")) return ["documentation", "Documentation Governance"];
  if (file.startsWith("schemas/")) return ["schema", "Runtime Contracts"];
  if (file.startsWith("tests/")) return ["test", "Repository Quality"];
  if (file.startsWith("scripts/")) return ["repository-tooling", "Repository Quality"];
  if (file.startsWith("examples/")) return ["legacy-example", "Legacy Review"];
  if (["package-lock.json", "Cargo.lock"].includes(path.basename(file)) || file.includes("/gen/")) return ["generated", "Build Toolchain"];
  if (file.endsWith(".md")) return ["root-document", "Documentation Governance"];
  return ["repository", "Repository Governance"];
}

function pathMentions(file) {
  try {
    const boundary = new RegExp(`(?:^|[\\s\"'\\\`(\[]|/)${file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[\\s\"'\\\`),;:#\]])`, "m");
    return execFileSync("git", ["grep", "-l", "-F", "--", file], { cwd: root, encoding: "utf8" })
      .split(/\r?\n/)
      .filter(Boolean)
      .filter((candidate) => candidate !== file && candidate !== path.relative(root, outputPath))
      .filter((candidate) => boundary.test(fs.readFileSync(path.join(root, candidate), "utf8")));
  } catch (error) {
    if (error.status === 1) return [];
    throw error;
  }
}

const trackedFiles = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard"],
  { cwd: root, encoding: "utf8" },
)
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((file, index, files) => files.indexOf(file) === index)
  // git ls-files retains entries deleted in the working tree until staging. Inventory only files that
  // are present for the current audit so an authorized retirement can be recorded and regenerated.
  .filter((file) => fs.existsSync(path.join(root, file)))
  .sort();

const moduleSourceFiles = trackedFiles.filter((file) => /\.(?:[cm]?js|jsx|rs)$/.test(file));
const moduleSourceText = new Map(moduleSourceFiles.map((file) => [file, fs.readFileSync(path.join(root, file), "utf8")]));
const assetReferenceFiles = trackedFiles.filter((file) => file.endsWith(".css"));
const assetReferenceText = new Map(assetReferenceFiles.map((file) => [file, fs.readFileSync(path.join(root, file), "utf8")]));

function normalizedRelativePath(value) {
  return path.posix.normalize(value).replace(/^\.\//, "");
}

function resolvesTo(importer, specifier, target) {
  if (!specifier.startsWith(".")) return false;
  const base = normalizedRelativePath(path.posix.join(path.posix.dirname(importer), specifier));
  const candidates = [
    base,
    `${base}.js`,
    `${base}.jsx`,
    `${base}.mjs`,
    `${base}.json`,
    `${base}/index.js`,
    `${base}/index.jsx`,
    `${base}/index.mjs`,
  ];
  return candidates.includes(target);
}

function moduleConsumers(file) {
  const consumers = [];
  if (/\.(?:[cm]?js|jsx|json)$/.test(file)) {
    const specifierPattern = /(?:import\s*(?:[^"']*?\s+from\s*)?|export\s+[^"']*?\s+from\s*|import\s*\(|require\s*\()\s*["']([^"']+)["']/g;
    for (const [candidate, source] of moduleSourceText) {
      for (const match of source.matchAll(specifierPattern)) {
        if (resolvesTo(candidate, match[1], file)) {
          consumers.push(candidate);
          break;
        }
      }
    }
  }
  if (file.endsWith(".rs")) {
    const moduleName = path.posix.basename(file, ".rs");
    const modulePattern = new RegExp(`(?:mod\\s+${moduleName}\\s*;|(?:crate::)?runtime::${moduleName}(?:::)?)`);
    consumers.push(...[...moduleSourceText.entries()]
      .filter(([candidate, source]) => candidate !== file && candidate.endsWith(".rs") && modulePattern.test(source))
      .map(([candidate]) => candidate)
    );
  }
  if (file.endsWith(".css")) {
    const importPattern = /@import\s+(?:url\(\s*)?["']([^"')]+)["']/g;
    for (const [candidate, source] of assetReferenceText) {
      for (const match of source.matchAll(importPattern)) {
        if (resolvesTo(candidate, match[1], file)) {
          consumers.push(candidate);
          break;
        }
      }
    }
  }
  if (/\.(?:svg|png|jpg|jpeg|webp|gif|woff2?)$/i.test(file)) {
    const urlPattern = /url\(\s*["']?([^"')]+)["']?\s*\)/g;
    for (const [candidate, source] of assetReferenceText) {
      for (const match of source.matchAll(urlPattern)) {
        if (resolvesTo(candidate, match[1], file)) {
          consumers.push(candidate);
          break;
        }
      }
    }
  }
  return [...new Set(consumers)].sort();
}

const files = trackedFiles.map((file) => {
  const [kind, owner] = classify(file);
  const decision = decisionFor(file);
  const absolute = path.join(root, file);
  const stat = fs.statSync(absolute);
  const consumers = moduleConsumers(file);
  return {
    path: file,
    kind,
    owner,
    // The generated inventory cannot record its own changing serialized size.
    bytes: file === path.relative(root, outputPath) ? 0 : stat.size,
    pathMentions: pathMentions(file),
    moduleConsumers: consumers,
    consumerEvidence: consumers.length ? "static-module-consumer" : "no-static-module-consumer",
    consumerReview: consumers.length
      ? "静态 import/mod 关系已记录。"
      : "没有静态 import/mod 关系；路径提及、Owner 和领域回归构成保留证据，删除前必须补运行时或发布消费者复核。",
    decision: decision?.decision || "keep",
    rationale: decision?.rationale || "未列为遗留或重写候选；按当前 Owner 默认保留，后续改动或删除必须复核消费者证据。",
    reviewStatus: decision?.reviewStatus || "classified",
    verification: decision?.verification || "自动审计：git ls-files、路径提及与静态模块消费者扫描；变更前执行所属领域回归。",
    decisionEvidence: decision
      ? decision.source === "registry" ? "manual-review-registry" : `manual-review-${decision.source}`
      : "inventory-default-retention",
  };
});

const summary = Object.groupBy(files, ({ kind }) => kind);
const payload = {
  schemaVersion: "omnidesk.repository-file-inventory.v1",
  generatedAt: new Date().toISOString(),
  sourceOfTruth: "git ls-files --cached --others --exclude-standard",
  scope: "受版本控制文件及准备纳入版本控制的非忽略工作树文件；忽略的本地运行数据和构建输出不在本账本内。",
  reviewContract: {
    decisions: ["keep", "rewrite", "move", "merge", "rename", "retire", "compatibility-review", "review"],
    requiredEvidence: ["owner", "pathMentions", "moduleConsumers", "runtime-or-test-consumer", "verification"],
    rule: "没有消费者证据的文件不自动删除；必须由对应 Owner 审核并通过验证后才能退役。",
  },
  totals: {
    files: files.length,
    byKind: Object.fromEntries(Object.entries(summary).map(([kind, entries]) => [kind, entries.length])),
    classified: files.filter(({ reviewStatus }) => reviewStatus === "classified").length,
    candidates: files.filter(({ reviewStatus }) => reviewStatus === "candidate-confirmed").length,
    inProgress: files.filter(({ reviewStatus }) => reviewStatus === "in-progress").length,
    reviewed: files.filter(({ reviewStatus }) => reviewStatus === "reviewed").length,
  },
  files,
};

const missingRequiredEvidence = files.filter((file) => [
  file.owner,
  file.consumerEvidence,
  file.consumerReview,
  file.decision,
  file.decisionEvidence,
  file.verification,
].some((value) => !String(value || "").trim()));
if (missingRequiredEvidence.length) {
  throw new Error(`文件账本缺少必填审计字段：${missingRequiredEvidence.map(({ path }) => path).join(", ")}`);
}

if (checkMode) {
  const existing = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  const comparable = (value) => {
    const clone = structuredClone(value);
    delete clone.generatedAt;
    return JSON.stringify(clone);
  };
  if (comparable(existing) !== comparable(payload)) {
    throw new Error("文件账本与当前 tracked 文件或审查登记不一致；请运行 node scripts/audit-repository-files.mjs 更新。");
  }
  process.stdout.write(`${JSON.stringify({ outputPath: path.relative(root, outputPath), files: files.length, status: "valid" })}\n`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ outputPath: path.relative(root, outputPath), files: files.length, candidates: payload.totals.candidates })}\n`);
