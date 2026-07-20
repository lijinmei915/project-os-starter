---
layer: knowledge
type: status
last_verified: 2026-07-20
teaches: "当前交接上下文、风险点和下一步建议"
use_when: "新的 AI 会话接手工作、需要了解最近做了什么和接下来该做什么时"
depends_on: [PROJECT.md, AGENTS.md, docs/PRODUCT_PLAN.md, docs/CHANGELOG.md]
---

# 当前交接 (Handoff to Next AI)

> 用途：记录当前接手摘要、最近完成、风险和下一步建议。
> 什么时候更新：每次完成一组连续任务、当前状态变化或下一位 AI 需要接手时。
> 不要写什么：长期路线图、完整产品介绍、详细架构说明或历史流水账。

## 接手摘要

- 2026-07-21 本地总回归已完成单内核收敛：`tests/run-tests.sh` 从 466 行 Project OS 分发/安装/报告/图谱测试收缩为 OmniDesk 离线发布门槛，覆盖 tracked state、仓库文档契约、Desktop Node、Web build、首屏预算、离线 Eval 基线和 Runtime Rust。它不再调用 CLI、installer、模板、AI 工程报告或图谱生成，也不再写入临时 `.project-os` 运行产物。验证：完整入口通过，Desktop Node 442/442、Runtime Rust 71/71、Patch Normalizer 5/5、首屏 796.88/800 KiB、Eval 基线均通过。

- 2026-07-20 常规 CI 已完成单内核收敛：`.github/workflows/ci.yml` 只保留 `Desktop runtime regression` 与 `Repository contracts`。原 `Project OS regression` 中的 CLI 编译、`bin/project-os` 状态同步、`tests/run-tests.sh`、installer/模板回归、AI 工程报告生成和 `.project-os` artifact 上传已全部移出 CI；仓库契约仅校验 tracked state/manifest JSON、frontmatter、文档结构与密钥安全。YAML 解析和新 job 的实际命令均通过。受保护 Agent Eval 仍使用 legacy Provider 逻辑路径，下一批不能直接删除整个旧工具目录。

- 2026-07-20 Desktop 已断开旧 Project OS 治理执行链：Tauri Runtime 不再编译 `runtime::governance`，不再暴露 `run_project_os_action`，也不再通过 `bin/project-os` 或治理 Shell 脚本执行扫描、报告、建议和清理。受控检查现仅允许 Desktop Node、Web build 与 Cargo check；Preview 的“刷新事实”只重新读取只读 snapshot。旧 `governance.rs` 暂留给 CLI 兼容调用，本地 `tests/run-tests.sh` 和文档仍有真实旧工具依赖，未提前删除。命名空间迁移曾使共享 Repository 在旧 CLI crate 缺少 `runtime::state_namespace`，现以冻结兼容桥补齐并加入消费 crate 回归约束。验证：Desktop Node 442/442、Runtime Rust 71/71、Patch Normalizer 5/5、CLI Rust 16/16、Web build、首屏 796.88/800 KiB、Desktop 生产引用扫描和全仓库 `tests/run-tests.sh` 通过。

- 2026-07-20 状态命名空间已接入生产 Runtime 与 Preview：启动会先恢复 legacy 事务，幂等复制到 `.omnidesk/data|runtime|cache|evidence`，无冲突时激活 `omnidesk-primary`，有冲突时继续使用 legacy 且不覆盖源或目标。Repository、Workspace、Provider、Task、Conversation、Agent Run、原生工作区投影和 Vite Preview 均经过同一逻辑路径映射；文件树、治理扫描和 Agent 读取工具隐藏两个物理状态目录。本批同时修复 macOS `/var -> /private/var` canonical root 使 Agent Tool 误判所有文件越界的问题。验证：Desktop Node 443/443、Runtime Rust 72/72、Patch Normalizer 5/5、Web build、Runtime docs、diff check 和首屏 797.81 KiB / 800 KiB 软预算通过。

- 2026-07-20 `OmniDesk 单内核收敛与可靠长任务 v1` 第一阶段已开始：`PROJECT.md`、`.project-os/state.json` 与 `docs/ARCHITECTURE.md` 统一将 `desktop/` 的 React Workbench + Tauri Local Agent Runtime 定义为唯一产品内核；旧 Project OS CLI、安装器、评分报告、模板和 adapter 冻结为迁移兼容层，新产品能力不得继续进入旧工具链。目标状态根明确为 `.omnidesk/`，按 `data/runtime/cache/evidence` 分区，必须以幂等、可恢复迁移兼容 `.project-os/`，不能直接改名或删除。下一批实现状态命名空间契约、迁移器和回归；本批未触碰现有桌面交互改动，也未删除旧文件。

- 2026-07-20 终端会话重启边界：终端会话、tab 和屏幕输出目前仅在前端/PTY 内存；Rust 热重启会回收全部嵌入会话，旧屏幕内容无法恢复。本机未安装 `tmux` / `zellij`，不存在可 attach 的持久会话。后续如做持久终端，必须以独立、用户可见的持久 session 能力实现，默认不落盘终端输出；在任何重启/升级前先告知用户会终止的会话数。

- 2026-07-20 修复终端会话“关闭后仍在运行”：Tauri 端此前只 kill PTY shell，Codex / Code host / 后台工具成为残留子进程。现在关闭 tab 或重启会向 `portable-pty` 为该会话创建的独立前台进程组发送 `SIGKILL`，然后回收 shell。`Ctrl-C` 仍只是中断当前命令，保留其非破坏性语义。Rust 64 + patch normalizer 5 和 Cargo check 通过；热重启后先前两个残留 Codex 会话已消失。前端继续使用 xterm.js；不引入 Electron `node-pty` 或不成熟 Tauri wrapper，因为问题在生命周期而非渲染组件。

- 2026-07-20 修复桌面终端 Codex 卡在 `Working`：当前 OmniDesk 的 `.codex/hooks.json` 曾引用 `project-starter-pack` 的绝对脚本路径；工具调用触发 `PreToolUse hook exited with code 127` 后未正常收尾。现已改为当前项目 `.codex/hooks/*.sh` 相对路径，并逐个实际执行验证。已卡住的旧 Codex 进程不会热加载配置，需在桌面终端先停止当前任务，再重新启动 Codex/任务；新会话将使用修复后的 hook。

- 2026-07-20 原生 WebDriver 终端诊断补强：测试构建通过独立端口 `1422` 运行，但此前运行时将它误判为浏览器 Preview，终端根本未启动；现仅在存在 Tauri bridge 时把 `1422` 识别为测试桌面端，普通浏览器仍只读。`test:native` 现在断言终端生命周期确实启动，并在 WKWebView 保存最多 30 个不含输出、输入、路径或密钥的阶段记录。实际点击终端 tab 仍会中断嵌入式 WebDriver session，最小 Tauri+xterm/Radix 夹具不复现，故问题继续收敛在 OmniDesk 终端组合层；常规 native smoke 不把该不稳定点击纳入门槛。

- 2026-07-20 `OmniDesk 桌面端可信开发闭环与可用性收口 v1` 已推进首批：Runtime Patch semantic gate 现在要求计划声明真实工程改动且具备授权文件，检查/讨论类任务不再调用模型生成占位 diff；Apply 也会拒绝 `notApplicable` 草稿。历史“明确不写文件”但仍处于等待审批的任务在读取时被非破坏性投影为 planned，并保留迁移原因和原始证据。Patch Draft 契约和语义校验已迁入 `runtime/patch.rs`，不再由 `app.rs` 拥有。浏览器 Preview 状态栏明确不执行终端、检查或文件写入；桌面端才显示受控执行。性能采样现覆盖启动、路由、对话、终端、Patch 草稿、Patch 应用与受控检查，采样不保存文本、Diff 或输出。验证：Desktop Node 435/435、Runtime Rust 64/64、patch normalizer 5/5、Web build、Preview Smoke 3/3、bundle soft budget（796.31 KiB / 800 KiB）与 diff check 通过。官方 `tauri-driver 2.0.6` 在 macOS 明确不支持，现改用仅测试 feature 启用的 `tauri-plugin-wdio-webdriver`：macOS WKWebView 可通过本机 W3C WebDriver 驱动；`npm --prefix desktop run test:native` 会启动隔离 Tauri 实例和临时工作区，验证对话输入/发送状态，不读取密钥、不写入当前项目，生产和普通开发构建不暴露该 HTTP 端点。当前插件对终端 tab 的 W3C click 会直接中断会话，已停止将其视为验收手段；终端、审批、取消与恢复保持 Native Core 状态机回归，待插件兼容性修复后再补 UI 点击验收，不能伪造 Run 数据冒充模型执行。

- 2026-07-20 `工作区资产分层治理 v1` 已完成前 3 项：`tmp/`、`.project-os/events/`、`transactions/` 和 `locks/` 已明确为本机运行产物并加入忽略；安装脚本会向目标项目同步同一边界。桌面 Runtime 和浏览器 Preview 的默认文件树共同隐藏运行状态、构建输出、依赖缓存和真实 `.env`，但保留 `.env.example`；Project OS 治理事实仍从治理工作面进入。产物清理现在支持 `--dry-run`，默认各保留 200 条 event / 已终态 transaction，永不清理 `prepared` 恢复事务。验证：native tree Rust 回归、Web build、Preview smoke、模板同步和 `bash tests/run-tests.sh` 均通过。下一项仅为收敛 `HANDOFF.md` 的历史，不应与本批混合删除。

- 2026-07-19 `真实桌面任务发布验收 v1` 已完成 Provider 与受控 Patch 候选验证：当前 Llm Gateway / `gpt-5.6-luna` 在 5 个全新 Git fixture（README、React、CSS、Rust 语义、失败检查修复）均产生真实 unified diff，经 1 次 Gateway 审批、应用与对应检查后成功。每个 trace 同时含原始模型输出、usage、审批、应用与检查证据，当前位于 `/tmp/omnidesk-real-desktop-*-trace`。这验证 Hermes、Provider、桌面 patch normalizer 与受控 Tool Gateway 的真实链路；尚未模拟原生 Tauri 窗口的点击审批流程，故只作为发布候选证据，不能覆盖正式 12-case 基线。

- 2026-07-20 原生窗口验收边界确认：`target/debug/OmniDesk` 可启动并加载当前 Provider UI，但仓库没有 Tauri window driver；macOS 坐标/全局键盘尝试不能稳定聚焦 WebView，已停止使用。后续原生 UI 验收应引入稳定 driver，或由用户在桌面 App 内完成一次操作后再读取 Agent Run / task evidence；不能以 Preview 或截图替代。

- 2026-07-19 `Agent 闭环生产化与多 Provider 可用性 v1.1` 已签收：对话、计划和 Patch 草稿在执行前会验证当前 Provider；额度耗尽、认证、模型与网络失败分别记录，并会在已保存且具备 Key 的 profile 中选择可用连接后同步 Hermes。桌面闭环回归覆盖初始草稿、独立审批、应用、检查失败、两轮修复、修复审批、复检成功和完整执行证据；浏览器 Preview 明确拒绝写入型任务。真实 Eval CI 已上传每个 case 的 trace、模型原始输出与 usage，Rust guard 真实路径包含行为断言。最终验证：Desktop Node 425/425、Runtime Rust 60 + patch normalizer 4/4、Web build、Preview smoke 2/2、Runtime 文档检查均通过。保留风险：受保护真实 Provider Eval 仍依赖密钥与 Gateway 可用性；本地浏览器 Preview 不是桌面 Runtime，不能用于验证写入与审批链路。

- 2026-07-19 当前阶段目标 `agent-development-loop-v1-20260719-151357` 已完成：使用 QY profile 连续两轮完整真实 12-case Eval，最终任务成功率 100%、Patch 可应用率 90.9%、检查通过率 100%、恢复成功率 100%，均高于 70% 门槛且通过正式基线不回退检查。正式基线已更新为 `desktop/evals/agent-eval-report.json`，每个 case 保留真实隔离 fixture trace；两轮修复上限回归也已通过。默认 TW Gateway 本轮返回订阅额度不足，未被用于基线。

- 2026-07-19 Agent 开发闭环可靠性 v1：Patch Draft 现显式携带授权文件与上下文文件，Hermes/普通 Provider 输出均先经相同的 unified-diff、路径、hunk 与授权文件校验；Hermes 草稿被拒后只允许带原拒绝原因重生成一次，不能扩大文件范围。本地占位草稿继续不可应用。任务验证失败不再创建脱离原任务的新卡，而是在原任务中保留草稿、应用、检查与失败证据，最多两轮“修复草稿 -> 独立审批 -> 检查”；到达上限显示“修复失败”。Agent Run 持久化 evidence 已记录运行、审批与结果，任务详情和运行结果可展开查看证据。PR 增加 12-case 基线结构/不回退检查，受保护 `Agent Eval` 工作流按日或手动使用密钥运行真实 suite 并上传报告。验证：Desktop Node 421/421、Runtime Rust 57 + patch normalizer 4/4、Web build、Agent Eval 基线检查、Runtime check 与 diff check 均通过。当前正式基线为任务成功率 100%、Patch 可应用率 90.9%、检查通过率 100%、恢复成功率 100%；默认 TW Gateway 的额度错误已被单独记录，未计入能力指标。

- 2026-07-19 Runtime Kernel 与状态事务层 v1 验收：`main.rs` 仅启动 `runtime::app::run()`；Workspace、Conversation、Task、Goal、Agent Run、Provider、Execution 与 Governance 均有明确 Runtime module，核心业务状态通过 Repository 的 schema/lock/atomic transaction 持久化。任务改绑/删除、目标归档合并、对话删除、Agent Run 回写均有跨实体事务与恢复回归；Preview operation contract 对全部 mutation/execute deny，CLI 与 Tauri 的 scan/run/check/report/recommend/prune 共享 `runtime::governance` typed operation，state sync 使用原生 Repository operation。Agent Eval 固定 12-case 数据集与 `desktop/evals/agent-eval-report.json` 已生成真实基线（能力指标偏低但报告完整、证据可追溯）。最终验证：Desktop Node 419/419、Runtime Rust 56/56、CLI Rust 9/9、所有 cargo check、`bash tests/run-tests.sh`、Runtime docs 与 diff 检查通过。保留事项：治理算法当前仍由受控 Shell scripts 实现，未来若要完全去 Shell，应作为新的迁移目标；不能与本 v1 的共享 typed operation 边界混为一谈。

- 2026-07-19 Runtime Kernel / 共享治理 operation 批：新增 `runtime/governance.rs`，集中 `scan/run/check/report/recommend/prune` 的固定 allowlist、脚本路径校验、受限输出与执行 result。CLI 五个治理命令改调 `governance::execute`，Tauri 的 scan/recommend/report/prune 亦改调同一 Runtime operation；`sync` 继续走已有原生 Repository state operation，Preview contract 仍 deny 治理执行。新增跨入口源码边界回归；实际 `cargo run --manifest-path cli/Cargo.toml -- check . --runtime-root . --persist none --output json` 通过，桌面 Rust 56/56、CLI Rust 9/9、cargo checks、Runtime 文档和 diff 检查通过。限制：治理算法仍在既有 Shell scripts，下一阶段才是将算法本身从 Shell 迁入 Rust；但入口调度已不再重复。

- 2026-07-19 Runtime Kernel v1 全量回归：`bash tests/run-tests.sh` 完整通过，覆盖 runtime、文档结构、模板同步、秘密扫描、评分/报告、project runner、artifact pruning、推荐和图谱。聚合 `check-all` 中 `.env.local` 的空 `DEEPSEEK_API_KEY` 仅为已知 warning；专用 secrets check 在纯本地模式零 warning 通过，未读取或输出任何凭据。桌面 Node/Rust/CLI 回归见前述批次。最终未完成范围仍是 CLI legacy governance commands typed-operation 迁移，不能因全量回归通过误报 Runtime Kernel v1 已完全达标。

- 2026-07-19 Runtime Kernel / CLI state sync 读取收口：CLI `state sync` 的 `.project-os/state.json` 不再直接 `fs::read_to_string`，改用共享 `desktop runtime/repository.rs` 的 `Repository::read_json`，随后仍用 CLI schema 校验并以一次 `sync-cli-state` 事务写入 state/bundle。CLI Rust 8/8、`cargo check`、diff 检查通过。剩余：`scan/check/report/recommend/run` 仍是 legacy Shell governance engine，需要明确拆为 typed operation，而不是仅包装 Bash。

- 2026-07-19 Runtime Kernel / Provider JSON 读取收口：Provider config、model catalog、health cache 的 load-or-seed 现通过 Repository JSON 读取和反序列化；`fs::read_to_string` 仅保留 `.env.local` 密钥读取、迁移和测试，避免密钥进入 Repository transaction journal。Provider 定向 Rust 2/2、`cargo check`、diff 检查通过。剩余最终验收重点是 CLI legacy delegates 与 app adapter 中的只读项目扫描路径，不能与 Runtime 状态业务读取混淆。

- 2026-07-19 Runtime Kernel / Task 事务读取收口：Task save/delete 的去重、request-id 幂等、目标索引、任务所属对话、backlog 与 goals 读取都迁入当前 `transaction_with` 的 Repository；移除了业务用 `read_all` 和路径转相对路径 helper。`tasks.rs` 剩余 `fs` 仅用于 `.tmp` 清理、损坏 JSON 隔离和测试，不再参与业务状态读取。Task 定向回归 5/5、`cargo check`、diff 检查通过。下一步可将 Provider 非密钥 JSON 读取与 CLI legacy delegates 纳入最终审计。

- 2026-07-19 Runtime Kernel / Agent Run 锁内读取收口：`recover_stale`、`resume`、`approve` 不再在 `transaction_with` 内以 root 重开 `load/list`，而是用同一 Repository 的私有 `load_from_repository/list_from_repository` 完成锁内读取和提交，消除 Agent Run 恢复与审批的锁外读窗口。Agent Run 定向 Rust 3/3 通过。剩余：Task save/delete 仍有目录扫描 helper，最终事务审计还不能完成。

- 2026-07-19 Agent Eval / 初始基线完成：`desktop/evals/agent-development-cases.json` 的 12 个固定 case 均已在隔离 fixture 产生真实执行证据，汇总报告写入 `desktop/evals/agent-eval-report.json`。初始结果是“数据集 complete”而非“能力通过”：任务成功率 41.7%、patch 可应用率 27.3%、检查通过率 36.4%、恢复成功率 100%、4 次审批、平均 9.2s、成本 0。后续真实 Provider 重跑已将正式基线提升到 100% / 90.9% / 100%；本条保留初始基线作为对比证据。

- 2026-07-19 Runtime Kernel / 查询存储边界收口：`workspace.rs` 的状态与文本读取、Conversation 列表、Agent Run load/list 现全部经 Repository；删除 Agent Run 旧目录 helper，领域模块不再通过直接 `fs::read_to_string/read_dir` 读取这些 `.project-os` 状态。事实指纹扫描和测试读取保留为非状态持久化用途。完整 Rust 55/55 通过；下一步最终审计仍需处理 Task 内部迁移扫描、Provider `.env.local` 特殊密钥路径与 CLI legacy delegates，不能只凭本批判定 Repository 工作完成。

- 2026-07-19 Agent Eval / Conversation archive case：新增 `conversation-archive` 隔离夹具，验收归档状态、固定时间、recoverable 标志和原 task/turn 保留。真实模型以 `...` 代替真实 JSON 字段，导致上下文不匹配；normalizer 在审批前拒绝、零写入。当前已有 9/12 case 的真实 evidence，余下 Provider 校验、Agent Run 中断恢复和检查失败修复必须继续；恢复 case 需要走真实 Agent Run 状态机，不可用普通文件 diff 冒充。

- 2026-07-19 Agent Eval / 跨实体改绑 case：新增 `goal-rebind` 隔离夹具，同时验证 `task.json.goalId/goalTitle`、源目标移除 taskId、接收目标加入 taskId。真实模型输出错误地将 `goalTitle` 写为 goal ID，且 hunk 上下文不匹配；Runtime normalizer 在 approval 前拒绝，零写入。该证据支持现有架构边界：模型只能提出草稿，跨实体一致性必须由 Goal typed operation 的单事务实现，不能以模型补丁替代。当前 Agent Eval 已有 8/12 case 产生真实证据（含成功、失败和安全拒绝），仍不可标记完整。

- 2026-07-19 Agent Eval / 无上下文 hunk 边界批：真实 `test-regression` 模型草稿只包含新增测试、没有原文件上下文，原先会进入审批后才由 Git 拒绝。`runtime/patch.rs` 现要求既有文件 hunk 至少包含一行旧内容，且继续要求唯一匹配；无上下文新增在审批前返回明确拒绝。新增原生回归，Patch 定向 Rust 3/3、Gateway/normalizer Node 10/10 通过。当前该 case 仍是失败证据而非成功能力；后续应补模型实际遵守上下文契约的测试/事务/恢复 case，不能用手写 patch 补齐。

- 2026-07-19 Agent Eval / 多类型夹具扩展批：CLI runner 新增 `react-copy`、`css-token` 和 `rust-guard`；case 现在可声明具体检查命令，Rust guard 会在语义断言前运行 `rustc --crate-type=lib`。真实 React 与 CSS case 均在隔离 Git fixture 经 1 次 Tool Gateway approval 后成功应用并检查通过；CSS 的原始 diff 不可用但规范化后成功。Rust case 的模型擅自假定参数名 `input`，与授权文件 `value` 不匹配，因此被 normalizer 拒绝、零审批，符合安全边界。当前临时报告可汇总为 6/12 completed，仍不完整；继续优先补测试/事务/恢复 case，不能按当前成功率宣称完整 Agent 能力。

- 2026-07-19 Runtime Kernel / Repository query 收口批：Repository 新增 `list_json_records`，只返回 workspace-relative JSON record，不向领域服务暴露绝对路径。Goal 合并和 Task 列表统一改用该查询接口，Goal service 不再自行遍历 `.project-os/runs/desktop-tasks`；原子合并仍在同一个 `transaction_with` 锁内完成。新增 Repository 相对路径枚举回归，Rust 54/54 通过，Task 定向回归通过。剩余：Task 保存/删除的内部扫描和 CLI legacy shell delegates 仍需继续迁入或明确收敛，完整三入口统一与 12-case Agent Eval 不可标记完成。

- 2026-07-19 Agent Eval / Patch 通路一致性批：新增离线 Rust binary `omnidesk-patch-normalizer`，复用桌面 ACP 的 `runtime/patch.rs` 归一化逻辑；Hermes CLI runner 现在保存 `rawPatchApplicable` 与 `normalizedPatchApplicable`，并经真实 Tool Gateway 审批后应用规范化 diff。修复 Gateway 以 `trim()` 转发 diff 而丢失终止换行的问题，并令 Node/Rust 两条路径都在审批前拒绝不完整 hunk。真实 `readme-copy` 的原始 diff 不可直接应用，但规范化后经 1 次审批、`git apply`、`git diff --check` 成功，证据在 `/tmp/omnidesk-agent-eval-readme-normalized-results-3.json`；`json-schema-field` 真实输出与授权夹具上下文不匹配，现明确拒绝且零审批，证据在 `/tmp/omnidesk-agent-eval-json-schema-results-2.json`。同时修复无匹配上下文时的 patch normalizer panic；Rust 53/53、Desktop Node 416/416、Runtime 文档检查与 diff 检查通过。剩余：runner 仅实现两个 case，完整 12-case 基线、ACP 续跑和恢复 case 仍未完成，不能标记 Agent Eval 完成。

- 2026-07-19 Agent Eval / Hermes CLI runner 批：新增 `desktop/scripts/run-agent-eval-hermes-cli.mjs`，目前只实现 `readme-copy`，在全新 Git fixture 中调用当前 `omnidesk-gateway / gpt-5.6-terra`、写入原始模型输出和 usage、通过真实 Tool Gateway 创建 approval、再运行 `git apply --check`/apply/`git diff --check`。真实结果为模型正常返回但 hunk 缺少上下文，Gateway approval 1 次、`git apply` 报 `corrupt patch at line 5`，因此按实记录 `success/patchApplicable/checksPassed = false`，报告 `/tmp/omnidesk-agent-eval-readme-report.json` 为 `1/12 incomplete`。剩余：产品 Rust parser 会修复部分 hunk 漂移，runner 还未复用该 parser；必须先抽取可复用的受控 diff 归一化 operation，再继续扩充 ACP case，不能把 CLI 原始 diff 指标误称为完整产品基线。

- 2026-07-19 Runtime Kernel / Native Agent Patch 边界批：发现 Node Tool Gateway 已拒绝 `.env*`，但 Rust Hermes ACP loop 创建 `apply_patch` approval 时未执行等价校验，原生批准后可直接进入 `git apply`。新增 `validate_apply_patch_diff`，在原生 Apply 与 Hermes 创建审批前共同校验完整 header、相对路径、目录逃逸和 `.env*`；补 Native 回归，并在 `docs/LESSONS.md` 记录“每条审批/Apply 路径都必须独立验边界”。验证：Rust 51/51、`cargo check`、`git diff --check` 通过。剩余：这修复了真实执行安全前提，Agent Eval 仍需完成 10 个隔离 ACP/Tool Gateway case。

- 2026-07-19 Runtime Kernel / Preview 只读收口批：物理删除 Vite Preview 内无路由的任务恢复、事实 freshness 写入、Provider 模型测试/健康缓存写入及 Project OS 执行 helper，避免浏览器端继续携带任何业务写入或命令执行实现；保留状态读取、路径扫描、只读 Agent Tool、Patch Draft 与复制文本。`runtime-operation-contract` 的拒绝 middleware 仍在所有 Preview handler 之前。验证：静态写入 API 检索为空、Desktop Node 413/413、`npm --prefix desktop run web:build`、`git diff --check` 通过；构建仍有既有主 bundle 806.81 kB 警告。下一步：在隔离 fixture 上继续建设真实 ACP/Tool Gateway Agent Eval runner，12-case 基线仍不能标记完成。

- 2026-07-19 Agent Eval 真实证据批二：新增 `desktop/scripts/run-agent-eval-safety.mjs`，在隔离临时 fixture 中经真实 OmniDesk Tool Gateway 请求 `.env` patch、保存 trace 和结构化 result；对应回归已加入。实际 Hermes CLI 使用当前 `omnidesk-gateway / gpt-5.6-terra` 在独立 Git README fixture 上执行 `readme-copy` 两次，模型均返回 hunk 行号/行数不正确的 unified diff，`git apply --check` 失败，故按真实结果记录失败而非重写成功。结果 `/tmp/omnidesk-agent-eval-results-v1.json`、报告 `/tmp/omnidesk-agent-eval-report-v1.json` 诚实显示 `2/12 incomplete`、success 0.5、patch/check 0。验证：安全 runner 进入 Desktop Node 回归，当前 413/413。剩余：其余 10 个 case 必须继续在隔离 fixture 上走真实 ACP/Tool Gateway 执行；不要用 prompt 预设或手填 result 替代实际 trace。

- 2026-07-19 Runtime Kernel / Workspace backlog 批：`update_task_backlog_item` 的路径、状态白名单、项目任务读取与持久化已迁入 `runtime/workspace.rs::update_backlog_item`；服务使用 `transaction_with` 在锁内读取并提交 backlog，command adapter 只转发输入。新增 backlog 状态与单事件回归。验证：Rust 46/46、`cargo check`、Runtime 文档检查和 `git diff --check` 通过。剩余：Vite Preview 写入 helper 虽无 route 但尚未删除；CLI legacy command 和 Agent Eval 真实 12-case 基线仍未收口。

- 2026-07-19 Runtime Kernel / CLI 原子写入批：CLI `config init` 与 Entry Context 持久化不再直接 `fs::write`，已复用 desktop Repository 的 `write_atomic`；state sync 继续使用完整 Repository transaction。验证：CLI Rust 7/7、`cargo check`、完整 `tests/run-tests.sh` 通过；治理聚合检查内的 `.env.local` 空 `DEEPSEEK_API_KEY` 仅产生已知 warning，专用 secrets check 按纯本地扫描通过，未读取或输出任何凭据。剩余：CLI legacy `scan/check/report/recommend/run` 仍委托 shell runner，尚未直接调用 typed Runtime operation；真实 Agent Eval 仍未完成 12-case 基线。

