---
layer: knowledge
type: spec
last_verified: 2026-07-15
depends_on: [AGENTS.md]
teaches: "系统的模块划分、核心数据流和各层之间的边界"
use_when: "AI 需要理解整体系统结构、判断某个改动影响范围、或向用户解释架构时"
---

# 架构说明

> 用途：说明系统结构、核心模块、数据流和边界。
> 什么时候更新：模块职责、运行路径、数据流、部署结构或跨层边界变化时。
> 不要写什么：当前交接流水、详细变更历史、临时任务计划。

本文是 Project OS / AI Engineering Kit 的架构说明。

## 当前定位

Project OS 正在收敛为通用的 AI Engineering Kit：

```txt
检查 AI 工程完整度
按需补齐工程文档
保留跨工具 AI 规则适配
```

它不是业务 UI 框架，也不是某个平台专属插件。下一阶段桌面端方向已确定为 `Tauri + Local Agent Core + Workbench UI`，详见 `docs/DESKTOP_APP.md`。

## 整体架构分层

OmniDesk / Project OS 的整体架构自下而上分为 6 层。底层解决“接得进来”，上层解决“治得好”。

```txt
入口层：Web / IDE 插件 / CLI / CI / API
工作台应用层：大盘 / 单项目 / 规则 / 知识
治理服务层：质量 / 依赖 / 架构 / 安全 / 文档
核心内核层：规则引擎 + AI 引擎 + 执行引擎
元数据层：项目画像 + 资产建模 + 关系图谱
接入层：Git / 本地目录 / CI / 制品库 / IDE
```

| 层级 | 解决的问题 |
|------|------------|
| 入口层 | 用户在哪，治理能力就在哪 |
| 工作台应用层 | 面向不同角色的功能界面 |
| 治理服务层 | 可插拔的治理能力集 |
| 核心内核层 | 所有项目共用的治理大脑 |
| 元数据层 | 先摸清家底，再谈治理 |
| 接入层 | 零侵入对接所有新老项目 |

## 入口层方案

入口层的原则是“用户在哪，治理能力就在哪”，但所有入口必须汇入同一套标准上下文和同一套执行语义。入口层不承载治理业务逻辑，只负责接收请求、标准化上下文、鉴权、日志、路由和结果回传。

### Entry Context 标准

项目启动第一周先稳定 `Entry Context` JSON 标准。Web / Desktop、IDE 插件、CLI、CI 和 API 都必须产生同一种上下文结构，Gateway 和解析层也只接收标准结构，不再为每个入口写一套分支逻辑。

机器可读 schema 见 `schemas/entry-context.schema.json`。

最小字段：

```json
{
  "schemaVersion": "project-os.entry-context.v0.1",
  "entry": "desktop",
  "mode": "readonly",
  "intent": "check",
  "actor": {
    "type": "user"
  },
  "project": {
    "path": "."
  },
  "request": {
    "id": "local-check-001",
    "createdAt": "2026-07-09T00:00:00Z"
  }
}
```

### Gateway 职责

Gateway 必须补齐完整职责：

- 统一鉴权，识别调用者和入口来源。
- 参数标准化转换，把 Web 表单、CLI flags、CI env、IDE 上下文和 API body 转成 `Entry Context`。
- 日志链路，给每次请求分配 request id，并贯穿 Gateway、CLI 内核、报告和 patch 草案。
- 限流，避免 CI、自动化或外部 API 重复触发高成本治理动作。
- 异常封装，将底层错误归一为可展示、可记录、可复测的错误对象。
- 路由分发，只按标准上下文选择治理动作，不让下层内核感知入口差异。

下层核心只接收标准上下文，不读取 Web / CLI / CI 的私有参数。

### 统一真相源

本地、CI 和 Desktop 的项目治理状态统一以 `.project-os/` 骨架目录为读写唯一真相源。`PROJECT.md`、`HANDOFF.md` 和桌面 UI 是展示层或交互层，不能绕过 CLI 直接写入机器状态。

当前最高优先级状态源：

- `.project-os/state.json`：项目名称、阶段、架构摘要和当前状态的机器主源
- `schemas/project-state.schema.json`：状态结构契约
- `.project-os/state-bundles/*.json`：CI / 本地回流使用的轻量状态包

原生 CLI 提供：

```bash
project-os state sync .
project-os state sync . --set phase=stabilizing --set stage="Console 内核收口"
```

