const definitions = [
  {
    args: ["scripts/check-runtime.sh", "."],
    command: "bash scripts/check-runtime.sh .",
    confirmation: "none",
    id: "runtime",
    label: "基础检查",
    program: "bash",
    requiredPaths: ["scripts/check-runtime.sh"],
    risk: "read-only",
  },
  {
    args: ["scripts/check-doc-structure.sh", "."],
    command: "bash scripts/check-doc-structure.sh .",
    confirmation: "none",
    id: "doc-structure",
    label: "文档结构检查",
    program: "bash",
    requiredPaths: ["scripts/check-doc-structure.sh"],
    risk: "read-only",
  },
  {
    args: ["scripts/recommend-next.sh", "."],
    command: "bash scripts/recommend-next.sh .",
    confirmation: "none",
    id: "recommend",
    label: "下一步建议",
    program: "bash",
    requiredPaths: ["scripts/recommend-next.sh"],
    risk: "read-only",
  },
  {
    args: ["scripts/check-ai-project.sh", ".", "--write-report"],
    command: "bash scripts/check-ai-project.sh . --write-report",
    confirmation: "required",
    id: "ai-project",
    label: "AI 项目检查",
    program: "bash",
    requiredPaths: ["scripts/check-ai-project.sh"],
    risk: "writes-artifact",
  },
  {
    args: ["--prefix", "desktop", "run", "web:build"],
    command: "cd desktop && npm run web:build",
    confirmation: "required",
    id: "web-build",
    label: "Web 构建",
    program: "npm",
    requiredPaths: ["desktop/package.json"],
    risk: "writes-build-artifact",
  },
  {
    args: ["check", "--manifest-path", "desktop/src-tauri/Cargo.toml"],
    command: "cd desktop/src-tauri && cargo check",
    confirmation: "required",
    id: "cargo-check",
    label: "桌面壳检查",
    program: "cargo",
    requiredPaths: ["desktop/src-tauri/Cargo.toml"],
    risk: "writes-build-artifact",
  },
];

export const guardedCheckCapabilities = Object.freeze(definitions.map((item) => Object.freeze(item)));

export function guardedCheckCapability(id) {
  return guardedCheckCapabilities.find((item) => item.id === id) || null;
}
