# 文档编写规范

本文定义 Project OS 的文档边界和更新规则。

核心原则：

```txt
只写在最该负责的地方。
不要为了同步而同步。
```

---

## SSOT 原则

`SSOT` 是 Single Source of Truth，意思是“单一真实来源”。

同一类信息只放在一个主要位置，其他文档只引用或简短指向它。

如果文档冲突，按这个顺序判断：

| 问题 | SSOT |
|------|------|
| 这个项目怎么开始用 | `README.md` |
| AI 应该怎么行动 | `AGENTS.md` |
| 现在项目是什么状态 | `PROJECT.md` |
| 下一个人或 AI 怎么接手 | `HANDOFF.md` |
| 为什么做过某个架构决定 | `docs/DECISIONS.md` |
| 这次结构性改动影响了哪里 | `docs/CHANGELOG.md` |
| 犯过什么错，新增了什么约束 | `docs/LESSONS.md` |
| 怎么测试和验收 | `docs/TESTING.md`、`tests/` |

---

## 核心文件边界

### README.md

给人看的入口说明。

回答：

- 这是什么
- 能做什么
- 怎么安装
- 怎么开始使用
- 关键文件在哪里

不要写：

- AI 运行细则
- 临时交接
- 详细历史
- 内部路由实现细节

什么时候更新：

- 安装方式变了
- 对外使用方式变了
- 目录入口变了
- 项目定位面向用户的表述变了

---

### AGENTS.md

给 AI 用的运行规则。

回答：

- AI 进入项目后先读什么
- 请求如何路由
- 哪些行为禁止
- 文档之间冲突时谁优先
- 不同工具如何理解 Project OS

不要写：

- 面向用户的长介绍
- 当前进度流水账
- 交接细节
- 每次改动的历史记录

什么时候更新：

- 路由规则变了
- AI 行为边界变了
- 文档 SSOT 规则变了
- 跨工具入口约定变了

---

### PROJECT.md

当前项目状态。

回答：

- 这个项目现在是什么阶段
- 当前架构是什么
- 已完成什么
- 已知问题是什么
- 下一阶段重点是什么

不要写：

- 上一轮对话流水
- 详细变更历史
- 给新用户的教程
- 长期决策论证

什么时候更新：

- 项目阶段变了
- 架构分层变了
- 当前进度有实质变化
- 下一步重点变了
- 已知问题发生变化

---

### HANDOFF.md

当前交接上下文。

回答：

- 上一轮或当前连续任务做了什么
- 现在能不能继续
- 当前风险是什么
- 下一步具体干什么

不要写：

- 长期路线图
- 全量历史
- 产品介绍
- 已经稳定下来的架构决策全文

什么时候更新：

- 完成一次非平凡任务后
- 多文件改动后
- 有新的风险或下一步
- 准备交给下一个 AI / 人继续时

维护规则：

- 保持当前有效，不追求永久完整
- 旧的流水信息可以合并压缩
- 不要把 `docs/CHANGELOG.md` 复制进来

---

## docs/ 目录边界

### docs/DOCUMENTATION.md

文档治理规则。

回答：

- 每个文档负责什么
- 什么情况下更新哪个文件
- 哪些内容不能重复写

---

### docs/DECISIONS.md

架构决策记录。

回答：

- 做了什么决定
- 放弃了什么方案
- 为什么这么选
- 影响是什么

不要写：

- 当前状态流水
- 每次小改动
- 临时 TODO

---

### docs/CHANGELOG.md

结构性变更记录。

回答：

- 这次高价值改动是什么
- 影响到哪些层
- 相关文件有哪些

不要写：

- 当前状态
- 交接下一步
- 纯文案小修
- 无结构影响的零碎记录

什么时候更新：

- 跨层改动
- 安装 / 分发方式改变
- 路由机制改变
- 文档 SSOT 结构改变
- 适配层或测试体系改变

---

### docs/LESSONS.md

错误模式和复盘。

回答：

- 犯了什么错
- 根因是什么
- 新增了什么约束

什么时候更新：

- 误删、误改、误配
- 测试策略失效
- 路由反复跑偏
- 用户明确指出“你又猜了 / 又忘了 / 又乱改了”

---

### docs/TESTING.md 与 tests/

测试策略和测试用例。

`docs/TESTING.md` 写测试方法、验收原则、测试分层。

`tests/` 写具体 case、矩阵和可复测记录。

不要把测试结果塞进 `PROJECT.md`，除非它改变了当前项目状态。

---

## 适配层边界

### adapters/

工具适配模板。

回答：

- Claude / Codex / Cursor / Gemini 等工具应该读取什么入口
- 如何把 Project OS 的通用规则翻译成工具自己的规则文件

不要写：

- 新规则源头
- 与 `AGENTS.md` 冲突的行为规则
- 工具无关的项目状态

规则：

```txt
adapters/* 只能适配 AGENTS.md，不能替代 AGENTS.md。
```

---

### .claude/

Claude Code 参考实现。

回答：

- Claude Code 如何加载 Project OS
- slash commands 如何进入 Project OS
- skill reference 如何组织

不要写：

- Project OS 唯一实现假设
- 非 Claude 工具必须遵守的唯一入口

规则：

```txt
.claude/* 是 reference implementation，不是 Project OS 本体。
```

---

## 更新决策表

| 场景 | 应更新 |
|------|--------|
| 安装方式改变 | `README.md`、`INSTALL.md`、`docs/CHANGELOG.md`、`HANDOFF.md` |
| AI 路由规则改变 | `AGENTS.md`、相关 tests、`HANDOFF.md` |
| 跨工具适配改变 | `adapters/`、`README.md` 或 `INSTALL.md`、`docs/CHANGELOG.md`、`HANDOFF.md` |
| 项目阶段或下一步改变 | `PROJECT.md`、`HANDOFF.md` |
| 完成一次连续任务 | `HANDOFF.md` |
| 架构决策改变 | `docs/DECISIONS.md`、必要时 `PROJECT.md` / `AGENTS.md` |
| 犯错或测试暴露新问题 | `docs/LESSONS.md`、必要时 `AGENTS.md` 或 tests |
| 仅修正文案错别字 | 通常只改原文件，不更新 `CHANGELOG.md` |
| 新增测试 case | `tests/`，必要时 `docs/TESTING.md` |

---

## 写作风格

- 面向人看的说明：中文为主
- 调度名、模式名、目录名：稳定英文
- 规则靠近执行层时：英文硬规则优先，可加中文解释
- 每段回答一个问题
- 路径必须写准确
- 不写“未来可能会”，除非放在路线图或待确认里
- 不为了显得完整而编造当前没有的能力

---

## 反模式

不要：

- 每次改动都同时更新 README / PROJECT / HANDOFF / CHANGELOG
- 把 `PROJECT.md` 写成流水账
- 把 `HANDOFF.md` 写成永久历史
- 把 `CHANGELOG.md` 写成 TODO
- 把运行规则写进 `README.md`
- 把当前状态写进 adapter
- 在 `.claude/skills` 里定义通用规则后忘记同步到 `AGENTS.md`

---

## 大白话

```txt
README.md        = 给新用户怎么开始
AGENTS.md        = AI 应该怎么做
PROJECT.md       = 现在是什么
HANDOFF.md       = 接下来怎么接
CHANGELOG.md     = 以前为什么变
DECISIONS.md     = 为什么这么定
LESSONS.md       = 犯错后怎么避免再犯
tests/           = 怎么证明它稳定
adapters/        = 不同工具怎么读同一套规则
.claude/         = Claude Code 的参考实现
```
