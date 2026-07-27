---
layer: knowledge
type: spec
last_verified: 2026-07-26
teaches: "OmniDesk Desktop Runtime 的测试分层、发布证据和验收边界"
use_when: "AI 要写测试、验收桌面运行时或判断改动需要哪些发布证据时"
---

# 测试与偏离检查

> 用途：定义测试方法、验收重点和偏离检查方式。
> 什么时候更新：测试策略、验收标准、复测命令或测试分层变化时。
> 不要写什么：当前项目状态、当前交接、长期产品路线图。
> 这份文档回答的是：怎样判断项目没有漏填、助手没有跑偏、产品规划没有偏离、设计和代码改动有基本验证。
> 它不是要求所有项目一开始就上完整测试体系，而是给不同阶段一个轻量检查框架。

---

## 测试分层

### 1. Runtime 健康检查

目标：确认 OmniDesk Runtime、状态契约和基础文档没有跑偏。

检查项：
- `AGENTS.md` / `PROJECT.md` / `HANDOFF.md` 是否存在
- `README.md` / `INSTALL.md` / `docs/*` 是否符合当前安装 profile 的边界
- `PROJECT.md` 是否写清项目定位、当前架构和当前进度
- `HANDOFF.md` 是否写清当前状态、风险和下一步
- `project-setup` references 是否存在：`init.md` / `audit.md`
- `docs/PRODUCT_PLAN.md` 是否写清近期目标和本阶段不做事项
- 项目特殊用户偏好是否写入 `HANDOFF.md` 或 `PROJECT.md`，而不是散落在旧模板文件里
- 是否还残留大量 `{{...}}`、无解释的 `TODO`、`.DS_Store`

推荐命令：

```bash
bash tests/run-tests.sh
npm --prefix desktop run test:native
```

`tests/run-tests.sh` 是本地完整回归入口，覆盖文档契约、Desktop Node、Web build、bundle 预算、离线 Eval 基线和 Runtime Rust 测试。`test:native` 是独立的原生窗口 smoke；它不能用浏览器 Preview 或离线测试替代。

### 2. Agent 交互契约

目标：确认对话、任务和受控执行遵守同一个 Runtime 状态机，而不是把 Provider 响应直接当作任务完成。

检查项：
- 对话的取消、接管和迟到结果不会覆盖当前 request。
- Patch 草稿必须通过授权文件、路径、hunk 与上下文校验。
- 工程写入和检查各自等待独立审批。
- 检查失败只在同一任务内产生有界修复草稿，达到上限后保留失败证据。
- Preview 对写入、终端、检查与恢复始终只读拒绝。

对应回归位于 `desktop/tests/*.test.mjs` 与 Runtime Rust 测试；真实模型、网络中断和原生重启证据只在隔离 fixture 与受保护 Eval 中验收。

### 3. 产品规划偏离检查

目标：确认当前任务仍服务于项目阶段目标。

检查项：
- `HANDOFF.md` 的“下一步”是否能对应 `docs/PRODUCT_PLAN.md` 的近期优先级
- `PROJECT.md` 的“当前范围”是否能覆盖近期规划里的任务
- `docs/PRODUCT_PLAN.md` 的“本阶段不做”是否没有被放进当前下一步
- 如果临时改变优先级，是否在 `HANDOFF.md` 或 `docs/DECISIONS.md` 说明原因
- 如果跨层改动较大，是否更新 `docs/CHANGELOG.md`

### 4. 设计一致性检查

目标：防止 UI 越改越散。

检查项：
- UI 改动前是否读取 `docs/DESIGN_STANDARDS.md`
- 新增组件是否登记到 `docs/design/component-index.md`
- 新增颜色、间距、圆角是否优先复用 token
- 可点击元素是否有 hover 状态
- 链接和按钮是否有 focus-visible 状态
- 是否避免重复造已有 primitive / pattern

### 5. 代码测试策略

目标：让真实业务代码有和风险匹配的验证，而不是只有文档。

