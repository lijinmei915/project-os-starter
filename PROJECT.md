---
layer: knowledge
type: status
last_verified: 2026-07-20
teaches: "OmniDesk 当前产品内核、阶段、可靠性基线和唯一下一步"
use_when: "AI 需要判断 OmniDesk 当前状态、架构边界或下一步工作时"
depends_on: [AGENTS.md, docs/ARCHITECTURE.md, docs/PRODUCT_PLAN.md]
---

# 项目状态

> 用途：回答“OmniDesk 现在是什么、运行内核是什么、进度到哪、下一步是什么”。
> 什么时候更新：产品内核、阶段、可靠性基线或当前重点变化时。
> 不要写什么：详细历史流水、安装教程、长期路线图或一次性任务记录。

## 项目定位

- 项目名：`OmniDesk`
- 产品形态：基于 `Tauri + React + Local Agent Runtime` 的本地 AI 工程工作台
- 唯一产品核心：`desktop/` 内的 OmniDesk Desktop Runtime
- 当前阶段：`OmniDesk 单内核收敛与可靠长任务 v1`

OmniDesk 负责在用户授权范围内理解本地项目、持续对话、生成计划和 Patch 草稿、执行独立审批、运行检查、有限修复并保存可审计证据。它不是 Project OS 安装器、AI 工程评分工具或跨工具模板分发产品。

`Project OS` 是本仓库早期产品阶段留下的兼容命名和工具链。旧 CLI、安装脚本、模板、报告与 adapter 已冻结，不再承载新产品能力；待 Desktop Runtime 完成状态迁移和依赖断开后退役。

## 当前架构

- 桌面应用：`desktop/src/`，负责 Workbench、对话、任务、目标、审批、终端和证据呈现。
- 本地运行时：`desktop/src-tauri/src/runtime/`，负责 Workspace、Conversation、Task、Goal、Agent Run、Provider、Patch、Execution 与 Repository。
- 模型执行：普通 Provider 与 Hermes 都经过同一授权文件、Patch 校验、审批和检查边界。
- 状态事务：Runtime Repository 使用 schema、锁和原子事务维护跨实体一致性。
- 浏览器 Preview：仅用于只读预览和 UI 验证，不执行文件写入、终端或受控检查。
- 当前状态根：兼容期仍读取 `.project-os/`；目标状态根为 `.omnidesk/`，必须通过幂等迁移切换，不能直接改名或删除。
- 评测：`desktop/evals/` 保存固定 12-case 基线；真实 Provider Eval 在受保护环境运行。

详细模块边界见 `docs/ARCHITECTURE.md`，测试与发布门槛见 `docs/TESTING.md`。

## 当前进度

已完成：

- 对话 SSE 流式输出、请求级取消、新请求接管和迟到结果拒绝。
- Agent Run 持久化、审批、Patch 应用、检查、最多两轮修复和中断恢复。
- Workspace、Conversation、Task、Goal、Provider、Execution 的 Runtime 模块与 Repository 事务边界。
- 正式 12-case Eval：任务成功率 100%、Patch 可应用率 90.9%、检查通过率 100%、恢复成功率 100%。
- 当前工作树回归：Desktop Node 439/439、Runtime Rust 64/64、Patch Normalizer 5/5。
- `.omnidesk/` v1 四分区 schema 与非破坏性迁移器：支持幂等复制、冲突拒绝和符号链接跳过。

正在做：

- 将产品与文档 SSOT 收敛到 OmniDesk Desktop Runtime。
- 将 Runtime 领域读写从 `.project-os/` 切换到 `.omnidesk/`，并保留受控回退读取。
- 断开 Desktop、CI 和测试对旧 Project OS 分发工具链的依赖。
- 将长任务恢复从“整轮重试”提升为持久化 checkpoint 后按阶段恢复。
- 将 Eval 原始 trace 从临时目录固化为可携带的发布证据。

当前风险：

- 活跃 Provider 请求不能从中断 token 续传，只能基于 checkpoint 重新执行当前阶段。
- 终端会话和屏幕输出仍在内存，Runtime 重启会终止会话。
- `.project-os/` 同时混有产品状态、兼容状态和历史运行产物。
- 旧 CLI、scripts、templates、adapters 与当前 CI/测试仍有真实依赖，不能直接整目录删除。
- 当前工作树有较多未提交的桌面端改动，需要保持小批次验证和清晰提交边界。

## 下一步重点

1. 将 `.omnidesk/` 迁移器接入 Runtime 启动准备，并切换 Repository 读写与回退读取。
2. 迁移 Workspace、Conversation、Task、Goal、Agent Run、Provider 和 Preview 的直接路径。
3. 切换 Desktop 状态所有权后，逐项退役旧 CLI、安装器、模板、adapter 和路由 skill。
4. 持久化长任务 checkpoint，并覆盖网络中断、应用重启和多文件任务恢复。
5. 固化 Eval trace，完成全量迁移验收后清理 `.project-os` 历史产物和兼容层。