约束：

- 所有端写入 `.project-os/state.json` 必须走 `project-os state sync` 或后续同等 Rust CLI/core API。
- 写入前必须校验 `schemas/project-state.schema.json` 对应约束。
- 写入时复用 `.project-os/locks/project-os.lock`，避免多端并发覆盖。
- 写入完成后生成 `.project-os/state-bundles/*.json`，作为 CI 和本地 Desktop 回流的骨架产物。
- 前端只读渲染本地 JSON；任何变更请求转发给 CLI/Core 作为唯一写入通道。

### Desktop 对话上下文链路

Desktop 对话遵守“前端采集、核心组装、模型回答、工作台执行”的单向数据流：

```txt
chat turns + dialogue context state
-> Tauri chat command
-> local project evidence assembler
-> grounded answer contract
-> message references / existing task actions
```

边界：

- 前端保存最近对话，并提取当前话题、上一轮结论、待回答问题、用户委托和下一预期动作。
- Tauri 核心按当前项目组装阶段、目标、任务、Git 变更、验收报告和治理文件证据；浏览器预览使用同字段的只读降级数据。
- 模型只能基于传入证据回答；证据不足时标记为推断，不能要求用户重复已有上下文。
- 文件和任务引用由本地核心生成并验证，不采信模型凭空生成的路径；点击引用复用现有文件预览和任务工作面。
- 普通问答不展示 Agent 步骤时间线；只有任务执行、进行中或失败事件显示过程状态。
- “那怎么办 / 你判断 / 直接修”等短追问继承当前话题；进入任务时使用完整上下文生成计划，但任务标题保持用户可读的原始话题。

### Conversation Runtime

Desktop 对话不再由页面组件直接决定意图、状态和动作。`desktop/src/conversation-runtime/` 是对话执行语义的唯一运行时边界：

对话表现层允许使用 `assistant-ui` primitives，但只能通过 `desktop/src/lib/assistant-ui-adapter.js` 读取现有 turns。第三方 runtime 不拥有模型调用、项目事实、消息持久化或治理写入；当前 POC 仅在 `?conversationUi=assistant` 下动态加载，默认对话仍使用现有渲染器。阶段目标等领域消息映射为类型化 tool part，工具动作继续回到 OmniDesk Conversation Runtime 执行。输入区继续复用 OmniDesk `ChatComposer`，保证附件、模型选择、语音、发送和停止交互不因第三方表现层发生变化。

```txt
Conversation UI
-> Conversation Runtime
   -> State Machine
   -> Intent Router
   -> Action Orchestrator
   -> Projector
   -> Store
-> Task / Check / Patch / Fact services
```

职责：

- `contract.js`：稳定状态与命令枚举。
- `state-machine.js`：只根据 turns、pending action、loading 和 active task 推导运行状态。
- `intent-router.js`：统一普通问答、项目查询和任务意图分类。
- `action-registry.js`：维护动作白名单，并把明确动作请求解析为 `mode / action / risk / confirmation` 决策。
- `action-executor.js`：通过注入的计划、Patch 和检查 adapter 执行动作，统一生成进度事件、请求终态、诊断、按钮和 pending action；意外异常也必须收口为可恢复失败 turn。
- `workbench-adapters.js`：把 Workbench 注入的计划生成、任务动作和请求活性检查转换为 Action Executor 的稳定 adapter 契约，不持有 React 状态或执行结果投影规则。
- `takeover.js`：在请求运行期间把新输入解析为停止、继续当前请求或新要求接管；它只决定语义，不执行取消或启动副作用。
- `capabilities.js`：定义浏览器与桌面共用的受控检查能力、命令、依赖路径和确认策略。
- `orchestrator.js`：把短回复、当前 pending action 和 Action Decision 解析为结构化命令。
- `projector.js`：把动作结果投影为稳定对话消息，不执行副作用。
- `event-contract.js`：定义 `omnidesk.conversation-event.v0.1` 统一事件语义，将旧执行投影映射为带 `requestId / taskId / sequence / phase / status` 的不可变事件，并按稳定事件 ID 合并。
- `store.js`：消息追加、提交去重和持久化前规范化。
- `summary.js`：把最近窗口之外的 turns 归纳为稳定结构，保存主题、结论、约束、决策、执行结果、未决问题和 pending action；短追问只能继承摘要主题，不能覆盖它。

