---
layer: knowledge
type: spec
last_verified: 2026-07-20
depends_on: [AGENTS.md, PROJECT.md, docs/PRODUCT_PLAN.md]
teaches: "OmniDesk Desktop Runtime 的系统边界、模块职责、状态所有权和运行路径"
use_when: "AI 需要判断架构影响范围、模块所有权、执行边界或迁移顺序时"
---

# 架构说明

> 用途：说明 OmniDesk 的产品内核、模块职责、核心数据流和兼容迁移边界。
> 什么时候更新：Runtime 模块、状态所有权、执行路径或跨层边界变化时。
> 不要写什么：当前交接流水、详细变更历史、旧 Project OS 分发教程或临时任务计划。

## 当前定位

OmniDesk 是本地优先的 AI 工程工作台。唯一产品内核是 `desktop/`：React Workbench 承载用户交互，Tauri Local Agent Runtime 持有本地权限、状态事务、Provider、Patch、检查和终端生命周期。

早期 Project OS CLI、安装器、评分报告、模板和跨工具 adapter 不再是产品内核。它们在迁移期间仅作为兼容工具存在，禁止继续承载新的业务能力。

## 整体架构分层

```txt
Workbench UI
  -> Conversation / Task / Workspace controllers
    -> Runtime command and event contract
      -> Local Agent Runtime domain services
        -> Repository / Provider / Tool Gateway / PTY
          -> local project and OmniDesk state
```

| 层 | 责任 | 禁止事项 |
|---|---|---|
| Workbench UI | 呈现对话、任务、审批、终端和证据 | 不直接读写工程文件或密钥 |
| Frontend controllers | 组织请求生命周期和领域投影 | 不复制 Runtime 业务状态机 |
| Runtime contract | 统一 Tauri command、事件、错误和 Preview 策略 | 不允许 Preview 绕过权限 |
| Domain services | Workspace、Conversation、Task、Goal、Agent Run、Provider、Patch、Execution | 不把跨实体事务留给 UI |
| Repository / gateways | 原子持久化、审计、模型调用、工具审批、PTY | 不接受越权路径和任意命令 |
| Local project | 用户代码、配置和 OmniDesk 状态 | 未经独立审批不得写入或执行 |

## 入口层方案

产品入口只有 OmniDesk Desktop。浏览器 Preview 是只读开发和视觉验证入口，不是第二套产品 Runtime。

- Desktop 通过 Tauri command 调用本地 Runtime，并通过事件接收流式进度。
- Preview 只提供显式登记的读取操作；写入、终端、检查、Provider 密钥和工程 Patch 必须拒绝。
- Hermes 是可选执行器，普通 Provider 是模型通道；二者都必须经过 OmniDesk 的授权文件、审批、Patch 校验和检查边界。
- 旧 `project-os` CLI、Shell wrapper、CI adapter 不再定义产品语义，只在迁移期间提供兼容行为。

## 仓库实现层次

| 路径 | 所有权 |
|---|---|
| `desktop/src/` | Workbench UI、领域 controller、客户端契约和只读投影 |
| `desktop/src-tauri/src/runtime/` | Local Agent Runtime 领域服务和 Repository |
| `desktop/evals/` | Agent 能力数据集、基线报告和发布门槛 |
| `desktop/tests/` | 前端契约、工作流、状态机和边界回归 |
| `docs/` | 长期架构、测试、决策和运行说明 |
| `.omnidesk/` | 当前产品状态根；由 namespace manifest 激活后承担 Runtime 读写 |
| `.project-os/` | 非破坏性迁移源；只在未激活或冲突回退时继续读写，最终退役 |
| `scripts/` | 仅保留文档结构、frontmatter 与密钥安全的仓库校验；不承载产品语义 |

## 运行路径

### 普通对话

```txt
用户提交
  -> Conversation request 持久化
  -> Provider 预检
  -> SSE model.delta
  -> request.completed / failed / cancelled
  -> Conversation 终态持久化
```

