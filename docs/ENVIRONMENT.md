---
layer: knowledge
type: spec
last_verified: 2026-07-21
depends_on: [README.md, INSTALL.md, docs/ARCHITECTURE.md, docs/TESTING.md]
teaches: "OmniDesk Desktop Runtime 的本地依赖、Provider 配置与开发验证"
use_when: "维护者需要启动 Desktop、配置模型或排查本地环境时"
---

# 环境说明

> 用途：说明 OmniDesk Desktop 的开发依赖、启动命令、Provider 配置和本地验证。
> 什么时候更新：Node/Rust/Tauri 依赖、Provider 存储或启动命令变化时。
> 不要写什么：旧 Project OS installer、CLI 配置、模板 profile 或报告生成流程。

## 运行环境

OmniDesk 是 `desktop/` 中的 Tauri + React + Local Agent Runtime 应用。

必需依赖：

- Node.js 22+ 与 npm
- Rust stable 与 Cargo
- Tauri 所需的系统 WebView 开发依赖

macOS 使用系统 WebKit。Linux CI 所需的 GTK、WebKit 和应用指示器包以 `.github/workflows/ci.yml` 为准。浏览器 Preview 不替代 Desktop Runtime，不能验证写入、终端、受控检查或恢复。

## 常用命令

```bash
npm ci --prefix desktop
npm --prefix desktop run dev
```

只启动只读 Preview：

```bash
npm --prefix desktop run web:dev
```

构建 Web 前端：

```bash
npm --prefix desktop run web:build
```

## 环境变量

Provider profile、模型健康缓存和隔离密钥均由 Desktop Runtime 管理：

- profile 元数据位于 active `.omnidesk/data/`；旧项目必须先通过显式迁移进入该分区。
- API Key 仅从本机环境或 Runtime 管理的本地密钥存储读取，不能写入源码、文档、测试 fixture 或提交到 Git。
- Provider 返回成功不等于任务成功；Patch、独立审批、检查与最终证据都完成后才可结案。

| 变量 | 用途 |
|---|---|
| `PROJECT_OS_ALLOW_EMPTY_PROVIDER_KEYS` | 纯本地密钥扫描时允许未配置 Provider Key |
| `TAURI_WEBDRIVER_PORT` | 原生 WebDriver smoke 的测试端口 |
| `OMNIDESK_WEBDRIVER_WORKSPACE_ROOT` | 原生 smoke 使用的隔离工作区，仅测试构建设置 |
| `OMNIDESK_AGENT_EVAL_*` | 仅受保护 Agent Eval workflow 使用的 Provider 环境变量 |

本仓库可使用 `.env.local` 保存本地开发密钥，但该文件必须保持忽略。提交前运行：

```bash
PROJECT_OS_ALLOW_EMPTY_PROVIDER_KEYS=1 bash scripts/check-secrets.sh .
```

`PROJECT_OS_ALLOW_EMPTY_PROVIDER_KEYS` 只用于纯本地扫描时抑制空 Provider Key 警告，不会为运行时注入密钥。

## 状态迁移

Runtime 启动时将 legacy `.project-os/` 非破坏性迁移到 `.omnidesk/`：

```txt
.omnidesk/data      用户数据与配置
.omnidesk/runtime   checkpoint、事务与运行事件
.omnidesk/cache     可重建缓存与派生状态
.omnidesk/evidence  Eval、Patch 与验证证据
```

迁移会跳过符号链接、保持源数据、拒绝冲突覆盖，并以 manifest 原子切换 active namespace。退役前 Runtime 会重新核验每个 legacy 常规文件已迁入、内容字节一致且没有符号链接；如 active namespace 在切换后已更新，先使用受控归档动作把差异源文件保存到 `.omnidesk/evidence/legacy-retirement/`。迁移验收完成并获得用户明确确认前不要手动删除 `.project-os/`。

## 常见问题

### 浏览器页面不能执行任务

`http://127.0.0.1:1420/` 是只读 Preview。请通过 `npm --prefix desktop run dev` 启动桌面窗口，再在工作区内选择受控权限与模型连接。

### 启动时找不到 Cargo 或 WebView 依赖

先安装 Rust stable，并按 Tauri 对应平台的系统依赖完成配置；Linux 的参考安装命令见 CI workflow。完成后运行 `cargo check --manifest-path desktop/src-tauri/Cargo.toml` 验证。

### 旧状态没有立即显示

不要手动复制或删除 `.project-os/`。启动 Runtime 后检查 `.omnidesk/namespace.json`；若出现冲突，Runtime 会保留迁移证据并拒绝启用 native 状态，必须先处理冲突，不能回退为 legacy 运行时读写。

## 本地验证

```bash
npm --prefix desktop test
npm --prefix desktop run web:build
cargo check --manifest-path desktop/src-tauri/Cargo.toml
bash tests/run-tests.sh
```

原生窗口 smoke 使用临时工作区：

```bash
npm --prefix desktop run test:native
```

真实 Provider Eval 只在受保护环境运行，详见 `docs/TESTING.md`。
