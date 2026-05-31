# 项目状态

> 用途：回答“这个项目现在是什么阶段、架构怎样、进度到哪、下一步重点是什么”。
> 什么时候更新：阶段、架构、当前进度、已知问题、下一步重点变化时。
> 不要写什么：交接流水、详细历史、面向新用户的教程、长期决策论证。

## 项目定位

- 项目名：`Project OS`
- 一句话定位：检查并补齐通用 AI 工程文件，让项目能被 AI 和下一位开发者稳定接住
- 当前阶段：`AI Engineering Kit 自身工程化收口期`

## 当前架构

- 检查层：`scripts/check-ai-project.sh`
- 安装层：`scripts/install-project-os.sh`
- 规则映射：`.ai/rules/` + `scripts/sync-ai-rules.sh` (SSOT 引擎)
- 自动成长：`scripts/auto-reflect.sh` (反思) + `scripts/optimize-rules.sh` (修剪)
- 领域巡检：`scripts/check-frontend.sh`, `backend`, `testing`, `design`
- 文档层：`AGENTS.md` / `PROJECT.md` / `HANDOFF.md` / `docs/*`
- 报告层：`scripts/check-ai-project.sh` 准备评分数据，`schemas/ai-project-report.v0.1.json` 定义模块分组，`templates/report/ai-project-report.html` 渲染 HTML 报告
- 组件契约：`docs/design/ai-project-assistant/*`
- 规则源头：`AGENTS.md`
- 参考实现：`.claude/`
- 工具适配：`adapters/`

## 当前进度

- 已完成：v1 路由契约、profile-based 安装脚本、adapter 写入、项目模板 / 全局模板、文档治理、统一 `.ai/` 目录结构、前后端与设计测试专属脚本、自动成长反思引擎、动态规则映射同步、**v0.3 多维工程健康评分模型**。
- 正在做：基于 v0.3 模型进行真实老项目样本的成熟度校准。
- 暂不做：组件运行层 `ai-components`、组件库选型、工具原生 package 化。

## 已知问题

- 纯空目录里，未预装规则时，模型不会天然认识本工具
- 上下文完整度评分仍是轻量启发式检查，不替代人工 review
- **v0.3 成熟度模型对非 JS/TS 项目（如纯 Shell 项目）的 Lint/Test 检测仍有待适配更多包管理器。**

## 下一步重点

1. 用真实老项目样本继续校准文档质量阈值
2. 继续校准报告数据层和评分模型之间的对应关系
3. 抽样复查不同模型（如 Gemini 3 Pro）在自动反思时的总结质量
