# Token 规范

> 用途：定义 Project OS 报告页和后续 UI 的设计 token 命名、数值和使用边界。
> 什么时候更新：颜色、字号、间距、圆角、阴影、焦点态或主题策略变化时。
> 不要写什么：一次性页面样式、具体组件实现流水、与设计无关的工程决策。

当前 token 目标不是做一套大而全主题系统，而是先让 AI 项目工程助手报告页有稳定视觉来源。

当前落地状态：
- `templates/report/ai-project-report.html` 已建立 `:root` token / alias 层
- `desktop/src/styles.css` 已建立桌面端 `--desktop-*` token / alias 层
- 当前工作台核心组件已优先使用 semantic token 和 component token
- 早期兼容报告区通过 `--bg` / `--panel` / `--text` 等 alias 继续工作

---

## 命名规则

统一使用 CSS Custom Properties 风格：

```css
--color-text-primary
--space-16
--radius-card
--shadow-focus
```

规则：
- token 名必须表达语义，不只表达颜色本身。
- 组件里优先使用 semantic token，不直接写 hex / rgba / px。
- 只有 token 文件可以定义基础数值。
- 组件特殊值必须能解释成状态或语义槽位。

## 分层

| 层级 | 用途 | 示例 |
|------|------|------|
| Foundation | 原始数值和基础色阶 | `--gray-900`、`--space-16` |
| Semantic | 页面语义和状态 | `--color-surface-page`、`--color-action-primary` |
| Component | 组件局部语义 | `--component-check-bg`、`--component-step-size` |

当前优先落地 Foundation + Semantic。Component token 只在重复组件里使用。

---

## Color Tokens

### Desktop Runtime Tokens

桌面端当前接入 Headless / shadcn-style 本地组件层，但不直接使用第三方默认主题。组件视觉必须映射到 Project OS 自己的 Desktop token layer。

桌面端 token 分四层：

- Foundation：`--desktop-gray-*`、`--desktop-info`、`--desktop-danger`
- Theme accent：`--desktop-theme-h`、`--desktop-theme-s`、`--desktop-theme-l` 派生 `--desktop-accent-*`
- Semantic：`--desktop-surface-*`、`--desktop-border-*`、`--desktop-text-*`
- Compatibility alias：`--bg`、`--panel`、`--line`、`--text`、`--accent`

规则：

- 新增桌面端样式优先使用 `--desktop-*` 或兼容 alias。
- 只有 token 定义区可以新增 hex / rgba 原始值。
- 主视觉只允许从 `--desktop-theme-h/s/l` 派生；其他界面默认中性色，最多使用主题色偏色。
- 组件状态色使用 `--desktop-state-*` / `--desktop-state-accent-*`，不要在组件选择器里散落新的 `rgba(...)`。
- `--desktop-brand` 只保留为兼容 alias，新实现使用 `--desktop-accent`。
- `desktop/src/components` 中的组件只读 token，不内嵌主题数值。

当前桌面端主题色入口：

| Token | 默认值 | 用途 |
|-------|--------|------|
| `--desktop-theme-h` | `160` | 主题色 HSL hue，可由用户自定义 |
| `--desktop-theme-s` | `80%` | 主题色饱和度 |
| `--desktop-theme-l` | `47%` | 主题色亮度 |
| `--desktop-accent` | derived | 主强调色 |
| `--desktop-accent-soft` | derived | 深色背景上的主题色文字 |
| `--desktop-text-accent` | derived | 选中、实时、主题强调文字 |
| `--desktop-text-accent-muted` | derived | 弱主题强调文字 |
| `--desktop-text-on-accent` | mode-specific | 实色主题背景上的反白/反黑文字 |
| `--desktop-text-info` | mode-specific | 信息状态文字，不随主题色变化 |
| `--desktop-text-success` | derived | 成功状态文字，默认跟随主题色 |
| `--desktop-text-warning` | mode-specific | 警告状态文字，不随主题色变化 |
| `--desktop-text-danger` | mode-specific | 错误状态文字，不随主题色变化 |
| `--desktop-surface-rail` | mode-specific | 左右侧栏背景 |
| `--desktop-surface-canvas` | mode-specific | 中央工作画布背景 |
| `--desktop-surface-card-soft` | mode-specific | 弱卡片、计划卡背景 |
| `--desktop-surface-code-soft` | mode-specific | 弱代码/只读计划背景 |
| `--desktop-surface-trace` | mode-specific | Trace 区域背景 |
| `--desktop-border-accent` | derived | 选中、focus、强调边框 |
| `--desktop-state-accent-bg` | derived | 弱选中底色 |
| `--desktop-state-accent-bg-strong` | derived | 强选中底色 |

