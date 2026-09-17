---
layer: knowledge
type: spec
last_verified: 2026-07-25
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

早期 Project OS CLI、安装器、评分报告、模板和跨工具 adapter 不再是产品内核。外部历史工程的 legacy 状态仅可通过迁移器导入，禁止继续承载新的业务能力或作为 Runtime 回退路径。

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
- Workspace watcher 只负责发现当前项目的安全文件变化。它必须先用 Git 状态复核，再将有界相对路径、时间和可选未完成任务关联追加到 `external-change-archive`，由“执行结果”治理区展示。外部归档默认 `approvalRequired=false`、`verificationStatus=unverified`，查看详情和运行检查都是用户可选动作；它不能保存源码、diff、外部聊天、工具输出或凭据，也不能触发检查、提交、Patch、任务完成或验证通过。
- 审批边界按动作来源划分：外部工具已经造成的工作区变化只自动归档，不重复审批；从 OmniDesk 内发起的工程写入、命令、合并与发布仍必须经过各自的受控审批。归档记录不能冒充 OmniDesk Agent Run 或检查证据。
- Hermes 是可选执行器，普通 Provider 是模型通道；二者都必须经过 OmniDesk 的授权文件、审批、Patch 校验和检查边界。
- 开源或外部 Agent 通过 `AgentExecutor` 接口位于治理 Runtime 下方。唯一 Registry 当前登记默认 `HermesAcpExecutor`、可选 `GeminiAcpExecutor` 与 `CodexCliExecutor`；`acp_protocol / acp_execution` 统一 ACP JSON-RPC、结构化工具循环、取消和 usage，Adapter 只负责程序、参数与环境。`codex-cli` 当前是独立 JSONL 只读规划 Adapter：无图片附件时以 `codex exec --json --sandbox read-only` 运行，公开事件会转换为标准 Timeline；它不满足 v1 的受控写入能力，不能被 Agent Run 写入/检查入口选择，也不能伪称 checkpoint 续传。新 Run 固化所选 ID，恢复只能使用原执行器，缺失或能力不足时明确失败。执行器不能拥有 Scheduler、持久化、Tool Gateway、审批、Patch Apply、检查、恢复或 evidence 的最终决定权。
- Hermes 的受控工程任务可复用最多两个内存 ACP Worker（常驻 Agent 进程），以减少每次进程启动的等待。Worker 按项目路径、程序参数、连接和模型隔离；每个 Run 仍必须发送新的 `session/new`，不得复用前一任务会话或上下文。只读规划和图片规划继续使用一次性隔离进程；取消、错误或协议失败时销毁 Worker，池满时使用一次性进程。Worker 状态、密钥、会话和项目内容都不得持久化到 `.omnidesk/`。
- `AgentExecutor` 公开契约版本为 `omnidesk.agent-executor.v1`。v1 核心能力是 Runtime 的受控执行准入条件；执行器独有特性只能写入不透明 `extensions`，供 Adapter 或展示层解释。Runtime 核心业务不得读取扩展，不得按具体执行器 ID 分支；新增核心语义必须升级契约版本，而不是继续扩充 v1。
- 执行器公开过程事件使用 `omnidesk.agent-event.v1`：共享协议层负责把供应商消息归一化为单调 sequence、固定 kind/phase/status、公开摘要和白名单详情，并保证单一 terminal。Runtime 和前端不能读取供应商原始事件形状。内部思维链不属于产品事件；只允许记录用户可见阶段和 metadata-only 操作事实。
- 旧 `project-os` CLI、Shell wrapper、CI adapter 不再定义产品语义；仅迁移器可读取外部历史状态，Desktop Runtime 不回退读写 legacy 状态。

## 仓库实现层次

| 路径 | 所有权 |
|---|---|
| `desktop/src/` | Workbench UI、领域 controller、客户端契约和只读投影 |
| `desktop/src/components/provider/` | 可复用模型连接设置 UI；只消费注入的配置、密钥、测试和模型发现接口，不直接调用 Tauri 或 OmniDesk 状态 |
| `desktop/src-tauri/src/runtime/` | Local Agent Runtime 领域服务和 Repository |
| `desktop/evals/` | Agent 能力数据集、基线报告和发布门槛 |
| `desktop/tests/` | 前端契约、工作流、状态机和边界回归 |
| `docs/` | 长期架构、测试、决策和运行说明 |
| `.omnidesk/` | 当前产品状态根；由 namespace manifest 激活后承担 Runtime 读写 |
| 外部工程 `.project-os/` | 非破坏性一次性迁移源；冲突时保留源数据和证据并拒绝激活，不作为 Runtime 读写回退 |
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

### 工程任务入口

```txt
明确的项目检查、审查、分析、实现或修改请求
  -> 本地确定性识别
  -> 持久化最小 Task（不请求 Provider 生成前置计划）
  -> 选择并启动 AgentExecutor
  -> 标准 Agent Event 实时展示
  -> OmniDesk Tool Gateway / 审批 / 恢复 / 证据
```

