---
layer: knowledge
type: status
last_verified: 2026-07-26
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
- 当前阶段：`复杂任务执行基础 v1`

OmniDesk 负责在用户授权范围内理解本地项目、持续对话、生成计划和 Patch 草稿、执行独立审批、运行检查、有限修复并保存可审计证据。它不是 Project OS 安装器、AI 工程评分工具或跨工具模板分发产品。

`Project OS` 是本仓库早期产品阶段留下的兼容命名和工具链。旧 CLI、Desktop governance bridge、安装脚本、模板、静态报告、adapter 与 routing skill 均已退役；物理 `.project-os/` 状态根已删除。

## 当前架构

- 桌面应用：`desktop/src/`，负责 Workbench、对话、任务、目标、审批、终端和证据呈现。
- 本地运行时：`desktop/src-tauri/src/runtime/`，负责 Workspace、Conversation、Task、Goal、Agent Run、Provider、Patch、Execution 与 Repository。
- 模型执行：普通 Provider 与 Hermes 都经过同一授权文件、Patch 校验、审批和检查边界。
- 状态事务：Runtime Repository 使用 schema、锁和原子事务维护跨实体一致性。
- 浏览器 Preview：仅用于只读预览和 UI 验证，不执行文件写入、终端或受控检查。
- 当前状态根：`.omnidesk/` 是唯一物理状态根；旧 `.project-os/` 已迁移、归档并删除。Runtime 与 Preview 仅接受 native `.omnidesk/data|runtime|cache|evidence` 路径；历史导入由迁移器单独处理。
- 评测：`desktop/evals/` 保存已登记 13-case 基线；最新受保护 Provider Eval `30071780488` 已产生并上传真实报告与 artifact-relative trace。

详细模块边界见 `docs/ARCHITECTURE.md`，测试与发布门槛见 `docs/TESTING.md`。

## 当前进度

已完成：

- 对话 SSE 流式输出、请求级取消、新请求接管和迟到结果拒绝。
- Agent Run 持久化、独立审批、Patch 应用、检查、最多两轮修复，以及工具边界的阶段 checkpoint 恢复。
- Agent 缺少关键参数时可通过标准 `ask_user` interaction 暂停：请求、回答和跳过结果均持久化到 Agent Run；对话内按 schema 渲染单选、多选、文本与确认表单，提交后从 checkpoint 重新请求同一任务。
- `ask_user` 与 Patch/Check 审批严格隔离：回答不会创建、消费或替代工程审批；相同回答幂等，冲突重复回答拒绝，桌面应用重启后仍可恢复待回答表单。
- Workspace、Conversation、Task、Goal、Provider、Execution 的 Runtime 模块与 Repository 事务边界。
- 正式 13-case Eval：任务成功率 100%、Patch 可应用率 91.7%、检查通过率 100%、恢复成功率 100%。新增 `ask-user-resume` 真实证明模型结构化追问、checkpoint 持久化、零交互审批、回答后同 Run 续接、独立 Patch 审批与检查。
- 当前工作树回归：Desktop Node 595/595、Runtime Rust 205/205、Patch Normalizer 7/7、原生 WebDriver smoke 与 Web build 通过；文件账本覆盖 569 个文件且无待分类候选。首屏产物 813.34 KiB 超出 800 KiB 软预算，警告保留且未提高阈值。
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
- 受保护 Agent Eval 已接入独立 Provider Function Calling 探针：强制真实模型返回 `start_engineering_task` 和合法 `task` 参数，并保存不含密钥的原始响应、规范化 usage、耗时与 request id trace。探针会拒绝缺少真实 token usage 的响应，Provider 未明确返回的 cost 保持 `null`，不做估算。该工作流改动尚未在远端运行，因此 P1 仍未完成真实证据门槛。
- P1 compatibility fallback 与普通聊天慢流/断流已合并为受保护 relay 探针：生产 `generate_provider_chat` 首次携带原生 tools，relay 明确返回不支持后只允许一次无 tools 重试并转发真实 Provider；真实回答保持 SSE 超过 12 秒仍须成功，能力证据必须持久化为 `explicit-tool-rejection`，下一轮故障注入断流必须保留部分正文。本地完整接线已通过，远端真实 Provider trace 尚待运行。
- Agent 平台化 P2 已完成本地与原生验收：Hermes 在入队前持久化完整 Agent Run 上下文，Scheduler 全局最多两个占用、同项目一个、FIFO 领取；工作台显示稳定队列位置并提供继续/取消。等待审批、追问或工具续接期间保留项目；取消会同步封口 Run 与 Scheduler、释放项目且拒绝迟到模型或租约覆盖。原生 WebDriver 已证明两个跨项目占用、并发上限排队、同项目互斥、重启仅中断活动项、queued 不自动执行且可显式取消。
- Agent 平台化 P3 已完成本地与原生实现：Agent Run evidence 统一为版本化 `omnidesk.run-event.v0.1`；调度、模型、审批、追问、Patch、检查、工具、恢复、取消和结果使用同一事件结构。Runtime 聚合 Run 的事件数、模型调用数、总耗时、显式 token 与 cost；只有全部模型阶段均明确返回成本时才汇总 cost，任一阶段缺失则保持未知。时间线可导出为 `omnidesk.run-timeline-export.v0.1` 脱敏证据；导出采用 `metadata-only` 策略，不包含 prompt、文件正文、diff、output、observations 或 credentials。工作台按时间线展示事件和指标，并提供导出入口；原生 WebDriver 已验证 schema、指标与脱敏策略。
- P3 已接入独立受保护 Runtime Timeline 探针：真实请求必须经过生产 `Scheduler -> Agent Run -> Hermes ACP -> Timeline`，Run 终态、项目租约释放与 `metadata-only` 脱敏均通过后，还必须在聚合指标中存在真实输入、输出和总 token；cost 仅接受 ACP 明确返回的值。二进制编译与离线验收器已通过，远端真实 Provider trace 尚待运行。
- Agent 平台化 P4 已完成 Tool Registry 基础切片：现有 `list_files/read_file/search_project/git_status` 使用版本化描述符声明来源、风险、审批和封闭参数 schema，执行前必须命中 Registry 并通过实际参数校验；MCP 或任何写入/执行工具缺少审批声明会在注册校验阶段拒绝。
- P4 的 MCP Runtime 已完成本地闭环：只接受 command/args 分离的 stdio Server，环境只保存宿主变量引用，审批策略固定 `always`；有界 `tools/list` 与 `tools/call` 仅由消费独立 Agent Run 审批后的 Tool Gateway 启动。发现证据绑定当前项目与无密钥 Server 配置快照，配置变化、跨项目、未知工具或 schema 不匹配都会在进程启动前拒绝。
- P4 最小可见管理入口已接入 `Agent 配置 / 受控工具`：用户可管理 Server、发起发现审批、查看当前项目仍有效的发现证据、按工具 schema 填参数并创建新的调用审批。调用审批创建失败时保留参数表单，Server 删除失败时保留确认框，切换项目或卸载页面后不接受迟到刷新状态。页面复用现有 Agent Run 批准、取消和证据导出操作；Preview 只显示只读提示，不暴露 transport。原生 WebDriver 已从真实页面完成 `lookup` 发现、表单调用、审批前零执行、批准后有界结果写回的闭环。
- P4 已接入受保护第三方 MCP Eval，并在本机用官方 `@modelcontextprotocol/server-filesystem@2026.7.10` 完成兼容性实跑：固定包版本与 registry integrity，实际安装记录再次校验 integrity；发现和 `list_directory` 调用分别经过 Scheduler、Agent Run、独立审批与 Execution，审批前无工具结果，最终返回 `proof.txt`、两个 Run 均成功、Timeline 为 `metadata-only` 且 Scheduler 无残留。该工作流尚未在远端受保护环境运行，因此仍不算 P4 外部证据完成。

