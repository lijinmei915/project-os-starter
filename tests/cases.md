# Project OS Test Cases

目标：验证同一句项目级请求能稳定进入同一条流程，而不是随机跳到页面生成或泛化澄清。

主要 skill 路由验收见 `.claude/skills/tests/cases.md`。

记录格式：

```txt
结果：
- 通过 / 不通过：
- 原因：
- 要改哪里：
```

## Case 1

Input: 我想做一个后台管理系统

Expected:
- project-setup
- INIT
- ask start mode
- no direct file generation before classification

Result 2026-05-01:
- CLI real-run: blocked. `claude -p` returned `Not logged in · Please run /login`.
- Rule dry-run: pass.
- Reason: `SKILL.md` classifies project-level software work before generation; INIT requires start mode selection.
- Next check: rerun in the target Claude UI, or log in to Claude CLI and rerun the explicit skill test.

## Case 2

Input: 我想做一个数据看板

Expected:
- project-setup
- INIT
- ask start mode

Result 2026-05-01:
- Rule dry-run: pass.
- Reason: new dashboard request maps to project-level software work -> INIT -> ask start mode.

## Case 3

Input: 这个项目有点乱，帮我整理一下

Expected:
- project-setup
- HYBRID
- inspect project first

Result 2026-05-01:
- Rule dry-run: pass.
- Reason: messy existing project maps to HYBRID; `hybrid.md` requires inventory before changes.

## Case 4

Input: 帮我看看这个项目架构怎么样

Expected:
- project-setup
- AUDIT
- analyze only

Result 2026-05-01:
- Rule dry-run: pass.
- Reason: architecture review maps to AUDIT; `SKILL.md` says analyze only unless explicitly asked to modify.

## Case 5

Input: 在现有项目里加一个用户管理页面

Expected:
- project-setup
- HYBRID
- inspect existing structure before frontend

Result 2026-05-01:
- Rule dry-run: pass.
- Reason: adding a page to an existing project maps to HYBRID before frontend routing.

## Case 6

Input: 帮我生成一个登录页

Expected:
- design-system or frontend
- if no design rules, ask/use minimal design rules

Result 2026-05-01:
- Rule dry-run: pass.
- Reason: single page generation is domain-specific rather than project-level takeover; should route to design-system/frontend with minimal design rules.

## Case 7

Input: 设计一下 tokens 规范

Expected:
- design-system

Result 2026-05-01:
- Rule dry-run: pass.
- Reason: tokens are explicitly design-system scope.

## Case 8

Input: 接手这个 codebase

Expected:
- project-setup
- HYBRID

Result 2026-05-01:
- Rule dry-run: pass.
- Reason: codebase takeover maps to project-setup HYBRID.
