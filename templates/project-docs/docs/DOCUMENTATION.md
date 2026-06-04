---
layer: governance
type: spec
last_verified: 2026-06-04
---

# 文档编写规范

> 用途：定义文档边界、命名方式和更新规则，让 AI 和人快速判断"这条信息该写进哪个文件"。
> 什么时候更新：文档分工、更新触发条件、SSOT 规则变化时。
> 不要写什么：当前项目状态、交接流水、具体业务实现。

---

## SSOT 原则

同一类信息只在一个文件里维护，其他地方只引用。冲突时按下表定主：

| 问题 | SSOT |
|------|------|
| 怎么开始用 | `README.md` |
| 产品定位和设计方向 | `PRODUCT.md` |
| AI 怎么行动 | `AGENTS.md` |
| 项目当前状态 | `PROJECT.md` |
| 交接 / 接手 | `HANDOFF.md` |
| 架构决策 | `docs/DECISIONS.md` |
| 结构性变更 | `docs/CHANGELOG.md` |
| 错误复盘 | `docs/LESSONS.md` |
| 环境和启动 | `docs/ENVIRONMENT.md` |
| 测试验收 | `docs/TESTING.md` |
| 架构职责 | `docs/ARCHITECTURE.md` |

---

## 核心文件边界

每个文件只回答一类问题。以下是最简判断依据：

### README.md
回答"这是什么、怎么装、怎么开始"。不写 AI 规则、交接流水。

### AGENTS.md
回答"AI 进来后怎么判断请求、哪些行为禁止"。不写产品介绍、项目进度。

### PROJECT.md
回答"项目现在是什么阶段、当前架构、已知问题"。不写交接细节、变更历史。

### HANDOFF.md
回答"这轮做了什么、风险是什么、下一步干什么"。不写长期路线图、产品介绍。

### docs/DECISIONS.md
回答"为什么这么定、放弃了什么方案"。不写当前 TODO。

### docs/CHANGELOG.md
回答"这次改动影响了什么层"。不写当前状态、纯文案小修。

### docs/LESSONS.md
回答"犯了什么错、新增了什么约束"。误删/误改/用户指出"又猜了"时更新。

### docs/TESTING.md
回答"怎么测试、怎么验收"。不写项目状态。

### docs/ARCHITECTURE.md
回答"模块职责、边界、数据流"。不写运行规则。

### docs/ENVIRONMENT.md
回答"环境变量、安装、启动命令"。不写架构分层。

---

## 快速判断示例

> 场景：用户反馈"登录接口偶现 500"，你排查后发现是连接池溢出，改了 `db/pool.ts`，加了超时重试。

| 该写到 | 写什么 |
|--------|--------|
| `HANDOFF.md` | 这轮修了连接池溢出，下一步补压测 |
| `docs/DECISIONS.md` | 为什么选超时重试而不是扩连接池 |
| `docs/CHANGELOG.md` | `db/pool.ts` 改了连接回收策略 |
| `docs/LESSONS.md` | 线上才发现连接泄漏，以后 CI 应加连接池检查 |
| 不该写到 `PROJECT.md` | 除非这个 bug 改变了项目阶段 |

---

## 文档头部规范

每个 .md 顶部应有：

```md
> 用途：这份文档回答什么问题
> 什么时候更新：什么情况下改它
> 不要写什么：哪些内容不该写进来
```

这样 AI 不需要读全文就能判断"该不该往这里写"。

---

## 反模式

- 每次改动同时更新 README / PROJECT / HANDOFF / CHANGELOG（按实际影响更新，不是全部）
- `PROJECT.md` 写成流水账
- `HANDOFF.md` 写成永久历史
- `CHANGELOG.md` 写成 TODO
- 把运行规则写进 `README.md`

## 相关文件

| 文件 | 关系 |
|------|------|
| `docs/NAMING.md` | 文件命名和放置位置 |
| `AGENTS.md` | AI 的文档职责定义 |
| `PRODUCT.md` | 产品方向（文档内容需对齐产品定位） |
