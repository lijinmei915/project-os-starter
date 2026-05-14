# 项目状态

> 用途：回答“这个项目现在是什么阶段、架构怎样、进度到哪、下一步重点是什么”。
> 什么时候更新：阶段、架构、当前进度、已知问题、下一步重点变化时。
> 不要写什么：交接流水、详细历史、面向新用户的教程、长期决策论证。

## 项目定位

- 项目名：`Project OS`
- 一句话定位：把 AI 驱动开发流程收口成可安装、可分流、可交接的 runtime
- 当前阶段：`v1 可安装 runtime 收口期`

## 当前架构

- 入口层：`project-setup`
- 规则层：`design-system`
- 执行层：`frontend`
- 规则源头：`AGENTS.md`
- 参考实现：`.claude/`
- 工具适配：`adapters/`

## 当前进度

- 已完成：v1 路由契约、INSTALL FLOW、profile-based 安装脚本、adapter 写入、项目模板 / 全局模板、文档治理
- 正在做：profile 安装验收、提交前收口
- 暂不做：组件运行层 `ai-components`、组件库选型、工具原生 package 化

## 已知问题

- 纯空目录里，未预装规则时，模型不会天然认识 `Project OS`
- CLI / 桌面端验收仍以人工复测为主

## 下一步重点

1. commit 并 push profile-based install 改动
2. 用远端地址重做 `core` / `product` / `full` 安装验收
3. 继续收紧对外最短安装文案
