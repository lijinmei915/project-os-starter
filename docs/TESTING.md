---
layer: knowledge
type: spec
last_verified: 2026-06-04
teaches: "测试方法、验收标准、AI 生成代码的质量检查方式"
use_when: "AI 要写测试、验收代码质量、或判断某个改动是否需要补测试时"
---

# 测试与偏离检查

> 用途：定义测试方法、验收重点和偏离检查方式。
> 什么时候更新：测试策略、验收标准、复测命令或测试分层变化时。
> 不要写什么：当前项目状态、当前交接、长期产品路线图。
> 这份文档回答的是：怎样判断项目没有漏填、助手没有跑偏、产品规划没有偏离、设计和代码改动有基本验证。
> 它不是要求所有项目一开始就上完整测试体系，而是给不同阶段一个轻量检查框架。

---

## 测试分层

### 1. Runtime 健康检查

目标：确认 AI Runtime 的核心入口、状态和 reference 没有跑偏。

检查项：
- `AGENTS.md` / `PROJECT.md` / `HANDOFF.md` 是否存在
- `README.md` / `INSTALL.md` / `docs/*` 是否符合当前安装 profile 的边界
- `PROJECT.md` 是否写清项目定位、当前架构和当前进度
- `HANDOFF.md` 是否写清当前状态、风险和下一步
- `project-setup` references 是否存在：`init.md` / `audit.md`
- `docs/PRODUCT_PLAN.md` 是否写清近期目标和本阶段不做事项
- 项目特殊用户偏好是否写入 `HANDOFF.md` 或 `PROJECT.md`，而不是散落在旧模板文件里
- 是否还残留大量 `{{...}}`、无解释的 `TODO`、`.DS_Store`

推荐命令：

```bash
bash tests/run-tests.sh
bash scripts/check-runtime.sh .
bash scripts/ai-project.sh report .
```

区别：
- `check-runtime.sh` 检查 Project OS / AI Engineering Kit 自身文件结构是否完整。
- `check-ai-project.sh` 检查一个项目是否具备 AI 工程上下文完整度，并输出工程成熟度。

`check-ai-project.sh` 当前输出两条分数：

| 分数 | 含义 | 不能替代什么 |
|------|------|--------------|
| AI 工程上下文完整度 | AI 接手项目所需的规则、状态、架构、测试说明和交接资料是否齐，且不是明显空模板 | 不能证明测试、发布和报告工程已经闭环 |
| AI 工程成熟度 | 测试入口、fixtures、CI、评分模型、报告 UI 工程化、发布检查和跨工具验收是否到位 | 不能替代人工架构 review |

当前 v0.2 成熟度检查故意比上下文完整度更严格。
如果一个项目上下文完整度是 100，但工程成熟度偏低，说明“能读懂”，不代表“能稳定交付”。

文档质量识别：
- 空文件、只有标题、只有表格头、只有 `TODO` / `TBD` / `未记录` / `暂无记录` / `{{placeholder}}` 的文档，不视为可用文档。
- `README.md`、`AGENTS.md`、`PROJECT.md`、`HANDOFF.md` 和关键 `docs/*` 都会先过有效内容检查，再进入关键词检查。
- 这是轻量启发式，不替代人工 review；目标是先避免“文件名齐了但内容全空”的假阳性。

### 2. Prompt 行为测试

目标：确认助手按 project-setup 的协作流程工作，而不是凭习惯乱问、乱读、乱改。

检查项：
- 新项目是否先问“项目是什么”，再问阶段、目标、技术栈
- 第 9 组是否先读取全局偏好并复述给用户确认
- 老项目 review 是否判断“职责是否承接”，而不是机械补齐所有模板
- 用户说“跳过”时，助手是否保留 `TODO:`，而不是编造答案
- 用户只是分享信息时，助手是否没有主动扩大成实现任务

参考场景：
- `examples/prompt-simulation.md`

跨工具验收：
- `tests/cross-tool-matrix.md`

推荐准备测试目录：

```bash
bash scripts/create-test-fixtures.sh /tmp/project-os-fixtures
```

### 3. 产品规划偏离检查

目标：确认当前任务仍服务于项目阶段目标。

