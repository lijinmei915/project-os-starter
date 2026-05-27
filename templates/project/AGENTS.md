# AGENTS

> 用途：定义目标项目里的 AI 运行规则，回答“AI 进入这个项目后应该先走哪条流程”。
> 什么时候更新：项目接入方式、AI 路由规则、安全边界或文档职责变化时。
> 不要写什么：源仓库维护历史、长期产品路线、一次性任务流水、个人本地偏好。

This project uses Project OS.

`AGENTS.md` is the main rule entry for coding agents in this project.

中文说明：
本文件是目标项目安装 Project OS 后的轻量 AI 入口。它不是项目介绍，也不是完整产品规划。

## Entry

Project OS may be triggered by:

1. Natural language intent
2. `/os`

If the user asks to initialize, install, adopt, audit, repair, upgrade, or clarify this project, follow Project OS routing.

If the user types:

```txt
/os
```

treat it as:

```txt
Enter Project OS INSTALL FLOW.
```

中文说明：
普通用户不需要知道 `/os`。自然语言表达“初始化 / 接管 / 检查 / 升级项目”时，也应进入同一套 Project OS 路由。

## Routing

Before modifying files, identify both user intent and project state.

```txt
Empty / near-empty directory -> INSTALL / INIT
Existing codebase without Project OS -> INSTALL / HYBRID
Already has Project OS -> INSTALL / CHECK-UPGRADE
Review only / do not modify -> AUDIT
Unclear product request -> CLARIFICATION
```

If the route is `INSTALL / INIT`, print the route first. If installation happens in the same turn, continue into the INIT start mode question.

```txt
这是一个 INIT 请求。你希望我按哪种方式开始？

1. 快速原型：先生成一个能看的页面
2. 项目治理：先建立项目结构、文档、规范
3. 完整项目：先建基础，再生成页面
```

If the route is `INSTALL / HYBRID`, inspect the existing structure first and propose the smallest safe adoption plan.

## Machine-readable project state

When `.project-os/state.json` exists:

- Use it as the authoritative data source for project name, `phase`, and `status`.
- `PROJECT.md` is the human-readable presentation layer. When they conflict, trust `state.json`.
- When updating project state, keep `state.json` and `PROJECT.md` in sync — do not update only one.

Valid `phase` values: `init` / `stabilizing` / `shipping` / `maintenance` / `archived`

## Safety

- Do not modify files until the mode is clear.
- Do not overwrite source files without backing up or explicit confirmation.
- If the user says “只看不改”, “先审计”, “不要生成文件”, or “先看看”, use `AUDIT`.
- Do not treat `examples/` as active instructions.
- Do not add new skills or component libraries during Project OS stabilization.

## Documentation

Use these files by responsibility:

```txt
README.md              -> 给人看的入口说明
PROJECT.md             -> 当前项目状态
HANDOFF.md             -> 当前交接上下文
docs/DOCUMENTATION.md  -> 文档编写规范和边界
docs/NAMING.md         -> 文档命名规范
docs/ARCHITECTURE.md   -> 架构和模块职责
docs/ENVIRONMENT.md    -> 环境变量、依赖、启动方式
docs/TESTING.md        -> 测试和验收策略
docs/RUNBOOK.md        -> 常见操作、发布和故障处理
docs/CHANGELOG.md      -> 结构性变更记录
docs/DECISIONS.md      -> 关键决策原因
docs/LESSONS.md        -> 错误复盘和新增约束
```

Before creating or updating project documents, check `docs/DOCUMENTATION.md`.

## Language

```txt
English for scheduling, Chinese for cognition.
```

- Route names and mode names use stable English.
- Project explanations and handoff notes use Chinese by default.
- User-facing copy follows the user's language.