桌面端文字颜色规则：

- 普通阅读内容、说明、路径、列表和空状态默认使用 `--desktop-text-primary` / `secondary` / `muted` / `soft`，不跟随主题色。
- 选中态、当前任务、实时运行、安全状态、主题控件选中项可以使用 `--desktop-text-accent`。
- 成功状态当前跟随主题色，使用 `--desktop-text-success`，不要在组件里直接引用 `--desktop-accent-soft`。
- 信息、警告、错误是功能语义，不随用户主题色变化，分别使用 `--desktop-text-info`、`--desktop-text-warning`、`--desktop-text-danger`。
- 实色主题背景上的文字必须使用 `--desktop-text-on-accent`；固定明暗背景的品牌标识使用组件 token，不复用 accent 文本 token。
- 页面壳层、侧栏、工作画布、Trace、代码块必须使用 `--desktop-surface-*`，不要在组件选择器里写死暗色 `rgba(...)`，否则浅色主题会漏切。

### Foundation Palette

| Token | Value | 用途 |
|-------|-------|------|
| `--gray-50` | `#fafafa` | 页面浅底 |
| `--gray-100` | `#f4f4f5` | 控件浅底、分隔区域 |
| `--gray-200` | `#e4e4e7` | 浅边框 |
| `--gray-300` | `#d4d4d8` | 虚线边框、输入边框 |
| `--gray-400` | `#a1a1aa` | 次弱文字 |
| `--gray-500` | `#71717a` | 辅助文字 |
| `--gray-600` | `#52525b` | 控件说明和次级图标 |
| `--gray-700` | `#3f3f46` | hover 后的次强文字 |
| `--gray-800` | `#27272a` | 深色 hover 面 |
| `--gray-900` | `#18181b` | 强文字、深色控件 |
| `--slate-50` | `#f8fafc` | 信息卡浅底 |
| `--slate-100` | `#edf0f5` | 进度条浅底 |
| `--slate-200` | `#d9dee7` | 报告默认边框 |
| `--slate-500` | `#667085` | 报告辅助文字 |
| `--slate-900` | `#1d2430` | 报告正文 |
| `--teal-50` | `#dff7f3` | 品牌浅底 |
| `--teal-500` | `#13b7a6` | 品牌强调 |
| `--teal-600` | `#087b73` | 品牌文字 |
| `--emerald-50` | `#e8f7ef` | 成功浅底 |
| `--emerald-100` | `#ecfdf5` | 成功弱选中底 |
| `--emerald-200` | `#b7e7ca` | 成功弱边框 |
| `--emerald-300` | `#86efac` | 成功 hover 边框 |
| `--emerald-400` | `#34d399` | 成功图标 |
| `--emerald-500` | `#10b981` | 成功强调 |
| `--emerald-600` | `#059669` | 成功图标深色态 |
| `--emerald-700` | `#087443` | 成功文字 |
| `--emerald-800` | `#047857` | 成功选中文字 |
| `--blue-50` | `#eef4ff` | 信息浅底 |
| `--blue-600` | `#2563eb` | 焦点和链接 |
| `--blue-700` | `#175cd3` | 信息文字 |
| `--orange-50` | `#fff4e5` | 风险浅底 |
| `--orange-700` | `#b54708` | 风险文字 |

### Semantic Colors

