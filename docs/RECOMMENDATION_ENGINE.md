---
layer: knowledge
type: spec
last_verified: 2026-06-13
depends_on: [docs/WIZARD_PRESETS.md, docs/DOCUMENTATION.md]
teaches: "Project OS 推荐引擎如何用项目证据推导缺口、推荐文件、原因、置信度和检查方式"
use_when: "AI 要解释为什么推荐某个文件、修改推荐逻辑、或把向导从规则映射升级为证据驱动时"
---

# 推荐引擎规范

> 用途：定义 Project OS 如何根据项目证据推导推荐文件和下一步动作。
> 什么时候更新：证据扫描、缺口判断、推荐文件、置信度、验收规则或向导推荐逻辑变化时。
> 不要写什么：UI 视觉细节、一次性调研笔记、某个业务项目的具体推荐结论。

推荐不能只靠用户选择，也不能靠固定工程包。

Project OS 的推荐必须满足：

```txt
evidence -> signals -> gaps -> recommendations -> checks
```

每个推荐项都必须能回答：

```txt
为什么推荐？
证据是什么？
置信度多高？
用户能否跳过？
生成后怎么检查？
```

## 输入证据

推荐引擎至少读取这些证据：

| Evidence | 说明 |
|----------|------|
| 文件存在性 | `README.md`、`PROJECT.md`、`AGENTS.md`、`HANDOFF.md`、`package.json`、`src/`、`tests/`、`.env.example` 等 |
| 文件内容质量 | 文档是否只是空模板，是否包含启动、测试、阶段、风险、边界等关键词 |
| 项目结构 | 是否有前端页面、后端入口、设计资料、Skill 目录、AI runtime 目录 |
| 脚本信号 | `package.json scripts`、测试命令、构建命令、lint 命令 |
| 交接信号 | 是否有最近状态、已知风险、下一步、运行手册 |
| 用户话语证据 | 用户每句话里表达的目标、下一步、对象、限制和优先级 |
| 用户当前动作 | 用户是想继续做、接管、运行、交接、生成 Skill、上线还是只体检 |

不要把用户选择当作唯一证据。

用户话语证据也进入同一条推荐链路，不另起一套会话系统：

```txt
用户说一句话 -> 提取 evidence -> 归纳 signal -> 判断 gap -> 推荐最小生成项
```

示例：

| 用户话语 | Signal | 推荐方向 |
|----------|--------|----------|
| 我想做一个后台管理系统 | `init_software_project` | 先补最小项目入口和产品方向 |
| 先做登录页和用户列表 | `has_ui_goal` | 补页面原型和设计边界 |
| 这个项目怎么跑起来 | `runtime_need` | 补环境、技术栈和运行说明 |
| 我要交给别人继续做 | `handoff_need` | 补交接、测试和运行手册 |
| 做一个 Agent Skill | `skill_goal` | 补最小 Skill 骨架 |

规则：

- 用户话语只能触发“当前必要项”，不能自动生成完整治理包。
- 如果一句话已经足够明确，优先生成最小可落地文件，不强迫用户先选工程包。
- 如果目标过宽，只追问最少缺口，例如“先要原型还是先建基础”。
- 后续每句话都可以更新 recommendation，而不是一次性锁死方案。

## Signal

Signal 是对证据的归纳，不直接等于推荐文件。

示例：

```txt
has_package_scripts
missing_environment_doc
has_ui_artifact
missing_design_boundary
has_tests_without_testing_doc
has_skill_root
missing_skill_examples
handoff_context_missing
```

规则：

- signal 必须由具体 evidence 支撑。
- signal 可以有强弱，例如 `strong` / `medium` / `weak`。
- 同一个 evidence 可以产生多个 signal。

## Gap

Gap 是用户当前继续推进会遇到的问题。

示例：

| Gap | 典型 evidence |
|-----|---------------|
| 缺运行复现说明 | 有 `package.json scripts`，但没有 `docs/ENVIRONMENT.md` 或 README 启动说明 |
| 缺设计边界 | 有页面 / 组件 / 设计稿，但没有 `docs/DESIGN_STANDARDS.md` |
| 缺测试验收说明 | 有 `tests/` 或测试脚本，但没有 `docs/TESTING.md` |
| 缺交接上下文 | 有改动或项目状态，但 `HANDOFF.md` 缺当前状态 / 风险 / 下一步 |
| Skill 结构不足 | 有 `SKILL.md`，但缺 examples 或触发条件不清 |