建议：
- 纯函数、格式化、解析、权限判断等逻辑优先写单元测试
- React / Vite 项目可用 Vitest + React Testing Library
- 关键用户流程可用 Playwright 或浏览器手测清单
- Supabase / API 请求至少验证成功、失败、loading 三种状态
- UI 改动至少记录手测结果；高风险 UI 流程建议补截图或端到端测试

### 6. 可执行回归测试

目标：把源仓库维护者原本手动做的检查收进一个可重复入口。

推荐命令：

```bash
bash tests/run-tests.sh
```

当前覆盖：

- tracked 状态与文档结构 JSON
- frontmatter、文档结构与密钥安全
- Desktop Node 契约回归
- Web build 与 800 KiB 首屏预算
- 离线已登记 Agent Eval 基线结构与不回退检查
- Agent Run checkpoint 与审批恢复的离线契约证据
- Tauri Runtime Rust 与 Patch Normalizer 回归

说明：该入口不执行旧 CLI、installer、模板分发、AI 工程报告、图谱或截图报告测试。原生窗口与真实 Provider 路径分别由 `test:native` 和受保护 Agent Eval 工作流覆盖。

### 7. Fact / Slot Runtime 验收

目标：确保浏览器 Preview 与 Tauri Desktop 虽然读取方式不同，但生成一致的事实和工作面。

检查项：
- 旧项目没有 capability manifest 时保持兼容。
- Runtime 与 Preview 只读取 active `.omnidesk/` 分区；旧 `.project-os/` 仅能由显式、幂等的迁移流程导入，不能作为普通读写回退。
- 任一迁移冲突必须阻止 namespace 激活；符号链接、路径逃逸和非授权状态目录不得进入新状态根。
- 旧目录退役预检必须拒绝未激活、漏迁、内容不一致或包含符号链接的状态；只有逐文件字节一致的已激活命名空间才可进入用户确认的清理流程。
- active 状态切换后产生的 legacy 历史差异必须通过独立确认动作归档到 `.omnidesk/evidence/legacy-retirement/`；归档只复制差异源文件与 manifest，不得删除 `.project-os/`。
- Desktop 与 Preview 的文件树、Agent 读取工具均不展示 `.project-os/` 或 `.omnidesk/` 物理目录。
- 父能力或模块未启用时，Slot 在 Selector 执行前被门控。
- Fact 变化只重算直接依赖的 Slot，其他描述符保持不变。
- 事件严格按 `source.changed -> fact.invalidated -> fact.updated -> selector.recomputed -> slot.updated` 输出。
- 项目概览、当前进度和启动方式 Contract 均能从同一个 Fact Store 编译。
- 浏览器与 Tauri 的等价输入得到相同关键事实和 ViewModel。

推荐命令：

```bash
npm --prefix desktop test
npm --prefix desktop run web:build
cargo check --manifest-path desktop/src-tauri/Cargo.toml
```

macOS 原生窗口 smoke 不使用官方 `tauri-driver`。它通过仅测试构建启用的嵌入式 WebDriver 驱动 WKWebView，并使用临时工作区，不能读取密钥或写入当前项目：

```bash
npm --prefix desktop run test:native
```

该命令验证原生窗口的 DOM/React 输入与发送状态，并从 active `.omnidesk/cache` 读取原生终端 trace。它还会读取 `omnidesk.tool-registry.v0.1`，断言四个内置工具的来源、只读风险、审批声明和封闭参数 schema；保存、读取、删除一个固定逐次审批的 MCP stdio 配置，并用 `/usr/bin/touch` 标记证明配置过程没有启动进程。随后通过真实 `Agent 配置 / 受控工具` 页面查看已批准发现的 `lookup` 工具，在 schema 表单填写 `docs` 创建独立调用审批，断言审批前 marker 不存在，再从页面批准执行并验证有界结果写回同 Run。后续还建立一条四文件授权的待审批 Agent Run，以及两个跨项目活动占用、一个同项目互斥队列和一个并发上限队列。该 Run 的模型阶段包含 `omnidesk.agent-event.v1` 标准事件；重启后必须保持 sequence 连续且只有一个 `awaiting-approval` terminal。活动项转为 `interrupted`、queued 不自动执行、Agent Run 与 Scheduler 状态一致并可显式取消，同时恢复原审批到 `awaiting-approval`。取消后的 Run 会通过原生 command 导出时间线，并断言 `omnidesk.run-timeline-export.v0.1` schema、聚合指标、`metadata-only` 策略及 prompt/observations/diff/思维链脱敏。它不把浏览器 Preview 当成桌面证据，不执行终端、检查、Patch 或模型请求；Provider 网络中断、真实第三方 MCP 与真实 usage/cost 链路由受保护 Agent Eval 的原始 trace 覆盖。

