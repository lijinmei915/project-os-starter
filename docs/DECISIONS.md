---
layer: knowledge
type: log
last_verified: 2026-07-20
teaches: "历史关键决策的原因、被放弃的备选方案和决策影响"
use_when: "AI 需要理解某个架构选择的背景、或面临类似决策需要参考先例时"
---

# 架构决策记录

> 用途：记录重要决策、放弃项、原因和影响，回答“为什么这么定”。
> 什么时候更新：出现正式架构、产品、协作规则或分发策略决策时。
> 不要写什么：当前状态流水、小修记录、临时 TODO、当前交接事项。
> 记录重要的技术决策和原因，防止重复踩坑。
> 格式：决定 / 放弃 / 原因 / 影响。

---

## 决策列表

### OmniDesk

#### D019 — OmniDesk Desktop Runtime 是唯一产品内核

**决定**: OmniDesk 只保留一个产品内核：`desktop/` 内的 React Workbench 与 Tauri Local Agent Runtime。早期 Project OS CLI、安装器、评分报告、模板和跨工具 adapter 全部冻结，只在状态迁移和依赖断开期间承担兼容作用；新能力不得继续落入旧工具链。

**放弃**: 不再同时维护“OmniDesk 桌面产品”和“Project OS 分发产品”两条产品主线；不直接删除 `.project-os/` 或整目录改名；不让 Desktop 永久依赖旧 CLI 和 Shell 治理算法。

**原因**:
- 当前用户价值、权限边界、对话、任务、Patch、检查、终端和证据全部由 Desktop Runtime 承担。
- 两套产品叙述共用状态、文档、CI 和测试，会持续误导 AI 路由并扩大维护面。
- `.project-os/` 已包含真实用户任务、目标、对话和 Provider 元数据，直接删除或改名会造成数据丢失。

**影响**:
- `PROJECT.md`、`.project-os/state.json` 和 `docs/ARCHITECTURE.md` 统一描述 OmniDesk Desktop Runtime。
- 目标状态根为 `.omnidesk/`，按 `data/runtime/cache/evidence` 分区，并通过幂等迁移兼容 `.project-os/`。
- `cli/`、旧 scripts、templates、adapters 和 routing skill 只有在 Desktop、CI、测试及文档引用全部断开后才能删除。
- 长任务恢复、Provider、Hermes、Patch、检查和 Eval 后续只在 Desktop Runtime 内演进。

### Legacy Project OS

#### D018 — Shell 统一入口只是过渡形态，长期迁到原生 CLI

**决定**: `scripts/ai-project.sh` 继续作为当前最小统一入口和兼容 wrapper，但长期入口层必须抽出原生 CLI 程序和可复用 core library。Gateway、CI、Desktop 后续应调用标准接口或原生 CLI / library core，不直接绑定一组分散 Shell 脚本。

**放弃**: 不把 Shell 脚本当成长期入口层底座；不让 Web / CI / Desktop 各自复制一套治理逻辑；不在 Shell 中继续堆复杂鉴权、限流、结构化日志、错误码和跨平台进程协议。

**原因**:
- Windows 原生 `cmd` / PowerShell 场景对 Shell 依赖不友好，常需要 Git Bash / WSL。
- Shell 对参数标准化、结构化日志、异常封装和错误码治理较脆弱。
- Gateway / CI / Desktop 需要稳定的进程间接口和结构化返回，文件 + shell 进程只能支撑过渡期。
- Entry Context、报告、推荐、patch、run record 已经进入结构化阶段，执行底座也应该逐步结构化。

**影响**:
- 当前 `ai-project.sh` 只定义命令语义和过渡执行，不代表最终技术形态。
- 新增复杂治理能力必须同时考虑 CLI binary / core library 的迁移路径。
- 后续应设计 `project-os` 原生命令：`scan`、`check`、`recommend`、`report`、`plan`、`draft`、`validate`。
- Shell wrapper 应在原生 CLI 可用后优先委托给 binary，不可用时再 fallback 到 legacy shell flow。

