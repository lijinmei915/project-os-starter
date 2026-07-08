---
layer: governance
type: spec
last_verified: 2026-06-17
depends_on: [docs/DOCUMENTATION.md, docs/RECOMMENDATION_ENGINE.md, docs/RUNBOOK.md]
teaches: "Project OS Console 的项目记忆、后台执行器、写回规则和人工确认边界"
use_when: "设计云上开发、后台体检、Goal Runner、自动生成和项目状态写回时"
---

# 项目记忆和后台执行器

> 用途：定义 Project OS Console 如何记住项目状态、如何在后台跑检查、如何保存结果、什么时候必须让用户确认。
> 什么时候更新：项目记忆字段、后台执行流程、云端 workspace、自动生成或写回规则变化时。
> 不要写什么：具体 UI 文案、长期产品路线、某次任务流水。

这份文档回答一句话：

```txt
Project OS Console 怎么从“页面工具”变成“会自己跑检查和记事的项目管家”。
```

## 核心结论

Project OS Console 不直接让浏览器读写用户本机目录。

它应该分成两层：

1. Console：负责展示、选择、确认和查看报告。
2. Runner：负责拉代码、生成文件、跑检查、保存状态。

所有自动动作都必须围绕项目记忆进行：

```txt
读状态 -> 判断下一步 -> 生成草稿或报告 -> 跑检查 -> 用户确认 -> 写回状态
```

## 项目记忆

项目记忆不是聊天记录，而是仓库里的持久文件。

| 信息 | 主源 | 用途 |
|------|------|------|
| 项目名称、阶段、状态 | `.project-os/state.json` | 机器读取的当前状态 |
| 人类可读状态 | `PROJECT.md` | 让人和 AI 快速理解项目 |
| 当前交接 | `HANDOFF.md` | 记录最近完成、风险和下一步 |
| 体检报告 | `.project-os/reports/ai-project-report.json` | 判断完整度和工程成熟度 |
| 推荐结果 | `.project-os/recommendations/recommend-next.json` | 判断下一步补什么 |
| 执行记录 | `.project-os/runs/<run-id>.json` | 记录每次 Runner 跑了什么、产物在哪、是否成功 |
| 文档归属 | `docs/data/doc-structure.manifest.json` | 防止文档职责漂移 |

规则：

- `.project-os/state.json` 是机器状态主源。
- `PROJECT.md` 是人类可读展示层，不要和 `state.json` 冲突。
- `HANDOFF.md` 只记录当前交接，不承载长期路线。
- 报告和推荐结果是可再生成产物，不要手写成唯一真实来源。
- 任何自动生成动作完成后，都要写入报告、推荐或交接，不靠对话记忆。

## 目标确认边界

目标不是系统写入一条记录就自动成立。

新目标必须经过确认链路：

```txt
用户提出方向
-> 系统生成目标草案 draft
-> 用户确认目标名称、范围和成功标准
-> 系统拆解任务
-> 用户确认拆解
-> 目标进入 active / 进行中
```

规则：

- 系统或 AI 不得静默把新目标直接设为 `active`。
- 新目标创建后默认是 `draft`，UI 显示为 `待确认`。
- `draft` 目标可以被编辑、取消或确认，但不能被当成已进入执行。
- 只有用户明确确认目标后，系统才可以拆解任务。
- 只有用户确认任务拆解后，目标才进入 `active` / `进行中`。
- 临时验证、系统测试或开发调试目标不得写入正式 goals；如果必须写入，应立即清理或标记为测试数据。

目标状态含义：

| 状态 | 含义 |
|------|------|
| `draft` | 目标草案，等待用户确认 |
| `planned` | 目标已确认，等待任务拆解确认 |
| `active` | 已确认并进入执行 |
| `pending-confirm` | 验证通过，等待用户确认完成 |
| `done` | 用户确认完成 |
| `failed` | 验证失败或需要处理 |

## 项目运行状态点

左侧项目列表的状态点只表达“当前是否有运行会话或近期执行结果”，不表达项目是否已接入、档案是否完整或目录是否健康。

状态含义：

