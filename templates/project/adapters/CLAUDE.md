# Claude Code Adapter

> 用途：把 `AGENTS.md` 的通用规则翻译成 Claude Code 更容易读取的入口行为。
> 什么时候更新：Claude Code 专属入口、读取顺序、路由要求或命令行为变化时。
> 不要写什么：新的规则源头、当前项目交接、长期产品规划。

This file is a Claude Code adapter for Project OS.

`AGENTS.md` is the single source of truth. This file only translates the shared Project OS rules into Claude Code behavior.

中文说明：
这是 Claude Code 适配文件，不是新的规则源头。
通用规则以 `AGENTS.md` 为准。

---

## Required Reading

At the start of a project-level task:

1. Read `AGENTS.md`
2. Read `PROJECT.md` when judging current project state
3. Read `HANDOFF.md` when continuing existing work

中文说明：
Claude Code 进入项目后，先看通用规则，再看当前状态和交接上下文。

---

## Project OS Routing

Use Project OS routing before writing files or code:

```txt
/os or Project OS install/check/upgrade intent -> project-setup / INSTALL
vague product request -> project-setup / CLARIFICATION
new software/system/app request -> project-setup / INIT
project review/analyze request -> project-setup / AUDIT
existing or messy project takeover -> project-setup / HYBRID
design tokens / UI rules -> design-system
specific page/component implementation -> frontend
```

中文说明：
项目级请求不要直接写业务代码。先分流，再执行。

---

## Claude Code Notes

- `/os` is an explicit shortcut into INSTALL FLOW.
- CLI print mode may not show the skill banner, but the first response must still reveal the route.
- If the route is `INSTALL / INIT`, print that route first and continue into the INIT start mode question after installation/check completes.
- The turn is only complete after the INIT start mode is clear.
- Claude-specific behavior belongs here; shared rules belong in `AGENTS.md`.

中文说明：
`/os` 是 Claude Code 里的显式入口。
如果 CLI 测试不显示 skill banner，也要用第一响应说明路由。
