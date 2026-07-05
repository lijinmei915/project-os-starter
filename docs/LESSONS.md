---
layer: knowledge
type: log
last_verified: 2026-06-04
teaches: "历史踩坑记录、错误模式和已确立的避坑约束"
use_when: "AI 即将做类似操作前检查是否有已知的坑、或犯错后需要记录新教训时"
---

# 错误模式记录

> 用途：记录错误复盘和新增约束，回答“踩过什么坑、以后怎么避免”。
> 什么时候更新：误删、误改、误判、测试跑偏、规则失效时。
> 不要写什么：成功经验、普通进展、重复的 changelog 内容、当前状态摘要。
> 每次犯错后立即记录。
> 格式：犯的错 / 根本原因 / 加了什么规则。

---

## Project OS / 给新项目赋能

### 2026-06-06 用 Project OS 赋能新项目时，没有生成 CLAUDE.md，导致全局 skill 抢先

**犯的错**：用 `kb-generate-docs` 给 fx-ui 新项目建了 AGENTS/PROJECT/HANDOFF 知识层，但没有生成 `CLAUDE.md`（Claude Code 适配文件）。用户在新会话里说"生成一个列表页"，`intent-clarifier` 全局 skill 按词语模式抢先触发，问了一堆 fx-ui 里早就有答案的问题（技术栈、功能范围），完全绕过了我们建的知识层。

**根本原因**：`AGENTS.md` 的护栏在 AI **读文件之后**才生效；`intent-clarifier` 等全局 skill 按**词语模式匹配**，发生在读文件**之前**。没有 `CLAUDE.md` 就没有"进门先读项目规则"的显式指令，Claude Code 不知道该抑制全局 skill。

**加了什么规则**：
- `kb-generate-docs` 给新项目赋能时，必须同时生成 `CLAUDE.md`（Claude Code 适配），不只是 AGENTS/PROJECT/HANDOFF。
- `CLAUDE.md` 里要明确两件事：①进入项目必读哪三个文件；②技术栈/规则已锁定的情况下，不要触发通用澄清流程。
- 验收赋能是否成功的标准之一：**在新会话里说一个具体任务，看 AI 是直接干还是触发了通用澄清**。触发了通用澄清 = 赋能不完整。

---

## 设计 / 前端

### 2026-06-04 抽 tokens.css 后 tab 滑块动画失效

**犯的错**：把 `--transition-normal: .25s ease` 抽进 `tokens.css` 后，tab 滑块的平滑滑动消失了，点击瞬间硬跳。

**根本原因**：滑块用了 `transition: transform var(--transition-normal, .3s) cubic-bezier(.4,0,.2,1)`。token 值自带 `ease` 关键字，展开后变成 `transform .25s ease cubic-bezier(...)` —— 一条 transition 里出现两个缓动函数（`ease` 和 `cubic-bezier`），整条声明非法被浏览器丢弃，退化成无动画。抽 token 前 token 未定义，走 `.3s` 兜底，反而合法。

**加了什么规则**：
- transition 速记里如果还要单独指定缓动曲线，时长 token 只放纯时长（如 `.25s`），不要把 `ease` 等缓动关键字塞进时长 token。
- 改动共享 token 后，必须回归所有引用该 token 且自带缓动函数的动画。
- 滑块改回 `transition: transform .3s cubic-bezier(.4,0,.2,1)`，不复用含缓动关键字的 token。

### 2026-06-04 选中态样式多次漂移、与基准卡片不一致

**犯的错**：Q1/Q2 向导卡片和代码来源卡片的选中态被反复改成 teal 绿边框 + box-shadow ring，和「生成工程契约」下的 kit-option 基准卡片（中性深色 1px 边框）不一致；滑动时被点击按钮还闪白底。

**根本原因**：（1）没有把「选中态视觉」当成一套统一规范，每次单独调一个组件就漂移；（2）box-shadow ring 叠在 1px border 上视觉变粗；（3）`button:hover` 白底没排除 `.is-active`，滑动途中和滑块叠加闪白。

