import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(desktopRoot, "dist");
const manifestPath = path.join(distDir, ".vite", "manifest.json");
const entryBudgetBytes = 800 * 1024;

function fileSize(file) {
  try {
    return fs.statSync(path.join(distDir, file)).size;
  } catch {
    return 0;
  }
}

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(2)} KiB`;
}

if (!fs.existsSync(manifestPath)) {
  console.error("缺少构建 manifest。请先运行 npm run web:build。");
  process.exitCode = 1;
} else {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const entry = Object.values(manifest).find((chunk) => chunk.isEntry);
  const entrySize = entry?.file ? fileSize(entry.file) : 0;
  const dynamicChunks = Object.values(manifest)
    .filter((chunk) => chunk.isDynamicEntry)
    .map((chunk) => ({ file: chunk.file, size: fileSize(chunk.file) }))
    .sort((left, right) => right.size - left.size);

  console.log(`首屏入口：${entry?.file || "未找到"}，${formatKiB(entrySize)}；软预算：${formatKiB(entryBudgetBytes)}。`);
  dynamicChunks.forEach((chunk) => console.log(`按需模块：${chunk.file}，${formatKiB(chunk.size)}。`));
  if (entrySize > entryBudgetBytes) {
    console.warn("警告：首屏入口超过当前软预算。请优先评估低频模块按需加载，不要仅提高阈值。");
  }
}