#### D001 — Project OS 先做纯内置闭环

**决定**: v1 只包含 `project-setup`、`design-system`、`frontend`、references、tests、registry、changelog。

**放弃**: 暂不依赖外部 `intent-clarifier` 或第三方 skill。

**原因**:
- 先保证自己的入口、路由、测试和交接闭环自洽。
- 外部 skill 会引入不可控分流，影响 v1 验收稳定性。

**影响**:
- 模糊需求由 `project-setup/references/clarification.md` 内部处理。
- `REGISTRY.md` 只登记 Project OS 自己的 skill。

---

#### D002 — 根目录文件作为 SSOT

**决定**: 根目录 `README.md` / `AGENTS.md` / `PROJECT.md` / `HANDOFF.md` 分别承担入口说明、AI 规则、当前状态、交接上下文。

**放弃**: 不再保留 `docs/PROJECT.md` / `docs/HANDOFF.md` 作为核心文档。

**原因**:
- 同名文档分散在 `docs/` 和根目录会造成职责冲突。
- 根目录文件更容易被 AI 和人类入口优先读取。

**影响**:
- `docs/` 只保留长期规范、决策、测试、变更记录和设计参考。
- 当前状态和当前交接只看根目录文件。

---

#### D003 — v1 路由用固定第一响应验收

**决定**: 对核心路由 case 使用固定第一响应或固定前缀，例如 `Skill: frontend`。

**放弃**: 只靠隐含语义判断 skill 是否命中。

**原因**:
- Claude CLI print 模式不一定显式展示 skill banner。
- 固定第一响应能让人工和测试记录都更容易判断。

**影响**:
- Case 7 “帮我写一个登录页”必须先输出 `Skill: frontend`。
- INIT 请求必须先问启动方式，不先问技术栈、数据库、权限或组件库。

---

#### D004 — 自身工程化路线图归入 PRODUCT_PLAN

**决定**: AI Engineering Kit 自身工程化补齐清单统一写入 `docs/PRODUCT_PLAN.md`，按 P0 / P1 / P2 / P3 管理。

**放弃**: 不新增 `TODO.md`、`BACKLOG.md` 或临时任务清单文档。

**原因**:
- 这批内容是中长期工程化路线，不是当前交接流水。
- `docs/NAMING.md` 明确不建议使用 `todo.md` 这类无边界文件。
- `PROJECT.md` 和 `HANDOFF.md` 只保留当前状态和下一步摘要，避免长期路线重复散落。

**影响**:
- 全量清单以 `docs/PRODUCT_PLAN.md` 为准。
- 当前阶段摘要同步到 `PROJECT.md` 和 `.project-os/state.json`。
- 下一步执行摘要同步到 `HANDOFF.md`。
- 具体测试策略、设计组件和运行手册仍分别回到 `docs/TESTING.md`、`docs/DESIGN_STANDARDS.md`、`docs/RUNBOOK.md`。

---

#### D005 — 完整度分数拆成上下文完整度和工程成熟度

**决定**: `scripts/check-ai-project.sh` 同时输出 `AI 工程上下文完整度` 和 `AI 工程成熟度`。

**放弃**: 不再用单一 100 分代表项目整体靠谱程度。

**原因**:
- 文件齐全只能说明 AI 大概率能读懂项目，不代表测试、发布、报告和跨工具验证已经闭环。
- 本仓库已经能跑到上下文完整度 100/100，但仍缺少可执行测试、CI、评分 schema、报告 UI 工程化和发布自动化。
- 两条分数能避免误导非技术用户，也方便后续按缺口逐项补齐。

**影响**:
- HTML 报告主结论优先展示工程成熟度。
- Markdown 报告保留上下文完整度细项，同时新增 `工程成熟度 v0.2`。
- `scripts/ai-project.sh report` 默认生成 markdown 和 HTML 两份报告。
- 后续 P1 优先补能提升工程成熟度的测试入口、fixtures、严格模板同步和 CI。

