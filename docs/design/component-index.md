# 组件目录说明

> 用途：登记报告页和未来前端中的可复用组件、分层和代码位置。
> 什么时候更新：新增共享组件、组件状态、组件源码位置或组件命名变化时。
> 不要写什么：一次性页面截图、当前任务流水、未落地的组件猜想。

## 当前状态

- 已开始接入 Radix / shadcn-style 本地组件层
- 桌面端已有 `desktop/src/main.jsx` 函数组件和 `desktop/src/styles.css` token layer
- 已建立 `desktop/src/components/ui` 作为桌面端 primitive 组件入口
- 已沉淀 AI 项目工程助手报告页的轻量组件契约
- 桌面端已提供 `设计实现 / 界面规范 / 组件` 可视化目录，按真实源码登记 Primitive、Pattern 和 Composition
- 当前报告页由 `templates/report/ai-project-report.html` 渲染静态 HTML
- 组件契约通过 `data-component`、`data-variant`、`data-state` 和 TypeScript 数据源承载

## 组件分层

| 层级 | 说明 |
|------|------|
| Primitive | 基础 UI 原语，如 Button、TextField、SegmentedSwitch |
| Pattern | 业务组合与交互规则，如 ProductHeader、OptionCard、ChecklistItem |
| Composition | 页面级组合模式，不提前抽成基础组件 |

## 拆分原则

- 按“行为和复用性”拆组件，不按截图中的视觉块硬拆。
- 相同行为合并为同一个组件，通过 variant / tone / state 区分。
- 图标作为 `icon slot`，不单独抽成组件。
- 旧 DOM 名称保留为兼容别名，后续模板改造时逐步统一。

## 组件登记

| 组件 / Pattern | 分层 | 文档 | 数据 / 契约 | 当前承载 |
|----------------|------|------|-------------|----------|
| `ProductHeader` | Pattern | `docs/design/ai-project-assistant/components.md` | `docs/design/ai-project-assistant/components.ts` / `data.ts` | `templates/report/ai-project-report.html` |
| `SegmentedSwitch` | Primitive | `docs/design/ai-project-assistant/components.md` | `docs/design/ai-project-assistant/components.ts` / `data.ts` | `templates/report/ai-project-report.html` |
| `MetaPanel` | Deprecated Pattern | `docs/design/ai-project-assistant/components.md` | `docs/design/ai-project-assistant/components.ts` | 历史/备用状态卡，当前页面不在 Header 使用 |
| `SectionHeading` | Pattern | `docs/design/ai-project-assistant/components.md` | `docs/design/ai-project-assistant/components.ts` / `data.ts` | `templates/report/ai-project-report.html` |
| `SectionBlock` | Pattern | `docs/design/ai-project-assistant/components.md` | `docs/design/ai-project-assistant/components.ts` | `templates/report/ai-project-report.html` |
| `DocumentGrid` | Pattern | `docs/design/ai-project-assistant/components.md` | `docs/design/ai-project-assistant/components.ts` / `data.ts` | `templates/report/ai-project-report.html` |
| `OptionCard` | Pattern | `docs/design/ai-project-assistant/components.md` | `docs/design/ai-project-assistant/components.ts` / `data.ts` | `templates/report/ai-project-report.html` |
| `ChecklistItem` | Pattern | `docs/design/ai-project-assistant/components.md` | `docs/design/ai-project-assistant/components.ts` / `data.ts` | `templates/report/ai-project-report.html` |
| `AddItemCard` | Pattern | `docs/design/ai-project-assistant/components.md` | `docs/design/ai-project-assistant/components.ts` / `data.ts` | `templates/report/ai-project-report.html` |
| `WritePlanPanel` | Pattern | `docs/design/ai-project-assistant/components.md` | `docs/design/ai-project-assistant/components.ts` / `data.ts` | `templates/report/ai-project-report.html` |
| `TextField` | Primitive | `docs/design/ai-project-assistant/components.md` | `docs/design/ai-project-assistant/components.ts` / `data.ts` | `templates/report/ai-project-report.html` |
| `Button` | Primitive | `docs/design/ai-project-assistant/components.md` | `docs/design/ai-project-assistant/components.ts` / `data.ts` | `templates/report/ai-project-report.html` |

## 桌面端 v0.1 组件现状

桌面端当前先以内联 React 函数组件承载真实产品链路，后续稳定后再拆入 `desktop/src/components`。

