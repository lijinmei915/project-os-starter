# Project OS Test Cases

目标：验证 Project OS 的核心路由是否稳定。

主测试记录见：

```txt
.claude/skills/tests/cases.md
```

## v1.0.0 核心 case

| Case | Input | Expected |
|------|-------|----------|
| 1 | 我想做一个产品 | `project-setup / CLARIFICATION` |
| 2 | 我想做一个后台管理系统 | `project-setup / INIT` |
| 3 | 我想快速做一个后台管理系统原型 | `project-setup / INIT / Prototype-first` |
| 4 | 帮我看看这个项目架构怎么样 | `project-setup / AUDIT` |
| 5 | 这个项目有点乱，帮我整理一下继续做 | `project-setup / HYBRID` |
| 6 | 帮我设计 tokens 规范 | `design-system` |
| 7 | 帮我写一个登录页 | `frontend` |

## 当前结论

```txt
2026-05-06: 7/7 pass
```

## 最小复测命令

```bash
printf '%s' '帮我写一个登录页' | claude -p --no-session-persistence --tools ""
```

期望第一行：

```txt
Skill: frontend
```
