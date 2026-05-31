# AI 项目工程助手组件说明

> 用途：记录 AI 项目工程助手报告页的可复用组件、变体、状态和数据来源。
> 什么时候更新：组件命名、组件边界、交互状态、数据字段或视觉语义变化时。
> 不要写什么：一次性视觉反馈、完整页面截图、当前交接流水。

本文是报告页组件的设计契约。当前页面由 `templates/report/ai-project-report.html` 渲染静态 HTML，但组件命名、状态和数据源应与这里保持一致，方便后续迁移到 React / Vue / Web Components。

---

## 拆分原则

组件不按截图平铺拆，而按“行为和复用性”拆。

规则：
- 相同行为合并为一个组件，通过 variant / tone / state 区分。
- 图标优先作为 `icon slot`，不单独抽成组件。
- 页面级组合不提前当成基础组件。
- 当前 DOM 旧标记先兼容，后续模板改造时逐步统一。

---

## 数据源

组件数据源放在：

```txt
docs/design/ai-project-assistant/data.ts
```

组件契约放在：

```txt
docs/design/ai-project-assistant/components.ts
```

规则：
- 页面文案、文档项、状态值优先同步到 `data.ts`
- DOM 上用 `data-component` 标记组件名
- DOM 上用 `data-variant` 标记组件变体
- DOM 上用 `data-state` 标记组件状态
- 自动勾选但不可取消的项使用 `locked`

---

## 组件清单

| 组件 | 层级 | 用途 |
|------|------|------|
| `ProductHeader` | Pattern | 顶部品牌、标题、说明；不承载体检结果 |
| `SegmentedSwitch` | Primitive | 新项目 / 老项目等互斥切换 |
| `MetaPanel` | Deprecated Pattern | 历史状态卡；当前页面不在顶部使用 |
| `SectionHeading` | Pattern | 编号小标题和说明 |
| `SectionBlock` | Pattern | 绑定小标题和下方内容，统一标题到选项 / 表单 / 结果的间距 |
| `DocumentGrid` | Pattern | 项目文档卡片自适应网格 |
| `OptionCard` | Pattern | 个人开发、团队协作、启动策略等可选方案 |
| `ChecklistItem` | Pattern | 必选资料、体检项、缺口项 |
| `AddItemCard` | Pattern | 添加更多文档等空态操作入口 |
| `WritePlanPanel` | Pattern | 写入前的安全检查和骨架生成方案 |
| `TextField` | Primitive | 路径、仓库地址、只读文本字段 |
| `Button` | Primitive | 主操作和普通按钮 |

页面组合模式：

| 模式 | 用途 |
|------|------|
| `NewProjectWorkbench` | 新项目初始化工作台 |
| `OldProjectAuditWorkbench` | 老项目体检工作台 |

---

## ProductHeader

用途：展示品牌标识、页面标题和一句说明。

覆盖截图：`AI ENGINEERING KIT` + `AI 项目工程助手`。

结构：

```txt
BrandBadge
Title
Description
```

变体：

| Variant | 用途 |
|---------|------|
| `default` | 标准页面头部 |
| `compact` | 空间受限或嵌入式场景 |

状态：

| State | 要求 |
|-------|------|
| `default` | 标题和说明完整显示 |
| `truncated` | 标题不换成超大字，长说明允许换行 |

可访问性：
- 品牌 badge 不能替代 H1。
- 页面只能有一个主 H1。
- badge 图标装饰性时使用 `aria-hidden=true`。

---

## SegmentedSwitch

用途：展示互斥模式切换，比如“创建新项目 / 接手老项目”。

覆盖截图：Header 右侧一级入口 tabs。

变体：

| Variant | 用途 |
|---------|------|
| `header-pill-tabs` | Header 右侧一级入口 tabs，轻量胶囊外壳，选中项自身反色 |
| `two-options` | 两个选项 |
| `multi-options` | 三个及以上选项 |

状态：