| 组件 / Pattern | 分层 | 当前承载 | 说明 |
|----------------|------|----------|------|
| `TopBar` | Pattern | `desktop/src/main.jsx` | 应用级头部、状态和全局操作 |
| `ProjectSidebar` | Pattern | `desktop/src/main.jsx` | 项目 registry、目录选择和文件树 |
| `AgentWorkspace` | Composition | `desktop/src/main.jsx` | Plan / Diff / Runner 主工作区 |
| `ProviderPanel` | Pattern | `desktop/src/main.jsx` | Provider profile、模型刷新和测试 |
| `TaskQueueItem` | Pattern | `desktop/src/main.jsx` | 本地任务队列项 |
| `ReadonlyPlan` | Pattern | `desktop/src/main.jsx` | 只读计划展示 |
| `PatchDraft` | Pattern | `desktop/src/main.jsx` | Diff 草案审阅 |
| `SectionTitle` | Primitive | `desktop/src/main.jsx` | 小节标题与 meta |
| `Metric` | Primitive | `desktop/src/main.jsx` | 紧凑指标行 |
| `MemoryItem` | Pattern | `desktop/src/main.jsx` | 记忆条目 |
| `ProviderStatusRow` | Pattern | `desktop/src/components/workbench/provider-status-row.jsx` | Provider 启用状态与 Key 状态展示 |
| `TaskCommandBar` | Pattern | `desktop/src/components/workbench/task-command-bar.jsx` | Diff / Runner 等任务操作按钮组 |
| `ThemeMenu` | Pattern | `desktop/src/components/workbench/theme-menu.jsx` | 顶部主题下拉，支持深浅模式和主题色切换 |
| `OverviewPageHeader` | Pattern | `desktop/src/components/workbench/overview-section.jsx` | 项目概览和当前进度共用的页面头部：标题、弱元信息、阶段状态、说明、来源与动作插槽 |
| `OverviewSection` | Pattern | `desktop/src/components/workbench/overview-section.jsx` | 概览型治理页共用的扁平分区：标题、副标题、右侧动作插槽和 1–3 项自适应等分内容；页面根容器 `.overviewSurface` 通过 `--desktop-space-overview-section` 统一纵向节奏 |
| `ComponentGovernancePanel` | Composition | `desktop/src/components/workbench/component-governance-panel.jsx` | 组件内部目录、真实预览、状态与源码归属；自身归属 `组件` 页，不注册单个组件菜单 |
| `TokenGovernancePanel` | Composition | `desktop/src/components/workbench/token-governance-panel.jsx` | Token 分类、实际变量名和运行时样例；自身归属 `Token` 页 |
| `Button` | Primitive | `desktop/src/components/ui/button.jsx` | Radix Slot + CVA 变体，视觉映射到 Desktop tokens |
| `Input` | Primitive | `desktop/src/components/ui/input.jsx` | 表单与 Composer 输入框，视觉映射到 Desktop tokens |
| `Select` | Primitive | `desktop/src/components/ui/select.jsx` | Provider 和模型下拉，视觉映射到 Desktop tokens |
| `Badge` | Primitive | `desktop/src/components/ui/badge.jsx` | 任务状态、只读标识和队列状态，视觉映射到 Desktop tokens |
| `Panel` | Primitive | `desktop/src/components/ui/panel.jsx` | Provider、Queue、Diff、Runner、Index 等容器，视觉映射到 Desktop tokens |
| `Field` | Composition | `desktop/src/components/ui/field.jsx` | Radix Label + 本地表单组合，视觉映射到 Desktop tokens |
| `Notice` | Primitive | `desktop/src/components/ui/notice.jsx` | 提示、成功和错误反馈，视觉映射到 Desktop tokens |
| `SectionTitle` | Primitive | `desktop/src/components/ui/section-title.jsx` | 小节标题和 meta，视觉映射到 Desktop tokens |
| `Tabs` | Primitive | `desktop/src/components/ui/tabs.jsx` | Radix Tabs + 本地标签样式，视觉映射到 Desktop tokens |
| `Tooltip` | Primitive | `desktop/src/components/ui/tooltip.jsx` | Radix Tooltip + 本地提示样式，视觉映射到 Desktop tokens |
| `Dialog` | Primitive | `desktop/src/components/ui/dialog.jsx` | Radix Dialog + 本地弹窗样式，视觉映射到 Desktop tokens |
| `DropdownMenu` | Primitive | `desktop/src/components/ui/dropdown-menu.jsx` | Radix Dropdown Menu + 本地菜单样式，视觉映射到 Desktop tokens |
| `Switch` | Primitive | `desktop/src/components/ui/switch.jsx` | Radix Switch + 本地开关样式，视觉映射到 Desktop tokens |

规则：

- 新增桌面端 UI 时，先复用上表组件或通过 variant / state 扩展。
- `Button` 默认优先使用 shadcn 的语义变体：`secondary` 用于任务卡等次级动作；`outline` 用于目标历史等页面级查看入口；`primary` 仅用于页面主操作和不可替代的确认动作。
- 新增视觉值必须进 `desktop/src/styles.css` token layer，不能直接写在 JSX 或局部选择器里。
- 后续新增交互能力优先使用 Radix 官方 primitives，再通过本地 shadcn-style 组件映射到 Desktop tokens。
- 稳定后继续抽出 `Checkbox` 等官方 primitives 包装层。
- Headless / shadcn-style 组件只能作为本地组件源码进入项目，不直接依赖第三方默认视觉主题。

## 组合模式登记

