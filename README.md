---
layer: entry
type: guide
last_verified: 2026-09-17
depends_on: [AGENTS.md, PROJECT.md, docs/ENVIRONMENT.md, docs/TESTING.md]
teaches: "OmniDesk Desktop 的产品定位、已实现的 Agent 机制、启动方式和验证入口"
use_when: "用户或维护者首次打开仓库、需要启动或验证 OmniDesk 时"
---

# OmniDesk

> 用途：说明 OmniDesk 是什么、如何本地启动以及如何验证。
> 什么时候更新：产品入口、启动方式或发布验证变化时。
> 不要写什么：旧 Project OS 安装 profile、模板分发、跨工具 adapter 或当前交接历史。

OmniDesk 是一个本地优先的 AI 工程工作台。`desktop/` 中的 Tauri、React 和 Local Agent Runtime 是唯一产品核心：它在用户授权范围内管理项目、对话、Patch 草稿、独立审批、检查、有限修复与可审计证据。

浏览器 Preview 仅用于只读开发与界面验证；工程写入、终端、受控检查、Provider 密钥与 Agent 恢复只在 Desktop Runtime 中执行。

## 实现了哪些 Agent 机制

Runtime 把 Agent 平台内部的通用机制逐项实现了一遍，每一项都有对应的回归覆盖：

| 机制 | 作用 |
|---|---|
| 执行器抽象 | 用同一套契约接入不同 Agent 引擎（Hermes / Codex / Gemini）；换引擎不改变调度、审批、恢复和证据规则 |
| Agent 事件标准化 | 把模型生命周期、工具调用、追问、审批与终态归一成有序事件；一次执行只允许一个终态 |
| 独立审批 | 文件写入与检查各自单独审批；回答追问不会创建、消费或替代工程审批 |
| 调度与排队 | 全局并发上限、同项目互斥、FIFO 领取；取消会同步封口并释放项目，迟到结果被拒绝 |
| 断点恢复 | 中断后从最近持久化的阶段继续；不假称能续接原网络流，也不自动重放未确认操作 |
| 有界工具 | 内置读取工具与 MCP 工具共用同一套注册表，执行前校验参数与审批声明 |
| 脱敏证据链 | 每次执行留下可导出的时间线，只保存元数据，不落 prompt、源码正文与密钥 |

外部 Agent 归档：在 Codex Desktop、Cursor 等其他应用编辑同一项目时，watcher 会把安全的改动路径、时间与可关联任务归档到治理区，标记为待验证。归档不要求审批，也不自动检查、提交或完成任务。

不可放松的边界：Preview 只读；Provider 返回成功不等于任务完成；恢复不自动重放；真实 Eval 不能在本地或普通 CI 伪造 trace。

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
