---
layer: knowledge
type: spec
last_verified: 2026-10-20
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

P3 时间线另保存最多 256 条实时事件的单调时钟耗时（从模型执行入口开始）、序号、类型与状态，不保存参数、路径或正文。样本须与导出的 AgentEvent 逐项对应，数量和时间顺序完整且不超过总耗时；超过上限时保留总事件数，不把截断报告当完整过程。首个 lifecycle 在传输初始化后发出，因此它之前是准备/启动耗时，之后仍包含会话创建和模型处理，不能据此声称测得精确的网络推理时间。历史无计时报告不追认此证据。

当直连聊天失败而 Node 的独立简单请求成功时，验收 bin 可再以 Runtime 相同 HTTP 客户端发起同样的最小无源码请求；仅保存状态、分段/字节/正文字符计数和终态，期限 45 秒、最多 512KB。此为独立诊断，不能给原失败请求背书；用于区分客户端与请求参数的差异，禁止直接猜测归因为前端或服务商。

真实流式失败后允许额外发起一次固定无源码诊断请求，报告必须标明它是独立请求，仅记录 HTTP/SSE 类型、字节和片段计数、完成/错误/正文事件数量，不保存正文、密钥或上游错误内容；诊断成功不能改写原请求失败。时间线验收在模型执行 100 秒时取消并保存已捕获的工具事件与失败终态，外层 120 秒仅作进程组清理后备；超时必须明确标注，不能被编译警告替代，也不靠增加等待上限通过验收。

受保护 P3 增加 `eval:provider:timeline -- --readonly-files` 独立切片：随机标记只写入临时 `README.md`，不放进提示，Hermes 以 `ReadonlyPlan` 的原生只读工具策略执行。通过需同时满足原时间线/真实用量/调度收尾门槛、先请求再成功读取该文件的原始 AgentEvent、最终摘要准确包含标记、文件内容与目录项均不变。通用 metadata-only 时间线仍不导出路径；该验收只额外导出固定非敏感 `README.md` 的工具事件元数据。缺工具事件、猜测答案、只有开始/终态或文件变化均不通过。此切片仍待包含当前实现的受保护运行，不把本地校验器测试当成真实模型读取证明。

流式字节边界：Provider Core 验证每个 UTF-8 字节切点及逐字节传输，区分合法字符中的替换符、非法编码和末尾半个字符。聊天 Runtime 用本地真实 HTTP 分别将普通回复/续写的中文字和表情拆开，核对回调与最终正文完全一致；原生工具回复已显示后发生 HTTP body 截断，错误必须保留已见正文。原生 `test:native:chat-lifecycle` 同时在首段中文字中间拆包，仍需先看到正确首段、再看到后续段，完成与重启后正文不损坏。这些可控夹具不证明外部线路可用。

受保护 P1 还运行 `eval:provider:fallback -- --direct-stream`：同一聊天 Runtime 直连配置的外部端点，不使用 relay、不发送实际项目源码，只问固定日常问题。记录可见正文增量的数量、字符数和单调时钟时间，不保存回复正文；至少两次非空增量、首末相隔至少 25ms、完整正文一致、正常结束且测试源码不变才通过。25ms 只用于排除同批回放，不是产品速度指标；单次到达或无法证明分段应失败。固定慢流、同批多事件及缺完成标记夹具只验证此门槛，不冒充真实线路。该测试也不能代替原生 WebView 的可见渲染验收。

### 1. Runtime 健康检查

