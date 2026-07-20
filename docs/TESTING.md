---
layer: knowledge
type: spec
last_verified: 2026-07-21
teaches: "OmniDesk Desktop Runtime 的测试分层、发布证据和验收边界"
use_when: "AI 要写测试、验收桌面运行时或判断改动需要哪些发布证据时"
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

目标：确认 OmniDesk Runtime、状态契约和基础文档没有跑偏。

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
npm --prefix desktop run test:native
```

`tests/run-tests.sh` 是本地完整回归入口，覆盖文档契约、Desktop Node、Web build、bundle 预算、离线 Eval 基线和 Runtime Rust 测试。`test:native` 是独立的原生窗口 smoke；它不能用浏览器 Preview 或离线测试替代。

### 2. Agent 交互契约

目标：确认对话、任务和受控执行遵守同一个 Runtime 状态机，而不是把 Provider 响应直接当作任务完成。

检查项：
- 对话的取消、接管和迟到结果不会覆盖当前 request。
- Patch 草稿必须通过授权文件、路径、hunk 与上下文校验。
- 工程写入和检查各自等待独立审批。
- 检查失败只在同一任务内产生有界修复草稿，达到上限后保留失败证据。
- Preview 对写入、终端、检查与恢复始终只读拒绝。

对应回归位于 `desktop/tests/*.test.mjs` 与 Runtime Rust 测试；真实模型、网络中断和原生重启证据只在隔离 fixture 与受保护 Eval 中验收。

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

### 6. 可执行回归测试

目标：把源仓库维护者原本手动做的检查收进一个可重复入口。

推荐命令：

```bash
bash tests/run-tests.sh
```

当前覆盖：

- tracked 状态与文档结构 JSON
- frontmatter、文档结构与密钥安全
- Desktop Node 契约回归
- Web build 与 800 KiB 首屏预算
- 离线 12-case Eval 基线结构与不回退检查
- Agent Run checkpoint 与审批恢复的离线契约证据
- Tauri Runtime Rust 与 Patch Normalizer 回归

说明：该入口不执行旧 CLI、installer、模板分发、AI 工程报告、图谱或截图报告测试。原生窗口与真实 Provider 路径分别由 `test:native` 和受保护 Agent Eval 工作流覆盖。

### 7. Fact / Slot Runtime 验收

目标：确保浏览器 Preview 与 Tauri Desktop 虽然读取方式不同，但生成一致的事实和工作面。

检查项：
- 旧项目没有 capability manifest 时保持兼容。
- 状态命名空间未激活时读取 legacy，无冲突激活后优先读取 `.omnidesk/`，且不改写 `.project-os/` 源数据。
- 任一迁移冲突必须阻止 namespace 激活；符号链接、路径逃逸和非授权状态目录不得进入新状态根。
- 旧目录退役预检必须拒绝未激活、漏迁、内容不一致或包含符号链接的状态；只有逐文件字节一致的已激活命名空间才可进入用户确认的清理流程。
- active 状态切换后产生的 legacy 历史差异必须通过独立确认动作归档到 `.omnidesk/evidence/legacy-retirement/`；归档只复制差异源文件与 manifest，不得删除 `.project-os/`。
- Desktop 与 Preview 的文件树、Agent 读取工具均不展示 `.project-os/` 或 `.omnidesk/` 物理目录。
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

macOS 原生窗口 smoke 不使用官方 `tauri-driver`。它通过仅测试构建启用的嵌入式 WebDriver 驱动 WKWebView，并使用临时工作区，不能读取密钥或写入当前项目：

```bash
npm --prefix desktop run test:native
```

该命令验证原生窗口的 DOM/React 输入与发送状态，并从 active `.omnidesk/cache`（未迁移 fixture 才回退 `.project-os`）读取原生终端 trace。它还会建立一条待审批 Agent Run、重启原生应用、断言 Run 被标为 `interrupted` 且保留审批 token，随后恢复到 `awaiting-approval`。它不把浏览器 Preview 当成桌面证据，不执行终端、检查、Patch 或模型请求；原生窗口中的实际批准点击和 Provider 网络中断仍需单独 fixture 覆盖。

### 8. CI 自动化检查

目标：把本地回归测试接入 GitHub，让 push 和 pull request 后自动复查。

CI 文件：

```txt
.github/workflows/ci.yml
```

当前覆盖：

- Desktop Node、Web build、bundle、原生 smoke、Runtime Rust 与离线 Eval 基线
- tracked state/manifest JSON、frontmatter、文档结构和密钥安全
- Desktop PR 校验 `desktop/evals/agent-eval-report.json` 完整覆盖 12 个 case，且任务成功率、Patch 可应用率、检查通过率不低于已提交基线。

说明：
- CI 与 `tests/run-tests.sh` 覆盖同一产品边界，但分别面向 GitHub 与本地执行环境；二者都不执行旧 CLI、installer 或 AI 工程报告链。

### Agent 真实评测

常规 PR 不读取模型密钥，只运行以下离线门槛：

```bash
npm --prefix desktop run check:agent-eval
```

`.github/workflows/agent-eval.yml` 在受保护的 `agent-eval` environment 中按日或手动运行。它需要 `OMNIDESK_AGENT_EVAL_KEY` secret 与 `OMNIDESK_AGENT_EVAL_MODEL` variable，执行 12-case suite、保留真实 trace，并拒绝成功率、Patch 可应用率或检查通过率回退。`goal-rebind` 必须证明四份授权文件均实际变更；`interrupted-run` 必须记录网络不可用分类、未接受 Provider 响应和恢复后的原审批。报告没有真实 trace 时不能替代该门槛。

---

## 收尾时最小检查

每次主要改动完成后，至少确认：

- 本轮改动是否还符合 `docs/PRODUCT_PLAN.md` 的当前阶段目标
- 如果改了 UI，是否符合 `docs/DESIGN_STANDARDS.md`
- 如果改了代码，是否运行了对应测试或说明为什么没跑
- 如果改变了下一步，是否更新 `HANDOFF.md`
- 如果形成新规则或踩坑，是否更新 `docs/LESSONS.md`
