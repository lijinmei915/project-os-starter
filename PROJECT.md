---
layer: knowledge
type: status
last_verified: 2026-07-27
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
- 当前阶段：`OmniDesk Agent 平台稳定化 v1 已完成`

OmniDesk 负责在用户授权范围内理解本地项目、持续对话、生成计划和 Patch 草稿、执行独立审批、运行检查、有限修复并保存可审计证据。它不是 Project OS 安装器、AI 工程评分工具或跨工具模板分发产品。

`Project OS` 是本仓库早期产品阶段留下的兼容命名和工具链。旧 CLI、Desktop governance bridge、安装脚本、模板、静态报告、adapter 与 routing skill 均已退役；物理 `.project-os/` 状态根已删除。

## 当前架构

- 桌面应用：`desktop/src/`，负责 Workbench、对话、任务、目标、审批、终端和证据呈现。
- 本地运行时：`desktop/src-tauri/src/runtime/`，负责 Workspace、Conversation、Task、Goal、Agent Run、Provider、Patch、Execution 与 Repository。
- 模型执行：普通 Provider 与 Hermes 都经过同一授权文件、Patch 校验、审批和检查边界。
- 状态事务：Runtime Repository 使用 schema、锁和原子事务维护跨实体一致性。
- 浏览器 Preview：仅用于只读预览和 UI 验证，不执行文件写入、终端或受控检查。
- 当前状态根：`.omnidesk/` 是唯一物理状态根；旧 `.project-os/` 已迁移、归档并删除。Runtime 与 Preview 仅接受 native `.omnidesk/data|runtime|cache|evidence` 路径；历史导入由迁移器单独处理。
- 评测：`desktop/evals/` 保存已登记 13-case 基线；最新受保护 Agent Eval [`30188136814`](https://github.com/lijinmei915/project-os-starter/actions/runs/30188136814) 已在 `dd53d94` 通过 P1、P3、P4、suite 与统一 artifact index。

详细模块边界见 `docs/ARCHITECTURE.md`，测试与发布门槛见 `docs/TESTING.md`。

## 当前进度

已完成：

- 对话 SSE 流式输出、请求级取消、新请求接管和迟到结果拒绝。
- Agent Run 持久化、独立审批、Patch 应用、检查、最多两轮修复，以及工具边界的阶段 checkpoint 恢复。
- Agent 缺少关键参数时可通过标准 `ask_user` interaction 暂停：请求、回答和跳过结果均持久化到 Agent Run；对话内按 schema 渲染单选、多选、文本与确认表单，提交后从 checkpoint 重新请求同一任务。
- `ask_user` 与 Patch/Check 审批严格隔离：回答不会创建、消费或替代工程审批；相同回答幂等，冲突重复回答拒绝，桌面应用重启后仍可恢复待回答表单。
- Workspace、Conversation、Task、Goal、Provider、Execution 的 Runtime 模块与 Repository 事务边界。
- 正式 13-case Eval：任务成功率 100%、Patch 可应用率 91.7%、检查通过率 100%、恢复成功率 100%。新增 `ask-user-resume` 真实证明模型结构化追问、checkpoint 持久化、零交互审批、回答后同 Run 续接、独立 Patch 审批与检查。
- 平台稳定化工作树回归：Desktop Node `600/600`、Runtime Rust `206/206`、Patch Normalizer `7/7`、原生 WebDriver smoke 与 Web build 通过；文件账本覆盖 573 个文件、15 个 active schema 且无候选。模型设置与工程文件按需加载后，首屏入口为 623.45 KiB，已低于 800 KiB 软预算且未提高阈值。
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
- 文件账本已覆盖全部 569 个 tracked 或非忽略文件且无待分类候选；schema 账本登记 14 个 active 契约且无待复核候选。Runtime、Eval、根入口和当前文档 SSOT 均已有明确 Owner、消费者证据、保留/拆分决策与验证记录。
- Provider Patch Draft 的固定授权上下文、连接选择、一次 Hermes 重生成、普通 Provider 降级与占位草稿证据，只读计划的连接选择、降级与失败证据，凭据策略与模型探测、请求预检与故障切换、Provider chat transport/SSE、Hermes 配置文件同步与 ACP 执行、Agent 读工具、系统集成、Workspace watcher 与批准工具状态转换已从 `app.rs` 收口到对应 Runtime Owner；聊天和只读计划共用同一图片附件输入契约。Workbench 默认契约、Preview Workspace 只读状态投影及 Workspace 原生/Preview transport bridge 也已从 `main.jsx` 下沉，入口继续只承担 controller 与 surface 装配。
- Workspace 的事实新鲜度、能力、记忆与档案记录，以及前端对话、摘要、项目记忆和事实投影，现统一新写入 `omnidesk.*`；读取旧 `project-os.*` 仅生成带 `schemaMigration` 的内存投影。Provider 凭据配置仍隔离，未做泛化迁移。
- `styles.css` 已收口为有序入口，领域规则拆到 `styles/theme|workspace|conversation|terminal|provider-rail.css`；构建与边界测试约束入口顺序和 Owner。
- 执行 allowlist、Patch Draft 可应用性/授权校验、Git Apply、已批准工具调度与项目绑定、输出截断、审计和任务摘要已归属 `runtime/execution.rs`；Agent Run 的模型阶段创建/恢复校验、running checkpoint、工具结果续接，以及模型完成后的审批/终态/证据收束已归属 `runtime/agent_runs.rs`。`app.rs` 仅保留项目权限解析、Tauri 命令适配、Provider/Hermes transport 与生命周期编排，当前 2261 行。无 Runtime 消费者的旧 schema 已完成独立确认与退役，当前 14 份 schema 均有 Desktop 消费者证据。
- `复杂任务执行基础 v1` 已完成：Hermes 启动前建立有界只读 Context Pack；确认任务可选择临时 detached worktree，Patch 与检查先在其中运行，源工程合并仍需第二次独立审批与干净源/diff/授权复核；原生终端实时保存脱敏、截断的会话证据，重启后的旧会话明确记录为中断。
- 受保护真实 Eval [`30081697947`](https://github.com/lijinmei915/project-os-starter/actions/runs/30081697947) 已通过：13/13 标准 case 成功，任务成功率 100%、Patch 可应用率 91.7%、检查通过率 100%、恢复成功率 100%。独立 `isolated-worktree` trace 证明源工程干净、批准 diff 与 worktree 一致、二次审批完成、合并结果通过验证且临时 worktree 已清理。
- `普通聊天可靠性 v1` 已完成：普通 Provider 只生成自然文本正文，任务意图与是否创建计划由本地确定性路由负责；SSE 文本不再从未完成 JSON 中手工截取。旧 JSON envelope 仅作为兼容输入读取，并以 `responseMode=legacy-json` 随对话记录持久化；Hermes 任务、审批和证据边界未改变。
- `普通聊天生命周期可靠性 v2` 已完成本地实现：删除前端固定 12 秒墙钟超时，普通聊天由 Runtime 统一控制 30 秒首响应、45 秒流空闲与 5 分钟整体上限；超时或取消会销毁 Provider Future，终态后的 delta 被拒绝。流中断保留部分正文并标记 `responseMode=partial`，单轮 `timed-out` / `interrupted` 不再把模型健康状态误判为连接失效。完整回归通过 Node `557/557`、Rust `160/160`、Patch Normalizer `7/7` 与原生 WebDriver。
- `Provider 主流健康与重试机制 v1` 正在本地验收：取消分钟级后台连接轮询；首字前的网络失败最多自动重试一次并显示重试状态；瞬时网络错误只结束当轮请求，不覆盖上次可用健康证据。认证、额度和模型不存在仍会持久标记阻断状态。
- 首次启动已增加 Workspace + Provider hydration 门槛：Runtime 恢复前只显示中性启动壳，不再闪现演示 fallback 项目、模型和连接。主题缓存在 React 绘制前应用；浏览器实测首帧为“正在恢复工作区…”，稳定帧一次性显示真实 `OmniDesk / LJM Gateway / gpt-5.6-luna`。
- 终端懒加载增加局部错误边界；开发服务中断时只影响终端区域，不再由全局错误边界替换整个工作台。原生终端挂载、xterm 创建、打开、聚焦与尺寸适配已通过 WebDriver 诊断。
- `对话状态机一致性 v1` 已完成本地实现：待确认计划不会被普通“改”字绕过；未完整修改意图只进入补充讨论；不可应用 Patch Draft 标记失败而非验收通过；确认词不再成为任务标题；非计划结果不再重复渲染计划卡。
- Agent 平台化 P0 已完成首个统一投影切片：Conversation、Task 与 Agent Run 共用 workflow 状态和展示语义；普通 `succeeded` 只表示“处理完成”，只有持久化成功检查证据才能显示“验证通过”。
- Agent 平台化 P0 已完成本地验收：任务看板、项目统计、右栏、Preview、追问表单和结果弹窗统一消费 workflow 投影；验证筛选和下一步动作不再根据 `verificationSummary` 文案猜测证据。
- Agent 平台化 P1 已完成本地能力证据切片：所有尚无能力证据的 OpenAI-compatible 服务都会先尝试原生 `start_engineering_task` Function Call，SSE 与非流式 tool call 均累计并校验工具名及完整参数；缺失、非法、额外字段或重复调用会被拒绝。Runtime 会按 API Base + 模型持久化原生 tools 被接受或被明确拒绝的证据，后续请求优先使用证据。明确 400/422 不支持 tools 时只无工具重试一次；网络、认证和额度错误不会污染能力结论。
- P1 已通过受保护真实验收：Provider 原生返回 `start_engineering_task` 与合法参数并明确报告 token usage；兼容 relay 证明 tools 被明确拒绝后只无工具重试一次，真实 SSE 持续 19.5 秒仍成功，后续断流保留部分正文。Provider 未明确返回的 cost 保持未知。
- Agent 平台化 P2 已完成本地与原生验收：Hermes 在入队前持久化完整 Agent Run 上下文，Scheduler 全局最多两个占用、同项目一个、FIFO 领取；工作台显示稳定队列位置并提供继续/取消。等待审批、追问或工具续接期间保留项目；取消会同步封口 Run 与 Scheduler、释放项目且拒绝迟到模型或租约覆盖。原生 WebDriver 已证明两个跨项目占用、并发上限排队、同项目互斥、重启仅中断活动项、queued 不自动执行且可显式取消。
- Agent 平台化 P3 已完成本地与原生实现：Agent Run evidence 统一为版本化 `omnidesk.run-event.v0.1`；调度、模型、审批、追问、Patch、检查、工具、恢复、取消和结果使用同一事件结构。Runtime 聚合 Run 的事件数、模型调用数、总耗时、显式 token 与 cost；只有全部模型阶段均明确返回成本时才汇总 cost，任一阶段缺失则保持未知。时间线可导出为 `omnidesk.run-timeline-export.v0.1` 脱敏证据；导出采用 `metadata-only` 策略，不包含 prompt、文件正文、diff、output、observations 或 credentials。工作台按时间线展示事件和指标，并提供导出入口；原生 WebDriver 已验证 schema、指标与脱敏策略。
- P3 已通过受保护真实验收：真实请求经过生产 `Scheduler -> Agent Run -> Hermes ACP -> Timeline`，聚合 usage 为输入 10742、输出 63、总计 10805 token；Run 成功、项目租约释放、Scheduler 零残留，导出保持 `metadata-only`，ACP 未返回 cost 时不生成估算值。
- Agent 平台化 P4 已完成 Tool Registry 基础切片：现有 `list_files/read_file/search_project/git_status` 使用版本化描述符声明来源、风险、审批和封闭参数 schema，执行前必须命中 Registry 并通过实际参数校验；MCP 或任何写入/执行工具缺少审批声明会在注册校验阶段拒绝。
- P4 的 MCP Runtime 已完成本地闭环：只接受 command/args 分离的 stdio Server，环境只保存宿主变量引用，审批策略固定 `always`；有界 `tools/list` 与 `tools/call` 仅由消费独立 Agent Run 审批后的 Tool Gateway 启动。发现证据绑定当前项目与无密钥 Server 配置快照，配置变化、跨项目、未知工具或 schema 不匹配都会在进程启动前拒绝。
- P4 最小可见管理入口已接入 `Agent 配置 / 受控工具`：用户可管理 Server、发起发现审批、查看当前项目仍有效的发现证据、按工具 schema 填参数并创建新的调用审批。调用审批创建失败时保留参数表单，Server 删除失败时保留确认框，切换项目或卸载页面后不接受迟到刷新状态。页面复用现有 Agent Run 批准、取消和证据导出操作；Preview 只显示只读提示，不暴露 transport。原生 WebDriver 已从真实页面完成 `lookup` 发现、表单调用、审批前零执行、批准后有界结果写回的闭环。
- P4 已通过受保护真实验收：官方 `@modelcontextprotocol/server-filesystem@2026.7.10` 的版本与 integrity 固定，发现和 `list_directory` 分别经过 Scheduler、Agent Run、独立审批与 Execution；审批前零执行，两个 Run 与 Timeline 成功，结果有界且 Scheduler 零残留。
- 平台稳定化受保护 Eval [`30188136814`](https://github.com/lijinmei915/project-os-starter/actions/runs/30188136814) 已在 `dd53d94` 全绿：P1/P3/P4/suite 四个切片可独立运行，13/13 case 与隔离 worktree 通过；统一 `omnidesk.agent-eval-artifact-index.v0.1` 覆盖四个切片、45 个证据文件，下载后逐项复算 SHA-256 无差异。P1 冷构建与 Runtime 超时已分离，未放宽 120 秒执行上限。
- 平台稳定化真实桌面最终组合验收已完成：原生窗口请求 `1785052066377-0ac18e1d99acc` 由 `gpt-5.6-terra` 接受 `start_engineering_task` Function Call，同一 requestId 绑定 Conversation 与只读 Task，生成真实 `PROVIDER_CALL` 计划并停在 `awaiting-confirmation`。确认前 `approval=null`、`agentRunId=null`，README 哈希保持不变；该证据与同一 MCP Run 的调度、重启不重放、显式恢复、原审批、工具结果和 metadata-only Timeline 原生证据共同闭环。期间修复了编排层用兼容关键词覆盖合法原生 Function Call 的缺陷。
- 模糊修改追问与计划/Patch 失败状态已完成根因修复：缺少替换内容的修改请求进入 Hermes `ask_user`，明确修改仍可直接生成只读草稿；前端不再拥有独立 15 秒计划超时，Provider 降级计划不得自动进入 Patch，语义闸门失败会显示真实原因并在失败阶段封口。真实原生请求 `1785054065688-24f4935c60a0c` 已验证进入 `awaiting-user-input`、零审批、零 Patch 和零工程写入。
- `ask_user` 提交后的恢复与展示已闭环：历史 interaction 按请求时间进入对话；单文本追问可从底部输入框回答；已处理卡片折叠且 Run 失败优先显示。`search_project.maxResults` 使用封闭 `1..100` 整数契约并被执行器实际遵守，避免回答或跳过后因工具参数漂移中断。
- Tool Call 自修复 v1 已完成本地与原生验收：`read_file` 支持有界 `startLine/endLine`，Hermes 收到完整内置工具 schema；只读工具参数错误会作为 observation 返回模型并最多纠正两次，连续预算耗尽后才以单一失败终态结束。Patch、检查和终端审批边界不变。完整回归为 Node `612/612`、Rust `210/210`、Patch Normalizer `7/7`、Web build、离线 Eval 与原生 WebDriver smoke 全部通过。
- 建议到执行的确认闭环 v2 已收敛为双调用协议：`recommendation-required` 首次调用只输出可见自然语言并通过 SSE 真流式展示，正文完成后再用隐藏的 `respond_with_recommendation` Function Call 生成唯一 `task`；分类失败时保留完整正文并降级为 `native-text`。前端只把校验通过的 `native-recommendation-call` 映射为 `start-agent` 待确认动作，不从正文或历史猜测动作。用户确认后通过 Conversation Action Executor 启动受控 Hermes，Patch、检查和终端保持独立审批。
- 普通对话仍通过 `respond_to_user` 单次结构化出口；其 SSE 工具参数可按顶层 `reply` 增量解码，但 Provider 若缓冲完整 Function Call，Runtime 不伪造上游增量。生成中的新消息会立即建立新请求并取消旧 Runtime 请求，不再插入低信号取消消息；被接管的旧异步准备也不能重新抢占 requestId。Agent 启动投影明确为“先读取项目和判断下一步”，不误报“等待生成改动”。
- 对话流式视口现直接维护真实滚动父级：用户停留底部时随 delta 与内容尺寸变化粘底，主动向上阅读后停止抢滚动；不再对整块长对话使用 `scrollIntoView`。每轮助手结果会持久化 metadata-only `providerStreamTrace`，只记录分片数、字符数和首末分片耗时。真实桌面请求 `1785130460943-15b47c0435f228` 已验证 `native-recommendation-call` 在 1116ms 收到首段、8277ms 收到末段，共 393 个 delta / 613 字，真实 Provider 流式链路成立。
- Agent Executor Adapter v1 已建立：通用契约统一能力探测、`Start / Resume`、取消、状态与结构化结果；Registry 当前登记默认 `HermesAcpExecutor` 和可选 `GeminiAcpExecutor`。通用 JSON-RPC、结构化工具循环、usage 与取消位于 `acp_protocol / acp_execution`，供应商 Adapter 只负责程序发现、参数和环境。新 Run 持久化 Registry 选择及一致 evidence，恢复严格使用原 `executorId`，未知或能力不足的执行器明确失败。真实 Gemini 0.44.1 进程启动/取消、独立 ACP 恢复/结构化结果/usage 已验证；Gemini 模型凭据端到端调用尚未验收。Scheduler、Agent Run、Tool Gateway、审批、Patch、恢复和 evidence 继续由 OmniDesk 独占。
- Agent Executor 契约防膨胀 v1 已落地：公开状态携带稳定 `omnidesk.agent-executor.v1` 版本；Runtime 准入只读取冻结的核心能力，执行器特有能力只能进入不透明 `extensions`。通用 Runtime 禁止读取扩展或根据 Hermes/Gemini 身份改变调度、审批、恢复、Patch、检查与证据规则，源码边界测试持续约束该规则。
- Agent Event 标准化 v1 已落地：共享 ACP 层把生命周期、工具请求/结果、等待追问、等待审批和终态归一化为有序 `omnidesk.agent-event.v1`；每次执行只允许一个终态。Runtime Timeline 只消费标准事件，不再读取执行器 `trace/observations`；metadata-only 导出再次按白名单裁剪事件详情。事件只保存公开阶段摘要，不保存 Prompt、正文、工具输出或模型完整思维链。

当前重点：

- `OmniDesk Agent 平台稳定化 v1` 已完成本地、原生与受保护真实验收；P0-P4、首屏预算、Eval 矩阵、artifact 索引和真实桌面组合证据均已闭环。
- 后续改动继续守住多文件 Patch 授权、独立审批、恢复不重放、单终态、显式 usage/cost 和脱敏 trace 门槛，不扩展关键词执行路由或旁路工具 transport。
- 下一阶段优先降低真实模型多文件 Patch 输出波动，并以既有 13-case 和隔离 worktree 门槛防止可靠性回退。
- 受保护 Eval 继续保留失败 artifact；上游模型波动、依赖漂移或软 bundle 超限不能通过放宽门槛掩盖。
- 第三个执行器接入应只增加 Adapter 与 Registry 项；若必须修改 Runtime 核心能力，需要发布新的契约版本，而不能向 v1 持续追加供应商字段。

当前风险：

- 活跃 Provider 请求不能从中断 token 续传；重启后只能从最近持久化阶段重新请求模型，不能续接原网络流。
- 终端交互进程仍不能在 Runtime 重启后恢复；仅保存脱敏、截断的会话证据，不能把该证据当作可续接的 shell。
- 历史工程如需导入旧 `.project-os/`，必须先运行幂等迁移并处理冲突；Runtime 不会回退读取旧路径。

## 下一步重点

1. 降低真实模型多文件 Patch 输出波动，不放宽授权、审批、规范化或 trace 门槛。
2. 保持 P1/P3/P4/suite 可独立重跑，并在 Provider、依赖或 bundle 变化时复核统一 artifact 索引与 800 KiB 预算。
