---
layer: knowledge
type: log
last_verified: 2026-06-04
teaches: "项目的结构性变更历史及其影响范围"
use_when: "AI 需要回溯某个功能是什么时候改的、为什么改的、影响到哪些模块时"
---

# 代码变更日志

> 只记录高价值改动，用于回溯"改了什么 / 为什么改 / 影响到哪里"。
> 不记录零碎样式微调；方案原因看 `DECISIONS.md`，踩坑复盘看 `LESSONS.md`。
> 用途：记录高价值结构改动。
> 什么时候更新：安装方式、路由机制、适配层、文档结构、跨层改动变化时。
> 不要写什么：当前状态、交接下一步、零碎文案调整、无结构影响的小修。

维护规则：
- 只记录跨层改动（前端 / API / 数据库 / 文档 / 环境变量中至少两层）
- 每条固定写"改动 / 影响 / 相关文件"
- 纯样式微调、文案调整、无结构影响的小修不记录
- 一次连续任务合并成一条，不拆碎
- 组织方式优先按日期，再在日期内按主题分组

---

## 2026-07-03

### OmniDesk / Project OS Desktop

#### OmniDesk 北极星目标 + 成熟工具参照系统

- **改动**：(1) `PROJECT.md` 和 `docs/PRODUCT_PLAN.md` 明确 OmniDesk 是会持续学习项目的本地 AI 工程工作台，目标是让任何新老项目按统一流程被理解、治理、开发和演进；(2) 新增 `docs/REFERENCE_SYSTEMS.md`，定义 Hermes、Codex CLI、Claude Code 等成熟工具是参照系统和可接入执行器，不替代 OmniDesk 的用户入口；(3) `docs/DOCUMENTATION.md`、`docs/NAMING.md` 和 `docs/data/doc-structure.manifest.json` 登记参照系统文档职责；(4) `.project-os/state.json` 同步机器可读项目描述。
- **影响**：后续桌面端设计以“用户入口 + 项目治理中枢 + 本地项目记忆”为北极星；Hermes 等工具优先作为底层执行能力和治理形态参考，执行结果必须回写 `.project-os/`，不把外部 runtime 当作默认产品入口。
- **相关文件**：`PROJECT.md`, `docs/PRODUCT_PLAN.md`, `docs/REFERENCE_SYSTEMS.md`, `docs/DOCUMENTATION.md`, `docs/NAMING.md`, `docs/data/doc-structure.manifest.json`, `.project-os/state.json`, `docs/CHANGELOG.md`。

## 2026-06-13

### AI Engineering Kit / governance

#### Project OS Console 产品定位收束

- **改动**：(1) `PROJECT.md` 和 `docs/PRODUCT_PLAN.md` 将当前方向收束为 `Project OS Console`；(2) 明确当前优先级为理解项目、推荐补齐、生成文件、跑检查和维护交接状态；(3) Agent 自动执行、多 Agent 工作台和远程 runtime 放到后续阶段。
- **影响**：后续迭代不再以“工程包选择器”或“Hermes Studio 复制品”为目标，而是先把 Project OS 的项目治理控制台闭环做扎实；首页推荐区应优先接入 `scripts/recommend-next.sh` 的 JSON 契约。
- **相关文件**：`PROJECT.md`, `docs/PRODUCT_PLAN.md`, `HANDOFF.md`, `docs/CHANGELOG.md`, `scripts/recommend-next.sh`。

#### AGENTS 官方风格收口 + 路由细则下沉 + runtime warning 清零

- **改动**：(1) 根 `AGENTS.md` 改为短入口，保留 Quick Start、Commands、Working Boundaries、Routing Summary 和少量边界规则；(2) 新增 `docs/ROUTING.md` 承接安装入口、路由模式、固定第一响应和 v1 验收契约；(3) `docs/DOCUMENTATION.md` 增加根 `AGENTS.md` 体量约束和可分发内容定义；(4) `check-runtime.sh` 的 guidance header 扫描窗口从 12 行扩到 24 行，兼容带 YAML frontmatter 的文档；(5) `PROJECT.md` 去掉历史路线标签，`HANDOFF.md` 压缩为当前接手摘要。
- **影响**：根规则入口更接近官方 `AGENTS.md` 风格；路由细则有独立 SSOT；`check-runtime.sh` 从 33 个误报 / 语义 warning 降到 0 warning；目标项目模板也能分发 `docs/ROUTING.md`。
- **相关文件**：`AGENTS.md`, `docs/ROUTING.md`, `docs/DOCUMENTATION.md`, `docs/NAMING.md`, `docs/ARCHITECTURE.md`, `docs/CODE_STRUCTURE.md`, `PROJECT.md`, `HANDOFF.md`, `scripts/check-runtime.sh`, `scripts/install-project-os.sh`, `templates/project-docs/docs/ROUTING.md`, `templates/project/docs/ROUTING.md`。

#### Skill 证据推导规范 + Agent Skill 默认骨架轻量化

- **改动**：(1) 新增 `docs/SKILL_ENGINEERING.md`，定义最小 Skill、参考资料、资产、工具脚本和分发文件的证据推导边界；(2) AI 项目工程助手的 `Agent Skill 工程` 默认生成物改为最小骨架；(3) 资产、脚本、schema、fixture 和分发文件仍保留模板能力，但不再作为默认向导卡片展示；(4) 目标项目模板同步 `docs/SKILL_ENGINEERING.md` 和更新后的 `index.html`。
- **影响**：用户不需要选择 Skill 类型，也不需要知道内部目录；做 Skill 时先生成可进入、可触发、可验收的最小工程，后续由系统根据目标产物、已有文件、下一步动作和验收要求补文件，避免 Skill 一开始就膨胀成完整工程包。
- **相关文件**：`docs/SKILL_ENGINEERING.md`, `docs/DOCUMENTATION.md`, `docs/NAMING.md`, `index.html`, `templates/project/index.html`, `HANDOFF.md`。

#### 新项目向导从分包选择改为状态识别与补齐策略

- **改动**：(1) 新项目页标题从“模板选择向导 / 生成工程契约”改为“项目状态识别 / 推荐补齐方案”；(2) Q2 文案从“生成哪类工程”改为“先推进哪个下一步”；(3) 产品、页面、运行、交接、Skill、治理等选项改为动作语言，底层 preset 保留为内部补齐策略；(4) `docs/WIZARD_PRESETS.md` 改为状态识别与补齐策略映射。
- **影响**：用户不再需要理解工程包；Project OS 根据维护场景、下一步动作、已有文件和验收要求推导推荐文件，UI 更接近 OpenDesign 的“识别状态后暴露动作”模式。
- **相关文件**：`index.html`, `templates/project/index.html`, `docs/WIZARD_PRESETS.md`, `docs/design/ai-project-assistant/data.ts`, `docs/design/ai-project-assistant/components.md`, `HANDOFF.md`。