约束：

- React 组件只采集输入和渲染结果，不重新实现意图规则。
- 助手动作承诺必须对应 pending action；短确认只消费当前动作。
- 执行服务负责副作用，Projector 只生成消息。
- 对话消息、任务和执行结果继续共享 `requestId / taskId`。
- 新对话行为先在 Runtime 增加纯函数测试，再接入 Workbench。
- Controller 负责 submission、request、user turn 和 command 的标准化与命令分派；Workbench 仅注入 provider、task、navigation 和 persistence adapters。
- Workbench 的 Action adapter 组装必须经过 `createConversationActionAdapters`；页面只提供依赖和当前请求活性判断，不展开 `generate-plan / generate-patch / run-check` 的 payload 映射。
- Action Registry 是动作白名单与 handler 分派入口，页面不得再按 Action ID 扩展条件链。
- `generate-plan / generate-patch / run-check` 的结果投影由 Action Executor 统一负责；Workbench 不判断具体 Action ID，只提交上下文、显示进度并持久化 executor 返回的 turn。
- 明确能力请求必须先进入 Action Decision，不得先压成笼统 `task`；`confirmation: none` 的只读能力直接进入 executor，只有需要用户决策的动作才生成 pending action。
- `generate-plan` 是只读计划动作：“生成计划 / 制定方案 / 拆解任务”等明确请求直接生成并耐久保存计划，不先经过通用聊天或依赖助手承诺文本；计划完成后只为后续执行生成 `confirm-active-task`。
- 计划待确认 turn 必须携带 `taskId`，Workbench 在同一条对话中投影执行步骤、读取范围、候选改动、验收标准和边界风险；确认动作先校验当前模型可用性，再把任务推进到执行工作面，不能在确认动作中隐式写入文件。
- `run-check` 是第一条纵向样板：“运行一轮基础检查”直接调用白名单 Runtime 检查，不创建计划任务，检查事件与结果按同一 `requestId` 回流对话。
- `generate-patch` 是只读草稿动作：明确修改请求自动完成上下文读取、只读计划、任务持久化和 Patch Draft 生成；Preview 只返回 `PATCH_DRAFT_PENDING` 占位草稿，不能提供写入动作。
- `apply-patch` 是写文件动作：只有 Patch Draft 通过 unified diff 可应用性校验时才生成 pending action；Rust 执行层只用 trim 判断空草稿，传给 `git apply --check/apply` 的 diff 必须保留原始字节和末尾换行。按钮确认和文字确认调用同一 Apply executor，并把 Apply、逐项验证和终态继续投影到原 `requestId`；校验失败需把原因耐久写入 `task.applyResult`，Apply 已成功后的验证异常必须保留成功的 Apply 证据并写入 `task.verificationSummary`。
- `desktop/src/lib/patch-apply-executor.js` 负责前端 Apply、验证、run summary 和任务持久化编排，只依赖注入的 command 与存储 adapter；React 层只维护 loading、error 和全局 action feedback，不再投影任务终态。
- `desktop/src/lib/patch-draft-executor.js` 负责只读 Patch Draft 生成、请求活性校验和任务耐久持久化；被新方向取代的迟到成功或异常都不得写入任务，React 层只维护草稿 loading、error 和 feedback。
- `desktop/src/lib/plan-executor.js` 负责只读计划的本地预览、远程 provider、15 秒超时、本地确定性 fallback、旧参数兼容、请求终态和任务耐久持久化；React 层只创建 request、注入项目相关 adapter 并维护 loading/error/feedback。
- `desktop/src/lib/guarded-check-executor.js` 负责白名单 Check command 的结果/异常标准化，以及任务 run、终态和对话 update 的投影；它只接收已由 `guardedCheckCapability` 解析的能力，不注册或扩大可执行命令。
- `desktop/tests/executor-boundary.test.mjs` 是 Workbench 执行边界的可执行守卫，禁止 provider fallback、任务终态投影、Check 异常结构和 capability 别名回流到 `main.jsx`，并确认所有已抽离 workflow 仍被生产入口使用。
- Conversation Runtime v0.3 使用 `schemas/conversation.schema.json`；旧记录加载时补齐 `project-os.turn-summary.v0.1`。模型请求只携带结构化早期摘要和最近 8 条原文，UI 历史仍完整保留；处于 thinking/executing 的中断记录恢复为 failed 并保留 `recoveryReason: interrupted`。
- Conversation Event Contract 使用 `schemas/conversation-event.schema.json`。当前 Projector 在保留旧 `events / outcome / text` 的同时写入 `conversationEvents[]`，默认渲染器、assistant-ui adapter 和持久化可渐进消费同一语义。只有在新旧投影对等验证后才能删除旧字段。
- Desktop 模型请求以 `requestId` 在前端、Tauri 和 Conversation Event 间关联。聊天优先请求 OpenAI-compatible SSE，并把 `model.started / model.delta / request.completed` 推送到 `runtime://conversation-event`；不支持 SSE 的 gateway 自动回退整段 JSON 响应。停止会调用 `cancel_runtime_request`，通过本地 CancellationToken 中断 in-flight HTTP future 并发送 `request.cancelled`，不是只在前端忽略迟到结果。只读计划和 Patch Draft 沿用同一取消注册表；Patch Draft 的 Hermes ACP worker 在等待 JSON-RPC 响应时每 200ms 检查取消信号，随后 kill 子进程。Apply 保持显式确认、同步完成的写入边界，终端命令可由终端会话的停止动作实际终止；尚未开放流式写入。
- 执行事件按 `requestId` 更新已有 assistant turn，同一请求不追加多条过程消息。
- 请求运行期间输入“停止”会取消当前 `requestId`，输入“继续原任务”只保留当前请求；其他新输入会先使旧请求失效，再创建新 `requestId` 接管。所有异步回流和 Patch Draft 持久化都必须校验请求仍然 active，旧请求的迟到结果不得覆盖新方向。
- 应用重启恢复 thinking/executing 记录时，旧 pending action 会被标记 resolved 并从摘要清除；恢复消息提供“重试”，已有 `taskId` 时同时提供“查看任务”，而不是只显示不可操作的失败状态。