| 组合模式 | 分层 | 用途 | 主要使用组件 |
|----------|------|------|--------------|
| `NewProjectWorkbench` | Composition | 新项目初始化工作台 | `ProductHeader`、`SegmentedSwitch`、`SectionHeading`、`SectionBlock`、`DocumentGrid`、`OptionCard`、`ChecklistItem`、`AddItemCard`、`WritePlanPanel`、`Button` |
| `OldProjectAuditWorkbench` | Composition | 老项目体检工作台 | `ProductHeader`、`SegmentedSwitch`、`SectionHeading`、`SectionBlock`、`TextField`、`ChecklistItem`、`Button` |
| `ProgressSurface` | Composition | 当前进度、当前目标、验收报告等进度型工作面 | `OverviewPageHeader`、`OverviewSection`、`Badge`、`Button`、`Notice` |
| `CurrentGoalSurface` | Composition | 当前目标的定义、范围边界和状态驱动的唯一下一步；不展开任务、验收或历史详情 | `OverviewPageHeader`、`OverviewSection`、`Badge`、`Button` |
| `AcceptanceCriteriaSurface` | Composition | 当前目标的完成判断和验收结论摘要；检查详情归验收报告 | `OverviewPageHeader`、`OverviewSection`、`Badge`、`Button`、`Notice` |
| `GoalHistorySurface` | Composition | 已完成目标及完成确认记录；不混入当前目标和任务详情 | `OverviewPageHeader`、`OverviewSection`、`Badge`、`Notice` |
| `RunbookSurface` | Composition | 启动状态、运行环境、启动入口和终端预填入口 | `OverviewPageHeader`、`OverviewSection`、`OverviewTagList`、`Button`、`Badge`、`Notice` |
| `TaskSurface` | Composition | 当前任务、任务详情、Patch 草案和执行结果 | `Panel`、`Badge`、`TaskCommandBar`、`Notice` |
| `HealthSurface` | Composition | 治理文件、设计实现、Schema、报告产物等健康状态工作面 | `Panel`、`Badge`、`Button`、`Notice` |
| `ConfigurationSurface` | Composition | 模型连接、工具白名单、Skill、适配器和安全边界 | `Panel`、`Field`、`Button`、`Badge`、`Switch` |
| `MemorySurface` | Composition | 项目事实、用户偏好、长期记忆和会话摘要 | `Panel`、`Badge`、`Notice` |

工作区菜单可视化结构见 `docs/design/workbench-visualization.md`。

### Badge 语义色

| Variant | 适用状态 |
|---------|----------|
| `neutral` | 只读、版本、无结论或非状态标签 |
| `info` | 已发现、计划中、进行中、处理中；固定蓝色 |
| `success` | 已登记、已识别、已接入、可启动、已完成、已通过、可用；固定绿色，不跟随主题色 |
| `warning` | 待确认、需关注、中风险、信息不完整；固定金黄底 + 深琥珀文字 |
| `danger` | 失败、阻塞、高风险；固定红色 |

页面不得为同一语义自行选择颜色；必须使用 `Badge` 的语义 variant。
所有 Badge variant 使用同一浅底色阶：仅替换色相，底色强度保持一致。页面不得改写 Badge 底色。
字段名、来源、数量、描述和“下一步”动作保持中性；只有可判断的状态值使用 Badge。“下一步”必须以动作文本或按钮呈现，不能使用语义色代替行动。
未匹配到语义的只读文本、版本和来源使用 `neutral`，不得为了区分而新增颜色。新页面只使用四种通用语义 variant；旧的 `planned`、`waiting`、`running`、`done`、`failed` 仅为历史兼容输入，并分别映射回这四种语义色。

`OverviewPageHeader` 和 `OverviewSection` 是页面内部 pattern，不注册为独立菜单。项目概览的核心定位、技术组成、工程结构和生命周期阶段仍只在 `项目概览` 展示；当前进度只复用视觉骨架，展示当前里程碑、当前目标、目标阶段链、验收与风险摘要和唯一下一步，不读取任务计数或展开任务详情。

`界面规范` 是纯分组，不拥有同名页面。`Token` 和 `组件` 是其仅有的全局叶子页；Button、Badge、OverviewSection 等具体组件只登记在组件页内部目录。组件页的 `查看源码` 进入 `工程文件`，不在治理页复制源码预览职责。

## 兼容别名

| 旧名称 | 新归属 | 说明 |
|--------|--------|------|
| `RequiredMaterialItem` | `ChecklistItem[type="material"][state="locked"]` | 必选资料项是 checklist 的 locked 变体 |
| `AddDocumentButton` | `AddItemCard[variant="document"]` | 添加更多文档入口是 AddItemCard 的文档变体 |
| `ChoiceCard` | `OptionCard[variant="choice"]` | 个人开发 / 团队协作类双选卡 |
| `StrategyCard` | `OptionCard[variant="strategy"]` | 启动策略类卡片 |

## 迁移规则

- 报告页模板改造时，优先使用上表中的新组件名。
- 旧别名只用于兼容历史 DOM 或设计反馈，不新增新别名。
- 新增组件前先判断是否可通过现有组件的 variant / state 表达。
- 当组件迁移到真实前端目录后，在本文件补充真实源码路径。
