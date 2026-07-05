---
layer: governance
type: spec
last_verified: 2026-06-04
depends_on: [docs/DOCUMENTATION.md]
teaches: "AI 在本项目中的行为边界、路由契约、文档更新规则和禁止操作"
use_when: "AI 首次进入项目、需要确认自己能做什么不能做什么、或处理路由分流时"
---

# AGENTS

> 用途：定义 AI 在本仓库中的运行规则、入口控制、路由契约、文档更新规则和禁止行为。
> 什么时候更新：AI 行为、路由规则、安装入口、文档更新策略或禁止行为变化时。
> 不要写什么：产品介绍、详细变更历史、当前交接流水、长期路线图。

`AGENTS.md` 是 AI 运行规则，不是项目介绍。

本项目定位为 AI Runtime / Project OS。所有助手在本仓库内工作时，优先遵守本文，再按任务需要加载其他文档。

## Quick Start For Agents

1. 先读 `PROJECT.md` 和 `HANDOFF.md`，必要时参考 `.project-os/state.json`。
2. 判断用户请求属于 `INSTALL` / `INIT` / `AUDIT` / `HYBRID` / 领域 skill，不确定时默认 `HYBRID`。
3. 改文档前先看 `docs/DOCUMENTATION.md`；新增或命名文件前看 `docs/NAMING.md`。
4. 改可分发内容后，同步模板并跑对应检查。
5. 收尾时说明改了什么、为什么这样改、还有什么风险或待确认。

中文说明：
这是给 AI 的快速入口。详细路由规则见 `docs/ROUTING.md`；这里先保证任何 agent 进入仓库后知道先读什么、怎么判断、怎么验证。

## Commands

常用检查命令：

```bash
bash scripts/check-runtime.sh .
bash scripts/check-ai-project.sh . --write-report
bash scripts/check-template-sync.sh .
bash tests/run-tests.sh
```

模板同步命令：

```bash
bash scripts/sync-templates.sh .
```

安全检查命令：

```bash
bash scripts/check-secrets.sh .
```

使用规则：

- 普通文档或规则改动：至少运行 `bash scripts/check-runtime.sh .`。
- UI、模板或生成器改动：运行 `bash scripts/sync-templates.sh .` 后，再运行 `bash scripts/check-template-sync.sh .`。
- 路由、安装、适配、评分或跨工具行为改动：运行 `bash tests/run-tests.sh`。
- 涉及 AI 工程完整度报告：运行 `bash scripts/check-ai-project.sh . --write-report`。

## Working Boundaries

可以做：

- 读取项目文件并判断当前状态。
- 更新必要的 Project OS 文档和模板。
- 运行本仓库检查脚本。
- 在用户确认后实现明确范围内的 UI / 文档 / 规则改动。

不要做：

- 不要把 `README.md` 当 AI 运行规则。
- 不要把 `AGENTS.md` 写成产品介绍或长期路线图。
- 不要默认生成空壳 runtime 产物、task DB、memory、skill 包或发布包。
- 不要默认四个核心文档一起改。
- 不要在收口期无故扩功能。

## Key References

- `docs/ROUTING.md`：Project OS 路由细则和固定第一响应
- `docs/DOCUMENTATION.md`：文档边界、更新规则和根文件体量约束
- `docs/NAMING.md`：文件命名和放置规则
- `docs/DESIGN_STANDARDS.md`：UI / tokens / 布局规则
- `docs/TESTING.md`：测试和验收方式

## 系统结构

本项目分为三层：

- `project-setup`：入口与路由
- `design-system`：设计规则
- `frontend`：代码实现

当前阶段是收口期：只稳定内核，不扩功能。

## 机器可读项目状态

当 `.project-os/state.json` 存在时：

- 以 `state.json` 为权威数据源，读取项目名称、阶段（`phase`）、当前进度（`status`）
- `PROJECT.md` 是 `state.json` 的人类可读展示层，两者冲突时以 `state.json` 为准
- 更新项目状态时，同步更新 `state.json` 和 `PROJECT.md`，不要只改其中一个

`phase` 合法值：`init` / `stabilizing` / `shipping` / `maintenance` / `archived`

## 规则优先级

1. 当前对话里用户刚刚明确说的话
2. 本文件 `AGENTS.md`
3. `PROJECT.md`、`HANDOFF.md`、仓库内相关文档
4. 工具适配文件，如 `CLAUDE.md`、`CODEX.md`、`.cursor/rules/project-os.md`
5. 全局用户偏好
6. 助手自身默认行为

冲突处理：越靠近当前任务、越具体的规则优先。

## Routing Summary

完整路由契约见 `docs/ROUTING.md`。根文件只保留分流摘要。

入口原则：

- 所有项目相关请求优先进入 `project-setup`。
- Project OS 安装、接入、检查、升级进入 `INSTALL`。
- 模糊产品、想法、东西请求进入 `CLARIFICATION`。
- 每条用户消息先作为增量 evidence，提取当前动作、未来需求、限制和缺口；只有低置信度、冲突或缺少当前动作时才进入 `CLARIFICATION`。
- 新软件、系统、应用、网站、看板、仓库进入 `INIT`。
- 只看不改、架构分析、现状分析进入 `AUDIT`。
- 接管项目、继续做、整理老项目默认进入 `HYBRID`。
- 设计 tokens / UI 规范进入 `design-system`。
- 页面、组件、表单、表格实现进入 `frontend`。