Executor 收口清单：

- Executor 必须负责：provider fallback/timeout、命令异常标准化、任务状态与 run 投影、耐久持久化、run summary、迟到结果拒绝。
- Workbench 可以负责：创建 requestId、维护 active ref、loading/error 状态、应用 action feedback、注入 Tauri/Preview command 和把 executor 返回的 conversation update 写入 turns。
- Workbench 不得负责：按 Action ID 复制业务分支、重新判断成功终态、拼装 Apply/Check 失败任务或绕过 capability 白名单。
- 普通聊天被识别为任务后也必须构造注册的 `generate-plan` Action，并通过 Conversation Action Executor 返回单一 turn；页面只能应用 executor 的 progress、requestStatus 和 turn，不得维护第二套成功/失败 Promise 投影。
- 当前 Plan/Patch/Apply/Check 的执行策略收口已完成；后续新增动作必须先扩 Action Registry、executor 和纯函数测试，再注入 Workbench。

### CLI 复用架构

CLI 是入口层的能力内核，不只是给开发者手敲命令的工具。

```txt
本地离线场景：用户直接调用 CLI 二进制执行
Web / CI 在线场景：调用 Gateway 标准接口，接口内部复用 CLI 内核逻辑
```

当前最小统一入口已经落在 `scripts/ai-project.sh`，但它只是过渡形态：

```bash
bash scripts/ai-project.sh scan .
bash scripts/ai-project.sh check .
bash scripts/ai-project.sh report .
bash scripts/ai-project.sh recommend .
bash scripts/ai-project.sh run .
```

这些命令会先写入 `.project-os/entry-contexts/*.json`，再复用 `check-ai-project.sh`、`recommend-next.sh` 或 `project-runner.sh` 执行治理动作。

Shell 入口的定位：

- 用于快速验证 Entry Context、报告、推荐和 run record 的统一语义。
- 用于保持现有 `core` profile 轻量可分发。
- 不作为长期 Gateway、CI、Desktop 联动的最终底座。
- 每次生成 Entry Context 后立即做基础校验，避免等全量自检才发现上下文字段错误。

Shell 入口的长期限制：

- Windows 原生 `cmd` / PowerShell 兼容性弱，常依赖 Git Bash / WSL。
- 参数、日志、异常错误码缺少全局统一类型系统，容错脆弱。
- 进程间调用接口不足，Desktop / Gateway / CI 只能通过文件和 shell 进程间接协作。
- 复杂路由、鉴权、限流、结构化日志和错误封装会逐渐超出 Shell 适合承担的边界。

