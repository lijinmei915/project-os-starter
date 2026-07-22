---
layer: knowledge
type: spec
last_verified: 2026-07-21
depends_on: [docs/DESIGN_STANDARDS.md, desktop/src/styles/theme.css]
teaches: "OmniDesk Desktop CSS token 的层级、命名、状态语义和使用边界"
use_when: "AI 新增或调整 OmniDesk Desktop 的颜色、字号、间距、圆角、工具栏或状态样式时"
---

# Desktop Token 规范

> 用途：定义 OmniDesk Desktop 的视觉 token 语义和使用边界。
> 什么时候更新：新增主题能力、语义颜色、控制尺寸或可复用组件 token 时。
> 不要写什么：已退役报告页 token、与实际 CSS 脱节的数值表或组件实现流水。

## 唯一数值来源

`desktop/src/styles/theme.css` 是当前 token 数值的唯一来源。本文定义语义和约束；新值先在 CSS token 层建立，再由组件引用。`desktop/src/styles.css` 只组合领域样式，不定义视觉值。

## Token 层级

| 层级 | 前缀 / 示例 | 责任 |
|---|---|---|
| 基础色阶 | `--desktop-gray-*` | 深浅主题所需的基础表面和中性色 |
| 主题色 | `--desktop-theme-*`、`--desktop-accent-*` | 用户主题及其派生强调色 |
| 语义 | `--desktop-surface-*`、`--desktop-text-*`、`--desktop-border-*` | 表面、文本、边框与可访问状态 |
| 状态 | `--desktop-state-*`、`--desktop-badge-*` | hover、selected、success、warning、danger 等交互反馈 |
| 布局与控制 | `--desktop-layout-*`、`--desktop-toolbar-*`、`--desktop-space-*` | 稳定轨道、工具栏、间距与控件尺寸 |
| 兼容 alias | `--bg`、`--panel`、`--text`、`--accent` | 只为既有样式过渡；新代码优先使用 `--desktop-*` |

## 使用规则

- 组件不得直接新增 hex、rgba、裸字号、裸间距或裸圆角；先确认没有合适 token，再在 `theme.css` 的正确层级新增。
- 表面使用 `--desktop-surface-*`，文字使用 `--desktop-text-*`，边框使用 `--desktop-border-*`；不要跨层借用颜色表达语义。
- 选中和 hover 使用 `--desktop-state-*`，而非临时改变组件尺寸、阴影或透明度。
- 信息、警告和危险是功能语义，不随用户主题色变化；成功和当前选择可使用主题派生 token。
- 纯图标按钮、工具栏和标签必须使用相应尺寸 token，确保 hover、焦点与动态内容不会改变布局。
- 浅色主题必须覆盖所有使用的语义 token；不要依赖深色原始色值在浅色模式下“看起来还可以”。

## 排版与间距

- 普通工作台正文使用 `--desktop-text-body`，紧凑元信息用 `--desktop-text-meta` 或 `--desktop-text-caption`，分区标题用 `--desktop-text-title`。
- 字体权重使用 `--desktop-font-*`；不要用 viewport 宽度缩放字体。
- 间距优先使用 `--desktop-space-*` 或共享 `--space-*`；列表、工具栏和面板的间距由对应 component/layout token 管理。
- 圆角使用 `--radius-*` 或已定义的布局 token。页面区段不是卡片，重复项和真实工具面板的圆角不超过现有组件规范。

## 验收

- 搜索组件样式，确认新增视觉值都能追溯到 `theme.css`。
- 同时检查深色和浅色主题下的文本、边框、focus 与状态对比度。
- 运行 `npm --prefix desktop test`；改动 token 或样式模块时运行 `npm --prefix desktop run web:build`，并对原生窗口改动运行 `npm --prefix desktop run test:native`。
