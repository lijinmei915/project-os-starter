# AI Runtime / Project OS

这是一个用于构建 AI 驱动开发流程的项目操作系统。

它不是普通模板，也不是一次性脚手架，而是一套可控的 AI 开发 Runtime：负责识别项目阶段、统一入口调度、沉淀协作规则，并把项目从初始化、接管、设计约束到前端实现串成稳定流程。

## 能做什么

- 自动识别项目阶段：新项目、接管项目、混合状态
- 统一入口调度：由 `project-setup` 先判断路径
- 固化设计约束：由 `design-system` 承接 UI 规则
- 约束前端实现：由 `frontend` 执行代码落地
- 记录项目状态：用 `PROJECT.md` 和 `HANDOFF.md` 保持上下文连续

## 核心结构

当前结构以真实目录为准，不在 README 里手写完整树。

查看结构：

```bash
find . -maxdepth 3 -type f | sort
```

关键入口：

| 路径 | 职责 |
|------|------|
| `README.md` | 给人看的入口说明 |
| `AGENTS.md` | 给 AI 用的运行规则 |
| `PROJECT.md` | 当前项目状态 |
| `HANDOFF.md` | 当前交接上下文 |
| `.claude/` | Claude 运行配置、hooks、内部能力材料 |
| `.claude/skills/project-setup/references/` | 初始化、审计等内部流程 reference |
| `docs/` | 历史文档、规范草案、可插拔参考材料 |
| `examples/` | 示例材料 |
| `scripts/` | 检查脚本 |

## 如何使用

直接对 AI 说你要做什么，例如：

```txt
我想做一个项目
```

或：

```txt
帮我接管这个老项目
```

系统应自动：

1. 判断请求类型
2. 进入对应流程
3. 加载必要 reference
4. 输出结构化结果

## 安装 / 接入 Project OS

Project OS 支持两种入口：

```txt
自然语言识别意图 = 默认入口
/os = 显式入口 / 高级入口 / 兜底入口
```

普通用户可以直接说：

```txt
帮我初始化这个项目
```

或：

```txt
这个老项目有点乱，帮我接管一下
```

系统会进入 `INSTALL FLOW`，先判断当前目录：

| 目录状态 | 路由 |
|----------|------|
| 空目录 / 近似空目录 | `INSTALL / INIT` |
| 已有代码项目 | `INSTALL / HYBRID` |
| 已安装 Project OS | `INSTALL / CHECK-UPGRADE` |
| 只看不改 | `AUDIT` |

高级用户也可以输入：

```txt
/os
```

`/os` 是显式快捷入口，不是唯一入口。

## 常用 slash commands

在 Claude Code 中可以使用项目级 `/` 命令：

| 命令 | 用途 |
|------|------|
| `/os` | 进入 Project OS 安装 / 接入 / 检查流程 |
| `/os-check` | 跑 Project OS 体检，检查核心文件和工作区状态 |
| `/os-test` | 跑或引导 v1 路由测试 |
| `/os-handoff` | 汇总当前状态、提交情况和下一步 |

这些命令定义在：

```txt
.claude/commands/
```

它们是显式操作按钮，不是自动强制门禁。

## 设计原则

- 入口统一：项目相关请求优先经过 `project-setup`
- UI 有规则：涉及界面时必须遵守 `design-system`
- 代码受约束：`frontend` 只负责实现，不自由发挥设计
- 英文做调度：目录名、模式名、能力名用稳定英文
- 中文做认知：说明、判断、交接尽量用中文表达
- 收口优先：当前阶段只稳定内核，不扩功能

## 当前状态

当前状态见 `PROJECT.md`。

AI 行为规则见 `AGENTS.md`。

交接上下文见 `HANDOFF.md`。