Gap 必须面向“继续推进会卡在哪里”，不要只是列缺文件。

## Recommendation

推荐项使用统一结构：

```txt
file: docs/ENVIRONMENT.md
action: create | update | keep | skip
reason: 检测到 package.json 有 dev/build 脚本，但没有环境和启动说明。
evidence: [package.json scripts.dev, package.json scripts.build, missing docs/ENVIRONMENT.md]
confidence: high | medium | low
evidenceStrength: strong | medium | weak
gapClarity: clear | probable | ambiguous
riskIfSkipped: 后续接手者可能无法复现启动方式。
confidenceReason: 强证据指向明确运行缺口，且该文档是继续接手的基础入口。
check: bash scripts/check-runtime.sh .
overridable: true
```

当推荐文件存在于 `schemas/file-contracts.v0.1.json` 时，推荐结果还必须附带：

```txt
contract:
  triggers: 哪些项目证据允许触发
  requiredSections: 生成内容必须覆盖哪些章节
  updatePolicy: 新建、合并或追加整理
  validation: 生成后必须运行哪些检查
```

推荐引擎负责判断“现在是否需要”，文件契约负责约束“生成后必须长什么样、如何更新、怎么验证”。两者不能互相替代。

规则：

- `high`：多个强 evidence 指向同一缺口，可以默认勾选。
- `medium`：证据成立但场景可能不同，可以推荐但文案解释。
- `low`：只是可能有用，不默认勾选，放到可展开建议。
- `evidenceStrength` 说明证据本身强弱，不等于推荐优先级。
- `gapClarity` 说明缺口是否明确，不等于业务重要性。
- `confidenceReason` 必须解释为什么是当前置信度，不要只重复 `reason`。
- `riskIfSkipped` 说明用户跳过后的具体风险，避免用户只看到标签。
- 每个默认勾选项必须有 `reason` 和 `evidence`。
- 用户必须能取消或跳过非必选项。

## 文件推荐规则

| 推荐文件 | 推荐条件 |
|----------|----------|
| `PRODUCT.md` | 项目缺产品定位、用户、价值或设计原则说明 |
| `docs/PRODUCT_PLAN.md` | 项目已有阶段目标或路线讨论，但缺沉淀位置 |
| `docs/DESIGN_STANDARDS.md` | 存在页面、组件、设计资料或视觉一致性需求 |
| `docs/TECH_STACK.md` | 存在代码框架、依赖、构建工具或版本边界需要说明 |
| `docs/ENVIRONMENT.md` | 存在启动脚本、环境变量、本地运行或部署复现需求 |
| `.env.example` | 检测到环境变量、密钥占位或配置文件需求 |
| `docs/NAMING.md` | 多人协作、目录变多、文档命名不一致或新增文档类型 |
| `docs/DOCUMENTATION.md` | 文档数量较多、边界混乱、需要治理更新时机 |
| `docs/ARCHITECTURE.md` | 存在多个模块、服务、数据流或边界不清 |
| `docs/CODE_STRUCTURE.md` | 代码目录职责需要给 AI 和维护者说明 |
| `docs/TESTING.md` | 存在测试脚本、测试目录或验收要求 |
| `docs/RUNBOOK.md` | 存在启动、部署、发布、故障处理或交接运行需求 |
| `docs/CHANGELOG.md` | 结构性变更需要留痕 |
| `docs/DECISIONS.md` | 出现重要取舍、架构选择或不可逆决策 |
| `docs/LESSONS.md` | 出现误判、误改、事故或需要新增约束 |
| `docs/SKILL_ENGINEERING.md` | 项目要生成、维护或分发 Agent Skill |

## UI 呈现规则

UI 不应该说“选一个工程包”。

推荐区应表达：

```txt
当前识别结果：现在最缺什么
推荐下一步：补哪些文件 / 做哪个动作
原因：每个推荐为什么出现
操作：确认、跳过、展开调整
```

如果当前实现还只能基于 Q1 / Q2 / Q3 映射，也必须在文案上承认为“初步推荐”，不要伪装成完整智能识别。

## 验收

推荐逻辑修改后至少检查：

```bash
bash scripts/recommend-next.sh .
bash scripts/check-runtime.sh .
bash scripts/check-template-sync.sh .
```

如果改了页面可见文案或推荐卡片，还要跑：

```bash
bash tests/run-tests.sh
```