#### 推荐引擎证据契约

- **改动**：(1) 新增 `docs/RECOMMENDATION_ENGINE.md`，定义 evidence -> signals -> gaps -> recommendations -> checks 的推荐链路；(2) 明确每个默认推荐项必须能说明 reason、evidence、confidence、check，并允许跳过；(3) `docs/WIZARD_PRESETS.md` 明确当前实现仍是轻量规则映射，不能伪装成完整智能识别。
- **影响**：后续推荐文件不再只靠 Q1 / Q2 / Q3 固定映射；升级推荐逻辑时有明确验收标准，可以逐步做到“检测到什么证据，所以推荐补什么”。
- **相关文件**：`docs/RECOMMENDATION_ENGINE.md`, `docs/WIZARD_PRESETS.md`, `docs/DOCUMENTATION.md`, `docs/NAMING.md`, `HANDOFF.md`。

#### 素材库低假设治理

- **改动**：(1) `docs/DOCUMENTATION.md` 增加素材库原则：文档模板只定义结构、填写槽位和证据来源，不默认推荐具体主流技术栈；(2) `FRONTEND.md`、`BACKEND.md` 模板改为“当前选择 / 状态 / 证据来源”记录表，具体技术从依赖文件、配置文件或用户已确认决策推导；(3) `check-templates.sh` 增加低假设技术模板检查，阻止模板重新写死框架、数据库、ORM、部署或组件库。
- **影响**：Project OS 的素材库从“替用户选技术”改为“帮 AI 记录证据和边界”；推荐能跟随项目事实变化，不会因为模板过时而带偏新项目或老项目接入。
- **相关文件**：`docs/DOCUMENTATION.md`, `templates/project-docs/docs/FRONTEND.md`, `templates/project-docs/docs/BACKEND.md`, `templates/project-docs/docs/ROUTING.md`, `scripts/check-templates.sh`, `HANDOFF.md`。

#### Recommendation Engine v0.1 CLI

- **改动**：(1) 新增 `scripts/recommend-next.sh`，扫描目标项目并输出 `project-os.recommendation.v0.1` JSON；(2) JSON 按 evidence、signals、gaps、recommendations、checks 分层，每条推荐包含 reason、evidence、confidence、check、overridable；(3) `scripts/ai-project.sh` 增加 `recommend` 子命令；(4) core profile 分发该脚本，回归测试覆盖推荐 JSON 和安装后可运行性。
- **影响**：Project OS 开始从固定向导映射进入“基于证据推荐下一步”的执行内核；后续 UI 可以消费该 JSON，把“检测到什么，所以推荐补什么”展示给用户。
- **相关文件**：`scripts/recommend-next.sh`, `scripts/ai-project.sh`, `docs/RECOMMENDATION_ENGINE.md`, `docs/DOCUMENTATION.md`, `docs/NAMING.md`, `scripts/install-project-os.sh`, `scripts/sync-templates.sh`, `scripts/check-template-sync.sh`, `tests/run-tests.sh`, `templates/project/scripts/recommend-next.sh`。

#### 推荐引擎结果接入首页

- **改动**：(1) 首页“推荐补齐方案”新增推荐引擎证据区，优先读取 `.project-os/recommendations/recommend-next.json`；(2) 读取成功时展示推荐数量、原因、证据、置信度、跳过风险和检查命令；(3) 读取不到 JSON 时保留现有向导推荐，并提示运行 `bash scripts/recommend-next.sh . --write-report`；(4) 勾选逻辑也开始以推荐引擎为准：有 recommendations 时只默认勾推荐项，没有明显缺口时只保留必选入口文件；(5) 截图回归 marker 覆盖推荐引擎入口。
- **影响**：Project OS Console 的 UI 开始从“前端静态推导”过渡到“CLI 推荐引擎驱动”；Q1-Q3 退为手动 fallback，只有缺少推荐 JSON 或用户主动调整时才接管勾选。
- **相关文件**：`index.html`, `templates/project/index.html`, `tests/screenshot-regression.sh`, `HANDOFF.md`。

#### 一句话目标作为推荐 evidence

- **改动**：(1) 首页第一步从“当前项目识别结果”改为“一句话目标”；(2) 新增目标输入框，用户输入一句话后按规则提取页面、运行、交接、设计系统、Skill、治理、AI/RAG 等信号；(3) 用户话语会驱动现有 Q1-Q3 fallback 的隐藏状态和勾选结果，但不暴露成工程包选择；(4) 识别结果下直接展示“建议生成 / 暂不生成 / 查看并确认生成项”执行计划；(5) `docs/RECOMMENDATION_ENGINE.md` 明确“用户话语证据”进入同一条 evidence -> signals -> gaps -> recommendations 链路。
- **影响**：新项目入口从“选择模板/扫描不存在的新项目”转为“用户说目标，系统按当前必要项增量生成”；Q1-Q3 保留为底层手动细调，不再是主交互。
- **相关文件**：`index.html`, `templates/project/index.html`, `docs/RECOMMENDATION_ENGINE.md`, `tests/screenshot-regression.sh`, `HANDOFF.md`。

#### project-setup 增量意图契约

- **改动**：(1) `project-setup` 新增 facts / currentIntent / futureSignals / constraints / negativeConstraints / missing / confidence / route 结构化意图契约；(2) 明确每条用户消息作为增量 evidence；(3) 当前动作明确时自动推导最小下一步，低置信度、冲突或缺少当前动作时才进入 CLARIFICATION；(4) 用户话语不明确且没有已有项目目录证据时，不再盲目默认 HYBRID；(5) clarification reference 增加 `1234567` 和冲突意图的最小澄清规则。
- **影响**：`project-setup` 从固定路由问答守门员升级为 Conversation-first 入口，同时保留 v1 固定验收 case 的兼容性。
- **相关文件**：`.agents/skills/project-setup/SKILL.md`, `.claude/skills/project-setup/SKILL.md`, `.agents/skills/project-setup/references/clarification.md`, `.claude/skills/project-setup/references/clarification.md`, `AGENTS.md`, `docs/ROUTING.md`, `tests/cases.md`, `HANDOFF.md`。