| State | 要求 |
|-------|------|
| `default` | 未聚焦 |
| `selected` | 当前 tab：深色胶囊、白色文字、品牌色图标 |
| `hover` | 不改变尺寸 |
| `focus-visible` | 使用 focus token 外圈 |
| `disabled` | 禁止点击并降低对比度 |

行为：
- Header 内使用 `header-pill-tabs`，外层只允许轻量浅底和细边框，不能加厚重投影。
- 两个选项必须按 tab 语义实现：`role="tablist"` / `role="tab"` / `aria-selected` / `aria-controls`。
- 未选中 tab 位于同一个浅底胶囊容器里，必须有完整点击区域，不能只是文字按钮。
- 选中态不能改变容器高度。
- 每个选项同宽。
- 移动端优先缩短文案，不把按钮挤成多行。

---

## MetaPanel

用途：历史状态卡，用于展示当前报告状态、生成时间和关键分数。

当前规则：
- `MetaPanel` 不放在顶层 Header。
- `体检结果` 属于“接手老项目”流程的输出，必须放在 `OldProjectAuditWorkbench` 右侧结果区。
- 顶层 Header 只表达产品身份：品牌、标题、说明。

覆盖截图：历史顶部状态卡。

变体：

| Variant | 用途 |
|---------|------|
| `default` | 完整键值面板 |
| `compact` | 密集信息区 |
| `inline` | 少量元信息横向展示 |
| `status-card` | 面向普通用户的报告状态条 |

状态：

| State | 要求 |
|-------|------|
| `default` | 报告状态、生成时间、分数清楚可读 |
| `truncated` | 长时间文本不撑破面板 |
| `empty` | 缺值时显示 `-` 或明确空态 |

布局：
- `status-card` 使用标题区和分数区两段结构。
- 顶部状态卡不展示项目路径；项目路径只在 `TextField[path]` 或老项目“当前工作目录”区域展示。
- 数字值使用等宽字体或保持视觉对齐。
- 面向用户文案使用中文，避免显示为调试表格。

---

## SectionHeading

用途：统一报告页内的小标题、步骤编号和说明文案。

小标题规范：

| 项 | 规范 |
|----|------|
| 结构 | `kit-section-heading` 内固定使用 `kit-section-title`、`kit-step-num`、`kit-section-label`、可选 `kit-section-subtitle` |
| 槽位 | `data-slot="title"` / `step` / `label` / `description` |
| 字号 | `--text-14` |
| 字重 | `--font-strong` |
| 编号 | 20px 圆形徽标，数字居中 |
| 标题与编号间距 | `--space-8` |
| 说明文案 | `--text-12`，放标题下一行 |
| 标题与说明间距 | `--component-section-title-gap: 4px` |
| 小标题与内容间距 | `--component-section-content-gap: 16px` |
| 有编号说明的缩进 | 说明文案与标题文字对齐 |
| 无编号标题的缩进 | `plain` 标题文字与有编号标题的标题文字起点对齐 |
| 内容区缩进 | 不因编号额外缩进，避免形成独立序号轨道 |

变体：

| Variant | 用途 | 示例 |
|---------|------|------|
| `numbered` | 只有步骤编号和标题 | `1 协作模式` |
| `numbered-with-description` | 步骤编号、标题、说明文案 | `3 基础上下文资料` |
| `plain` | 无编号的小节标题，标题文字仍对齐有编号标题的文字线 | `自定义增强` |

可访问性：
- 编号必须是可读文本。
- `plain` 变体不能伪造步骤编号。
- 说明文案不能只作为 title 属性存在。
- 编号只服务当前小标题，不作为纵向时间线或导航栏使用。
- 不允许按左右栏覆盖编号颜色或位置；左右栏必须共用同一套 `SectionHeading` 样式。
- 所有带编号或符号徽标的小标题，必须保持“编号在左、标题文字在右”；说明文案与标题文字起点对齐。
- 静态 DOM 必须写完整 `data-component` / `data-variant` / `data-slot`，CSS 仅保留兜底，不能依赖浏览器默认 grid 排版。
- `SectionHeading` 到第一项内容的距离固定使用 `--component-section-content-gap`，覆盖资料卡片、来源卡片、路径框、上传区和体检项。
- 当 `SectionHeading` 放在已设置 `gap` 的配置容器中时，必须清掉自身 `margin-bottom`，不能叠加出双倍间距。

