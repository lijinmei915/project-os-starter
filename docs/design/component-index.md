# 组件目录说明

> 用途：登记报告页和未来前端中的可复用组件、分层和代码位置。
> 什么时候更新：新增共享组件、组件状态、组件源码位置或组件命名变化时。
> 不要写什么：一次性页面截图、当前任务流水、未落地的组件猜想。

## 当前状态

- 已开始接入 Radix / shadcn-style 本地组件层
- 桌面端已有 `desktop/src/main.jsx` 函数组件和 `desktop/src/styles.css` token layer
- 已建立 `desktop/src/components/ui` 作为桌面端 primitive 组件入口
- 已沉淀 AI 项目工程助手报告页的轻量组件契约
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
- 新增视觉值必须进 `desktop/src/styles.css` token layer，不能直接写在 JSX 或局部选择器里。
- 后续新增交互能力优先使用 Radix 官方 primitives，再通过本地 shadcn-style 组件映射到 Desktop tokens。
- 稳定后继续抽出 `Checkbox` 等官方 primitives 包装层。
- Headless / shadcn-style 组件只能作为本地组件源码进入项目，不直接依赖第三方默认视觉主题。

## 组合模式登记

| 组合模式 | 分层 | 用途 | 主要使用组件 |
|----------|------|------|--------------|
| `NewProjectWorkbench` | Composition | 新项目初始化工作台 | `ProductHeader`、`SegmentedSwitch`、`SectionHeading`、`SectionBlock`、`DocumentGrid`、`OptionCard`、`ChecklistItem`、`AddItemCard`、`WritePlanPanel`、`Button` |
| `OldProjectAuditWorkbench` | Composition | 老项目体检工作台 | `ProductHeader`、`SegmentedSwitch`、`SectionHeading`、`SectionBlock`、`TextField`、`ChecklistItem`、`Button` |

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