- 2026-07-19 Runtime Kernel / 三入口权限批：发现 Preview contract 原先允许 Provider、任务、对话、目标、项目 registry、能力、记忆及受控检查写入，且 Vite middleware 维护这些业务副本，违反“Preview 只读降级”的目标。`runtime-operation-contract` 现将全部 mutation / command 执行标记 `deny`，仅保留查询、只读 Agent Tool、项目扫描和 Patch Draft；Vite middleware 在所有兼容 handler 之前按同一 contract 返回 403，防止直接 HTTP 绕过，并已物理移除全部 deny operation 的 Vite route。相关测试改为桌面端专属拒绝断言，并拆为每个受限 operation 的独立测试；新增断言确保 Vite 不再声明 deny route。验证：Desktop Node 412/412、`npm run web:build`、Runtime 文档检查和 `git diff --check` 通过；构建仍有既有主 bundle 806.81 kB 警告。剩余：Vite 内旧 Preview 写入 helper 已不可达但尚未物理删除；下一批删除这些函数与只为其服务的工具依赖，再验证 Preview 只保留明确的只读实现。

- 2026-07-19 Runtime Kernel / 状态事务层第三十五批：`run_goal_validation` 保留在 app/Execution 边界执行受控检查，但其结果持久化迁入 `runtime/goals.rs::record_validation`。检查证据生成后，报告、验收标准目标状态与 goals 状态在 Repository 锁内核验并以单个 operation 提交；新增三份状态与单事件回归。验证：Rust 45/45、`cargo check` 无新增告警、Goal 定向 7/7、Runtime 文档检查和 `git diff --check` 通过。剩余：验收 command 仍在锁外读取初始目标标题用于执行前展示，提交阶段会再次验证目标存在；后续可将受控验收 request 抽为 typed Execution request。CLI/Preview 与真实 Agent Eval 仍是本目标未完成部分。

- 2026-07-19 Runtime Kernel / 状态事务层第三十四批：目标验收签收由 `runtime/goals.rs::sign_off_validation` 接管。该 service 在同一 Repository 锁内核验报告/验收标准与目标一致性，并一次提交验收状态、签收历史和目标完成状态，Tauri command 仅定位当前项目与调用 operation。新增跨三份状态文件的单事件回归。验证：Rust 44/44、`cargo check`、`git diff --check` 通过。剩余：`run_goal_validation` 的受控检查执行必须留在 Execution 边界，但其报告/状态回写仍在 app command，下一批应拆分为 Execution 产出检查证据 + Goal service 事务提交。

- 2026-07-19 Runtime Kernel / 状态事务层第三十三批：`get_workspace_snapshot` 的 state、recommendation、backlog、目标验收/签收、workspace facts、goals 和 project-goals 九类持久化读取集中到 `runtime/workspace.rs::load_projection_state`；Tauri adapter 保留现有 DTO 与展示 fallback，不再逐一拼接运行态文件路径。新增 projection 默认文档回归。验证：Rust 43/43、`cargo check`、`git diff --check` 通过；桌面端完整 Node 回归 407/407 通过。剩余：目标验收及 recommendation plan 仍在 app adapter 内聚合状态，后续按 Goal/Execution service 拆分；真实 Agent Eval 仍仅 2/12 记录，必须继续通过 ACP/Tool Gateway 产生证据，不能手填补齐。

- 2026-07-19 Runtime Kernel / 状态事务层第三十二批：项目记忆和项目档案的 storage path、默认 payload、schema version、字段白名单、状态归一化和锁内写入均迁入 `runtime/workspace.rs`。`get/save_project_memory` 与“对话更新项目档案”Tauri command 现在只解析当前项目并调用 typed Workspace operation；档案服务会丢弃未受支持字段、收敛 confidence，并以一个 Repository event 提交合法 patch。新增记忆单一 owner 与档案字段过滤/事件回归。验证：Rust 42/42、`cargo check`、`git diff --check` 通过。剩余：snapshot / workspace projection 仍在 `app.rs` 直接汇总若干只读状态路径；下一批将迁移只读投影，随后继续 CLI typed operation 和真实 Agent Eval 12-case 基线。

- 2026-07-19 Runtime Kernel / 状态事务层第三十一批：Provider 密钥读取、写入、删除和同名隔离迁移已移入 `runtime/provider.rs`；`.env.local` 继续不进入 Repository journal（防止事务日志记录明文 Key），但改用同一原子替换原语，避免截断写入。项目能力 manifest 的新增与编辑迁入 `runtime/workspace.rs`，由 `transaction_with` 在锁内读取、合并 modules、写入和发出事件；`app.rs` command 不再拼接 capability 路径或维护业务副本。项目档案对话更新也已改为锁内 read-modify-write。验证：Rust 40/40、`cargo check`、Runtime 文档检查和 `git diff --check` 通过。剩余：workspace snapshot 与项目记忆仍有 adapter 层直接读取的投影逻辑，CLI 其他 legacy command 与完整 12-case 真实 Agent Eval 尚未收口，不能声称三入口/评测基线完成。

- 2026-07-19 Runtime Kernel / 状态事务层第三十批：Repository 新增独立的 UTF-8 文本事务边界，供 Markdown 治理文档使用而不放宽 `.project-os/runs/*` JSON schema 校验。`desktop-summary.md` 与 `HANDOFF.md` 的摘要追加现在均在同一 Repository 锁内完成读取、追加、prepared journal、提交和事件写入；中断恢复可按 journal 中的文本快照精确还原此前 Markdown。新增连续追加与 prepared text recovery 回归。验证：Rust Runtime 38/38、`cargo check`、`git diff --check` 通过。剩余：`runtime/app.rs` 仍有若干直接 `.project-os` 读取/旧写入辅助函数，需按领域优先级继续收口；不能据此声称所有持久化路径已经统一。

- 2026-07-19 Agent Gateway 安全批：真实 Gateway Eval 暴露 `apply_patch` 只防路径越界、未阻止根目录内 `.env` 的缺陷；修复 `normalizeDiffPath` 后，任何 `.env*` diff 会在创建 approval 前直接返回 `denied`。新增 Agent Tool Gateway 回归，并用隔离 fixture 上的真实 Gateway 调用确认结果。评测契约现在支持 `omnidesk-tool-gateway` 作为确定性安全 case 的执行器。验证：Gateway/Eval 定向 10/10、diff 检查通过。剩余：将该 trace 写入完整 Eval 结果并继续 ACP 写入、审批与恢复 cases。

- 2026-07-19 Agent Eval 真实证据批：评测结果现在强制包含 `executor / fixture / executedAt / tracePath` 和完整指标，缺证据、未知或重复 case 一律拒绝汇总，避免手填 JSON 被误报为基线。当前模型 `omnidesk-gateway / gpt-5.6-terra` 已在全新隔离 Git fixture 上真实执行 `readme-copy`：原始 Hermes diff 写入 trace、`git apply --check` 与实际 apply 均通过、`npm test` 和 `git diff --check` 通过。报告位于临时 `/tmp/omnidesk-agent-eval-report-v1.json`，诚实显示 `1/12 incomplete`。限制：该记录使用 Hermes CLI 只读 diff，而非 ACP Tool Gateway；安全、写入审批、恢复与其余 11 个 case 仍需走产品实际 ACP 路径后才能形成正式基线。

- 2026-07-19 Runtime Kernel / 状态事务层第二十九批：原生 CLI 的 `state sync` 不再直接 `fs::write` state 和 state bundle，而是编译复用 `desktop/src-tauri/src/runtime/repository.rs`，以一次 `sync-cli-state` Repository transaction 同步写入 `.project-os/state.json` 与 state bundle，并生成包含两个路径的事件。`tests/run-tests.sh` 已在独立 fixture 断言 state、bundle 和 Repository event；CLI `cargo test/check` 与全套治理测试通过。验证中曾误将仓库根目录当作写入 target，已精确恢复本次改写字段和三个生成产物，并在 `docs/LESSONS.md` 增加“写入 CLI 必须使用隔离夹具”约束。剩余：CLI 其余 legacy command 仍未直接使用 Runtime typed operation，继续收口前不可声称三入口统一完成。

- 2026-07-19 Agent 受控续跑批：修复“批准并继续”只执行一次工具、未向 Hermes 返回结果的断点。Desktop client 现在在独立批准并执行 `apply_patch` / `run_check` 后，将受控结果作为有界上下文重新提交 Hermes；执行器协议明确允许模型请求这两类工具，但每次仍会暂停等待独立审批。新增续跑上下文回归。验证：Desktop 404/404、Rust 36/36、`cargo check`、Runtime 文档检查和 `git diff --check` 通过。限制：这是跨 ACP session 的受控续跑，不保留原 ACP 进程会话；真实 Eval 仍需用该路径完成剩余 10 个隔离案例。

- 2026-07-19 Runtime Kernel / 状态事务层第二十八批：已物理删除 `runtime/app.rs` 内 Goal 归档、恢复、合并的 legacy 对照实现，Tauri command 仅负责项目解析、调用 `runtime/goals.rs` 和返回快照，避免目标事务出现第二条可漂移的业务路径。Hermes 配置同步现在无论 `providers:` 是否已存在，都会更新 `omnidesk-gateway` 的 `base_url/default_model/api_mode/key_env`，并保留该 provider 的无关字段及其他 provider；新增已有 provider 配置覆盖回归。验证：Rust 36/36、Desktop 403/403、Runtime 文档检查和 `git diff --check` 通过。Rust `cargo fmt --check` 仍会报告既有 runtime 文件的全量格式化差异，未自动格式化以避免扩大当前脏工作区。下一步：让 Agent Eval 通过实际 ACP Tool Gateway 执行安全/写入用例，并完成真实 12-case 基线。

- 2026-07-19 Hermes ACP Profile 注入修复：`run_hermes_acp_prompt`、structured patch draft 和 `run_hermes_agent` 现在显式传入并注入当前 `ProviderConfig.api_key_env`，不再只依赖按 host 推导的环境变量；自定义 profile 切换后 ACP 仍可取得正确凭据。Hermes 配置同步同时写入无明文 `key_env` 和缺省 `providers.omnidesk-gateway` 注册。验证：Rust ACP 定向回归、`cargo check`、Rust 全量 35/35、Desktop 403/403 通过。

- 2026-07-19 Agent Eval 真实基线启动：隔离 fixture 上的 `readme-copy` 通过真实 Hermes 生成 diff、受控 apply、`npm test` 和 diff check；`unsafe-path` 裸 Hermes CLI 只要求进一步确认，未直接拒绝 `.env` 修改，按用例预期计为失败。当前报告 `2/12` completed、`1/2` success、`1/2` patchApplicable/checkPass。结论：裸 Hermes CLI 不能代替 OmniDesk Tool Gateway 的路径/审批策略；后续 write/safety 用例必须通过 ACP structured loop / Agent Tool Gateway 执行，才能测到产品实际安全边界。

- 2026-07-19 真实 Hermes Provider 探测：`hermes-acp --check` 通过，TW Gateway / `gpt-5.6-terra` 在显式加载 `.env.local` 的 `LLM_GATEWAY_API_KEY_LLM_GATEWAY` 后，使用 Hermes 命名 `custom_providers` + `key_env` 配置成功返回 `PONG`。首个隔离 fixture（README 命令文案）真实生成 unified diff，`git apply --check` 通过且仅修改预期一行。发现 Hermes 顶层 `model.provider: custom` 不会读取 OmniDesk 的 Key 注入，必须使用命名 custom provider 的 `key_env`；`render_hermes_runtime_config` 已开始同步 `key_env` 和 `omnidesk-gateway` provider 名。剩余：使同步函数在干净 Hermes config 中创建/更新 `custom_providers` 条目，再批量执行 12 个 Eval case。

- 2026-07-19 Runtime Kernel / 状态事务层第二十七批：目标合并 command 已切到 `runtime/goals.rs`。一个 Repository 事务同步迁移 desktop task 的 `goalId/goalTitle`、聚合接收目标 taskIds、标记源目标 merged、切换 activeGoalId，并清理 project-goals stage 索引。新增完整目标合并回归；夹具使用真实 `project-os.desktop-task.v0.1` schema，确认运行态版本边界不因测试而放宽。验证：Goal Runtime 5/5、`cargo check`、diff 检查通过。下一步：物理删除 `app.rs` 中 archive/restore/merge 的 legacy 对照实现并跑完整回归。

- 2026-07-19 Runtime Kernel / 状态事务层第二十六批：归档与恢复 command 已切换到 `runtime/goals.rs` 服务，实际运行路径不再在 Tauri command 内拼装跨实体 mutation；新增归档/恢复 project-goals 索引互逆回归。`app.rs` 仍保留两段明确标注为 `legacy` 的对照实现，待合并目标一起物理删除，避免在同一批混合迁移造成行为漂移。验证：Goal Runtime 4/4、`cargo check`、diff 检查通过。

- 2026-07-19 Runtime Kernel / 状态事务层第二十五批：目标创建、编辑、切换、确认和拆解已迁入 `runtime/goals.rs`，Tauri command 只负责当前项目解析与快照返回。特别修复了创建目标原先分两次写入 `goals.json` 和 `project-goals.json` 的半完成风险，现在父项目目标校验、stageGoalIds 索引和新目标创建由同一 Repository 锁内事务提交并生成一个事件。新增 Goal Runtime 2 项事务回归。验证：Goal Runtime 3/3、`cargo check`、diff 检查通过；完整 Rust/桌面回归待本批收口后复跑。

- 2026-07-19 Runtime Kernel / 状态事务层第二十四批：目标合并已切换到 Repository `transaction_with`。源/接收目标校验、任务 goalId 迁移、taskIds 聚合、activeGoalId 切换、project-goals 索引同步和多文件提交在同一锁内完成，收口目标体系三类跨实体操作的并发边界。验证：Goal Runtime 1/1、`cargo check`、diff 检查通过。

- 2026-07-19 Runtime Kernel / 状态事务层第二十三批：目标恢复已切换到 Repository `transaction_with`，读取归档目标、恢复状态、重新绑定 project-goals stageGoalIds 和提交 mutation 均在同一锁内完成，与目标归档形成一致的互逆并发边界。验证：Goal Runtime 1/1、`cargo check`、diff 检查通过。

- 2026-07-19 Runtime Kernel / 状态事务层第二十二批：目标归档已切换到 Repository `transaction_with`，目标及 project-goals 的读取、关联任务校验、activeGoalId 重选、stageGoalIds 同步与提交 mutation 在同一锁内完成，消除归档与任务/目标并发变更的读写窗口。验证：Goal Runtime 1/1、`cargo check`、diff 检查通过。

- 2026-07-19 Runtime Kernel / 状态事务层第二十一批：Provider 模型健康缓存新增锁内 `record_health` upsert，`test_provider_model_with_cache` 不再先读整份缓存后覆盖写入；同模型更新原条目，不同模型并发复测不丢记录，缓存持久化失败会显式返回错误。Provider 回归覆盖重复模型覆盖而非重复插入。验证：Provider Runtime 1/1、`cargo check`、diff 检查通过。

- 2026-07-19 Runtime Kernel / 状态事务层第二十批：Agent Run 的启动恢复、人工恢复与审批状态迁移已使用 Repository `transaction_with`。读取 Run、检查当前状态、更新 revision / approval token / approval 子状态及提交 mutation 均在同一锁内完成；批量启动恢复也以一次 operation 回写。验证：Agent Run 3/3、`cargo check`、diff 检查通过。

- 2026-07-19 Runtime Kernel / 状态事务层第十九批：Task 删除已迁入 Repository `transaction_with`。任务、本属对话、目标 taskIds 与 backlog 的读取和整组删除 mutation 构造在同一锁内完成，避免并发保存/删除之间的旧状态覆盖。验证：Task Runtime 5/5、`cargo check`、diff 检查通过。

- 2026-07-19 Runtime Kernel / 状态事务层第十八批：Task 保存已使用 Repository `transaction_with`。任务去重、request-id 幂等检查、目标索引读取与多文件 mutation 构造现在在同一锁内完成，避免并发保存基于旧状态产生索引漂移；无变更去重请求不额外生成事务。验证：Rust 31/31、`cargo check`、diff 检查通过。

- 2026-07-19 Runtime Kernel / 状态事务层第十七批：Repository 新增 `transaction_with` 锁内准备 API，支持领域服务在同一 Repository 锁内完成读-改-写 mutation 构造与提交。Execution 审计已切换到该 API，避免并发 action 对当前 audit 集合的先读后锁竞争与记录丢失。新增 Repository 锁内读改写回归。验证：Rust 31/31、`cargo check`、diff 检查通过。

- 2026-07-19 Runtime Kernel / 状态事务层第十六批：新增跨项目领域隔离回归，两个项目根目录中的同名 Task、Conversation 与 Agent Run 仍保持独立读取和持久化，覆盖项目切换不交叉污染的基础状态边界。验证：Task Runtime 5/5、`cargo check`、diff 检查通过。

- 2026-07-19 Runtime Kernel / 状态事务层第十五批：修复 Agent Run 读取路径未复用 id 校验的问题。现在 load/resume/approve/execute 与 persist 共用受限 relative-path helper，拒绝 `..` 和嵌套路径；新增回归并在 `docs/LESSONS.md` 记录“状态读写共享路径边界”约束。验证：Agent Run 3/3、`cargo check`、diff 检查通过。

- 2026-07-19 Runtime Kernel / 状态事务层第十四批：新增 `runtime/execution.rs`，将 Patch Apply、Guarded Check、治理动作的执行审计从 command 层无锁 `execution-audit.jsonl` 迁为 `.project-os/runs/execution-audit.json` 的版本化 Repository 事务记录，保留 2,000 条上限并由 Repository 生成事件；成功与失败都记录审计状态。新增执行审计事务回归。验证：Rust 28/28、`cargo check`、diff 检查通过。

- 2026-07-19 Runtime Kernel / 状态事务层第十三批：新增 `runtime/provider.rs`，接管 Provider 配置、模型目录、模型健康缓存的 schema 类型、seed/load/save/upsert 和 Repository 事务写入。`app.rs` 保留 Provider command 输入校验、`.env` 密钥读写、网络探测和 Hermes 运行配置同步，避免将外部副作用下沉到状态服务。新增 Provider 状态回归。验证：Rust 27/27、`cargo check`、diff 检查通过。

- 2026-07-19 Runtime Kernel / 状态事务层第十二批：修复 Agent Run 审批状态机断裂。此前审批将 Run 置为 `queued`，但受控工具执行 guard 只接受 `awaiting-approval`，使审批后的 Patch/Check 无法继续。现在审批只标记 approval 为 `approved` 并保存 token，Run 保持在执行门状态直到工具实际消费；新增约束同步记录至 `docs/LESSONS.md`。验证：Agent Run 回归 2/2、`cargo check`、diff 检查通过。

- 2026-07-19 Runtime Kernel / 状态事务层第十一批：新增 `runtime/agent_runs.rs`，接管 Agent Run 的 schema 化状态模型、合法 id 路径、Repository 持久化、列表、启动恢复、人工恢复和审批迁移。进程启动会在 Repository 事务恢复后将遗留运行中 Agent Run 标记为可恢复中断。Tauri command 仅解析输入与当前根目录；`app.rs` 保留 Hermes ACP 进程与已批准工具的执行适配。新增 Agent Run 恢复及审批持久化回归。验证：Rust 26/26、`cargo check`、Runtime 文档检查和 diff 检查通过。

- 2026-07-19 Runtime Kernel / 状态事务层第十批：`runtime/tasks.rs` 已接管桌面任务的完整领域生命周期：查询、存储恢复、保存时的 schema/trace 标记、同目标同标题去重、request-id 幂等、目标索引改绑，以及跨实体删除。`save_desktop_task` / `delete_desktop_task` 现在仅解析当前项目并适配调用，已移除 `app.rs` 内不可达的旧删除实现和遗留 Task 保存 helper，避免第二条业务路径。新增 Task 保存幂等/去重/目标改绑、恢复隔离回归。验证：Desktop 403/403、Rust 25/25、`cargo check`、Runtime 文档检查和 diff 检查通过。

- 2026-07-19 Runtime Kernel / 状态事务层第九批：operation contract 新增防漂移回归，所有 registry 中 `preview: allow` 的 endpoint 必须在 Vite Preview server 有路由处理；避免浏览器 adapter 与 Preview server 静默失配。验证：Desktop 403/403、Web build、Runtime 文档检查和 diff 检查通过。Web build 仍有既有主 bundle 超过 500kB 警告。

- 2026-07-19 Runtime Kernel / 状态事务层第八批：`runtime/tasks.rs` 新增任务删除跨实体事务，`delete_desktop_task` 已切到领域服务；同一 operation 原子删除任务、其绑定对话、目标 taskIds 与 backlog 项，并由 Repository 记录事件。新增端到端模块回归。旧 command 的删除实现暂保留为不可达兼容块，待任务保存整体迁移时同批删除，不能让其恢复为第二条执行路径。验证：Rust 25/25、Cargo check、diff 检查通过。

- 2026-07-19 Runtime Kernel / 状态事务层第七批：`runtime/tasks.rs` 接管桌面任务查询、排序与 manifest 过滤，Tauri command 只保留项目解析和既有历史临时文件清理。新增任务查询顺序/manifest 过滤回归。验证：Rust 24/24、Cargo check、diff 检查通过。任务保存/删除的整组跨实体事务仍在 `app.rs`，待作为下一批完整迁移。

- 2026-07-19 Runtime Kernel / 状态事务层第六批：Repository 对 `.project-os/runs/*` 的新写入增加 schemaVersion 强校验，未版本化运行状态在 journal 前即被拒绝；保留历史治理文件的兼容读取。新增未版本化运行记录拒绝回归，并把相关任务夹具升级为真实 schema。验证：Rust 23/23、Cargo check、diff 检查通过。

- 2026-07-19 Runtime Kernel / 状态事务层第五批：删除 `runtime-api.js` 内遗留的 Preview 匿名命令表，浏览器调用现在只读取 `runtime-operation-contract.js` 的 operation metadata，避免前端同一命令存在两份 endpoint/error 定义。验证：Desktop 402/402、Web build、diff 检查通过。Task 服务仍待完整迁出，不能只抽路径 helper；其现有保存/删除包含去重、目标索引、关联对话和 backlog 的跨实体事务。

- 2026-07-19 Runtime Kernel / 状态事务层第四批：`runtime/conversations.rs` 已接管桌面对话的读取、规范化保存和删除，所有持久化经 Repository transaction；Tauri command 仅解析当前 registry 项目并适配输入。模块回归确认保存、列出和删除会留下 Repository 事件。验证：Desktop 402/402、Rust 22/22、Cargo check、Web build 与 diff 检查通过。剩余：继续拆 Task/Goal、Agent Run、Provider、Execution；Preview/Tauri/CLI 未完成同一 operation contract，真实 Eval 基线仍缺。

- 2026-07-19 Runtime Kernel / 状态事务层第三批：Runtime 启动时现在会先恢复 OmniDesk 根目录及 registry 已接入项目中残留的 prepared 事务，再创建 Tauri 窗口；恢复不再依赖下一次写入触发。验证：Rust 21/21、Cargo check 与 diff 检查通过。剩余边界不变：继续按领域拆 `runtime/app.rs`，并完成 Preview/Tauri/CLI 同一 operation contract 和真实 Agent Eval 基线。

- 2026-07-19 Runtime Kernel / 状态事务层第二批：目标归档、恢复与合并现在以单次 Repository transaction 同步更新 `goals`、`project-goals` 和受影响任务，故障恢复与事件日志覆盖完整业务操作；工作区新鲜度和能力扫描已迁入 `runtime/workspace.rs`，事实记录和能力更新也通过 Repository 写入。前端新增显式的 Preview operation metadata registry，运行时适配层据此执行 transport / policy。新增工作区和 operation contract 回归，验证：Desktop 402/402、Rust 21/21、Cargo check、Web build、Runtime/模板同步和 diff 检查通过。剩余：继续删除 `runtime/app.rs` 中已迁出的旧扫描实现，并按 Workspace/Conversation/Task/Agent Run/Provider/Execution 完成模块拆分；Preview/Tauri/CLI 的操作契约和真实 Agent Eval 基线仍未完成。

- 2026-07-19 “统一 OmniDesk Runtime Kernel 与状态事务层 v1”第一批完成：`desktop/src-tauri/src/main.rs` 已降为纯启动入口，Native Runtime 迁入 `runtime/app.rs`；新增 `runtime/repository.rs`（路径约束、原子写入、锁、可恢复多文件事务和事件日志）、`runtime/goals.rs`（目标状态与任务索引）和 `runtime/agent_tools.rs`（受限读取工具）。任务保存/删除、对话保存/归档/删除、项目记忆、Agent Run、目标验收/签收、目标与任务池、项目档案、registry、Provider 配置、模型目录、模型健康和主题偏好已进入统一 Repository。验证：Desktop 400/400、Rust 19/19、Cargo check、Web build、Runtime/模板同步和 diff 检查通过。剩余：继续将 Workspace、Conversation、Task、Agent Run、Provider、Execution 从 `runtime/app.rs` 细分为领域模块，并建立 Preview/Tauri/CLI 统一 operation contract 与真实 Agent Eval 数据集。

- 2026-07-18 “桌面端真实开发闭环 v1”已完成签收：OmniDesk 保留对话、目标任务、权限和项目记忆，Hermes ACP 作为首个可选 Agent Executor；上下文读取、受控工具、Patch、独立确认、Apply、验证、结果回写、取消、恢复和审计均已落地，浏览器保持只读，`browse / governed / controlled` 权限边界有自动化覆盖。最终回归：Desktop 400/400、Rust 14/14、Web build、Runtime、模板同步和 `git diff --check` 全部通过。Web build 仍提示主 bundle 超过 500 kB，这是性能优化项，不阻断 v1。

- 2026-07-18 “桌面端真实开发闭环 v1”最终 E2E 通过：确认此前 401 来自 Hermes host-scoped 凭据优先级；按真实 App 环境同时注入 `OPENAI_API_KEY + FIRSTSHARE_API_KEY` 后，当前 `TW Gateway / gpt-5.6-terra` 的 ACP `initialize / session/new / session/prompt` 返回结构化 final。Hermes 生成 `tmp/omnidesk-agent-e2e.txt` 的 unified diff，`git apply --check` 通过，文件从 `before` 更新为 `after`，Runtime 检查 0 warning，Hermes Rust 定向 6 项和 diff 检查通过。审计记录写入 `.project-os/runs/agent-runs/agent-real-provider-e2e-20260718.json`。

- 2026-07-18 “桌面端真实开发闭环 v1”阶段 1 完成：新增 Agent Run 严格校验、JSON 持久化格式、恢复与结算生命周期。`interrupted` 现在是可恢复暂停态，不再伪装成最终失败；恢复时递增 `attempt`，重启前进程的迟到结果会被拒绝；`succeeded / failed / cancelled` 保持唯一最终结果。Agent Run 增加 `attempt / revision`，Schema 和项目模板已同步。验证：Agent/Conversation 定向 14 项、Desktop 全量 391 项通过。下一步进入受项目根目录、访问模式和审批策略约束的 Tool Registry / Gateway。

- 2026-07-18 “桌面端真实开发闭环 v1”阶段 2 完成：新增受控 `Tool Registry / Gateway`，登记 `list_files`、`read_file`、`search_project`、`git_status`、`generate_patch`、`apply_patch`、`run_check` 七个工具；未知工具、任意命令、路径逃逸和 Diff 头路径逃逸均拒绝，写入/执行需要独立审批，浏览器预览只允许读取。Tauri 与 Preview 共用 `execute_agent_read_tool` 命令，Native Core 对目录、文件、搜索和 Git 状态施加根目录、敏感路径、数量和字节上限。验证：工具网关定向 6 项、Runtime/Preview 定向 18 项、Cargo check、Web build、git diff check 通过。下一步进入 Hermes ACP 多轮工具循环。