---

#### D006 — 评分模型沉淀到 schemas/

**决定**: 将 AI 项目评分模型拆成 `schemas/ai-project-score.schema.json` 和 `schemas/ai-project-score.v0.2.json`。

**放弃**: 不让评分维度、分值和检测方式只存在于 `scripts/check-ai-project.sh`。

**原因**:
- 单靠 shell 里的判断不利于复查、迁移和后续 UI / 测试复用。
- JSON Schema 负责约束评分模型结构，版本化数据文件负责记录当前 v0.2 规则。
- AI 和人都能先读机器可读模型，再理解报告为什么扣分。

**影响**:
- `scripts/check-ai-project.sh` 会识别 schema 和 v0.2 数据源。
- `tests/run-tests.sh` 会检查评分模型文件存在且可识别。
- 后续如果把报告 UI 从 shell 中拆出，应优先复用 `schemas/ai-project-score.v0.2.json`。

---

#### D007 — 报告 UI 先抽模板层，不立即引入前端构建

**决定**: 将 HTML 报告抽到 `templates/report/ai-project-report.html`，由 `scripts/check-ai-project.sh` 注入评分、缺口列表和模块卡片。

**放弃**: 暂不为了报告页引入 React / Vite / 组件库构建链。

**原因**:
- 当前核心目标是让报告 UI 不再内联在 shell 主逻辑里，先降低维护风险。
- 引入前端构建会扩大安装包和运行环境要求，不适合 `core` profile。
- 静态模板已经能支撑当前报告页交互和回归检查。

**影响**:
- `core` profile 需要安装 `templates/report/ai-project-report.html`。
- 后续视觉和交互调整优先改模板，不再翻 `check-ai-project.sh` 里的大段 HTML。
- 动态模块卡片当时仍由 shell 组装，后续需迁到结构化数据。

---

#### D008 — 报告模块定义沉淀到 schemas/

**决定**: 将报告模块标题、评分 section 分组和说明文案拆成 `schemas/ai-project-report.schema.json` 和 `schemas/ai-project-report.v0.1.json`。

**放弃**: 不再把六个报告模块写死在 `scripts/check-ai-project.sh` 的循环和 `case` 文案里。

**原因**:
- 报告模块是产品信息架构，不应该只藏在 shell 代码里。
- 模块数据进入 `schemas/` 后，人、AI、测试和未来前端组件都能复用同一份结构。
- 继续保持纯 Bash + 静态 HTML，不额外引入 `jq`、Node 渲染或前端构建依赖，避免扩大 `core` profile 成本。

**影响**:
- `scripts/check-ai-project.sh` 生成 HTML 时读取 `schemas/ai-project-report.v0.1.json`。
- `core` profile 需要安装报告 schema 和 v0.1 数据源。
- `tests/run-tests.sh` 和 CI 会检查报告数据源存在且可解析。

---

#### D009 — 已退役的跨工具 adapter 分发验收

**决定**: 这是旧 Project OS v0.2 的 adapter 分发验收决策，现已退役；OmniDesk 不再维护跨工具入口生成或其自动化矩阵。

**放弃**: 不把当前自动化结果描述为“真实 Claude / Codex / Cursor / Gemini 会话全部完整验证”。

**原因**:
- 不同工具的真实模型会话受平台、版本、上下文窗口和权限影响，难以在本地脚本里稳定复现。
- 当前最稳定可测的是：安装器能生成正确入口，adapter 不另起规则源头，并且路由契约都指向 `AGENTS.md`。
- 真实工具会话仍适合在发布前抽样复查，而不是作为每次本地回归的硬依赖。

**影响**:
- 历史 adapter 验收材料随旧分发链退役。
- 现行产品验收以 Desktop Runtime、原生 smoke 与受保护 Agent Eval 为准。

---

