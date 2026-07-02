#!/usr/bin/env bash
set -euo pipefail

root="${1:-.}"

if [ ! -d "$root" ]; then
  echo "ERROR: target directory not found: $root"
  exit 2
fi

if ! command -v node >/dev/null 2>&1; then
  echo "WARN: node not found; skipped frontmatter validation"
  exit 0
fi

node - "$root" <<'NODE'
const fs = require("fs");
const path = require("path");
const root = process.argv[2];
const allowedLayers = new Set(["entry", "skills", "knowledge", "governance"]);
const allowedTypes = new Set(["spec", "status", "log", "guide", "schema"]);
const requiredFields = ["layer", "type", "last_verified"];
let errors = 0;

function fail(message) {
  errors += 1;
  console.error(`ERROR: ${message}`);
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full);
    if (entry.isDirectory()) {
      if ([".git", "node_modules", ".project-os"].includes(entry.name)) continue;
      if (rel.startsWith("templates/project/templates/")) continue;
      walk(full, out);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      if (rel.includes("/design/proposals/")) continue;
      if (rel.includes("/.claude/skills/")) continue;
      if (rel.includes("/adapters/")) continue;
      out.push(rel);
    }
  }
  return out;
}

function rootMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith(".md"))
    .map(entry => path.relative(root, path.join(dir, entry.name)));
}

function parseFrontmatter(text) {
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---", 4);
  if (end === -1) return null;
  const block = text.slice(4, end).trim();
  const data = {};
  for (const line of block.split(/\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!match) continue;
    data[match[1]] = match[2].trim();
  }
  return data;
}

function cleanScalar(value) {
  return String(value || "").replace(/^["']|["']$/g, "");
}

function dependencyItems(value) {
  if (!value) return [];
  const raw = cleanScalar(value);
  if (raw.startsWith("[") && raw.endsWith("]")) {
    return raw.slice(1, -1).split(",").map(s => s.trim()).filter(Boolean);
  }
  return [raw].filter(Boolean);
}

const files = [
  "AGENTS.md",
  "PROJECT.md",
  "HANDOFF.md",
  "README.md",
  ...rootMarkdownFiles(path.join(root, "docs")),
  ...rootMarkdownFiles(path.join(root, "templates/project-docs")),
  ...rootMarkdownFiles(path.join(root, "templates/project-docs", "docs")),
  ...rootMarkdownFiles(path.join(root, "templates/project", "docs"))
];

const uniqueFiles = [...new Set(files)].filter(rel => fs.existsSync(path.join(root, rel)));

for (const rel of uniqueFiles) {
  const text = fs.readFileSync(path.join(root, rel), "utf8");
  const fm = parseFrontmatter(text);
  if (!fm) {
    fail(`${rel}: missing YAML frontmatter`);
    continue;
  }
  for (const field of requiredFields) {
    if (!fm[field]) fail(`${rel}: missing frontmatter field ${field}`);
  }
  const layer = cleanScalar(fm.layer);
  const type = cleanScalar(fm.type);
  const lastVerified = cleanScalar(fm.last_verified);
  if (fm.layer && !allowedLayers.has(layer)) fail(`${rel}: invalid layer ${layer}`);
  if (fm.type && !allowedTypes.has(type)) fail(`${rel}: invalid type ${type}`);
  if (fm.last_verified && !/^\d{4}-\d{2}-\d{2}$/.test(lastVerified)) fail(`${rel}: invalid last_verified ${lastVerified}`);
  if (fm.depends_on) {
    for (const dep of dependencyItems(fm.depends_on)) {
      const normalized = cleanScalar(dep);
      if (!fs.existsSync(path.join(root, normalized)) && !fs.existsSync(path.join(root, "templates/project-docs", normalized)) && !fs.existsSync(path.join(root, "templates/project", normalized))) {
        fail(`${rel}: depends_on target not found: ${normalized}`);
      }
    }
  }
}

if (errors) process.exit(1);
console.log(`Frontmatter valid: ${uniqueFiles.length}`);
NODE
