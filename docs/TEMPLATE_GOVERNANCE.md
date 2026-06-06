---
layer: governance
type: spec
last_verified: 2026-06-04
depends_on: [docs/DOCUMENTATION.md]
teaches: "模板文件的归属层、自动勾选条件和新增模板的接入流程"
use_when: "AI 要新增模板文件、修改向导自动勾选逻辑、或检查模板是否同步时"
---

# 模板文件治理规则

> 用途：定义可选模板文件的归属层、自动勾选条件和新增流程，确保向导预设与文件列表保持一致。
> 什么时候更新：新增、删除或调整可选模板文件时。
> 不要写什么：模板文件的具体内容规范（那是各文件自己定义的）。

## 文件分层

每个可选模板文件归属一个层，层决定它在契约配置器中的位置。

| 层 | 层 key | 职责 |
|---|--------|------|
| 项目入口 | `entry` | 让人和 AI 先知道这是什么、怎么开始 |
| 工程运行 | `run` | 让项目能安装、启动、配置和复现 |
| 架构边界 | `arch` | 定义代码结构、设计规范和技术边界 |
| 治理与交接 | `govern` | 测试、变更、决策、经验和交接 |
| AI 能力 | `ai` | agents、tools、prompts、evals、guardrails |

## 当前文件映射

| 文件 | 层 | Q2 自动勾选条件 | Q3 自动勾选条件 |
|------|---|---------------|---------------|
| `PRODUCT.md` | entry | product, full | — |
| `docs/PRODUCT_PLAN.md` | entry | product, full | — |
| `docs/TECH_STACK.md` | run | run, handoff, full | — |
| `docs/ENVIRONMENT.md` | run | run, full | — |
| `.env.example` | run | run, full | — |
| `docs/NAMING.md` | run | run, handoff, full | — |
| `docs/DOCUMENTATION.md` | run | full (team 模式自动加) | — |
| `docs/ARCHITECTURE.md` | arch | run, full | ai, rag |
| `docs/CODE_STRUCTURE.md` | arch | page, run, full | ai, rag |
| `docs/DESIGN_STANDARDS.md` | arch | page, full | — |
| `docs/TESTING.md` | govern | run, handoff, full | — |
| `docs/RUNBOOK.md` | govern | run, handoff, full | — |
| `docs/CHANGELOG.md` | govern | handoff, full | — |
| `docs/DECISIONS.md` | govern | handoff, full | — |
| `docs/LESSONS.md` | govern | handoff, full | — |
| `docs/SECURITY.md` | govern | (conditional: run/full/agent/rag) | — |
| `docs/AI_SAFETY.md` | ai | (conditional: agent/rag) | — |

## Q2 意图层级

Q2 是单选，表达用户的当前优先级，逐级递进：

| Q2 选项 | key | 成熟度 | 语义 |
|--------|-----|--------|------|
| 看清方向 | `product` | prototype | 先定位、用户、MVP |
| 先有页面 | `page` | prototype | 先拿到可看的页面 |
| 能运行起来 | `run` | mvp | 能安装、启动、复现 |
| 方便测试和交接 | `handoff` | team | 能验收、能交接 |
| 完整工程治理 | `full` | production | 全套工程文档 |

## Q3 技术领域

Q3 是多选（可跳过），不影响成熟度和生成方案，只追加文件预勾选：

| Q3 选项 | key | 追加文件 |
|--------|-----|---------|
| AI 工程支持 | `ai` | ARCHITECTURE, CODE_STRUCTURE, ENVIRONMENT, .env.example |
| 知识库 / RAG | `rag` | ARCHITECTURE, CODE_STRUCTURE, ENVIRONMENT, .env.example, TESTING |

## 新增模板文件流程

1. **确定归属层**：参考上方分层表，选一个层
2. **确定触发条件**：该文件在哪些 Q2/Q3 选项下自动勾选
3. **更新代码**：
   - `OUTCOME_FILE_PRESETS` — 在对应的 Q2/Q3 key 的 `files` 数组中添加
   - `GENERATION_PLAN_PRESETS` — 如果该文件属于 plan 的 `autoFiles`，也要加
   - `full` 的 `files` 和 `autoFiles` — **必须加**（full = 全选）
4. **更新本文档**：在「当前文件映射」表中添加一行
5. **运行验证**：确认选 `full` 时该文件被勾选

## 删除模板文件流程

1. 从所有 `OUTCOME_FILE_PRESETS`、`GENERATION_PLAN_PRESETS` 中移除
2. 从契约配置器的 HTML 中移除对应的 `kit-option`
3. 更新本文档，删除对应行
4. 运行验证：确认无报错、无孤岛引用

## 相关文件

| 文件 | 关系 |
|------|------|
| `index.html` | 向导逻辑和契约配置器实现 |
| `docs/DOCUMENTATION.md` | 文档编写规范（内容层面） |
| `INSTALL.md` | profile 分发规则 |
| `docs/CHANGELOG.md` | 结构性变更记录 |