| Token | Value | 用途 |
|-------|-------|------|
| `--color-surface-page` | `var(--gray-50)` | 页面背景 |
| `--color-surface-panel` | `#ffffff` | 主面板、卡片 |
| `--color-surface-muted` | `var(--slate-50)` | 次级区域 |
| `--color-surface-inverse` | `var(--gray-900)` | 深色选中态 |
| `--color-text-primary` | `var(--gray-900)` | 主文字 |
| `--color-text-secondary` | `var(--gray-500)` | 辅助文字 |
| `--color-text-muted` | `var(--gray-400)` | 弱提示 |
| `--color-text-inverse` | `#ffffff` | 深底文字 |
| `--color-border-default` | `rgba(228, 228, 231, .9)` | 默认边框 |
| `--color-border-strong` | `var(--slate-200)` | 强边框 |
| `--color-brand` | `var(--teal-500)` | 品牌强调 |
| `--color-action-primary` | `#164c7a` | 主操作按钮 |
| `--color-action-primary-hover` | `#0f3a5e` | 主操作 hover |
| `--color-success-text` | `var(--emerald-700)` | 成功文字 |
| `--color-success-bg` | `var(--emerald-50)` | 成功背景 |
| `--color-warning-text` | `var(--orange-700)` | 风险文字 |
| `--color-warning-bg` | `var(--orange-50)` | 风险背景 |
| `--color-focus` | `var(--blue-600)` | focus-visible 外圈 |

---

## Typography Tokens

字体：

| Token | Value | 用途 |
|-------|-------|------|
| `--font-sans` | `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` | UI 默认字体 |
| `--font-mono` | `"SFMono-Regular", Consolas, monospace` | 路径、命令、代码 |

字号：

| Token | Value | 用途 |
|-------|-------|------|
| `--text-10` | `10px` | 步骤编号、小型控件数字 |
| `--text-11` | `11px` | 元信息、密集标签 |
| `--text-12` | `12px` | 小说明、徽标 |
| `--text-13` | `13px` | 状态标签、辅助短句 |
| `--text-14` | `14px` | 默认正文、按钮、控件 |
| `--text-16` | `16px` | 重点正文 |
| `--text-18` | `18px` | 卡片标题 |
| `--text-20` | `20px` | 二级标题 |
| `--text-22` | `22px` | 兼容报告小标题 |
| `--text-24` | `24px` | 分区标题 |
| `--text-26` | `26px` | 移动端大标题 |
| `--text-30` | `30px` | 兼容报告结论标题 |
| `--text-32` | `32px` | 页面标题 |
| `--text-34` | `34px` | 移动端报告标题 |
| `--text-40` | `40px` | 指标大数字 |
| `--text-44` | `44px` | 兼容报告页 H1 |

字重：

| Token | Value | 用途 |
|-------|-------|------|
| `--font-regular` | `400` | 正文 |
| `--font-medium` | `650` | 控件文字 |
| `--font-bold` | `700` | 标签、按钮 |
| `--font-strong` | `750` | 小标题、强调数字 |
| `--font-heavy` | `800` | 编号、强状态 |

### Desktop Typography Tokens

桌面端采用主流组件系统常见的 semantic type scale：字号按角色命名，字重按强度命名。组件优先使用这些 token，不在选择器里新增裸 `font-size` / `font-weight` 数值。

| Token | Value | 用途 |
|-------|-------|------|
| `--desktop-text-meta` | `10px` | 极小元信息、短状态、紧凑按钮 |
| `--desktop-text-caption` | `11px` | 表单标签、辅助文案、状态标签 |
| `--desktop-text-body` | `12px` | 工作台正文、卡片标题、按钮文字 |
| `--desktop-text-title` | `14px` | 应用标题、分区强标题 |
| `--desktop-font-regular` | `400` | 正文 |
| `--desktop-font-medium` | `650` | 次级标题、辅助强调 |
| `--desktop-font-semibold` | `750` | 小标题、状态短句 |
| `--desktop-font-bold` | `850` | 按钮、标签、重要字段 |
| `--desktop-font-heavy` | `900` | 品牌标识、强状态、计数 |

兼容 alias：

| Alias | Maps to |
|-------|---------|
| `--text-xs` | `--desktop-text-meta` |
| `--text-sm` | `--desktop-text-caption` |
| `--text-md` | `--desktop-text-body` |
| `--text-lg` | `--desktop-text-title` |

