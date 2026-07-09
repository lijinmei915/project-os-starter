---
layer: knowledge
type: status
last_verified: 2026-07-09
teaches: "当前交接上下文、风险点和下一步建议"
use_when: "新的 AI 会话接手工作、需要了解最近做了什么和接下来该做什么时"
depends_on: [PROJECT.md, AGENTS.md, docs/PRODUCT_PLAN.md, docs/CHANGELOG.md]
---

# 当前交接 (Handoff to Next AI)

> 用途：记录当前接手摘要、最近完成、风险和下一步建议。
> 什么时候更新：每次完成一组连续任务、当前状态变化或下一位 AI 需要接手时。
> 不要写什么：长期路线图、完整产品介绍、详细架构说明或历史流水账。

## 接手摘要

- 先读 `AGENTS.md`、`PROJECT.md`，再按任务需要查 `docs/ROUTING.md`、`docs/DOCUMENTATION.md`、`docs/NAMING.md`。
- 产品路线和阶段拆解看 `docs/PRODUCT_PLAN.md`，不要在本文件重复维护。
- 结构性历史看 `docs/CHANGELOG.md`，决策原因看 `docs/DECISIONS.md`。
- 当前仓库有较多未提交改动和未跟踪文件，继续工作时不要回滚非本轮改动。
- 当前产品定位已推进为 `Project OS Desktop / Console`：先稳定项目理解、推荐补齐、跑检查、维护交接状态，再通过 Tauri + Local Agent Core 做本地 coding 工作台；暂时不要把它做成完整 IDE、开放插件市场或通用 Hermes Studio 复制品。
- 整体架构分层已确认并写入 `docs/ARCHITECTURE.md`：自下而上为 `接入层 -> 元数据层 -> 核心内核层 -> 治理服务层 -> 工作台应用层 -> 入口层`；底层解决“接得进来”，上层解决“治得好”。
- 入口层已补架构约束：第一周前置定稿 `Entry Context` JSON 标准；Gateway 承担鉴权、参数标准化、日志链路、限流、异常封装和路由分发；CLI 是离线能力内核，Web / CI 通过 Gateway 复用 CLI 逻辑；新增能力必须同时具备 CLI、Gateway、CI 和离线降级路径。
- 注意：当前 `scripts/ai-project.sh` 只是 Shell 过渡 wrapper。长期入口层必须迁到原生 CLI / core library，否则会限制 Windows 原生运行、结构化日志/错误码、Gateway / CI / Desktop 进程间调用和复杂路由。

## 最近完成

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
- Rust / Cargo 已通过 `rustup` 安装，`desktop/` 的 Tauri dev 窗口已跑通；当前保留一个 `python3 -m http.server 8000` 和一个 `npm run dev` 进程。桌面端已经开始读取真实本地项目快照，并会生成第一版本地项目 registry；左侧 Projects 支持系统目录选择、输入路径备用添加和点击切换当前项目。

## 下一步建议

1. 在真实桌面端点一次“验证目标”和“签收目标”，确认 `.project-os/goal-validation-report.json` 与 `.project-os/goal-signoff-history.json` 的实际生成内容。
2. 继续把失败验收拆成修复任务：当报告失败时，右侧应自动生成“修复失败检查”的待办。
3. 再补视觉证据：把关键界面截图或像素检查纳入目标验收报告。