**加了什么规则**：
- 选中态以 kit-option 为基准：`border-color: --color-surface-inverse` + `background: --color-surface-panel`，1px 边框、无 box-shadow ring。
- hover 反馈用 `:not(.is-active)` 限定，激活项不再叠 hover 背景。
- 改任一卡片选中态时，对照基准卡片确认边框色/宽度/有无 ring 一致。

---

## Project OS / 路由

### 2026-07-04 默认暴露任务拆解和审批流，导致对话不像主流聊天

**犯的错**：用户只是追问桌面端为什么不能像主流对话一样自然回答时，系统默认展示大块 `Steps` / `Read` / `Changes` / `Checks` 和 `waiting approval`，把内部工程流程暴露成了用户对话主体。

**根本原因**：旧规则把“协作安全”过度收紧成“任何改动前都要先方案并等待确认”，没有区分普通对话、低风险编辑和高风险副作用动作。

**加了什么规则**：
- 默认按主流对话方式回应：先直接回答或处理当前问题，不主动拆任务、不展示内部路由、Steps、Checks 或审批流。
- 只有删除/覆盖文件、发布/push、批量重构、执行有副作用命令、需求明显不清或用户明确要求“先给计划”时，才先说明方案并等待确认。
- 分发模板和 Codex adapter 同步这套交互口径，避免新项目继续继承旧审批式对话。

### 2026-05-10 INSTALL / INIT 停在安装总结，没有继续进入启动方式选择

**犯的错**：空目录里用户说“帮我初始化这个项目，接入 Project OS”时，系统完成安装后停在安装总结，没有继续进入 `INIT` 的启动方式选择。

**根本原因**：INSTALL 规则只约束了“先安装和分类”，但没有写死“当结果是 `INSTALL / INIT` 时，安装完成后必须继续进入 INIT”。

**加了什么规则**：
- `AGENTS.md` 增加 `INSTALL / INIT` 的固定第一响应和继续进入 INIT 的要求。
- `project-setup/SKILL.md` 增加 continuation hard rule。
- `references/install.md` 明确安装完成后同一轮继续进入 INIT start mode。
- 各工具 adapter 同步这条行为。

### 2026-05-06 CLI print 模式没有稳定展示 skill banner

**犯的错**：只看语义时，Case 7 “帮我写一个登录页”虽然行为进入 frontend，但输出没有显式 `frontend` 标签，导致测试结果只能记为 `pass-with-issue`。

**根本原因**：Claude CLI print 模式不一定展示 skill 加载信息；只靠隐含行为判断会让验收不稳定。

**加了什么规则**：
- `AGENTS.md` 增加 v1 路由固定第一响应。
- `CLAUDE.md` 增加强制输出前缀。
- `.claude/skills/frontend/SKILL.md` 要求具体页面 / 组件请求第一行输出 `Skill: frontend`。

---

## 前端 / 交互

### 2026-05-31 静态报告页依赖 CDN 和浏览器目录 API 导致交互像失效

**犯的错**：在 Codex 右侧内嵌浏览器里，报告页依赖的 `JSZip` / `marked` CDN 和 `showDirectoryPicker` 能力不可用，导致下载 zip、上传 zip、选择目录体检、复制命令等动作看起来像“点不动”。

**根本原因**：静态页把外部脚本和高级浏览器 API 当成默认可用能力，没有给受限浏览器提供同等清晰的 fallback 和状态提示。

**加了什么规则**：
- 静态报告页的关键动作不能只依赖 CDN，下载类能力必须有本地 fallback。
- 浏览器不支持目录写入、剪贴板或 zip 解析时，必须在页面上显示替代入口，不让按钮静默失败。
- 修改报告页交互后，要在内嵌浏览器里实际点击核心按钮，而不是只看服务返回 200。

### 2026-05-20 工作台复合 class 覆盖了分栏内边距

**犯的错**：旧项目左栏同时使用 `kit-left kit-card`，后声明的 `.kit-card { padding: 0 }` 覆盖了 `kit-left` 的工作台内边距，导致左栏没有真正使用 `WorkbenchLayout` padding token。

**根本原因**：布局容器 class 和内容卡片 class 混用，且两个选择器权重相同，后声明样式覆盖了前面的布局语义。

