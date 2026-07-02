# Hermes Adapter

This file is a Hermes Agent adapter for Project OS.

`AGENTS.md` is the single source of truth. Hermes loads the project `AGENTS.md` from the current working directory, so this file only explains how Hermes should use Project OS memory and Runner outputs.

中文说明：
这是 Hermes Agent 适配文件，不是新的规则源头。
通用规则以 `AGENTS.md` 为准；Project OS 负责项目契约，Hermes 负责按契约执行。

---

## Required Reading

For project-level requests:

1. Read `AGENTS.md`.
2. Read `PROJECT.md` for current state.
3. Read `HANDOFF.md` before continuing existing work.
4. If present, read `.project-os/state.json`.
5. If present, inspect the latest `.project-os/runs/*.json` and `.project-os/recommendations/recommend-next.json`.

中文说明：
Hermes 接手项目时，先读规则、状态、交接和最近 Runner 产物，不要只靠聊天记忆。

---

## Execution Contract

Use Project OS as the project memory layer:

- `AGENTS.md` defines behavior boundaries.
- `PROJECT.md` summarizes human-readable project state.
- `HANDOFF.md` records current handoff context.
- `.project-os/state.json` is machine-readable state when present.
- `.project-os/runs/` records what checks were run and where logs live.
- `.project-os/recommendations/recommend-next.json` describes the next suggested action.

Before modifying files, state the route and the smallest next step. Wait for confirmation when the action changes source code, deletes files, changes credentials, changes database schema, deploys, pushes, or opens a pull request.

中文说明：
Hermes 可以长期运行和沉淀技能，但项目事实仍应回到 Project OS 文件里。

---

## Suggested First Prompt

```txt
先读 AGENTS.md、PROJECT.md 和 HANDOFF.md；如果存在，也读 .project-os/state.json、最新 .project-os/runs/*.json 和 .project-os/recommendations/recommend-next.json。

请按 Project OS 规则判断当前最小下一步，只给我一个执行计划。涉及修改源码、删除文件、权限配置、数据库、部署、push 或 PR 前必须先等我确认。

如果只是体检或推荐，可以运行现有检查；完成后说明结果、风险和建议写回位置。
```

中文说明：
在目标项目目录里启动 Hermes 后，可以直接粘贴这段提示词。