---

## SectionBlock

用途：把一个 `SectionHeading` 和它下面的选项、表单或结果列表绑定成同一组，避免标题和内容靠临时 margin 拼接。

覆盖截图：新项目模板选择向导、将生成这些项目文档、老项目代码来源、当前工作目录、体检结果。

结构：

```txt
SectionBlock
  SectionHeading
  Content
```

变体：

| Variant | 用途 | 示例 |
|---------|------|------|
| `with-options` | 标题下方是选择卡片组 | 代码来源、模板选择向导 |
| `with-form` | 标题下方是输入框、上传区或按钮 | 当前工作目录、Git 仓库地址 |
| `with-results` | 标题下方是结果、资料或体检列表 | 将生成这些项目文档、体检结果 |

间距规范：

| 距离 | Token | 要求 |
|------|-------|------|
| 标题到内容 | `--component-section-content-gap` | 固定 16px |
| 问题标题到选项 | `--component-question-content-gap` | 固定 8px |
| 多个问题块之间 | `--component-question-section-gap` | 固定 20px |
| 同组卡片之间 | `--component-workbench-list-gap` | 固定 12px |
| 同组控件之间 | `--component-workbench-control-gap` | 固定 16px |

规则：
- `SectionBlock` 内的 `SectionHeading` 必须清掉自身 `margin-bottom`，由父级 `gap` 管标题到内容。
- 新项目和老项目的“标题 + 下方选项 / 表单 / 结果”都必须使用这个结构。
- 选项列表必须是 grid / flex 这类显式布局，不能只写 `gap` 却保持 block 流。
- 不允许在标题、选项列表、表单控件上写 `style="margin-top:..."` 作为间距补丁。
- 内容区如果包含多个控件，使用 `kit-section-content` 管内部间距。

可访问性：
- 标题仍由 `SectionHeading` 表达，不用纯视觉分隔线代替标题。
- 互斥或多选卡片必须保留按钮语义和状态属性。
- 隐藏态小节必须完整隐藏标题和内容，不能只隐藏内容。

---

## DocumentGrid

用途：展示“将生成这些项目文档”里的必选文件和推荐文件，让文档卡片按容器宽度自动从 3 列、2 列收缩到 1 列。

覆盖截图：`必选文件：AI 接手最小上下文`、`推荐文件：产品和结构`、`推荐文件：流程和验收`。

结构：

```txt
DocumentGrid
  GroupHeader?
  DocumentCard[]
```

变体：

| Variant | 用途 | 示例 |
|---------|------|------|
| `required` | 必选文件网格 | `AGENTS.md`、`PROJECT.md`、`HANDOFF.md` |
| `optional-grouped` | 带分组标题的可选文件网格 | 产品、流程、记录、高级配置 |

布局规范：

| 项 | 规范 |
|----|------|
| 最小卡片宽度 | `--component-document-card-min: 176px` |
| 卡片间距 | `--component-document-grid-gap`，默认跟随 `--component-workbench-list-gap: 12px` |
| 桌面 | 容器足够时一排 3 个 |
| 中等宽度 | 自动变成一排 2 个 |
| 移动端 | 自动变成一排 1 个 |
| 分组标题 | `grid-column: 1 / -1`，必须跨整行 |
| 文档路径 | 单行省略，不能撑破卡片 |
| 查看入口 | 右上角浮动 `i-eye` 图标按钮，按钮尺寸 `--component-document-action-size: 22px`，图标尺寸 `--component-document-action-icon-size: 14px`，圆角跟随 checkbox 的 `--radius-xs` |

