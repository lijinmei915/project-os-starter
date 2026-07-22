#!/usr/bin/env bash
set -euo pipefail

root="${1:-.}"
manifest="$root/docs/data/doc-structure.manifest.json"

if [ ! -f "$manifest" ]; then
  echo "ERROR: missing documentation structure manifest: $manifest"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "WARN: node not found; skipped documentation structure validation"
  exit 0
fi

node - "$root" "$manifest" <<'NODE'
const fs = require("fs");
const path = require("path");

const root = process.argv[2];
const manifestPath = process.argv[3];
const data = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
let errors = 0;

function fail(message) {
  errors += 1;
  console.error(`ERROR: ${message}`);
}

function listMarkdownDocs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(name => name.endsWith(".md"))
    .map(name => path.posix.join("docs", name))
    .sort();
}

function markdownHeadings(source) {
  return new Set(
    source
      .split(/\r?\n/)
      .map(line => line.match(/^#{1,6}\s+(.+?)\s*$/)?.[1]?.replace(/`/g, "").trim())
      .filter(Boolean)
  );
}

function markdownLinks(source) {
  const links = new Set();
  for (const match of source.matchAll(/(?:\[[^\]]+\]\(([^)]+)\)|`([^`]+\.md)`)/g)) {
    const raw = (match[1] || match[2] || "").trim();
    if (!raw || raw.startsWith("http") || raw.startsWith("#")) continue;
    const clean = raw.split("#")[0].replace(/^<|>$/g, "");
    if (clean.endsWith(".md")) links.add(clean);
  }
  return links;
}

if (data.schemaVersion !== "omnidesk.doc-structure.v0.1") {
  fail(`unexpected schemaVersion: ${data.schemaVersion}`);
}
if (data.sourceOfTruth !== "docs/DOCUMENTATION.md") {
  fail("sourceOfTruth must be docs/DOCUMENTATION.md");
}
if (!Array.isArray(data.documents) || data.documents.length === 0) {
  fail("documents must be a non-empty array");
}

const requiredRootDocs = ["README.md", "INSTALL.md", "AGENTS.md", "PROJECT.md", "HANDOFF.md", "PRODUCT.md"];
const requiredDocs = [...requiredRootDocs, ...listMarkdownDocs(path.join(root, "docs"))];
const byFile = new Map();
const responsibilityOwners = new Map();
const outgoing = new Map();
const incoming = new Map();

for (const doc of data.documents || []) {
  if (!doc.file || typeof doc.file !== "string") fail("document entry missing file");
  if (!doc.responsibility || typeof doc.responsibility !== "string") fail(`${doc.file || "unknown"}: missing responsibility`);
  if (!Array.isArray(doc.ssotFor) || doc.ssotFor.length === 0) fail(`${doc.file}: ssotFor must be a non-empty array`);
  if (!Array.isArray(doc.requiredSections)) fail(`${doc.file}: requiredSections must be an array`);
  if (!Array.isArray(doc.forbiddenOverlap)) fail(`${doc.file}: forbiddenOverlap must be an array`);

  if (doc.file) {
    if (byFile.has(doc.file)) fail(`duplicate manifest entry: ${doc.file}`);
    byFile.set(doc.file, doc);
  }
  if (doc.responsibility) {
    const owner = responsibilityOwners.get(doc.responsibility);
    if (owner) fail(`duplicated responsibility: ${doc.responsibility} (${owner}, ${doc.file})`);
    else responsibilityOwners.set(doc.responsibility, doc.file);
  }

  const fullPath = path.join(root, doc.file || "");
  if (doc.file && !fs.existsSync(fullPath)) {
    fail(`${doc.file}: manifest points to missing file`);
    continue;
  }
  if (doc.file && doc.file.endsWith(".md")) {
    const source = fs.readFileSync(fullPath, "utf8");
    const headings = markdownHeadings(source);
    outgoing.set(doc.file, markdownLinks(source));
    for (const section of doc.requiredSections || []) {
      if (!headings.has(section)) fail(`${doc.file}: missing required heading "${section}"`);
    }
  }
}

for (const file of requiredDocs) {
  if (!byFile.has(file)) fail(`markdown document is not registered in doc-structure manifest: ${file}`);
  incoming.set(file, new Set());
}

for (const [file, links] of outgoing) {
  for (const link of links) {
    const normalized = link.startsWith("./") ? link.slice(2) : link;
    if (incoming.has(normalized)) incoming.get(normalized).add(file);
  }
}

const isolatedAllowed = new Set(["README.md", "INSTALL.md", "PRODUCT.md"]);
for (const file of requiredDocs) {
  const inCount = incoming.get(file)?.size || 0;
  const outCount = outgoing.get(file)?.size || 0;
  if (!isolatedAllowed.has(file) && inCount === 0 && outCount === 0) {
    fail(`${file}: isolated document; add a relevant link or register an intentional exception`);
  }
}

const documentationPath = path.join(root, "docs/DOCUMENTATION.md");
if (fs.existsSync(documentationPath)) {
  const documentation = fs.readFileSync(documentationPath, "utf8");
  for (const pattern of ["doc-structure.manifest.json", "check-doc-structure.sh", "文档治理机器校验"]) {
    if (!documentation.includes(pattern)) fail(`docs/DOCUMENTATION.md should mention ${pattern}`);
  }
}

if (errors) process.exit(1);
console.log(`Documentation structure valid: ${data.documents.length}`);
NODE
