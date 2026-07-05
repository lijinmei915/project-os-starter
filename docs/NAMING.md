---
layer: governance
type: spec
last_verified: 2026-06-04
depends_on: [docs/DOCUMENTATION.md]
teaches: "文档和文件的命名规则、放置位置和跨工具兼容约定"
use_when: "AI 要新建文件、重命名已有文件、或检查命名是否符合规范时"
---

# 文档命名规范

> 用途：定义 AI 工程文档的主流命名、放置位置和兼容规则。
> 什么时候更新：新增文档类型、跨工具适配文件、目录命名策略或安装 profile 变化时。
> 不要写什么：一次性任务记录、当前交接流水、具体业务模块设计。

本文回答一个问题：AI 工程项目里的文档应该叫什么、放哪里、什么时候不要换名。

## 总原则

```txt
平台约定名不改。
根目录放入口。
docs/ 放工程治理。
生成物放 .project-os/reports/。
```

中文说明：
有些文件名已经被工具或社区约定识别，例如 `README.md`、`AGENTS.md`、`CLAUDE.md`。
这类文件不要为了风格统一而改名。

## 根目录主流文件

| 文件 | 用途 | 是否推荐 |
|------|------|----------|
| `README.md` | 给人看的项目入口 | 推荐 |
| `AGENTS.md` | 给通用 coding agents 的项目规则入口 | 推荐 |
| `PROJECT.md` | 当前项目状态 | 推荐 |
| `HANDOFF.md` | 当前交接上下文 | 推荐 |
| `INSTALL.md` | 安装和接入说明 | 按需 |
| `CHANGELOG.md` | 公开版本变更记录 | 对外产品按需 |
| `CONTRIBUTING.md` | 贡献指南 | 多人开源按需 |
| `SECURITY.md` | 安全披露和安全策略 | 对外项目按需 |
| `LICENSE` | 许可证 | 开源项目按需 |

规则：
- 自动读取或社区约定的文件放根目录。
- `PROJECT.md` 和 `HANDOFF.md` 是本工具的工程上下文约定，服务 AI 和下一位接手者。
- 如果已有项目已经把 `CHANGELOG.md` 放根目录，不强行搬到 `docs/CHANGELOG.md`。

## AI 工具适配文件

| 工具 | 主流入口 | 说明 |
|------|----------|------|
| Codex / 通用 agents | `AGENTS.md` | 通用 agent 指令入口 |
| Claude Code | `CLAUDE.md` 或 `.claude/CLAUDE.md` | Claude 项目记忆 / 指令入口 |
| Cursor | `.cursor/rules/*.mdc` | Cursor 项目规则 |
| Gemini CLI | `GEMINI.md` | Gemini 项目指令入口 |
| GitHub Copilot | `.github/copilot-instructions.md` | Copilot 项目指令 |
| Hermes Agent | `AGENTS.md`，可选 `HERMES.md` | Hermes 会读取项目 `AGENTS.md`，`HERMES.md` 只放 Project OS 接手提示 |

规则：
- 这些文件是 adapter，不是新的规则源头。
- 通用规则优先写在 `AGENTS.md`。
- adapter 只翻译工具读取方式，不重复发明项目规则。
- Hermes 已经支持项目 `AGENTS.md`，因此 `HERMES.md` 只作为可选接手说明，不复制完整规则。

## docs/ 工程文档

`docs/` 下使用稳定、可扫描的大写主题名：

| 文件 | 回答的问题 |
|------|------------|
| `docs/DOCUMENTATION.md` | 文档边界和更新规则是什么 |
| `docs/NAMING.md` | 文档应该怎么命名 |
| `docs/ROUTING.md` | AI 请求应该怎么分流 |
| `docs/RECOMMENDATION_ENGINE.md` | 推荐引擎如何用证据推导文件和动作 |
| `docs/PROJECT_MEMORY_AND_RUNNER.md` | 项目记忆和后台执行器怎么工作 |
| `docs/REFERENCE_SYSTEMS.md` | Hermes 等成熟工具如何借鉴和接入 |
| `docs/WIZARD_PRESETS.md` | 项目状态识别和补齐策略怎么映射文件 |
| `docs/ARCHITECTURE.md` | 系统结构和模块职责是什么 |
| `docs/ENVIRONMENT.md` | 本地环境、依赖、环境变量怎么准备 |
| `docs/TESTING.md` | 怎么验证、测试、验收 |
| `docs/RUNBOOK.md` | 常见操作、发布、故障处理怎么做 |
| `docs/DECISIONS.md` | 为什么做过某个重要决定 |
| `docs/CHANGELOG.md` | 结构性变更记录 |
| `docs/LESSONS.md` | 踩坑复盘和新增约束 |
| `docs/DESIGN_STANDARDS.md` | UI / 设计系统规范 |
| `docs/DESKTOP_APP.md` | 桌面端方向、本地 Agent Core 和 coding 工作台边界 |
| `docs/SECURITY.md` | 工程安全边界、密钥和权限规则 |
| `docs/AI_SAFETY.md` | AI 输出、工具调用和 RAG 安全边界 |
| `docs/SKILL_ENGINEERING.md` | Agent Skill 工程结构和生成边界 |

