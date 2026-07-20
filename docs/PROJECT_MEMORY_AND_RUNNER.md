---
layer: governance
type: spec
last_verified: 2026-07-21
depends_on: [docs/ARCHITECTURE.md, docs/TESTING.md]
teaches: "OmniDesk 项目记忆、Agent Run 和人工确认边界"
use_when: "AI 要修改项目记忆、任务恢复、Agent Run 或执行证据时"
---

# 项目记忆与 Agent Run

> 用途：定义可持久化上下文、运行恢复和人工确认边界。
> 什么时候更新：记忆检索、Agent Run 状态、审批或检查闭环变化时。
> 不要写什么：旧 Project OS 后台 runner、模板回写或跨工具流程。

## 核心结论

项目记忆帮助模型理解已确认的工程上下文；Agent Run 负责一次有界任务的计划、草稿、审批、检查、修复和证据。两者都由 Desktop Runtime 持久化，不能由浏览器 Preview 或 Provider 响应直接改写。

## 项目记忆

- 只保留用户明确确认的约束、项目事实、偏好和有来源的摘要。
- 将检索范围限制为当前项目和当前任务；冲突信息保留候选与来源，不静默覆盖。
- Provider 请求只带所需的有界摘要，不把完整对话、密钥、终端输出或无关文件送出。
- 记忆属于 `.omnidesk/data`；索引和派生结果属于 `.omnidesk/cache`，可重建。

## Agent Run

每个 Run 持久化 immutable attempts 和 evidence：阶段、授权文件、草稿、审批、工具参数/结果、检查输出、失败摘要、修复预算、成本和最终状态。任务完成必须由最终证据判定，Provider 返回成功只能说明模型请求成功。

恢复从最近完成的工具边界开始。Runtime 在 Apply 或 Check 之前先持久化等待状态；重启后恢复同一审批，不自动重放工程写入或检查。模型网络流无法续传，只能以保存的上下文重新请求当前阶段。

## 人工确认边界

- 生成 Patch 草稿可自动进行，但草稿必须经过文件范围、路径、hunk 和上下文校验。
- 每次工程文件写入都需要独立审批。
- 每次受控检查都需要独立审批。
- 检查失败后最多生成两轮修复草稿；修复草稿不能扩大授权文件范围。
- Hermes 不可用时可以使用普通 Provider 生成草稿，但本地占位草稿永远不可应用，降级原因写入 evidence。

## 检查闭环

`Patch -> Apply -> Check -> Repair` 的时间线保留在同一任务内。失败时应展示检查输出、已应用 diff、剩余修复次数和最终原因；成功时必须同时具有已批准的 Patch、应用结果和通过的检查。真实 Eval 必须保存原始 trace，并在受保护环境验证，离线状态机测试不能代替网络或原生重启证据。
