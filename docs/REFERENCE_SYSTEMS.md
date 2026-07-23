---
layer: knowledge
type: spec
last_verified: 2026-07-22
depends_on: [docs/ARCHITECTURE.md, docs/PRODUCT_PLAN.md, docs/PROJECT_MEMORY_AND_RUNNER.md]
teaches: "OmniDesk 如何借鉴成熟 Agent 与 IDE 的执行体验，同时保持 Desktop Runtime 的审批和证据边界"
use_when: "评估 Hermes、Provider 或未来参照系统是否应影响 OmniDesk 的执行边界或交互模式时"
---

# 参照系统

> 用途：说明成熟 Agent 和 IDE 可以借鉴什么，以及不能越过 OmniDesk Desktop Runtime 的哪些边界。
> 什么时候更新：执行通道、审批模型或产品边界发生变化时。
> 不要写什么：竞品截图流水、第三方工具安装教程、未接入 runtime 的功能承诺或历史 Project OS 路线。

## 核心结论

OmniDesk 是本地优先的 AI 工程工作台，不是第三方 Agent、CLI 或 IDE 的管理层。用户在桌面端接入一个工程、对话、审阅 Patch、独立批准写入和检查，并查看任务证据。

成熟产品只提供两类参照：

- 交互参照：清晰的对话状态、文件上下文、diff 审阅、终端输出和可取消任务。
- 工程参照：checkpoint、有限重试、审批边界、失败证据和恢复语义。

它们不改变 OmniDesk 的产品边界：`.omnidesk/` 是唯一活动状态根；Provider 成功响应不等于任务完成；工程写入和受控检查必须分别审批。

## 对比矩阵

| 维度 | 成熟 Agent / IDE 的可借鉴模式 | OmniDesk 的固定边界 |
|---|---|---|
| 对话 | 流式结果、取消和可见的任务状态 | 只在桌面 Runtime 内执行写入型任务；Preview 只读 |
| Patch | 指定文件上下文、unified diff、可展开审阅 | diff 必须经授权文件、路径和 hunk 校验后才可审批 |
| 执行 | 检查输出、有限修复、失败可追溯 | 每次 Apply 与检查独立审批；最多两轮修复 |
| 记忆 | 有界任务上下文与可检索摘要 | 只保存项目范围内可追溯的 `.omnidesk` 状态，不把 Provider 对话当状态源 |
| 终端 | 可见会话和输出 | 会话属于本地 Runtime；重启后不伪称可续接未持久化输出 |

## Hermes 的定位

Hermes 是可选草稿生成通道，不是 OmniDesk 的 UI、状态源或写入执行器。普通 Provider 与 Hermes 都必须经过同一套授权文件、Patch 校验、审批、检查和证据链。

Hermes 不可用时，Runtime 可以降级到已配置的普通 Provider 生成草稿，并把降级原因写入运行证据。本地占位草稿永远不可应用。无论通道是否成功返回，未经审批的 Patch 不会写入工程；检查没有通过的任务也不会显示为完成。

## 接入策略

当前架构只允许以下路径：

```txt
Workbench UI
  -> OmniDesk Local Agent Runtime
    -> Provider 或 Hermes 生成草稿
    -> Patch 校验 -> Apply 审批 -> 受控检查审批
    -> .omnidesk evidence / 最终任务状态
```

不得把外部 CLI、脚本 runner、模板、adapter 或跨工具 routing 作为生产执行路径。若未来引入新的模型通道，必须先证明它不能绕过授权文件、Patch normalizer、独立审批、检查边界和持久化证据。

## 当前阶段取舍

当前阶段保留：

- Provider 与 Hermes 的可追溯草稿生成。
- 受控 Patch、独立审批、检查、两轮以内修复和恢复证据。
- 面向本地工程的对话、文件上下文、diff 与任务时间线。

当前阶段不做：

- 多 Agent 编排、远程执行、插件市场或完整 IDE。
- Project OS CLI、安装器、模板分发、评分报告、跨工具 adapter 与 routing。
- 把第三方 Provider 或 Hermes 的成功响应当作任务完成。
