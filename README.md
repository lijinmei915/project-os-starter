# AI Engineering Kit

> 用途：回答"这个仓库是什么、怎么开始、关键入口在哪、怎么安装给别人用"。
> 什么时候更新：入口说明、安装方式、关键目录职责、对外使用方式变化时。
> 不要写什么：AI 详细运行规则、当前交接流水、详细变更历史、内部 reference 细节。

🔗 **在线体检**：[lijinmei915.github.io/project-os-starter](https://lijinmei915.github.io/project-os-starter/)
浏览器打开 → 选项目目录 / 拖 zip → 立刻看到工程完整度报告。不上传任何数据。

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

## 快速开始 (CLI 中控台)

如果你喜欢简单，只需记住一个命令。它将集成体检、反思、同步等所有功能：

```bash
# 启动交互式菜单
./kit

# 或者使用快捷命令
./kit check    # 运行体检
./kit reflect  # 自动反思
./kit sync     # 同步规则
```

## 检查项目完整度

**1. 浏览器直接看（推荐）**

直接打开项目根目录的 `index.html`，点"接手老项目"→选目录或上传 zip → 立刻出报告。

**2. 命令行领域体检（针对具体技术栈）**

除了通用的 `ai-project.sh`，你还可以运行领域专属检查：
- 前端规范检查：`bash scripts/check-frontend.sh .`
- 后端规范检查：`bash scripts/check-backend.sh .`
- 测试与 CI 检查：`bash scripts/check-testing.sh .`
- UI 与设计检查：`bash scripts/check-design.sh .`

## 自动成长引擎 (Auto-Growth)

本项目内置了 AI 自驱动迭代能力，让项目“越用越聪明”：

- **自动反思**：对 AI 说“自动反思”，它会抓取最近代码改动并沉淀经验到 `docs/LESSONS.md`。
- **唯一真相 (SSOT)**：所有文档通过 `scripts/sync-ai-rules.sh` 自动映射到 `.ai/rules/`，AI 永远读取最新规则。
- **规则修剪**：对 AI 说“优化规则”，它会自动识别并清理陈旧或冲突的约束。

## 关键文件

| 文件 / 目录 | 职责 |
|------|------|
| `.ai/` | **统一 AI 资产目录**（含规则映射、AI 技能定义、MCP 配置） |
| `index.html` | 浏览器可视化报告页 |
| `AGENTS.md` | AI 运行规则总入口 |
| `PROJECT.md` | 项目当前状态 |
| `HANDOFF.md` | 当前交接上下文 |
| `docs/AUTO_GROWTH.md` | 自动成长机制说明 |
| `docs/FRONTEND.md` | 前端技术规范模板 |
| `docs/BACKEND.md` | 后端技术规范模板 |
| `scripts/` | 包含 `sync-ai-rules`, `auto-reflect`, `check-*` 等核心引擎脚本 |

当前状态见 `PROJECT.md`，交接上下文见 `HANDOFF.md`。