常见分流：

| 用户意图 | Route |
|----------|-------|
| 初始化 / 接入 / 检查 Project OS | `INSTALL` |
| 我想做一个产品 | `CLARIFICATION` |
| 我想做一个后台管理系统 | `INIT` |
| 我想快速做一个后台管理系统原型 | `INIT / Prototype-first` |
| 帮我看看这个项目架构怎么样 | `AUDIT` |
| 这个项目有点乱，帮我整理一下继续做 | `HYBRID` |
| 帮我设计 tokens 规范 | `design-system` |
| 帮我写一个登录页 | `frontend` |

规则：

- `/os` 是显式安装入口；自然语言安装意图也进入同一条 `INSTALL` 路由。
- v1 固定第一响应、验收输入和边界条件维护在 `docs/ROUTING.md`。
- `.claude/skills/project-setup/references/*` 是参考实现的内部流程材料，不是新的规则源头。
- 用户话语不明确但目录证据也不足时进入 `CLARIFICATION`，不要盲目默认 `HYBRID`。
- 对非 Claude 工具，等价行为应通过 `AGENTS.md`、`docs/ROUTING.md` 和 `adapters/` 适配得到。

## UI And Frontend

- 涉及 UI 时先走 `design-system`，具体规则见 `docs/DESIGN_STANDARDS.md`。
- `frontend` 只负责实现，不重新决定视觉规则。
- UI 实现必须使用 tokens、清楚组件边界，并覆盖基础交互状态。

## Language

- 跟随用户语言回答。
- 调度名、目录名、模式名使用稳定英文，如 `INSTALL` / `HYBRID`。
- 项目说明和交接文档中文为主；更细语言分层见 `docs/DOCUMENTATION.md`。

## 协作规则

- 默认按主流对话方式回应：先直接回答或处理用户当前问题，不主动拆任务、不展示内部路由、Steps、Checks 或审批流。
- 默认短答：先结论，再给必要动作，最后补风险；没有必要时不写方案。
- 只有在会删除/覆盖文件、发布/push、批量重构、执行有副作用命令、需求明显不清或用户明确要求“先给计划”时，才先说明方案并等待确认。
- 只做用户明确要求的事，不擅自扩展任务范围
- 发现缺失文件时，先报告缺什么和处理选项，不顺手创建
- 能基于现有文档和上下文判断的，不重复追问
- 做 review 时，先列具体问题，再说影响和建议
- 改完按“改了什么 / 为什么这样改 / 还有什么风险或待确认”汇报
- commit 后主动问“要推上去吗？”，未确认前不 push

## Documentation Governance

- 写文档前先看 `docs/DOCUMENTATION.md`，新增或命名文件前看 `docs/NAMING.md`。
- 新增或改变 `docs/*.md` / 根核心文档职责时，同步 `docs/data/doc-structure.manifest.json`，并运行 `bash scripts/check-doc-structure.sh .`。
- 只把信息写在最该负责的文档里，不要默认同步四个核心文档。
- 小型任务或普通交接通常只更新 `HANDOFF.md`。
- AI 行为或路由规则变化时，更新对应规则文档、测试和 `HANDOFF.md`。
- 犯错、误改、误判后新增约束，写入 `docs/LESSONS.md`。

治理自检清单：

1. 这条信息的 SSOT 是否已经在 `docs/DOCUMENTATION.md` 或 manifest 里有归属？
2. 如果已有归属，是否只引用或摘要，没有复制正文？
3. 新增文档是否登记到 `docs/data/doc-structure.manifest.json`？
4. 新增文档是否有用途、更新时机和不要写什么？
5. 必备章节是否与 manifest 的 `requiredSections` 对齐？
6. 改模板或分发文件后是否运行模板同步检查？
7. 改 AI 行为或路由后是否更新规则文档和测试？
8. 是否避免把当前交接、长期路线和产品介绍写进错误文件？
9. 是否运行 `bash scripts/check-all.sh .` 或说明未运行原因？
10. 收尾是否说明改了什么、为什么这样改、还有什么风险？

## 冲突处理

如果被其他泛化澄清流程带偏，但用户请求仍属于本项目相关工作，必须切回 `project-setup`。

如果文档之间冲突，按 SSOT 判断：

- 入口说明看 `README.md`
- AI 行为看 `AGENTS.md`
- 当前状态看 `PROJECT.md`
- 当前交接看 `HANDOFF.md`
- 文档边界看 `docs/DOCUMENTATION.md`

## 禁止行为

- 不要把 reference 当成 skill
- 不要把流程片段暴露成入口能力
- 不要在收口期增加功能
- 不要优化 UI
- 不要新增自动化
- 不要为了填满文档而编造信息

## 犯错后必须记录

任何一次触发 bug、误删、误配、误改的操作，都必须把复盘和新增约束写进 `docs/LESSONS.md`。