长期目标是抽出一层原生 CLI 程序和可复用 library core。Shell 脚本保留为兼容 wrapper，原生 CLI 承担标准上下文解析、命令路由、结构化日志、错误码、跨平台文件操作和执行调度。

### Native Core 迁移契约

迁移不以“把 shell 翻译成 Rust”为目标，而以统一可调用的 typed operation 为目标。后续 `cli`、Desktop、Gateway 和 CI 只能调用以下 core 边界，Shell 在迁移期仅做参数适配：

```txt
WorkspaceScanner      -> 读取受限工程证据，生成 observation
FactWriter            -> 校验并写入事实投影及 freshness
RecommendationEngine  -> 基于事实生成建议，不直接修改工程
GuardedRunner         -> 执行白名单动作，返回结构化 run record
ReportGenerator       -> 从事实与 run record 生成报告
```

- 每项 operation 必须接收 `EntryContext`、返回版本化 JSON 和稳定错误码；调用者不得解析 shell 文本来判断成功或失败。
- `WorkspaceScanner` 只产生 observation；`FactWriter` 才能更新 `.project-os/workspace-facts.json`，并记录 `source / observedAt / hash / freshness / confidence / invalidation`。
- 项目文件、`.project-os/state.json`、用户配置仍是各自 SSOT；Fact Store 是可重建投影，模型只能提出解释或建议，不能直接覆盖本地事实。
- Desktop 负责展示、确认和 request lifecycle；CLI/Core 负责本地事实、受控执行和持久化语义；CI 复用 Core 返回的结构化结果，不重写扫描或规则判断。
- 每迁移一个 operation，必须保留一段 dual-run 对比期：同一输入比较 shell adapter 与 Core 的事实/结果，差异显式记录，确认对等后才删除对应 shell 业务逻辑。

当前原生 CLI 起点位于 `cli/`，可用命令：

```bash
cargo run --manifest-path cli/Cargo.toml -- context .
cargo run --manifest-path cli/Cargo.toml -- report . --runtime-root .
cargo run --manifest-path cli/Cargo.toml -- scan . --runtime-root .
cargo run --manifest-path cli/Cargo.toml -- context . --trigger-source desktop --output json --persist none
cargo run --manifest-path cli/Cargo.toml -- report . --runtime-root . --output report --persist none
```

其中 `context` 完全由原生 CLI 写入 Entry Context；`scan` / `report` / `recommend` / `run` 当前仍委托 legacy shell runner，后续再逐步迁入 core library。原生 CLI 支持 `--trigger-source` 标记执行来源，支持 `--persist auto|none|full` 控制是否落盘，支持 `--output json|report` 输出 `project-os.cli-result.v0.1` 结构化结果，供 Desktop / Gateway / CI 直接捕获；`report` 输出模式会把已生成的机器可读报告内嵌进 stdout，避免调用方再二次读取本地 JSON。

本地运行配置由用户全局 config 和仓库 `.project-os/config.json` 共同承载，schema 位于 `schemas/project-os-config.schema.json`。当前配置包括 CLI 默认输出模式、默认持久化策略、写入锁开关、陈旧锁超时和历史产物保留数量。用户可通过 `project-os config init --global` 初始化全局配置模板。配置优先级固定为：命令行参数 > 仓库 `.project-os/config.json` > 用户全局 config > `PROJECT_OS_*` 环境变量 > 内置默认值。写入型入口会创建 `.project-os/locks/project-os.lock` 防止多个 Project OS 进程并发覆盖产物；启动时会按 `staleLockSeconds` 自动清理超时残留锁，也可用 `--stale-lock-seconds` 做单次覆盖。结构化 stdout 会输出 `config.values` 和 `config.sources`，用于诊断配置覆盖和冲突。

脚本目录开始按用途分层：

```txt
scripts/exec/       执行入口 wrapper
scripts/validate/   校验入口 wrapper
scripts/cleanup/    清理入口 wrapper
```

根 `scripts/*.sh` 旧路径继续保留为兼容入口，新增调用优先走分层目录。

目标形态：

```txt
project-os CLI binary
  -> parse Entry Context / flags
  -> call Project OS core library
  -> emit structured logs / reports / patches / run records

scripts/ai-project.sh
  -> compatibility wrapper
  -> delegates to project-os binary when available
  -> falls back to legacy shell flow during migration
```

