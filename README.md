# AI Engineering Kit

> 用途：回答"这个仓库是什么、怎么开始、关键入口在哪、怎么安装给别人用"。
> 什么时候更新：入口说明、安装方式、关键目录职责、对外使用方式变化时。
> 不要写什么：AI 详细运行规则、当前交接流水、详细变更历史、内部 reference 细节。

一套通用的 AI 工程文件工具包：检查一个项目能不能被 AI 看懂、能不能被下一位开发者接住，并按需补齐工程文档结构。

## 能做什么

- 检查 AI 工程完整度，输出 100 分体检报告
- 补齐通用工程文档：规则、状态、交接、环境、测试、架构、运行手册
- 默认不覆盖已有文档，优先给出缺口和建议
- 支持 Claude / Codex / Cursor / Gemini 等工具适配

## 安装给别人用

把 GitHub 地址发给对方，让 AI 执行：

```txt
https://github.com/lijinmei915/project-os-starter.git
```

**最短 AI 提示：**

```txt
请把 AI Engineering Kit 以 core profile 安装到当前项目：
git clone https://github.com/lijinmei915/project-os-starter.git /tmp/pos && bash /tmp/pos/scripts/install-project-os.sh . --profile core && bash scripts/check-runtime.sh .
```

**手动执行：**

```bash
git clone https://github.com/lijinmei915/project-os-starter.git /tmp/pos
bash /tmp/pos/scripts/install-project-os.sh . --profile core
bash scripts/check-runtime.sh .
```

完整安装说明（profiles / adapters / upgrade）见 `INSTALL.md`。

## 检查项目完整度

**两种方式：**

**1. 浏览器直接看（推荐）**

直接打开项目根目录的 `index.html`，点"接手老项目"→选目录或上传 zip → 立刻出报告。无需任何命令、无需服务端。

**2. 命令行（适合 CI / 脚本场景）**

```bash
bash scripts/ai-project.sh report .
```

它会检查：

```txt
系统规则：AGENTS.md
开发者规则：docs/ENVIRONMENT.md
用户意图：PROJECT.md / README.md
项目文件：docs/ARCHITECTURE.md
工具反馈：docs/TESTING.md / scripts
交接摘要：HANDOFF.md
```

报告会写入：

```txt
.project-os/reports/ai-project-report.md
.project-os/reports/ai-project-report.json
```

如果后续想补齐更多工程文档模板：

```bash
bash scripts/add-project-docs.sh . --profile product
```

## AI 交互

直接对 AI 说你要做什么，例如"帮我初始化这个项目"或"这个老项目有点乱，帮我接管一下"。系统自动判断状态并进入对应流程。高级用户可输入 `/os` 显式触发。

如果你不用 Claude，没关系——Project OS 核心依赖 `AGENTS.md` + `docs/` + `scripts/`，Claude 只是当前第一个参考实现。

## 常用 slash commands

在 Claude Code 中可以使用项目级 `/` 命令：

| 命令 | 用途 |
|------|------|
| `/os` | 进入 Project OS 安装 / 接入 / 检查流程 |
| `/os-check` | 跑 Project OS 体检，检查核心文件和工作区状态 |
| `/os-test` | 跑或引导 v1 路由测试 |
| `/os-handoff` | 汇总当前状态、提交情况和下一步 |

## 关键文件

| 文件 | 职责 |
|------|------|
| `index.html` | 浏览器可视化报告页（standalone，浏览器本地分析，不依赖服务端） |
| `AGENTS.md` | AI 运行规则（路由、约束、文档边界） |
| `PROJECT.md` | 当前项目状态 |
| `HANDOFF.md` | 当前交接上下文 |
| `docs/NAMING.md` | 文档命名规范 |
| `docs/ARCHITECTURE.md` | 架构和模块职责 |
| `docs/ENVIRONMENT.md` | 环境变量、依赖、启动方式 |
| `docs/TESTING.md` | 测试和验收方式 |
| `docs/RUNBOOK.md` | 常见操作和故障处理 |
| `INSTALL.md` | 安装说明 |
| `docs/` | 长期治理、产品规划、设计规范 |
| `templates/` | 安装到目标项目的干净模板 |
| `scripts/` | 安装脚本、校验脚本 |
| `adapters/` | 各工具适配模板 |

当前状态见 `PROJECT.md`，交接上下文见 `HANDOFF.md`。
