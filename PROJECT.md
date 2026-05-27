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
- 文档层：`AGENTS.md` / `PROJECT.md` / `HANDOFF.md` / `docs/*`
- 报告层：`scripts/check-ai-project.sh` 准备评分数据，`schemas/ai-project-report.v0.1.json` 定义模块分组，`templates/report/ai-project-report.html` 渲染 HTML 报告
- 组件契约：`docs/design/ai-project-assistant/*`
- 规则源头：`AGENTS.md`
- 参考实现：`.claude/`
- 工具适配：`adapters/`

## 当前进度

- 已完成：v1 路由契约、profile-based 安装脚本、adapter 写入、项目模板 / 全局模板、文档治理
- 正在做：AI Engineering Kit 自身工程化补齐，已补双分数模型、strict 模板同步、可执行回归测试入口、评分模型 schema、报告模块数据源、JSON 报告返回值、追加工程文档工具、GitHub Actions CI、报告页视觉 diff 入口、报告模板层、跨工具 adapter 回归和老项目空模板文档识别
- 暂不做：组件运行层 `ai-components`、组件库选型、工具原生 package 化

## 已知问题

- 纯空目录里，未预装规则时，模型不会天然认识本工具
- 上下文完整度评分仍是轻量启发式检查，不替代人工 review
- 工程成熟度 v0.2 当前模型已全部通过，老项目空模板文档已能识别；仍需要用真实老项目和真实工具会话继续校准
- HTML 报告已拆出运行时模板，动态模块标题、说明和 section 分组已迁到 `schemas/ai-project-report.v0.1.json`；渲染仍由 shell 生成静态 HTML，机器可读结果写入 `.project-os/reports/ai-project-report.json`
- 截图回归已具备结构标记检查、桌面 / 移动端截图和真实像素 diff；当前已生成第一版桌面 / 移动端 baseline

## 下一步重点

1. 用真实老项目样本继续校准文档质量阈值
2. 继续校准报告数据层和评分模型之间的对应关系
3. 用真实工具会话抽样复查 Claude / Codex / Cursor / Gemini 路由表现
