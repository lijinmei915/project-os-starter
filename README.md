# AI Runtime / Project OS

> 用途：回答"这个仓库是什么、怎么开始、关键入口在哪、怎么安装给别人用"。
> 什么时候更新：入口说明、安装方式、关键目录职责、对外使用方式变化时。
> 不要写什么：AI 详细运行规则、当前交接流水、详细变更历史、内部 reference 细节。

一套可安装的 AI 开发 Runtime：识别项目阶段、统一入口调度、沉淀协作规则，把项目从初始化到交接串成稳定流程。

## 能做什么

- 自动识别项目阶段（新项目 / 接管 / 混合），统一路由
- 固化 AI 协作规则，避免每次对话从头约定
- 记录项目状态，保持上下文连续（`PROJECT.md` / `HANDOFF.md`）
- 支持 Claude / Codex / Cursor / Gemini 多工具适配

## 安装给别人用

把 GitHub 地址发给对方，让 AI 执行：

```txt
https://github.com/lijinmei915/project-os-starter.git
```

**最短 AI 提示：**

```txt
请把 Project OS 以 core profile 安装到当前项目：
git clone https://github.com/lijinmei915/project-os-starter.git /tmp/pos && bash /tmp/pos/scripts/install-project-os.sh . --profile core && bash scripts/check-runtime.sh .
```

**手动执行：**

```bash
git clone https://github.com/lijinmei915/project-os-starter.git /tmp/pos
bash /tmp/pos/scripts/install-project-os.sh . --profile core
bash scripts/check-runtime.sh .
```

完整安装说明（profiles / adapters / upgrade）见 `INSTALL.md`。

## 安装后怎么用

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
| `AGENTS.md` | AI 运行规则（路由、约束、文档边界） |
| `PROJECT.md` | 当前项目状态 |
| `HANDOFF.md` | 当前交接上下文 |
| `INSTALL.md` | 安装说明 |
| `docs/` | 长期治理、产品规划、设计规范 |
| `templates/` | 安装到目标项目的干净模板 |
| `scripts/` | 安装脚本、校验脚本 |
| `adapters/` | 各工具适配模板 |

当前状态见 `PROJECT.md`，交接上下文见 `HANDOFF.md`。
