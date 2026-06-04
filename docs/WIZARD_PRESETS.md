---
layer: knowledge
type: spec
last_verified: 2026-06-04
depends_on: [index.html]
---

# 向导预设映射规则

> 用途：定义模板选择向导（Q1/Q2/Q3）与可选文件之间的映射关系，以及新增文件的接入规则。
> 什么时候更新：新增可选文件、调整向导选项、修改文件分层时。
> 不要写什么：向导 UI 样式细节、JS 实现逻辑、用户教程。

## 文件分层

所有可选文件分为 4 层，每层职责不同：

| 层 | 职责 | 包含文件 |
|----|------|---------|
| 项目入口：产品和方向 | 让人和 AI 知道项目做什么、给谁用、分几步走 | `PRODUCT.md`、`docs/PRODUCT_PLAN.md` |
| 工程运行：安装和协作 | 让项目能安装、启动、配置和复现 | `docs/TECH_STACK.md`、`docs/ENVIRONMENT.md`、`.env.example`、`docs/NAMING.md`、`docs/DOCUMENTATION.md` |
| 代码结构：架构和目录 | 让人和 AI 知道代码怎么组织 | `docs/ARCHITECTURE.md`、`docs/CODE_STRUCTURE.md`、`docs/DESIGN_STANDARDS.md` |
| 质量保障：测试和交接 | 让项目可验证、可追溯、可交接 | `docs/TESTING.md`、`docs/RUNBOOK.md`、`docs/CHANGELOG.md`、`docs/DECISIONS.md`、`docs/LESSONS.md` |
| AI 协作规则 | 告诉 AI 怎么配合项目、哪些事能做、哪些事别碰 | `prompts/`、`evals/`、`guardrails/`、`mcp/`、`observability/`、`config/` |

必选文件（不受向导控制，始终勾选）：`README.md`、`PROJECT.md`、`AGENTS.md`、`HANDOFF.md`

## 向导结构

### Q1：维护模式（单选）

| 选项 | 值 | 额外勾选 |
|------|---|---------|
| 我一个人 | `solo` | 无额外文件 |
| 有团队一起做 | `team` | `docs/NAMING.md`、`docs/DOCUMENTATION.md` |

### Q2：项目阶段（单选）

| 选项 | 值 | 自动勾选文件 |
|------|---|------------|
| 看清方向 | `product` | `PRODUCT.md`、`docs/PRODUCT_PLAN.md` |
| 先有页面 | `page` | `docs/DESIGN_STANDARDS.md`、`docs/CODE_STRUCTURE.md` |
| 能运行起来 | `run` | `docs/ARCHITECTURE.md`、`docs/TECH_STACK.md`、`docs/ENVIRONMENT.md`、`.env.example`、`docs/NAMING.md`、`docs/RUNBOOK.md` |
| 方便测试和交接 | `handoff` | `docs/TECH_STACK.md`、`docs/NAMING.md`、`docs/TESTING.md`、`docs/RUNBOOK.md`、`HANDOFF.md`、`docs/LESSONS.md` |
| 完整工程治理 | `full` | 全部 15 个文档 + 6 个 AI 协作规则 |

### Q3：技术领域（多选，可跳过）

| 选项 | 值 | 额外勾选文件 |
|------|---|------------|
| AI 工程支持 | `ai` | `docs/ARCHITECTURE.md`、`docs/CODE_STRUCTURE.md`、`docs/ENVIRONMENT.md`、`.env.example`、`prompts/`、`guardrails/` |
| 知识库 / RAG | `rag` | `docs/ARCHITECTURE.md`、`docs/CODE_STRUCTURE.md`、`docs/ENVIRONMENT.md`、`.env.example`、`docs/TESTING.md`、`prompts/`、`evals/` |

## 完整覆盖矩阵

