# 组件目录说明

> 用途：登记报告页和未来前端中的可复用组件、分层和代码位置。
> 什么时候更新：新增共享组件、组件状态、组件源码位置或组件命名变化时。
> 不要写什么：一次性页面截图、当前任务流水、未落地的组件猜想。

## 当前状态

- 尚未接入 Radix / shadcn / ai-components
- 尚未建立应用级 `src/components`
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
