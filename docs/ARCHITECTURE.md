---
layer: knowledge
type: spec
last_verified: 2026-06-04
depends_on: [AGENTS.md]
teaches: "系统的模块划分、核心数据流和各层之间的边界"
use_when: "AI 需要理解整体系统结构、判断某个改动影响范围、或向用户解释架构时"
---

# 架构说明

> 用途：说明系统结构、核心模块、数据流和边界。
> 什么时候更新：模块职责、运行路径、数据流、部署结构或跨层边界变化时。
> 不要写什么：当前交接流水、详细变更历史、临时任务计划。

本文是 Project OS / AI Engineering Kit 的架构说明。

## 当前定位

Project OS 正在收敛为通用的 AI Engineering Kit：

```txt
检查 AI 工程完整度
按需补齐工程文档
保留跨工具 AI 规则适配
```

它不是业务 UI 框架，也不是某个平台专属插件。

## 核心层次

```txt
1. 规则入口层：AGENTS.md / adapters
2. 项目状态层：PROJECT.md / HANDOFF.md / .project-os/state.json
3. 工程文档层：docs/*
4. 工具脚本层：scripts/*
5. 模板分发层：templates/project/*
6. 本地生成物层：.project-os/reports/* / .project-os/graph/*
```

## 运行路径

### 检查路径

```txt
scripts/check-ai-project.sh
-> 扫描已有文件
-> 按系统规则 / 环境 / 用户意图 / 项目文件 / 工具反馈 / 交接摘要评分
-> 输出完整度报告
```

### 关系图路径

```txt
scripts/build-project-graph.sh
-> 扫描核心文档、脚本、schema、模板和 AI 资产
-> 识别文件节点、层级、SSOT 标记、模板标记、引用关系和 .ai/rules 映射
-> 输出 .project-os/graph/project-graph.json
```

关系图只做静态结构分析，不调用 LLM、不联网、不取代人工 review。

### 安装路径

```txt
scripts/install-project-os.sh
-> 选择 profile
-> 从 templates/project 复制模板
-> 备份冲突文件
-> 写入 .project-os/version 和 state.json
```

### 同步路径

```txt
scripts/sync-templates.sh
-> 将可分发 runtime 同步到 templates/project

scripts/check-template-sync.sh
-> 检查源 runtime 与模板是否漂移
```

## 模块职责

| 区域 | 职责 |
|------|------|
| `AGENTS.md` | AI 行为规则和文档边界 |
| `PROJECT.md` | 当前项目状态 |
| `HANDOFF.md` | 当前交接摘要 |
| `docs/` | 工程规范、架构、测试、命名、决策 |
| `scripts/` | 安装、检查、同步 |
| `templates/project/` | 安装到目标项目的干净模板 |
| `adapters/` | Claude / Codex / Cursor / Gemini 适配 |
| `.claude/` | Claude Code 参考实现 |
| `.project-os/graph/` | 本地生成的项目关系图 |

## 边界

- 源仓库可以保留完整能力。
- 目标项目默认只安装必要文档。
- 已有文档默认不覆盖；需要更新时先备份或生成建议。
- AI 规则不依赖单一平台自动触发。

## 兼容说明

`docs/CODE_STRUCTURE.md` 仍保留，用于描述代码目录职责。
新项目优先阅读本文件理解整体架构。
