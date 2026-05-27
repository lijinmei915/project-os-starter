#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] || process.cwd();

function readJson(relativePath) {
  const filePath = join(root, relativePath);
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`cannot read JSON ${relativePath}: ${error.message}`);
  }
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}

function uniqueValues(values, label) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) {
      fail(`duplicate ${label}: ${value}`);
    }
    seen.add(value);
  }
}

const scoreModel = readJson("schemas/ai-project-score.v0.2.json");
const reportModel = readJson("schemas/ai-project-report.v0.1.json");

const dimensions = scoreModel.dimensions || [];
const modules = reportModel.modules || [];

uniqueValues(dimensions.map((dimension) => dimension.id), "score dimension id");
uniqueValues(dimensions.map((dimension) => dimension.title), "score dimension title");
uniqueValues(modules.map((module) => module.id), "report module id");

const totals = new Map();
const contextTitles = new Set();

for (const dimension of dimensions) {
  if (!dimension.scoreType || typeof dimension.maxPoints !== "number") {
    fail(`invalid score dimension: ${dimension.id || dimension.title || "(unknown)"}`);
    continue;
  }

  totals.set(dimension.scoreType, (totals.get(dimension.scoreType) || 0) + dimension.maxPoints);

  if (dimension.scoreType === "context") {
    contextTitles.add(dimension.title);
  }
}

for (const [scoreType, expected] of Object.entries(scoreModel.totalScores || {})) {
  const actual = totals.get(scoreType) || 0;
  if (actual !== expected) {
    fail(`score total mismatch for ${scoreType}: dimensions=${actual}, totalScores=${expected}`);
  }
}

const coveredContextTitles = new Set();

for (const module of modules) {
  if (!module.title || !module.help) {
    fail(`report module lacks title/help: ${module.id || "(unknown)"}`);
  }

  if (!Array.isArray(module.sections) || module.sections.length === 0) {
    fail(`report module lacks sections: ${module.id || "(unknown)"}`);
    continue;
  }

  for (const section of module.sections) {
    if (!contextTitles.has(section)) {
      fail(`report module ${module.id} references unknown context section: ${section}`);
      continue;
    }
    coveredContextTitles.add(section);
  }
}

for (const title of contextTitles) {
  if (!coveredContextTitles.has(title)) {
    fail(`context score section is not covered by report modules: ${title}`);
  }
}

if (!process.exitCode) {
  console.log("[report-model] score model and report modules are consistent");
}