检查项：
- `HANDOFF.md` 的“下一步”是否能对应 `docs/PRODUCT_PLAN.md` 的近期优先级
- `PROJECT.md` 的“当前范围”是否能覆盖近期规划里的任务
- `docs/PRODUCT_PLAN.md` 的“本阶段不做”是否没有被放进当前下一步
- 如果临时改变优先级，是否在 `HANDOFF.md` 或 `docs/DECISIONS.md` 说明原因
- 如果跨层改动较大，是否更新 `docs/CHANGELOG.md`

### 4. 设计一致性检查

目标：防止 UI 越改越散。

检查项：
- UI 改动前是否读取 `docs/DESIGN_STANDARDS.md`
- 新增组件是否登记到 `docs/design/component-index.md`
- 新增颜色、间距、圆角是否优先复用 token
- 可点击元素是否有 hover 状态
- 链接和按钮是否有 focus-visible 状态
- 是否避免重复造已有 primitive / pattern

### 5. 代码测试策略

目标：让真实业务代码有和风险匹配的验证，而不是只有文档。

建议：
- 纯函数、格式化、解析、权限判断等逻辑优先写单元测试
- React / Vite 项目可用 Vitest + React Testing Library
- 关键用户流程可用 Playwright 或浏览器手测清单
- Supabase / API 请求至少验证成功、失败、loading 三种状态
- UI 改动至少记录手测结果；高风险 UI 流程建议补截图或端到端测试

### 6. AI 工程成熟度检查

目标：让 AI Engineering Kit 不只检查“有没有文件”，还检查“能不能验证、发布、交接和复查”。

当前 v0.2 维度：

- 评分与状态源：`PROJECT.md` 与 `.project-os/state.json` 是否一致，评分模型是否有 schema 和 v0.2 数据源
- 测试与质量门禁：是否有可执行测试入口、fixtures、CI、严格模板同步
- 报告与组件工程：HTML 报告是否可生成，报告 UI 是否脱离 shell 内联，组件契约和截图验收是否存在
- 分发与发布：是否有版本号、发布前检查、安装 profile 自动回归
- 老项目与跨工具：adapter 和跨工具验收矩阵是否完成
- 交接治理：`HANDOFF.md`、`CHANGELOG.md`、`DECISIONS.md` 是否记录当前工程化路线

推荐命令：

```bash
bash scripts/ai-project.sh report .
```

预期：

```txt
AI 工程上下文完整度：.../100
AI 工程成熟度：.../100
```

评分模型来源：

- `schemas/ai-project-score.schema.json`：定义评分模型结构
- `schemas/ai-project-score.v0.2.json`：记录当前上下文完整度和工程成熟度的维度、分值和检测方式
- `schemas/ai-project-report.schema.json`：定义报告模块数据结构
- `schemas/ai-project-report.v0.1.json`：记录报告模块标题、评分 section 分组和说明文案

### 7. 可执行回归测试

目标：把源仓库维护者原本手动做的检查收进一个可重复入口。

推荐命令：

```bash
bash tests/run-tests.sh
```

当前覆盖：

- `scripts/check-runtime.sh`
- `scripts/check-secrets.sh`
- `scripts/check-template-sync.sh --strict`
- `schemas/ai-project-score.schema.json`
- `schemas/ai-project-score.v0.2.json`
- `schemas/ai-project-report.schema.json`
- `schemas/ai-project-report.v0.1.json`
- `tests/check-report-model.mjs`
- `scripts/check-ai-project.sh --write-report`
- `scripts/add-project-docs.sh`
- `scripts/build-project-graph.sh`
- `tests/screenshot-regression.sh`
- `tests/visual-diff.mjs --self-test`
- `index.html`（standalone 可视化报告页）
- `.project-os/reports/ai-project-report.json`
- `.project-os/graph/project-graph.json`
- `tests/cross-tool-matrix.md`
- 老项目占位文档夹具，验证 `TODO` / `未记录` 不会被误判为可用文档
- `core` / `product` / `full` 三种安装 profile
- `core` 安装后的追加工程文档命令
- `core` 安装后的项目关系图生成命令
- 安装结果里的关键文件存在性和不该出现的文件
- `claude` / `codex` / `cursor` / `gemini` adapter 安装和 `AGENTS.md` 引用检查