| 文件 | 看清方向 | 先有页面 | 能运行 | 交接 | 完整治理 | AI (Q3) | RAG (Q3) | 团队 (Q1) |
|------|:------:|:------:|:-----:|:----:|:------:|:------:|:------:|:------:|
| `PRODUCT.md` | ✅ | | | | ✅ | | | |
| `docs/PRODUCT_PLAN.md` | ✅ | | | | ✅ | | | |
| `docs/TECH_STACK.md` | | | ✅ | ✅ | ✅ | | | |
| `docs/ENVIRONMENT.md` | | | ✅ | | ✅ | ✅ | ✅ | |
| `.env.example` | | | ✅ | | ✅ | ✅ | ✅ | |
| `docs/NAMING.md` | | | ✅ | ✅ | ✅ | | | ✅ |
| `docs/DOCUMENTATION.md` | | | | | ✅ | | | ✅ |
| `docs/ARCHITECTURE.md` | | | ✅ | | ✅ | ✅ | ✅ | |
| `docs/CODE_STRUCTURE.md` | | ✅ | | | ✅ | ✅ | ✅ | |
| `docs/DESIGN_STANDARDS.md` | | ✅ | | | ✅ | | | |
| `docs/TESTING.md` | | | | ✅ | ✅ | | ✅ | |
| `docs/RUNBOOK.md` | | | ✅ | ✅ | ✅ | | | |
| `docs/CHANGELOG.md` | | | | ✅ | ✅ | | | |
| `docs/DECISIONS.md` | | | | ✅ | ✅ | | | |
| `docs/LESSONS.md` | | | | ✅ | ✅ | | | |
| `prompts/` | | | | | ✅ | ✅ | ✅ | |
| `evals/` | | | | | ✅ | | ✅ | |
| `guardrails/` | | | | | ✅ | ✅ | | |
| `mcp/` | | | | | ✅ | | | |
| `observability/` | | | | | ✅ | | | |
| `config/` | | | | | ✅ | | | |

## 新增文件接入规则

新增一个可选文件时，按以下步骤操作：

### 1. 确定归属层

从五层中选一个：项目入口 / 工程运行 / 代码结构 / 质量保障 / AI 协作规则。一个文件只归一层。

### 2. 确定触发条件

回答这个问题：「用户在什么意图下，这个文件应该自动勾选？」

- 如果是产品/方向类 → 加到 `product` 预设
- 如果是页面/设计类 → 加到 `page` 预设
- 如果是运行/配置类 → 加到 `run` 预设
- 如果是交接/质量类 → 加到 `handoff` 预设
- 如果是 AI 领域专属 → 加到 `ai` 预设（Q3）
- 如果是 RAG 领域专属 → 加到 `rag` 预设（Q3）

一个文件可以出现在多个预设中。

### 3. 更新代码

需要改 `index.html` 中的三个位置：

1. **`OPTIONAL_TEMPLATES`** — 把文件加到可选文件列表，指定 `group`（层名称）
2. **`OUTCOME_FILE_PRESETS`** — 把文件加到对应预设的 `files` 数组
3. **`GENERATION_PLAN_PRESETS`** — 把文件加到对应 plan 的 `autoFiles` 数组
4. **`CONTRACT_LAYER_FILES`** — 把文件加到对应层的数组，让计数器正确统计

### 4. 同步 `full` 预设

`full`（完整工程治理）必须包含所有可选文件。新增文件后必须同步加到：
- `OUTCOME_FILE_PRESETS.full.files`
- `GENERATION_PLAN_PRESETS.full.autoFiles`

### 5. 更新本文档

在上方的「文件分层」表和「完整覆盖矩阵」中补上新文件。

## 相关文件

| 文件 | 说明 |
|------|------|
| `index.html` | 向导 UI 和预设逻辑的实现 |
| `docs/DOCUMENTATION.md` | 文档编写规范和更新边界 |
| `AGENTS.md` | 多助手协作规范 |
| `INSTALL.md` | 安装方式和 profile 说明 |