MCP 审批执行的 Rust 回归另使用带副作用 marker 的 stdio fixture：创建 `mcp_discover` Agent Run 后 marker 必须不存在；只有审批 token 被消费后才允许启动进程、发现工具并把有界结果写回同一 Run。该测试同时约束通用工具状态为 `running-tool`，不能复用检查的 `verifying` 语义。原生 smoke 先通过正式项目命令把夹具切为受控模式，再请求 MCP 发现并验证 Scheduler 已保留项目、审批仍为 pending、marker 不存在，最后取消 Run 释放项目。

同一原生 smoke 还会运行标准 initialize / `tools/list` / `tools/call` fixture：发现和调用必须分别消费两个 approval token；当前项目有效证据可通过只读投影展示，跨项目或配置变化的旧证据不得成为可调用能力；调用审批前 marker 不存在，审批后才出现，并校验有界 tool result。Rust 回归覆盖无发现证据拒绝、未知参数启动前拒绝、合法调用和 Server 配置变化导致旧证据失效。

### 8. CI 自动化检查

目标：把本地回归测试接入 GitHub，让 push 和 pull request 后自动复查。

CI 文件：

```txt
.github/workflows/ci.yml
```

当前覆盖：

- Desktop Node、Web build、bundle、原生 smoke、Runtime Rust 与离线 Eval 基线
- tracked state/manifest JSON、frontmatter、文档结构和密钥安全
- Desktop PR 校验 `desktop/evals/agent-eval-report.json` 完整覆盖已登记的 13 个基线 case，且任务成功率、Patch 可应用率、检查通过率不低于已提交基线。

说明：
- CI 与 `tests/run-tests.sh` 覆盖同一产品边界，但分别面向 GitHub 与本地执行环境；二者都不执行旧 CLI、installer 或 AI 工程报告链。

### Agent 真实评测

常规 PR 不读取模型密钥，只运行以下离线门槛：

```bash
npm --prefix desktop run check:agent-eval
```

`.github/workflows/agent-eval.yml` 在受保护的 `agent-eval` environment 中按日或手动运行。定时运行并行执行 `p1`、`p3`、`p4`、`suite` 四个独立切片；手动运行可选择 `all` 或单个切片，失败后可只重跑对应矩阵 job。每个切片上传独立 artifact，汇总 job 生成 `omnidesk.agent-eval-artifact-index.v0.1` 索引，记录本次 commit、切片、文件大小和 SHA-256，不把一个切片的成功冒充为其他门槛完成。

P1、P3 与 suite 需要 `OMNIDESK_AGENT_EVAL_KEY` secret，以及 `OMNIDESK_AGENT_EVAL_API_BASE`、`OMNIDESK_AGENT_EVAL_MODEL` variables；P4 不读取 Provider 密钥。P3 与 suite 固定安装带 `acp` extra 的 Hermes 版本，并在进入 Provider Eval 前校验 `hermes-acp --version` 与 `hermes-acp --check`；裸 `hermes-agent` 安装不包含 ACP 协议依赖，不能作为 Runtime Timeline 的执行环境。真实 Provider Eval 强制提供 `--trace-dir`：suite 会把 trace 复制到 `.omnidesk/evidence/agent-eval/<run-id>/suite/traces/`，并将 `results.json` 中的 trace 引用写成相对 artifact 路径。`goal-rebind` 必须证明四份授权文件均实际变更；`interrupted-run` 必须记录网络不可用分类、未接受 Provider 响应和恢复后的原审批；`ask-user-resume` 必须证明追问持久化、交互审批为零、回答后恢复同一 Run，并以独立审批完成 Patch。suite 还运行 `isolated-worktree` 真实证明：模型 Patch 必须先在临时 detached worktree 应用并通过检查，源工程在第二次审批前保持干净，批准 diff 必须与当前 worktree diff 完全一致，合并后源工程通过验证且 worktree 被清理。该证明不修改已提交基线，报告没有真实 trace 时不能替代任一门槛。

