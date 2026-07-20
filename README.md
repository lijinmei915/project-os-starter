---
layer: entry
type: guide
last_verified: 2026-07-21
depends_on: [AGENTS.md, PROJECT.md, docs/ENVIRONMENT.md, docs/TESTING.md]
teaches: "OmniDesk Desktop 的产品定位、启动方式和验证入口"
use_when: "用户或维护者首次打开仓库、需要启动或验证 OmniDesk 时"
---

# OmniDesk

> 用途：说明 OmniDesk 是什么、如何本地启动以及如何验证。
> 什么时候更新：产品入口、启动方式或发布验证变化时。
> 不要写什么：旧 Project OS 安装 profile、模板分发、跨工具 adapter 或当前交接历史。

OmniDesk 是一个本地优先的 AI 工程工作台。`desktop/` 中的 Tauri、React 和 Local Agent Runtime 是唯一产品核心：它在用户授权范围内管理项目、对话、Patch 草稿、独立审批、检查、有限修复与可审计证据。

浏览器 Preview 仅用于只读开发与界面验证；工程写入、终端、受控检查、Provider 密钥与 Agent 恢复只在 Desktop Runtime 中执行。

## 启动

前置依赖：Node.js 22+、npm、Rust/Cargo，以及 Tauri 所需的系统 WebView 依赖。具体环境说明见 `docs/ENVIRONMENT.md`。

```bash
npm ci --prefix desktop
npm --prefix desktop run dev
```

只启动浏览器 Preview：

```bash
npm --prefix desktop run web:dev
```

## 验证

日常 Runtime 改动：

```bash
npm --prefix desktop test
npm --prefix desktop run web:build
cargo check --manifest-path desktop/src-tauri/Cargo.toml
```

完整本地回归：

```bash
bash tests/run-tests.sh
```

原生窗口 smoke：

```bash
npm --prefix desktop run test:native
```

真实 Provider Eval 只在受保护的 GitHub Actions 环境运行。评测 trace、恢复语义和验收边界见 `docs/TESTING.md`。

## 入口文档

| 文件 | 职责 |
|---|---|
| `AGENTS.md` | 仓库内 AI 的行为与安全边界 |
| `PROJECT.md` | 当前产品状态与重点 |
| `HANDOFF.md` | 最近完成、风险与接手信息 |
| `docs/ARCHITECTURE.md` | Runtime、状态命名空间与执行边界 |
| `docs/ENVIRONMENT.md` | 本地依赖、Provider 与启动说明 |
| `docs/TESTING.md` | 回归、原生与真实 Eval 验收 |

旧 Project OS CLI、installer、templates、adapters 与 routing skills 已进入退役流程，不能作为新的产品入口或依赖。