规则：
- `DocumentGrid` 使用 `auto-fit + minmax`，同时用三列宽度作为动态下限，保证最多 3 列、空间不足时自动退到 2 / 1 列。
- 必选文件和可选文件共用同一套网格规则，区别只在分组标题和选中状态。
- 卡片内部使用“勾选/复选框 + 标题路径 + 预览按钮 + 描述”的紧凑结构。
- 描述文案在窄卡片内放到标题下方，不右对齐。
- 预览入口使用图标库 `i-eye`，绝对定位在卡片右上角；不使用 emoji，不单独占一行。
- 预览入口默认态只展示深色 `i-eye` 图标，不显示外框和底色；hover 只出现轻量底色，不出现边框。
- 预览入口圆角必须与 checkbox 控件一致，统一使用 `--radius-xs`。
- 标题和路径区域为右上角按钮预留空间；描述文案恢复正文列宽度，不能被操作列长期挤窄。

可访问性：
- 预览按钮必须有 `aria-label`。
- 必选文件 locked 状态必须保留 `aria-disabled`。
- 复选框不能只靠颜色表达是否选中。

---

## OptionCard

用途：展示可选择方案，统一个人开发、团队协作、启动策略等卡片。

覆盖截图：个人开发 / 团队协作、启动策略卡。

属性：

| Prop | Value |
|------|-------|
| `tone` | `light` / `dark` |
| `state` | `default` / `selected` / `disabled` |
| `icon` | slot |
| `trailing` | `check` / `none` |

变体：

| Variant | 用途 |
|---------|------|
| `choice` | 协作模式选择卡，图标 + 标题 + 正文 + 选中勾 |
| `strategy` | 启动策略卡 |
| `source` | 老项目代码来源卡 |

状态：

| State | 视觉 |
|-------|------|
| `default` | 白底、浅边框 |
| `selected` | 白底、黑色选中边框、右侧选中图标 |
| `hover` | 边框或背景变化，不改变尺寸 |
| `focus-visible` | focus token 外圈 |
| `disabled` | 降低对比度，禁用 hover |

规则：
- `ChoiceCard` 和 `StrategyCard` 不再作为独立组件，统一归入 `OptionCard`。
- `choice` 和 `strategy` 使用同一套模块卡结构，区别只在文案密度和业务含义。
- 当前报告页的 `OptionCard` 选中态不使用整卡反色，避免视觉过重。

---

## ChecklistItem

用途：展示资料项、体检项、缺口项和检查结果。

覆盖截图：项目说明、工程结构梳理。

属性：

| Prop | Value |
|------|-------|
| `type` | `material` / `audit` / `gap` |
| `state` | `locked` / `optional-unchecked` / `optional-checked` / `pending` / `pass` / `warning` / `error` / `disabled` |
| `leadingIcon` | slot |
| `trailingIcon` | `check` / `warning` / `none` |

状态：

| State | 含义 | 视觉 |
|-------|------|------|
| `locked` | 系统自动勾选，用户不能取消 | 黑底绿勾，`aria-disabled=true` |
| `optional-unchecked` | 用户可选但未选 | 白底，空状态控件 |
| `optional-checked` | 用户已选 | 白底，绿色勾 |
| `pending` | 待检查 | 中性色图标 |
| `pass` | 通过 | 绿色状态 |
| `warning` | 需注意 | 橙色状态 |
| `error` | 阻断问题 | 红色状态 |
| `disabled` | 暂不可操作 | 灰色弱化 |

布局：
- 固定三列：`leadingIcon 34px` / `content minmax(0, 1fr)` / `trailingIcon 18px`。
- 左侧图标槽内的 glyph 统一为 `16px`，并在 `34px` 容器内居中。
- 列间距使用 `--component-checklist-column-gap: 14px`。
- 列表项内边距使用 `--component-checklist-padding: 12px`。
- 标题和说明垂直排列。
- trailing 状态固定在右侧，不挤压正文。
- 图标 slot 必须使用 `data-slot="leadingIcon"` / `content` / `trailingIcon`，不直接依赖裸 `span`。

兼容说明：
- 当前 DOM 中的 `RequiredMaterialItem` 是 `ChecklistItem[type="material"][state="locked"]` 的旧标记。
- 后续模板改造时统一迁移到 `ChecklistItem`。

---

## AddItemCard

