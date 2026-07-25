---
layer: knowledge
type: spec
last_verified: 2026-07-25
depends_on: [AGENTS.md, docs/ARCHITECTURE.md, docs/ENVIRONMENT.md, docs/TESTING.md]
teaches: "OmniDesk 本地 Rust Runtime 的服务边界、持久化、Provider、工具执行与安全约束"
use_when: "AI 要修改 Tauri command、Rust Runtime、Provider、状态事务、Patch、终端或受控检查时"
---

# 本地运行时说明

> 用途：说明 OmniDesk 本地 Runtime 的实际服务边界；它不是独立 Web 后端。
> 什么时候更新：Runtime 模块、持久化、Provider、工具执行或安全边界变化时。
> 不要写什么：虚构的 HTTP API、数据库、微服务、云部署方案或单次调试流水。

## 定位与技术栈

OmniDesk 没有独立的远程后端。`desktop/src-tauri/src/runtime/` 是运行在用户设备上的 Rust Local Agent Runtime，通过 Tauri command 服务 React Workbench。

- Rust 2021、Tauri 2 和 Tokio。
- `serde` / `serde_json` 用于版本化状态与契约。
- `reqwest` 处理 Provider 的 HTTP 与 SSE 流。
- `portable-pty` 提供本地终端会话；终端输出默认只保留内存中的有界窗口。
- `notify` 负责工作区文件变更观察。
- Runtime 使用本地文件和 Repository 事务，不依赖外部数据库、HTTP 服务或云队列。

## 调用与事件边界

React 只通过登记的 Tauri command 或事件与 Runtime 交互。Runtime command 负责输入适配、权限边界和领域服务调用；领域服务负责跨实体写入与恢复；Repository 负责 schema、锁、原子事务和审计事件。

浏览器 Preview 是只读 transport。任何工程写入、终端、受控检查、Provider 密钥、Agent Run 恢复或状态变更都必须由 Desktop Runtime 拒绝或显式降级，不能在 Vite middleware 中旁路实现。

## Runtime 模块

| 模块 | 责任 |
|---|---|
| `workspace` | 项目档案、能力、事实、记忆、工程文件预览、树扫描/忽略策略与工作区投影 |
| `conversations` | 对话记录、事件、归档与上下文 |
| `tasks` / `goals` | 任务、目标、授权范围、索引与验收 |
| `agent_runs` | attempt、审批、模型阶段创建/恢复、checkpoint、工具结果续接、模型完成状态与证据 |
| `agent_scheduler` | 持久化 Agent 队列、并发上限、项目互斥、FIFO、只读队列投影、显式取消/释放、租约与重启中断 |
| `tool_registry` | 版本化 Tool SDK 描述符、来源、风险、审批声明和封闭参数 schema 校验 |
| `mcp_runtime` | MCP stdio Server 配置、环境变量引用、逐次审批策略和持久化 |
| `provider` | Profile、密钥隔离、OpenAI-compatible transport、响应解析、预检与错误分类 |
| `provider_tools` | Provider 原生 Function Calling 能力矩阵、持久化能力证据、工具 schema、SSE/非流式完整调用解析与参数校验 |
| `hermes_protocol` | ACP 程序发现、只读健康探测、协议帧、超时/取消、结构化响应与拒绝响应 |
| `patch` | Patch Draft 语义门槛、上下文文件范围、提示词、占位草稿、unified diff、路径、hunk 与授权校验 |
| `patch_draft` | Patch Draft 模型连接选择、Hermes 重生成、Provider 降级、失败审计与草稿证据 |
| `planning` | 只读计划的本地回退、连接选择、Provider 降级与只读证据 |
| `execution` | 受控写入、检查、结果和审计 |
| `repository` | 原子事务、版本校验、锁、事件与异常恢复 |
| `state_namespace` | `.project-os -> .omnidesk` 显式迁移和四分区激活 |

`app.rs` 是 Tauri command 装配层，不应继续吸收新的领域规则。新增行为先进入相应 Runtime 模块，再由 command 适配输入和输出。Provider profile 切换后的 Hermes 同步、请求取消、Tauri 增量事件和 Agent 审批创建仍由命令编排层控制；只读计划的连接选择、降级和证据归 `planning`，Patch Draft 的连接选择、一次重生成、Provider 降级和草稿证据归 `patch_draft`，Patch Apply 的 unified diff、授权文件、Git Apply、已批准工具分派/结算、Run 项目绑定与审计证据归 `execution`，模型开始/完成的持久化状态、审批 checkpoint、恢复动作和证据归 `agent_runs`，HTTP endpoint、通用 transport、非成功响应摘要和模型列表解析归 `provider`，Function Calling 能力矩阵、工具 schema 和 tool call 解析归 `provider_tools`，Provider 对话请求与 SSE 生命周期归 `chat_stream`，防止计划、草稿、流式对话和连接探测形成不同协议语义。

