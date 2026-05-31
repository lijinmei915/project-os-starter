# 布局规范

> 用途：定义 Project OS 报告页和后续工作台界面的布局结构、栅格、响应式和信息层级。
> 什么时候更新：页面结构、分栏比例、响应式断点、表单布局或列表密度变化时。
> 不要写什么：一次性页面截图、视觉装饰偏好、组件实现流水。

当前布局规范以 AI 项目工程助手报告页为基准，后续新增页面优先复用这些规则。

---

## 总原则

- 先确定信息层级，再确定视觉装饰。
- 页面首屏必须让用户知道当前任务、当前选择和下一步操作。
- 同级区块使用稳定间距，不因内容多少改变结构。
- 表单、列表、卡片都要预留空态、错态、加载态和禁用态位置。
- 可点击区域的尺寸、hover、focus-visible 不应导致布局跳动。
- 可点击区域的 `active` 状态不允许改变 transform、margin、padding、border-width 或尺寸。

---

## 页面类型

| 页面类型 | 目标 | 布局方式 |
|----------|------|----------|
| 报告页 | 展示分数、缺口和可复制操作 | 旧报告概览最大 `1280px`，模块网格 |
| 工作台页 | 让非技术用户选择新项目 / 老项目流程 | `960px` 居中，单主卡片，左右分栏 |
| 配置页 | 选择模式、资料、启动策略 | 左侧选择，右侧结果或预览 |
| 详情页 | 阅读文档结构、报告细项 | 上方摘要，下方列表或模块卡片 |

---

## Page Shell

默认页面壳：

| Token | Value | 用途 |
|-------|-------|------|
| `--layout-report-max` | `1280px` | 报告概览页最大宽度 |
| `--layout-workbench-max` | `960px` | AI 工程助手工作台最大宽度 |
| `--layout-page-gutter` | `32px` | 页面左右安全边距 |
| `--space-48` | `48px` | 顶部留白 |
| `--space-72` | `72px` | 底部留白 |

规则：
- 工作台页面使用 `max-width: var(--layout-workbench-max)` 居中。
- 宽报告概览使用 `max-width: var(--layout-report-max)`，但不把正文拉得过宽。
- 页面外层不套多层卡片；只有主工作区、重复项、模态和工具面板可以使用卡片。
- 移动端页面左右安全边距不得小于 `16px`。

---

## 工作台布局

AI 项目工程助手首屏使用工作台布局：

```txt
Header
Project Switch
Main Workbench Card
  Left Panel  5/12
  Right Panel 7/12
```

规则：
- 主工作台用 `12` 栅格。
- 左栏放选择、策略、入口。
- 右栏放必选资料、预览、输出结果。
- 左右栏之间用视觉分隔即可，不额外嵌套卡片。
- 栅格内容变化时，不改变栏宽。
- `780px` 以下变成单列，左栏在上，右栏在下。

当前比例：

| 区域 | 桌面 | 移动 |
|------|------|------|
| 左侧选择区 | `span 5` | `1fr` |
| 右侧资料区 | `span 7` | `1fr` |
| 主卡片圆角 | `--radius-xl` | `--radius-lg` 或保持 |
| 内边距 | `32px / 32px` | `24px / 20px` |

---

## 工作台间距

工作台内的黄色框类距离统一使用组件 token，不直接写散落的 `margin` / `padding`。

| 距离 | Token | 桌面值 | 移动值 | 适用 |
|------|-------|--------|--------|------|
| 外框上下内边距 | `--component-workbench-panel-padding-block` | `32px` | `24px` | 左栏、右栏顶部和底部留白 |
| 外框左右内边距 | `--component-workbench-panel-padding-inline` | `32px` | `20px` | 左栏左侧、右栏右侧安全边距 |
| 大区块纵向间距 | `--component-workbench-section-gap` | `32px` | `24px` | `代码来源` 到下一组、`当前工作目录` 到 `体检内容` |
| 列表项间距 | `--component-workbench-list-gap` | `12px` | `12px` | 来源卡片、资料卡片、体检项之间 |
| 表单控件间距 | `--component-workbench-control-gap` | `16px` | `16px` | 路径框、按钮、上传区等控件之间 |
| 项目文档卡片最小宽度 | `--component-document-card-min` | `176px` | `176px` | 必选文件、推荐文件自适应列数 |
| 项目文档网格间距 | `--component-document-grid-gap` | `12px` | `12px` | 项目文档卡片之间 |
| 小标题内部间距 | `--component-section-title-gap` | `4px` | `4px` | 标题到说明文案 |
| 小标题到内容间距 | `--component-section-content-gap` | `16px` | `16px` | 说明文案到第一张卡片、路径框、体检项 |
| 问题标题到选项 | `--component-question-content-gap` | `8px` | `8px` | 向导题目到选项组 |
| 问题块之间 | `--component-question-section-gap` | `20px` | `20px` | Q1 到 Q2、Q2 到 Q3 |