直连流式验收必须调用当前普通聊天的 `generate_provider_chat_with_tools(..., allow_engineering_tools=false)`，不能用旧的带工程工具入口代替；本地 HTTP 夹具需核对请求没有工程工具，并验证分段正文先后到达。远端报告的 SHA 必须包含这一路径和相关解码修复，否则只能作为旧版本证据。

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
npm --prefix desktop run test:native:provider-recovery
```

`tests/run-tests.sh` 是本地完整回归入口，覆盖文档契约、Desktop Node、Web build、bundle 预算、离线 Eval 基线和 Runtime Rust 测试。`test:native` 是独立的原生窗口 smoke；它不能用浏览器 Preview 或离线测试替代。

Repository 锁回归验证：活跃写入持锁期间不能回滚 prepared journal；即使文件时间超过旧 30 秒阈值也不能抢锁，释放后保留同一文件。真实测试子进程持锁并留下中间状态，父进程必须先被拒绝；终止子进程后应在 2 秒内取得锁，在下一次更新读取状态前恢复 journal。被忽略的 `repository_lock_child` 只是由该回归显式启动的子进程入口，不能当成未执行的独立验收。以上不调用外部模型，不证明所有运行时保存冲突已消失。

事务历史快路径回归用 1,000 份归档记录验证：首次升级可读取旧历史，后续实际保存读取的历史 journal 必须为 0，原始记录保留，新完成记录归档且 pending 为空；计时仅作为本机诊断，不替代桌面发送或真实模型延迟。另覆盖 pending committed 不回滚、prepared 回滚、损坏记录阻止后续写入，以及切换后显式导入旧事务仍会被恢复。

基础原生 smoke 交替执行 20 次 Enter 与点击发送，记录事件开始到乐观消息提交后下一动画帧的耗时，单列首轮并要求 p95 ≤ 100ms，同时检查输入清空与消息不重复。这是原生 WebView 合成事件的本地反馈指标，不代表像素实际绘制、真实键盘输入法或外部模型首字延迟；后者分别验收。

`test:native:provider-recovery` 使用临时工程和两个本机随机端口验证桌面 Provider 恢复：主线路必须在已有部分正文后断开，独立备用线路通过预检后只能发起无工具续写；窗口必须先展示部分正文和恢复状态，最终正文不能重复，并持久化 `continued-stream`、流式统计与新的活动 profile。该测试不读取真实密钥，也不能替代不同 origin 的真实外部线路验收。

`npm --prefix desktop run test:native:chat-lifecycle` 使用本机 SSE 夹具和真实原生窗口，验证多段正文在结束前分别可见、停止关闭上游、保留部分正文、拒绝迟到内容、断流及自动续写都失败后从原问题显式重试、重启后记录不变且不自动重放。额外检查 Shift+Enter、输入中 Enter 和输入法键码 229 不发送；通过 Runtime 存入 200 条历史，重启先恢复最近 120 条并测量 20 次发送反馈，再确认最早原文仍可读取、逐页回看无重复、无模型请求且阅读位置保持。历史用户消息不得携带助手专用状态；消息按 id 渲染，不按位置复用。此测试不证明旧版本已丢失的原文可恢复，也不证明真实物理输入法或外部模型可用。

`npm --prefix desktop run test:native:validation-revision` 在临时无模型工程运行生产路径的三个固定检查，验证报告绑定源码、签收保存指纹、同长度源码修改后拒绝重复签收、原报告不被只读投影覆盖、重启显示“待重新验收”且保留历史。夹具脚本与小型 Cargo 工程只证明版本绑定，不证明真实 OmniDesk 工程检查或外部模型成功。Rust 回归另覆盖检查期间变化、验收标准变化、旧无指纹报告、项目目录身份、增删重命名/配置、符号链接与扫描上限；Preview 两条读取路径均不得宣称当前版本已通过。签收正式写入 data 后，完整 Workspace 投影必须读到新条目；误放 evidence 的旧条目只读合并、去重且原文件不变。

共享受控检查执行器另以真实本机 npm 子进程验证：稳定源码成功、命令退出失败、退出码 0 但脚本修改源码时整体失败，审计与返回值保存相同输入指纹及进程/版本状态；符号链接导致初始版本无法建立时，命令 marker 必须不存在。此项不调用真实模型，也不替代任务后续版本变化的可见过期验收。

原生 `test:native:validation-revision` 还把三个实际检查结果保存为 Task，经重启在任务卡显示“验证通过”；同长度源码修改后，不重启应用即自动显示“待重新检查”，再次重启仍过期，任务 JSON 与原始证据逐字节不变。Rust 另覆盖同批检查混合版本、旧无指纹、较新失败压过旧成功、无法核对源码及伪造读取状态不落盘；前端验证过期进入待验证筛选/重新检查动作，结果摘要不重复宣称通过。此为临时工程的本地版本机制验收，不证明真实模型或实际工程任务完成。

`npm --prefix desktop run test:native:decision-cards` 通过 Runtime 保存含旧建议的对话，再从原生 Assistant UI 操作：只显示最新决策；Agent/计划两种取消均恢复发送且不创建任务；同一事件内双击确认只创建对应的一个 Task、一个 Run 和一次 ACP prompt；检查请求停在独立审批前，重启不恢复旧按钮或自动执行。此夹具仅使用本机 HTTP 和可控 ACP，不读取真实密钥，不证明外部模型可用。Webdriver 构建只能从临时工作区的 `.omnidesk/cache/native-hermes-acp` 选择测试进程，Hermes 配置同步也限制在该临时区；生产构建不含此选择入口。

`npm --prefix desktop run test:native:plan-cancel` 在本机 HTTP 故意不返回预检响应头，原生窗口发起只读计划后点击停止，要求 5 秒内关闭对应 HTTP 连接、恢复发送并保存原问题和取消记录；重启不重放计划、不创建 Task/Run 或改写源码。启动自动模型检测单独计数，不能误算为计划重放。Rust 回归另验证预检取消实际关闭 socket、网络预检按 origin 跳过同网关配置（含健康缓存）、额度故障仍可切换同网关其他凭据，以及 ACP 元数据/重复工具状态不延长等待、私有思考不混入公开 JSON。以上均为本机确定性验收，不能证明外部模型质量或可用性。

`test:native:codex-isolated` 使用可控 Codex JSONL 夹具验证真实 Runtime 的隔离工程链：后台启动必须持久化 detached worktree，Patch、检查和合并分别审批，审计写回源工程状态区，合并前源工程哈希不变，合并后清理 worktree，Timeline 只导出 `metadata-only`。`test:native:codex-real` 使用本机 Codex CLI 执行同一临时非敏感工程验收；认证、额度和网络错误必须快速分类，不能长时间显示为排队或处理中。

`test:native:codex-isolated` 还在检查后修改隔离源码并重启，要求显式继续后重新申请检查；在等待合并时再次修改源码，旧合并审批必须失效，同一 Run 可继续且不写源工程、不消耗修复预算、不重做 Patch。再次检查后必须产生不同的合并审批 token。Rust 覆盖无版本旧成功、较新失败、预算耗尽时版本失效及核对结果不能覆盖并发取消。可控夹具不能替代受保护环境的真实 Provider 验收。

### 2. Agent 交互契约

`test:native:validation-revision` 还从原生 WebView 调用生产手动应用工作流与真实 Runtime：旧审阅草稿必须拒绝且源码/任务记录不变；临时工程 Patch 实际写入后停在“待检查”，结果由 Runtime 保存，重复请求和重启后的旧请求均拒绝。旧检查证据保留，重启无自动检查且任务卡仍显示待检查；随后独立调用受控检查工作流才建立新的当前版本证据。此项不代替手动审批窗口的点击验收或真实模型验收。Rust 另覆盖同时间戳草稿替换、跨工程、并发独占、未结记录禁止保存/删除/重放、失败证据持久化及进程变化后的中断投影；前端验证使用展示快照、已提交结果不二次落盘、旧审批拒绝不覆盖历史、`recordPending` 不伪造失败。

`test:native:plan-cancel` 还通过原生 command 单独发起手动改动草稿，在 HTTP 预检不返回响应头时取消，必须关闭对应连接并返回“请求已取消”，不返回占位成功、不创建 Task/Run、不改源码。Rust 额外证明总时限会取消阻塞 worker、正常返回关闭子作用域而父 token 不受影响。此项只证明草稿取消边界，不能替代完整草稿审阅/应用链或真实模型验收。

`test:native:validation-revision` 另在停机后的临时工程设置未结手动应用记录，分别保留已应用/未应用源码，重启后从任务详情点击“核对文件”及对应人工确认。核对必须不改变证据数量或源码；确认只追加一条无源码写入、无检查的恢复记录。未应用必须再次展示实际 diff 并点击应用，才可写入并停在待检查；再次重启不得重放或丢失记录。Rust 覆盖活跃租约阻止核对、观察伪造/旧快照/跨工程/源码变化拒绝、无法确定保留中断以及确认不运行检查。此为中断状态夹具，不冒充真实模型任务或操作系统杀进程现场。

该原生场景还通过真正的文件监听归档同一路径、同字节长度的源码修改：连续保存必须归档最终内容，同内容再次保存不追加重复版本；重启后“执行结果”显示版本身份，旧归档仍在，任务文件不变。Rust 另覆盖 index 单独变化、中文/空格、嵌套工程、重命名与删除、显示窗口外第 32 个文件变化、敏感路径排除和符号链接无法绑定。归档不生成审批/检查/完成证据，不保存源码正文，也不能充当历史 diff 回放或真实模型验收。

审批版本回归要求：Rust 事务拒绝缺失/错误 token、错误 revision、重复提交以及旧审批批准替换后的新请求，拒绝前后持久化版本不变。Codex 隔离原生夹具通过运行记录打开改动审批，核对展示 diff 与持久化审批逐字一致、授权文件和隔离范围可见，关闭窗口不审批、不执行；旧 Patch 快照不能批准后来的检查。最终合并从原生审批窗口确认，同事件双击不能重复执行。此证据来自可控本机 JSONL，不代表真实模型任务已通过。

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

P1、P3 与 suite 需要 `OMNIDESK_AGENT_EVAL_KEY` secret，以及 `OMNIDESK_AGENT_EVAL_API_BASE`、`OMNIDESK_AGENT_EVAL_MODEL` variables；P4 不读取 Provider 密钥。P3 与 suite 固定安装带 `acp` extra 的 Hermes 版本，并在进入 Provider Eval 前校验 `hermes-acp --version` 与 `hermes-acp --check`；裸 `hermes-agent` 安装不包含 ACP 协议依赖，不能作为 Runtime Timeline 的执行环境。真实 Provider Eval 强制提供 `--trace-dir`：suite 会把 trace 复制到 `.omnidesk/evidence/agent-eval/<run-id>/suite/traces/`，并将 `results.json` 中的 trace 引用写成相对 artifact 路径。`goal-rebind` 必须证明四份授权且明确必改的文件均发生真实内容变化；只出现文件头或 `-same/+same` 空改动不能满足覆盖。首个草稿缺文件或未通过规范化时可以在完全相同的授权范围内重生成一次，首次失败和第二次结果都必须保留原始输出、usage、拒绝原因和是否进入审批的证据；最多两次草稿且只有完整草稿可进入独立审批。`interrupted-run` 必须记录网络不可用分类、未接受 Provider 响应和恢复后的原审批；`ask-user-resume` 必须证明追问持久化、交互审批为零、回答后恢复同一 Run，并以独立审批完成 Patch。suite 还运行 `isolated-worktree` 真实证明：模型 Patch 必须先在临时 detached worktree 应用并通过检查，源工程在第二次审批前保持干净，批准 diff 必须与当前 worktree diff 完全一致，合并后源工程通过验证且 worktree 被清理。该证明不修改已提交基线，报告没有真实 trace 时不能替代任一门槛。

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
