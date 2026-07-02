---
layer: knowledge
type: status
last_verified: 2026-07-02
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

## 最近完成

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
- 新增 `.project-os/model-catalog.json`，管理员可维护服务商、API 地址、Key 变量名和模型列表；Rust command `get_model_catalog` 会读取该文件，不存在时生成默认 catalog。前端服务商/模型下拉优先使用 catalog，读不到才回退内置默认。
- 桌面端 provider 已新增模型探测和当前模型测试：`probe_provider_models` 调用当前网关 `/models` 获取 API Key 可见模型池；`test_provider_model` 用当前 `apiBase` / `apiKeyEnv` / `model` 发起最小 `/chat/completions`，用于判断下拉中选中的模型是否真的能用。当前 `https://aihub.firstshare.cn/v1` 返回 63 个模型，配置中的 `gpt-5.4` 已测试通过。
- 桌面端任务队列已开始持久化：Rust command `list_desktop_tasks` / `save_desktop_task` 会把桌面任务 JSON 写入当前项目 `.project-os/runs/desktop-tasks/`；前端启动时读取最近 30 条任务，生成计划、Approve 和 Runner 结果都会回写任务记录。下一步应在这个基础上接 diff review / patch 应用确认。
- 桌面端已新增 patch draft / Diff 草案审阅：Rust command `generate_patch_draft` 会基于任务 plan 读取安全候选文件上下文，调用 provider 生成 unified diff JSON；失败时回退本地占位草案。前端 Active Task 增加 `Generate Patch` 和 Diff Draft 面板，生成结果写回同一任务记录。当前仍不写文件，Apply 需要下一步单独接入确认流程。
- 桌面端已新增受控 Apply Patch：Rust command `apply_patch_draft` 只接受任务里的 `patchDraft.diff`，先跑 `git apply --check`，通过后再 `git apply`；占位草案、空 diff 和非 unified diff 会被拒绝。前端 Active Task 增加 `Apply Patch` 按钮，成功后把 apply result 写回任务记录。下一步应接 Apply 后自动跑匹配检查并写回 run summary。
- Apply 后自动验证已接入：前端 `applyPatchDraft` 成功后会根据 plan 匹配白名单 checks，逐个调用 `run_guarded_check`，并把自动验证 run、状态和 `verificationSummary` 写回同一任务记录；全部通过为 `done`，任一失败为 `failed`。
- 本地 run summary 已接入：Rust command `write_run_summary` 会把任务标题、状态、Apply 结果、验证摘要、文件列表和检查结果追加写入 `.project-os/runs/desktop-summary.md`；前端 Apply + Verify 结束后自动调用，并把 summary path 写回任务记录。当前仍未自动合并进 `HANDOFF.md` 正文，下一步应做“确认合并到交接”。
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

## 当前验证

- `bash scripts/check-runtime.sh .` 已通过，0 warning。
- `bash tests/run-tests.sh` 已通过；其中 `.env.local` 的 `DEEPSEEK_API_KEY` 为空是安全检查 warning，不影响测试结果。
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

1. 接入交接状态合并确认，形成更完整的 coding 闭环。
2. 将主题设置继续打磨为更小白的品牌色入口，例如支持粘贴 HEX、命名品牌色和重置默认。
3. 打磨任务执行记录和模型调用反馈。