| 状态点 | 含义 | 出现条件 | 消失条件 |
|--------|------|----------|----------|
| 蓝色旋转环 | 进行中 | 当前项目有正在生成计划、对话任务或终端任务 | 任务结束、失败或被停止 |
| 红点 | 异常中断 | 当前项目最近任务失败、会话中断、网络/API/终端错误 | 用户重新发起任务并进入进行中，或错误被处理/清除 |
| 绿点 | 有新完成结果 | 当前项目刚完成一次任务、对话结果或执行结果，且用户尚未查看 | 用户点击项目、打开对应会话或任务后消失；新任务开始时被蓝色状态覆盖；失败时被红色状态覆盖 |
| 无状态点 | 空闲 | 没有进行中、异常中断或近期完成状态 | 不需要处理 |

规则：

- 不允许用项目健康状态 `ready` 显示绿点；空闲项目即使已接入也应无状态点。
- 普通聊天不进入任务执行前，不应触发绿点。
- 绿点是未读完成提示，不是长期完成标记；长期结果应写入任务记录、目标状态或 run summary。
- 切换项目后，会话内可以保留进行中、异常或未读完成提示；用户查看完成结果后必须清除绿点。

## 项目显示名和本地路径

项目在 OmniDesk 工作台里的显示名，和用户本机目录名是两个不同概念。

规则：

- 修改项目显示名，只更新 OmniDesk 的项目 registry 或工作台配置。
- 修改项目显示名不得重命名本地文件夹、移动项目路径、修改 Git 仓库名或改写 `package.json` / `Cargo.toml` 等工程元数据。
- 本地路径必须作为独立字段展示，不能因为显示名变化而隐式变化。
- 如果未来支持“重命名本地文件夹”，必须作为单独高风险操作出现，使用明确文案和二次确认，并提示会影响路径、运行进程、脚本、Git 工具和最近打开记录。
- 默认产品路径应优先支持安全的“显示名改名”，不要把轻量整理动作升级成文件系统操作。

## 后台执行器

Runner 是 Project OS Console 的后台执行层。

它最小只需要做五件事：

1. 创建 workspace。
2. 获取项目代码。
3. 运行白名单脚本。
4. 保存报告和推荐结果。
5. 把结果返回给 Console。

推荐目录：

```txt
.project-os/
  state.json
  reports/
    ai-project-report.json
    ai-project-report.md
  recommendations/
    recommend-next.json
  runs/
    <run-id>.json
```

云端开发时，workspace 可以放在服务端：

```txt
/workspaces/<project-id>/repo
/workspaces/<project-id>/repo/.project-os
```

本地开发时，workspace 就是当前仓库。

当前最小实现：

```bash
bash scripts/project-runner.sh . --source local
```

该命令会生成：

```txt
.project-os/runs/<run-id>.json
.project-os/runs/logs/<run-id>/
.project-os/reports/ai-project-report.json
.project-os/reports/ai-project-report.md
.project-os/recommendations/recommend-next.json
```

Run 记录结构由 `schemas/project-run.schema.json` 约束。

## Hermes Agent 接入

Hermes 适合做可选执行器，不替代 Project OS 的项目记忆。

接入原则：

- Project OS 负责项目契约、状态、报告、推荐和检查闭环。
- Hermes 负责在目标项目里读取这些文件，并按最小下一步执行。
- `AGENTS.md` 仍是通用规则源头；`HERMES.md` 只是可选 adapter。
- Hermes 的长期记忆不能替代 `.project-os/state.json`、`PROJECT.md` 和 `HANDOFF.md`。
- Hermes 生成或修改内容后，应把可交接结果写回 `HANDOFF.md` 或 `.project-os/runs/`。

推荐接手提示：

```txt
先读 AGENTS.md、PROJECT.md 和 HANDOFF.md；如果存在，也读 .project-os/state.json、最新 .project-os/runs/*.json 和 .project-os/recommendations/recommend-next.json。

请按 Project OS 规则判断当前最小下一步，只给我一个执行计划。涉及修改源码、删除文件、权限配置、数据库、部署、push 或 PR 前必须先等我确认。

如果只是体检或推荐，可以运行现有检查；完成后说明结果、风险和建议写回位置。
```

