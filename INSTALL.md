---
layer: entry
type: guide
last_verified: 2026-07-22
depends_on: [README.md, docs/ENVIRONMENT.md, docs/TESTING.md]
teaches: "OmniDesk Desktop 的本地依赖、安装、启动与验证方式"
use_when: "维护者需要在新机器上运行 OmniDesk Desktop 时"
---

# OmniDesk 本地安装

> 用途：说明如何在本机安装并运行 OmniDesk Desktop。
> 什么时候更新：依赖、桌面构建方式或启动命令变化时。
> 不要写什么：Project OS 安装 profile、模板复制、adapter 生成或旧 CLI 升级流程。

OmniDesk 不再作为可安装到其他仓库的 Project OS 工具包分发。它是本仓库的桌面应用；项目接入由 Desktop Runtime 中的工作区选择、扫描与权限边界完成。

## 前置依赖

- Node.js 22+ 与 npm
- Rust stable 与 Cargo
- 目标操作系统的 Tauri/WebView 依赖

macOS 通常使用系统 WebKit；Linux CI 的依赖安装方式见 `.github/workflows/ci.yml`。Provider 密钥只由 Desktop Runtime 本地保存，不能写入仓库文件。

## 安装与运行

```bash
npm ci --prefix desktop
npm --prefix desktop run dev
```

桌面窗口会连接本地 Tauri Runtime。浏览器地址 `http://127.0.0.1:1420/` 是只读 Preview，不具备工程写入、终端或受控检查能力。

## 验证安装

```bash
npm --prefix desktop test
npm --prefix desktop run web:build
cargo check --manifest-path desktop/src-tauri/Cargo.toml
bash tests/run-tests.sh
```

原生窗口 smoke 使用隔离临时工作区，不读取真实 Provider 密钥：

```bash
npm --prefix desktop run test:native
```

## 升级与迁移

接入外部历史工程时，Runtime 会将旧 `.project-os/` 状态非破坏性迁移到 `.omnidesk/` 的 `data`、`runtime`、`cache` 和 `evidence` 分区。冲突会保留源数据与迁移证据并拒绝激活；Runtime 不会回退为 legacy 读写。迁移完成前不要手动删除源目录。

详细状态与恢复策略见 `docs/ARCHITECTURE.md`；真实 Provider Eval 和发布证据见 `docs/TESTING.md`。
