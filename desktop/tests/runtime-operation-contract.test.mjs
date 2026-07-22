import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { previewOperation, runtimeOperations } from "../src/lib/runtime-operation-contract.js";

test("declares Preview policy with transport metadata for every shared operation", () => {
  for (const [id, operation] of Object.entries(runtimeOperations)) {
    assert.match(id, /^[a-z_]+$/);
    assert.match(operation.endpoint, /^\/__omnidesk\//);
    assert.equal(typeof operation.error, "string");
    assert.ok(["allow", "deny"].includes(operation.preview));
  }
  assert.equal(previewOperation("read_engineering_file").preview, "allow");
  assert.throws(() => previewOperation("approve_agent_run"), /浏览器预览不能执行此操作/);
  assert.throws(() => previewOperation("unknown_operation"), /只能查看界面/);
});

test("every Preview-allowed operation has a Preview server route", () => {
  const viteConfig = fs.readFileSync(path.resolve(import.meta.dirname, "../vite.config.js"), "utf8");
  const missing = Object.entries(runtimeOperations)
    .filter(([, operation]) => operation.preview === "allow")
    .map(([id, operation]) => ({ id, endpoint: operation.endpoint }))
    .filter(({ endpoint }) => !viteConfig.includes(`req.url === "${endpoint}"`));
  assert.deepEqual(missing, []);
});

test("Preview middleware rejects every denied operation before compatibility handlers", () => {
  const viteConfig = fs.readFileSync(path.resolve(import.meta.dirname, "../vite.config.js"), "utf8");
  assert.match(viteConfig, /operation\.preview === "deny"/);
  assert.match(viteConfig, /浏览器预览不能执行此操作/);
});

test("Vite has no compatibility route for denied operations", () => {
  const viteConfig = fs.readFileSync(path.resolve(import.meta.dirname, "../vite.config.js"), "utf8");
  const routedDenied = Object.values(runtimeOperations)
    .filter((operation) => operation.preview === "deny")
    .filter((operation) => viteConfig.includes(`req.url === "${operation.endpoint}"`));
  assert.deepEqual(routedDenied, []);
});
