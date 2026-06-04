---
layer: knowledge
type: spec
last_verified: 2026-06-04
depends_on: [docs/DESIGN_STANDARDS.md]
---

# 前端技术说明

> 用途：说明前端技术栈选型、状态管理、组件库规范、路由策略及构建工具。
> 什么时候更新：前端架构发生重大变更、引入新的核心库或规范改变时。
> 不要写什么：单个组件的 API 文档、临时 bug 修复记录。

## 1. 技术栈选型

- **框架**：[例如：React / Vue / Svelte / Vanilla JS]
- **语言**：[例如：TypeScript / JavaScript]
- **构建工具**：[例如：Vite / Webpack / Next.js / Nuxt]

## 2. 状态管理

- **全局状态**：[例如：Redux / Zustand / Zustand / Context API]
- **服务端状态**：[例如：React Query / SWR / Apollo]
- **表单状态**：[例如：React Hook Form / Formik]

## 3. 样式与组件库

- **CSS 方案**：[例如：Tailwind CSS / CSS Modules / Styled Components]
- **基础组件库**：[例如：shadcn/ui / Radix / Ant Design]
- **图标库**：[例如：Lucide / Heroicons]

## 4. 目录结构规范

```txt
src/
  ├── components/  # 通用 UI 组件
  ├── pages/       # 页面级视图 (或 app/)
  ├── hooks/       # 自定义 Hooks
  ├── store/       # 状态管理
  ├── utils/       # 工具函数
  ├── types/       # TypeScript 类型定义
  ├── assets/      # 静态资源
  └── styles/      # 全局样式与变量
```

## 5. 核心约定

1. **强类型**：必须定义接口（Interfaces/Types），尽量避免使用 `any`。
2. **组件职责**：区分容器组件（负责数据获取和业务逻辑）和展示组件（只负责渲染 UI 和事件回调）。
3. **设计 Tokens**：颜色、间距、字号必须使用定义好的 Design Tokens，严禁在业务代码中写死十六进制色值。

## 相关文件

| 文件 | 关系 |
|------|------|
| `docs/DESIGN_STANDARDS.md` | 前端 UI 和设计系统边界 |
| `docs/ARCHITECTURE.md` | 前端模块在系统架构中的位置 |
| `PRODUCT.md` | 产品定位和用户体验原则 |