约束：

- 命令行语义和 API 语义必须一一对应。
- Web / CI 不另写第二套治理逻辑。
- CLI 能离线本地执行，断连平台时仍能扫描、检查、生成报告和输出修复草案。
- 新增治理能力必须同时实现 CLI 命令、Gateway 标准接口和 CI 自动化适配。
- 新增复杂治理能力不得只落在 Shell 脚本里；新增命令和业务逻辑必须先落在 Rust CLI / core library，Shell 只做参数透传和兼容 wrapper。

### 三端数据闭环

CLI、CI 和 Desktop / Web 必须共享同一批治理产物：

- CLI / CI 生成的 report、patch、修复草案自动同步到 Desktop / Web 可查看区域。
- Desktop / Web 可以统一查看本地、CI 和自动化治理记录。
- CI 产生的修复建议必须支持页面审核，不直接静默写入项目。
- 所有治理记录都要能追溯入口、请求、上下文、执行结果和人工确认状态。

### API 分层

API 拆为两层，避免把内部全量能力直接暴露给外部调用方。

| API | 用途 | 暴露范围 |
|-----|------|----------|
| 内部服务 API | Desktop / Web / CI / IDE 复用完整治理能力 | 全量能力，仅内部三端使用 |
| 对外开放 API | 外部系统稳定集成 | 仅稳定原子能力，严格版本化 |

对外开放 API 不承诺内部编排细节，只提供稳定能力，例如 `scan`、`check`、`recommend`、`report`。

### 零侵入和降级

入口层默认零侵入：

- 不强制改目录结构。
- 不强制替换构建工具。
- 不要求必须嵌入配置文件。
- 默认只读扫描；写入必须走 patch / MR / PR / 用户确认。
- CI 默认只检查和报告，不静默修复。

离线和降级能力：

- CLI 支持本地缓存规则包。
- 断连平台时可独立运行检查、推荐和报告。
- CI 支持本地输出离线报告。
- Gateway 不可用时，不影响本地 CLI 的基础治理能力。

### 新能力准入

新增任何治理能力必须同时满足：

```txt
CLI 命令可执行
Gateway 标准接口可调用
CI 自动化可适配
离线本地执行可降级
治理产物可被 Desktop / Web 查看和审核
```

不满足这些条件的能力只能作为实验能力，不进入入口层正式能力集。

## 仓库实现层次

```txt
1. 规则入口层：AGENTS.md / docs/ROUTING.md / adapters
2. 项目状态层：PROJECT.md / HANDOFF.md / .project-os/state.json
3. 工程文档层：docs/*
4. 工具脚本层：scripts/*
5. 模板分发层：templates/project/*
6. 本地生成物层：.project-os/reports/* / .project-os/graph/*
7. 桌面工作台层：desktop/* / Local Agent Core / Workbench UI
```

### 工作区资产边界

仓库中的文件按所有权和可再生性分层，而不是按是否以点号开头判断：

| 类型 | 位置 | Git 策略 | 工作台默认展示 |
|------|------|------|------|
| 工程与分发资产 | `desktop/`、`cli/`、`scripts/`、`schemas/`、`tests/`、`docs/`、`templates/`、`adapters/` | 版本化 | 展示 |
| 治理事实 | `.project-os/state.json`、目标、任务、项目事实 | 按项目明确版本化 | 通过治理工作面展示 |
| 本机运行状态 | `.project-os/events/`、`transactions/`、`locks/`、Provider 与桌面偏好 | 忽略 | 隐藏 |
| 可再生产物 | `dist/`、`target/`、`node_modules/`、`tmp/`、报告与扫描产物 | 忽略 | 隐藏 |

文件树、扫描计数与浏览器 Preview 必须共享这套默认隐藏边界：隐藏不等于不可恢复或不可审计，Project OS 的目标、任务和运行证据通过对应治理工作面访问。运行历史清理只允许处理已终态事务和超过保留数量的生成物；`prepared` 事务必须保留，以便 Repository 在下次启动时恢复。

## 运行路径

### 检查路径

```txt
scripts/check-ai-project.sh
-> 扫描已有文件
-> 按系统规则 / 环境 / 用户意图 / 项目文件 / 工具反馈 / 交接摘要评分
-> 输出完整度报告
```

