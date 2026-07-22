---
layer: knowledge
type: status
last_verified: 2026-07-21
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
- 当前阶段：`OmniDesk 仓库文件治理与架构收敛 v1`

OmniDesk 负责在用户授权范围内理解本地项目、持续对话、生成计划和 Patch 草稿、执行独立审批、运行检查、有限修复并保存可审计证据。它不是 Project OS 安装器、AI 工程评分工具或跨工具模板分发产品。

`Project OS` 是本仓库早期产品阶段留下的兼容命名和工具链。旧 CLI、Desktop governance bridge、安装脚本、模板、静态报告、adapter 与 routing skill 均已退役；物理 `.project-os/` 状态根已删除。

## 当前架构

- 桌面应用：`desktop/src/`，负责 Workbench、对话、任务、目标、审批、终端和证据呈现。
- 本地运行时：`desktop/src-tauri/src/runtime/`，负责 Workspace、Conversation、Task、Goal、Agent Run、Provider、Patch、Execution 与 Repository。
- 模型执行：普通 Provider 与 Hermes 都经过同一授权文件、Patch 校验、审批和检查边界。
- 状态事务：Runtime Repository 使用 schema、锁和原子事务维护跨实体一致性。
- 浏览器 Preview：仅用于只读预览和 UI 验证，不执行文件写入、终端或受控检查。
- 当前状态根：`.omnidesk/` 是唯一物理状态根；旧 `.project-os/` 已迁移、归档并删除。Runtime 与 Preview 仅接受 native `.omnidesk/data|runtime|cache|evidence` 路径；历史导入由迁移器单独处理。
- 评测：`desktop/evals/` 保存固定 12-case 基线；最新受保护 Provider Eval `29890989675` 已产生并上传真实报告与 artifact-relative trace。

详细模块边界见 `docs/ARCHITECTURE.md`，测试与发布门槛见 `docs/TESTING.md`。

## 当前进度

已完成：

