---
layer: knowledge
type: spec
last_verified: 2026-07-21
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

当前阶段：`OmniDesk 单内核收敛与可靠长任务 v1`。

本阶段的完成标准：

1. `.omnidesk` 成为唯一激活状态根，`.project-os -> .omnidesk` 迁移幂等、可审计且可回退。
2. 旧 CLI、installer、templates、adapters、routing skill 和评分工具不再被 Desktop、CI、测试或文档当作产品入口。
3. Agent Run 在 Patch、检查和修复的阶段边界可恢复；不自动重放未确认写入或检查。
4. Eval 保留真实 trace，原生端、网络中断、应用重启和多文件任务具有发布级证据。
5. 迁移验收完成后，按保留策略退役 `.project-os` 兼容层。

## 当前优先级

1. 断开剩余文档、模板和 installer 消费者，避免旧工具链继续定义用户或维护者流程。
2. 让原生恢复测试证明已持久化阶段可以在真实应用重启后继续，不把离线状态机测试当作等价证据。
3. 将 Eval trace 固化为受保护环境的 artifact，并覆盖网络中断和大型多文件修复。
4. 完成迁移验收与数据保留策略后，删除 `.project-os` 兼容读写。

## 本阶段不做

- 不扩展 Project OS 安装器、模板分发、跨工具 adapter、AI 工程评分或报告。
- 不引入多 Agent、远程执行、云同步或新的 UI 信息架构。
- 不把 Provider 成功响应显示为任务完成。
- 不在未获得真实原生和受保护 Eval 证据前宣布长任务恢复完成。

后续阶段只在本阶段验证完成后讨论知识记忆扩展、持久终端或协作能力。
