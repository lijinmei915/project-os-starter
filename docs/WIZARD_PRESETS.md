---
layer: knowledge
type: spec
last_verified: 2026-06-13
depends_on: [index.html, docs/RECOMMENDATION_ENGINE.md]
teaches: "项目状态识别、下一步动作与可选文件之间的映射关系及新增文件接入规则"
use_when: "AI 需要修改补齐策略、新增可选文件、或理解某个文件为什么被自动推荐时"
---

# 状态识别与补齐策略映射规则

> 用途：定义项目状态识别（Q1/Q2/Q3）与可选文件之间的映射关系，以及新增文件的接入规则。
> 什么时候更新：新增可选文件、调整向导选项、修改文件分层时。
> 不要写什么：向导 UI 样式细节、JS 实现逻辑、用户教程。

这些预设不是用户要理解的“工程包”。它们是 Project OS 的内部补齐策略。

当前实现仍是轻量规则映射：根据 Q1 / Q2 / Q3 和少量状态信号自动勾选文件。真正的证据驱动推荐应遵守 `docs/RECOMMENDATION_ENGINE.md`：每个默认推荐项都要有 evidence、reason、confidence、check，并允许用户跳过。

原则：

- 不把“用户点了某张卡片”当成唯一推荐依据。
- 不把固定 preset 伪装成完整智能识别。
- 后续推荐引擎成熟后，Q1 / Q2 / Q3 只作为额外 signal，而不是唯一决策源。

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

## 状态识别结构

### Q1：维护模式（单选）

| 选项 | 值 | 额外勾选 |
|------|---|---------|
| 我一个人 | `solo` | 无额外文件 |
| 有团队一起做 | `team` | `docs/NAMING.md`、`docs/DOCUMENTATION.md` |

### Q2：下一步动作（单选）

| 选项 | 值 | 内部补齐策略 | 自动勾选文件 |
|------|---|------------|--------------|
| 补产品方向 | `product` | 产品方向补齐 | `PRODUCT.md`、`docs/PRODUCT_PLAN.md` |
| 生成页面原型 | `page` | 页面原型补齐 | `docs/DESIGN_STANDARDS.md`、`docs/CODE_STRUCTURE.md` |
| 跑通工程运行 | `run` | 工程运行补齐 | `docs/ARCHITECTURE.md`、`docs/TECH_STACK.md`、`docs/ENVIRONMENT.md`、`.env.example`、`docs/NAMING.md`、`docs/RUNBOOK.md` |
| 准备交接验收 | `handoff` | 交接验收补齐 | `docs/TECH_STACK.md`、`docs/NAMING.md`、`docs/TESTING.md`、`docs/RUNBOOK.md`、`HANDOFF.md`、`docs/LESSONS.md` |
| 补齐治理底座 | `full` | 治理底座补齐 | 全部 15 个文档 + 6 个 AI 协作规则 |

### Q3：技术领域（多选，可跳过）

| 选项 | 值 | 额外勾选文件 |
|------|---|------------|
| AI 工程支持 | `ai` | `docs/ARCHITECTURE.md`、`docs/CODE_STRUCTURE.md`、`docs/ENVIRONMENT.md`、`.env.example`、`prompts/`、`guardrails/` |
| 知识库 / RAG | `rag` | `docs/ARCHITECTURE.md`、`docs/CODE_STRUCTURE.md`、`docs/ENVIRONMENT.md`、`.env.example`、`docs/TESTING.md`、`prompts/`、`evals/` |

## 完整覆盖矩阵

| 文件 | 补产品方向 | 生成页面原型 | 跑通工程运行 | 准备交接验收 | 补齐治理底座 | AI (Q3) | RAG (Q3) | 团队 (Q1) |
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

回答这个问题：「哪些项目状态信号或下一步动作表明这个文件应该自动推荐？」

- 如果状态缺产品/方向边界 → 加到 `product` 补齐策略
- 如果下一步是页面/设计验证 → 加到 `page` 补齐策略
- 如果下一步是安装、启动、复现 → 加到 `run` 补齐策略
- 如果下一步是交接、验收、复盘 → 加到 `handoff` 补齐策略
- 如果工程证据显示 AI 运行能力不足 → 加到 `ai` 预设（Q3）
- 如果工程证据显示知识库 / RAG 能力不足 → 加到 `rag` 预设（Q3）

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