---

## 2026-06-05

### AI Engineering Kit / self engineering

#### 北极星锁定 + goal 模式拆解 + P1·M1.1 kb-just-ask 落地

- **改动**：(1) 锁定北极星=组织级 AI 研发中台，`PRODUCT_PLAN.md` 新增北极星章节与四级台阶(P1-P4)，v3/v4/v5 收口对齐；(2) goal 模式拆出 10 个里程碑任务并串联依赖(会话任务看板)；(3) 实现 P1 第一砖 `scripts/kb-just-ask.sh` + `.ai/skills/kb-just-ask.json`——读 `knowledge-registry.json` 整理成知识地图 prompt，由 AI 按 use_when 匹配文件并溯源回答；(4) 决策记入 D014(北极星方向)/D015(skill 消费知识的 prompt 模式)。
- **影响**：上一轮的 `knowledge-registry.json` 从孤岛变成可消费入口；为 P2 专家技能提供参考实现；产品路线图从「自身工程化」升级为「通往组织级中台」的四级台阶。
- **相关文件**：`docs/PRODUCT_PLAN.md`, `scripts/kb-just-ask.sh`, `.ai/skills/kb-just-ask.json`, `docs/DECISIONS.md`, `HANDOFF.md`, `CLAUDE.md`。

---

## 2026-06-04

### AI Engineering Kit / self engineering

#### v4 知识语义索引：frontmatter teaches/useWhen + knowledge-registry.json

- **改动**：frontmatter 新增 `teaches`（语义摘要）和 `use_when`（语义触发）两个可选字段；`build-project-graph.sh` 解析新字段并额外输出 `knowledge-registry.json`（语义索引文件）；全量 24 个带 frontmatter 的文档已补齐两个字段；`KNOWLEDGE_SCHEMA.md` 新增字段规范和写法指南。
- **影响**：AI 可通过 `knowledge-registry.json` 按问题域快速定位该查哪个文件，不再只能按文件名猜；`project-graph.json` 的 node 新增 `teaches` / `useWhen` 属性。
- **相关文件**：`docs/KNOWLEDGE_SCHEMA.md`, `scripts/build-project-graph.sh`, `.project-os/graph/knowledge-registry.json`, 全部 `docs/*.md` 和根 `*.md`。

---

## 2026-05-20

### AI Engineering Kit / self engineering

#### v3 知识结构化：文档 frontmatter + 图谱升级 + 评分升级 + 架构图自动化

改动：
- 新增 `docs/KNOWLEDGE_SCHEMA.md`，定义文档 YAML frontmatter 规范（layer / type / last_verified / depends_on）
- 给根目录 + `docs/` 全部文档加 frontmatter，模板层（`templates/project*/`）镜像同步
- `scripts/build-project-graph.sh` 升级：解析 frontmatter，节点增加 archLayer / docType / lastVerified / stale 字段，新增 `declares_dependency` 边，90 天过期检测，schemaVersion → v0.2，额外输出 `docs/data/project-graph.json` 供页面读取
- 新增评分模型 `schemas/ai-project-score.v0.4.json`：知识演进维度拆成错题本 / 引擎 / 元数据完整度 / 知识新鲜度四子项；`scripts/check-ai-project.sh` 按 v0.4 评分并列出过期文档
- `docs/architecture-diagram.html` 改为 fetch 图谱 JSON 动态渲染，按 archLayer 分四层，过期文档标橙，永远反映当前代码结构
- `scripts/sync-templates.sh` 补上漏掉的 `build-project-graph.sh` 同步项
- 修复 `.claude/settings.local.json` commit-guard hook：原 `if` 字段不生效导致拦截所有 bash，改为读 stdin 命令仅在 `git commit` 时检查

影响：
- 项目知识从「扁平文件」升级为「机器可读的结构化资产」，AI 不再靠全文塞上下文
- 体检报告能标出过期文档，而不只是缺失文档
- 架构图成为知识图谱的可视化出口，手画图过期问题消除
- 为 v4 Skill 契约化和 v5 治理闭环打下数据地基

相关文件：
- `docs/KNOWLEDGE_SCHEMA.md`、`scripts/build-project-graph.sh`、`scripts/check-ai-project.sh`
- `schemas/ai-project-score.v0.4.json`、`docs/architecture-diagram.html`、`docs/data/project-graph.json`
- 根目录 + `docs/*.md`、`templates/project*/**`、`tests/run-tests.sh`、`.claude/settings.local.json`

---

#### 增加本地项目关系图生成

改动：
- 新增 `scripts/build-project-graph.sh`，扫描核心文档、脚本、schema、模板、AI 资产和引用关系
- 关系图输出到 `.project-os/graph/project-graph.json`，作为本地生成物
- `core` profile 分发该脚本，并在 `tests/run-tests.sh` 中验证源仓库和 core 安装后的图谱生成
- `.ai/skills/` 增加 `build-project-graph` 声明，供 AI 工具发现该动作

影响：
- Project OS 可以先拥有自己的轻量项目理解内核，不依赖第三方 skill
- 生成物可作为后续影响分析和报告页关系图入口的数据源
- 关系图只做静态结构分析，不替代 `docs/ARCHITECTURE.md` 或人工 review