说明：
- 这不是完整单元测试框架，但已经能阻断最常见的分发和模板同步问题。
- 截图回归脚本会先检查 HTML 报告关键标记；如果运行环境提供可用浏览器，会额外生成桌面和移动端截图。
- 如果存在 `tests/screenshots/baseline/ai-project-report-desktop.png` 或 `tests/screenshots/baseline/ai-project-report-mobile.png`，脚本会用 `tests/visual-diff.mjs` 做真实像素 diff。
- 默认阈值为 `VISUAL_DIFF_THRESHOLD=0.01`，即 1% 像素变化；可用 `VISUAL_DIFF_PIXEL_DELTA` 调整单像素差异敏感度。
- 没有浏览器或没有 baseline 时，默认跳过图片 diff；设置 `VISUAL_DIFF_STRICT=1` 后会把缺浏览器、缺 baseline 或差异超阈值都视为失败。
- 可视化报告页位于根目录 `index.html`，是 standalone HTML（浏览器本地分析，不依赖服务端）。截图回归脚本会直接用它做视觉验证。
- 跨工具矩阵当前先验证 adapter 分发与规则源头一致性，真实模型会话表现仍应在发布前抽样复查。
- 后续如果继续拆出评分执行层或报告渲染层，应继续把对应检查接入这个入口。
- `tests/check-report-model.mjs` 会校验评分维度总分、报告模块引用的 section，以及上下文评分维度是否都被报告模块覆盖，避免页面分组和评分模型漂移。

### 8. Fact / Slot Runtime 验收

目标：确保浏览器 Preview 与 Tauri Desktop 虽然读取方式不同，但生成一致的事实和工作面。

检查项：
- 旧项目没有 capability manifest 时保持兼容。
- 父能力或模块未启用时，Slot 在 Selector 执行前被门控。
- Fact 变化只重算直接依赖的 Slot，其他描述符保持不变。
- 事件严格按 `source.changed -> fact.invalidated -> fact.updated -> selector.recomputed -> slot.updated` 输出。
- 项目概览、当前进度和启动方式 Contract 均能从同一个 Fact Store 编译。
- 浏览器与 Tauri 的等价输入得到相同关键事实和 ViewModel。

推荐命令：

```bash
npm --prefix desktop test
npm --prefix desktop run web:build
cargo check --manifest-path desktop/src-tauri/Cargo.toml
```

### 9. CI 自动化检查

目标：把本地回归测试接入 GitHub，让 push 和 pull request 后自动复查。

CI 文件：

```txt
.github/workflows/ci.yml
```

当前覆盖：

- shell 脚本语法检查
- JSON schema / 模型解析检查
- `bash tests/run-tests.sh`
- `tests/screenshot-regression.sh`
- AI 项目报告生成
- 报告关键标记检查
- tracked files 是否被测试过程意外改动
- 上传 markdown / HTML 报告 artifact，若生成了截图也一并上传
- Desktop PR 同时校验 `desktop/evals/agent-eval-report.json` 完整覆盖 12 个 case，且任务成功率、Patch 可应用率、检查通过率不低于已提交基线。

说明：
- CI 是自动执行器，不替代 `tests/run-tests.sh`。
- `tests/run-tests.sh` 是具体检查脚本，CI 只是负责在 GitHub 上自动调用它。

### Agent 真实评测

常规 PR 不读取模型密钥，只运行以下离线门槛：

```bash
npm --prefix desktop run check:agent-eval
```

`.github/workflows/agent-eval.yml` 在受保护的 `agent-eval` environment 中按日或手动运行。它需要 `OMNIDESK_AGENT_EVAL_KEY` secret 与 `OMNIDESK_AGENT_EVAL_MODEL` variable，执行 12-case suite、保留真实 trace，并拒绝成功率、Patch 可应用率或检查通过率回退。报告没有真实 trace 时不能替代该门槛。

---

## 收尾时最小检查

每次主要改动完成后，至少确认：

- 本轮改动是否还符合 `docs/PRODUCT_PLAN.md` 的当前阶段目标
- 如果改了 UI，是否符合 `docs/DESIGN_STANDARDS.md`
- 如果改了代码，是否运行了对应测试或说明为什么没跑
- 如果改变了下一步，是否更新 `HANDOFF.md`
- 如果形成新规则或踩坑，是否更新 `docs/LESSONS.md`