#### D010 — 老项目文档评分必须看质量，不只看文件名

**决定**: `scripts/check-ai-project.sh` 在检查 `AGENTS.md`、`PROJECT.md`、`HANDOFF.md` 和关键 `docs/*` 时，必须先判断文档是否有足够有效内容，再判断关键词。

**放弃**: 不再只因文件存在就给上下文完整度分。

**原因**:
- 老项目常见情况是“文档都有，但里面是 TODO、未记录、占位模板”，这种状态并不能帮助 AI 接手。
- 只看文件名会让非技术用户误以为项目已经工程化完整。
- 质量识别先用轻量启发式，排除空白、标题、引用说明、表格头、TODO、未记录、占位符等低信息量内容。

**影响**:
- 空模板文档会被报告为缺口。
- `tests/run-tests.sh` 增加老项目占位文档夹具，防止评分退回“只看文件是否存在”。
- `schemas/ai-project-score.v0.2.json` 增加 `substantive_file` / `substantive_content_any` 等检测语义。

---

#### D011 — 不用 API，报告返回值落到文件

**决定**: AI Engineering Kit 的本地真实执行继续走命令行脚本，报告返回值写入 `.project-os/reports/ai-project-report.md`、`.html` 和 `.json`。

**放弃**: 暂不为静态报告页增加本地 API、后端服务或浏览器直接执行 shell 的能力。

**原因**:
- 静态报告页不能安全地直接执行用户电脑上的命令。
- 本地 API 会引入服务生命周期、端口、安全边界和跨平台维护成本。
- 文件型返回值足够让网页、CLI 和其他 AI 工具读取结果，同时保持 `core` profile 轻量。

**影响**:
- 页面里的真实操作入口应优先做成“复制命令”，由用户在终端执行。
- `scripts/add-project-docs.sh` 负责追加工程文档模板，默认不覆盖已有文档。
- `ai-project-report.json` 是机器可读返回值，不替代 `PROJECT.md` / `HANDOFF.md` 等项目 SSOT。

---

#### D012 — 关系图先做本地静态生成物

**决定**: 项目理解能力先由 `scripts/build-project-graph.sh` 生成 `.project-os/graph/project-graph.json`，记录文件节点、层级、SSOT 标记、模板标记、引用关系和 `.ai/rules` 映射。

**放弃**: 暂不安装第三方 Understand Anything skill，不接 LLM 分析，不做实时 dashboard。

**原因**:
- 当前阶段仍是稳定内核，不能把项目带偏成外部可视化工具。
- Project OS 更需要“工程规则和交接影响关系”，而不是通用代码图谱。
- 先用 Bash 静态扫描生成机器可读 JSON，能保持 `core` profile 轻量且可测试。

**影响**:
- `core` profile 分发 `scripts/build-project-graph.sh`。
- 生成物放在 `.project-os/graph/`，默认不提交。
- 后续影响分析或报告页关系图入口可以读取该 JSON，但不得替代 `docs/ARCHITECTURE.md` 和人工 review。

---

#### D013 — 文档元数据用 YAML frontmatter，与人读引用块并存

**决定**: 每个文档在文件最顶部加 YAML frontmatter（`layer` / `type` / `last_verified` / `depends_on`），作为机器可读元数据；原有 `> 用途 / 什么时候更新 / 不要写什么` 引用块保留，作为人读元数据。规范见 `docs/KNOWLEDGE_SCHEMA.md`。

**放弃**: 不复用现有 `>` 引用块做机器解析（格式松散、不稳定）；不引入独立元数据文件（与文档分离易失同步）；不上 tree-sitter / AST 解析（我们是文档治理工具，知识载体是 .md，不是任意代码）。

**原因**:
- YAML frontmatter 是 AI 工具标准约定（Cursor `.mdc` 同款），AI 读 `.ai/rules/` 软链接时能正常识别并跳过。
- frontmatter 与文档同文件，不会失同步。
- 机读 / 人读两套元数据各管一摊，互不替代。

