# Project OS 设计规范总入口

> 用途：定义当前设计边界、token 方向、布局规则和组件库策略。
> 什么时候更新：设计系统范围、token 分类、组件库接入策略或 UI 约束变化时。
> 不要写什么：前端实现流水、当前交接、与设计无关的工程决策。
> 当前阶段不接组件库；已存在静态 HTML 报告页和轻量组件契约，但尚未建立应用级前端组件工程。
> 具体 token、布局和组件索引见 `docs/design/*.md`。

---

## 当前状态

Project OS 现在没有应用级 `src/`、没有组件库，也没有 React / Vue 等前端运行层。

但 AI 项目工程助手报告页已经形成静态 HTML 原型和轻量组件契约：

- 报告页由 `scripts/check-ai-project.sh` 生成
- 报告页当前沉淀为 9 个核心组件和 2 个页面组合模式
- 组件契约登记在 `docs/design/ai-project-assistant/components.md`
- TS 数据源和类型契约登记在 `docs/design/ai-project-assistant/components.ts`、`docs/design/ai-project-assistant/data.ts`
- 组件索引登记在 `docs/design/component-index.md`

设计规范的作用是：

- 约束未来 UI 生成时必须先经过 `design-system`
- 明确 Design Tokens 的基础分类和当前 v0.1 数值表
- 防止 AI 在没有规则时自由发挥 UI 风格
- 防止静态报告页和未来组件工程之间出现两套不一致的视觉规则

---

## 文档结构

| 文档 | 职责 |
|------|------|
| `docs/DESIGN_STANDARDS.md` | 设计规范总入口 |
| `docs/design/tokens.md` | token 命名、数值表和使用原则 |
| `docs/design/layout.md` | 页面壳、工作台、表单、列表和响应式布局规则 |
| `docs/design/component-index.md` | 组件分层和索引 |

---

## 总规则

### 1. 先路由，再设计

涉及设计规则、tokens、布局、组件规范时，进入 `design-system`。

不要让 `frontend` 自己决定视觉规则。

### 2. Token 优先

- 颜色、圆角、阴影、字号、间距优先走 token
- 不在组件里散落硬编码视觉值
- 当前 token 表见 `docs/design/tokens.md`

### 3. 结构先于装饰

- 先确定信息层级、状态位置和操作优先级
- 不为了“显得完整”额外套无意义卡片或装饰
- 没有明确分组意义时，优先保持结构简单

### 4. 组件库暂不接入

当前阶段不接：

- Radix Themes
- shadcn/ui
- ai-components

后续接入前，需要先明确：

- 组件层是否由 `frontend` 直接使用
- 是否需要 `ai-components` 二次封装
- Design Tokens 如何映射到组件库主题

---

## 状态检查

凡涉及条件渲染、状态切换、空态、错态、加载态，交付时必须说明：

```txt
状态检查：
- 默认态：
- 加载态：
- 空态：
- 错误态：
- 交互态：
```

---

## 一句话原则

Project OS 的设计规范目标不是写一份大而全 UI 手册，而是让 AI 在真正生成 UI 前知道：

- 该走 `design-system`
- 该复用 token
- 该尊重布局和状态规则
- 当前阶段不接组件库