### 关系图路径

```txt
scripts/build-project-graph.sh
-> 扫描核心文档、脚本、schema、模板和 AI 资产
-> 识别文件节点、层级、SSOT 标记、模板标记、引用关系和 .ai/rules 映射
-> 输出 .project-os/graph/project-graph.json
```

关系图只做静态结构分析，不调用 LLM、不联网、不取代人工 review。

### 安装路径

```txt
scripts/install-project-os.sh
-> 选择 profile
-> 从 templates/project 复制模板
-> 备份冲突文件
-> 写入 .project-os/version 和 state.json
```

### 同步路径

```txt
scripts/sync-templates.sh
-> 将可分发 runtime 同步到 templates/project

scripts/check-template-sync.sh
-> 检查源 runtime 与模板是否漂移
```

### 桌面端路径

```txt
desktop/*
-> Tauri shell 加载 Workbench UI
-> Local Agent Core 读取项目 registry / .project-os / 本地文件
-> 受控调用模型 provider、Project OS 脚本、git diff 和记忆写回
-> UI 展示计划、日志、diff、检查结果和交接状态
```

桌面端不绕过 Project OS 现有脚本和文档治理。模型接入、文件写入和命令执行必须经过 Local Agent Core 的权限边界。

## 模块职责

| 区域 | 职责 |
|------|------|
| `AGENTS.md` | AI 行为规则和文档边界 |
| `docs/ROUTING.md` | Project OS 路由细则和固定第一响应 |
| `PROJECT.md` | 当前项目状态 |
| `HANDOFF.md` | 当前交接摘要 |
| `docs/` | 工程规范、架构、测试、命名、决策 |
| `scripts/` | 安装、检查、同步 |
| `templates/project/` | 安装到目标项目的干净模板 |
| `adapters/` | Claude / Codex / Cursor / Gemini 适配 |
| `.claude/` | Claude Code 参考实现 |
| `.project-os/graph/` | 本地生成的项目关系图 |
| `desktop/` | 后续 Tauri 桌面端壳和 Local Agent Core |

### 工作区能力模型

工作区采用“统一路由注册表 + 完整能力注册表 + 项目级启用状态”，不再把固定菜单树或页面标题视为导航事实。

```txt
完整能力注册表
-> 项目能力清单（available / detected / recommended / enabled / dismissed）
-> 扫描信号 + 用户意图 + 当前阶段
-> 当前项目可见工作面
```

`desktop/src/workspace-route-registry.js` 是菜单和工作面的路由 SSOT。一级菜单、二级菜单和叶子页都必须登记稳定 `id / path / parentId / surface`；叶子功能通过 `owns` 声明唯一所属页，通过 `linksTo` 引用其他页。菜单树、Tab、页面渲染和程序化跳转只传 `routeId`，不得使用中文标题兜底。注册表测试必须拒绝重复 ID、重复 path、重复 feature owner、漏登记菜单和失效链接。

页面职责遵守“一个功能一个 owner”：聚合页只展示摘要和跳转，不复制所属页的编辑、详情或执行能力。例如 `当前进度` 只回答当前里程碑、当前目标、目标阶段、验收状态、项目风险和唯一下一步；项目进度不得由任务完成数计算。生命周期阶段归 `项目概览`，任务详情归 `当前任务`，完成记录归 `执行结果`，风险详情归 `风险边界`。

纯分组路由不得声明 `owns` 或渲染同名页面。`设计实现 / 界面规范` 是分组路由，唯一叶子 owner 为 `design-tokens` 和 `component-library`；具体 Token 分类和组件条目留在各自页面内部目录，不注册为全局菜单。组件页的源码动作只链接到 `工程文件`，不复制文件预览职责。

能力模型分成两层：

- `workspaceCapabilities`：目标、规则、设计、验证、记忆、Agent 等 OmniDesk 工作面。
- `domainCapabilities`：前端、后端、数据库、桌面端、CLI、AI、测试、部署等项目领域。
- 领域能力描述“项目拥有什么”，工作区能力描述“用户用什么页面治理它”；两者通过映射关联，不能混成同一组菜单状态。
- 旧版 `capabilities` 暂时作为 `workspaceCapabilities` 的兼容别名，完成迁移后再移除。
- `schemas/fact-freshness.schema.json` 与 `.project-os/fact-freshness.json` 记录关键事实源指纹；snapshot 只报告新鲜度和变化来源，项目概览仅在 stale 时触发后台扫描。手动更新是强制刷新兜底，不是日常维护前提。
- 桌面 watcher 监听关键事实文件与 `src / server / backend / api / prisma / migrations / tests / workflows` 等领域目录，并沿用事件防抖；浏览器预览通过 30 秒轻量 snapshot 轮询发现 stale。两端最终进入同一事实刷新语义。