当前重点：

- 推进 `OmniDesk Agent 平台化 v1`：P0、P2 和 P4 的本地/原生闭环已完成，P3 的本地/原生实现已完成；当前集中补 P1、P3、P4 的受保护真实外部证据。
- P1 仍缺真实 Provider Function Calling；P3 仍缺真实 Provider usage/cost trace；P4 的官方第三方 Server 本地实跑已通过，但仍缺远端受保护 Eval artifact。Agent 平台化目标不能只凭本地结果或 UI 展示宣布完成。
- 在受保护环境验证普通聊天 v2 的真实慢速流、长回答和中途网络断开证据；本地不得伪造 Provider trace。
- 保持多文件 Patch 的授权、规范化和 trace 门槛，并继续降低模型输出波动。

当前风险：

- 活跃 Provider 请求不能从中断 token 续传；重启后只能从最近持久化阶段重新请求模型，不能续接原网络流。
- 终端交互进程仍不能在 Runtime 重启后恢复；仅保存脱敏、截断的会话证据，不能把该证据当作可续接的 shell。
- 历史工程如需导入旧 `.project-os/`，必须先运行幂等迁移并处理冲突；Runtime 不会回退读取旧路径。

## 下一步重点

1. 在受保护 Eval 完成 P1 Provider 原生 Function Calling 的首个真实 Provider 闭环；能力探测持久化已完成本地回归，不继续扩展关键词规则。
2. 完成 P3 受保护验收：保存真实 Provider usage/cost trace；Provider 未返回的 cost 继续保持未知。
3. 完成 P4 受保护验收：接入一个真实第三方 stdio MCP Server，证明配置、发现证据、逐次调用审批和有界结果不绕过 Tool Gateway。
4. 在受保护 Eval 运行已接入的 Provider tools 兼容降级、超过 12 秒慢流和断流保留 case，核验真实 upstream metadata。
5. 为普通聊天 v2 增加受保护环境的真实慢速流、长回答和中断验收，同时继续降低多文件 Patch 输出波动；不得放宽授权、审批、规范化或 trace 门槛。