`agent_runs` 同时拥有版本化 Run Event Timeline。Provider/Hermes transport 只能上报真实 duration/usage；token 和 cost 未返回时保持缺失，不能由 Runtime 猜测。Runtime 聚合事件数、模型调用数、耗时和显式 usage/cost；多阶段 Run 只有每个模型阶段都明确返回 cost 才能显示总成本，部分已知不得冒充完整成本。脱敏时间线导出到 `.omnidesk/evidence/agent-runs/<run-id>.json`，固定使用 `metadata-only` 策略，排除 prompt、文件正文、diff、output、observations 和 credentials。前端只消费时间线投影，不再自行拼接一套执行历史。

Tool Registry 使用 `omnidesk.tool-registry.v0.1` 与 `omnidesk.tool-descriptor.v0.1`。每个工具必须声明名称、版本、来源、风险、是否审批和封闭对象参数 schema。现有四个内置读取工具先通过 Registry 和参数校验再进入执行器；必填、类型、最小长度或未知字段不符合契约时，在访问项目之前拒绝。原生 `get_agent_tool_registry` 只读返回当前能力。MCP 工具以及任何写入/执行工具若未声明审批会在注册阶段拒绝；Registry 描述符本身不授予 transport 权限，MCP 仍必须命中项目绑定发现证据并消费独立审批。

MCP 配置使用 `omnidesk.mcp-servers.v0.1` 与 `omnidesk.mcp-server.v0.1`，当前仅接受 stdio。command 与 args 分离，不经过 shell；环境配置只保存目标变量名与宿主环境变量引用，不保存密钥值；`approvalPolicy` 固定为 `always`。保存、读取和删除配置不会启动 MCP 进程。能力发现 transport 支持 initialize、分页 `tools/list`、10 秒总超时、取消、单行/总输出上限和最多 100 个工具；发现结果统一标记为 `source=mcp / risk=execute / requiresApproval=true`。`request_mcp_discovery` 只允许受控项目先取得 Scheduler 互斥槽并创建待审批 Run；批准并消费独立 token 后，Tool Gateway 才启动 transport，结果写回同一 Run 并释放项目。`running-tool` 与检查的 `verifying` 阶段分离；不存在直接执行 transport 的 command。

批准的发现结果按 `omnidesk.mcp-discovery-evidence.v0.1` 写入 `.omnidesk/cache/mcp-discovery/`，绑定 project id、无密钥 Server 配置快照、协议版本和工具 schema。`request_mcp_call` 只接受仍匹配当前 Server 配置的同项目证据，并在创建审批前递归校验对象、数组、标量、required 与 enum 参数。每次调用重新取得 Scheduler 互斥并创建 `mcp_call` 独立审批；批准后执行有界 `tools/call`，结果写回同 Run Timeline。前端不能传入自定义工具描述来绕过 discovery evidence。

`get_mcp_discovery_evidence` 是面向 Workbench 的只读投影：只返回当前项目、当前 Server 配置仍有效的证据，旧证据继续留在 cache 供审计但不再展示为可调用能力。Server 管理、发现和调用由前端 controller 注入 `Agent 配置 / 受控工具`；页面不能直接执行 transport，发现与调用仍分别创建待审批 Agent Run。Preview 对配置、证据、发现和调用全部拒绝。

## 状态与安全

Runtime 的唯一激活状态根是 `.omnidesk/`：

```txt
data/      用户与工作区持久化数据
runtime/   request checkpoint、事务、事件和锁
cache/     可重建派生状态
evidence/  Patch、检查、Eval 和发布证据
```

工程文件写入和受控检查必须各自独立审批。Provider 返回成功不是任务成功；任务只有在草稿、授权、应用、检查与最终证据闭环后才可完成。Provider 请求中断不能从 token 流续传，只能从最近的持久化阶段重新请求，并保留中断证据。

Provider Key 不进入普通 JSON、trace、Repository event 或 Git；它只能由本机环境和 Runtime 的受保护配置路径提供。

## 验证

Runtime 或状态边界改动至少运行：

```bash
cargo check --manifest-path desktop/src-tauri/Cargo.toml
bash tests/run-tests.sh
```

涉及原生窗口、审批或恢复交互时额外运行：

```bash
npm --prefix desktop run test:native
```

真实 Provider 任务闭环只以受保护 Agent Eval artifact 作为发布级证据，详见 `docs/TESTING.md`。