用途：展示添加更多文档、上传文件、添加更多资料的虚线空态操作。

覆盖截图：虚线框 + 图标 + 文案。

布局规则：
- 宽度跟随所在内容区，必须与同组资料卡片同左边缘、同宽度。
- 高度使用 `--component-empty-action-min-height: 88px`。
- 上下内边距使用 `--component-empty-action-padding-block: 16px`。
- 左右内边距使用 `--component-empty-action-padding-inline: 16px`。
- 边框、圆角、背景必须复用 `--component-empty-action-*` token。
- 不作为窄按钮使用；窄按钮应使用 `Button`。
- 内部图标与文案居中，不影响外层对齐。
- 文案使用 `--text-13` + `--font-medium`，避免比资料卡片标题更重。
- 加号控制点使用 `--component-add-size: 32px`，只作为轻提示，不作为主按钮。
- `document` 和 `upload` 是同一个虚线空态操作区，只允许替换图标和文案，不允许改外框样式和宽度。
- 带说明文案的变体允许自然增高，优先保证上下内边距一致，不强行压进 88px。

变体：

| Variant | 用途 |
|---------|------|
| `document` | 添加文档 |
| `upload` | 上传压缩包 |
| `generic` | 添加任意项目 |

状态：

| State | 要求 |
|-------|------|
| `idle` | 虚线边框、浅色加号 |
| `copy` | 复制补齐文档命令，不直接执行本机操作 |
| `planned` | 保留入口但标记为待接入 |
| `hover` | 边框和加号转品牌色 |
| `focus-visible` | focus token 外圈 |
| `disabled` | 灰底、不可点击 |

兼容说明：
- `AddDocumentButton` 是旧别名；当前 DOM 必须使用 `AddItemCard[variant="document"]`。
- `UploadDropZone` 是旧别名；上传区当前也归入 `AddItemCard[variant="upload"]`。
- 该组件视觉上是卡片式空态入口，不命名为 `Button`。
- 如果已有命令行工具能承接动作，使用 `copy` 状态，并明确复制后需要到终端运行。
- 未实现真实添加或上传流程时必须使用 `planned` 状态和 `待接入` 标签，不伪装成可执行功能。

---

## WritePlanPanel

用途：新项目把工程文档写入目录前，先展示“写入位置检查 + 骨架生成方案 + 确认操作”。

覆盖截图：新项目底部操作区，从“选择目录并生成骨架”进入的写入前安全方案。

变体：

| Variant | 用途 |
|---------|------|
| `directory-organize` | 选择本机目录后生成骨架写入方案 |

状态：

| State | 要求 |
|-------|------|
| `ready` | 已生成方案，等待用户确认 |
| `writing` | 正在写入，按钮保持宽度和禁用态 |
| `error` | 错误显示在操作区附近 |
| `success` | 切换到写入结果列表 |

规则：
- 该组件必须出现在实际写入之前，不能把“选择目录”和“生成骨架”合并成一个不可逆按钮。
- 摘要必须明确三类处理：同名文件、相似资料、缺失文件。
- 同名文件默认不覆盖，只能写成 `.template.md` 参考版本。
- 相似资料必须让用户选择合并来源；合并时原文件保留，标准文件内追加原内容。
- 主操作只允许一个：`确认生成骨架`。
- 次操作允许 `重新选择目录` 和 `下载空白模板 zip`。
- 错误文案使用靠近按钮的 `role="status"` 区域，不弹全局 alert。
- `hover` / `active` / `focus-visible` 不改变面板尺寸。

---

## TextField

用途：展示和输入路径、仓库地址、命令等文本。

覆盖截图：项目路径输入框。

变体：

| Variant | 用途 |
|---------|------|
| `text` | 普通文本 |
| `path` | 路径，可带本地目录选择入口 |
| `code` | 命令或代码片段 |

状态：

| State | 要求 |
|-------|------|
| `default` | 可输入 |
| `readonly` | 可复制，不可编辑 |
| `selected` | 已通过本地目录选择器选择目录 |
| `focus` | 使用 focus token |
| `invalid` | 错误信息靠近控件 |
| `disabled` | 不可交互，保留可读说明 |

