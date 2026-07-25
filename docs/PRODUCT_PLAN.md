---
layer: knowledge
type: spec
last_verified: 2026-07-25
depends_on: [PROJECT.md, docs/ARCHITECTURE.md, docs/TESTING.md]
teaches: "OmniDesk 的产品方向、当前阶段和明确不做事项"
use_when: "AI 需要判断工作是否服务当前产品阶段或安排后续里程碑时"
---

# OmniDesk 产品规划

> 用途：定义产品方向、阶段成功标准和范围边界。
> 什么时候更新：当前阶段、发布门槛或长期能力取舍变化时。
> 不要写什么：具体提交流水、旧 Project OS 分发路线或单次任务待办。

## 产品愿景

OmniDesk 是本地优先的 AI 工程工作台。用户在一个桌面应用内接入工程、持续对话、生成并审阅 Patch、独立审批写入与检查，在失败后受控修复，并保留可审计证据。

唯一产品核心是 `desktop/` 中的 Tauri + React + Local Agent Runtime。Hermes 和普通 Provider 是模型通道，不是产品内核；浏览器 Preview 只用于只读开发与视觉验证。

## 当前阶段判断

当前阶段：`OmniDesk Agent 平台化 v1`。

目标是在现有 Desktop Runtime 上平滑演进为可靠的本地 Agent 平台，不推倒 Tauri、React、Hermes、Tool Gateway、审批和证据骨架。阶段完成必须同时满足 P0 到 P4，不能把单次 Provider 成功或局部 UI 展示当成平台化完成。

## 阶段路线

1. **P0 统一状态模型**：Conversation、Task、Patch、Check 与 Agent Run 使用同一 workflow 投影；等待、执行、完成、验证、失败、取消和中断语义唯一。只有持久化检查证据可以产生“验证通过”。
2. **P1 原生 Function Calling**：建立 Provider 能力矩阵；支持原生工具调用的 Provider 使用结构化 tool call，不再依赖关键词决定执行工具。不支持者只保留明确、可观测的兼容降级。
3. **P2 持久化调度**：任务队列、项目互斥锁、并发上限、取消、重启恢复和公平调度由 Runtime 持有；恢复不自动重放 Patch 或检查。
4. **P3 统一 Run Timeline**：模型请求、工具调用、审批、用户追问、Patch、检查、恢复、耗时、token 与成本进入同一可审计时间线，并可导出调试证据。
5. **P4 扩展边界**：提供版本化 Tool SDK / MCP 契约、schema 校验、能力发现、权限和风险声明；第三方工具不得绕过 Tool Gateway、项目授权或审批。

## 阶段验收

- 每个 P 阶段均需要领域单测、完整本地回归和真实桌面端证据。
- Provider、流式网络和模型工具调用只能由受保护真实 Eval 证明，普通 CI 不伪造 trace。
- P0-P4 全部完成后，复杂任务才可宣称具备可恢复、可调试、可扩展的 Agent 平台闭环。

## 当前优先级

1. P0 状态单一事实源和全部工作台消费迁移已完成本地验收。
2. P1 Provider 原生 Function Calling 能力矩阵、持久化能力证据、兼容降级和受保护 Eval 探针已完成本地验收；下一门槛是提交后运行首个受保护真实 Provider 闭环。
3. P2 已完成本地与原生验收：完整 Run 入队持久化、全局并发上限、项目互斥、FIFO、队列投影、重启不重放、显式继续/取消、项目释放与迟到结果封口均有证据。
4. P3 Timeline 聚合、显式 usage/cost 和 `metadata-only` 脱敏导出已完成本地与原生实现；真实 Provider usage/cost 仍待受保护证据。
5. P4 已完成 Tool Registry、MCP 配置、有界能力发现 transport、`mcp_discover` / `mcp_call` 的独立审批与 Timeline 结果，以及 `Agent 配置 / 受控工具` 最小可见管理入口。调用必须命中同项目且配置未变化的发现证据；下一门槛是以真实第三方 MCP 做受保护验收。

## 本阶段不做

- 不扩展 Project OS 安装器、模板分发、跨工具 adapter、AI 工程评分或报告。
- 不引入多 Agent、远程执行、云同步或与 Runtime 无关的新 UI 信息架构。
- 不把 Provider 成功响应显示为任务完成。
- 不在未获得真实原生和受保护 Eval 证据前宣布长任务恢复完成。
- 不用继续增加关键词路由来替代 Provider 原生 Function Calling。
