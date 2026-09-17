import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { attachmentBudgetMessage, resourceBudget, selectAttachmentFiles, supportedAttachmentMimeTypes } from "../src/lib/resource-budget.js";

const image = (name, size) => ({ name, size, type: "image/png" });
const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("keeps attachment count and byte budgets explicit", () => {
  const files = Array.from({ length: 8 }, (_, index) => image(`shot-${index}.png`, 1024));
  const selection = selectAttachmentFiles(files, []);
  assert.equal(selection.accepted.length, resourceBudget.attachmentMaxCount);
  assert.equal(selection.rejected.length, files.length - resourceBudget.attachmentMaxCount);
  assert.match(attachmentBudgetMessage(selection.rejected), /最多添加/);
});

test("rejects oversized and aggregate attachment input before it enters state", () => {
  const oversized = selectAttachmentFiles([image("large.png", resourceBudget.attachmentMaxBytes + 1)], []);
  assert.equal(oversized.accepted.length, 0);
  assert.match(attachmentBudgetMessage(oversized.rejected), /4 MB/);
  const total = selectAttachmentFiles([image("more.png", 2 * 1024 * 1024)], [image("kept.png", resourceBudget.attachmentMaxTotalBytes - 1024 * 1024)]);
  assert.equal(total.accepted.length, 0);
  assert.match(attachmentBudgetMessage(total.rejected), /12 MB/);
  const unsupported = selectAttachmentFiles([{ name: "vector.svg", size: 100, type: "image/svg+xml" }], []);
  assert.equal(unsupported.accepted.length, 0);
  assert.match(attachmentBudgetMessage(unsupported.rejected), /PNG、JPEG、WebP、GIF/);
  assert.deepEqual(supportedAttachmentMimeTypes, ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);
});

test("keeps Preview and Tauri engineering-file retention aligned with the resource budget", () => {
  const viteConfig = fs.readFileSync(path.join(desktopRoot, "vite.config.js"), "utf8");
  const workspaceRuntime = fs.readFileSync(path.join(desktopRoot, "src-tauri", "src", "runtime", "workspace.rs"), "utf8");
  assert.equal(resourceBudget.filePreviewMaxBytes, 80 * 1024);
  assert.match(viteConfig, /const maxBytes = 80 \* 1024;/);
  assert.match(workspaceRuntime, /const MAX_PREVIEW_BYTES: usize = 80 \* 1024;/);
});
