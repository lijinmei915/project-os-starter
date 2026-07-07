---
layer: knowledge
type: status
last_verified: 2026-07-03
teaches: "项目当前所处阶段、架构全貌、进度和下一步重点"
use_when: "AI 需要判断当前该做什么、项目处于什么状态、或向用户汇报进度时"
depends_on: [AGENTS.md, docs/PRODUCT_PLAN.md]
---

# 项目状态

> 用途：回答“这个项目现在是什么阶段、架构怎样、进度到哪、下一步重点是什么”。
> 什么时候更新：阶段、架构、当前进度、已知问题、下一步重点变化时。
> 不要写什么：交接流水、详细历史、面向新用户的教程、长期决策论证。

## 项目定位

- 项目名：`Project OS`
- 一句话定位：`OmniDesk / Project OS Desktop` 是一个会持续学习项目的本地 AI 工程工作台，让任何新老项目都能按一套清晰流程被理解、治理、开发和演进
- 当前阶段：`Project OS Console 内核收口期 / Desktop v0.1 方向确认期`

OmniDesk 是用户入口和项目治理中枢，不是 Hermes Studio 复制品，也不是传统 IDE。用户把任何新项目或老项目接进来后，不需要先理解目录、脚本、规范、模型配置或交付流程；系统负责认识项目、显性化研发流程、沉淀记忆、维护治理文件、生成待办、跑检查并辅助 coding，让项目越做越清晰，工作台越用越好用。

## 当前架构

- 检查层：`scripts/check-ai-project.sh`
- 推荐层：`scripts/recommend-next.sh`
- 安装层：`scripts/install-project-os.sh`
- 规则映射：`.ai/rules/` + `scripts/sync-ai-rules.sh` (SSOT 引擎)
- 关系图谱：`scripts/build-project-graph.sh` 输出 `.project-os/graph/project-graph.json`
- 自动成长：`scripts/auto-reflect.sh` (反思) + `scripts/optimize-rules.sh` (修剪)
- 领域巡检：`scripts/check-frontend.sh`, `backend`, `testing`, `design`
- 文档层：`AGENTS.md` / `PROJECT.md` / `HANDOFF.md` / `docs/*`
- 报告层：`scripts/check-ai-project.sh` 准备评分数据，`schemas/ai-project-report.v0.1.json` 定义模块分组，`templates/report/ai-project-report.html` 渲染 HTML 报告
- 组件契约：`docs/design/ai-project-assistant/*`
- 桌面端方向：`docs/DESKTOP_APP.md` 定义 `Tauri + Local Agent Core + Workbench UI`
- 桌面端骨架：`desktop/` Tauri v0.1 壳，使用 Vite + React 组件工程加载紧凑工作台 UI，并通过 Rust command 读取本地 `.project-os` 快照、桌面项目 registry、模型 provider 配置、model catalog 和 theme 配置；已支持系统目录选择、路径备用添加、registry 内切换当前项目、只读计划生成、本地任务队列、任务记录持久化、patch draft 生成、Diff 草案审阅、受控 Apply Patch、Apply 后自动验证、本地 run summary 写入、用户确认后合并到 `HANDOFF.md`、受控 runner、provider 小白式配置、多 profile、管理员维护模型列表、桌面端 token layer、可配置主题色 token、顶部主题菜单、自定义主题色新增和删除、主题偏好写入 `.project-os/desktop-theme.json`、Headless / shadcn-style 本地组件层、Button / Input / Select / Badge / Panel / Field / Notice / SectionTitle / Tabs / Tooltip / Dialog / DropdownMenu / Switch primitives 和交互态 token 化、Radix Label / Tabs / Tooltip / Dialog / DropdownMenu / Switch 官方 primitives、workbench pattern 起点、网关 `/models` 刷新模型池和当前模型 `/chat/completions` 可用性测试；provider 启用且环境变量 key 存在时会调用 OpenAI-compatible `/chat/completions`；已可打包为 macOS `.app` 双击启动
- 规则源头：`AGENTS.md`
- 参考实现：`.claude/`
- 工具适配：`adapters/`

## 当前进度

- 已完成：v1 路由契约、profile-based 安装脚本、adapter 写入、项目模板 / 全局模板、文档治理、统一 `.ai/` 目录结构、前后端与设计测试专属脚本、自动成长反思引擎、动态规则映射同步、项目关系图谱生成、知识结构化（文档 frontmatter 元数据、图谱解析、评分元数据 / 新鲜度维度、架构图读图谱自动渲染）。
- 正在做：Project OS Console 内核 + Desktop v0.1：项目理解、推荐补齐、可解释置信度、生成前检查、交接状态和桌面端 Local Agent Core 边界。
- 暂不做：完整 IDE、开放插件市场、多 Agent 编排、远程执行、`ai-components` 运行层、工具原生 package 化。
- 后续再做：交接内容结构化合并和 coding 闭环打磨。

## 已知问题

- 纯空目录里，未预装规则时，模型不会天然认识本工具
- 上下文完整度评分仍是轻量启发式检查，不替代人工 review
- **v0.3 成熟度模型对非 JS/TS 项目（如纯 Shell 项目）的 Lint/Test 检测仍有待适配更多包管理器。**

## 下一步重点

1. 建立目标验收标准
2. 接入目标验收报告
3. 完善目标签收和追溯