规则：
- 字号不随 viewport 缩放。
- `letter-spacing` 默认 `0`，只有品牌小标签可使用正向字距。
- 紧凑工具界面不使用 hero 级大标题。
- 新增桌面端组件优先使用 `--desktop-text-*` / `--desktop-font-*`。

---

## Spacing Tokens

间距 token 分两层：

- Foundation spacing：基础数值档位，例如 `--space-8`、`--space-12`。
- Layout / component spacing：具体场景语义，例如 `--desktop-toolbar-control-padding-x`。

规则：
- 组件优先使用语义 token；只有没有语义槽位时才使用基础 `--space-*`。
- 同一组件族必须共用同一组 spacing token，不允许状态标签、按钮、菜单各自写一套 padding / gap。
- 新增裸 `padding` / `gap` / `margin` 数值前，先判断是否应登记为 component token。
- `px` 数值只允许出现在 token 定义区、一次性计算值或第三方兼容修正里。

| Token | Value | 用途 |
|-------|-------|------|
| `--space-2` | `2px` | 极小内部分隔 |
| `--space-3` | `3px` | 状态控件细调 |
| `--space-4` | `4px` | 小徽标内边距 |
| `--space-5` | `5px` | meta 行间距 |
| `--space-6` | `6px` | segmented control 内边距 |
| `--space-8` | `8px` | 小组件间距 |
| `--space-9` | `9px` | 兼容按钮纵向内边距 |
| `--space-10` | `10px` | 控件内边距 |
| `--space-12` | `12px` | 卡片内小间距 |
| `--space-13` | `13px` | 代码框内边距 |
| `--space-14` | `14px` | 列表项内边距 |
| `--space-16` | `16px` | 标准区块间距 |
| `--space-18` | `18px` | 报告卡片内边距 |
| `--space-20` | `20px` | 指标面板内边距 |
| `--space-24` | `24px` | 大区块间距 |
| `--space-28` | `28px` | 工作台左右安全边距 |
| `--space-32` | `32px` | 页面主要分栏间距 |
| `--space-48` | `48px` | 页面顶部留白 |
| `--space-72` | `72px` | 页面底部留白 |

规则：
- 同一层级组件使用同一档 spacing。
- 紧凑列表优先 `8 / 10 / 12`。
- 页面级区块优先 `24 / 32 / 48`。

### Desktop Layout And Control Tokens

桌面端工作台采用密集工具界面布局。布局和顶部控件必须走桌面端语义 token，不能在组件里单独写散落数值。

| Token | Value | 用途 |
|-------|-------|------|
| `--desktop-layout-topbar-height` | `50px` | 桌面端顶部栏高度 |
| `--desktop-layout-statusbar-height` | `24px` | 底部状态栏高度 |
| `--desktop-layout-sidebar-left` | `248px` | 左侧项目栏默认宽度 |
| `--desktop-layout-sidebar-right` | `320px` | 右侧配置 / 队列栏默认宽度 |
| `--desktop-layout-column-gap` | `0px` | 主工作台三栏之间的结构 gap，默认靠边框分隔 |
| `--desktop-layout-panel-gap` | `10px` | 面板内部模块间距 |
| `--desktop-layout-panel-padding` | `12px` | 桌面端标准面板内边距 |
| `--desktop-toolbar-control-height` | `30px` | 顶部工具栏控件高度 |
| `--desktop-toolbar-control-padding-x` | `12px` | 顶部文字型控件左右内边距 |
| `--desktop-toolbar-control-gap` | `7px` | 顶部控件 icon 与文字间距 |
| `--desktop-toolbar-icon-size` | `15px` | 顶部控件图标尺寸 |

顶部工具栏规则：
- 有文字的控件统一使用 `height: var(--desktop-toolbar-control-height)`、`padding-inline: var(--desktop-toolbar-control-padding-x)`、`gap: var(--desktop-toolbar-control-gap)`。
- 纯 icon 控件统一使用 `width = height = var(--desktop-toolbar-control-height)`。
- 顶部状态 pill 和按钮属于同一控件族，必须共用 toolbar token。
- 状态差异只改变 icon / 文本 / 边框语义色，不改变 padding、gap、height、border-radius。
- 新增顶部动作前，优先复用 `Button` / `StatusPill`，不要直接手写 `div + svg + text`。