安装可选 adapter：

```bash
bash scripts/install-adapter.sh hermes .
```

中文说明：
这不是把 Hermes 包进 Project OS，而是让 Hermes 进入项目后先遵守 Project OS 的文件和检查契约。

## 执行流程

### 接手老项目

```txt
输入 Git 地址或上传 zip
-> Runner 创建 workspace
-> clone 或解压
-> 运行 check-ai-project
-> 运行 recommend-next
-> 保存 reports 和 recommendations
-> Console 展示体检结果和下一步建议
```

最小命令：

```bash
bash scripts/check-ai-project.sh . --write-report
bash scripts/recommend-next.sh . --write-report
```

### 创建新项目

```txt
用户选择准备创建什么
-> Runner 生成最小骨架
-> 运行 check-all
-> 保存 state / report
-> Console 展示将创建的文件和检查结果
-> 用户确认后落盘
```

最小原则：

- 先生成最小骨架。
- 后续文件按证据推荐，不一次性塞满。
- 没有证据的文件不自动生成。

### 自动继续做

```txt
读取 state / handoff / recommendations
-> 选一个当前最小可做任务
-> 生成 diff 或草稿
-> 跑 check-all
-> 展示结果
-> 用户确认后写回
```

自动继续做不能跳过确认，除非任务只生成报告或只读分析。

## 人工确认边界

必须确认：

- 修改已有源码。
- 删除文件。
- 写入密钥、token、权限配置。
- 修改数据库 schema、迁移或生产配置。
- 发起部署、发布、推送、PR。
- 大批量改文档或重命名文件。

可以自动执行：

- 只读扫描。
- 生成体检报告。
- 生成推荐结果。
- 创建临时 workspace。
- 对临时 workspace 跑检查。

灰区动作：

- 新建治理文档可以先生成草稿，但写入仓库前要展示将生成哪些文件。
- 自动修复可以先生成 diff，但应用 diff 前要确认。

## 检查闭环

Runner 不能只生成文件，必须跑检查。

推荐默认入口：

```bash
bash scripts/check-all.sh .
```

分层检查：

| 阶段 | 检查 |
|------|------|
| 文档治理 | `bash scripts/check-doc-structure.sh .` |
| 文件契约 | `bash scripts/check-file-contracts.sh .` |
| 模板同步 | `bash scripts/check-template-sync.sh . --strict` |
| 工程体检 | `bash scripts/check-ai-project.sh . --write-report` |
| 推荐下一步 | `bash scripts/recommend-next.sh . --write-report` |

规则：

- 检查失败时，不自动写回主分支。
- 检查警告可以展示给用户，由用户决定是否继续。
- 所有 run 都应记录输入、执行命令、输出文件和退出状态。

## 最小实现顺序

1. 保持当前静态 Console。
2. 把本地目录选择改成命令或云端 Runner。
3. 新增 workspace 目录和 run 记录。
4. 用白名单命令跑体检和推荐。
5. 展示报告和推荐结果。
6. 再做自动生成 diff。
7. 最后接入多 agent 或定时任务。

当前阶段不做：

- 不做完整在线 IDE。
- 不直接执行任意用户命令。
- 不让浏览器承担本机文件读写。
- 不让 AI 无确认地改源码或部署。

## 相关文件

| 文件 | 关系 |
|------|------|
| `docs/DOCUMENTATION.md` | 文档治理和 SSOT 边界 |
| `docs/RECOMMENDATION_ENGINE.md` | 推荐下一步的证据和规则 |
| `docs/RUNBOOK.md` | 本地自检、同步模板和故障处理 |
| `scripts/check-all.sh` | 默认总检查入口 |
| `scripts/check-ai-project.sh` | 老项目工程体检 |
| `scripts/project-runner.sh` | 本地 Runner 最小闭环 |
| `scripts/recommend-next.sh` | 下一步推荐生成 |
| `schemas/project-run.schema.json` | Runner 执行记录结构 |
