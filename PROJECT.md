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
- 当前状态根：Runtime 启动时会先恢复旧事务，再将 `.project-os/` 非破坏性迁移到 `.omnidesk/`；无冲突时原子激活新命名空间，有冲突时保持 legacy 读写并留下证据。
- 评测：`desktop/evals/` 保存固定 12-case 基线；真实 Provider Eval 在受保护环境运行。

详细模块边界见 `docs/ARCHITECTURE.md`，测试与发布门槛见 `docs/TESTING.md`。

## 当前进度

已完成：

- 对话 SSE 流式输出、请求级取消、新请求接管和迟到结果拒绝。
- Agent Run 持久化、审批、Patch 应用、检查、最多两轮修复和中断恢复。
- Workspace、Conversation、Task、Goal、Provider、Execution 的 Runtime 模块与 Repository 事务边界。
- 正式 12-case Eval：任务成功率 100%、Patch 可应用率 90.9%、检查通过率 100%、恢复成功率 100%。
- 当前工作树回归：Desktop Node 442/442、Runtime Rust 71/71、Patch Normalizer 5/5；Web build 与 800 KiB 首屏软预算通过。
- `.omnidesk/` v1 四分区 schema、非破坏性迁移器和启动激活已接入生产 Runtime：支持幂等复制、冲突拒绝、符号链接跳过和 legacy 回退。
- Repository、Workspace、Provider、Task、Conversation、Agent Run 与 Preview 均通过同一逻辑路径映射读写；文件树和 Agent 读取工具隐藏两个物理状态目录。
- Desktop Runtime 已停止编译旧 `governance` bridge，不再暴露 `run_project_os_action`，受控检查只执行 Desktop Node、Web build 与 Cargo 检查；浏览器 Preview 的事实刷新只重新读取只读 snapshot。
- 常规 CI 已删除旧 CLI 编译、installer 回归、AI 工程报告生成和 `.project-os` 报告上传，只保留 Desktop Runtime 回归与轻量仓库契约检查。

正在做：

- 将产品与文档 SSOT 收敛到 OmniDesk Desktop Runtime。
- 继续断开仓库测试和文档对旧 Project OS 分发工具链的真实依赖。
- 将长任务恢复从“整轮重试”提升为持久化 checkpoint 后按阶段恢复。
- 将 Eval 原始 trace 从临时目录固化为可携带的发布证据。

当前风险：

- 活跃 Provider 请求不能从中断 token 续传，只能基于 checkpoint 重新执行当前阶段。
- 终端会话和屏幕输出仍在内存，Runtime 重启会终止会话。
- `.project-os/` 仍作为非破坏性迁移源和 tracked 治理兼容文件；在 `AGENTS.md` 和旧工具链改用新 SSOT 前不能删除。
- 旧 CLI、scripts、templates、adapters 与本地全量测试、文档仍有真实依赖，不能直接整目录删除；Desktop 生产运行时与常规 CI 已不再依赖它们。
- 受保护 Agent Eval 仍通过 legacy `.project-os/desktop-provider.json` 逻辑路径注入临时 Provider；切换到 active `.omnidesk` artifact 前不能删除兼容映射。
- 命名空间映射仍接受 `.project-os/...` 作为兼容逻辑路径；在旧调用者退役前，不能把字符串搜索结果误判为物理旧路径仍在被读写。

## 下一步重点

1. 拆除 `tests/run-tests.sh` 中 CLI、installer、模板分发、报告和图谱的旧产品回归，只保留仍有 owner 的仓库契约。
2. 删除不再被 Desktop 或 CI 使用的 governance bridge，并继续收敛 CLI、scripts、templates、adapters 与 routing skill。
3. 持久化长任务 request checkpoint、阶段、上下文摘要和最后确认点，并覆盖网络中断、应用重启和多文件恢复。
4. 将 Eval 原始 trace 固化为稳定 artifact，补齐原生端、中断和大型任务发布门槛。
5. 完成全量验收后按保留策略清理 `.project-os` 历史产物和兼容层。