---

## Radius Tokens

| Token | Value | 用途 |
|-------|-------|------|
| `--radius-xs` | `4px` | 品牌小标签 |
| `--radius-sm` | `8px` | 默认按钮、卡片、输入框 |
| `--radius-md` | `10px` | segmented control 内部滑块 |
| `--radius-card` | `12px` | 工作台内部选项卡和资料项 |
| `--radius-lg` | `14px` | segmented control 外框 |
| `--radius-xl` | `18px` | 工作台主容器 |
| `--radius-full` | `999px` | 圆形徽标、pill |

规则：
- 默认卡片不超过 `8px`，除非是工作台容器或明确的控件外壳。
- 圆形头像、步骤编号、状态 pill 使用 `--radius-full`。

---

## Shadow And Focus Tokens

| Token | Value | 用途 |
|-------|-------|------|
| `--shadow-sm` | `0 1px 2px rgba(24, 24, 27, .04)` | 轻量卡片 |
| `--shadow-control` | `0 1px 2px rgba(24, 24, 27, .06)` | 小型圆形控件 |
| `--shadow-strong` | `0 8px 22px rgba(24, 24, 27, .16)` | 深色选中策略卡 |
| `--shadow-focus` | `0 0 0 3px rgba(37, 99, 235, .28)` | focus-visible |
| `--shadow-focus-muted` | `0 0 0 3px rgba(37, 99, 235, .16)` | 低强度选中 |
| `--shadow-success-ring` | `0 0 0 3px rgba(52, 211, 153, .22)` | 成功圆点 |
| `--shadow-brand-ring` | `0 0 0 3px rgba(19, 183, 166, .16)` | 品牌选中 |

规则：
- 可点击元素必须有 `focus-visible`。
- hover 可以改变边框或背景，但不要只靠阴影表达状态。
- 报告页不使用大面积装饰阴影。

---

## Layout Tokens

| Token | Value | 用途 |
|-------|-------|------|
| `--layout-report-max` | `1280px` | 旧报告概览最大宽度 |
| `--layout-workbench-max` | `960px` | AI 工程助手工作台最大宽度 |
| `--layout-page-gutter` | `32px` | 页面左右安全边距 |
| `--layout-left-panel` | `5fr` | 工作台左栏 |
| `--layout-right-panel` | `7fr` | 工作台右栏 |

规则：
- 工作台页面默认 `960px` 居中。
- 需要扫描和对比的信息，不使用过宽段落。
- 分栏比例必须稳定，不让内容变化推挤布局。

---

## Component Token Slots

