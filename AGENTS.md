---
layer: governance
type: spec
last_verified: 2026-07-21
depends_on: [docs/DOCUMENTATION.md, PROJECT.md]
teaches: "OmniDesk Desktop Runtime 的行为边界、状态规则、验证与遗留兼容约束"
use_when: "AI 首次进入仓库、修改 Desktop Runtime、状态、Agent 执行或迁移兼容层时"
---

# AGENTS

> 用途：定义 AI 在 OmniDesk 仓库中的运行规则。
> 什么时候更新：产品内核、状态边界、验证门槛、兼容策略或禁止行为变化时。
> 不要写什么：产品介绍、完整路线图、历史流水或旧 Project OS 安装说明。

`desktop/` 内的 OmniDesk Desktop Runtime 是唯一产品核心。它通过 Tauri、React 和 Local Agent Runtime 在用户授权范围内处理本地工程、对话、Patch、审批、检查、恢复与证据。

旧 Project OS CLI、installer、templates、adapters、routing skill 和报告工具链已冻结；它们不是新功能入口，不能作为 Desktop Runtime 的依赖或用户可见能力。`.project-os/` 仅在状态迁移完成前作为兼容读取源。

## Quick Start For Agents

1. 先读 `PROJECT.md` 与 `HANDOFF.md`；状态以 `.project-os/state.json` 和 active `.omnidesk/data/state.json` 的命名空间规则为准。
2. 修改状态、Runtime 或执行链路前，阅读相关 `desktop/src-tauri/src/runtime/` 模块和 `docs/TESTING.md`。
3. 修改文档前阅读 `docs/DOCUMENTATION.md`；新增文档前阅读 `docs/NAMING.md`。
4. 修改用户可见工作台前，保持现有信息架构与 tokens，不新增与 Runtime 无关的管理入口。
5. 收尾时说明改动、验证和仍未消除的风险。

## Working Boundaries

可以做：

- 改进 Desktop Runtime、受控 Agent 执行、状态迁移、长任务恢复、Eval 证据与原生测试。
- 更新与当前 OmniDesk 内核直接相关的文档和测试。
- 逐项移除旧工具链的生产引用、可见入口和过期文档。

不要做：

- 不要把 `README.md`、旧模板或历史 handoff 当作运行规则。
- 不要新增 Project OS 安装器、跨工具 routing、模板分发、AI 工程评分或报告能力。
- 不要在 Desktop Runtime 中调用旧 CLI、Shell governance 或 installer。
- 不要删除 `.project-os/`，直到迁移、文档、构建和测试消费者全部完成退役验证。
- 不要把 Provider 返回成功标为任务完成；只有 Patch、审批、检查和最终证据闭环才是完成。

## State And Execution

- `.omnidesk/` 是状态根，按 `data`、`runtime`、`cache`、`evidence` 分区。
- `.project-os/ -> .omnidesk/` 迁移必须幂等、非破坏、冲突保留 legacy、跳过符号链接；不能覆盖用户数据。
- 所有工程写入与受控检查必须独立审批。恢复不得自动重放中断中的 Patch 或检查。
- Agent Run 必须持久化阶段、上下文摘要、最后确认、工具参数/结果、允许文件、检查与修复预算。
- Provider 请求中断后不能伪称续传；只能从最近已持久化阶段重新请求模型，并保留中断证据。
- Preview 仅只读，不执行工程写入、终端、受控检查或 Agent 恢复。

## Commands

按风险选择检查：

```bash
npm --prefix desktop test
npm --prefix desktop run web:build
cargo check --manifest-path desktop/src-tauri/Cargo.toml
npm --prefix desktop run test:native
bash tests/run-tests.sh
```

- Runtime、状态、Agent 或跨入口改动：运行 `bash tests/run-tests.sh`。
- 原生窗口行为改动：运行 `npm --prefix desktop run test:native`。
- 文档职责变化：运行 `bash scripts/check-doc-structure.sh .`。
- 真实 Provider Eval 只在受保护环境执行；普通 CI 和本机不能伪造真实 trace。

## Documentation Governance

- 当前产品状态归 `PROJECT.md`；接手摘要归 `HANDOFF.md`；两者不复制完整内容。
- 状态发生变化时同步 `.project-os/state.json` 与 active `.omnidesk/data/state.json`，直到兼容层退役。
- 发生误改、误判或 bug 时，在 `docs/LESSONS.md` 记录根因和新增约束。
- 新增或改变 `docs/*.md` 职责时，更新 `docs/data/doc-structure.manifest.json` 并运行文档结构检查。

## Collaboration

- 跟随用户语言，默认直接处理当前问题并保持简洁。
- 只做用户明确范围内的改动；删除、覆盖、发布或 push 前先取得确认。
- 保留用户已有未提交改动，不使用破坏性 Git 命令。
- 代码与状态变更后，报告已验证内容和剩余风险；未确认前不 push。