规则：
- 左栏和右栏的首个标题距离面板顶部必须一致。
- 右栏控件距离右侧边界必须使用同一套 inline padding。
- 最后一项到底部边界的距离必须使用 block padding，不能靠内容自然撑开。
- 列表项之间只使用 list gap，不在单个卡片上额外加 margin。
- `SectionHeading` 到它后面第一个内容组件之间只使用 `--component-section-content-gap`，不在内容组件上补 `margin-top`。
- 如果父容器已经用 `gap` 管理标题和内容间距，`SectionHeading` 自身的 `margin-bottom` 必须归零，避免 16px + 16px 叠加成 32px。
- 标题和下方选项 / 表单 / 结果必须优先包在 `SectionBlock` 中；不能让标题是一个孤立 DOM、内容另靠父级 `gap` 或 inline margin 拼接。
- 来源选项列表和来源配置区之间使用 `--component-workbench-section-gap`，因为它们是两个业务小节，不是同一个标题下的内容。
- `kit-left` / `kit-right` 是布局分栏，不和内容卡片 class 叠加使用，避免 padding 被覆盖。

---

## Header 布局

Header 负责建立当前产品身份，不承载具体流程结果。

结构：

```txt
Brand / Title / Description        Primary Mode Switch
```

规则：
- 顶部左侧放品牌、标题和说明；右侧放“创建新项目 / 接手老项目”一级入口切换。
- 顶部不放 `MetaPanel` 或体检分数，避免把“体检结果”误表达成和“创建新项目 / 接手老项目”同级。
- `体检结果` 属于“接手老项目”流程输出，必须放在老项目右侧结果区。
- Header 右侧切换器使用轻量胶囊 tab 组件，允许浅底细边框，不加厚重投影。
- 页面 H1 不进入卡片。
- 小型工作台标题使用 `--text-32`，不要使用 hero 级大字。

---

## Segmented Control 布局

用于“新项目 / 老项目”这类互斥入口。

规则：
- Header 入口切换使用 `header-pill-tabs` 变体：tab 组右对齐，浅底胶囊外壳，两个选项都有明确点击区域。
- 宽度可小于容器，不强行满屏。
- 每个选项同宽。
- 选中态不改变按钮尺寸。
- 未选中 tab 不能只像文字链接，必须留在浅底胶囊热区内。
- 图标和文字间距使用 `--space-8`。
- 移动端仍保持一行；如果文案过长，优先缩短文案，不换成多行按钮。

---

## Section 布局

小节标题统一使用 `SectionHeading`，标题与下方内容统一由 `SectionBlock` 承载。

规则：
- 编号小节：编号、标题在同一行。
- 带说明的小节：说明文案放标题下一行，并与标题文字对齐。
- 编号不占用内容区左侧轨道，后续控件从容器左侧开始。
- 左栏、右栏、配置区都复用同一个 `SectionHeading` 组件，不按所在栏位改编号样式。
- 无编号小节：标题文字与有编号小节的标题文字起点对齐，但后续内容区不占用编号空间。
- 小节之间的垂直距离使用 `--space-32`。
- 标题与说明的距离使用 `--component-section-title-gap: 4px`。
- 小节标题块到底下内容组件的距离使用 `--component-section-content-gap: 16px`。
- 同一个小节内不能同时使用 `SectionHeading margin-bottom` 和父容器 `gap` 表达同一段距离。
- `SectionBlock` 必须包含 `SectionHeading` 和内容区，内容区可以是选项列表、表单控件组、资料列表或结果列表。
- 新项目向导、模板文档预览、老项目代码来源、当前工作目录、上传 zip、体检结果都属于 `SectionBlock` 场景。
- 问题型内容使用 `kit-wizard-steps` 管多个问题的 20px 间距，单个问题用 `kit-wizard-q` 管题目到选项的 8px 间距。
- 选项列表必须显式使用 grid / flex；不允许只声明 `gap` 但保持默认 block 流，避免选项堆叠贴在一起。

间距映射：

| 场景 | 使用 |
|------|------|
| SectionHeading 到内容区 | `--component-section-content-gap` |
| `代码来源` 说明到第一张来源卡片 | `--component-section-content-gap` |
| `当前工作目录` 说明到路径框 | `--component-section-content-gap` |
| `体检将包含以下内容` 说明到第一条体检项 | `--component-section-content-gap` |
| 向导问题标题到选项 | `--component-question-content-gap` |
| 向导多个问题块之间 | `--component-question-section-gap` |
| 代码来源卡片组到当前工作目录配置组 | `--component-workbench-section-gap` |
| 路径框到 `开始体检` 按钮 | `--component-workbench-control-gap` |
| 新项目模板列表到操作区 | `--component-workbench-section-gap` |
| `选择目录并生成骨架` 到 `下载空白模板 zip` | `--component-workbench-list-gap` |
| 骨架生成方案摘要行之间 | `--component-workbench-list-gap` |
| 骨架生成方案到确认按钮组 | `--component-workbench-control-gap` |

---

## 表单与配置区

用于启动策略、代码来源、文档选择、路径输入。

