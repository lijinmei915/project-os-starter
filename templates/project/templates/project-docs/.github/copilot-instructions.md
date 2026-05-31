# GitHub Copilot Instructions

> 用途：定义 GitHub Copilot 在本项目中的行为规则。
> 什么时候更新：代码风格、命名约定、测试要求变化时。

## 项目概述

<!-- 一句话描述项目用途 -->

## 代码风格

- 使用中文注释
- 优先使用项目已有的工具函数（见 `utils/` 或 `lib/`）
- 不引入项目未使用的第三方库
- 类型优先：能用 TypeScript 类型约束的不用运行时校验

## 命名约定

- 变量/函数：camelCase
- 组件/类：PascalCase
- 文件：kebab-case
- 常量：UPPER_SNAKE_CASE

## 测试要求

- 新增功能需附带测试用例
- 测试文件放在同级 `__tests__/` 目录或 `.test.ts` 后缀

## 上下文参考

- `AGENTS.md`：AI 协作规范
- `PROJECT.md`：项目当前状态
- `PRODUCT.md`：产品定位和设计原则
- `docs/ARCHITECTURE.md`：模块职责和边界
