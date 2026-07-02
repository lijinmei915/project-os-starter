---
layer: governance
type: spec
last_verified: 2026-06-13
depends_on: [AGENTS.md, docs/DOCUMENTATION.md]
teaches: "Project OS 的请求分流、安装入口、v1 路由契约和固定第一响应"
use_when: "AI 需要判断用户请求该进入 INSTALL、INIT、AUDIT、HYBRID、CLARIFICATION 或领域 skill 时"
---

# 路由规则

> 用途：定义 Project OS 的请求分流、安装入口、v1 路由契约和固定第一响应。
> 什么时候更新：入口控制、路由模式、固定测试输入、第一响应格式或领域 skill 分流变化时。
> 不要写什么：产品介绍、当前交接流水、长期路线图、与路由无关的实现细节。

本文是 Project OS 的路由细则。根目录 `AGENTS.md` 只保留快速入口和分流摘要；详细路由契约以本文为准。

## Project OS Installation Entry

Project OS 支持两种安装 / 接入入口：

```txt
自然语言识别意图 = 默认入口
/os = 显式入口 / 高级入口 / 兜底入口
```

当用户表达以下意图时，自动进入 `INSTALL FLOW`，不要要求用户必须输入 `/os`：

- 帮我初始化这个项目
- 帮我把 Project OS 装进这个项目
- 帮我接管这个老项目
- 这个项目有点乱，帮我规范一下
- 帮我检查 Project OS 有没有缺文件
- 帮我升级一下 Project OS
- 这是空目录，帮我开始
- 这是已有项目，帮我接入规范

当用户输入：

```txt
/os
```

也直接进入 `INSTALL FLOW`。

`INSTALL FLOW` 只负责判断 Project OS 如何进入当前目录，不做业务 UI，不接组件库。

中文说明：
`/os` 是当前参考实现里的显式命令入口。
如果某个工具不支持 slash commands，仍然应通过自然语言意图进入同一条 INSTALL 路由。

INSTALL 路由必须同时看用户意图和目录状态：

```txt
安装 / 初始化 / 检查 / 升级 Project OS：
- 空目录 / 近似空目录 -> INSTALL / INIT
- 已安装 Project OS -> INSTALL / CHECK-UPGRADE
- 已有代码但未安装 Project OS -> INSTALL / HYBRID

接管 / 继续 / 整理项目：
- 已有项目或已安装 Project OS -> INSTALL / HYBRID

只看不改：
- AUDIT
```

中文说明：
“帮我初始化这个项目”在已安装 Project OS 的目录里，不要误判成 HYBRID；应该先检查当前 Project OS 结构和缺口。
“帮我接管这个老项目 / 整理继续做”才进入 HYBRID。

## 路由模式

`project-setup` 负责这些模式：

- `INSTALL`：Project OS 安装 / 接入 / 检查 / 升级
- `CLARIFICATION`：模糊产品 / 想法 / 东西请求
- `INIT`：启动新软件产品、系统、应用、网站、看板、仓库
- `AUDIT`：分析项目现状，包括职责承接和缺口
- `HYBRID`：目录证据明确为已有项目，且用户要接管、继续或整理

当前参考实现的内部流程材料放在：

- `.claude/skills/project-setup/references/install.md`
- `.claude/skills/project-setup/references/init.md`
- `.claude/skills/project-setup/references/audit.md`
- `.claude/skills/project-setup/references/hybrid.md`
- `.claude/skills/project-setup/references/clarification.md`

这些文件是内部流程材料，不是独立产品功能，也不是新的规则源头。
对非 Claude 工具，等价行为应通过 `AGENTS.md`、本文和 `adapters/` 适配得到。

## 增量意图契约

`project-setup` 在路由前先把每条用户消息作为增量 evidence，维护：

```txt
facts / currentIntent / futureSignals / constraints /
negativeConstraints / missing / confidence / route
```

规则：

- 当前动作明确且 confidence 为 high / medium：直接路由并推荐最小下一步。
- 未来可能需求只记录为 `futureSignals`，不立即生成完整工程内容。
- “不要 / 暂不 / 只看不改”等内容进入 `negativeConstraints`。
- 当前动作缺失、多个当前动作冲突、或 confidence 为 low：进入 `CLARIFICATION`，只问一个最关键问题。
- 用户话语不明确且没有明确已有项目目录证据时，不要默认 `HYBRID`。

## v1 路由契约

以下输入必须稳定分流：

| 用户输入 | 目标 |
|----------|------|
| 我想做一个产品 | `project-setup / CLARIFICATION` |
| 我想做一个后台管理系统 | `project-setup / INIT` |
| 我想快速做一个后台管理系统原型 | `project-setup / INIT / Prototype-first` |
| 帮我看看这个项目架构怎么样 | `project-setup / AUDIT` |
| 这个项目有点乱，帮我整理一下继续做 | `project-setup / HYBRID` |
| 帮我设计 tokens 规范 | `design-system` |
| 帮我写一个登录页 | `frontend` |