规则：
- 字段默认“标题在上，控件在下”。
- 一组互斥选项使用 card radio 或 segmented control。
- 本地目录字段使用 `TextField[path]`，右侧允许放一个固定 `32px` 的目录选择 action，不改变字段高度和整体对齐。
- 控件的宽度跟随容器，不用内容宽度撑开。
- 长路径、仓库地址、命令使用 monospace，并允许截断或横向滚动。
- 表单说明文案放在标题下，不放在控件内部。

配置区推荐结构：

```txt
SectionHeading
OptionGroup
HelperText
Result / Preview
```

状态要求：
- 默认态：可读、可选。
- hover 态：只改变边框或背景，不改变尺寸。
- focus-visible：使用 token 外圈。
- disabled：降低对比度，但保留可读说明。
- error：错误文案放控件下方，不顶开上方标题。

---

## 列表与卡片

列表用于资料项、体检项、模块结果。

规则：
- 项目文档列表使用 `DocumentGrid`，按容器宽度自动形成 3 / 2 / 1 列。
- `DocumentGrid` 的分组标题必须跨整行，不能占一个卡片列。
- 文档卡片路径必须单行省略，避免长路径撑破卡片。
- 文档卡片的查看入口浮动在右上角，使用图标库 eye 图标，不单独占一行；按钮为 22px，图标为 14px，圆角与 checkbox 一致；默认只显示图标，hover 才出现轻量底色；标题和路径为按钮预留空间，描述文案不被操作列持续挤窄。
- 资料项使用两列：状态控件 / 内容。
- 可选右侧操作时使用三列：状态控件 / 内容 / 操作。
- 列表项高度由内容决定，但图标列宽固定。
- 添加资料入口使用 `AddItemCard`，必须与同组资料卡片同宽、同左边缘。
- 写入前骨架生成方案使用 `WritePlanPanel`，必须跟随所在右栏宽度，不使用浮层或全局弹窗。
- `WritePlanPanel` 内部摘要列表使用同组列表间距，按钮组使用控件间距，不再用临时 inline margin。
- 上传入口和添加资料入口都属于虚线空态操作区，统一使用 `EmptyAction` 外框 token。
- `EmptyAction` 优先保证上下内边距一致；内容多一行时允许高度自然增加。
- `ChecklistItem` 使用固定三列图标槽，leading / content / trailing 在整卡中垂直居中。
- 重复卡片之间使用 `--space-10` 到 `--space-16`。
- 不在卡片里再套卡片。
- 通过 / 缺口 / 禁用状态必须有固定位置，不让文字挤占状态位置。

密度：

| 场景 | 推荐密度 |
|------|----------|
| 资料项 | 紧凑，`--space-10` 内边距 |
| 启动策略 | 中等，`--space-16` 到 `--space-18` |
| 报告模块 | 中等，保证可扫描 |
| 命令列表 | 紧凑，允许横向滚动 |

---

## 报告模块网格

工程报告细项使用模块网格。

规则：
- 桌面端优先 `3` 列。
- 中等宽度可降为 `2` 列。
- `780px` 以下降为单列。
- 模块标题、进度条、说明、列表顺序固定。
- 分数或状态变化不能改变模块卡片宽度。
- 模块内列表项优先使用短句，避免一项撑高整个网格。

---

## 预览区

用于文档结构预览、路径预览、生成话术预览。

规则：
- 预览区应靠近触发它的选择区。
- 桌面端可以 sticky，但不能挡住内容。
- 预览内容使用固定顺序：标题、文件路径、栏目、说明。
- 文件路径用 monospace 或 pill，不使用普通正文样式。
- 如果没有可预览内容，显示空态文案，不留空白面板。

---

## 响应式规则

当前断点：

| Breakpoint | 行为 |
|------------|------|
| `> 780px` | 桌面分栏、模块网格、meta 右侧 |
| `<= 780px` | 所有主要 grid 单列 |

移动端规则：
- Header、指标、模块网格、工作台左右栏全部单列。
- 主操作按钮保持可点击宽度，不挤成窄按钮。
- 文本不使用 viewport 缩放字号。
- 横向很长的命令和路径允许横向滚动。
- 工作台切换、启动策略和资料项不得互相覆盖。

---

## 状态占位

每个布局都要考虑：

| 状态 | 布局要求 |
|------|----------|
| 默认态 | 内容完整显示 |
| 加载态 | 保留容器尺寸，不突然塌陷 |
| 空态 | 给一句明确文案和下一步 |
| 错误态 | 错误信息靠近出错控件 |
| 禁用态 | 保持说明可读，不触发 hover 误导 |
| 成功态 | 状态位置固定，不把标题挤开 |

---

## 禁止

- 不用视觉装饰代替信息层级。
- 不把页面大区块都做成漂浮卡片。
- 不在卡片内部再套卡片。
- 不让 hover、focus、选中态改变元素尺寸。
- 不让长路径、命令、标题撑破容器。
- 不新增没有用途的双栏或三栏。
