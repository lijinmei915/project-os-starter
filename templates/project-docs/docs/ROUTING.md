---
layer: governance
type: spec
last_verified: 2026-06-13
depends_on: [AGENTS.md, docs/DOCUMENTATION.md]
---

# 路由规则

> 用途：定义 AI 请求进入项目后的分流方式和固定第一响应。
> 什么时候更新：安装入口、请求分流、固定第一响应或领域能力入口变化时。
> 不要写什么：产品介绍、当前项目状态、交接流水、与路由无关的实现细节。

## 分流摘要

| 用户意图 | Route |
|----------|-------|
| 安装 / 接入 / 检查 / 升级 Project OS | `INSTALL` |
| 模糊产品、想法、东西请求 | `CLARIFICATION` |
| 新软件、系统、应用、网站、看板、仓库 | `INIT` |
| 只看不改、现状分析、架构 review | `AUDIT` |
| 接管项目、继续做、整理老项目 | `HYBRID` |
| tokens / UI 规范 / 设计系统 | `design-system` |
| 页面 / 组件 / 表单 / 表格实现 | `frontend` |

## 固定入口

`/os` 是显式安装入口。用户用自然语言表达“初始化、接入、检查、升级 Project OS”时，也进入同一条 `INSTALL` 路由。

## 第一响应

需要做路由验收时，先输出稳定路由前缀，再进入正文。

```txt
帮我写一个登录页
-> Skill: frontend
```

```txt
只帮我看看，不要改
-> AUDIT
```

## 维护规则

- `AGENTS.md` 只保留 AI 行为边界和路由摘要。
- 路由细则、固定第一响应和验收输入放在本文。
- adapter 只翻译读取方式，不另起规则源头。

## 相关文件

| 文件 | 关系 |
|------|------|
| `AGENTS.md` | AI 行为边界和路由摘要 |
| `docs/DOCUMENTATION.md` | 文档边界和更新规则 |
| `docs/NAMING.md` | 文件命名和放置规则 |
