import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaRoot = path.join(root, "schemas");
const outputPath = path.join(root, "docs/data/schema-contract-inventory.json");
const checkMode = process.argv.includes("--check");

function grep(value) {
  if (!value) return [];
  try {
    return execFileSync("git", ["grep", "-l", "-F", "--", value], { cwd: root, encoding: "utf8" })
      .split(/\r?\n/)
      .filter(Boolean);
  } catch (error) {
    if (error.status === 1) return [];
    throw error;
  }
}

function schemaVersion(document) {
  return document.schemaVersion
    || document.properties?.schemaVersion?.const
    || document.properties?.schemaVersion?.enum?.[0]
    || "";
}

const contracts = fs.readdirSync(schemaRoot)
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((name) => {
    const relativePath = path.posix.join("schemas", name);
    const document = JSON.parse(fs.readFileSync(path.join(schemaRoot, name), "utf8"));
    const version = schemaVersion(document);
    const pathConsumers = grep(name).filter((candidate) => candidate !== relativePath);
    const versionConsumers = grep(version).filter((candidate) => candidate !== relativePath);
    const runtimeConsumers = [...new Set([...pathConsumers, ...versionConsumers])]
      .filter((candidate) => candidate.startsWith("desktop/src/") || candidate.startsWith("desktop/src-tauri/") || candidate.startsWith("desktop/tests/"));
    return {
      path: relativePath,
      id: document.$id || "",
      title: document.title || "",
      schemaVersion: version,
      pathConsumers,
      versionConsumers,
      runtimeConsumers,
      status: runtimeConsumers.length ? "active-contract" : "candidate-review",
      migrationRule: runtimeConsumers.length
        ? "先增加 OmniDesk 版本读取/写入迁移与回归，再退役旧版本。"
        : "先确认没有动态读取或外部发布消费者，再决定退役。",
    };
  });

const payload = {
  schemaVersion: "omnidesk.schema-contract-inventory.v1",
  generatedAt: new Date().toISOString(),
  sourceOfTruth: "schemas/*.json plus git grep consumer evidence",
  totals: {
    contracts: contracts.length,
    active: contracts.filter((item) => item.status === "active-contract").length,
    candidates: contracts.filter((item) => item.status === "candidate-review").length,
  },
  contracts,
};

if (checkMode) {
  const existing = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  const comparable = (value) => {
    const clone = structuredClone(value);
    delete clone.generatedAt;
    return JSON.stringify(clone);
  };
  if (comparable(existing) !== comparable(payload)) {
    throw new Error("Schema 契约账本与当前 schemas 或消费者不一致；请运行 node scripts/audit-schema-contracts.mjs 更新。");
  }
  process.stdout.write(`${JSON.stringify({ outputPath: path.relative(root, outputPath), ...payload.totals, status: "valid" })}\n`);
  process.exit(0);
}

fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ outputPath: path.relative(root, outputPath), ...payload.totals })}\n`);