**影响**:
- `build-project-graph.sh` 解析 frontmatter，输出 archLayer / lastVerified / stale / declares_dependency。
- `check-ai-project.sh` 按元数据完整度和新鲜度评分（v0.4）。
- `architecture-diagram.html` 读图谱按 archLayer 自动渲染。
- 新增文档必须按 `docs/KNOWLEDGE_SCHEMA.md` 补 frontmatter。

---

#### D014 — 锁定北极星为组织级 AI 研发中台，按四级台阶演进

**决定**: 终极目标锁定为对标 LLM-Wiki 知识库 + 专家技能包的组织级 AI 研发中台。演进按四级台阶按序推进：P1 知识驱动 → P2 主动专家 → P3 操作工程 → P4 编排成 Agent。路线图见 `docs/PRODUCT_PLAN.md` 北极星章节，可跟踪拆解在 goal 任务看板。

**放弃**: 不一步跳到接代码仓/DB（跳级即塌）；不先做组织级分发（先单项目跑通 P1-P2）。

**原因**:
- 参考架构自下而上依赖：没有结构化知识地基，上层专家技能是空中楼阁。Project OS 现有知识地基正是中台底座，沿依赖顺序往上盖最稳。
- 顺序反了会把风险从入口扩散到工具与安全。

**影响**:
- `docs/PRODUCT_PLAN.md` v3=地基(已完成)、v4≈P1+P2、v5≈P3+P4 收口为四级台阶。
- P3 安全契约是估值分水岭与风险悬崖，其种子(#3)在 P1 就埋。

---

#### D015 — skill 消费知识用「脚本输出 prompt 让 AI 匹配」，不在脚本内做语义

**决定**: `kb-just-ask` 等主动 skill 的脚本只负责读 `knowledge-registry.json`、整理成知识地图 prompt，由 AI 完成语义匹配、读文件、回答。脚本不自做语义判断。

**放弃**: 不在 shell 里做中文分词/关键词匹配（脆弱且能力上限低）；不引入嵌入向量检索（registry 仅数十条，全量喂 AI 足够，过度工程）。

**原因**:
- 沿用 `auto-reflect.sh` 已验证的模式：脚本备料、AI 决策，职责清晰。
- registry 体量小，全量知识地图喂 AI 既准又简单，无需检索层。

**影响**:
- `scripts/kb-just-ask.sh` + `.ai/skills/kb-just-ask.json` 为 P2 专家技能消费知识层提供参考实现。
- 未来 registry 膨胀到一定规模再考虑加检索层（P2·M2.1 标准 I/O schema 时评估）。

---

#### D016 — 桌面端采用 Tauri + Local Agent Core，不先做完整 IDE

**决定**: Project OS Desktop 采用 `Tauri + Local Agent Core + Workbench UI`。桌面端先做本地项目工作台、模型计划、受控 runner、diff review 和记忆沉淀，不先做完整 IDE。

**放弃**: 暂不优先选 Electron；不先做 Monaco 完整编辑器、插件市场、调试器、多 Agent 编排或开放 skill 安装器。

**原因**:
- Project OS 的核心是项目理解、推荐、执行、验证和交接，不是复制 VS Code。
- 浏览器静态页无法安全处理本地文件权限、命令执行和模型密钥；桌面端需要一个受控本地 core。
- Tauri 更轻，权限模型更适合把文件、命令、密钥和 provider 调用收束到 Local Agent Core。

**影响**:
- 当前 Desktop Runtime 的方向以 `docs/ARCHITECTURE.md` 与 `docs/PRODUCT_PLAN.md` 为 SSOT。
- 后续 `desktop/` 先加载 Vite + React 组件化工作台，再逐步接项目 registry、本地扫描、模型计划和受控执行。
- 写文件和命令执行必须经过白名单工具、diff review 和检查闭环。

---

## 待记录

暂无新的架构决策待补。