取消只影响当前 `requestId`；新请求接管后，旧请求的迟到结果不得写回。网络或应用中断后可以重新执行当前阶段，但当前尚不能从流式 token 位置续传。

### 复杂开发任务

```txt
任务与授权文件
  -> 计划
  -> Patch 草稿和本地校验
  -> 独立写入审批
  -> Apply
  -> 独立检查审批
  -> Check
  -> 最多两轮 repair
  -> 成功或可解释失败
```

Provider 返回成功不等于任务成功。只有 Patch、应用、检查和最终证据都满足状态机约束，任务才可进入完成态。

### 恢复

Agent Run 已持久化 attempt、审批、观察、request checkpoint、当前阶段、上下文摘要和最后确认点。重启后会从已持久化的阶段边界继续，并保留原审批，不会整轮重试或自动重放 Patch/检查。当前仍缺少原生窗口重启的端到端发布证据；离线状态机回归不能替代该证据。

### 状态迁移

```txt
.project-os 检测
  -> 恢复未完成 legacy 事务
  -> 分类复制到 .omnidesk
  -> 内容比对与冲突检查
  -> 原子切换 active namespace
  -> 恢复新 namespace 事务
  -> 验收后删除旧兼容数据
```

迁移必须幂等、可审计、可恢复。不得用目录直接改名替代迁移，也不得在验证成功前删除源数据。出现任一目标内容冲突时，manifest 必须保持 `legacy / legacy-primary`；激活 `omnidesk / omnidesk-primary` 后不再回读可能已过期的 legacy 内容。

## 模块职责

| Runtime 模块 | 责任 |
|---|---|
| `workspace` | 项目事实、能力、档案、记忆和工作区投影 |
| `conversations` | 对话记录、事件、归档和请求上下文 |
| `tasks` | 任务状态、文件授权、Patch/检查结果和任务所有权 |
| `goals` | 目标、任务索引、验收、归档、恢复和合并 |
| `agent_runs` | 有界运行、attempt、审批、恢复和最终态 |
| `provider` | Provider 配置、密钥隔离、预检和失败分类 |
| `patch` | unified diff 归一化、授权路径、hunk 和上下文校验 |
| `execution` | 受控写入、检查、审计和执行结果 |
| `repository` | schema、锁、原子事务、事件和异常恢复 |
| `state_namespace` | 四分区路径映射、非破坏性迁移、冲突回退和激活 manifest |

跨模块写入必须由 Runtime 领域服务在一个 Repository 事务内完成。React 只消费投影和调用明确 operation，不承担跨实体补偿逻辑。

## 状态所有权

目标 `.omnidesk/` 分为四类：

| 分区 | 内容 | 保留原则 |
|---|---|---|
| `data/` | workspace、conversation、task、goal、agent-run、provider 元数据 | 用户数据，默认长期保留 |
| `runtime/` | request checkpoint、transaction、event、lock、PTY 元数据 | 有界保留，prepared 状态不得自动删除 |
| `cache/` | model health、索引、派生事实和临时文件 | 可重建，可按预算清理 |
| `evidence/` | Eval trace、Patch、检查和发布验收证据 | 按基线与发布策略保留 |

Provider 密钥继续存放在受保护的环境文件或系统密钥能力中，不进入 Repository event、trace 或普通 JSON 状态。

工程文件树、Agent 读取工具和默认治理扫描都必须隐藏 `.project-os/` 与 `.omnidesk/` 两个物理目录。界面在兼容期可继续使用 `.project-os/...` 逻辑路径，但真实读写必须经过 namespace resolver。

## 架构约束

- 新产品能力只能进入 Desktop Runtime，不得进入冻结的旧 CLI 或安装脚本。
- Preview 永远不能成为隐藏的写入或命令执行后门。
- 所有工程写入和检查都必须独立审批。
- 状态迁移必须先复制校验，再切换读取，最后清理旧源。
- Eval 必须保留真实执行证据，不能用手写成功结果替代 Provider 或 Runtime trace。
- 终端持久化若实施，必须是用户可见的独立 session 能力，默认不落盘完整终端输出。