普通 Provider 不是工程任务的必经路由器。明确的纯文字项目工作直接进入当前选择的 `AgentExecutor`；替换 Agent 只增加 Adapter 与 Registry 项，不改对话入口、审批或展示。普通解释、概念问答和不要求实际读取项目的问题仍走 Provider 自然文本流。显式要求生成独立计划时可以使用只读规划入口，但该入口不能成为所有 Agent Run 的前置条件。

`AgentExecutor v1` 是纯文字执行契约。带图片的工程请求必须先经过现有受控视觉上下文桥接，再将有界视觉摘要与源码观察交给 Agent；不得为了表面直达而静默丢弃图片，也不得向冻结的 v1 契约追加供应商专用多模态字段。未来若执行器统一支持原生图片输入，应发布新的核心契约版本。

本地 Task 只保存用户目标、项目/对话归属和治理边界，不伪造模型计划。Agent 可以先读项目、追问必要信息；任何文件写入和受控检查仍分别等待批准。Task 已保存但执行器启动失败时必须保留失败事实，不能回退成普通 Provider 成功回答。

### 复杂开发任务

```txt
本地持久化 Task -> 选定 AgentExecutor
  -> 任务与授权文件
  -> 有界只读 Context Pack（项目摘要、候选源码、显式读取）
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

Agent Run 已持久化 attempt、审批、观察、request checkpoint、当前阶段、上下文摘要和最后确认点。重启后会从已持久化的阶段边界继续，并保留原审批，不会整轮重试或自动重放 Patch/检查。原生 WebDriver smoke 已验证“重启后中断并恢复原审批”；真实 Provider 网络中断和大规模多文件修复仍由受保护 Eval 证明。

### 状态迁移

```txt
外部 legacy `.project-os` 检测
  -> 恢复未完成 legacy 事务
  -> 分类复制到 .omnidesk
  -> 内容比对与冲突检查
  -> 原子切换 active namespace
  -> 恢复新 namespace 事务
  -> 重新逐文件比对退役预检
  -> 用户明确确认后删除旧兼容数据