- 2026-07-18 阶段 3 进行中：新增结构化 Hermes Loop 协议层，要求执行器每一步只返回 `tool_call` 或 `final` envelope；所有 tool call 经 Gateway 处理，Observation 回传下一步，写入/执行在独立审批前暂停，未知输出、未知工具和步数超限明确失败。纯运行时测试已覆盖真实循环语义；当前仍需把 Loop 接入 Tauri 的真实 ACP transport、对话进度事件和恢复存储，不能把现有一次性 Patch Draft 误称为多轮执行。

- 2026-07-18 阶段 3 继续推进：新增 `run_hermes_agent` Tauri command，复用 Hermes ACP stdio、取消 Token、当前 Provider 配置同步和结构化多轮 prompt；只读工具结果由 Native Core 回传，写入/检查返回 pending approval。阶段中出现的 HTTP 401 后续已定位为 Hermes host-scoped 凭据优先级，并通过同时注入 `OPENAI_API_KEY + FIRSTSHARE_API_KEY` 解决；真实模型 E2E 已通过。

- 2026-07-18 阶段 4 开始：`run_hermes_agent` 会将 Agent Run 持久化到 OmniDesk 的 `.project-os/runs/agent-runs/`，记录 `queued / running / awaiting-approval / succeeded / failed / cancelled`；下一次执行器启动时会把遗留的活动记录转为 `interrupted`，避免永久转圈并保留恢复依据。新增 Rust 恢复单测通过。尚未完成对话进度事件、审批按钮和恢复动作投影。

- 2026-07-18 阶段 4 继续：执行结果工作面现在通过共享 `list_agent_runs` 读取最近 Agent Run，并以只读列表展示执行器、状态、步数和摘要；App 按当前项目过滤记录，浏览器同样只读。验证：Web build、Domain boundary 73 项、Runtime 定向和 diff 检查通过。仍需把审批与恢复动作做成可操作的对话事件。

- 2026-07-18 阶段 4 恢复动作落地：Agent Run 持久化原始 prompt；Tauri `resume_agent_run` 只接受 `interrupted` 且有 prompt 的记录，递增 attempt 后再由 Desktop execution client 重新启动 Hermes。执行结果工作面对 interrupted Run 展示“恢复执行”，浏览器明确拒绝恢复。验证：Web build、Domain boundary 85 项、Cargo check、Runtime 定向和 diff 检查通过。审批继续保持独立确认边界，尚未开放自动批准。

- 2026-07-18 阶段 4 审批状态落地：Agent Run 持久化结构化 approval；Tauri `approve_agent_run` 只接受 `awaiting-approval` 且存在 approval 的记录，批准后递增 attempt 并由 Desktop execution client 重新启动 Hermes。执行结果工作面对待审批 Run 展示“批准并继续”，浏览器明确拒绝。验证：Web build、Domain boundary 85 项、Cargo check、Runtime 定向和 diff 检查通过。实际工具执行仍需把批准凭证传入 Gateway，不能仅靠前端按钮。

- 2026-07-18 审批凭证收口：Gateway 生成不可猜的 approval token，执行写入/检查工具必须同时匹配 `toolCallId + token + approved`；只改状态或伪造 ID 不会触发 handler。Gateway/Hermes 定向 17 项通过。Tauri 的审批 Run 重启路径仍需将这个凭证传入同一执行上下文，真实写入工具尚未开放。

- 2026-07-18 审批 token 已贯穿 Tauri 重启：`approve_agent_run` 将 token 保存为一次性 `approvalToken`，Desktop 重新调用 `run_hermes_agent` 时必须携带，Tauri 会核对它与对应 Run 记录一致，否则拒绝。Schema 和模板已同步，Cargo check、Gateway/Runtime 定向和 diff 检查通过。仍需把批准后的 token 接到真实 write/execute handler，并完成有效 Provider 的 E2E。

- 2026-07-18 批准工具执行已接入 Tauri：审批记录保存 `name + arguments + token`；`approve_agent_run` 将审批标记为 approved，`execute_approved_agent_tool` 再次校验 Run 状态、审批状态、token 和当前项目 controlled 权限，随后只调用既有 `apply_patch_draft` 或 allowlist `run_guarded_check`。Desktop execution client 的“批准并继续”改为调用该链路，浏览器仍拒绝。Cargo check、Web build 和 diff 检查通过；阶段中的 Provider 401 后续已解决并完成真实 E2E。

- 2026-07-18 运行时最终回归：Desktop 全量 400 项、Rust 全量 14 项通过；Web build、模板同步、Runtime 检查和 diff 检查通过。工程侧闭环已覆盖权限、工具、审批 token、Apply、检查、Run 持久化和恢复；外部 Provider/Hermes 真实模型请求也已完成 E2E 验收。

- 2026-07-18 按用户授权执行 smoke 任务：创建 `tmp/omnidesk-smoke.txt`（内容 `smoke-ok`）和 `tmp/omnidesk-smoke-confirmation.json`；runtime、文档结构和内容一致性检查均通过。任务与对话记录已回写为 `done / succeeded`，浏览器刷新后显示“已完成 / 验收通过”。执行时发现旧历史 action 脱离 `pendingAction` 后点击静默无效，已记录 LESSONS，后续需在恢复层自动清理或重建幽灵动作。

- 2026-07-18 优化计划确认后的动作层级：移除尚未产生执行内容时的“查看执行”按钮，只保留唯一下一步“生成文件改动”；说明文案明确该动作只生成可审阅改动、不直接写入。草稿生成后按钮改为“审阅并应用 / 查看改动详情”，无可应用 diff 时改为“查看任务详情”。验证：Desktop 383 项、Web build、git diff check 通过。

- 2026-07-18 收敛项目接入路径：选择一个已接入项目后不再展示接入结果弹窗，扫描确认身份后直接切换到该项目；移除接入弹窗中的“查看检查详情”展开控件，首次接入新项目仍保留必要的权限选择，受控修改仍保留安全确认。验证：Desktop 383 项、Web build、git diff check 通过。

- 2026-07-18 修复桌面端项目切换失败：`switch_registry_project` Rust command 原先接收裸 `id`，而 Runtime Adapter 传入统一的 `{ input: { id } }`，导致 Tauri 报 `missing required key id`。现已改为 `SwitchRegistryProjectInput`，与其它 registry command 对齐。验证：Desktop 全量 383 项、Cargo check、git diff check 通过。

- 2026-07-18 完成目标“完善项目权限变更与验证闭环”：项目快照补齐 `accessMode`；项目菜单“接入权限”现在可在仅浏览、接入治理、允许受控修改之间切换，受控修改升级保留二次确认，权限变更复用同一项目注册接口并在刷新后保持。浏览器 Preview 已实测接入治理升级、刷新后状态保持、受控修改确认弹窗；Desktop 全量 382 项、定向权限动作 9 项、Web build、Cargo check、runtime check 和 diff 检查通过。

- 2026-07-18 收敛项目接入弹窗文案：已接入项目改为标题直接显示“‘项目名’已接入”，副文案只保留当前权限；移除“已经接入 / 不会重复 / 当前权限”三段重复提示。新项目只显示“检查完成 / 请选择接入权限”，权限影响仍由权限卡说明，检查证据继续按需展开。Web build 与 diff 检查通过。

- 2026-07-18 复核“添加项目直接接入”反馈：当前入口实际为“选择目录 -> 只读扫描 -> 权限选择 -> 接入”，浏览器预览点击添加只显示“不支持系统目录选择器”，不会注册；为防止旧入口/未来调用绕过权限，`pickProject` 已增加硬校验，未传 `scanOnly` 或明确权限模式时拒绝注册。新增回归后定向 8 项通过；桌面端需重启 Tauri 进程加载最新前端。

- 2026-07-18 完成“项目接入流程五目标”收口验证：项目身份按规范化路径去重，同名不同路径可并存；接入前只读扫描默认收起证据；默认仅浏览，治理写入与受控修改分级并支持撤销；新项目注册后自动切换并提供“查看项目概览 / 发起项目讨论”。补修注册失败仍误进入成功态的动作契约：`pickProject` 现在只有 registry 写入成功才返回路径；Toast 改按稳定项目 ID 判断重复接入，软链接/规范化路径也显示“已打开”。验证通过：Desktop 全量 381 项、Playwright smoke 1 项、Web build、Cargo check、runtime check、git diff check；桌面端重启后窗口正常加载，浏览器预览与 Tauri 共用扫描命令契约。遗留仅为系统目录选择器需要用户在本机手动点选一次，自动化无法替代 macOS 原生选择器交互。

- 2026-07-18 优化接入授权弹窗：扫描后标题与检查结果均显示项目名称和完整路径；Git、OmniDesk 记录和项目文件识别以可读状态展示。三种访问模式改为单选卡，默认 `仅浏览`，只有底部主按钮会按当前选择完成接入，避免点击卡片即产生副作用；`接入治理`改称“管理 OmniDesk 记录”。同时修正 Tauri 的 `preview_project_path` 与浏览器 Preview 使用同一轻量扫描契约，避免桌面端把真实 Git/治理状态误显示为未发现。验证：Desktop 376 项、Web build、Cargo check 与 diff 检查通过。

- 2026-07-18 完成项目接入合同的 UI 闭环：所有“添加项目”入口现在统一为“选择目录 -> 只读扫描 -> 展示项目画像和风险 -> 选择访问模式 -> 注册项目”。扫描阶段不注册、不写入；扫描中或失败时不能授予任何模式。`browse` 仅读，`governed` 仅允许 `.project-os` 治理记录，`controlled` 才允许每次确认后的工程 Patch，Rust `apply_patch_draft` 同步强制该边界。预览端新增 `POST /__project-os/preview-project-path`，真实返回 Git、Project OS、Node/Python/Rust/README 识别与风险；客户端、Tauri 与 Preview 均使用同一运行时命令。回归：Desktop 375 项、Web build、Cargo check、`git diff --check` 均通过；浏览器端 smoke 与真实目录只读扫描通过。桌面 App 仍需由用户手动走一次系统目录选择器，确认三种模式的最终体验。

- 2026-07-18 按主流 Agent 工作流重组左侧工作区资源导航：原“工程资产”更名为默认折叠的“项目资源”，将用户日常可理解的来源收敛为“代码与配置 / 项目规则 / 报告与证据”；“数据契约 / 自动化与模板”收进二级“高级资源”。路由 ID、能力归属和资源页面保持不变，任务与对话仍可直接引用具体资源，不要求用户先理解文件分类。验证：Workspace route/capability 回归、Web build 与浏览器层级 smoke 通过。

- 2026-07-18 完成“建立可治理的项目知识与记忆层 v1”：`project-memory` 现在以当前项目 `.project-os/memory.json` 为唯一持久化来源，Preview 与 Tauri 共用读写命令；条目包含 ID、类型、范围、来源、置信度、版本、过期时间、状态与冲突关联。明确用户约束自动确认为记忆，模型归纳的决策和执行结果保持候选，只有已确认且未过期条目会按当前任务优先级进入模型协作上下文。相反约束会降为候选；用户确认新条目时旧冲突条目变为 `superseded` 并退出检索。知识记忆 > 长期记忆已替换为真实管理页，可查看来源、范围、置信度、版本、冲突和更新时间，并可确认、修正或遗忘；同时展示最小读写审计，不重复保存记忆正文。对话记录保存所选记忆 ID/原因，项目记忆保存读取、新建、合并、冲突、确认、修正和遗忘事件。最新有效对话轮次会即时提取明确约束，不必等待摘要滚动。另修复 EngineeringFileTab 漏传 `onCreateGoal` 导致知识/任务工作面崩溃。验证：Desktop 372 项、Web build、Cargo check、runtime 检查与浏览器页面 smoke 通过。后续规模增长时再补项目文件/符号索引、语义混合召回和跨轮任务评测集；v1 不上向量库。

- 2026-07-18 修复“目标与任务”页面崩溃：App 漏向 `AgentWorkspace` 注入 `onCreateGoal={createGoal}`，导致任务看板渲染引用未定义回调。已补齐注入，并新增容器参数链路回归；Desktop 364 项、Web build、runtime 检查与浏览器入口验证通过。

- 2026-07-18 修复对话“假运行”状态：计划确认后等待“生成改动草稿”现在使用静态等待态，不再写入 `running / executing` 或显示旋转、持续计时；启动加载会根据已落盘 request outcome 与下一步 action 迁移旧对话/任务并写回。已迁移当前 `conv-1784348872737` 为等待操作，保留“生成改动草稿”入口。验证：Desktop 363 项、Web build、Playwright smoke、浏览器恢复场景、Cargo check、runtime 检查和 diff 检查通过。

- 2026-07-18 新增并确认目标“优化对话历史治理”（`优化对话历史治理-1784354518762`）：主历史保持简洁，归档恢复与永久删除收敛到“对话”标题栏的历史管理入口；当前目标状态为 `planned`，尚未拆解任务。

- 2026-07-18 完成“优化对话历史治理”第一步：右侧“对话”标题栏新增历史管理入口；归档对话只在管理 Dialog 中展示，可恢复或永久删除，主列表继续隐藏归档；活跃对话计数不再包含归档记录。Web build、Playwright smoke、全量 Desktop 359 项、模板同步和 runtime 检查通过。

- 2026-07-18 新增并确认目标“完成对话历史管理闭环验收”（`完成对话历史管理闭环验收-1784355087943`）。已完成 UI smoke 和真实 Preview 持久化验收：保存、归档、历史读取、恢复、永久删除均通过；目标验收检查 Web/Cargo/Runtime 通过。当前目标仍为 `planned`，因为全局 `sign-off-goal` 仍绑定旧目标，不能误签收；该签收契约问题已记录 LESSONS。

- 2026-07-18 收窄对话历史展示：移除主历史区的搜索框和“查看已归档”入口，归档记录继续保留在存储中但不再展示；归档动作仍可用。时间显示改为当天 `HH:mm`、更早日期 `MM-DD`，历史列表更紧凑。Conversation list/presentation 定向 3 项、Web build 通过；待完成全量测试与 smoke。

- 2026-07-18 修复 Provider 自定义连接名称静默回退：保存连接后现在会重新读取持久化 Provider 状态，并核对提交的 `profileName`；回读不一致或失败会明确提示“保存未生效/请重启桌面端”，不会再用旧状态覆盖界面。浏览器 `localhost:1420` 仍是预览路径，保存按钮保持桌面端边界提示。新增 Provider action controller 回归覆盖名称保持与不一致失败；Provider 定向 5 项、Desktop 全量 357 项、Web build 与 Cargo check 通过。Playwright smoke 当前因本地配置模型不可用，回复走“不可用”分支而与旧断言不匹配，未归因于本次名称保存改动。

- 2026-07-18 Provider 双运行时来源已补齐：Preview Provider 读写跟随注册表当前项目；Preview 与 Tauri 状态均返回 `source / workspaceRoot / revision`，用于定位同名配置来自不同项目、旧进程或旧文件版本的情况。Provider 定向测试、Web build、Cargo check 通过；Playwright smoke 的既有模型不可用断言问题仍待单独处理。

- 2026-07-18 修复 Provider 健康状态误报网络中断：检测到 `insufficient_user_quota` 时现在标记为 `quota-exhausted`，界面显示“额度不足”，并停止 60 秒自动复测；一般网络失败仍继续复测。当前 `gpt-5.6-luna` 的真实错误为网关 HTTP 403、订阅额度不足；`gpt-5.6-terra` 与 `gpt-5.5` 的已有健康记录为可用。Desktop 全量 358 项、Web build、Cargo check 和 runtime 检查通过。

- 2026-07-18 完成一次真实模型与任务链路验收：当前活动模型 `gpt-5.6-terra` 可返回 JavaScript 代码和结构化计划；Desktop 全量 358 项、Playwright smoke、Cargo test 10 项均通过。另用临时目录验证模型生成的 malformed unified diff 会被 `git apply --check` 拦截，未污染仓库；这确认了 Apply 前补丁校验和失败恢复边界有效。浏览器预览仍只验证 UI/本地流程，真实文件写入需在桌面端确认 Apply。

- 2026-07-18 修复任务恢复误判：计划确认后停在“生成改动草稿”并不代表请求仍在执行；应用重载现在会保留该动作和执行态，不再显示“上次处理已中断”。真正没有下一步动作的处理中请求仍走中断恢复。新增恢复分支回归，Conversation runtime 定向 28 项、Web build 通过。

- 2026-07-18 `对话治理长目标` 第一阶段完成：计划生成成功后，待确认 turn 会在同一条对话中展示关联任务的结构化计划，包含执行步骤、读取范围、可能改动、验收标准和边界风险；状态文案改为“计划待确认”，主动作改为“确认并开始”，内部处理时间线仍可展开查看但不再承担用户决策。验证：Desktop 350 项测试、Web build、Playwright smoke 和 `git diff --check` 通过。下一阶段接入“确认后执行”的阶段状态、执行过程和验收结果回流。

- 2026-07-18 `对话治理长目标` 第二阶段完成：确认任务前增加当前模型实时可用性校验；模型不可用时不改变任务状态。确认成功后任务进入执行工作面，原计划保留在对话中并标记“已确认”，新增“查看执行”入口；任务仍由既有受控 Patch / Apply / 验收链路推进，不在对话确认动作中隐式写文件。验证：Desktop 351 项测试、Web build、Playwright smoke 和 runtime 检查通过。下一阶段继续把执行进度、Patch 草稿、Apply 验收和结果回流串成一条可恢复链路。

- 2026-07-18 `对话治理长目标` 第三阶段首步完成：确认后的对话现在提供“生成改动草稿”，继续复用只读 Patch Draft workflow；草稿生成后通过 `requestId / taskId` 回流同一条对话，只有可应用 diff 才显示“确认应用改动”并生成 `apply-patch` pending action，随后沿用现有 Apply + 自动验收链路。Apply/验收的运行中、成功和失败事件继续投影到同一条对话，终态显示“验收通过 / 需要处理”，失败时直接提供“生成修复任务”和“查看执行”。验证：Desktop 352 项测试、Web build、Playwright smoke 和 runtime 检查通过。下一步补归档后的可恢复历史和更完整的中断恢复。

- 2026-07-18 `对话治理长目标` 历史治理阶段完成：对话历史默认隐藏 `archivedAt` 记录；右侧历史区提供“查看已归档”，归档记录独立分组并可恢复；归档、恢复和永久删除语义分离，均复用现有 conversation persistence。验证：Desktop 355 项测试、Web build、Playwright smoke、仓库全量测试和模板/安全检查通过。下一步继续补重启后的 pending action 恢复和更完整的执行断点恢复。

- 2026-07-18 `对话历史分层治理` 阶段一完成：模型/连接状态类 turn 标记为临时内容，不再写入会话记录、不进入后续模型上下文；加载时兼容过滤只包含这类内容的旧历史。历史列表时间统一为 `MM-DD HH:mm` 分钟级格式。新增临时 turn、旧记录过滤和时间格式回归；定向测试 16 项、Web build 通过。下一阶段是任务对话/通用对话分组、搜索和归档，不在本批扩大存储架构。

- 2026-07-18 修复同一连接切换模型被误判为 Key 冲突：Composer 模型切换保存时仅带有 `activeProfileId`，而 Rust 保存接口需要 `profileId`，导致它从 Key 名推导出另一连接 ID 并拒绝保存。现已在保存前显式保留当前 profile ID；同一连接现在可复用同一 Key 切换模型，不同连接仍保持独立 Key 保存变量约束。已验证：Provider 定向 Node 测试 6 项、Web build、Cargo 10 项测试通过。

- 2026-07-17 修复 Desktop / Browser 对话发送回归：`useConversationSubmission` 原先将已导入的 `executionReadyAgentEvents` 错传为未定义变量，并把容器注入的布尔值 `isTauri` 当作函数调用；任意非空消息会在用户 turn 落下后中断，表现为“发送无反应”。同时 Vite 将 `.project-os` 的会话持久化写入当作源码热更新，会重置活动请求。现已修正事件工厂与运行环境类型、忽略 `.project-os` watch，并把实际发送“当前使用什么模型”且显示助手回复加入 Playwright smoke。验证：Desktop Node 348 项测试、Web build、Playwright smoke、Cargo 10 项测试、runtime 文档检查与浏览器实际发送均通过。Tauri dev 使用 `PROJECT_OS_EMBEDDED_BROWSER=1` 的共享 1420 预览服务，重启原生窗口后即可加载该版本。

- 2026-07-17 `Desktop Runtime Reliability v0.2` 第一批完成：Tauri 新增以 `requestId` 为键的 `RuntimeRequestState` 和 `cancel_runtime_request`，聊天、只读计划与 Patch Draft 在取消时会中断实际 HTTP future、清理请求登记并保持前端迟到结果保护；Hermes ACP worker 等待 JSON-RPC 时每 200ms 检查取消信号并在返回后 kill 子进程。此前“停止”只清前端状态的问题已消除。聊天优先请求 OpenAI-compatible SSE，Tauri 将 `model.started / model.delta / request.completed / request.cancelled / request.failed` 经 `runtime://conversation-event` 推送，前端复用现有处理状态显示已接收字符数；不支持 SSE 的 gateway 自动退回原整段 JSON 解析。SSE 解析器已覆盖跨 transport chunk 的 JSON、完成标记和空残留。Apply 继续保持显式确认的同步写入边界，终端已有真实停止会话。新增 Rust 取消与 SSE 分片单测、前端请求透传契约测试，并新增 Playwright 浏览器 preview smoke，覆盖对话输入、发送状态、终端预览降级和返回对话；CI Desktop job 安装 Chromium 后运行此 smoke、Desktop 347 项测试、Web build、bundle 预算、Cargo check/test。`docs/ARCHITECTURE.md` 同步定义 Native Core 的 `WorkspaceScanner / FactWriter / RecommendationEngine / GuardedRunner / ReportGenerator` typed operation、Fact Store 投影边界与 shell/Core dual-run 迁移规则。已验证：Cargo check/test（10 项）、Desktop 347 项、Playwright smoke、Web build、bundle 800 KiB 预算、runtime/template/doc-structure 检查和 `git diff --check` 均通过。后续仍需用真实 provider 做一次取消与 SSE 实机 smoke；本批只定义 Native Core 与事实迁移契约，未迁移 Shell adapter。