v1 测试输出必须先打路由前缀，再进入正文。

```txt
帮我写一个登录页
-> 第一行：Skill: frontend
```

INSTALL / AUDIT 测试同样必须先打路由前缀：

```txt
帮我检查一下 Project OS 有没有缺文件
-> INSTALL / CHECK-UPGRADE
```

```txt
只帮我看看，不要改
-> AUDIT
```

安装相关第一响应也必须稳定：

```txt
输入：帮我初始化这个项目，接入 Project OS
第一行：INSTALL / INIT
```

如果同一轮里已经完成安装，不能停在“已安装完成”。
必须继续进入 INIT，并在启动方式不明确时立刻输出：

```txt
这是一个 INIT 请求。你希望我按哪种方式开始？

1. 快速原型：先生成一个能看的页面
2. 项目治理：先建立项目结构、文档、规范
3. 完整项目：先建基础，再生成页面
```

本轮结束条件：

```txt
INIT 启动方式已经明确
```

如果 `Prototype-first / Foundation-first / Full setup` 还没明确，本轮不能结束在安装总结。

## CLARIFICATION 第一响应

用户只说“我想做一个产品 / 我有个想法 / 想做个东西”时，不要泛问“什么产品”。

必须先走内部澄清，且只问下面这一组问题，不要扩展成目标用户、平台、技术栈、已有代码：

```txt
这是一个 CLARIFICATION 请求。我先确认一下：

1. 你是想做软件系统，还是产品方案？
2. 如果是软件系统，是想快速出原型，还是先建项目基础？
```

上面是 v1 兼容 case，不是所有澄清请求的固定表单。

其他低置信度输入应先总结已经理解的内容，再只问一个能解除最大歧义的问题：

```txt
输入：1234567
输出：我还没识别出你想推进的目标。你现在是想创建新项目、接手已有项目，还是只讨论产品方案？
```

## INIT 第一响应

用户想做新的软件、系统、应用、网站、看板时，先从话语 evidence 推导最小下一步。

用户已经说清“先做登录页 / 先搭基础 / 暂时不要页面”时，直接推导启动模式，不重复问三选一。

只有当前动作仍然宽泛时，才问启动模式。

不要先问技术栈、功能范围、数据库、部署、权限、模块、用户角色或组件库。

```txt
这是一个 INIT 请求。你希望我按哪种方式开始？

1. 快速原型：先生成一个能看的页面
2. 项目治理：先建立项目结构、文档、规范
3. 完整项目：先建基础，再生成页面
```

如果用户明确说“快速 / 原型 / prototype”，直接判定：

```txt
Start mode: Prototype-first
本次目标：先生成一个可见原型。
```

之后最多问一个范围问题，不要先问技术栈、数据库、组件库。

## v1 验收输入的固定处理

这几条是 v1 收口测试用例，必须稳定输出：

```txt
输入：我想做一个产品
输出：这是一个 CLARIFICATION 请求。我先确认一下：
1. 你是想做软件系统，还是产品方案？
2. 如果是软件系统，是想快速出原型，还是先建项目基础？
```

```txt
输入：我想做一个后台管理系统
输出：这是一个 INIT 请求。你希望我按哪种方式开始？
1. 快速原型：先生成一个能看的页面
2. 项目治理：先建立项目结构、文档、规范
3. 完整项目：先建基础，再生成页面
```

```txt
输入：帮我初始化这个项目，接入 Project OS
输出第一行：INSTALL / INIT
如果已完成安装且启动方式不明确，继续输出 INIT 启动方式选择；不要停在安装总结。
```

```txt
输入：我想快速做一个后台管理系统原型
输出：Start mode: Prototype-first
本次目标：先生成一个可见原型。
```

```txt
输入：帮我写一个登录页
输出：Skill: frontend
```

## HYBRID 第一响应

用户说“这个项目 / 当前项目 / 继续做 / 整理一下”时，在项目目录里默认指当前 workspace。

不要先问这是本地项目、Supabase、Vercel、GitHub 还是其他平台。

如果没有文件读取工具：

```txt
这是一个 HYBRID 请求，但当前没有可用的文件读取工具。
请提供文件访问权限，或先贴 README.md / PROJECT.md / AGENTS.md 的内容。
```

## 领域 skill 第一响应

- “设计 tokens / tokens 规范 / UI 规范”默认是 `design-system`，不要先解释 Auth Token 或 LLM Token。
- “登录页 / 页面 / 组件 / 表单 / 表格”默认是 `frontend`，不要当成新项目初始化。
- 具体页面 / 组件请求的第一行应输出 `Skill: frontend`，方便测试和交接判断。