规则：
- 路径和命令使用 mono 字体。
- 长文本允许截断或横向滚动。
- `path` 变体可包含 `trailingAction="directoryPicker"`，右侧使用文件夹图标按钮触发本地目录选择。
- 目录选择按钮必须有 `aria-label="选择本地目录"`，且 `hover/active/focus-visible` 不改变字段尺寸。
- 浏览器不会暴露完整本机绝对路径，选中目录后只能展示目录名或相对路径，不伪造 `/Users/...` 路径。
- 错误态不改变控件高度以外的页面结构。

---

## Button

用途：主操作和普通操作。

覆盖截图：开始体检按钮。

变体：

| Variant | 用途 |
|---------|------|
| `primary` | 主操作 |
| `secondary` | 次操作 |
| `ghost` | 轻操作 |

状态：

| State | 要求 |
|-------|------|
| `default` | 可点击 |
| `copy` | 复制命令或话术，不直接执行本机操作 |
| `hover` | 背景或文字变化，不改变尺寸 |
| `focus-visible` | focus token 外圈 |
| `active` | 只改变颜色或阴影，不位移、不缩放、不改变边框宽度 |
| `loading` | 保持按钮宽度，显示加载状态 |
| `disabled` | 禁止点击，降低对比度 |

规则：
- 按钮可包含图标 slot。
- 主操作一次只出现一个最强视觉层级。
- 主按钮固定最小高度 `44px`，使用 `10px / 18px` padding 和稳定 line-height。
- `hover` / `active` / `focus-visible` 不允许改变宽高、padding、border-width、margin 或 transform。
- 禁用浏览器默认按钮外观，避免点击时出现平台默认下沉效果。
- 所有以 `button` 承载的卡片式控件也遵守同一状态规则，包括 `ModeCard`、`StartCard`、`OptionCard`、`AddItemCard` 和 `CopyButton`。
- 静态 HTML 报告里的本机操作按钮必须优先做成 `copy` 状态，说明“复制命令后到终端运行”，不能暗示网页会直接执行 shell。
- loading 文案不能导致按钮宽度跳动。

---

## Page Compositions

### NewProjectWorkbench

用途：新项目初始化。

结构：

```txt
ProductHeader
SegmentedSwitch
WorkbenchLayout
  OptionCard group
  ChecklistItem group
  AddItemCard
  WritePlanPanel
```

要求：
- 必选资料自动勾选。
- 用户能看懂下一步要复制什么给 AI。
- 面板内边距、区块间距、列表间距必须使用 `WorkbenchLayout` token。
- 自定义增强入口不抢必选资料视觉。
- 写入项目之前必须先展示 `WritePlanPanel`，说明同名、相似命名和缺失文件的处理方式。

### OldProjectAuditWorkbench

用途：老项目体检。

结构：

```txt
ProductHeader
SegmentedSwitch
WorkbenchLayout
  Left: SectionHeading[1] + Source OptionCard group
  Left: SectionHeading[2] + source config / TextField / AddItemCard / Button
  Right: SectionHeading[3] + ChecklistItem group
```

要求：
- 明确代码来源。
- 来源对应的配置跟随来源选项放在左栏，不放到右栏。
- 明确体检包含哪些内容。
- 主按钮只有一个。
- 面板上下左右留白、来源列表间距、右侧表单控件间距必须复用 `WorkbenchLayout` token。
- 老项目页的关键垂直距离必须按以下映射执行：标题说明到内容 `16px`，来源卡片组到来源配置组 `32px`，配置控件之间 `16px`。

---

## 维护要求

当报告页新增或调整组件时：

1. 先在 `components.ts` 定义组件名、变体和状态
2. 再在 `data.ts` 定义数据字段和示例数据
3. 更新本文件说明
4. 更新 `docs/design/component-index.md`
5. 如果改到模板 DOM，再同步 `templates/report/ai-project-report.html`
6. 运行 `bash scripts/check-template-sync.sh . --strict`