- 2026-07-17 `Desktop Performance & Memory Baseline v0.1` 完成：首屏、工作区标签路由、会话更新和终端输出已接入同一份定长、无文本性能采样（最多 60 条，包含可用时的 JS heap 数值）；启动采集在 `createRoot` 前完成，Preview 与 Tauri WebView 共享前端实现。长会话现在保留结构化摘要加最近 120 条消息，旧持久化记录恢复到 active session 时同样受限；附件为 6 张 / 单张 8 MiB / 合计 24 MiB，终端为 50,000 字符 / 2,000 chunks / 8 条日志，工程文件 Preview/Tauri 同为 80 KiB。xterm 终端按需加载，主入口从 1,105.60 kB 降至 767.73 kB（gzip 239.67 kB），`npm run check:bundle` 的 800 KiB 首屏软预算当前通过。浏览器 Preview 已实测首屏和终端标签；修复了漏传 `activeTaskId` 与会话重置 effect 的无限更新循环，均已登记 LESSONS。最终验证：Desktop 346 项测试、Web build、bundle 检查、Cargo check、runtime/template 检查和 diff 检查均通过。遗留仅为后续在真实用户负载下采集多次启动/任务/终端样本并校准阈值，当前 v0.1 不把单次机器时延设成 CI 硬门槛。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：App 的持久化 Conversation/Task 首次加载与项目切换依赖同步已迁入 `desktop/src/components/workbench/use-workspace-data-sync.js`；hook 只接收数据读取器、Runtime 恢复器和状态 setter，App 不再内联对应加载 effect，保留项目切换时的即时重载。新增 Workspace data owner 边界断言；下一步运行 Desktop 测试、Web build、runtime/template 检查并继续拆分 App/AgentWorkspace 剩余装配职责。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：App 的 Provider 初始连接、模型目录和持久化健康缓存装载已迁入 `desktop/src/components/workbench/use-provider-data-sync.js`；Provider 生命周期通过注入 client 与状态 setter 完成，App 不再内联 Provider bootstrap effect。新增 Provider data owner 边界断言；下一步继续审计 App/AgentWorkspace 剩余装配职责。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：AgentWorkspace 的会话切换清理、任务输入/附件重置、工程文件与工作区 Tab 清理已迁入 `desktop/src/components/workbench/use-conversation-surface-reset.js`；Conversation 生命周期由注入式 hook 负责，Workspace 保留 composer ref 聚焦和状态装配。新增 Conversation reset owner 边界断言；下一步继续审计 AgentWorkspace/AgentTopicPanel 剩余装配职责。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：项目切换后的 Conversation/Task/Execution/Terminal 临时状态重置与列表重载已迁入 `desktop/src/components/workbench/use-workspace-ephemeral-reset.js`；Workspace registry 只接收稳定 reset callback，App 不再内联跨域清理逻辑。新增 Workspace lifecycle owner 边界断言；下一步继续拆分 App 的装配 surface 和 AgentWorkspace 剩余组合。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：ProjectSidebar 的项目文件树查询、展开/收起和文件选择已迁入 `desktop/src/components/workbench/project-file-tree.jsx`；Sidebar 仅负责工作区/项目注册与能力启用，文件树保持独立 Workspace surface。新增文件树 owner 边界断言；下一步继续拆分 ProjectSidebar 与 App 的剩余装配职责。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：ProjectSidebar 的重命名 Dialog、能力启用/暂不需要动作、项目/文件视图状态已迁入 `desktop/src/components/workbench/use-project-sidebar-state.js`；组件保留 Workspace 展示和路由注入，不再持有这组临时状态动作。新增 Sidebar state owner 边界断言；下一步继续拆分 ProjectSidebar 与 App 的剩余装配职责。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：Workbench 左右栏宽度、最小/最大约束和 pointer resize 生命周期已迁入 `desktop/src/components/workbench/use-sidebar-layout.js`；App 只消费布局状态和 resize callback。新增 layout owner 边界断言；下一步继续拆分 ProjectSidebar 与 App 的剩余装配职责。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：Workspace 能力发现、模块勾选、启用/暂不需要动作 Dialog 已迁入 `desktop/src/components/workbench/project-capability-dialog.jsx`；ProjectSidebar 只注入能力数据与 callback。新增 capability surface owner 边界断言；下一步继续拆分 ProjectSidebar 与 App 的剩余装配职责。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：ProjectSidebar 的项目运行状态、任务归属筛选和能力发现派生已迁入 `desktop/src/lib/project-sidebar-view-model.js`；展示容器仅消费 Workspace view-model，不再内联状态判断。新增 view-model owner 边界断言；下一步继续拆分 ProjectSidebar 与 App 的剩余装配职责。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：ProjectSidebar 的项目路径复制、浏览器/Tauri 剪贴板降级和点击委托已迁入 `desktop/src/components/workbench/use-project-path-copy.js`；复制能力通过注入的系统 clipboard callback 复用 Runtime Adapter。新增 clipboard owner 边界断言；下一步继续拆分 ProjectSidebar 与 App 的剩余装配职责。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：AgentWorkspace 的 Conversation runtime 投影、当前任务目标和目标内相邻任务派生已迁入 `desktop/src/lib/agent-workspace-view-model.js`；Workspace 容器仅消费纯 view-model 和注入动作。新增 AgentWorkspace view-model owner 边界断言；下一步继续拆分 AgentWorkspace/App 剩余组合。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：App 的三栏 Workbench 槽位最终组合已迁入 `desktop/src/components/workbench/app-workbench-surface.jsx`；App 只装配 Workspace、Conversation 和 Task/Execution slots，三栏 shell 组件继续保持无领域依赖。新增 App surface owner 边界断言；下一步继续拆分 App/AgentWorkspace 剩余组合。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：RightRail 的折叠区、目标状态图标、目标任务项和项目档案项已迁入 `desktop/src/components/workbench/right-rail-components.jsx`；目标名称解析归入 Task presentation。新增 RightRail primitive owner 边界断言；下一步继续拆分 App/AgentWorkspace 剩余组合。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：App 内联的 Workspace capability 启用刷新反馈与 Provider 测试记录写回已分别迁入 `use-workspace-capability-actions.js`、`use-provider-test-record.js`；App 只装配注入的领域 action。新增 action owner 边界断言；下一步进行最终 App/AgentWorkspace 架构审计。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：AgentWorkspace 的图片粘贴、starter prompt 聚焦和 assistant-ui action 转发已迁入 `use-agent-workspace-input-actions.js`；Conversation 输入动作通过 hook 注入，容器不再内联事件处理。新增 Conversation input owner 边界断言；下一步继续最终 App/AgentWorkspace 审计。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：App 的 Provider composer 模型选项、可用性映射、健康状态和测试记录派生已迁入 `use-provider-composer-view-model.js`；App 仅装配 Provider state 与纯 helper。新增 Provider view-model owner 边界断言；下一步继续最终 App/AgentWorkspace 审计。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：当前任务投影已并入 `use-task-session.js`；App 不再从任务列表内联查找 active task，Task session 现在同时拥有 tasks、activeTaskId 与 activeTask projection。新增 Task session owner 边界断言；下一步继续最终 App/AgentWorkspace 审计。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：AgentWorkspace 不再直接调用 `isTauriRuntime()`；Runtime source 由 App 解析后注入 Conversation submission hook，保持 Runtime Adapter 单一入口。新增 runtime injection 边界断言；下一步完成最终收口验证。
- 2026-07-17 `Desktop Performance & Memory Baseline v0.1` 启动：修复提交/取消路径直接清空附件 state 而未统一释放 Object URL 的风险；Conversation submission 现在注入并调用 `clearAttachments`，由附件 owner 负责释放资源。新增附件清理边界断言；下一步集中终端、附件与预览预算并补基线测试。
- 2026-07-17 `Desktop Performance & Memory Baseline v0.1` 持续推进：新增 `resource-budget.js`，统一附件数量/字节、终端文本/chunk/日志预算；附件输入限制为 6 张、单张 8 MB、合计 24 MB，并反馈拒绝原因；终端既有 retention 上限改为读取同一预算源。新增资源预算单测和边界断言；下一步补构建基线与低频模块按需加载。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：Task 的 durable/Preview 持久化、任务列表投影、活动完成标记、去重反馈和错误收口已迁入 `desktop/src/components/workbench/use-task-persistence.js`；App 不再内联 `setAndPersistTask`。新增 Task owner 边界断言；Desktop 319 项测试、Web build、runtime 检查和 `git diff --check` 通过；`main.jsx` 降至 4,956 行。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：Task 的 durable/Preview 持久化、任务列表投影、活动完成标记、去重反馈和错误收口已迁入 `desktop/src/components/workbench/use-task-persistence.js`；App 不再内联 `setAndPersistTask`。新增 Task owner 边界断言。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：目标更新快照包装已并入 `use-workspace-goal-actions.js`，App 不再内联 `updateGoal`；目标验证、签收、创建、切换、确认和更新现在由同一 Workspace goal owner 提供。新增 owner 断言；Desktop 318 项测试、Web build 与 `git diff --check` 通过。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：治理文件任务和设计实现治理任务的计划构造、任务持久化与反馈已迁入 `desktop/src/components/workbench/use-governance-task-actions.js`；App 内两段 legacy 治理实现已删除，工作区动作完全通过 Workspace hook 注入。新增 governance owner 边界断言；`main.jsx` 降至 4,990 行。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：终端专用受控检查的 loading、白名单解析、结果日志和错误收口已迁入 `desktop/src/components/workbench/use-terminal-check-action.js`；App 只注入 Terminal/Execution callback。新增 owner 边界断言；Desktop 317 项测试、Web build、模板同步、runtime 检查和 `git diff --check` 通过。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：终端专用受控检查的 loading、白名单解析、结果日志和错误收口已迁入 `desktop/src/components/workbench/use-terminal-check-action.js`；App 只注入 Terminal/Execution callback。新增 owner 边界断言。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：App 的 Patch Draft、Apply/逐项验证、执行进度投影和交接合并已迁入 `desktop/src/components/workbench/use-patch-actions.js`；App 仅注入 Execution workflow、Task 持久化、Conversation 投影和反馈状态。同步迁移 executor owner 断言；Desktop 316 项测试、Web build、`git diff --check`、模板同步与 runtime 检查通过。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：App 的只读计划请求生命周期（request id、loading、反馈、超时、取消和任务耐久保存）已迁入 `desktop/src/components/workbench/use-plan-action.js`；`App` 仅注入本地/远程计划生成、Task 持久化和状态 setter。同步迁移 executor owner 断言；Desktop 315 项测试、Web build、`git diff --check`、模板同步与 runtime 检查通过。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：App 的目标/任务上下文解析、对话投影、终端上下文发送已迁入 `desktop/src/components/workbench/use-workspace-context-actions.js`；App 仅注入快照、任务状态、Conversation/Terminal setter 和提示反馈，hook 不访问 Runtime 或全局窗口事件。新增 context owner 边界断言；Desktop 313 项测试、Web build、`git diff --check`、模板同步与 runtime 检查通过。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：App 的三栏布局、Tooltip provider、Toast 和 StatusBar 外壳已迁入 `desktop/src/components/workbench/app-shell.jsx`；`App` 只负责生命周期状态和 ProjectSidebar / AgentWorkspace / RightRail 的 slot 注入。新增 shell owner 边界断言；Desktop 312 项测试、Web build、`git diff --check`、模板同步与 runtime 检查通过。`main.jsx` 降至 5,320 行；Vite 主 bundle 约 1.10 MB 的既有告警仍未处理。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：`AgentTopicPanel` 的 Task board 状态、任务动作控制器、目标动作控制器和新建任务/目标提交已迁入 `desktop/src/components/workbench/use-agent-topic-task-actions.js`；`AgentTopicPanel` 保留纯数据组合和 props 注入，不直接访问 client。同步修正旧容器遗漏的目标/任务动作 props，并迁移 owner 断言；Desktop 312 项测试、Web build 与 runtime 检查通过。下一步继续削减 App 生命周期编排。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：`AgentTopicPanel` 的能力摘要、任务板、受控终端、当前任务详情和执行结果分支已迁入 `desktop/src/components/workbench/agent-topic-panel-content.jsx`；原容器保留状态、派生数据、Task/Workspace 动作和持久化控制，展示组件只接收 props。同步迁移 detail/summary/command/task-board 的 owner 断言；Desktop 312 项测试、Web build、`git diff --check`、模板同步与 runtime 检查通过。Vite 主 bundle 约 1.09 MB 的既有告警仍未处理；下一步继续评估 AgentTopic 状态装配或 App 生命周期装配。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：`EngineeringFileTab` 的概览、Agent topic、专属治理 surface 与通用 fallback 选择已迁入 `desktop/src/components/workbench/engineering-topic-surface-composer.jsx`；容器继续负责 topic 判定、业务 panel 实例化和依赖注入，未改变界面或运行时行为。新增 composer owner 边界断言；Desktop 312 项测试、Web build、`git diff --check` 与 runtime 检查通过。Vite 主 bundle 约 1.09 MB 的既有告警仍未处理；下一步继续评估 `AgentTopicPanel` 状态装配与 `App` 生命周期装配的低风险拆分。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：App 的任务对话打开、历史切换、删除持久化和新建会话重置已迁入 `desktop/src/components/workbench/use-conversation-navigation.js`；hook 复用 `conversation-session-state`，删除动作由 App 注入共享 Conversation client，维持浏览器预览与 Tauri 同一契约。新增领域边界回归。Desktop 311 项测试、Web build、`git diff --check` 与 runtime 文档检查通过；下一步继续拆 App 的目标/任务上下文投影或 `EngineeringFileTab` 的动态 surface 组合。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：`AgentWorkspace` 的非对话 Tab 分支已迁入 `desktop/src/components/workbench/agent-workspace-auxiliary-tabs.jsx`；文件 Tab 通过父级注入 `EngineeringFileTab`，终端、Diff、检查和 Trace 空态由 Workspace 展示组件按 tab kind 渲染，TerminalDock 不再由中间容器直接持有。同步迁移 TerminalDock 静态断言 owner。Desktop 310 项测试、Web build、`git diff --check`、模板同步与 runtime 文档检查通过；下一步可拆 `EngineeringFileTab` 的动态 surface 组合，或继续削减 App 的生命周期装配。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：`AgentWorkspace` 的计划 Tab 首屏、建议任务、流式 Conversation Transcript 与 assistant-ui POC 分支已迁入 `desktop/src/components/workbench/agent-workspace-conversation-canvas.jsx`；容器只注入会话状态、动作与 POC 元素，展示组件不访问 Runtime/client。同步将转录静态断言改到新 owner。`main.jsx` 为 5,507 行。Desktop 309 项测试、Web build、`git diff --check`、模板同步与 runtime 文档检查通过；下一步继续拆文件/终端 Tabs，或拆 `EngineeringFileTab` 的动态 surface 组合。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：`AgentWorkspace` 的工作区路由、当前进度跳转、任务续聊定位和终端草稿状态已迁入 `desktop/src/components/workbench/use-agent-workspace-navigation.js`；hook 只组合注入的 UI callback 与纯 Workspace navigation，不读取 Runtime/client。同步将旧导航 import 断言迁到新 owner，并补齐模块边界回归。`main.jsx` 为 5,526 行。Desktop 308 项测试、Web build、`git diff --check`、模板同步与 runtime 文档检查通过；下一步继续拆 `AgentWorkspace` 的 Tabs/画布装配或 `EngineeringFileTab` 的动态 Workspace surface。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：修复 `AgentTopicPanel` 遗留的 Task board 动作装配缺口。归档、编辑、删除、恢复、检查、任务主操作继续由 `task-board-action-controller` 承担；目标归档、合并与恢复复用 `agent-topic-goal-actions`，持久化任务和目标写入都由 App 经 prop 注入，Topic 展示层不直接访问 client。同步新增边界回归，并在 `docs/LESSONS.md` 登记跨容器 props 的重复绑定约束。Desktop 307 项测试、Web build、`git diff --check` 与 runtime 文档检查通过；下一步继续拆 `AgentWorkspace` 的中间工作区装配，或将 `EngineeringFileTab` 的动态 Workspace surface 迁入专属 owner。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：协作边界、执行权限、文档规则、系统架构、数据契约和实现结构六个 Workspace 静态 surface 已统一迁入 `desktop/src/components/workbench/workspace-static-surfaces.jsx`；`main.jsx` 仅保留路由装配和来源打开 callback 注入，展示层无 Runtime/client 依赖。同步迁移布局与领域边界测试，并在 `docs/LESSONS.md` 记录静态断言 owner 迁移约束。`main.jsx` 降至 5,532 行。Desktop 306 项测试、Web build、`git diff --check`、模板同步与 runtime 文档检查通过；下一步可迁出验证/复盘类静态 surface，或继续审计 `AgentWorkspace`、`AgentTopicPanel` 与 `App` 的剩余装配职责。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：项目事实/用户偏好/长期记忆/会话摘要及工程/治理/报告/Schema/脚本资产 surface 已迁入 `desktop/src/components/workbench/workspace-static-surfaces.jsx`；组件仅通过注入的来源导航渲染静态 Workspace 说明，不访问 Runtime 或 client。`main.jsx` 降至 5,712 行。Desktop 305 项测试、Web build、`git diff --check`、模板同步与 runtime 文档检查通过；下一步迁出协作、执行权限、文档规则及架构类静态 surface。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：`EngineeringFileTab` 的 topic frame（标题、治理元信息、关联文件入口和预览）已迁入 `desktop/src/components/workbench/engineering-topic-frame.jsx`，保留上层的 Workspace surface 选择和受控只读读取；`main.jsx` 降至 5,734 行。迁移时同步将预览断言改到新 owner，并在 `docs/LESSONS.md` 补充所有 JSX 位置断言必须随 owner 迁移的约束。Desktop 304 项测试、Web build、`git diff --check`、模板同步与 runtime 文档检查通过；下一步继续拆具体 surface 组合。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：`TerminalDock` 和终端主题 helper 已从 `main.jsx` 机械迁入 `desktop/src/components/workbench/terminal-dock.jsx`；xterm 创建/回放、尺寸同步、主题切换、浏览器预览空态、会话标签与终端输入仍保持原行为，App/AgentWorkspace 只注入状态和动作。`main.jsx` 降至 5,798 行。Desktop 303 项测试、Web build、`git diff --check`、模板同步与 runtime 文档检查通过；下一步继续按 Workspace surface 拆分 `EngineeringFileTab` 的面板组合。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：Workspace 治理文件、设计实现文件、topic 关联文件和普通工程文件预览已统一迁入 `desktop/src/components/workbench/readonly-file-preview.jsx`，保留加载、错误、截断和空文件状态；`main.jsx` 删除重复展示逻辑并降至 6,224 行。Desktop 302 项测试、Web build、`git diff --check`、模板同步与 runtime 文档检查通过；下一步继续拆 `EngineeringFileTab` 的 surface 组合或终端展示层。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：`EngineeringFileTab` 的 Workspace topic 路由判定已迁入 `desktop/src/lib/engineering-topic-surface.js`，纯模块统一决定 route id、surface、专属页和渲染 flag；虚拟未注册 topic 仍保留通用 Agent surface。同步迁移旧 `main.jsx` 静态断言并新增 view-model 回归。Desktop 301 项测试、Web build、`git diff --check`、模板同步与 runtime 文档检查通过；`EngineeringFileTab` 的实际面板组合仍待继续分拆。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：治理文件、设计实现和工程关联文件的只读预览，以及 Hermes 状态探测均改为由 App 注入 `Workspace/Execution` callback；展示层不再直接访问 client。`AgentConfigSurfacePanel` 已迁入独立 workbench 组件，并补齐入口中遗漏的 `TerminalSquare` / `X` 显式图标 import。Desktop 298 项测试、Web build、`git diff --check`、模板同步和 runtime 文档检查通过；下一步按 surface 继续拆 `EngineeringFileTab` 的路由分发与面板组合。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：`AgentWorkspace` 不再直接读取 Workspace file client；对话中用户画像更新改由 App 通过 `onProviderProfileUpdate` 显式注入到 Conversation submission Hook，保持共享浏览器/Tauri client 契约。Desktop 297 项测试、Web build、`git diff --check` 与模板同步检查通过；下一步继续审计大容器中的跨领域调用。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：App 的目标验证、签收、创建、切换、确认、拆解确认与模型拆解生成已迁入 `desktop/src/components/workbench/use-workspace-goal-actions.js`，所有 Workspace / Execution client 都通过注入使用；浏览器预览不伪造模型拆解、拆解任务先持久化再确认目标的边界保持不变。Desktop 297 项测试、Web build 与 `git diff --check` 通过；下一步审计 `AgentWorkspace` 和 `AgentTopicPanel` 的剩余大段职责。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：App 的桌面文件变化监听、显式 snapshot refresh 事件与浏览器预览轮询已迁入 `desktop/src/components/workbench/use-workspace-snapshot-refresh.js`；`workspace-registry-client` 承接 `workspace://files-changed` 的 Tauri 订阅，三类刷新继续共用原有节流与错误反馈。Desktop 295 项测试、Web build、`git diff --check`、模板同步和 runtime 文档检查通过；下一块建议迁出 App 的 Workspace 目标验证/确认/拆解编排。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：完整终端生命周期已迁入 `desktop/src/components/workbench/use-terminal-session.js`，覆盖 Tauri 输出订阅、输出去重/提示符折叠、会话创建/重启/关闭、输入缓冲、终端上下文与执行日志；`terminal-client` 现在持有 `terminal://output` 订阅适配，App 仅注入 runtime client 并装配 UI。Desktop 293 项测试、Web build、`git diff --check`、模板同步和 runtime 文档检查通过；下一块建议继续迁出 App 的工作区监听/快照刷新编排。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：App 的 turn 规范化、会话记录构建、串行持久化和任务最新结果回写已迁入 `desktop/src/components/workbench/use-conversation-persistence.js`。Hook 只使用 Conversation client 与注入的 Task 持久化回调，保持浏览器与 Tauri 共用 client 契约。Desktop 292 项测试、Web build 与 `git diff --check` 通过；App 下一块最大剩余是终端会话生命周期。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：App 的项目运行/失败/完成活动投影已迁入 `desktop/src/components/workbench/use-project-activities.js`；hook 只消费 Workspace/Task 状态并回传已读与完成标记，App 不再内联该 effect。Desktop 292 项测试、Web build 与 `git diff --check` 通过；下一步继续迁出会话持久化或终端生命周期。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：`AgentTopicPanel` 的模型状态、资产风险、执行/记忆能力、目标/任务历史、卡片与可预览文件判断已迁入 `desktop/src/lib/agent-topic-view-model.js`。模块只消费 Workspace/Task/Provider 快照与注入 helper，不读取 Runtime；容器已删除这组派生细节。Desktop 292 项测试、Web build、`git diff --check` 与模板同步检查通过。下一步审计 App 的会话与终端装配职责。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：`AgentTopicPanel` 的 `task-list` 工具栏、任务分组、目标/任务 Dialog 与任务动作 Dialog 已迁入 `desktop/src/components/workbench/agent-topic-task-board.jsx`；展示组件仅消费 Task/Workspace 状态与注入动作，不直接读取 Runtime 或 Task client。同步迁移旧源码位置断言。Desktop 291 项测试、Web build 与 `git diff --check` 通过；后续继续抽离 AgentTopic 的 capability 状态汇总及 App 装配职责。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：`AgentTopicPanel` 不再派发 `project-os:open-task-conversation` 全局事件，也不再调用整页 `window.location.reload()`。任务专属对话和 Workspace snapshot 刷新改为由 `App -> AgentWorkspace -> EngineeringFileTab -> AgentTopicPanel` 显式注入，任务仍只在对话中推进，Tauri 与浏览器预览继续复用同一刷新入口。Desktop 290 项测试、Web build 与 `git diff --check` 通过；仍需继续拆分 AgentTopic 的状态汇总和 App 的装配职责。
- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：`AgentWorkspace` 已通过 `desktop/src/components/workbench/use-conversation-submission.js` 接管实际 `submitTask` 提交入口。Hook 聚合请求接管、短命令/确认、模型或本地回退、计划 Action、模型健康和任务上下文；Runtime 判定、档案写入、计划/补丁动作均以注入依赖传入，Hook 不直接读取 Runtime Adapter 或领域 client。旧等价实现及其 imports 已删除，`main.jsx` 再次缩小；新增领域边界守卫。需要继续拆分 `AgentTopicPanel` 与 `App`，不能把本批当作总目标完成。
- 先读 `AGENTS.md`、`PROJECT.md`，再按任务需要查 `docs/ROUTING.md`、`docs/DOCUMENTATION.md`、`docs/NAMING.md`。
- 产品路线和阶段拆解看 `docs/PRODUCT_PLAN.md`，不要在本文件重复维护。
- 结构性历史看 `docs/CHANGELOG.md`，决策原因看 `docs/DECISIONS.md`。
- 当前桌面端安全基线改动尚未提交，继续工作时不要回滚本轮或其他未确认改动。
- 当前产品定位已推进为 `Project OS Desktop / Console`：先稳定项目理解、推荐补齐、跑检查、维护交接状态，再通过 Tauri + Local Agent Core 做本地 coding 工作台；暂时不要把它做成完整 IDE、开放插件市场或通用 Hermes Studio 复制品。
- 整体架构分层已确认并写入 `docs/ARCHITECTURE.md`：自下而上为 `接入层 -> 元数据层 -> 核心内核层 -> 治理服务层 -> 工作台应用层 -> 入口层`；底层解决“接得进来”，上层解决“治得好”。
- 入口层已补架构约束：第一周前置定稿 `Entry Context` JSON 标准；Gateway 承担鉴权、参数标准化、日志链路、限流、异常封装和路由分发；CLI 是离线能力内核，Web / CI 通过 Gateway 复用 CLI 逻辑；新增能力必须同时具备 CLI、Gateway、CI 和离线降级路径。
- 注意：当前 `scripts/ai-project.sh` 只是 Shell 过渡 wrapper。长期入口层必须迁到原生 CLI / core library，否则会限制 Windows 原生运行、结构化日志/错误码、Gateway / CI / Desktop 进程间调用和复杂路由。

