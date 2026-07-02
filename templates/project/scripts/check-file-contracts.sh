#!/usr/bin/env bash
set -euo pipefail

root="${1:-.}"
registry="$root/schemas/file-contracts.v0.1.json"

if [ ! -f "$registry" ]; then
  echo "ERROR: missing file contract registry: $registry"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "WARN: node not found; skipped file contract validation"
  exit 0
fi

node - "$root" "$registry" <<'NODE'
const fs = require("fs");
const path = require("path");
const root = process.argv[2];
const registryPath = process.argv[3];
const data = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const allowedPolicies = new Set(["merge", "append-and-prune", "create-or-merge"]);
const required = ["file", "purpose", "triggers", "requiredSections", "forbidden", "updatePolicy", "validation"];
const coreSsotFiles = ["PROJECT.md", "AGENTS.md", "HANDOFF.md", "PRODUCT.md", "docs/ARCHITECTURE.md", "docs/ENVIRONMENT.md", "docs/TESTING.md", ".agents/skills/example-skill/SKILL.md"];
let errors = 0;

function fail(message) {
  errors += 1;
  console.error(`ERROR: ${message}`);
}

if (data.schemaVersion !== "project-os.file-contracts.v0.1") fail("unexpected schemaVersion");
if (!Array.isArray(data.contracts) || data.contracts.length !== 8) fail("registry must define exactly 8 initial core contracts");

const contractsByFile = new Map((data.contracts || []).map(contract => [contract.file, contract]));
for (const file of coreSsotFiles) {
  if (!contractsByFile.has(file)) fail(`missing core SSOT file contract: ${file}`);
}

for (const contract of data.contracts || []) {
  for (const key of required) {
    if (!(key in contract)) fail(`${contract.file || "unknown"}: missing ${key}`);
  }
  for (const key of ["triggers", "requiredSections", "forbidden", "validation"]) {
    if (!Array.isArray(contract[key]) || contract[key].length === 0) fail(`${contract.file}: ${key} must be a non-empty array`);
  }
  if (!allowedPolicies.has(contract.updatePolicy)) fail(`${contract.file}: unsupported updatePolicy ${contract.updatePolicy}`);

  const sourcePath = path.join(root, contract.file);
  const templatePath = path.join(root, "templates/project-docs", contract.file);
  const projectTemplatePath = path.join(root, "templates/project", contract.file);
  const hasDeclaredGenerator = typeof contract.generator === "string" && contract.generator.length > 0;
  if (!fs.existsSync(sourcePath) && !fs.existsSync(templatePath) && !fs.existsSync(projectTemplatePath) && !hasDeclaredGenerator) {
    fail(`${contract.file}: no source file or distributable template`);
  }
  if (hasDeclaredGenerator) {
    const [generatorFile, marker] = contract.generator.split("#");
    const generatorPath = path.join(root, generatorFile);
    if (!fs.existsSync(generatorPath)) fail(`${contract.file}: missing generator file ${generatorFile}`);
    else if (marker && !fs.readFileSync(generatorPath, "utf8").includes(marker)) fail(`${contract.file}: missing generator marker ${marker}`);
  }
  for (const command of contract.validation || []) {
    if (!/^bash scripts\/[a-z0-9-]+\.sh(?: \.)?$/.test(command)) fail(`${contract.file}: invalid validation command ${command}`);
    const script = command.match(/^bash (scripts\/[a-z0-9-]+\.sh)/)?.[1];
    if (script && !fs.existsSync(path.join(root, script))) fail(`${contract.file}: missing validation script ${script}`);
  }
}

function extractArrayBlock(source, name) {
  const start = source.indexOf(`const ${name} = [`);
  if (start === -1) return "";
  const open = source.indexOf("[", start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "[") depth += 1;
    if (ch === "]") depth -= 1;
    if (depth === 0) return source.slice(open, i + 1);
  }
  return "";
}

const indexPath = path.join(root, "index.html");
if (fs.existsSync(indexPath)) {
  const indexSource = fs.readFileSync(indexPath, "utf8");
  const optionalBlock = extractArrayBlock(indexSource, "OPTIONAL_TEMPLATES");
  const optionalFiles = [...optionalBlock.matchAll(/file:\s*"([^"]+)"/g)].map(match => match[1]);
  const generatedBlock = indexSource.slice(indexSource.indexOf("const GENERATED_RUNTIME_TEMPLATES = {"));
  const generatedFiles = new Set([...generatedBlock.matchAll(/^\s*"([^"]+)":/gm)].map(match => match[1]));
  for (const file of optionalFiles) {
    const sourcePath = path.join(root, file);
    const templatePath = path.join(root, "templates/project-docs", file);
    const projectTemplatePath = path.join(root, "templates/project", file);
    const isDirectoryIntent = file.endsWith("/");
    if (!fs.existsSync(sourcePath) && !fs.existsSync(templatePath) && !fs.existsSync(projectTemplatePath) && !generatedFiles.has(file) && !isDirectoryIntent) {
      fail(`OPTIONAL_TEMPLATES maps to non-generatable file: ${file}`);
    }
  }
}

if (errors) process.exit(1);
console.log(`File contracts valid: ${data.contracts.length}`);
NODE