```

迁移必须幂等、可审计、可恢复。不得用目录直接改名替代迁移，也不得在验证成功前删除源数据。退役预检要求 namespace 已激活、所有 legacy 常规文件在目标分区中存在且字节一致、没有符号链接、漏迁或冲突；它只给出可删结论，不触发删除。若切换后的 active 状态与 legacy 历史内容不同，必须先以独立确认动作将差异文件归档到 `.omnidesk/evidence/legacy-retirement/<id>/source/` 并写入 manifest，之后才能请求删除。出现任一目标内容冲突时，迁移必须拒绝激活并保留源数据与证据；激活 `omnidesk / omnidesk-primary` 后不再回读可能已过期的 legacy 内容。

## 模块职责

| Runtime 模块 | 责任 |
|---|---|
| `workspace` | 项目事实、能力、档案、记忆和工作区投影 |
| `conversations` | 对话记录、事件、归档和请求上下文 |
| `tasks` | 任务状态、文件授权、Patch/检查结果和任务所有权 |
| `goals` | 目标、任务索引、验收、归档、恢复和合并 |
| `agent_runs` | 有界运行、attempt、审批、恢复和最终态 |
| `agent_scheduler` | 持久化队列、全局并发上限、项目互斥、FIFO 领取、租约和重启中断 |
| `agent_tools` | 受控项目读取、上下文包和只读工具参数边界 |
| `tool_registry` | 版本化工具描述符、能力发现、输入 schema、来源、风险与审批声明校验 |
| `mcp_runtime` | MCP stdio Server 配置、环境变量引用、有界发现/调用 transport 与项目绑定发现证据；仅由消费独立 Agent Run 审批后的 Tool Gateway 调用 |
| `provider_core` | 不含产品状态的 OpenAI-compatible 能力核心：端点规范化、SSE 文本/工具片段、失败分类和有限重试；不读取密钥，不依赖 Task、审批、Patch、Repository 或 `.omnidesk` |
| `provider` | OmniDesk Provider 配置、密钥隔离、预检、健康证据和对 `provider_core` 的产品适配 |
| `provider_tools` | 原生 Function Calling 能力、按 API Base + 模型持久化的能力证据、标准工具 schema、SSE/非流式完整 tool call 累计与参数校验、明确拒绝后的兼容降级 |
| `patch` | unified diff 归一化、授权路径、hunk 和上下文校验 |
| `execution` | 受控写入、检查、审计和执行结果 |
| `repository` | schema、锁、原子事务、事件和异常恢复 |
| `state_namespace` | 四分区路径映射、非破坏性迁移、冲突回退和激活 manifest |

跨模块写入必须由 Runtime 领域服务在一个 Repository 事务内完成。React 只消费投影和调用明确 operation，不承担跨实体补偿逻辑。

`provider_core` 当前是仓库内可复用边界，不是已经发布的 SDK。其他项目若要复用，只能向它注入 API Base、模型请求、凭据和取消策略；OmniDesk 的 Provider profile、健康缓存、Function Calling 能力证据和对话/任务投影不能下沉到核心。拆为独立 crate 前必须由第二个最小消费者证明无需引用 OmniDesk Runtime。

模型连接设置采用同样的宿主注入边界。`ProviderConnectionSettings` 只管理表单状态、连接列表、模型发现和测试反馈；保存位置、安全密钥存储、删除确认、Key 引用命名和只读策略由宿主提供。OmniDesk 通过薄 `ProviderPanel` 适配当前 Tauri Runtime，其他项目不得复制该适配器作为通用组件。

Agent Scheduler 保存于 `.omnidesk/runtime/agent-scheduler.json`。完整 Agent Run 必须先于 scheduler 入队持久化，因此重启后的 queued 项仍有任务、对话和恢复上下文。只读 snapshot 向工作台提供全局上限、活动数、调度状态和稳定队列位置。`queued` 不占项目；`running`、等待审批、等待追问和等待工具续接均保留项目。模型阶段异常退出由作用域租约落为 `interrupted`；启动恢复只中断旧保留，不领取 queued 项或重放 Patch/检查。显式取消同时封口 Agent Run 与 scheduler，释放项目；revision 与 scheduler 终态守卫拒绝迟到结果覆盖。

Agent Run 的新 evidence 采用 `omnidesk.run-event.v0.1`：每个事件包含稳定 `id/sequence/kind/phase/status/actor/recordedAt/summary/details`。调度、模型、审批、用户追问、Patch、检查、工具、恢复、取消和结果都写入该时间线；旧 evidence 继续兼容读取。模型事件的 `details` 保存真实耗时，并仅透传 ACP 响应明确给出的 token/cost，缺失值保持未知。Runtime 负责聚合 Run 指标；导出使用 `omnidesk.run-timeline-export.v0.1` 和 `metadata-only` 脱敏策略，调试证据不携带 prompt、工程正文、diff、模型 output、observations 或 credentials。

MCP 管理面位于 `Agent 配置 / 受控工具`，但 React 不持有 transport 权限。Workbench controller 注入 Server 配置、有效发现证据和创建审批的 operation；页面只能创建 `mcp_discover` / `mcp_call` Agent Run，再复用统一批准、取消与证据导出入口。Runtime 只向当前项目返回仍匹配 Server 配置快照的发现证据；Preview 不读取 MCP 配置或证据，也不能发现或调用工具。

## 状态所有权

目标 `.omnidesk/` 分为四类：

| 分区 | 内容 | 保留原则 |
|---|---|---|
| `data/` | workspace、conversation、task、goal、agent-run、provider 元数据 | 用户数据，默认长期保留 |
| `runtime/` | request checkpoint、transaction、event、lock、PTY 元数据 | 有界保留，prepared 状态不得自动删除 |
| `cache/` | model health、索引、派生事实和临时文件 | 可重建，可按预算清理 |
| `evidence/` | Eval trace、Patch、检查和发布验收证据 | 按基线与发布策略保留 |

Provider 密钥继续存放在受保护的环境文件或系统密钥能力中，不进入 Repository event、trace 或普通 JSON 状态。

工程文件树、Agent 读取工具和默认治理扫描都必须隐藏 `.omnidesk/` 与可能遗留的 `.project-os/` 状态目录。Runtime 与 Preview 只接受 native `.omnidesk/...` 分区路径；旧状态只由显式迁移器读取，不能通过普通 resolver 回退。

## 架构约束

- 新产品能力只能进入 Desktop Runtime，不得进入冻结的旧 CLI 或安装脚本。
- Preview 永远不能成为隐藏的写入或命令执行后门。
- 所有工程写入和检查都必须独立审批。
- Agent 启动前可使用有界的只读 Context Pack；它不得读取密钥或 Runtime 状态，也不构成 Patch 文件授权。
- 状态迁移必须先复制校验，再切换读取，最后清理旧源。
- Eval 必须保留真实执行证据，不能用手写成功结果替代 Provider 或 Runtime trace。
- 终端作为用户可见的独立 session 能力运行；它只落盘脱敏、截断的会话证据（状态、命令计数、最后命令摘要、输出尾部），绝不保存完整屏幕或交互进程状态。重启会将运行中会话标为中断。
- 任务可显式选择隔离 worktree。Runtime 只在干净 Git 根目录创建 detached worktree；模型 Patch 与检查在隔离根执行，源工程保持不变。Runtime 用第二个 `integrate_worktree` 内部审批复核源工程干净、批准 diff 与当前 diff 完全一致且仍符合授权文件集，才把 Patch 合并回源工程并清理 worktree。该内部步骤不暴露给模型作为可自由调用的工具。