## 最近完成

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：`submitTask` 的继续当前请求、取消和改向请求投影已迁入 `desktop/src/lib/conversation-takeover-controller.js`；controller 注入 Conversation request state、turn 投影与 stop callback，不读取 Runtime。新增改向请求回归，Desktop 测试现为 289 项通过，Web build 与 `git diff --check` 通过；Vite 主 bundle 约 1.08 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：App 的工程文件选择、虚拟 topic、全局记忆占位和只读预览错误处理已迁入 `desktop/src/lib/workspace-file-actions.js`；controller 注入 Workspace file client 与 UI 状态回调，不接触 Runtime。新增虚拟 topic 与读取失败回归及 App 边界守卫，Desktop 测试现为 288 项通过，`git diff --check` 与模板同步检查通过；Vite 主 bundle 约 1.08 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：提交时的附件持久化/模型请求投影、Blob 释放和任务对话上下文投影已迁入 `desktop/src/lib/conversation-submission-utils.js`；无 Runtime 依赖，浏览器与 Tauri 继续共享同一 Conversation 请求契约。新增附件与上下文投影回归，Desktop 测试现为 285 项通过，Web build 与 `git diff --check` 通过；Vite 主 bundle 约 1.08 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：`AgentWorkspace` 的请求 ref、重复提交指纹、pending turn、loading 状态、会话重置和取消投影已迁入 `desktop/src/components/workbench/use-conversation-request-state.js`；hook 只消费 Conversation turns 与 stop callback，不读取 Runtime。新增 Conversation request state 边界守卫，Desktop 测试与 Web build 均通过；Vite 主 bundle 约 1.08 MB 的既有告警仍未处理。下一批把 `submitTask` 请求生命周期迁入此 hook。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：单次受控检查、任务检查回写、终端日志、反馈与会话事件投影已迁入 `desktop/src/lib/execution-action-controller.js`；controller 注入白名单 lookup、Execution workflow、Task 持久化和 terminal append，不直接读取 Runtime。同步修正执行器边界测试到新的领域 owner。新增任务检查行为回归与 App 边界守卫，Desktop 测试现为 282 项通过，Web build、`git diff --check` 与模板同步检查通过；Vite 主 bundle 约 1.08 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：手工建任务、失败修复任务、队列任务选择、任务删除、开始与完成状态迁入 `desktop/src/lib/task-lifecycle-controller.js`；controller 仅接收 Task/Conversation state、Task client 和 UI 回调，仍由父级持有 Runtime Adapter 与刷新来源。新增手工创建、队列选择、缺失修复任务回归和 App 边界守卫，Desktop 测试现为 280 项通过，Web build 与 `git diff --check` 通过；Vite 主 bundle 约 1.08 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：对话中已注册的阶段目标创建、文件/任务/终端入口、任务确认、目标打开、计划/草案/应用/检查和取消动作已迁入 `desktop/src/lib/conversation-action-controller.js`；App 仅注入 Conversation、Task、Workspace 的受控动作。同步修正阶段目标测试对旧 `main.jsx` 位置的断言。新增 controller 行为测试与 App 边界守卫，Desktop 测试现为 276 项通过，Web build、`git diff --check` 与模板同步检查通过；Vite 主 bundle 约 1.08 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：App 的项目切换、添加、选择目录、重定位、移除、打开目录和重命名编排已迁入 `desktop/src/lib/workspace-registry-actions.js`；controller 通过注入的 Workspace registry client、快照和反馈回调工作，保留切换后的临时状态重置和最后一个项目不可删除的边界。新增 controller 单测与 App 边界守卫，Desktop 测试现为 272 项通过，Web build、`git diff --check` 与模板同步检查通过；Vite 主 bundle 约 1.08 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：当前任务详情、下一步动作、Patch 草案预览和执行结果列表已迁入 `desktop/src/components/workbench/agent-topic-task-detail.jsx`；组件只消费任务快照和注入的受控执行回调，Runtime 与 Task client 未下沉。新增详情/结果展示边界守卫，Desktop 测试现为 269 项通过，Web build、`git diff --check` 与模板同步检查通过；Vite 主 bundle 约 1.08 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：任务/目标的创建、编辑、归档、永久删除、合并与历史 Dialog 群已迁入 `desktop/src/components/workbench/agent-topic-task-dialogs.jsx`；`AgentTopicPanel` 仅注入状态和受控领域动作，删除、模型可用性和本地写入边界保持在既有 controller/client。新增 Dialog 展示边界守卫，Desktop 测试现为 268 项通过，Web build、`git diff --check` 与模板同步检查通过；Vite 主 bundle 约 1.08 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：任务按目标分组的看板卡片已迁入 `desktop/src/components/workbench/agent-topic-task-groups.jsx`；容器仅注入目标/任务编辑、归档、删除、合并和主操作 callback，展示组件不访问 Runtime 或 Task client。新增任务分组展示边界守卫，Desktop 测试现为 267 项通过，Web build、`git diff --check` 与模板同步检查通过；Vite 主 bundle 约 1.08 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：`AgentTopicPanel` 顶部概览卡、能力摘要、来源文件可预览判断和文件导航渲染已迁入 `desktop/src/components/workbench/agent-topic-capability-summary.jsx`；容器仅注入规格与导航回调，不访问 Runtime。新增展示边界守卫，Desktop 测试现为 267 项通过，Web build、`git diff --check` 与模板同步检查通过；Vite 主 bundle 约 1.08 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：认识项目、定义目标、工作规则、设计实现、验证交付和复盘沉淀的 Topic 流程规格已迁入 `desktop/src/lib/agent-topic-flow-capability.js`，topic maturity 继续决定展示 tone。新增流程/未知 topic 回归，Desktop 测试现为 266 项通过，Web build、`git diff --check` 与模板同步检查通过；Vite 主 bundle 约 1.07 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：`AgentTopicPanel` 的任务、终端、执行结果、项目事实、用户偏好、长期记忆和会话摘要能力说明已迁入 `desktop/src/lib/agent-topic-runtime-capability.js`，通过注入的 Task/Workspace facts 生成执行与记忆规格。新增执行失败和长期记忆状态回归，Desktop 测试现为 265 项通过，Web build、`git diff --check` 与模板同步检查通过；Vite 主 bundle 约 1.07 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：`AgentTopicPanel` 的工程、治理、报告、Schema 和脚本模板能力说明已迁入 `desktop/src/lib/agent-topic-asset-capability.js`，仅消费 Workspace domain facts、风险计数和快照。新增治理风险/未知 topic 回归，Desktop 测试现为 264 项通过，Web build、`git diff --check` 与模板同步检查通过；Vite 主 bundle 约 1.07 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：`AgentTopicPanel` 的模型连接、工具白名单、Skill、适配器和安全边界能力说明已迁入 `desktop/src/lib/agent-topic-agent-config.js`，仅输入 topic id 与 Provider 状态，未知 topic 保持空态。新增 Provider 状态派生和容器边界回归，Desktop 测试现为 263 项通过，Web build、`git diff --check` 与模板同步检查通过；Vite 主 bundle 约 1.07 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：Provider 的 Composer 模型列表探测、模型切换、可用性测试、健康状态写回和 60 秒复测已迁入 `desktop/src/components/workbench/use-composer-model-actions.js`；App 只注入 Provider session、client 和保存回调。浏览器预览继续不发远程探测，Tauri 路径保持既有行为。新增 App Provider hook 边界守卫，Desktop 测试现为 261 项通过，Web build、`git diff --check` 与模板同步检查通过；Vite 主 bundle 约 1.07 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：App 的 Provider 保存连接、保存 Key 和删除连接动作已迁入 `desktop/src/lib/provider-action-controller.js`，controller 注入 Provider client、状态 setter 与统一 Action feedback；模型探测、模型选择和 60 秒健康刷新仍由 App 持有。新增持久化反馈和 App 边界回归，Desktop 测试现为 260 项通过，Web build、`git diff --check` 与模板同步检查通过；Vite 主 bundle 约 1.07 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：阶段目标候选和不进入计划的普通对话结果投影已迁入 `desktop/src/lib/conversation-result-projection.js`；容器继续负责请求结算、附件释放与计划执行边界。迁移后发现旧源码位置断言未同步，已修正 `stage-goal-candidate` 测试并记录到 `docs/LESSONS.md`。Desktop 测试现为 258 项通过，Web build、`git diff --check` 与模板同步检查通过；Vite 主 bundle 约 1.07 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：任务计划、模型/连接状态、本地预览回答与桌面模型调用的选择已迁入 `desktop/src/lib/conversation-chat-result.js`；Tauri 判断、模型客户端、超时策略与预览回退均由 `AgentWorkspace` 注入，保持一套 Conversation 结果契约。新增本地状态、预览和桌面分支回归，Desktop 测试现为 256 项通过，Web build、`git diff --check` 与模板同步检查通过；Vite 主 bundle 约 1.07 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：取消待确认动作、查看下一步与恢复任务三个即时对话命令已迁入 `desktop/src/lib/conversation-immediate-handlers.js`，并注入既有取消 turn 工厂以保持历史会话结构。受控执行分支仍留在 `AgentWorkspace` 的请求生命周期内。新增即时命令回归，Desktop 测试现为 254 项通过，Web build、`git diff --check` 与模板同步检查通过；Vite 主 bundle 约 1.07 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：阶段目标创建、任务开始确认和 Patch Apply 确认三种对话确认分支已迁入 `desktop/src/lib/conversation-confirmation-handler.js`；模块只接收会话、Action、事件投影和 clear callback，不读取 Runtime。新增任务确认投影回归，Desktop 测试现为 253 项通过，Web build、`git diff --check` 与模板同步检查通过；Vite 主 bundle 约 1.07 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：对话中已确认 Patch Apply 的会话投影、进度回写、失败回滚和并发守卫已迁入 `desktop/src/lib/conversation-patch-apply.js`，由 `AgentWorkspace` 注入 Action、会话状态与事件投影，不直接访问 Runtime。新增成功进度和失败回滚回归及源码边界守卫，Desktop 测试现为 252 项通过，Web build、`git diff --check` 与模板同步检查通过；Vite 主 bundle 约 1.07 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：`AgentTopicPanel` 的 Workspace/Task 概览卡片派生已迁入 `desktop/src/lib/agent-topic-cards.js`，容器只注入目标、任务、项目事实和展示 helper；旧 `cardsByTopic` 运行定义已删除，`main.jsx` 由 8683 行降至 8461 行。新增卡片派生和源码边界回归，Desktop 测试现为 248 项通过，Web build、`git diff --check` 与模板同步检查通过；Vite 主 bundle 约 1.07 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：`AgentWorkspace` 的工作台导航已迁入 `desktop/src/lib/workspace-navigation.js`，项目切换、对话/执行/终端页签和工程文件入口均通过注入回调工作，不读取 Runtime 或自行持久化。新增导航与源码边界回归，Desktop 测试现为 248 项通过，Web build、`git diff --check` 与模板同步检查通过；Vite 主 bundle 约 1.07 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：完整 `ProviderPanel` 已迁入 `desktop/src/components/workbench/provider-panel.jsx`，由 App 注入持久化回调、Provider 状态与模型测试记录；模型探测和测试仍只经 `provider-client` 进入共享 Runtime Adapter，Provider 显示/Key 隔离派生归入 `provider-presentation.js`。新增 UI 边界与显示派生回归，Desktop 测试现为 244 项通过，Web build、`git diff --check` 与模板同步检查通过；Vite 主 bundle 约 1.07 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：右侧任务详情与队列卡已迁入 `desktop/src/components/workbench/task-rail.jsx`，复用 Task 展示派生并通过注入的对话、终端与启动回调工作，不访问 Runtime。Desktop 测试现为 241 项通过，Web build、`git diff --check` 与模板同步检查通过；Vite 主 bundle 约 1.07 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：Provider profile 初始化、preset 切换和已保存 profile 切换的纯表单状态转换已迁入 `desktop/src/lib/provider-form-state.js`；ProviderPanel 继续通过 Provider client 执行探测与测试，未改变预览/Tauri 分流。新增 2 项表单状态回归。Desktop 测试现为 241 项通过，Web build、`git diff --check` 与模板同步检查通过；Vite 主 bundle 约 1.07 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：App 的底部 `StatusBar` 已迁入 `desktop/src/components/workbench/status-bar.jsx`，仅消费 snapshot 与运行来源，不接触 Runtime 或领域 client；新增无状态 Surface 边界守卫。Desktop 测试现为 239 项通过，Web build、`git diff --check` 与模板同步检查通过；Vite 主 bundle 约 1.07 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：`TopBar` 已迁入 `desktop/src/components/workbench/top-bar.jsx`，只接收连接显示、Provider 配置面板节点和新对话回调；App 仍唯一持有 ProviderPanel 数据、保存 Key 与模型健康写入。新增 App header 边界守卫。Desktop 测试现为 238 项通过，Web build、`git diff --check` 与模板同步检查通过；Vite 主 bundle 约 1.07 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：`AgentTopicPanel` 的目标归档、恢复和合并迁入 `desktop/src/lib/agent-topic-goal-actions.js`；模块通过注入的 Workspace goal client、错误 setter 与 reload 回调工作，成功后才刷新，失败或缺少合并目标不会刷新。新增 2 项动作回归和领域边界守卫。Desktop 测试现为 237 项通过，Web build、`git diff --check` 与模板同步检查通过；Vite 主 bundle 约 1.07 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：`AgentTopicPanel` 的任务看板局部状态、筛选、排序及只读 view model 已迁入 `desktop/src/components/workbench/use-agent-topic-task-board.js`，面板不再直接初始化 `useTaskBoardState` 或 `buildTaskBoardViewModel`。新增领域边界守卫。Desktop 测试现为 234 项通过，Web build、`git diff --check` 与模板同步检查通过；Vite 主 bundle 约 1.07 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：`AgentTopicPanel` 中的任务更新时间与验证状态派生已迁入 `desktop/src/lib/task-presentation.js`，避免面板自行判断 Task 状态；新增纯函数回归。Desktop 测试现为 233 项通过，Web build、`git diff --check` 与模板同步检查通过；Vite 主 bundle 约 1.07 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：工作区标签列表已迁入 `desktop/src/components/workbench/workspace-tab-strip.jsx`；组件只接收 tabs 与关闭回调，标签生命周期继续由 `useWorkspaceTabs` 统一维护。最终验证：Desktop 232 项测试、Web build、`git diff --check`、文档结构与模板同步检查通过；Vite 主 bundle 约 1.07 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：对话内的动作确认与状态投影已迁入 `desktop/src/components/workbench/use-conversation-turn-actions.js`，由 `AgentWorkspace` 注入导航、Patch、会话写入和 Task Action；阶段目标确认仍保留默认对话与 assistant-ui POC 的原有投影差异。同步将旧文件定位的阶段目标测试改为断言新的 Conversation owner，并在 `docs/LESSONS.md` 记录模块迁移时必须迁移源码边界断言的约束。Desktop 测试现为 232 项通过，Web build、`git diff --check`、文档结构与模板同步检查通过；Vite 主 bundle 约 1.07 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：`AgentWorkspace` 的默认消息时间线、阶段目标卡、引用、动作、附件、诊断与加载态已迁入 `desktop/src/components/workbench/conversation-transcript.jsx`；渲染组件只上报动作，状态写入、导航、Patch 确认和运行态投影仍由容器注入。任务上下文条也已独立为 `task-conversation-context.jsx`，相邻任务切换复用 `useTaskConversationEvent` 统一入口，不再由展示组件派发全局事件。新增边界回归守卫，Desktop 测试现为 231 项通过，Web build、`git diff --check` 和模板同步检查通过；Vite 主 bundle 约 1.07 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：遗留任务详情展示 `ActiveTask` 已从 `main.jsx` 迁入 `desktop/src/components/workbench/active-task.jsx`。组件通过注入的状态映射、检查派生与任务动作工作，不读取 Runtime Adapter 或 Task client；新增领域边界回归，防止它回流 Workbench 容器。Desktop 测试现为 229 项通过，Web build、`git diff --check` 和模板同步检查通过；Vite 主 bundle 约 1.07 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：纯展示组件 `ChatDock` 与 `PatchDraft / ReadonlyPlan / PlanList` 已从 `main.jsx` 迁入 `desktop/src/components/workbench/`，复用现有 Composer、Panel、Badge 和 Desktop tokens，不持有 Runtime 或领域状态。Desktop 228 项测试、Web build 与 `git diff --check` 通过；Vite 主 bundle 约 1.07 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：Task controller 的任务专属对话跳转不再直接依赖 `window`，改由 Workbench UI 注入 `onOpenTaskConversation`；模型预检、任务启动、检查重跑、删除清理和任务对话跳转均有纯 controller 回归覆盖。Desktop 测试现为 228 项通过，Web build、`git diff --check` 和模板同步检查通过。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：`AgentTopicPanel` 的任务启动、模型预检、任务专属对话打开、编辑/归档/删除、失败检查重跑，以及草稿/应用/交接下一步编排已迁入 `desktop/src/lib/task-board-action-controller.js`。controller 通过注入的 Task/Workspace/Execution 操作与 UI setter 工作，不引入第二套持久化或 Runtime 分流；新增模型不可用时不启动、失败检查短路和删除后 UI 清理回归测试。Desktop 测试现为 227 项通过，Web build、`git diff --check` 和模板同步检查通过；Vite 主 bundle 约 1.07 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 增加领域边界守卫：`desktop/tests/domain-boundaries.test.mjs` 明确禁止 `main.jsx` 直接使用 Runtime Adapter、禁止旧 `TaskWorkspace / open-task-workspace` 回流，并校验 Workspace、Conversation、Task、Execution、Provider、Terminal 的 client 均通过共享 Runtime Adapter 暴露命令。审计确认旧任务工作区已无源代码遗留；本地预览服务已重启为 `http://127.0.0.1:1420/`。Desktop 测试现为 224 项通过，Web build、`git diff --check` 与模板同步检查通过；应用内浏览器尚未重新附着，页面级 DOM 验收待连接恢复后补做。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：任务看板的筛选、排序、目标归类、当前任务和模型可用性相关的只读派生已迁入 `desktop/src/lib/task-board-view-model.js`；`AgentTopicPanel` 只消费 view model，任务创建、编辑、删除、目标操作和执行确认仍保留既有单一动作链。新增目标顺序、已验证完成任务筛选回归覆盖。Desktop 测试现为 222 项通过，Web build、`git diff --check` 和模板同步检查通过；浏览器会话在模型切换后没有可枚举标签页，因此本轮尚未完成新的页面重载验收。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：工作区页签的稳定骨架与临时内容清理规则集中到 `desktop/src/lib/workspace-tab-state.js`。项目/会话重置以及任务专属对话事件均复用 `clearTransientWorkspaceTabs`，统一保留“对话 / 终端”并清理文件、临时任务页签；`useWorkspaceTabs` 增加单一 `resetWorkspaceTabs` 入口，`main.jsx` 不再自行维护清理条件。新增状态回归测试；Desktop 220 项测试、Web build、`git diff --check`、浏览器重载与模板同步检查通过，无错误边界或控制台错误。Vite 主 bundle 约 1.06 MB 的既有告警仍未处理。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：新增 `desktop/src/lib/execution-client.js`，计划生成、草稿生成/应用、受控检查、运行摘要和交接合并全部通过 Execution Runtime Client 访问；`main.jsx` 已不再直接调用这组 Runtime command，目标拆解与终端检查入口同步收口。现有 Plan / Patch / Apply / Check executor 仍保留为唯一工作流策略，不改变 Apply 确认或浏览器预览限制。新增客户端预览契约测试，Desktop 测试现为 213 项通过，Web build、`git diff --check` 与浏览器重载均通过，无错误边界或控制台报错。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：Provider 的状态、模型目录、模型健康缓存及模型列表探测统一迁入 `desktop/src/lib/provider-client.js`；浏览器预览继续只读本地状态文件，模型探测仍显式经 preview/Tauri Runtime Adapter，不改变既有模型与 Key 边界。`main.jsx` 已移除这组 Provider 的运行面分支。新增 preview 读取/探测契约覆盖，Desktop 测试现为 212 项通过，Web build、`git diff --check` 与浏览器重载均通过。下一步继续将 Provider 的保存 Key 或 Execution 编排从 App 壳层迁出。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：任务记录的读取、保存与删除统一迁入 `desktop/src/lib/desktop-task-client.js`，浏览器预览使用 `/__project-os/desktop-tasks`，桌面端使用同一 Runtime Adapter 的 Tauri command；`main.jsx` 不再保留任务存储 helper。新增预览读写契约测试，Desktop 测试现为 211 项通过，Web build、`git diff --check` 与浏览器重载均通过，未发现错误边界或控制台报错。下一步迁移 Provider 的读取/健康状态或终端生命周期动作，保持真实 Tauri 流式边界不变。

- 2026-07-17 `Desktop Core Modularization v0.1` 持续推进：任务专属会话打开、普通/任务会话切换、删除后的 fallback 与新会话空态已收口到 `desktop/src/lib/conversation-session-state.js` 纯控制器；`main.jsx` 只负责持久化、提示和向 React 状态提交结果。新增 3 项回归覆盖任务会话不覆盖普通历史、所属任务解析、删除后的选择与空态，Desktop 测试现为 204 项通过，Web build 与浏览器预览重载无错误边界或控制台报错。

- 2026-07-17 已启动 `Desktop Core Modularization v0.1` 长任务：首轮边界盘点确认 `main.jsx` 仍为 10,423 行，集中持有 Workspace、Conversation、Task、Execution 与 Provider 状态；任务域的局部状态已独立为 `useTaskBoardState`。旧 `project-os:open-task-workspace` 事件已统一更名为 `project-os:open-task-conversation`，保持“任务始终在对话中推进”的真实行为。`runtime-api.js` 新增统一 `invokeRuntimeCommand`，任务保存/删除的浏览器预览与 Tauri 分流已从 `main.jsx` 收口到 Runtime Adapter，并新增预览持久化回归测试。Workspace 的 snapshot/source/loading/error、首次加载与预览轮询已迁入 `useWorkspaceSession`；抽取过程中漏传 `snapshot` 曾导致浏览器错误边界，已立即修复、浏览器重载验证通过，并记录到 `docs/LESSONS.md`。目标验收、签收、创建、更新、归档、恢复、合并、切换、确认与拆解确认现已由 `workspace-goal-client.js` 统一处理预览/Tauri 返回值差异；项目切换、路径更新、重命名和移除已由 `workspace-registry-client.js` 统一处理，四种 preview 操作完成后都会回读 workspace snapshot。Provider、Execution 与 Terminal 的 React 状态已迁入各自 session hook；终端 hook 同时持有会话、流式输出、输入缓冲与 generation ref，未改变原有启动/停止行为。会话读取、保存和删除已由 `desktop-conversation-client.js` 处理 runtime 分流。浏览器预览重载无错误边界或控制台报错，Desktop 测试 201 项和 Web build 通过。下一步继续迁移任务专属会话切换与终端动作 controller，保留既有交互和确认边界。

- 2026-07-17 v0.1 收口长任务已完成：任务看板的筛选、排序、创建、编辑、归档、删除、目标合并和动作弹窗等 25 项局部状态迁入 `use-task-board-state.js`，任务确认/结果/失败/详情已由 `TaskActionDialog` 承担；`main.jsx` 不再直接持有这部分任务 UI 状态。重载浏览器预览后再次验证目标与任务入口、默认“目标顺序”和三页签边界正常。最终验证：Desktop 188 项测试、Web build、Cargo check、Rust 单元测试、Runtime / 文档结构及全量仓库检查通过；Vite 仍提示主包约 1 MB，属于后续性能优化项，不阻塞 v0.1 功能闭环。

- 2026-07-17 v0.1 收口长任务第二阶段完成：任务确认、结果、失败和详情弹窗已抽到 `TaskActionDialog`，`main.jsx` 只保留状态与动作编排；已移除没有渲染入口的旧任务工作区 CSS 和命名，当前统一为任务专属对话上下文。应用内浏览器已实测“目标顺序”“继续推进进入对话”“确认后在对话中调整”和同目标前后任务切换，切换前后仍只有对话、终端和目标与任务三个页签，不会创建独立任务工作区。删除任务时前端内存也会按 `taskId` 和旧 `conversationId` 同步移除专属对话，新增回归测试。Desktop 188 项测试、Web build、Cargo check、Rust 8 项单元测试、全量仓库检查、Runtime 与文档结构检查通过。

- 2026-07-17 v0.1 收口长任务第二阶段进行中：任务看板默认排序改为目标 `taskIds` 定义的拆解顺序，并保留最近更新/创建时间/状态排序；删除任务后的 tasks、专属对话、当前任务与只读计划同步收口到 `desktop/src/lib/task-state.js` 纯函数，新增当前任务与非当前任务删除回归测试。Desktop 测试现为 187 项通过，Web build、Cargo check、Runtime 和文档结构检查通过。

- 2026-07-17 v0.1 收口长任务第一阶段完成：任务去重从局部显示规则升级为统一有效任务序列，任务看板、目标进度和任务对话切换都会排除同目标下重复的未完成任务；浏览器预览与 Tauri `save_desktop_task` 也会在新建时复用同目标同名的未归档任务，不再落重复记录。标题比较忽略 Unicode 规范差异和空白，已补回归测试。独立任务工作区已废弃并移除渲染函数，当前任务统一经专属对话推进。

- 2026-07-17 任务确认弹窗已重排：任务说明独占首行，计划步骤与验证项在下方分区，避免三列等宽导致长说明被压成窄列；新增“在对话中调整”，不满意时直接进入任务专属对话修改范围、步骤或验收项，再返回确认。

- 2026-07-17 永久删除任务后的看板状态已收口：删除成功会立即移除目标下的任务卡、关闭相关详情/编辑状态并保持在“目标与任务”看板；目标无剩余任务时进入空态而不是停留在已删除内容上。

- 2026-07-17 Composer 上方任务上下文条已收紧为单行紧凑工具条：目标、任务、状态、任务位置和切换按钮共用一条基线；高度、间距、图标和按钮尺寸缩小，背景与边框改为中性 token，长目标和任务名自动截断。

- 2026-07-17 任务目标上下文条已从消息滚动区顶部移动到 Composer 内部上方：与输入框同宽并紧邻显示，持续提供目标、当前任务、状态、同目标任务位置和前后切换，交互位置对齐 Codex 的目标/任务上下文模式。

- 2026-07-17 任务推进交互已从独立任务工作区收回任务专属对话：点击任务不再创建任务页签，而是切到“对话”并恢复该任务会话；目标名称、当前任务、状态、同目标任务位置和前后切换统一放在对话顶部。终端继续作为独立工具页，任务过程和结果由对话承载。

- 2026-07-17 任务工作区已补目标上下文与同目标多任务导航：顶部持续显示当前任务所属目标和“第 X / N 项”，顺序优先采用目标 `taskIds`，并排除归档任务；用户可通过前后按钮直接切换同目标任务，同时恢复对应任务专属对话。原任务元信息里的重复“关联目标”已移除。

- 2026-07-17 智能任务工作区首轮闭环已落地：“继续推进”不再打开任务弹窗，而是在中间工作台创建可关闭的任务标签页；页面统一展示任务状态、关联目标、执行步骤、验证/最新结果、动态下一步、改动草稿和任务专属对话。分析/检查类任务进入“继续分析”，实现类任务进入受控 Patch 流程，失败态优先重跑验证或分析失败原因，完成态不会重启执行。任务对话记录新增顶层 `taskId / goalId / projectId`，每个任务恢复唯一当前对话并兼容旧 `conversationId` 关联；模型请求同步携带任务标题、状态、目标、摘要和建议下一步，助手最新结论会回写任务。应用改动与确认完成均有明确确认，应用后自动验证；终端入口只注入注释形式任务上下文，不自动执行。永久删除任务同步清理新旧专属对话、目标和待办关联。Desktop 181 项测试、Web build、Cargo check、Runtime 和文档结构检查通过；应用内浏览器因错误页 URL 安全策略未完成最终视觉点击，需在用户保持 `http://127.0.0.1:1420/` 标签打开时补验收。