相关文件：
- `scripts/build-project-graph.sh`
- `.ai/skills/build-project-graph.json`
- `scripts/install-project-os.sh`
- `tests/run-tests.sh`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`

---

#### 增加本地密钥占位和安全检查

改动：
- 新增 `.env.example`，只提供 `DEEPSEEK_API_KEY` 空占位，不写入真实 key
- 新增 `scripts/check-secrets.sh`，检查 `.env.local` 是否被 git 忽略，并扫描 tracked files 中是否出现明显 provider key
- `core` profile 分发 `check-secrets.sh`，并纳入模板同步、CI 和回归测试
- 环境文档说明真实 key 只能放在本机环境变量或 `.env.local`

影响：
- 静态报告页仍不直接读取 API key 或执行本机命令
- 真实 provider key 不进入仓库、模板、报告和测试夹具
- 目标项目安装后也能用同一条命令检查密钥放置是否安全

相关文件：
- `.env.example`
- `scripts/check-secrets.sh`
- `docs/ENVIRONMENT.md`
- `docs/DOCUMENTATION.md`
- `tests/run-tests.sh`
- `.github/workflows/ci.yml`

---

#### 补齐追加工程文档工具和 JSON 报告

改动：
- 新增 `scripts/add-project-docs.sh`，从 `templates/project-docs/` 向项目追加工程文档模板，默认跳过已有文件
- `core` profile 分发 `scripts/add-project-docs.sh` 和 `templates/project-docs/`，让轻量安装后的项目也能后续补齐 `docs/*` 模板
- `scripts/check-ai-project.sh --write-report` 同步生成 `.project-os/reports/ai-project-report.json`
- 报告页“添加更多文档”从 `待接入` 占位改为复制补齐文档命令
- 回归测试覆盖 core 安装后的追加文档命令和 JSON 报告存在性

影响：
- 不引入 API 或本地服务，仍采用“命令真实执行，网页展示结果”的运行方式
- 用户可先轻量接入，再按需补充 DOCUMENTATION / NAMING / ARCHITECTURE / ENVIRONMENT / TESTING / RUNBOOK / CHANGELOG / DECISIONS / LESSONS 等工程文档
- JSON 报告成为面向页面、CLI 和其他 AI 工具的机器可读返回值

相关文件：
- `scripts/add-project-docs.sh`
- `scripts/check-ai-project.sh`
- `templates/project-docs/`
- `templates/report/ai-project-report.html`
- `tests/run-tests.sh`
- `docs/DOCUMENTATION.md`
- `docs/NAMING.md`

---

#### 报告模块迁到结构化数据

改动：
- 新增 `schemas/ai-project-report.schema.json` 和 `schemas/ai-project-report.v0.1.json`，记录报告模块标题、评分 section 分组和说明文案
- `scripts/check-ai-project.sh` 生成 HTML 报告时改为读取报告模块数据源，不再在 shell 循环里硬编码六个模块和 `case` 文案
- `scripts/install-project-os.sh`、`tests/run-tests.sh` 和 CI 将报告 schema / v0.1 数据源纳入 `core` 分发和回归检查
- `docs/NAMING.md`、`docs/DOCUMENTATION.md`、`docs/PRODUCT_PLAN.md`、`docs/DECISIONS.md` 同步说明报告数据层边界

影响：
- 后续调整报告模块结构时，可以先改数据源，再由脚本和模板消费
- `core` profile 的报告生成依赖从“脚本 + 模板”变为“脚本 + 模板 + 报告数据源”
- 仍保持静态 HTML 和 Bash 运行方式，不新增前端构建或 `jq` 依赖

相关文件：
- `schemas/ai-project-report.schema.json`
- `schemas/ai-project-report.v0.1.json`
- `scripts/check-ai-project.sh`
- `scripts/install-project-os.sh`
- `tests/run-tests.sh`
- `.github/workflows/ci.yml`

---

#### 增加老项目空模板文档识别

改动：
- `scripts/check-ai-project.sh` 增加有效内容判断，先排除空白、标题、引用说明、表格头、`TODO`、`TBD`、`未记录`、`暂无记录`、占位符等低信息量内容
- 上下文完整度检查不再只按文件存在给分，`AGENTS.md`、`PROJECT.md`、`HANDOFF.md` 和关键 `docs/*` 都需要达到最小有效行数
- `tests/run-tests.sh` 增加老项目占位文档夹具，验证“已有但全是占位”的文档不会拿到 `100/100`
- `schemas/ai-project-score.schema.json` 和 `schemas/ai-project-score.v0.2.json` 增加 `substantive_file` / `substantive_content_any` 等检测语义
- `docs/TESTING.md`、`docs/RUNBOOK.md`、`docs/DECISIONS.md` 同步说明文档质量识别边界

影响：
- 老项目报告能区分“完全缺失”和“已有但不合格”
- 非技术用户不会因为文件名齐全就误以为项目已可稳定交接
- 当前识别仍是轻量启发式，后续需要真实老项目样本继续校准阈值

相关文件：
- `scripts/check-ai-project.sh`
- `tests/run-tests.sh`
- `schemas/ai-project-score.schema.json`
- `schemas/ai-project-score.v0.2.json`
- `docs/TESTING.md`
- `docs/RUNBOOK.md`
- `docs/DECISIONS.md`

---

#### 升级报告页截图回归为视觉 diff

改动：
- 新增 `tests/visual-diff.mjs`，不依赖第三方包即可读取 PNG、计算像素差异并输出 diff 图
- `tests/screenshot-regression.sh` 从单张可选截图升级为桌面 / 移动端双视口截图
- 当 `tests/screenshots/baseline/` 存在基准图时，截图回归会自动做真实视觉 diff
- 新增第一版桌面 / 移动端 baseline，用于固定当前报告页视觉状态
- `tests/run-tests.sh` 增加 `tests/visual-diff.mjs --self-test`
- `docs/TESTING.md`、`docs/RUNBOOK.md` 和 `docs/ENVIRONMENT.md` 同步说明 baseline、阈值和严格模式

影响：
- 报告页不再只检查 HTML 标记和“能不能截图”，也能在有 baseline 时发现视觉退化
- 默认模式仍不强依赖本机浏览器，避免普通回归在无 Chrome 环境里失败
- baseline 是否提交由维护者在视觉稳定后确认

相关文件：
- `tests/screenshot-regression.sh`
- `tests/visual-diff.mjs`
- `tests/run-tests.sh`
- `tests/screenshots/baseline/.gitkeep`
- `tests/screenshots/baseline/ai-project-report-desktop.png`
- `tests/screenshots/baseline/ai-project-report-mobile.png`
- `docs/TESTING.md`
- `docs/RUNBOOK.md`
- `docs/ENVIRONMENT.md`

---

#### 收口跨工具 adapter 验收矩阵

改动：
- 重写 `tests/cross-tool-matrix.md`，明确 adapter 分发验收、路由契约验收和最新回归结果
- `tests/run-tests.sh` 增加 cross-tool matrix 检查，禁止验收矩阵继续保留 pending 标记
- `tests/run-tests.sh` 在临时 `full` 安装目录里运行 `scripts/install-adapter.sh`，验证 `claude` / `codex` / `cursor` / `gemini` 四个入口文件均能生成
- 四个 adapter 入口文件都会检查是否引用 `AGENTS.md`，确保 adapter 不成为新的规则源头

影响：
- 工程成熟度 v0.2 中“跨工具验收矩阵已完成”缺口被补上
- 本仓库成熟度从 `95/100` 提升到 `100/100`
- 当前 100 分代表 v0.2 模型覆盖的工程闭环已通过，不代表真实业务项目无需人工 review

相关文件：
- `tests/cross-tool-matrix.md`
- `tests/run-tests.sh`
- `docs/DECISIONS.md`
- `schemas/ai-project-score.schema.json`
- `schemas/ai-project-score.v0.2.json`

---

#### 抽出报告页 HTML 模板层

改动：
- 新增 `templates/report/ai-project-report.html`
- `scripts/check-ai-project.sh` 不再内联整页 HTML / CSS / JS，而是生成缺口列表和模块卡片后注入模板
- `templates/project/` 同步分发报告模板，`core` profile 安装时会带上报告模板
- `check-template-sync.sh` 和 `sync-templates.sh` 纳入 `templates/report`

影响：
- 报告 UI 从 shell 主逻辑里拆出，后续改视觉和交互不必在检查脚本里翻大段 HTML
- 工程成熟度 v0.2 中“报告 UI 已从 shell 主逻辑中拆出”缺口被补上
- 本仓库成熟度从 `89/100` 提升到 `95/100`

相关文件：
- `templates/report/ai-project-report.html`
- `scripts/check-ai-project.sh`
- `scripts/install-project-os.sh`
- `scripts/check-template-sync.sh`
- `scripts/sync-templates.sh`
- `docs/DECISIONS.md`
- `templates/project/templates/report/ai-project-report.html`

---

#### 增加报告页截图回归入口

改动：
- 新增 `tests/screenshot-regression.sh`
- 新增 `tests/screenshots/` 截图输出目录，并忽略生成的 PNG
- `tests/run-tests.sh` 接入报告页回归，先检查 HTML 关键标记，浏览器可用时再生成截图
- CI artifact 增加截图路径，便于失败后回看报告页状态

影响：
- 报告页视觉改动不再完全依赖人工肉眼检查
- 工程成熟度 v0.2 中“报告页截图或视觉回归验收”缺口被补上
- 本仓库成熟度从 `85/100` 提升到 `89/100`

相关文件：
- `tests/screenshot-regression.sh`
- `tests/screenshots/.gitkeep`
- `tests/run-tests.sh`
- `.github/workflows/ci.yml`
- `.gitignore`

---

#### 增加 GitHub Actions CI

改动：
- 新增 `.github/workflows/ci.yml`
- CI 在 push、pull request 和手动触发时运行
- CI 覆盖 shell 语法检查、JSON 解析、`tests/run-tests.sh`、报告生成、报告关键标记检查和 tracked files 变更检查
- CI 会上传 markdown / HTML 报告 artifact，方便失败时查看
- `docs/TESTING.md` 和 `docs/RUNBOOK.md` 同步说明 CI 与本地测试脚本的关系

影响：
- `tests/run-tests.sh` 不再只靠维护者手动记得运行
- 工程成熟度 v0.2 中 CI 缺口被补上
- 本仓库成熟度从 `79/100` 提升到 `85/100`

相关文件：
- `.github/workflows/ci.yml`
- `docs/TESTING.md`
- `docs/RUNBOOK.md`

---

#### 增加评分模型 schema 和 v0.2 数据源

改动：
- 新增 `schemas/ai-project-score.schema.json`，定义评分模型结构
- 新增 `schemas/ai-project-score.v0.2.json`，记录上下文完整度和工程成熟度的维度、分值和检测方式
- `scripts/check-ai-project.sh` 改为识别评分模型 schema 和 v0.2 数据源
- `tests/run-tests.sh` 增加评分模型存在性检查
- `docs/NAMING.md` 和 `docs/DOCUMENTATION.md` 增加 `schemas/` 命名与文档边界

影响：
- 评分规则不再只藏在 shell 脚本里
- 工程成熟度 v0.2 中“评分模型 schema”缺口被补上
- 后续拆报告 UI 或增加测试时，可以围绕同一份评分模型数据继续收口

相关文件：
- `schemas/ai-project-score.schema.json`
- `schemas/ai-project-score.v0.2.json`
- `scripts/check-ai-project.sh`
- `tests/run-tests.sh`
- `docs/NAMING.md`
- `docs/DOCUMENTATION.md`

---

#### 增加 strict 模板同步和可执行回归测试入口

改动：
- `scripts/check-template-sync.sh` 增加 `--strict`，发现模板不同步时可退出失败，用作质量门禁
- 新增 `tests/run-tests.sh`，串起 runtime 检查、模板 strict 检查、报告生成和 `core` / `product` / `full` 安装 profile 回归
- `docs/TESTING.md` 和 `docs/RUNBOOK.md` 更新正式测试入口

影响：
- 源仓库维护不再只靠手动复制运行手册命令
- 安装 profile 的关键文件边界可以被一条命令复测
- 工程成熟度 v0.2 中“可执行测试入口”和“安装 profile 自动化回归”缺口被补上

相关文件：
- `scripts/check-template-sync.sh`
- `tests/run-tests.sh`
- `docs/TESTING.md`
- `docs/RUNBOOK.md`

---

#### 将完整度检查升级为双分数模型

改动：
- `scripts/check-ai-project.sh` 新增 `AI 工程成熟度`，与原有上下文完整度分开计算
- 成熟度 v0.2 检查评分模型、状态同步、可执行测试、fixtures、CI、严格模板同步、报告 UI 工程化、发布闭环和跨工具验收
- HTML 报告主结论改为展示工程成熟度，避免“文件齐全”误判为“工程闭环完整”
- `scripts/ai-project.sh report` 改为默认生成 markdown 和 HTML 报告
- `docs/TESTING.md`、`docs/RUNBOOK.md`、`docs/DECISIONS.md` 同步解释双分数口径

影响：
- 本仓库当前上下文完整度为 100/100，但工程成熟度会暴露真实缺口
- 后续补齐顺序更清楚：优先测试入口、fixtures、严格模板同步、评分 schema、CI 和报告组件化
- 非技术用户看到报告时，不会再把“文档骨架完整”理解成“项目已经完全工程化”

相关文件：
- `scripts/check-ai-project.sh`
- `scripts/ai-project.sh`
- `docs/TESTING.md`
- `docs/RUNBOOK.md`
- `docs/DECISIONS.md`

---

#### 增加自身工程化路线图和状态同步

改动：
- 在 `docs/PRODUCT_PLAN.md` 增加 AI Engineering Kit 自身工程化补齐主线，按 P0 / P1 / P2 / P3 拆分真实评分、可执行测试、报告 UI 工程化、老项目接入和发布闭环
- 将当前阶段同步为“AI Engineering Kit 自身工程化收口期”
- 同步更新 `PROJECT.md` 和 `.project-os/state.json`，避免当前状态与机器可读状态漂移
- 在 `docs/DECISIONS.md` 记录“不新增 TODO 文档，路线图归入 PRODUCT_PLAN”的决策
- 修正 `docs/DESIGN_STANDARDS.md` 对报告页组件契约的描述，避免继续声称完全没有真实 UI

影响：
- 当前完整度 100/100 被明确为“文件骨架完整”，不再等同于真实工程成熟
- 下一步补齐顺序从零散讨论收敛为 P0 到 P3 的路线图
- 后续新增测试、报告组件、评分模型或 CI 时，有明确文档归位

相关文件：
- `docs/PRODUCT_PLAN.md`
- `PROJECT.md`
- `.project-os/state.json`
- `HANDOFF.md`
- `docs/DECISIONS.md`
- `docs/DESIGN_STANDARDS.md`

---

## 2026-05-18

### AI Engineering Kit / completeness check

#### 增加 AI 工程完整度体检和主流文档命名规范

改动：
- 新增 `docs/NAMING.md`，明确根目录、`docs/`、工具 adapter 和生成报告的命名规则
- 新增 `docs/ARCHITECTURE.md`、`docs/ENVIRONMENT.md`、`docs/RUNBOOK.md`，补齐架构、环境和运行手册入口
- 新增 `scripts/check-ai-project.sh`，按系统规则、开发者规则、用户意图、项目文件、工具反馈、交接摘要等维度输出 100 分完整度报告
- 新增 `scripts/ai-project.sh`，提供 `check` / `report` / `install` 三个更直白的入口
- 更新安装 profile，`core` 带检查脚本，`product` 带 AI 工程治理文档
- 更新目标项目模板，补齐命名、架构、环境和运行手册模板

影响：
- 工具定位从单纯 Project OS 安装器，扩展为通用 AI 工程文件检查和补齐工具包
- 已有项目可以先跑体检报告，再决定是否补文档，不必默认覆盖已有文档
- 文档命名更接近主流约定：平台约定文件保留原名，工程治理文档集中在 `docs/`

相关文件：
- `README.md`
- `INSTALL.md`
- `AGENTS.md`
- `docs/NAMING.md`
- `docs/ARCHITECTURE.md`
- `docs/ENVIRONMENT.md`
- `docs/RUNBOOK.md`
- `scripts/check-ai-project.sh`
- `scripts/ai-project.sh`
- `templates/project/`

---

## 2026-05-14

### Project OS / install profile

#### 将安装产物改为 profile-based 轻量分发

改动：
- `scripts/install-project-os.sh` 支持 `--profile core|product|full`
- 默认非交互安装使用 `core`，只安装 `AGENTS.md` / `PROJECT.md` / `HANDOFF.md` / `scripts/check-runtime.sh`
- 终端手动执行且未传 profile 时，会询问项目类型、是否需要设计规范、skills 和 adapters
- `scripts/check-runtime.sh` 改为识别轻量安装，不再要求每个目标项目都带 `.claude/skills`、adapters 和完整 docs
- `README.md` / `INSTALL.md` / `docs/DOCUMENTATION.md` 同步 profile 分发边界

影响：
- 源仓库继续保留完整 runtime，目标项目默认拿到更干净的最小协作入口
- 老项目接入时不再默认覆盖 `README.md` 或塞入整套 hooks / tests / adapters
- 需要完整 Project OS 能力时，仍可用 `--profile full` 或按需启用 `--with-design` / `--with-skills` / `--with-adapters`

相关文件：
- `scripts/install-project-os.sh`
- `scripts/check-runtime.sh`
- `README.md`
- `INSTALL.md`
- `docs/DOCUMENTATION.md`
- `templates/project/`

---

## 2026-05-11

### Project OS / distribution boundary

#### 收紧源仓库、本地增强和目标项目模板边界

改动：
- 在 `docs/DOCUMENTATION.md` 明确三条维护线：源仓库线、用户模板线、本地增强线
- 新增 `templates/project/AGENTS.md`，让目标项目拿到轻量 AI 规则入口
- 调整 `scripts/install-project-os.sh`，目标项目使用模板版 `AGENTS.md`
- 主安装脚本不再分发 `.claude/settings.local.json` 和本地 `CLAUDE.md`
- 补强 `.gitignore`，排除环境文件、构建产物、真实用户画像和本地增强文件

影响：
- 目标项目不会继承源仓库自己的收口规则、测试历史或个人本地 Claude 配置
- `AGENTS.md` 仍是目标项目 AI 规则入口，但安装后版本更轻
- Claude 专属入口改由 `scripts/install-adapter.sh claude .` 显式安装

相关文件：
- `.gitignore`
- `INSTALL.md`
- `templates/project/AGENTS.md`
- `scripts/install-project-os.sh`
- `scripts/check-runtime.sh`
- `docs/DOCUMENTATION.md`

---

## 2026-05-08

### Project OS / distribution

#### 增加可自动安装的分发入口

改动：
- 新增 `INSTALL.md`，提供给人和 AI 的安装说明
- 新增 `scripts/install-project-os.sh`，支持把 Project OS 安装到目标目录
- 新增 `adapters/`，提供 Claude / Codex / Cursor / Gemini 适配模板
- 新增 `scripts/install-adapter.sh`，支持按工具写入对应模型/工具入口文件
- 在 `README.md` 增加“给别人使用”的自然语言安装提示
- 在 `check-runtime.sh` 中检查安装说明和安装脚本
- 使用临时空目录完成试装，并通过目标目录内的 `check-runtime.sh` 校验

影响：
- 使用者拿到 GitHub 地址后，可以直接让 AI clone 源仓库并运行安装脚本
- 安装脚本会复制 Project OS 核心文件，并把冲突文件备份到 `.project-os/backups/`
- adapter 让 Claude / Codex / Cursor / Gemini 读取各自入口文件，但规则源头仍然是 `AGENTS.md`
- Project OS 从“可 clone 的 starter”升级为“可安装到已有项目的 runtime”

相关文件：
- `INSTALL.md`
- `README.md`
- `scripts/install-project-os.sh`
- `scripts/install-adapter.sh`
- `adapters/`
- `scripts/check-runtime.sh`
- `PROJECT.md`
- `HANDOFF.md`
- `docs/CHANGELOG.md`

---

## 2026-05-09

### Project OS / document governance tightening

#### 将文档边界、模板分层和轻量校验闭环接起来

改动：
- 新增 `templates/global/`，把全局用户偏好、用户画像和 memory 规则从根目录 / `docs/` 收回模板层
- 在 `docs/DOCUMENTATION.md` 增加 “PROJECT / HANDOFF / PRODUCT_PLAN 怎么判断该写哪” 的决策规则
- 将 `docs/PRODUCT_PLAN.md` 改成正式的 `v1 / v1.5 / v2 / v3` 产品化路线
- 将根目录 `PROJECT.md`、`HANDOFF.md` 压瘦成“当前状态”和“当前交接”两类短文档
- 在 `AGENTS.md` 和 `scripts/check-runtime.sh` 中加入文档更新前置规则与轻量自动校验

影响：
- 后续新建或更新文档时，不必靠记忆判断写哪一份
- 项目模板、全局模板、源仓库历史的边界更清楚
- `check-runtime.sh` 能更早发现文档串边界和缺关键标题的问题

相关文件：
- `templates/global/`
- `docs/DOCUMENTATION.md`
- `docs/PRODUCT_PLAN.md`
- `PROJECT.md`
- `HANDOFF.md`
- `AGENTS.md`
- `scripts/check-runtime.sh`

---

### Project OS / global template grouping

#### 将全局用户模板与 memory 规则收回模板层

改动：
- 新增 `templates/global/`，统一存放全局用户偏好、全局用户画像和 memory 规则模板
- 移除根目录 `GLOBAL_USER_*` 和 `docs/MEMORY_RULES.md` 的悬空位置
- 在 `README.md`、`docs/DOCUMENTATION.md`、`scripts/check-runtime.sh` 中同步新的结构边界和校验

影响：
- 根目录入口更轻，不再混入全局协作模板
- 项目模板和全局模板边界更清楚，安装到目标项目时不容易误会
- 后续如果接入全局 memory 或用户画像能力，有明确模板落点

相关文件：
- `templates/global/`
- `README.md`
- `docs/DOCUMENTATION.md`
- `scripts/check-runtime.sh`

---

### Project OS / install templates

#### 将安装包文档拆成“源仓库文档”和“目标项目模板”

改动：
- 新增 `templates/project/`，存放目标项目用的 README / PROJECT / HANDOFF / CHANGELOG 等模板
- 调整 `scripts/install-project-os.sh`，安装时不再直接复制源仓库自己的状态文档
- 在 `INSTALL.md`、`README.md`、`docs/DOCUMENTATION.md` 中说明安装模板边界

影响：
- 别人安装 Project OS 时，不会拿到本源仓库自己的交接、变更历史和项目状态
- 安装结果更像“干净起步模板”，而不是“连源仓库历史一起搬过去”
- 源仓库文档继续只服务 `project-os-starter` 自己
- 每个目标项目模板顶部都带填写说明，后续新建文档更不容易跑偏

相关文件：
- `templates/project/`
- `scripts/install-project-os.sh`
- `INSTALL.md`
- `README.md`
- `docs/DOCUMENTATION.md`

---

### Project OS / documentation model

#### 明确 AI 工程项目的四层分层模型

改动：
- 在 `docs/DOCUMENTATION.md` 增加“AI 工程项目四层模型”
- 在 `README.md` 增加简版结构图和根目录 5 个关键入口说明

影响：
- 后续讨论 `PROJECT.md`、`HANDOFF.md`、`README.md` 是否过重时，有统一判断框架
- 更容易识别文档是不是越层，比如把历史写进 `PROJECT.md`、把规则写进 `README.md`

相关文件：
- `docs/DOCUMENTATION.md`
- `README.md`

---

### Project OS / documentation governance

#### 增加文档编写规范和更新边界

改动：
- 新增 `docs/DOCUMENTATION.md`，定义 README / AGENTS / PROJECT / HANDOFF / CHANGELOG 等文件职责
- 在 `docs/DOCUMENTATION.md` 增加文档结构契约：Required / Recommended / Reference Implementation
- 在 `AGENTS.md` 增加文档更新规则和 SSOT 指向
- 在 `README.md`、`PROJECT.md`、`HANDOFF.md` 同步文档治理入口和当前状态
- 在 `check-runtime.sh` 中检查文档治理文件

影响：
- 后续不用默认同时更新所有核心文档
- 当前状态、交接上下文、历史变更、架构决策和错误复盘有了明确边界
- 文档维护从“口头约定”变成可校验的 Project OS 规则

相关文件：
- `docs/DOCUMENTATION.md`
- `AGENTS.md`
- `README.md`
- `PROJECT.md`
- `HANDOFF.md`
- `scripts/check-runtime.sh`

---

### Project OS / install-init continuation

#### 修复空目录初始化停在安装总结的问题

改动：
- 在 `AGENTS.md` 明确 `INSTALL / INIT` 第一响应和继续进入 INIT start mode 的要求
- 在 `project-setup/SKILL.md`、`references/install.md`、`references/init.md` 增加强制 continuation 规则
- 在 `adapters/` 同步各工具的安装后续行为
- 在 `tests/` 和 `docs/LESSONS.md` 补充对应测试和复盘

影响：
- 空目录里“初始化并接入 Project OS”不再只停在安装成功
- 安装完成后会在同一轮继续进入 INIT，并要求明确启动方式
- 更贴近真实用户意图，也更容易做 CLI / 桌面端人工验收

相关文件：
- `AGENTS.md`
- `.claude/skills/project-setup/SKILL.md`
- `.claude/skills/project-setup/references/install.md`
- `.claude/skills/project-setup/references/init.md`
- `adapters/`
- `tests/cases.md`
- `tests/cross-tool-matrix.md`
- `docs/LESSONS.md`

---

### Project OS / platform-neutral wording

#### 将系统定位收紧为“通用内核 + 工具适配层”

改动：
- 在 `AGENTS.md` 明确 `AGENTS.md` 是规则源头
- 把 `.claude/*` 标注为当前参考实现，而不是唯一宿主
- 在 `README.md` 和 `INSTALL.md` 中强调 `adapters/*` 负责各工具入口文件
- 在 `PROJECT.md` / `HANDOFF.md` 同步当前定位

影响：
- 使用者更容易理解 Project OS 本体不依赖 Claude
- Claude、Codex、Cursor、Gemini 现在都被表述为同一套核心规则的不同适配入口
- 后续继续扩展别的工具时，不需要重写系统本体

相关文件：
- `AGENTS.md`
- `README.md`
- `INSTALL.md`
- `PROJECT.md`
- `HANDOFF.md`

---

### Project OS / cross-tool testing

#### 增加 CLI 与可代码桌面端共用的验收矩阵

改动：
- 新增 `tests/cross-tool-matrix.md`
- 新增 `scripts/create-test-fixtures.sh`
- 在 `README.md`、`docs/TESTING.md`、`tests/cases.md` 中加入跨工具测试入口
- 在 `check-runtime.sh` 中检查跨工具测试材料

影响：
- 可以生成空目录、已有代码项目、已安装 Project OS 三类测试目录
- Codex、Claude Code、可代码桌面端可以按同一张表验证 INSTALL FLOW
- 测试重点从“所有工具原生支持同一命令”转为“所有工具理解同一意图并进入同一套路由”

相关文件：
- `tests/cross-tool-matrix.md`
- `scripts/create-test-fixtures.sh`
- `README.md`
- `docs/TESTING.md`
- `tests/cases.md`
- `scripts/check-runtime.sh`

---

## 2026-05-06

### Project OS / install flow

#### 增加自然语言 + `/os` 双入口安装流程

改动：
- 新增 `references/install.md`
- 在 `project-setup/SKILL.md` 中加入 Project OS Installation Entry
- 支持自然语言触发 INSTALL FLOW
- 支持显式 `/os` 兜底入口
- 新增 `.claude/commands/os.md`
- 在测试用例中补充 INSTALL FLOW 相关 case

影响：
- 普通用户不用记命令，可以直接说“帮我初始化这个项目”
- 高级用户可以用 `/os` 明确触发安装 / 接入 / 检查
- INSTALL FLOW 会先判断目录状态，再决定 INIT / HYBRID / CHECK-UPGRADE / AUDIT
- 已复测自然语言入口：初始化已安装目录进入 `INSTALL / CHECK-UPGRADE`，接管老项目进入 `INSTALL / HYBRID`
- 已确认 `/os` 在 Claude Code 交互模式中可被发现；`-p` print 模式不展开 slash commands

相关文件：
- `.claude/skills/project-setup/SKILL.md`
- `.claude/skills/project-setup/references/install.md`
- `.claude/commands/os.md`
- `.claude/skills/tests/cases.md`
- `tests/cases.md`
- `README.md`
- `scripts/check-runtime.sh`

---

## 2026-05-06

### Project OS / slash commands

#### 增加显式 `/` 操作入口

改动：
- 新增 `/os-check`：运行 Project OS 体检并汇总工作区状态
- 新增 `/os-test`：运行或引导 v1 路由测试
- 新增 `/os-handoff`：汇总当前状态、提交情况和下一步
- 在 `README.md` 增加常用 slash commands 说明
- 在 `check-runtime.sh` 中检查这些 slash command 文件是否存在

影响：
- 使用者不需要记住所有 shell / CLI 命令
- `/` 命令作为显式操作按钮，不做强制自动门禁
- 自动化仍保持轻量，避免 CLI 登录态或模型输出不稳定导致误伤

相关文件：
- `.claude/commands/os-check.md`
- `.claude/commands/os-test.md`
- `.claude/commands/os-handoff.md`
- `README.md`
- `PROJECT.md`
- `HANDOFF.md`
- `scripts/check-runtime.sh`

---

## 2026-05-06

### Project OS / docs 收口

#### 清理旧模板文档并统一 SSOT

改动：
- 删除 `docs/PROJECT.md` 和 `docs/HANDOFF.md`
- 将当前状态和交接上下文统一到根目录 `PROJECT.md` / `HANDOFF.md`
- 将 `docs/PRODUCT_PLAN.md` 改成 Project OS 当前路线图
- 将 `docs/DECISIONS.md` 改成真实架构决策记录
- 将 `docs/DESIGN_STANDARDS.md` 改成当前阶段的设计规则边界
- 将 `docs/LESSONS.md` 改成真实错误模式记录
- 将 `docs/design/component-index.md` 改成当前无组件状态说明
- 将 `tests/cases.md` 改成 v1 测试索引，详细记录仍在 `.claude/skills/tests/cases.md`

影响：
- `docs/` 不再保留和根目录冲突的项目状态 / 交接文档
- 后续查当前状态只看 `PROJECT.md`
- 后续查当前交接只看 `HANDOFF.md`
- `docs/` 只承接长期规范、决策、测试和设计参考

相关文件：
- `PROJECT.md`
- `HANDOFF.md`
- `docs/PRODUCT_PLAN.md`
- `docs/DECISIONS.md`
- `docs/DESIGN_STANDARDS.md`
- `docs/LESSONS.md`
- `docs/TESTING.md`
- `docs/design/component-index.md`
- `tests/cases.md`

---

## 2026-05-06

### Project OS / 路由收口

#### 修复 v1 路由契约与 CLI print 模式入口偏移

改动：
- 在 `AGENTS.md` 增加 v1 路由契约和固定第一响应模板
- 在 `CLAUDE.md` 同步 Claude 专属的 v1 验收第一响应
- 强化 `project-setup` 的 CLARIFICATION / INIT Start Mode / HYBRID 规则
- 强化 `design-system` 对 Design Tokens 请求的触发
- 强化 `frontend` 对具体页面 / 组件请求的触发
- 记录 7 条 CLI 复测结果：7 条 pass

影响：
- 项目级请求不再优先滑向泛澄清或直接技术选型
- INIT 请求会先确认启动方式，再进入技术栈 / 功能范围讨论
- `设计 tokens` 能稳定进入 `design-system`
- 登录页请求会先输出 `Skill: frontend`，再进入技术栈 / 样式 / 登录方式确认

相关文件：
- `AGENTS.md`
- `CLAUDE.md`
- `PROJECT.md`
- `HANDOFF.md`
- `.claude/skills/project-setup/SKILL.md`
- `.claude/skills/project-setup/references/clarification.md`
- `.claude/skills/project-setup/references/init.md`
- `.claude/skills/project-setup/references/hybrid.md`
- `.claude/skills/design-system/SKILL.md`
- `.claude/skills/frontend/SKILL.md`
- `.claude/skills/tests/cases.md`

<!-- 更早的日期往下追加，新的在上 -->
