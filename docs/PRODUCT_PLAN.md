---
layer: knowledge
type: spec
last_verified: 2026-07-22
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

当前阶段：`OmniDesk 仓库文件治理与架构收敛 v1`。

本阶段的完成标准：

1. 全部受版本控制文件在账本中拥有类型、Owner、消费者、决策和验证证据。
2. 根目录与文档 SSOT 只描述 OmniDesk Desktop Runtime；旧工具链仅保留迁移或历史证据说明。
3. 有效 Runtime 契约、显式兼容读取和无消费者候选被明确区分；新写入统一使用 `omnidesk.*`。
4. `main.jsx`、`styles.css` 与 `runtime/app.rs` 按对话、工作区、任务、目标、Provider、终端和执行领域收口，不改变已有 UI 或授权边界。
5. 完整本地回归、原生窗口 smoke 与受保护真实 Eval 为每个保留入口提供可复核的发布证据。

## 当前优先级

1. 完成剩余 Runtime/前端聚合文件的 Owner 收口，并以静态边界和领域回归阻止业务逻辑回流。
2. 审核兼容 schema 与历史文档消费者；未获得独立删除确认前保留可追溯证据，不恢复旧入口。
3. 为账本中的每个保留文件补齐生成、构建或测试消费者证据。
4. 在稳定工作树上复跑原生窗口 smoke，并以受保护真实 Eval 复核执行链路未回退。

## 本阶段不做

- 不扩展 Project OS 安装器、模板分发、跨工具 adapter、AI 工程评分或报告。
- 不引入多 Agent、远程执行、云同步或新的 UI 信息架构。
- 不把 Provider 成功响应显示为任务完成。
- 不在未获得真实原生和受保护 Eval 证据前宣布长任务恢复完成。

后续阶段只在本阶段验证完成后讨论知识记忆扩展、持久终端或协作能力。
