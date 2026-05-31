# 错误模式记录

> 用途：记录错误复盘和新增约束，回答“踩过什么坑、以后怎么避免”。
> 什么时候更新：误删、误改、误判、测试跑偏、规则失效时。
> 不要写什么：成功经验、普通进展、重复的 changelog 内容、当前状态摘要。
> 每次犯错后立即记录。
> 格式：犯的错 / 根本原因 / 加了什么规则。

---

## Project OS / 路由

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