- 对话 SSE 流式输出、请求级取消、新请求接管和迟到结果拒绝。
- Agent Run 持久化、独立审批、Patch 应用、检查、最多两轮修复，以及工具边界的阶段 checkpoint 恢复。
- Workspace、Conversation、Task、Goal、Provider、Execution 的 Runtime 模块与 Repository 事务边界。
- 正式 12-case Eval：任务成功率 100%、Patch 可应用率 90.9%、检查通过率 100%、恢复成功率 100%。
- 当前工作树回归：Desktop Node 449/449、Runtime Rust 91/91、Patch Normalizer 5/5、原生 WebDriver smoke；Web build 与 800 KiB 首屏软预算通过。
- `.omnidesk/` v1 四分区 schema、非破坏性迁移器和启动激活已接入生产 Runtime：支持幂等复制、冲突拒绝、符号链接跳过和 legacy 回退。
- Repository、Workspace、Provider、Task、Conversation、Agent Run 与 Preview 均按分区直接读写；文件树和 Agent 读取工具隐藏 Runtime 状态目录与可能遗留的旧目录。
- Desktop Runtime 已停止编译旧 `governance` bridge，不再暴露 `run_project_os_action`，受控检查只执行 Desktop Node、Web build 与 Cargo 检查；浏览器 Preview 的事实刷新只重新读取只读 snapshot。
- 旧 CLI crate 与 Desktop `governance` bridge 已从仓库删除；Desktop Runbook、Preview 和工程资产投影不再发现或展示旧治理脚本、模板与 adapter。
- Desktop 工作区已移除旧 CLI、模板、adapter 与 routing Skill 的可见入口，仅呈现 OmniDesk Runtime 的模型、受控工具、安全边界、工程文件与证据。
- 常规 CI 已删除旧 CLI 编译、installer 回归、AI 工程报告生成和 `.project-os` 报告上传，只保留 Desktop Runtime 回归与轻量仓库契约检查。
- 受保护 Agent Eval 使用 active `.omnidesk/data` Provider 配置，并将每次真实结果、报告与 trace 固化到 `.omnidesk/evidence/agent-eval/<run-id>` 后上传。
- 受保护 Eval `29767685402` 已通过：12/12 case 完成，任务成功率 100%、Patch 可应用率 90.9%、检查通过率 100%、恢复成功率 100%；artifact 中包含四文件目标改绑、初始失败检查与修复、网络中断恢复的原始 trace。
- native namespace 受保护 Eval `29815260557` 已通过：12/12 case 完成，任务成功率 100%、Patch 可应用率 90.9%、检查通过率 100%、恢复成功率 100%。artifact 中的结果引用均为相对 trace 路径；`failed-check-repair` 保留真实初始失败检查并在审批后修复，`goal-rebind` 在四份已授权文件完成改动，`interrupted-run` 保留网络中断后的审批边界恢复证据。此前 `29808415450` 的 Provider 配额失败 artifact 也被保留，未覆盖基线。
- 最新受保护 Eval `29889159179` 已在 `df39e62` 通过：12/12 case 均保留 artifact-relative trace，任务成功率 100%、Patch 可应用率 90.9%、检查通过率 100%、恢复成功率 100%；`state.test.mjs` 的真实草稿已通过同一 Runtime Patch normalizer、独立审批和 Node 测试验证。
- 受保护 Eval `29889968324` 已在 `9615d52` 通过：终端 Runtime 收口后 12/12 case 均保留 artifact-relative trace，任务成功率 100%、Patch 可应用率 90.9%、检查通过率 100%、恢复成功率 100%。
- 受保护 Eval `29890521784` 已在 `9b8f97f` 通过：状态事务恢复与 namespace 激活收口后 12/12 case 均保留 artifact-relative trace，任务成功率 100%、Patch 可应用率 90.9%、检查通过率 100%、恢复成功率 100%。
- 受保护 Eval `29890989675` 已在 `be2fafc` 通过：任务展示 helper 收口后 12/12 case 均保留 artifact-relative trace，任务成功率 100%、Patch 可应用率 90.9%、检查通过率 100%、恢复成功率 100%。
- 根目录旧静态站、在线站/截图/报告模型测试、AI 工程评分报告 schema 与历史设计提案已删除；Desktop 只保留任务执行与目标验收证据。
- 原生窗口重启会把待审批 Agent Run 标记为中断、保留审批 token，并恢复到等待审批状态。
- 原生 WebDriver smoke 使用 native `.omnidesk` fixture，并验证四文件授权的待审批 Patch 在重启后仍保留完整授权集与原审批。
- 真实 Provider Eval 强制提供 artifact trace 目录；结果中的 trace 引用为 artifact 相对路径，不再指向临时 fixture。
- `.project-os` 已在归档和逐字节复验后删除；9 处历史差异保留于 `.omnidesk/evidence/legacy-retirement/1784572963533/`。
- `OmniDesk 单内核收敛与可靠长任务 v1` 已完成；当前开始按文件账本逐项收口仓库结构、文档 SSOT、契约命名和领域 Owner。
- 文件账本已覆盖全部 496 个 tracked 文件；`PRODUCT.md`、`INSTALL.md`、`AGENTS.md`、前端说明和本地 Runtime 说明已完成首批审核与改写。
- Workspace 的事实新鲜度、能力、记忆与档案记录，以及前端对话、摘要、项目记忆和事实投影，现统一新写入 `omnidesk.*`；读取旧 `project-os.*` 仅生成带 `schemaMigration` 的内存投影。Provider 凭据配置仍隔离，未做泛化迁移。
- `styles.css` 已收口为有序入口，领域规则拆到 `styles/theme|workspace|conversation|terminal|provider-rail.css`；构建与边界测试约束入口顺序和 Owner。
- 执行 allowlist、Patch apply、输出截断和任务摘要已归属 `runtime/execution.rs`；`app.rs` 保留 Tauri 命令、审批与生命周期编排。5 份无 Desktop Runtime 消费者的旧 schema 已标记 compatibility review，等待外部消费者复核与独立删除确认。

正在做：

- 按文件账本收口根目录、文档 SSOT 与失效旧入口。
- 治理 schema、兼容命名和状态契约，明确保留、迁移与退役条件。
- 在保持 Runtime 行为与真实 Eval 门槛的前提下，按领域拆分前端与 Runtime 聚合文件。

当前风险：

- 活跃 Provider 请求不能从中断 token 续传；重启后只能从最近持久化阶段重新请求模型，不能续接原网络流。
- 终端会话和屏幕输出仍在内存，Runtime 重启会终止会话。
- 历史工程如需导入旧 `.project-os/`，必须先运行幂等迁移并处理冲突；Runtime 不会回退读取旧路径。

## 下一步重点

1. 审核并收口其余根目录入口、文档 manifest、knowledge registry 与旧示例；删除前保留消费者证据和独立确认。
2. 逐项审核 schema、生成物、前端与 Runtime 文件 Owner；每个批次通过对应本地回归、原生 smoke 与受保护 Eval 门槛。
