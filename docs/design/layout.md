---
layer: knowledge
type: spec
last_verified: 2026-07-21
depends_on: [docs/DESIGN_STANDARDS.md, docs/design/tokens.md, desktop/src/styles.css]
teaches: "OmniDesk Desktop Workbench 的布局层级、密度、响应式和状态呈现规则"
use_when: "AI 调整 Desktop Workbench、对话、终端、项目列表或响应式布局时"
---

# Desktop 布局规范

> 用途：约束 OmniDesk Desktop Workbench 的真实布局与状态呈现。
> 什么时候更新：改变工作台分栏、主要工作面、响应式规则或紧凑控制密度时。
> 不要写什么：已退役报告页、旧项目向导或单次截图的像素记录。

## 布局边界

OmniDesk 是本地工程工作台，不是报告页面。主界面应让用户持续看见当前项目、对话/任务主线、执行证据和必要的上下文，而不是用营销 Hero、评分大屏或嵌套卡片填充空白。

- 根布局由 `desktop/src/styles/theme.css` 的 `--desktop-layout-*` token 决定。
- 实现规则按领域归属 `styles/workspace.css`、`conversation.css`、`terminal.css` 与 `provider-rail.css`；`styles.css` 只负责组合顺序。
- 页面区块不使用浮动大卡片；卡片只用于重复任务、文件、证据或配置项。

## 桌面工作台

```txt
Topbar: 当前项目 / Runtime 状态 / 全局工具
Workbench
  Left rail: 项目、工作区导航、会话与任务入口
  Canvas: 当前对话、任务、文件或工作区工作面
  Right rail: 项目上下文、Provider、审批与执行证据
Status bar: 非阻塞的运行提示
```

- 顶栏和状态栏使用固定高度 token；左、右栏使用稳定轨道，不随文字或 hover 改变宽度。
- 中央 Canvas 承载单一当前工作面。工作区切换、任务详情和文件预览复用该区域，不能同时争夺焦点。
- 右栏只呈现当前工作面需要的上下文与证据；没有内容时应收起、显示空态或让出空间，不能留“占位信息”。
- 分栏、标签页、工具栏和列表项的 hover/focus/selected 状态不得改变 padding、border-width、轨道尺寸或文本位置。

## 对话与任务

- 对话时间线按发生顺序展示用户意图、Agent 阶段、审批、Patch、检查和最终结果；失败证据与修复草稿属于同一任务时间线。
- 输入框始终贴近对话底部。附件以紧凑、可移除标签放在输入区域内，不能挤压正文或单独占用一整行工具栏。
- 流式生成时保留可读的进行中状态，并允许取消；请求结束、失败或取消后必须恢复可输入状态。
- 需要独立确认的 Patch 与检查使用明确的确认面，而不是把 Provider 返回成功显示成任务完成。
- 终端是受控执行证据的补充工作面：保持等宽输出、稳定滚动和复制能力，不将终端输出伪装成对话结论。

## 列表、工具栏与弹窗

- 导航与会话列表优先用紧凑单行条目；操作图标仅在 hover 或键盘 focus 时出现，不能提前为其留出大块空白。
- 每个工作面首屏只保留一个明确主操作；状态、说明和次级操作不与主操作竞争。
- 图标按钮必须有可访问名称与 Tooltip；纯文本命令仅用于用户能明确理解的动作。
- 弹窗用于不可逆操作、权限确认或需要聚焦完成的编辑。普通浏览、详情和可逆选择留在当前工作面。

## 响应式与窗口约束

- 紧凑窗口优先隐藏或折叠次级 rail，Canvas 保持可用宽度；不能通过缩小正文字号解决溢出。
- 控件文字必须单行可读；无法容纳时缩短文案、移动到菜单或改为图标并保留 Tooltip。
- 路径、命令与 diff 使用等宽字体，可截断并提供完整值的复制或查看入口。
- 所有固定高度工具栏、标签、按钮和终端控件使用 token 定义尺寸，动态内容不得造成跳动。

## 验收

- 在桌面与紧凑窗口中，文字、按钮、证据与输入区不重叠。
- 选中、hover、焦点和加载状态不引起布局位移。
- 使用 `npm --prefix desktop test` 验证 UI 领域契约；布局实现变化再运行 `npm --prefix desktop run web:build` 与原生 smoke。