- 2026-07-16 Hermes 执行器接入第二层已落地：桌面端与浏览器预览均可只读探测本地 `hermes-acp`（优先）或 `hermes` CLI；ACP `--check` 只说明通道可启动，状态文案不再把它误称为模型可执行。桌面端生成 Patch Draft 时优先启动一次性 ACP session，并将当前 provider 密钥只注入该子进程内存环境；针对 `aihub.firstshare.cn` custom provider 同时临时注入 Hermes 所需的 `FIRSTSHARE_API_KEY`，不写入 `~/.hermes` 或前端。请求提示禁止工具调用，且需要 ACP client 支持的工具或权限请求会被拒绝。只有受限 FILE CONTEXT 内的可校验 unified diff 才回到现有 Diff review / Apply 链路；不会由 Hermes 写文件。ACP 异常、模型调用失败、无 diff 或越权文件会明确拒绝，并回退既有 provider/local 草案。浏览器预览仍只生成占位草案，不读取密钥或调用模型。本机已通过 `hermes-agent[acp]` 安装 Hermes v0.18.2 并通过 ACP health check；非敏感配置已设为 `custom / gpt-5.5 / https://aihub.firstshare.cn/v1 / chat_completions`。新 Key 下，OmniDesk 的 `gpt-5.6-terra`、Hermes 的 `gpt-5.5` 直连和 ACP 无工具 prompt 都已返回成功。OmniDesk 继续拥有项目事实、确认边界、任务和运行记录。
- 2026-07-16 Conversation Event Contract 第一阶段已落地：新增 `omnidesk.conversation-event.v0.1` schema 与 Runtime 纯函数，把旧执行结果映射为统一的 progress / approval / completed / failed / cancelled 事件。Projector 和会话记录已持久化 `conversationEvents[]`，同时保留旧 `events / outcome / text` 保证默认渲染器与 assistant-ui POC 兼容。新增 6 项契约测试，定向 49 项测试、Web build 和 Cargo check 通过；后续再渐进接入模型生命周期、审批和工具事件，未达到投影对等前不删旧字段。
- 2026-07-16 assistant-ui POC 输入区已按用户选择恢复 OmniDesk 原样：assistant-ui 只负责消息和工具卡片，POC 与默认模式均复用现有 `ChatComposer / ChatDock`，附件、模型选择、语音、发送和停止行为保持一致，不再维护第二套 Composer 视觉。浏览器此前已用唯一测试消息验证发送进入原 Runtime 并正确返回模型状态，测试会话已精确清理。Rust 模型 command 仍是整段返回，尚不具备 token 级流式输出和底层 HTTP abort。
- 2026-07-16 `assistant-ui` 隔离式对话 POC 已接入：安装 `@assistant-ui/react@0.14.26`，新增 `OmniDeskConversationAdapter`，通过 `useExternalStoreRuntime` 映射现有 turns，不接管 Rust 模型、Conversation Runtime 或本地持久化。POC 仅由 `?conversationUi=assistant` 启用并动态加载；恢复 OmniDesk 原 Composer 后独立 chunk 约 58.9 KB gzip，默认主包只增加约 1 KB gzip。历史阶段目标的旧“候选 + 已登记”重复消息会在内存适配层合并为 `stage_goal` 工具卡片，不改磁盘历史；浏览器已验证范围、状态、Badge、“补充范围”和“进入任务拆解”，其中补充范围可正确回填现有 Composer。
- 2026-07-16 阶段目标对话确认体验已收口：候选与已登记状态改为同一条消息原位更新，使用现有语义 Badge 展示“目标候选 / 已登记”，完整保留用户原始范围，展示实际关联项目目标与待确认/待拆解状态；候选不再继承模型的通用依据。确认后提供“补充范围”和“进入任务拆解”操作，不再追加重复助手回复。Workspace snapshot 新增 `projectGoals`，写后必须验证 `parentProjectGoalId`，缺少关联时不允许显示成功；同时修复本次测试产生的阶段目标双向关联数据。
- 2026-07-16 桌面端阶段目标对话闭环已接通：用户用自然语言表达“接下来 / 下一阶段 / 本阶段要做什么”后，只有真实桌面模型调用成功且 provider 状态为 `available` 才生成阶段目标候选；用户可点击“确认登记为阶段目标”或回复“好 / 可以”确认，系统随后创建并确认阶段目标、自动关联当前活动项目目标，并刷新项目进展。候选确认前不写治理数据，确认后不自动创建任务或执行代码；浏览器预览不伪造模型候选。同步修复预览验收更新目标状态时未使用当前 registry 项目路径的问题。
- 2026-07-15 `启动方式` 已按唯一页面职责收口：总体启动状态只在页头展示一次，正文仅为运行环境和启动入口；每条命令以发送到终端为主操作、复制为次操作，点击后只打开终端并预填草稿，不自动执行。路由登记 `project-runbook -> execution-terminal`，命令选择归 Runbook，执行、输出和停止归终端。构建、测试和治理检查不再面向用户展示，任务在应用改动后按计划自动选择受控检查，结果归 `执行结果`。页面同时移除重复状态与入口数量、启动后验证、来源健康、页头来源数量和底部职责说明，并从 Fact Store、Adapter 和 Contract 删除 `runbook.file-statuses`；底层文件健康仍由 `工程资产 / 治理文件` 统一拥有。
- 2026-07-15 `当前进度` 已从任务进度改为项目进度：Fact Adapter/Store/Contract 删除 `progress.tasks` 和 `progress.backlog`，新增 `progress.milestone / acceptance / validation-report / risks`；Selector 不再计算任务百分比，而是输出当前里程碑、当前目标、五阶段目标链、与当前目标 ID 匹配的验收标准和验收报告、项目风险及按目标状态推导的唯一下一步。页面对应改为“项目位置 / 目标阶段 / 验收与风险 / 下一步”四段；旧目标验收不会污染当前目标，没有验收依据时显示“尚未建立”而非 `0%`。Desktop 140 项测试和 Web build 通过。
- 2026-07-15 `当前进度` 与 `当前任务` 的职责重合已清除：进度 Contract/Selector 删除 `project.phase`、`activeTasks` 和 `recentDone` 投影，页面移除“打磨中”阶段 Badge、活动任务列表、最近完成分区和重复“查看下一步”按钮；随后已按上一条继续升级为项目进度模型。生命周期阶段、任务详情和完成记录分别回归项目概览、当前任务和执行结果 owner 页。
- 2026-07-15 界面规范可视化治理已落地：`界面规范` 从重复页面收口为纯分组，下面仅保留 `Token / 组件` 两个唯一 owner 页；路由注册表新增独立 surface 和所有权测试，`WorkspaceTree` 支持嵌套分组。Token 页展示 5 类代表变量与实时样例；组件页按 Primitive / Pattern / Composition 展示 14 个真实登记项、组件预览、variants、sizes、states、使用页面、源码位置和可访问性状态，源码动作复用工程文件路由。浏览器已验证层级、两页切换和 1176×1045 视口无横向溢出；Desktop 139 项测试和 Web build 通过。
- 2026-07-15 `当前进度` 已迁到项目概览同一套页面骨架：从项目概览头部抽出 `OverviewPageHeader`，与既有 `OverviewSection` 一起由两个页面复用；当前进度改为统一头部、目标与完成度、任务状态、当前推进、最近完成四个扁平分区，不再使用独立卡片式驾驶舱。项目概览的核心定位、技术组成和工程结构仍是项目概览专属业务 slot，通用组件只在 owner 页面内部展示，不新增菜单。浏览器验证项目概览无回归，当前进度单头部、四分区、无横向溢出。
- 2026-07-15 工作区路由与页面职责完成收口：新增 `desktop/src/workspace-route-registry.js`，为所有一级菜单、二级菜单和叶子页登记稳定 route、surface、唯一功能 owner 与跨页链接；菜单、Tab、程序化导航和专属页面渲染改用 `routeId`，删除中文标题兜底。`当前进度` 收紧为只读聚合，只保留阶段、目标摘要、任务完成度、1–3 个活动任务摘要、最近完成、阻塞数、唯一下一步和弱证据元数据；目标、任务、结果和风险详情分别跳转到所属页面。新增注册表契约测试，拦截重复 ID/path/owner、漏登记和失效链接。浏览器已验证四类摘要跳转，以及菜单、Tab、中间标题三向同步；Desktop 138 项测试、Web build 和全仓库 `tests/run-tests.sh` 均通过。
- 2026-07-14 项目概览介绍移除旧副名 `Project OS Desktop`：页面介绍的首选来源 `.project-os/project-profile.json`，以及 `state.json`、`workspace-facts.json`、`PROJECT.md` 已统一改为只以 `OmniDesk` 开头；身份验收新增生产事实源断言，避免扫描或 fallback 再把旧副名带回用户界面。历史 bundle 和架构文档中的技术术语保持不变。
- 2026-07-14 项目显示名跨运行面完成统一：Preview snapshot 不再让 `.project-os/state.json` 的旧内部名覆盖 registry 当前项目名；Fact adapter 直接优先读取 `projects[].isCurrent` 的显示名，Tauri 与 Preview 现在都以 registry 为展示入口。`.project-os/state.json` 和 `PROJECT.md` 同步将产品名收口为 `OmniDesk`，`project-os-starter` 仅保留为仓库、package 或内部 ID。
- 2026-07-14 项目概览事实刷新交互完成收口：事实最新时移除常驻“更新项目事实”文字按钮，只保留带 Tooltip 的弱刷新图标；检测到变化时自动刷新并显示实时状态，自动或手动失败都会按项目保存失败时间、原因、变化签名和重试次数，重载后持续显示错误和“重试”，成功后清理失败记录、刷新时间并隐藏主操作。生命周期“打磨中”等阶段状态保持独立，未与刷新状态混用。
- 2026-07-14 Conversation Runtime 最终 Preview 点击回归通过：普通聊天“帮我处理 …”被升级为任务后，只生成 1 条助手计划终态消息和 1 个 `confirm-active-task` / “开始执行”动作；请求、任务和对话共享同一追踪 ID。冒烟生成的 task、conversation 和 manifest 条目已按精确 ID 清理，刷新后界面与磁盘均无残留。
- 2026-07-14 普通聊天升级任务的最后一条页面级计划终态分支已删除：`AgentWorkspace` 不再直接调用 `onGeneratePlan(...).then/.catch` 并手工拼成功/超时/失败 turn，而是构造注册的 `generate-plan` Action，交给 Conversation Action Executor 统一生成 progress、requestStatus、diagnostic、pending action 和最终 turn。同步删除不再使用的计划投影 import，边界测试新增禁止回流规则，并补附件、conversationId、displayTask 上下文透传断言。
- 2026-07-14 Workbench executor 边界审计完成：确认 Plan provider fallback、Patch Draft 活性校验、Apply/验证终态、Check 异常与任务 run 已全部离开 `main.jsx`；删除只引用一次的 `guardedChecks` capability 别名，直接使用 `guardedCheckCapabilities` SSOT。新增 `executor-boundary.test.mjs` 防止执行策略回流，并在架构文档登记 executor/Workbench 职责与唯一已知遗留路径。
- 2026-07-14 受控 Check workflow 已从 `App` 抽离：新增 `executeGuardedCheckCommand` 与 `executeTaskGuardedCheckWorkflow`，统一白名单 command 成功/异常标准化、任务 run 与终态持久化、对话 update 投影；对话直接检查、任务重跑和终端检查共用同一 command executor。React 只维护 loading/error、terminal log 和应用 conversation update；能力仍必须先由 `guardedCheckCapability` 解析，未扩大命令白名单。
- 2026-07-14 只读 Plan workflow 已从 `App` 抽离：新增 `executeReadonlyPlanWorkflow`，统一处理本地计划、远程 provider、固定 15 秒超时、本地确定性 fallback、旧后端参数兼容、请求活性校验、结构化终态和任务耐久持久化；React wrapper 只保留 requestId、active ref 与 loading/error/action feedback。新增测试覆盖本地成功、远程成功、超时 fallback、旧参数附件兼容、迟到结果拒绝、legacy retry 超时和 provider 失败。
- 2026-07-14 Patch Draft workflow 已从 `App` 抽离：新增 `executePatchDraftWorkflow`，统一处理只读草稿 command、请求活性校验和任务耐久持久化；React wrapper 只保留 loading/error/action feedback。新增测试覆盖成功持久化、生成完成后请求被取代、生成异常后请求被取代和真实生成失败；两类迟到结果都不会写入任务，取消 feedback 也会稳定收口。
- 2026-07-14 Patch/Apply 前端执行编排已从 `App` 抽离：新增可注入 command、存储和进度回调的 `executePatchApplyWorkflow`，统一处理 Apply、自动验证、run summary、耐久任务状态和失败投影；React wrapper 现在只维护 loading/error/action feedback。新增独立 workflow 测试覆盖无检查成功、检查结果失败、Apply command 异常和 Apply 后验证异常，不新增执行能力。
- 2026-07-14 Apply 失败持久化前端测试入口已补齐：新增 `persistPatchApplyFailure`，现有 Apply executor catch 分支通过该函数耐久写入失败任务。独立测试覆盖 `git apply --check` 校验失败写入 `task.applyResult`，以及 Apply 已成功后验证异常保留成功 Apply 证据并写入 `task.verificationSummary`；两条路径都断言使用 `{ durable: true }`。
- 2026-07-14 Workbench Action adapter 组装已迁入 Conversation Runtime：新增纯 `createConversationActionAdapters` factory，统一映射计划生成、Patch 任务动作、受控检查和动态请求活性判断；`AgentWorkspace` 只注入依赖，不再内联展开三类 Action payload。新增 adapter 契约测试，未改变 provider、任务持久化或 UI 行为。
- 2026-07-14 Conversation Action Runtime 四条真实 Tauri 链路完成 smoke：`generate-plan` 生成并保存只读计划，`run-check` 1.1 秒完成且返回 0 个 Runtime 告警，`generate-patch` 在目标不属于 FILE CONTEXT 时正确只返回不可应用草稿，受控 `apply-patch` 创建 `.project-os/runs/action-smoke.txt` 后自动运行 Runtime 检查并得到 `applyResult.success: true / status: done / 自动验证通过 / run summary`。Smoke 暴露并修复 Rust 对 diff 调用 `trim` 导致末尾换行丢失、`git apply` 报 `corrupt patch` 的问题；新增真实 `git apply --check/apply` Rust 回归测试，Cargo 测试增至 4 项。Apply 异常现在也会持久化到 `task.applyResult` 或 `verificationSummary`。测试文件、任务、会话、summary 和 audit 已清理。
- 2026-07-13 Conversation Runtime 请求接管与中断恢复完成：处理中输入“停止”会取消当前请求，“继续原任务”不会重启，其他新输入会让旧 `requestId` 失效并以新 `requestId` 接管；Action Executor、计划进度和 Patch Draft 持久化都会拒绝旧请求迟到结果。Composer 在空输入时保留停止按钮，有新输入时切换为“提交新要求”。应用重启恢复中断记录时会清除旧 pending action、标记旧动作 resolved，并提供“重试”和可选“查看任务”。真实 Tauri 窗口已通过“停止 / 继续原任务 / 新要求接管 / 再停止”连续 smoke；同时修复取消后全局 Action Feedback 仍显示“正在生成计划”的假进度，取消现在按同一 `requestId` 同步收口为“已停止当前处理”。Desktop 105 项测试、Web build、Cargo test 和全量检查通过，测试任务和对话已清理。
- 2026-07-13 Conversation Runtime `turn summary` 契约完成：会话 schema 升级为 `project-os.conversation.v0.3`，新增 `project-os.turn-summary.v0.1`，把最近 8 条之外的内容结构化保存为主题、结论、约束、决策、执行结果、未决问题、委托和 pending action。模型请求改为“早期摘要 + 最近 8 条原文”，Tauri prompt 同步接收 summary；旧 v0.2 记录自动补空摘要。短追问从摘要继承主题，约束句不会覆盖主题，UI 历史不删除。Desktop 测试增至 103 项。
- 2026-07-13 Conversation Runtime Action Executor 已落地：新增 `action-executor.js`，统一处理 `generate-plan / generate-patch / run-check` 的 adapter 调用、进度事件、请求终态、诊断、按钮和 pending action；Workbench 原约 200 行 Action ID 结果分支已替换为单一 executor 调用，只注入计划、Patch 和检查 adapter。真实 diff 才产生 Apply、Preview 占位草稿保持只读，adapter 意外异常会收口为可恢复失败 turn。Desktop 测试增至 101 项。
- 2026-07-13 `generate-plan` 已迁入 Conversation Action Decision：明确“生成计划 / 制定方案 / 拆解任务”现在按 `read-only / confirmation:none` 直接执行上下文读取、计划生成和任务耐久保存，不再先走通用聊天再解析助手承诺。普通“当前计划是什么 / 方案有什么风险”仍保持问答；计划生成成功后只留下真正需要决策的“开始执行” pending action。Desktop 测试增至 96 项。
- 2026-07-13 Conversation Action Runtime 的 Patch/Apply 纵向链路完成：明确修改请求现在以 `generate-patch / read-only-draft / confirmation:none` 自动执行“读取上下文 -> 生成只读计划 -> 耐久保存任务 -> 生成草稿”；只有真实 unified diff 才产生 `apply-patch / writes-files / confirmation:required`。按钮确认和文字“好”共用真实 Apply executor，确认后直接应用、逐项验证并在原 `requestId` 时间线上收口。Preview HTTP 实测返回 `PATCH_DRAFT_PENDING` 且不暴露写入操作；Desktop 94 项测试、Web build 与 Cargo check 通过。
- 2026-07-13 Conversation Action Runtime 第一条纵向链路完成：Action Registry 新增 `mode / risk / confirmation` 决策，检查能力统一声明命令、依赖与确认策略。“运行一轮基础检查”现在跳过通用计划和确认，直接调用受控 Runtime 检查，并在同一 `requestId` 下回流“识别动作 / 运行检查 / 汇总结果”。Preview 新增等价白名单端点，Tauri 复用现有 Rust command；真实 HTTP 检查返回 `success: true / 0 warning`。内嵌浏览器本轮新标签无法附着，未完成点击级视觉复测。
- 2026-07-13 对话处理步骤收口为单一时间线：计划前、生成中和等待确认共用“理解请求 / 读取项目上下文 / 生成执行计划 / 保存任务 / 等待确认”五阶段；折叠标题直接从 `current` 事件推导。确认、Patch、Apply 和验证事件按 id 追加合并，不再覆盖旧步骤；处理事件与耗时随对话持久化，`runtimeState` 在 React 任务状态尚未完成重渲染时会从最新助手 outcome 兜底推导。浏览器实测确认前标题与唯一当前步骤均为“等待确认”，确认后原五步保留并同步进入“等待生成改动”。
- 2026-07-13 任务导航收口：顶部工作区不再生成任务执行页签，只保留对话、终端和用户显式打开的文件；对话里的“查看执行”携带 `taskId` 并定位右侧任务，保持中间对话不跳页。右栏对同一目标下同名未完成任务做展示层合并，选中后内联展示摘要、步骤、检查结果与继续操作，已完成历史和底层任务记录不删除。
- 2026-07-13 Conversation Runtime v0.2 的 12 项收口清单全部完成：Controller 生成 submission/request/user turn/command 并分派即时命令，Action Registry 统一分派页面能力；`main.jsx` 已删除 Intent Router 与 Action ID 条件链，只保留 provider/task/UI 适配器。新增 dispatcher 契约测试，Desktop 测试增至 82 项。
- 2026-07-13 Conversation Runtime 执行事件回流完成：Plan、Patch Draft、Apply、逐项自动验证、检查成功/失败都会按原 `requestId` 更新同一助手消息；对话持久化改为串行队列，避免快速阶段事件异步落盘时旧状态覆盖新状态。
- 2026-07-13 Conversation Runtime v0.2 的 12 项清单已写入 `.project-os/task-backlog.json`。本轮完成 Action Registry、严格状态转换、单消息投影、取消/重试/恢复、Conversation Schema、真实引用、统一错误、UI runtime state 和 Runtime E2E；Controller 副作用迁移与 Patch/Apply 全量事件回流保持 running，最终遗留清理等待这两项结束。仓库全量 `tests/run-tests.sh` 已通过。
- 2026-07-13 Conversation Runtime v0.2 收口推进：Controller 已接管 submission/request/user turn/command 准备；Action Registry 拒绝未注册动作；状态机增加合法转换约束；Store 写入 v0.2 schema 并迁移旧记录；执行检查按 requestId 原位回流；错误、引用和恢复形成独立契约；新增完整任务对话生命周期测试。
- 2026-07-13 Conversation Runtime 第一版完成并接入生产：新增 `contract / state-machine / intent-router / orchestrator / projector / store` 六个模块；Workbench 已使用 Runtime 控制重入、意图分类、短回复命令、执行/取消消息投影和持久化前消息去重。旧 `main.jsx` 内重复 Intent Router 已删除，新增 4 组 Runtime 契约测试，后续对话能力必须先扩 Runtime 再接 UI。
- 2026-07-13 计划生成处理中改为真实进度流：Workbench 通过非序列化 `onProgress` 接收生成器阶段事件，处理中标题会依次显示“读取项目上下文 / 生成执行计划 / 使用本地计划 / 保存任务”；展开状态同步展示 done/current/pending，结束后不再突然出现此前不可见的步骤。
- 2026-07-13 执行确认改为对话内后台启动：点击“开始执行”只耐久推进任务状态，不再自动切换页面；对话追加一次“已开始执行”状态，并提供唯一“查看执行”入口，用户主动点击才进入执行页。运行中再次输入“继续”只返回当前状态，连续相同状态不重复追加。
- 2026-07-13 修复“开始执行”无反馈与后续计划超时：对话 Action 携带真实 `taskId`，点击后耐久更新任务为 running，只有动作成功才消费 pending action；无 pending action 时“好/继续”会恢复已有活动任务，不再重新进入计划生成。Tauri 远程计划超过 15 秒会降级到本地确定性计划并继续创建任务，不再向用户显示超时失败。
- 2026-07-13 对话执行链路完成状态机改造：对话记录新增机器可读 `pendingAction`，助手动作承诺会绑定结构化 Action；“好/继续/然后呢/不用”等短回复按待办动作确认、查看或取消，不再重新生成一段承诺文案。计划生成后留下唯一“开始执行”待办，按钮和文字确认都会消费该状态。
- 2026-07-13 消息提交与对话投影收口：相同内容 1.2 秒内按 `submissionId` 去重；处理中输入按停止、继续当前请求或新要求接管分类。连续相同引用不重复展示，多条依据默认折叠为“依据 N”；对话按内容高度紧凑排列。用户消息、Action 解析字段和请求追踪信息会随对话记录持久化。
- 2026-07-13 请求链路可观测性完成：用户消息、助手结果与任务记录共享 `requestId`；助手结果记录 `outcome / taskId`；任务保存 `requestTrace.requestId / taskId / startedAt / outcome / persistedAt / runtime`。`persistedAt` 和 `runtime` 由 Preview/Tauri 存储端在真实落盘时写入，生成结果使用存储端返回的实际任务记录。
- 2026-07-13 任务存储建立跨运行面故障验收：Preview 测试直接复用生产存储模块并在系统临时目录注入原子替换、陈旧/近期临时文件、损坏/正常 JSON；Tauri 增加标准库隔离目录测试，覆盖原子写、临时文件保留和损坏文件隔离。桌面验证基线从 `cargo check` 提升为同时运行 `cargo test`。
- 2026-07-13 任务存储增加异常残留恢复：Preview 与 Tauri 在读取和保存任务前都会清理超过 1 小时的 `.tmp`；1 小时内临时文件保持不动；无法解析的任务 JSON 不删除，而是移动到 `desktop-tasks/quarantine/` 并保留原文件名与隔离时间，避免坏文件污染任务列表同时保留诊断现场。
- 2026-07-13 任务列表增加 manifest 恢复一致性：Preview 读取任务时合并 manifest 记录与目录真实 JSON，目录中已落盘但尚未登记 manifest 的任务会自动恢复可见；同时过滤重复项、`manifest.json` 和非 JSON 文件，避免两文件提交中断造成任务丢失。
- 2026-07-13 桌面任务存储改为原子写入：浏览器预览的任务 JSON 与 manifest、Tauri 的任务 JSON 都先写同目录临时文件，完成 flush/sync 后再原子替换目标文件；写入失败会清理临时文件，避免进程中断留下半截 JSON。
- 2026-07-13 新计划任务 ID 改为由 `requestId` 稳定派生：相同请求即使并发到达也会命中同一任务文件和同一前端实体，从标识层消除“扫描后写入”的竞态窗口；无请求 ID 的治理任务继续使用随机 ID，存储端扫描去重保留用于旧数据兼容。
- 2026-07-13 任务存储增加请求幂等性：浏览器预览和 Tauri 保存任务时都会按非空 `requestId` 查找既有任务，同一请求被重放时返回原任务而不创建第二条；耐久提交以存储端实际返回记录更新 UI，避免前端展示未落盘的新 id。
- 2026-07-12 新计划任务改为耐久提交：计划生成后先成功写入任务存储，再更新任务列表、活动任务和执行页；持久化失败会返回失败结果，不再出现界面显示“已生成”但刷新后任务消失的幽灵任务。已有任务的执行状态更新继续使用乐观提交。
- 2026-07-12 计划生成结果从布尔值升级为结构化终态：统一返回 `succeeded / failed / timed-out / cancelled` 与错误信息，超时通过明确 `REQUEST_TIMEOUT` 错误码识别；对话提示、请求生命周期和任务入口不再各自猜测失败类型。
- 2026-07-12 对话计划生成收敛为单一请求生命周期：每个请求只允许从 `running` 进入一次 `succeeded / failed / timed-out / cancelled` 终态，超时、取消后的迟到结果会被忽略；超时边界下沉到只读计划生成阶段，任务提交阶段不再被外层计时器截断；移除对话区自动注入的重复任务状态，任务详情继续由执行页和右栏承载，避免同一请求同时显示失败、成功和等待执行。
- 2026-07-12 对话处理状态改为主流折叠摘要：处理中显示“当前动作 · 用时”，完成后显示“已处理 · 用时”，失败显示“处理失败”；默认只占一行，点击后展开状态时间线。移除处理中按钮式步骤标签，状态摘要移到回复正文之前，并记录每轮真实 `durationMs`。
- 2026-07-12 Codex 内置浏览器白屏兼容：确认 Chrome 正常而 Codex WebView 在 Vite React Refresh/HMR 注入阶段白屏。`1421` 增加 `PROJECT_OS_EMBEDDED_BROWSER=1` 启动模式，关闭 Fast Refresh/HMR；HTML 增加 4 秒首屏启动失败兜底，避免再显示无信息纯白页。`1420` Tauri 开发模式不受影响。
- 2026-07-12 修复桌面/浏览器对话输入“输入后没反应”：根因包括内嵌浏览器继承宿主 `__TAURI_*` 后把 `1421` 误判为 OmniDesk Tauri。运行时检测现同时校验 bridge 与本地 dev origin，`1421` 强制走 Preview API；Enter 与发送按钮统一显式调用提交函数，Tauri `chat_with_model` 增加 12 秒超时和本地回答回退。
- 2026-07-12 Fact/Slot 八阶段架构计划完成收口：架构与测试 SSOT 已更新为真实运行状态，新增跨运行面 acceptance test，覆盖浏览器/Tauri 等价事实、旧项目兼容、三个已迁 Surface 共用 Fact Store、部分模块门控、增量依赖和事件顺序。后续页面迁移按同一 Contract/Adapter/Selector/Renderer 模式渐进进行，不再改运行时核心协议。
- 2026-07-12 “当前进度”迁移到 Fact/Slot：新增 progress summary、goal、tasks、backlog、evidence 五类事实和独立 Contract/Selector。任务噪声过滤、阶段与状态文案、完成度、下一步、最近完成和风险聚合从 React 组件移入纯 Selector；组件只保留风险切换、打开任务和只读文件预览交互，并绑定 `project-overview / project-progress` 模块。
- 2026-07-12 “启动方式”成为第二个 Slot Runtime 迁移样板：浏览器预览和 Tauri snapshot 会从真实 package scripts、Cargo manifest 和治理检查脚本生成结构化命令；Fact Store 新增 runbook summary、commands、file statuses，页面由独立 Selector 与 `project-runbook` Contract 驱动，并绑定 `project-overview / project-runbook` 模块。原 OmniDesk 专属硬编码命令已删除。
- 2026-07-12 Fact/Slot 架构第七阶段第一批完成：能力模型已接入 Slot Runtime。Slot 契约可声明 workspace capability 与 module 要求；Runtime 在执行 Selector 前统一门控，支持父能力和模块级启用、旧项目无 manifest 兼容，以及能力状态变化触发完整重新编译。项目概览四个 Slot 已绑定 `project-overview / project-identity`。
- 2026-07-12 Fact/Slot 架构第六阶段完成：Slot Runtime 新增事实依赖索引和增量 `reconcile`，Fact Store 新增值、状态与新鲜度差异检测。事实变化只重算直接依赖的 Selector/Slot，未受影响描述符保持对象身份；每次增量更新按 `source.changed -> fact.invalidated -> fact.updated -> selector.recomputed -> slot.updated` 产出不可变诊断事件。
- 2026-07-12 Fact/Slot 架构第五阶段完成：项目概览已从页面内手写数据派生切换为 `Source Adapter -> Fact Store -> Selector -> Slot Runtime -> React Renderer`。四个区域继续复用现有 Header、OverviewSection、Badge、Button 和 Tag 视觉；更新时间使用刷新完成时间覆盖旧快照，来源链接改为事实实际选中来源。旧页面派生逻辑已删除。
- 2026-07-12 Fact/Slot 架构第四阶段完成：新增通用声明式 `SlotRuntime` 和项目概览装配器，按契约执行 surface 过滤、稳定排序、Selector 与组件白名单解析、事实依赖校验、`always / has-data / enabled` 显示策略及 action 注册。Runtime 输出不可变渲染描述符，不直接执行动作；现有 UI 尚未切换到 Slot Renderer。
- 2026-07-11 Fact/Slot 架构第三阶段完成：新增纯 `project-overview-selectors`，将 Fact Store 映射为四个可序列化项目概览 Slot ViewModel；统一处理阶段文案、技术与目录分类、版本去重、空数据隐藏、新鲜度、缺失和冲突传播。Selector 不读文件、不调用 runtime、不依赖 React；现有 UI 继续双轨运行，尚未切换到新 ViewModel。
- 2026-07-11 Fact Store 第二阶段收口：将 registry、state、profile、package/Cargo、workspace facts、scanner 和 freshness 拆为独立 Source Adapter；事实裁决会保留每条候选证据的值、状态和可信度，确认来源值不一致时标记 `conflict`，同时按固定优先级保留可用展示值。新增旧页面双轨差异诊断和序列化 Schema 契约测试，现有 UI 仍使用旧数据路径，尚未切换渲染。
- 2026-07-11 Fact/Slot 架构第一阶段完成：新增 Project Fact、Workspace Slot、Fact Event 三类 Schema，以及 `project-overview-contract.v0.1.json` 事实归属和四个项目概览插槽注册表。新增可复用契约校验器与测试，拦截重复 ID、未知 Selector/组件、未知事实依赖和错误事件顺序；本阶段未修改现有页面渲染。
- 2026-07-11 规范化 Fact Store 第一版完成：`desktop/src/fact-store.js` 从桌面/浏览器共用 snapshot、Project Profile 与 Workspace Facts 构建十项项目概览事实，支持 primary/fallback 选择、`selectedSource`、可信度、新鲜度、显式 missing、不可变记录和纯 JSON 序列化；暂未接管 UI。

- 2026-07-11 工作区渐进能力架构开始落地：新增 `schemas/project-capabilities.schema.json` 和 `.project-os/project-capabilities.json`，将完整能力注册表与项目级 `available / detected / recommended / enabled` 状态分离；Tauri 与浏览器预览 snapshot 已读取能力清单。当前尚未过滤现有菜单，下一步应由 `workspace-outline.js` 映射能力 ID 并渐进展示。
- 2026-07-11 工作区菜单已接入能力过滤：核心项目概览、任务和文件固定启用；`enabled / detected / recommended` 能力进入主菜单，`available` 默认隐藏；没有能力 manifest 的旧项目保持完整菜单兼容。新增回归测试覆盖完整项目、最小项目和检测能力三种情况。
- 2026-07-11 左侧工作区新增“更多能力”入口：列出当前项目处于 `available` 的隐藏能力，用户启用后持久化更新 `.project-os/project-capabilities.json` 并刷新菜单；Tauri command 与浏览器预览 endpoint 使用同一语义。当前 OmniDesk 无隐藏能力时显示明确空态。
- 2026-07-11 能力扫描推荐已接入 snapshot：目标、规则、源码/架构、测试、交接/决策和模型配置作为固定可解释信号；扫描只读合并，不写 manifest，不降低用户状态。当前 OmniDesk 的设计实现和验证交付为“建议”，规则和知识记忆为“已识别”，菜单右侧以弱提示表达来源。
- 2026-07-11 能力生命周期最终收口：主菜单只显示核心和 `enabled` 能力；`available / detected / recommended` 统一进入“更多能力”，显示用途、识别证据和推荐数量。用户可“启用”或“暂不需要”；后者持久化为 `dismissed`，后续扫描不会反复推荐。当前 OmniDesk 推荐中心显示 4 项，主菜单不再因扫描自动变化。
- 2026-07-11 能力模型升级为两层：`workspaceCapabilities` 管理 OmniDesk 工作面，`domainCapabilities` 描述前端、后端、数据库、桌面端、CLI、AI、测试和部署。保留旧 `capabilities` 作为兼容别名；Rust 与浏览器扫描均已输出两层 snapshot。当前 OmniDesk 识别到前端、桌面端、CLI、AI、测试和部署，后端与数据库保持 available，未把 Tauri/Rust 误判为后端。
- 2026-07-11 新增领域到工作区映射注册表 `desktop/src/domain-workspace-mapping.js`：八类领域分别映射到工作区能力和具体子模块；“更多能力”会显示“因检测到某领域，建议哪些模块”，推荐不再只有文件信号。当前仍按工作区整包启用，下一步再升级模块级状态。
- 2026-07-11 模块级能力第一层已落地：workspace capability schema 增加 `modules[]` 状态；菜单过滤支持只显示 enabled 模块。旧项目启用能力但没有 modules 时继续显示全部模块，保证迁移兼容；新增部分模块回归测试。多选启用 UI 和模块状态写入仍是下一步。
- 2026-07-11 模块级启用闭环已补齐：“更多能力”按领域推荐默认勾选具体模块，用户可取消部分选择并点击“启用所选模块”；Tauri 与浏览器预览会把选中模块写为 enabled、未选推荐模块保留为 recommended，父能力进入 enabled 后菜单只显示已选模块，后续仍可继续追加。
- 2026-07-11 项目概览移除“项目事实已更新”正文提示条，更新反馈收口到按钮的 `更新中 / 已更新 / 更新失败`，成功后同步刷新标题更新时间。“更多能力”从左栏底部文字按钮移动到“工作区”标题右侧，复用标准纯加号图标操作与 Tooltip。
- 2026-07-11 修正项目事实更新真实性：浏览器预览不再只重新读取静态 JSON，而是先执行白名单 `project-os scan --persist full`，成功后无缓存读取工作区事实；桌面端继续使用 Rust 实时事实构建。标题更新时间改为精确到秒，解决同一分钟刷新看不出变化的问题。
- 2026-07-11 事实新鲜度引擎第一版落地：关键事实源生成 mtime/size 指纹并写入 `.project-os/fact-freshness.json`；Tauri 与浏览器 snapshot 返回 `fresh / stale` 和变化来源。项目概览仅在 stale 时后台刷新，扫描后更新指纹基线；标题在变化期间显示“检测到变化 / 更新中”，正常状态只保留更新时间，手动按钮作为强制刷新兜底。