同一受保护工作流还必须运行 `eval:provider:function`：向当前 Provider 发送正式 `start_engineering_task` tools schema 与强制 tool choice，只有 HTTP 成功、返回可解析的 `task` 参数并明确提供输入、输出和总 token usage 才通过。生产对话必须使用同等参数门槛累计 SSE/非流式完整调用，拒绝缺失、非法、额外字段或重复的工程任务调用；不能只凭工具名创建计划。脱敏请求摘要、原始 Provider 响应、规范化 usage、耗时和 request id 保存为 `provider-function-calling.trace.json`；密钥不得进入 trace。Provider 未明确返回的 cost 保存为 `null`，不得自行估算。该证据独立于 Hermes 13-case Eval，不能用 Hermes 工具调用替代普通 Provider Function Calling 验收。

P3 另运行 `eval:provider:timeline`：只读任务必须经过生产 `agent_scheduler`、`agent_runs`、`hermes_execution` 和 Timeline 导出。只有 Run 为 `succeeded`、执行期间项目租约为 `running`、结束后 Scheduler 无残留、Timeline 为 `metadata-only`，且聚合后的输入、输出、总 token 均大于 0 才通过；usage source 必须是 `acp-response`。同一 Timeline 还必须保存真实 Hermes 产生的 `omnidesk.agent-event.v1`：sequence 从 1 连续递增，只能有一个 `succeeded` terminal，导出不得包含 `content` 或 `reasoning`。ACP 未返回 cost 时 Timeline 不应出现 `costUsd`。结果保存为 `provider-runtime-timeline.trace.json`，HTTP 层原始 usage 或未携带标准事件的成功结果不能替代这份 Runtime 聚合证据。

P1 compatibility 与普通聊天可靠性另运行 `eval:provider:fallback`。本地 relay 对生产 Runtime 的首次原生 tools 请求返回明确 `400 tools unsupported`，并只把第二次无 tools 请求转发给受保护环境中的真实 Provider；真实回答转换为 SSE 后保持连接至少 12 秒，证明旧前端墙钟不会重新出现。Runtime 必须持久化 `compatibility-keyword / explicit-tool-rejection`，第三次请求不得再次携带 tools；relay 随后注入中途断流，Runtime 必须返回非空 partial reply 和失败证据。trace 只保存请求是否包含 tools、真实 upstream 的状态/usage/字符数、时长和 Runtime 状态，不保存 Prompt、回答正文、密钥或临时路径。

工作流还会在临时目录安装固定版本与 integrity 的官方 `@modelcontextprotocol/server-filesystem`，并运行 `eval:mcp:third-party`。脚本会复核实际安装记录的 integrity 和入口文件，再经生产 `mcp_runtime -> agent_scheduler -> agent_runs -> execution` 完成 `tools/list` 与 `list_directory`。通过条件包括：发现和调用使用两个独立 approval token；审批前无工具结果或发现证据；等待审批时项目仍被 Scheduler 保留；结果包含夹具 `proof.txt` 且不超过 1 MiB；两个 Run 与 Timeline 均成功；Timeline 使用 `metadata-only` 脱敏；执行后 Scheduler 无残留。该测试不需要 Provider 密钥，但只有受保护工作流上传的 `third-party-mcp.trace.json` 才能作为 P4 外部验收证据。

---

## 收尾时最小检查

每次主要改动完成后，至少确认：

- 本轮改动是否还符合 `docs/PRODUCT_PLAN.md` 的当前阶段目标
- 如果改了 UI，是否符合 `docs/DESIGN_STANDARDS.md`
- 如果改了代码，是否运行了对应测试或说明为什么没跑
- 如果改变了下一步，是否更新 `HANDOFF.md`
- 如果形成新规则或踩坑，是否更新 `docs/LESSONS.md`