**加了什么规则**：
- `kit-left` / `kit-right` 这类布局分栏不再叠加 `kit-card`。
- 工作台内边距必须挂在 `WorkbenchLayout` / panel column 层，不能由内部卡片 class 参与决定。
- 调整工作台间距后，要用浏览器量真实渲染距离，而不是只看 CSS token。

---

## API / 后端 / 业务链路

暂无记录。

---

## 数据 / Schema / 引用一致性

### 2026-05-20 并行生成同一个报告文件导致 HTML 临时交叉写入

**犯的错**：验证 `check-ai-project.sh` 和 `ai-project.sh report` 时并行运行了两个都会写 `.project-os/reports/ai-project-report.html` 的命令，导致同一个 HTML 报告文件出现重复片段和交叉写入。

**根本原因**：并行工具调用适合读文件和互不影响的检查，但不适合同时写同一个生成物。两个报告命令目标文件相同，没有文件锁或临时文件原子替换保护。

**加了什么规则**：
- 不并行运行会写同一个报告、快照、构建产物或模板目录的命令。
- 生成报告时单独顺序执行 `bash scripts/check-ai-project.sh . --write-report --html`。
- 如果后续要允许并行报告生成，脚本需要先写入唯一临时文件，再原子替换目标文件。

---

## 联调 / 部署 / 环境

### 2026-05-20 Chrome 截图回归缺少超时保护导致任务挂住

**犯的错**：生成视觉 baseline 时，`tests/screenshot-regression.sh` 调用本机 Chrome 后一直等待，没有及时退出，导致当前任务被卡住。

**根本原因**：脚本直接执行浏览器命令，没有给 headless 截图过程设置超时；一旦 Chrome 启动或截图阶段卡住，回归脚本无法自行恢复。

**加了什么规则**：
- `tests/screenshot-regression.sh` 增加 `run_with_timeout`，默认 `BROWSER_SCREENSHOT_TIMEOUT=30` 秒后终止卡住的浏览器截图命令。
- Chrome 截图命令不再强制传入临时 `--user-data-dir`，优先使用更接近直接 headless 的稳定参数。
- `docs/ENVIRONMENT.md` 记录 `BROWSER_SCREENSHOT_TIMEOUT` 环境变量。
- `docs/RUNBOOK.md` 增加 Chrome 截图卡住时的复跑方式。

---

## AI 工程化与成长机制

### 2026-05-31 规则文档散落与 AI 上下文割裂

**犯的错**：以往将各种规范直接放入 `docs/`，或者放入各个 IDE 的专用目录 (`.cursorrules`、`.claude/skills/`等)，导致 AI 上下文碎片化。新增规范后，部分 AI 工具无法实时感知。

**根本原因**：缺乏统一的 AI 资产目录 (SSOT)，以及依靠人力或静态复制而非运行时动态链接，导致多点维护且极易过时。

**加了什么规则**：
- 强制所有环境统一采用 `.ai/rules/` 作为 AI 读取规范的标准目录。
- 严禁手动复制或双写。必须利用操作系统的软链接保持单点数据源。
- 引入了 `scripts/sync-ai-rules.sh`，将其挂载于任何关键生命周期（如体检、初始化时）进行全自动映射。

### 2026-05-31 依赖人力要求 AI 记录经验导致演进缓慢

**犯的错**：原本只依靠 `AGENTS.md` 里的文本约束“犯错后必须记录 LESSONS.md”，实际操作中极易被人类和 AI 遗忘。

**根本原因**：将反思过程当做一种“道德约束”，而没有沉淀为可被低成本唤起的工程“技能”或“引擎”。

**加了什么规则**：
- 构建了全自动引擎：新增 `scripts/auto-reflect.sh`（复盘提取）和 `scripts/optimize-rules.sh`（规则修剪）。
- 通过 CLI Prompt Generator 的方式让 Shell 吐出指令触发当前伴跑的 AI 去工作。
- 注册为 `.ai/skills/` 通用能力，人类只需对 AI 讲“自动反思”，闭环立即发生。