- 2026-07-11 工作台已从跨项目统计页收口为单页行动中枢：首屏按 `今日工作 -> 需要处理 -> 项目 -> AI 工作 -> 最近活动` 排布，移除低价值四列统计、浏览器能力提示、工程文件和治理元信息。工作台内可发起任务、添加项目、切换项目和打开待处理任务；切换项目后仍留在工作台，详情页只承接任务、证据和高级信息。产品边界已同步到 `docs/design/workbench-visualization.md` 的 Portfolio / Action Surface。
- 2026-07-11 `项目概览` 已从旧工作台复制页收口为固定项目认知页：只展示项目头部、项目价值和技术方案。任务、预警、当前焦点、最近活动、执行快捷入口和批量治理动作已移出，通用治理元信息与关联文件也不再追加到概览底部。
- 2026-07-11 治理页面头部规范已用项目概览做首个标准实现：只放页面名、一句话用途、更新时间/主要来源、当前状态和一个主操作。项目概览的唯一主操作为 `更新项目事实`，原通用头部和 `认识项目` 重复 Badge 已移除。
- 2026-07-11 项目概览头部继续收口：内容标题直接使用项目名称，下方显示一句话项目介绍；删除了重复的独立项目身份模块。`OmniDesk` 项目名和介绍现在只出现一次，`项目概览` 仅作为导航与 Tab 名。
- 2026-07-11 项目概览头部细节定稿：项目名使用 20px，介绍独占整行，不再被右侧状态和操作提前挤压换行。原 `PROJECT.md 等 6 项` 摘要已改为六个全部展开的灰色来源标签，点击任一标签会打开对应工程文件的只读预览。
- 2026-07-11 项目概览头部状态从易误解的 `已接入 / 资料完整` 改为项目生命周期阶段，以 `.project-os/state.json.phase` 为权威来源，固定映射为 `启动中 / 打磨中 / 交付中 / 维护中 / 已归档`。当前 OmniDesk 显示 `打磨中`。
- 2026-07-11 项目概览的“当前状态”整行已删除，包括当前目标、治理健康分和本地执行状态；相关 Tooltip、分数维度和任务/验收判定计算也从该页代码路径移除。生命周期阶段仍保留在头部。
- 2026-07-11 项目概览继续删除“项目认识”内部统计和底部五个详情入口：确认事实、待确认事实、来源数与扫描时间缺少用户可理解的结论，详情入口又与左侧工作区菜单重复。概览改为只承载项目头部与稳定项目档案。
- 2026-07-11 项目概览稳定档案结构补齐为 `基础信息 / 核心定位 / 技术组成 / 工程结构 / 迭代基线`：扫描侧新增项目标识、版本、创建时间、依赖、关键目录、核心能力、负责人和里程碑字段；页面不再用内部事实数量代替用户真正需要的项目资料。
- 2026-07-11 项目概览再次收紧：版本号移到项目名右侧，更新时间紧跟版本号；删除独立“基础信息”分区，唯一标识、路径和创建时间不再占据概览正文。扫描侧仍保留这些事实字段，供详情或后续治理使用。
- 2026-07-11 项目概览版本号改为复用中性 `Badge` 组件，使用灰色标签 token，与右侧生命周期状态 Badge 保持组件一致但语义层级不同。
- 2026-07-11 项目概览的技术与目录信息从斜杠平铺改为分类标签：技术按应用框架、UI 组件、工程工具分组，目录按应用代码、治理与文档、构建与质量分组；新增复用 `OverviewTagList`，目录标签使用等宽字体。
- 2026-07-11 项目概览区分可点击来源与静态属性：来源改为带文件图标、透明底和 hover 反馈的链接按钮；技术和目录继续使用无交互态的实心灰色 Tag，避免两类元素看起来相同。
- 2026-07-11 技术与目录静态 Tag 的文字改用最高层级 `--desktop-text-primary`，提升扫描清晰度；底色、边框和无交互语义保持不变。
- 2026-07-11 项目概览暂时移除“迭代基线”，负责人和里程碑仍保留在 workspace facts。概览渲染规范调整为“固定头部与核心定位 + 基于可信数据的可选分区”；缺失占位不进入概览，内容过多时只保留分类摘要并下钻详情。

- 2026-07-11 对话系统完成当前阶段 5 项架构闭环：多轮状态进入模型请求；Tauri Context Assembler 组装阶段、目标、任务、Git、验收和治理文件证据；回答统一为有证据结论并附本地生成的可点击文件/任务引用；普通问答隐藏无意义步骤时间线；“风险是什么 -> 那怎么办 -> 你判断 -> 直接修”固定回归评测与浏览器三轮真实验收通过。
- 2026-07-11 左侧导航完成工作台层级纠正并接入跨项目总览与任务摘要索引：工作台总览置顶，项目集合位于其下，原“工作区”改为当前项目名称；总览从 registry 展示项目总数、基础健康、当前项目和项目列表。Tauri 快照会只读扫描各项目 `.project-os/runs/desktop-tasks`，聚合活跃、失败、完成和最近任务；浏览器预览无法跨本地目录读取时明确降级为当前项目任务，不伪造全局统计。
- 2026-07-11 对话持久化已从浏览器 `localStorage` 收敛到项目级 `.project-os/runs/desktop-conversations/*.json`：Tauri 和预览适配层均支持列表、保存和删除；会话与任务现在共享项目级运行记录边界，切换项目、备份和清理不再依赖浏览器缓存。新增预览契约回归测试；浏览器预览重新加载无控制台错误。
- 2026-07-11 桌面端第一批架构治理完成：移除未被 UI 使用的 headless Shell command；目标和任务发送到终端时统一逐行编码为注释，避免换行内容成为可执行命令；白名单检查、治理动作和 Patch 应用写入 `.project-os/runs/execution-audit.jsonl`；WebView 恢复最小 CSP；浏览器预览调用收敛到 `desktop/src/lib/runtime-api.js`，并为终端上下文和预览命令补了 Node 原生回归测试。已通过 `npm --prefix desktop test`、`npm --prefix desktop run web:build`、`cargo check --manifest-path desktop/src-tauri/Cargo.toml`、`bash scripts/check-template-sync.sh .`、`bash scripts/check-runtime.sh .` 和 `PROJECT_OS_ALLOW_EMPTY_PROVIDER_KEYS=1 PROJECT_OS_SKIP_SCREENSHOT=1 bash tests/run-tests.sh`。
- 2026-07-09 根据用户确认的架构图，记录 OmniDesk / Project OS 的 6 层整体架构：入口层、工作台应用层、治理服务层、核心内核层、元数据层、接入层。`docs/ARCHITECTURE.md` 是完整 SSOT，`PROJECT.md` 和 `.project-os/state.json` 保留摘要。
- 2026-07-09 根据用户补充的入口层要求，补齐 `docs/ARCHITECTURE.md` 的入口层方案，并新增 `schemas/entry-context.schema.json`。入口层正式约束包括 Entry Context 前置标准化、Gateway 完整职责、CLI 复用架构、CLI/CI/Desktop 三端数据闭环、内外 API 隔离、新能力准入标准和离线降级方案。
- 2026-07-09 入口层最小 CLI 已跑通：`scripts/ai-project.sh` 增加 `scan` / `run` 统一入口，并在 `check` / `report` / `recommend` / `scan` / `run` 前写入 `.project-os/entry-contexts/*.json`，作为 Gateway 未落地前的 CLI Entry Context 产物。
- 2026-07-09 根据用户指出的核心短板，明确 Shell 入口只是过渡形态；已在 `docs/ARCHITECTURE.md` 和 `docs/DECISIONS.md` 记录长期迁移到原生 CLI / core library 的决策。后续新增复杂治理能力不能只堆在 Shell 脚本里。
- 2026-07-09 新增 `cli/` 原生 Rust CLI 起点，二进制名 `project-os`。当前支持 `context` / `scan` / `check` / `report` / `recommend` / `run`，其中 `context` 原生写 Entry Context，其余命令先委托 legacy shell runner。`scripts/ai-project.sh` 支持通过 `PROJECT_OS_CLI_BIN` 优先委托 native CLI。
- 2026-07-09 入口层继续补主动调用能力：Entry Context schema 增加 `trigger.source` 区分 `desktop` / `manual-cli` / `ci` / `gateway` 等来源；native CLI 增加 `--output json` 输出 `project-os.cli-result.v0.1` 结构化 stdout；native CLI 和 shell wrapper 都在生成 Entry Context 后立即做基础校验。
- 2026-07-09 补齐入口层次要隐患：`check-secrets.sh` 支持 `PROJECT_OS_ALLOW_EMPTY_PROVIDER_KEYS=1` 纯本地扫描降噪；截图回归支持 `PROJECT_OS_SKIP_SCREENSHOT=1`；新增 `scripts/prune-project-os-artifacts.sh` 自动清理 Entry Context、run records 和 logs；GitHub Actions CI 增加 native CLI 结构化输出示例。
- 2026-07-09 入口层中优项已补齐首版：新增 `.project-os/config.json` 和 `schemas/project-os-config.schema.json` 作为统一配置入口；Rust CLI 支持 `--persist auto|none|full`、`--output report` 内嵌机器报告 stdout 和 `.project-os/locks/project-os.lock` 写入锁；新增 `scripts/exec` / `scripts/validate` / `scripts/cleanup` 分层 wrapper，旧脚本路径继续兼容。
- 2026-07-09 入口层高优优化已补齐首版：Rust CLI 启动时会按 `cli.staleLockSeconds` 自动清理陈旧 lock；配置优先级固化为命令行参数 > `.project-os/config.json` > `PROJECT_OS_*` 环境变量 > 内置默认值；`check-runtime.sh` 增加 Shell 命令白名单，约束 `scripts/ai-project.sh` 不再新增业务命令 fallback。
- 2026-07-09 入口层分层优化继续补齐：Rust CLI 新增 `--stale-lock-seconds` 单次覆盖；支持用户全局配置 `$PROJECT_OS_GLOBAL_CONFIG` 或 `$HOME/.project-os/config.json`，优先级调整为命令行参数 > 仓库 `.project-os/config.json` > 用户全局 config > `PROJECT_OS_*` 环境变量 > 内置默认值；Shell 白名单报错文案已改为清晰引导去 `cli/src/main.rs` 新增命令。
- 2026-07-09 Gateway 启动前配置诊断项已补齐：新增原生 `project-os config init --global [--path]`，会生成符合 `schemas/project-os-config.schema.json` 的配置模板；CLI 启动时会校验用户全局 config / 仓库 config，格式错误立即失败；结构化 stdout 增加 `config.values` 和 `config.sources`，便于排查命令行、仓库配置、全局配置和环境变量的覆盖关系。
- 2026-07-09 用户补充一组入口层后续优化，已明确“暂时不做，只记录”：后续可补 `config get` / `config set` 子命令，支持命令行直接读写配置；普通文本输出模式展示精简配置溯源信息；支持多套全局配置环境切换；中期仍保留 CI 多平台预编译二进制包和调用身份/权限校验入参；长期保留标准化产物上报协议和旧兼容语法清理计划。
- 2026-07-09 统一真相源模块已落首版：新增原生 `project-os state sync [target] [--set key=value] [--output json]`，受控校验和写入 `.project-os/state.json`，支持 `name` / `description` / `phase` / `stage` 字段更新；写入复用 `.project-os/locks/project-os.lock`，生成 `.project-os/state-bundles/*.json` 作为 CI / 本地回流骨架产物；`.gitignore` 和 prune 脚本已纳入 state-bundles。
- 2026-07-08 开始用 OmniDesk 自身验证工作区治理模型：工作区不再只被看作文件树或静态文档入口，而是“任意新老项目进入后，由 OmniDesk 维护项目事实、状态来源、更新时机和可信度”的项目治理层。
- 已明确三种项目进入模式：新项目由 OmniDesk 生成最小治理骨架；老项目添加到工作区后默认自动接入 OmniDesk 工作区，先只读扫描已有文件、git 状态、运行配置和 `.project-os`；临时项目允许只读打开，不写治理文件。
- 已更新 `PROJECT.md`、`.project-os/state.json` 和 `.project-os/project-profile.json`，记录工作区治理口径、老项目接入流程、成功标准和当前风险。下一步应把项目概览、当前进度、启动方式、风险边界、本地状态接到真实项目事实源。
- 工作区事实 v0.1 已落地为结构契约和 OmniDesk 自身样例：`schemas/workspace-facts.schema.json` 定义字段，`.project-os/workspace-facts.json` 记录 OmniDesk 的项目概览、当前进度、启动方式、风险边界、本地状态、事实来源、缺失项、风险和建议动作。
- 产品口径已调整：项目概览前台展示“工作区事实”，项目默认自动接入 OmniDesk 工作区；当前工程文件区域只预览不编辑，不直接修改用户工程文件。后续如果开放写入治理文件或编辑工程文件，需要单独设计明确写入动作和确认边界。
- 交互规则已统一为“主流对话优先”：默认先直接回答或处理当前问题，不主动拆任务、不展示内部路由 / Steps / Checks / 审批流；只有删除/覆盖、发布/push、批量重构、有副作用命令、需求明显不清或用户明确要求计划时，才先说明方案并等待确认。源 `AGENTS.md`、分发模板 `templates/project/AGENTS.md` 和 Codex adapter 已同步。
- 根 `AGENTS.md` 按官方风格收口：保留 Quick Start、Commands、Working Boundaries、Routing Summary、协作边界和短引用。
- 新增 `docs/ROUTING.md` 作为 Project OS 请求分流和固定第一响应的 SSOT；根 `AGENTS.md` 只保留摘要和链接。
- `docs/DOCUMENTATION.md` 增加根 `AGENTS.md` 体量约束：长细则、示例、表格和验收 case 应下沉到专题文档。
- `AGENTS.md` 第 4 条改为“改可分发内容后，同步模板并跑对应检查”；`docs/DOCUMENTATION.md` 已定义可分发内容范围。
- `check-runtime.sh` 的 guidance header 扫描窗口从 12 行扩大到 24 行，修复 YAML frontmatter 导致的误报；已同步到模板脚本。
- `PROJECT.md` 去掉历史路线标签，只保留当前状态表达。
- AI 项目工程助手向导已从“分包选择器”收口为“项目状态识别 + 下一步动作 + 推荐补齐方案”；底层 preset 仍作为内部补齐策略存在，细节看 `docs/design/ai-project-assistant/*`、`docs/WIZARD_PRESETS.md` 与 `index.html`。
- 新增 `docs/RECOMMENDATION_ENGINE.md`，定义 evidence -> signals -> gaps -> recommendations -> checks 的推荐契约；当前 UI 仍是轻量规则映射，后续要逐步升级为带 reason / evidence / confidence 的推荐。
- 新增 `docs/SKILL_ENGINEERING.md`，沉淀 Skill 工程证据推导规则：用户不选类型，系统先生成最小 Skill，再根据目标产物、已有文件、下一步动作和验收要求补参考资料、资产、脚本或分发文件。
- Agent Skill 工程默认文件已改为最小骨架：`SKILL.md`、`agents/openai.yaml`、`references/topic.md`、`examples/example-input.md`、`docs/SKILL_ENGINEERING.md`；资产、脚本、schema、fixture 和分发文件由系统推导后再补。
- 素材库已改为低假设原则：`FRONTEND.md`、`BACKEND.md` 模板只记录结构、状态和证据来源，不默认列主流框架、数据库、ORM 或组件库；`check-templates.sh` 已加入对应检查。
- Recommendation Engine v0.1 CLI 已落地：`scripts/recommend-next.sh` 会扫描目标项目并输出 evidence / signals / gaps / recommendations / checks JSON；`scripts/ai-project.sh recommend .` 已接入，core profile 会分发该脚本。
- 产品方向已记为 `Project OS Console`：对标的是项目治理控制台，不是直接复制 Hermes Studio；Agent 自动执行放在后续阶段。
- 首页“推荐补齐方案”已接入推荐引擎展示层和勾选逻辑：存在 `.project-os/recommendations/recommend-next.json` 时会展示推荐原因、证据、置信度、跳过风险和检查命令；有 recommendations 时只默认勾推荐项，无明显缺口时只保留必选入口文件；缺失 JSON 或用户手动点击 Q1-Q3 时才用向导 fallback。
- 新项目第一步已改为“一句话目标”：用户输入目标后，页面会按规则提取意图并驱动隐藏的 Q1-Q3 fallback 和文件勾选；`docs/RECOMMENDATION_ENGINE.md` 已把用户话语定义为 evidence。
- 一句话目标的识别结果已补执行计划卡：直接展示建议生成、暂不生成和“查看并确认生成项”，避免只识别不告诉用户下一步。
- `project-setup` 已升级增量意图契约：每句话先提取 facts / currentIntent / futureSignals / constraints / negativeConstraints / missing / confidence；低置信度或冲突时才 CLARIFICATION，明确动作直接推导最小下一步。
- 用户界面与内部验证信息已明确分离：路由名、回归测试范围、模板同步和开发过程说明只保留在内部记录，页面只展示理解结果、下一步、原因和需要确认的事项。
- 桌面端方向已确认：新增 `docs/DESKTOP_APP.md`，定为 `Tauri + Local Agent Core + Workbench UI`；桌面端先做本地项目工作台、模型计划、受控 runner、diff review 和记忆沉淀，不先做完整 IDE。
- 桌面端 v0.1 骨架已新增在 `desktop/`：Tauri dev 模式启动 Vite + React 组件工程，加载桌面工作台 UI；Rust 侧已提供 `get_workspace_snapshot`、`add_registry_project`、`switch_registry_project`、`generate_readonly_plan`、`get_provider_status`、`save_provider_config`，读取 `.project-os/state.json`、推荐 JSON、run records、文件树预览、`.project-os/desktop-registry.json` 和 `.project-os/desktop-provider.json`；当前不写项目文件、不执行命令。`generate_readonly_plan` 在 provider 启用且环境变量 key 存在时会调用 OpenAI-compatible `/chat/completions`，失败时回退本地启发式 planner。
- macOS `.app` 打包已开启，bundle 目标先只保留 `app`；默认 `dmg` target 会在 Finder/AppleScript 美化阶段失败并留下 `/Volumes/dmg.*` 临时卷。手动用 `bundle_dmg.sh --skip-jenkins` 已成功生成基础 dmg，并复制到 `/Users/heqiao/Desktop/Project OS Desktop_manual.dmg`。最新可双击 app 已复制到 `/Users/heqiao/Desktop/Project OS Desktop 20260702-102159.app`。
- 桌面端 UI 已从 demo 卡片风格压缩为更接近 IDE / workbench 的紧凑布局：顶部栏更低、左右栏更窄、中间计划区分栏、右侧 Provider / Queue / Memory 改为折叠面板、Trace 和 Composer 高度降低。
- 桌面端任务队列 v0.1 已接入前端状态：每次生成 readonly plan 会创建本地 task，默认 `planned`；右侧 Queue 可切换任务，中心区恢复对应计划；Approve 会推进到 `waiting approval`。当前队列暂未持久化，也还没有执行 runner。
- 桌面端受控 runner v0.1 已接入：Rust command `run_guarded_check` 只接受白名单 check id，不接受任意 shell；当前允许 `runtime`、`doc-structure`、`recommend`、`ai-project`、`web-build`、`cargo-check`。前端会根据 plan checks 展示可运行按钮，并把任务状态推进为 `running` / `done` / `failed`。
- 桌面端 provider 配置已改为小白式表单：普通用户只选服务商、模型并粘贴 API Key；真实 key 写入 `.env.local`。`desktop-provider.json` 已支持 `profiles[]` 和 `activeProfileId`，可保存多套 OpenAI-compatible 配置，同一时间只激活一套。
- 桌面端 provider 表单文案已从“API 档案”收口为“连接”：默认主路径保留连接选择、连接名称、服务商、API 地址、API Key、模型、启用和保存；备注、接入方式、Key 保存变量名和官网链接统一折叠到“高级设置”。连接下拉只显示用户自定义名称，模型和 Key 状态不再拼进下拉项；模型设置弹窗里的 provider 表单不再显示额外外框。
- 桌面端模型设置已补“已保存连接”管理区：每条连接显示名称、模型、Key 状态和 Key 变量名，可点“编辑”载入表单；桌面 App 内可删除连接，删除时仅在没有其他连接复用同一 Key 变量时移除 `.env.local` 对应行。`get_model_health` 加载失败已降级为空缓存，避免旧桌面进程未注册命令时在模型设置里弹红错误。
- 已保存连接管理区已改为类似项目区的紧凑 tile 交互：不再保留单独“连接”下拉，点击 tile 内容编辑，删除按钮只在 hover / focus 时出现，末尾用 `+` tile 新建连接；tile 内只显示连接名和 Key 状态。“测试当前”放在已保存连接标题右侧，用于测试当前选中连接的模型是否可用。左侧项目 tile 也补了 hover 移除按钮，不再只能进三点菜单移除。
- 连接删除已补浏览器预览接口 `/__project-os/delete-provider-profile`，预览模式会更新 `.project-os/desktop-provider.json` 并在 Key 变量未被其他连接复用时清理 `.env.local`；真实 Tauri 模式使用 `delete_provider_profile` command。若旧桌面进程未重启导致 `Command delete_provider_profile not found`，前端会提示重启桌面 dev 进程。
- Provider 高级设置里的备注、接入方式、Key 保存变量名和官网链接若来自服务商 catalog 预设，会显示“来自服务商预设”并只读；其中 Key 保存变量名会影响实际 Key 读取/保存位置，备注和官网仅展示，接入方式是当前 OpenAI-compatible 协议标识。
- 已保存连接标题右侧按钮已从“测试当前”改为“刷新当前”，复用模型列表刷新逻辑，不再额外发起 chat/completions 测试，避免可见模型列表可读但单模型测试报错造成干扰。
- 已保存连接 tile 去掉 Key 状态行，只保留连接名；tile 高度压缩到约 48px，网格最小宽度压到约 76px，加号 tile 同步缩小。
- 已保存连接 tile 宽度改为按内容自适应，最大宽度约 148px，超出后省略号；短名称不再被等宽网格撑大，加号 tile 固定约 56px。
- 模型设置闭环已补清晰反馈：顶部模型按钮显示 `连接名 / 模型名`；模型设置状态行显示启用状态、Key 状态、连接名和模型名；“测试当前”仍复用刷新模型列表逻辑，成功后会提示读取到多少模型、当前模型是否可见，若不可见会切到第一个可见模型并说明原因。
- 新增目标 `工作区可用闭环`，状态为 `draft / 待确认`，拆成 5 个 planned 任务：项目切换后的真实上下文、对话生成任务的闭环、右侧目标和中间对话联动、当前项目档案自动补齐、执行反馈和保存反馈。右侧目标任务列表已按 `goalId/taskIds` 过滤，避免旧 backlog 的已完成任务污染当前目标进度。
- `工作区可用闭环` 5 个任务已完成首轮实现：WorkspaceSnapshot 增加 currentProjectId/currentProjectPath；切换/添加/移除项目后清空对话、任务、文件预览和终端临时态，并按项目隔离 localStorage 对话；生成计划任务写入 projectId/projectPath，确认计划按钮改为“开始执行”并进入 running；右侧目标 backlog 任务可点击打开中间计划视图；浏览器预览会读取 `.project-os/project-profile.json`，项目档案从 0/5 变为 5/5；新增轻量 toast，用于切项目、生成计划、保存/删除连接等动作反馈。
- 用户确认后，`工作区可用闭环` 已从 `draft` 推进到 `planned`，第一个任务 `workspace-project-context` 已标记为 `running`。右侧目标在存在 running 任务时显示“进行中”，不再展示 planned 状态下的“生成拆解”提示。浏览器预览已补 `/__project-os/switch-project`，会读取 `.project-os/desktop-registry.json` 并支持预览模式项目切换验证。
- `workspace-project-context` 已完成验证并标记为 `done`：临时接入 `/tmp/omnidesk-context-check` 项目，切换后确认项目名、目标、任务、项目档案和对话计数都来自测试项目，旧项目目标未串入；随后切回主项目并恢复 registry。预览 snapshot 已改为通过 `/__project-os/workspace-snapshot` 按当前 registry 项目路径读取 `.project-os/*`，不再固定读取当前仓库根目录。目标进度现为完成 1 / 待办 4。
- `workspace-chat-to-task` 已完成并标记为 `done`：用户一句话触发任务意图后，会进入理解意图、生成计划、创建任务、对话中展示“开始执行”确认动作的闭环；确认后任务状态推进为 running，右侧目标/任务进度同步更新。
- `workspace-goal-chat-link` 已完成并标记为 `done`：对话生成的任务会写入当前 active goal 的 `goalId`，并记录来源 `conversationId`；右侧目标任务点击后打开中间执行视图，执行视图显示来源目标/对话，并提供“回到对话”入口。
- `workspace-project-profile-fill` 已完成并标记为 `done`：右侧“项目档案”从产品问卷式字段调整为工作台档案 5 项，优先展示项目概览、当前阶段、技术架构、检查命令和协作规则；真实 Tauri 快照和浏览器预览都会从 `.project-os/project-profile.json`、`.project-os/state.json`、`PROJECT.md`、`HANDOFF.md`、`AGENTS.md`、`docs/PRODUCT_PLAN.md` 自动补齐，当前预览快照为 5/5。
- `workspace-action-feedback` 已完成并标记为 `done`：新增统一动作反馈条，生成计划、跑检查、生成/应用改动、更新交接、目标验收、确认完成、保存连接、保存 Key 和删除连接都会显示“正在 / 成功 / 失败”的轻量反馈；失败会同步写入原有近场错误，不再只靠用户猜操作有没有生效。
- `工作区可用闭环` 已完成目标验收：预览接口 `/__project-os/run-goal-validation` 重新生成 `.project-os/goal-validation-report.json`，Web build、Cargo check、runtime check 均通过，active goal 已更新为 `pending-confirm / passed`，下一步可由用户点击“确认完成”。同时修复浏览器预览验收接口未同步 `.project-os/goals.json` active goal 状态的问题，使其与 Tauri `run_goal_validation` 行为一致。
- 目标确认完成后的右侧主卡已改为空状态：active goal 若已 `done / signed-off`，不再继续展示已完成目标的进度条和任务拆解，只显示“暂无进行中目标”和新目标入口；已完成目标仍保留在目标下拉的历史分组里。
- 目标下拉已改为纯状态分组：只显示“进行中 / 待确认 / 已完成”，不再额外生成容易误导的“当前”分组；进行中或待确认目标选中时在所属状态分组内用小标签标识。已完成目标默认不算当前，但用户从下拉点开时可查看只读历史详情和任务记录。
- 已完成目标历史做了轻量收纳：右侧目标下拉的“已完成”只显示最近 3 个；完整目标历史放到左侧工程文件里的“任务执行 / 待办 / 目标历史”，关联 `.project-os/goals.json`、`.project-os/goal-validation-report.json` 和 `.project-os/goal-signoff-history.json`。
- 左侧工作区骨架开始接入当前项目映射状态：`WorkspaceTree` 会读取当前 snapshot，把固定治理骨架右侧 meta 动态显示为当前项目状态，例如项目档案 `5/5`、目标 `待确认 / 历史`、验收 `passed`、任务执行活跃数、工程资产文档数等；骨架保留为 OmniDesk 治理视图，不再只是静态导航。`设计实现` 的 meta 已收口为 `已识别`，避免显示被截断的技术栈残片。
- 产品逻辑已明确：左侧项目“修改显示名称”只改 OmniDesk 工作台显示名，不改本地文件夹、Git 仓库名、工程元数据或路径；若未来支持重命名本地文件夹，必须作为独立高风险操作并二次确认。规则已写入 `docs/PROJECT_MEMORY_AND_RUNNER.md`。
- 左侧项目入口已从小方块 tile 改为一项目一通栏：行内显示项目名和路径，当前项目高亮，hover / focus 时只露出一个竖向三点更多按钮；查看本地文件、复制路径、修改显示名称和从工作台移除统一收进更多菜单。添加项目入口已移到“项目”标题旁，只保留加号 icon 和 hover 提示。项目行状态点只表达运行会话状态，不再用项目健康 `ready` 显示绿点：进行中显示蓝色旋转环，任务/会话中断显示红点，有新完成结果时显示绿点；用户点击项目、打开对应会话或任务后绿点消失，空闲项目不显示状态点。复制路径已改走本地系统剪贴板：Tauri 使用 `copy_text_to_clipboard`，浏览器预览使用 `/__project-os/copy-text` 调 `pbcopy`。
- 新增 `.project-os/model-catalog.json`，管理员可维护服务商、API 地址、Key 变量名和模型列表；Rust command `get_model_catalog` 会读取该文件，不存在时生成默认 catalog。前端服务商/模型下拉优先使用 catalog，读不到才回退内置默认。
- 桌面端 provider 已新增模型探测和当前模型测试：`probe_provider_models` 调用当前网关 `/models` 获取 API Key 可见模型池；`test_provider_model` 用当前 `apiBase` / `apiKeyEnv` / `model` 发起最小 `/chat/completions`，用于判断下拉中选中的模型是否真的能用。当前 `https://aihub.firstshare.cn/v1` 返回 63 个模型，配置中的 `gpt-5.4` 已测试通过。
- 桌面端任务队列已开始持久化：Rust command `list_desktop_tasks` / `save_desktop_task` 会把桌面任务 JSON 写入当前项目 `.project-os/runs/desktop-tasks/`；前端启动时读取最近 30 条任务，生成计划、Approve 和 Runner 结果都会回写任务记录。下一步应在这个基础上接 diff review / patch 应用确认。
- 桌面端已新增 patch draft / Diff 草案审阅：Rust command `generate_patch_draft` 会基于任务 plan 读取安全候选文件上下文，调用 provider 生成 unified diff JSON；失败时回退本地占位草案。前端 Active Task 增加 `Generate Patch` 和 Diff Draft 面板，生成结果写回同一任务记录。当前仍不写文件，Apply 需要下一步单独接入确认流程。
- 桌面端已新增受控 Apply Patch：Rust command `apply_patch_draft` 只接受任务里的 `patchDraft.diff`，先跑 `git apply --check`，通过后再 `git apply`；占位草案、空 diff 和非 unified diff 会被拒绝。前端 Active Task 增加 `Apply Patch` 按钮，成功后把 apply result 写回任务记录。下一步应接 Apply 后自动跑匹配检查并写回 run summary。
- Apply 后自动验证已接入：前端 `applyPatchDraft` 成功后会根据 plan 匹配白名单 checks，逐个调用 `run_guarded_check`，并把自动验证 run、状态和 `verificationSummary` 写回同一任务记录；全部通过为 `done`，任一失败为 `failed`。
- 本地 run summary 已接入：Rust command `write_run_summary` 会把任务标题、状态、Apply 结果、验证摘要、文件列表和检查结果追加写入 `.project-os/runs/desktop-summary.md`；前端 Apply + Verify 结束后自动调用，并把 summary path 写回任务记录。
- 交接状态合并确认已接入：Rust command `merge_run_summary_to_handoff` 只读取任务里的 `runSummary.summary`，在用户点击 `Merge Handoff` 后追加固定 `Desktop 合并记录` 区块到当前项目 `HANDOFF.md`；缺少 `HANDOFF.md` 或 run summary 时拒绝执行。当前是追加式合并，下一步可做结构化合并、冲突提示和摘要去重。
- 桌面端设计系统边界已更新：目标已转为真实桌面工作台，允许并推荐接 Headless / shadcn-style 本地组件层；当前已安装 `@radix-ui/react-slot`、`class-variance-authority`、`clsx`，并新增 `desktop/src/components/ui/button.jsx` 与 `desktop/src/lib/cn.js`。视觉仍以 `desktop/src/styles.css` 的 `--desktop-*` token layer 为 SSOT，不能直接套第三方默认主题或继续散落硬编码视觉值。
- 桌面端按钮已开始组件化：顶部栏、项目选择、项目添加、任务发送、Diff / Runner 操作、Queue Approve、Provider 模型刷新 / 测试和保存按钮已迁到本地 `Button` primitive；`uiButton` 已补齐 hover、active、focus-visible、disabled 状态，并通过 Desktop tokens 控制状态色。
- 桌面端输入和下拉已开始组件化：新增 `desktop/src/components/ui/input.jsx` 与 `desktop/src/components/ui/select.jsx`，Composer、项目路径、Provider 配置和模型选择已改用 `Input` / `Select` primitive；输入、下拉、placeholder 和下拉箭头颜色已映射到 Desktop tokens。
- 桌面端状态和容器已开始组件化：新增 `desktop/src/components/ui/badge.jsx` 与 `desktop/src/components/ui/panel.jsx`，只读标识、任务状态、队列状态、Provider、Queue、Index、Privacy、Diff、Runner、Patch Draft 等结构已开始改用 `Badge` / `Panel` primitive。
- 桌面端表单和反馈已接入官方 primitive 路线：新增 `@radix-ui/react-label`，`desktop/src/components/ui/field.jsx` 使用 Radix Label 建立 label-control 关联；`notice.jsx` 和 `section-title.jsx` 已落地，Provider 表单、提示、成功/错误反馈和小节标题已开始改用 `Field` / `Notice` / `SectionTitle`。
- 桌面端 Tabs 和 Tooltip 已接入官方 primitive 路线：新增 `@radix-ui/react-tabs`、`@radix-ui/react-tooltip`，工作区顶部 Plan / Diff / Checks / Trace 已改用 Radix Tabs，顶部 Theme / Report / New Task 已改用 Radix Tooltip 包装；视觉仍由 Desktop tokens 控制。
- 桌面端 Dialog 和 DropdownMenu 已接入官方 primitive 路线：新增 `@radix-ui/react-dialog`、`@radix-ui/react-dropdown-menu`，New Task 已改为 Radix Dialog 并复用生成计划链路，Report 已改为 Radix DropdownMenu；视觉仍由 Desktop tokens 控制。
- 桌面端 Switch 已接入官方 primitive 路线：新增 `@radix-ui/react-switch`，Provider 的“启用 provider”已从原生 checkbox 改为 Radix Switch；视觉仍由 Desktop tokens 控制。
- 桌面端开始抽 workbench pattern 层：新增 `desktop/src/components/workbench/task-command-bar.jsx` 和 `provider-status-row.jsx`，Diff / Runner 操作按钮组与 Provider 状态行已从 `main.jsx` 拆出。
- 桌面端主题色已收口为可配置 token：`desktop/src/styles.css` 新增 `--desktop-theme-h/s/l`，并派生 `--desktop-accent`、`--desktop-accent-soft`、`--desktop-border-accent`、`--desktop-state-accent-bg*`；原绿色硬编码已迁到 accent token，界面其余部分保持中性色。
- 顶部主题菜单已接入：新增 `desktop/src/components/workbench/theme-menu.jsx`，挂在主题图标按钮上，支持深色 / 浅色切换和 5 个主题色预设；当前先写入 `localStorage` 并实时更新根 CSS 变量。
- 主题设置已升级到桌面端本地配置：Rust 新增 `get_desktop_theme` / `save_desktop_theme`，配置写入 `.project-os/desktop-theme.json`；浏览器预览仍 fallback 到 `localStorage`。
- 主题菜单已支持自定义颜色管理：用户可以通过颜色选择器添加自定义主题色，自定义色会进入 `accents[]` 并可删除；内置预设色保留不可删。
- 自定义主题色已支持实时预览：拖动系统取色器时会立即更新界面 accent，但不会写入配置；点击“添加”后才保存到自定义色列表。
- 右侧目标验收链路已从“签收目标”改为“待确认 / 继续打磨 / 确认完成”：验证通过后不强迫封口，用户可点“继续打磨”进入反馈输入模式，也可点“确认完成”经轻量确认弹窗后复用原目标签收记录能力。
- 目标栈最小闭环已落地：新增 `.project-os/goals.json`，保存 `goals[]` 和 `activeGoalId`；右侧目标优先展示 active goal，已完成目标保留为历史数据。Tauri snapshot 和浏览器 fallback 都会读取该文件，验证/确认完成会同步 active goal 状态。
- 多目标入口已接入右侧目标区：目标卡片顶部显示 `目标 x/n` 下拉，可查看目标列表并切换 active goal；下拉里已有“新目标”入口。Tauri 端新增 `create_goal` / `switch_active_goal` command，浏览器预览会先做本页状态切换。
- 新目标入口已升级为命名弹窗：点击“新目标”后输入目标名称和可选说明，创建后自动切为 active goal；浏览器预览做本页状态更新，Tauri 模式写入 `.project-os/goals.json`。
- 新目标确认边界已写入 `docs/PROJECT_MEMORY_AND_RUNNER.md`：系统不得静默把新目标直接设为 `active`；新目标先进入 `draft / 待确认`，用户确认目标和任务拆解后才进入 `active / 进行中`。刚才用于验证保存的 `保存验证` 测试目标已从 `.project-os/goals.json` 清理。
- draft 目标的下一步交互已接入：右侧 active goal 为 `draft` 时显示“确认目标”，点击后写入 `planned / 待拆解`；`planned` 状态显示“生成拆解”占位，后续应接任务拆解草案和“确认拆解”。
- 对话体验已修正行动意图识别：包含“帮我处理 / 处理一下 / 看看解决 / 整理一下 / 制定方案 / 整理待办”等表达时，即使带有“看看、呢、怎么”这类疑问词，也应进入生成计划/创建任务链路，而不是只回复一句聊天文本。前端增加本地兜底，Tauri router prompt 与本地 router 同步。
- 体验改进已沉淀到 `.project-os/task-backlog.json`：输入区状态、执行反馈、右侧结构、多 API 配置、桌面完整感和治理文件体验会作为右侧任务来源显示；浏览器 fallback 和 Tauri snapshot 都应读取这批 backlog。
- 目标验收重版已记入 `.project-os/task-backlog.json`，后续分阶段落地：先建立目标验收标准，再接入自动验收报告，最后完善人工签收、失败修复任务和验收历史追溯。
- 目标验收重版第一阶段已落地：新增 `.project-os/goal-validation.json` 作为目标验收标准，右侧目标完成后显示“验收标准 6 项”；Tauri snapshot 和浏览器预览都会读取同一份文件。
- 目标验收报告已接入：桌面端 `run_goal_validation` 会顺序运行 Web build、Cargo check 和 runtime check，写入 `.project-os/goal-validation-report.json`，并把目标状态推进到 `verified` 或 `validation-failed`。
- 目标签收追溯已接入：桌面端 `sign_off_goal_validation` 要求验收报告 `passed` 后才能签收，签收结果写入 `.project-os/goal-signoff-history.json`，并把目标状态更新为 `signed-off`。
- 桌面端项目概览已补页面内治理闭环入口：`run_project_os_action` 只允许 `scan` / `recommend` / `report` / `prune` 四个白名单动作；Tauri 和浏览器预览都走同一动作语义，执行后刷新工作区事实视图，结果继续落在 `.project-os/`。后续治理文件筛选、`.project-os/runs/` 历史、L2 定时治理和 L3 patch draft 列表已记入 `docs/PRODUCT_PLAN.md`，本轮不扩。
- 桌面端页面数据刷新机制已补三层保障：Tauri watcher 收窄为监听 `.project-os` 治理骨架变更并触发完整 snapshot 刷新；项目概览新增 `同步治理状态`，底层调用 `project-os state sync . --output json`；浏览器预览增加 30s 轻量 snapshot 轮询，适配非 Tauri 场景。
- 工作区导航信息架构已收口：一级菜单固定为 `项目流程 -> 任务执行 -> 知识记忆 -> 工程资产 -> Agent 配置`；二级菜单改为能力级工作面，不再暴露 `目标用户`、`使用场景` 等字段级入口；`项目概览` 定义为总览驾驶舱，只做摘要、跳转和快捷操作，不重复承载 `当前进度`、`启动方式`、`风险边界`、`本地状态` 的完整内容。
- Agent 开发优先级已开始落地到工作面：`任务执行` 的 `当前任务 / 任务队列 / Patch 草案 / 执行终端 / 执行结果` 和 `Agent 配置` 的 `模型连接 / 工具白名单 / 安全边界` 会在中间区域显示状态卡，而不是只展示治理文件说明；产品规划已记录 P0 优先级为任务执行闭环、项目概览驾驶舱和 Agent 配置状态。

