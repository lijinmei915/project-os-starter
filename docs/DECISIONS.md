# 架构决策记录

> 用途：记录重要决策、放弃项、原因和影响，回答“为什么这么定”。
> 什么时候更新：出现正式架构、产品、协作规则或分发策略决策时。
> 不要写什么：当前状态流水、小修记录、临时 TODO、当前交接事项。
> 记录重要的技术决策和原因，防止重复踩坑。
> 格式：决定 / 放弃 / 原因 / 影响。

---

## 决策列表

### Project OS

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

#### D009 — 跨工具验收先验证 adapter 分发和 SSOT

**决定**: v0.2 的跨工具成熟度先以 adapter 分发、入口文件生成和 `AGENTS.md` 单一规则源头为自动化验收标准。

**放弃**: 不把当前自动化结果描述为“真实 Claude / Codex / Cursor / Gemini 会话全部完整验证”。

**原因**:
- 不同工具的真实模型会话受平台、版本、上下文窗口和权限影响，难以在本地脚本里稳定复现。
- 当前最稳定可测的是：安装器能生成正确入口，adapter 不另起规则源头，并且路由契约都指向 `AGENTS.md`。
- 真实工具会话仍适合在发布前抽样复查，而不是作为每次本地回归的硬依赖。

**影响**:
- `tests/run-tests.sh` 验证 `CLAUDE.md` / `CODEX.md` / `.cursor/rules/project-os.md` / `GEMINI.md` 均能安装且引用 `AGENTS.md`。
- `tests/cross-tool-matrix.md` 记录自动化覆盖范围和人工抽样边界。
- 工程成熟度 `100/100` 表示 v0.2 模型闭环，不等于所有真实业务项目无需 review。

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

## 待记录

暂无新的架构决策待补。