兼容规则：
- 旧项目已有 `docs/CODE_STRUCTURE.md` 时可以保留。
- 新项目优先使用 `docs/ARCHITECTURE.md`。
- 如果两个文件同时存在，`ARCHITECTURE.md` 负责系统结构，`CODE_STRUCTURE.md` 只负责代码目录职责。
- `docs/SECURITY.md` 和 `docs/AI_SAFETY.md` 是按需条件文件，不作为轻量项目默认上下文。

## 子目录命名

子目录里的专题文档用小写短横线：

```txt
docs/design/tokens.md
docs/design/layout.md
docs/design/component-index.md
```

规则：
- 顶层治理文档用稳定主题名。
- 深层专题文档用小写短横线，便于 URL、命令行和文档站兼容。

## schemas/ 机器可读契约

机器可读契约放在：

```txt
schemas/
```

命名规则：

| 类型 | 命名 |
|------|------|
| JSON Schema | `schemas/<topic>.schema.json` |
| 版本化模型数据 | `schemas/<topic>.v<major>.<minor>.json` |

示例：

```txt
schemas/project-state.schema.json
schemas/ai-project-score.schema.json
schemas/ai-project-score.v0.2.json
schemas/ai-project-report.schema.json
schemas/ai-project-report.v0.1.json
schemas/project-run.schema.json
scripts/recommend-next.sh
```

规则：
- schema 定义字段结构和约束。
- 版本化模型数据记录当前可执行或可检查的规则集。
- 如果模型规则会影响脚本评分、生成报告或 AI 行为，不能只藏在脚本里，应沉淀到 `schemas/`。
- 报告模块、评分 section 分组和报告说明文案属于生成报告的数据源，应使用 `schemas/ai-project-report.*.json`。

## 报告页

报告页放在项目根目录：

```txt
index.html
```

规则：
- 项目根目录的 `index.html` 是 standalone 可视化报告页：浏览器直接打开就能用，本地分析项目目录或 zip，不依赖服务端或 shell。
- 模块标题、分组和说明来自 `schemas/ai-project-report.v0.1.json`（未来若加入数据加载层会读这个 schema）。
- 安装到目标项目时，`index.html` 应随 `core` profile 一起分发。

可追加工程文档模板放在：

```txt
templates/project-docs/
```

规则：
- `templates/project-docs/` 给 `scripts/add-project-docs.sh` 使用。
- 这里放给用户项目追加的干净工程文档模板，不放源仓库自己的当前状态。
- 文件路径应保持最终落地路径，例如 `templates/project-docs/docs/ARCHITECTURE.md`。

工具生成的报告放在：

```txt
.project-os/reports/
```

常见文件：

```txt
.project-os/reports/ai-project-report.md
.project-os/reports/ai-project-report.json
```

规则：
- 生成物默认不作为项目文档 SSOT。
- 报告可以辅助补文档，但不要替代 `PROJECT.md` / `HANDOFF.md`。
- 生成报告目录应加入 `.gitignore`。

工具生成的项目关系图放在：

```txt
.project-os/graph/
```

常见文件：

```txt
.project-os/graph/project-graph.json
```

规则：
- 关系图是脚本生成物，不作为手写文档维护。
- 关系图可以辅助影响分析，但不要替代 `docs/ARCHITECTURE.md` 和人工判断。
- 生成目录应加入 `.gitignore`。

## 不建议的命名

避免：
- `notes.md`：太泛，不知道职责
- `misc.md`：没有边界
- `todo.md`：容易变成交接黑洞
- `final.md`：不可维护
- `new-doc.md`：没有语义

如果不知道放哪里，先写进 `HANDOFF.md` 的风险或下一步；稳定后再沉淀到对应 docs 文件。