| Component | Slot | Token |
|-----------|------|-------|
| `ProductHeader` | title size | `--text-32` |
| `ProductHeader` | brand background | `--color-surface-inverse` |
| `ProductHeader` | brand icon color | `--color-success-icon` |
| `WorkbenchLayout` | desktop block padding | `--component-workbench-panel-padding-block: 32px` |
| `WorkbenchLayout` | desktop inline padding | `--component-workbench-panel-padding-inline: 32px` |
| `WorkbenchLayout` | mobile block padding | `--component-workbench-panel-padding-block: 24px` |
| `WorkbenchLayout` | mobile inline padding | `--component-workbench-panel-padding-inline: 20px` |
| `WorkbenchLayout` | section gap | `--component-workbench-section-gap: 32px` |
| `WorkbenchLayout` | list item gap | `--component-workbench-list-gap: 12px` |
| `WorkbenchLayout` | control gap | `--component-workbench-control-gap: 16px` |
| `DocumentGrid` | card min width | `--component-document-card-min: 176px` |
| `DocumentGrid` | grid gap | `--component-document-grid-gap: 12px` |
| `DocumentGrid` | preview action size | `--component-document-action-size: 22px` |
| `DocumentGrid` | preview icon size | `--component-document-action-icon-size: 14px` |
| `SegmentedSwitch` | header pill padding | `--space-6` |
| `SegmentedSwitch` | header pill gap | `--space-4` |
| `SegmentedSwitch` | header pill radius | `--radius-lg` |
| `SegmentedSwitch` | selected tab radius | `--radius-md` |
| `MetaPanel` | font | `--font-mono` / `--text-11`，仅历史/备用状态卡使用 |
| `SectionHeading` | number size | `--component-step-size: 20px` |
| `SectionHeading` | title size | `--text-14` |
| `SectionHeading` | description size | `--text-12` |
| `SectionHeading` | title / description gap | `--component-section-title-gap: 4px` |
| `SectionHeading` | heading / content gap | `--component-section-content-gap: 16px` |
| `SectionHeading` | code source description / first source card | `--component-section-content-gap: 16px` |
| `SectionHeading` | current directory description / path field | `--component-section-content-gap: 16px` |
| `SectionHeading` | audit description / first checklist item | `--component-section-content-gap: 16px` |
| `SectionBlock` | heading / content gap | `--component-section-content-gap: 16px` |
| `SectionBlock` | content control gap | `--component-workbench-control-gap: 16px` |
| `WizardQuestion` | label / options gap | `--component-question-content-gap: 8px` |
| `WizardQuestion` | question group gap | `--component-question-section-gap: 20px` |
| `OptionCard` | choice radius | `--radius-card` |
| `OptionCard` | strategy radius | `--radius-lg` |
| `OptionCard` | selected border | `--color-surface-inverse` |
| `ChecklistItem` | check size | `--component-check-size: 18px` |
| `ChecklistItem` | leading icon slot | `--component-check-icon-size: 34px` |
| `ChecklistItem` | leading icon glyph | `--component-check-glyph-size: 16px` |
| `ChecklistItem` | column gap | `--component-checklist-column-gap: 14px` |
| `ChecklistItem` | item padding | `--component-checklist-padding: 12px` |
| `ChecklistItem` | check background | `--color-surface-inverse` |
| `ChecklistItem` | check color | `--color-success-icon` |
| `ChecklistItem` | locked border | `--color-border-subtle` |
| `EmptyAction` | min height | `--component-empty-action-min-height: 88px` |
| `EmptyAction` | block padding | `--component-empty-action-padding-block: 16px` |
| `EmptyAction` | inline padding | `--component-empty-action-padding-inline: 16px` |
| `EmptyAction` | border | `--component-empty-action-border: 1px dashed --gray-300` |
| `EmptyAction` | radius | `--component-empty-action-radius: --radius-lg` |
| `EmptyAction` | background | `--component-empty-action-bg` |
| `EmptyAction` | content gap | `--component-empty-action-gap: 6px` |
| `AddItemCard` | idle border | `--gray-300` |
| `AddItemCard` | icon size | `--component-add-size: 32px` |
| `AddItemCard` | hover border | `--emerald-300` |
| `WritePlanPanel` | panel padding | `--space-14` |
| `WritePlanPanel` | panel gap | `--space-12` |
| `WritePlanPanel` | summary row padding | `--space-10 --space-12` |
| `WritePlanPanel` | row label column | `88px` |
| `WritePlanPanel` | action gap | `--component-workbench-list-gap` |
| `TextField` | radius | `--radius-md` |
| `TextField` | focus border | `--color-success-strong` |
| `TextField` | field action size | `--component-field-action-size: 32px` |
| `TextField` | block padding | `--component-field-padding-block: 10px` |
| `TextField` | inline padding | `--component-field-padding-inline: 13px` |
| `Button` | min height | `--component-button-min-height: 44px` |
| `Button` | block padding | `--component-button-padding-block: 10px` |
| `Button` | inline padding | `--component-button-padding-inline: 18px` |
| `Button` | primary background | `--color-surface-inverse` |
| `Button` | primary hover | `--color-surface-inverse-hover` |

---

## 落地顺序

1. 先让 `templates/report/ai-project-report.html` 的 `:root` 对齐本文 token。
2. 再把重复 hex / rgba 替换为 semantic token。
3. 再补组件级 token slot。
4. 最后再考虑是否接入真实前端组件层。

## 禁止

- 不在组件 CSS 中新增未登记颜色。
- 不为了局部视觉效果新增一次性 token。
- 不把 token 表写成业务文案或交接流水。
- 不引入组件库专属 token 命名，除非已决定接入该组件库。
