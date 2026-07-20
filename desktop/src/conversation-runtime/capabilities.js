const definitions = [
  {
    args: ["--prefix", "desktop", "test"],
    command: "npm --prefix desktop test",
    confirmation: "required",
    id: "runtime",
    label: "Desktop 测试",
    program: "npm",
    requiredPaths: ["desktop/package.json"],
    risk: "runs-tests",
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