### 事实与插槽契约

- `schemas/project-fact.schema.json` 定义标准事实、来源角色、可信状态和新鲜度。
- `schemas/workspace-slot.schema.json` 定义页面区域、顺序、Selector、组件白名单、显示条件和事实依赖。
- `schemas/fact-event.schema.json` 固定 `source.changed -> fact.invalidated -> fact.updated -> selector.recomputed -> slot.updated` 事件链。
- `schemas/project-overview-contract.v0.1.json`、`project-progress-contract.v0.1.json` 和 `project-runbook-contract.v0.1.json` 分别定义项目概览、当前进度和启动方式的事实归属与 Slot Registry。当前进度读取里程碑、当前目标、目标验收、验收报告和项目风险，不依赖任务队列或 backlog。启动方式读取说明摘要、扫描命令和当前工作目录，只展示启动入口并将命令预填到 `执行终端`；构建、测试和治理检查由任务执行链路按计划自动运行，结果归 `执行结果`。
- `desktop/src/project-overview-contract.js` 提供启动前可复用的契约校验，拒绝重复 ID、未知 Selector、未知组件、未知事实依赖和错误事件顺序。
- `desktop/src/fact-source-adapters.js` 将 registry、state、profile、package/Cargo、workspace facts、运行时任务和 freshness 转换为标准候选事实；Fact Store 是可重建投影，不替代这些来源的 SSOT 地位。
- `desktop/src/fact-store.js` 统一记录选中值、全部候选证据、冲突、可信度和新鲜度；项目概览、当前进度和启动方式已停止在 React 内重复派生业务数据。
- 纯 Selector 将 Fact Store 转为可序列化 ViewModel；组件只负责显示和本地交互，不读取文件或重新判断事实优先级。
- `desktop/src/slot-runtime.js` 按 Contract 解析 Selector、组件、Action、能力与模块门控，建立 Fact 到 Slot 的依赖索引，并只重算事实变化影响的 Slot。
- 浏览器 Preview 与 Tauri snapshot 可以使用不同 Source Adapter，但必须产出同一 Fact/Selector/Slot 语义；跨运行面差异在 acceptance test 中拦截。

- `schemas/project-capabilities.schema.json` 定义两层项目能力状态契约。
- `.project-os/project-capabilities.json` 保存当前项目的能力状态和识别证据。
- `project-overview / tasks / files` 是固定核心能力；其他能力可以随项目成长启用。
- 隐藏能力不等于删除能力或数据，重新启用后恢复原有状态。
- 只改变可见工作面可以自动完成；创建目录、安装依赖或修改配置仍需用户确认。
- `desktop/src/workspace-route-registry.js` 负责路由、页面 surface 和功能唯一归属；`desktop/src/workspace-outline.js` 负责菜单文案、层级展示和能力映射，并引用注册表 route，不成为路由或项目状态 SSOT。
- 左侧“更多能力”始终可打开完整能力入口；启用动作只更新项目能力状态并刷新工作面，不创建目录、不安装依赖。涉及工程结构变化时必须进入单独的方案确认流程。
- snapshot 会用目标、规则、源码/架构、测试、记忆和模型配置等可解释文件信号推导能力状态；扫描只在内存中提升 `available -> detected / recommended`，不自动改写 manifest，也不能覆盖用户已启用或已忽略状态。主菜单只显示 `enabled`；`detected / recommended` 在“更多能力”中展示用途和证据，由用户决定启用或暂不需要。

## 边界

- 源仓库可以保留完整能力。
- 目标项目默认只安装必要文档。
- 已有文档默认不覆盖；需要更新时先备份或生成建议。
- AI 规则不依赖单一平台自动触发。
- 桌面端可以读写本地项目，但必须通过受控工具、diff review 和检查闭环。

## 兼容说明

`docs/CODE_STRUCTURE.md` 仍保留，用于描述代码目录职责。
新项目优先阅读本文件理解整体架构。