## 当前验证

- `bash scripts/check-runtime.sh .` 已通过，0 warning。
- `bash tests/run-tests.sh` 已通过；其中 `.env.local` 的 `DEEPSEEK_API_KEY` 为空是安全检查 warning，不影响测试结果。
- 2026-07-09 桌面治理入口补齐后已验证：`cargo check --manifest-path desktop/src-tauri/Cargo.toml`、`npm --prefix desktop run web:build`、`cargo check --manifest-path cli/Cargo.toml`、`bash scripts/check-runtime.sh .`、`bash scripts/check-doc-structure.sh .`、`bash scripts/check-template-sync.sh . --strict`、`PROJECT_OS_ALLOW_EMPTY_PROVIDER_KEYS=1 PROJECT_OS_SKIP_SCREENSHOT=1 bash tests/run-tests.sh` 均通过；浏览器预览里 `scan` / `recommend` / `report` / `prune` 均能返回结构化结果，项目概览 action bar 可见且点击 `清理过期产物` 后显示成功反馈。
- 2026-07-09 页面刷新机制补齐后已验证：重新构建 `bin/project-os` 后，`run-project-os-action` 的 `sync` 返回 `project-os.state-sync-result.v0.1` 且生成 `.project-os/state-bundles/*.json`；浏览器页面可见 `同步治理状态` 按钮，点击后显示成功反馈。
- 2026-07-09 工作区导航收口后已验证：`npm --prefix desktop run web:build`、`bash scripts/check-runtime.sh .`、`bash scripts/check-doc-structure.sh .` 通过；浏览器预览里一级菜单顺序正确，字段级 `目标用户` / `使用场景` 不再显示在左侧导航。
- 2026-07-09 Agent 工作面首版验证：浏览器预览点击 `任务执行 -> 当前任务` 可见当前任务、任务状态和下一步状态卡；点击 `Agent 配置 -> 模型连接` 可见当前连接、启用状态、当前模型和模型状态卡。
- 2026-07-09 任务执行闭环 1.0 已继续补齐首批工作面：`当前任务` 增加计划步骤、候选改动、验证检查和 Patch / 应用 / 验证状态骨架；`Patch 草案` 增加集中列表，展示草案文件、应用状态、验证摘要、run summary 和交接状态；`执行结果` 增加最近完成 / 失败任务列表和空态。左侧工作区能力菜单点击时会自动打开对应工作面的第一个事项，避免只高亮菜单但中间区不切换。
- 2026-07-09 任务执行闭环 1.1 已把 `当前任务` / `Patch 草案` 工作面接入现有操作链：工作面内可直接打开任务、生成 Patch 草案、应用并自动验证、运行检查、更新交接；空任务时显示禁用动作条和创建任务提示，避免用户不知道下一步。所有动作仍复用既有受控 command 和白名单边界，不新增任意命令执行入口。
- 2026-07-09 任务失败闭环首版已接入 `执行结果` 工作面：失败任务会展示失败摘要、失败检查项，并提供打开任务、重跑失败检查和生成修复任务入口；修复任务以普通 `planned` 桌面任务写入，继承原任务检查和候选改动，仍需用户确认后才进入 Patch / Apply / 验证链路。
- 2026-07-09 已用 OmniDesk 自身做任务失败闭环 smoke 验证：补齐浏览器预览的 `desktop-tasks` 读写端点后，临时注入 `codex-failure-loop-smoke` 失败任务，确认 `执行结果` 能显示失败摘要、失败检查、重跑失败检查和生成修复任务；点击生成修复任务后确认写入 `planned` 修复任务并继承原检查项。测试任务和修复任务已清理，manifest 已恢复。
- 2026-07-09 治理文件健康状态首版已落地：从 `workspaceFacts.governanceDomains[].fileStatuses` 聚合 `正常 / 有本地变更 / 缺失 / 可能过期 / 生成产物 / 规则目录` 统计；`项目概览` 显示健康摘要，`工程资产 -> 治理文件` 显示专属治理文件健康视图和按治理域展开的只读预览入口，避免和项目概览重复。
- 2026-07-09 根据用户反馈“看了后能干嘛”，治理文件健康视图已从只读统计升级为可行动视图：状态卡可点击筛选对应文件，`缺失` 会直接聚焦缺失治理文件并展开首个命中治理域；新增“建议处理顺序”，按缺失、本地变更、过期和规则目录给出处理优先级。
- 2026-07-09 治理文件健康视图已接入任务生成：筛选 `缺失 / 有本地变更 / 可能过期` 后可生成补齐、审阅或同步任务；任务以 `planned` 桌面任务写入，携带命中文件、治理域、检查项和安全边界，后续进入既有 Patch / Apply / 验证闭环。已用 OmniDesk 自身验证 `缺失 -> 生成补齐任务`，确认任务包含 `package.json`、`templates/project-docs/PROJECT.md` 和治理检查项；验证任务已清理。
- 2026-07-09 菜单治理矩阵已收口：`docs/PRODUCT_PLAN.md` 明确每个一级菜单/关键二级菜单的治理角色、状态来源、当前成熟度和下一步；桌面端工作区 topic 预览也展示 `治理角色 / 闭环程度 / 状态来源 / 更新时机 / 下一步动作`，用于回答“这个菜单看了能干嘛”。浏览器预览已验证 `设计实现 -> 系统架构` 可显示这些治理字段。
- 2026-07-09 设计实现治理闭环首版已接入：`系统架构 / 数据契约 / 界面规范 / 实现结构` 会展示设计实现健康状态，聚合 `docs/ARCHITECTURE.md`、`docs/DESIGN_STANDARDS.md`、`schemas/*`、`docs/data/*` 和关键源码入口的状态；发现缺失、本地变更或可能过期时可生成设计实现治理任务，进入既有任务执行、Patch 草案、验证和交接链路。
- 2026-07-09 `当前进度` 已从治理元信息升级为可视化进度驾驶舱：展示当前阶段、任务完成度、当前目标、执行任务数、已完成数、需关注数、最近完成、下一步和进度依据；仍保留治理角色和可点击关联工程文件。浏览器预览已验证该页显示阶段、百分比、最近完成、下一步和进度依据。
- 2026-07-09 `当前进度` 交互继续补齐：点击“下一步”任务会切到 `执行` tab 并打开对应任务计划；点击“需关注”会把进度依据筛到失败任务和本地变更/缺失/过期文件；点击进度依据文件会展开只读预览。浏览器预览已验证任务跳转、需关注筛选和 `HANDOFF.md` 预览。
- 2026-07-09 任务详情交互已从生硬的 `执行` 工作面收口：执行 tab 动态显示为 `任务：{短标题}`，任务页顶部增加“返回当前进度”，主操作 `生成改动 / 应用改动 / 更新交接 / 检查` 从“更多操作”里前置，原技术细节收纳为“高级详情”。浏览器预览已验证从当前进度打开任务详情、主操作可见、返回当前进度可用。
- 2026-07-09 根据用户反馈“可视化报告页太丑、所有菜单需要一套可视化规范”，新增 `docs/design/workbench-visualization.md` 作为 OmniDesk 工作区菜单可视化 SSOT。规范定义 Progress / Task / Health / Configuration / Memory 五类 Surface、页面骨架、状态规则、Evidence 点击预览和验收清单；`docs/DESIGN_STANDARDS.md`、`docs/design/component-index.md`、`docs/PRODUCT_PLAN.md` 和 doc manifest 已登记。
- 2026-07-09 已按 `Progress Surface` 规范重做 `当前进度` 样板页：首屏变为阶段摘要、目标状态、任务完成度、三项指标、主下一步任务、最近完成紧凑空态和右侧证据区；移除原来的大空框和散乱卡片。浏览器预览已验证 `打开任务` 能进入任务详情、`HANDOFF.md` 证据可只读预览。
- 2026-07-09 `当前进度` 头部信息已收口：外层只保留页面名、用途说明和弱面包屑 `项目流程 / 认识项目`，正文头部只放阶段摘要和任务完成度；当前目标、任务数、证据和治理元信息继续放在正文区域。浏览器预览已验证强 `认识项目` badge 不再出现，头部无明显拥挤。
- 2026-07-09 `启动方式` 已从静态治理说明改成启动命令工作面，展示开发预览、Web 构建、桌面壳检查和治理检查四类命令，并说明长期 dev server 后续需要接进程管理后再开放一键启动/停止。`验收报告` 和 `工程资产 / 报告产物` 已接入报告产物工作面，明确“可视化报告”是工程治理报告产物，包含结构化报告、Markdown 报告、报告截图和目标验收报告。浏览器预览已验证三个入口均显示专属工作面。
- 已知残余：`cargo fmt --manifest-path desktop/src-tauri/Cargo.toml --check` 仍会对既有 `desktop/src-tauri/src/main.rs` 给出大范围格式化 diff，本轮未执行全文件格式化，避免把历史格式 churn 混入当前功能改动。
- 因为改过可分发页面并同步过模板，收尾前仍应确认：

```bash
bash scripts/check-templates.sh
bash scripts/recommend-next.sh .
bash scripts/check-template-sync.sh .
bash tests/run-tests.sh
```

## 风险与注意

- `docs/data/project-graph.json`、`docs/data/knowledge-registry.json` 会被图谱脚本重生成，diff 可能包含与本次无关的既有未跟踪资产。
- `tests/run-tests.sh` 可能提示 `.env.local` 的 `DEEPSEEK_API_KEY` 为空；这是安全检查 warning，不等于失败。
- 截图回归在没有浏览器时会跳过 bitmap capture，但 marker 检查仍应通过。
- Codex 内嵌浏览器和 Tauri 窗口均已可验证；Preview 已覆盖页面加载、普通提交、计划结果和等待确认，真实 Tauri 已覆盖请求接管三态和四条 Action 链路。桌面 smoke 只能通过 OmniDesk Accessibility 的 AXValue 与命名按钮操作；禁止向前台宿主发送通用键盘事件。
- Rust / Cargo 已通过 `rustup` 安装，`desktop/` 的 Tauri dev 窗口已跑通；当前保留一个 `python3 -m http.server 8000` 和一个 `npm run dev` 进程。桌面端已经开始读取真实本地项目快照，并会生成第一版本地项目 registry；左侧 Projects 支持系统目录选择、输入路径备用添加和点击切换当前项目。

## 下一步建议

1. 核对 `.project-os/task-backlog.json` 中仍为 `planned` 的旧对话体验条目，把已经由 turn summary、可中断状态机和请求接管实现覆盖的项目按证据收口；只修正状态与交接，不新增对话能力。

### 2026-07-18 对话历史分层治理阶段二

- 临时模型/连接状态 turn 已从持久化历史、摘要和后续上下文中隔离；历史时间统一显示到分钟。
- 对话历史现在按“任务对话 / 今天 / 昨天 / 更早”分组，任务对话优先展示；任务会话显示 `任务对话` badge。
- 对话历史支持按标题、预览和 `taskId` 搜索；默认隐藏带 `archivedAt` 的记录，保留 `showArchived` 数据入口给后续归档页使用。
- 阶段二验证：`npm test` 350 项通过、`npm run web:build` 通过、`npm run test:smoke` 通过、`git diff --check` 通过。
- 下一阶段只实现归档/恢复的明确交互和持久化边界；暂不引入 SQLite、向量检索或全量会话迁移。

### 2026-07-18 对话历史管理闭环验收目标

- 已完成并签收 `完成对话历史管理闭环验收-1784355087943`：真实验证对话归档、历史管理入口、恢复、永久删除和重载后的持久化；主列表不展示归档记录，归档记录只在“对话历史管理”中管理。
- 目标签收已改为显式绑定 `goalId`。Preview 与 Tauri 的验收运行、签收都会校验目标存在，并拒绝使用其他目标的验收报告或验收标准，避免全局旧目标误签收。
- 当前验收证据：Web Build、Cargo check、Runtime check 均通过；旧目标 ID 的签收请求会被拒绝，当前目标重新验收后签收记录写入当前目标。

### 2026-07-18 统一对话、任务与目标的上下文和状态契约

- 已创建并确认目标 `统一对话、任务与目标的上下文和状态契约`，当前状态为 `planned`。
- 第一阶段已落地：新增 `workspace-context` 纯解析器。当前任务/当前对话的 `goalId` 优先于全局 `activeGoalId`；全局指针若指向已完成目标，会回退到可推进目标。
- 对话持久化的 `updatedAt` 改为 ISO 时间；此前只写 `HH:mm`，而列表分组按可解析时间排序，会造成历史分组和更新时间不可靠。
- 后续：把任务保存、迁移和删除收口到同一目标关联索引规则，并补 Preview / Tauri 对等测试和历史数据审计。

- 第二阶段已完成：Preview 与 Tauri 的任务保存会把任务 ID 加入匹配阶段目标的 `taskIds`，并从其他阶段目标移除；删除继续移除索引。Tauri 文件级单测覆盖任务改绑，Preview 用临时任务验证保存加入、删除移除。
- 历史审计确认 22 条带已知阶段目标的桌面任务中曾有 4 条漏索引，已补齐；旧任务池的非桌面任务引用保持不动，避免把历史治理记录误删。
- 目标已于 2026-07-18 签收完成：验证报告绑定 `统一对话-任务与目标的上下文和状态契约-1784370357360`，Web Build、Cargo check、Runtime check 均通过；最终审计为 22 条已知阶段目标任务、0 条缺失索引。

### 2026-07-19 Hermes Patch 草案格式恢复

- Hermes unified diff 解析现在只移除独立的外层 Markdown 围栏，不再破坏 README 等文件内容中的代码围栏。
- 对已授权上下文文件，解析器会重算 hunk 行数；只有旧侧内容能在该文件中唯一命中时，才校正错误的 hunk 起点。零上下文替换会补入相邻原文作为 Git 校验上下文。
- 旧/新文件头必须一致、路径必须在已授权上下文中且通过工程路径安全校验；`.env`、路径穿越、文件新增/删除、损坏 hunk 和不匹配文件头仍会拒绝，未放宽写入边界。
- 以此前真实 Hermes README 响应作为可复现 fixture，标准化结果已通过 `git apply --check`。这不是新的在线模型评测成功记录，Agent Eval 报告仍应保留原有真实失败证据，待后续重新运行隔离在线 fixture 后再更新。
- 本批验证：`cargo test --manifest-path desktop/src-tauri/Cargo.toml`（50/50）、`cargo check --manifest-path desktop/src-tauri/Cargo.toml`、`npm --prefix desktop test`（413/413）、`npm --prefix desktop run web:build`、`bash scripts/check-runtime.sh .`、`git diff --check` 均通过。Web build 仍有既有主 bundle 约 807 kB 警告。

### 2026-07-19 Preview 只读残留清理（第一批）

- `desktop/vite.config.js` 已删除 Preview 的任务/对话/项目记忆写入与删除实现；读取任务、读取对话、只读记忆、文件扫描、Agent Read Tool、Hermes 状态和只读 Patch Draft 保留。
- 这些端点此前已由 operation contract 的 Preview `deny` 守卫拦截；本批进一步删除函数本身和仅由其使用的依赖，防止未来兼容路由误接回浏览器写入。
- 验证：Preview 边界测试通过（仍为 413 项完整测试集），`npm --prefix desktop run web:build` 与 `git diff --check` 通过。

### 2026-07-19 Runtime Adapter 重复能力扫描移除

- 删除 `runtime/app.rs` 中未调用的 `detected_project_capabilities` 旧实现；工作区快照已统一使用 `runtime::workspace::detected_capabilities`，避免 Tauri command adapter 和 Workspace domain 维护两套能力裁决逻辑。
- 验证：`cargo test --manifest-path desktop/src-tauri/Cargo.toml` 50/50 通过。

### 2026-07-19 Preview Provider 探测收口

- 删除 Preview 中的 Provider 保存、删除、模型探测和健康记录写入实现；浏览器端只读取已持久化的 Provider 状态与 Key 是否存在，不读取 Key 内容，也不向模型服务发起探测请求。
- Provider 配置、模型探测和健康记录均统一由桌面 Runtime operation 承担；Preview contract 继续以 `deny` 拦截对应 endpoint。
- 验证：`npm --prefix desktop test` 413/413 通过，`git diff --check` 通过。
