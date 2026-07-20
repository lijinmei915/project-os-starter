---
layer: knowledge
type: spec
last_verified: 2026-06-04
teaches: "设计 token 体系、布局规则、组件库策略和视觉边界"
use_when: "AI 要调整 UI 样式、选颜色/字号/间距、或判断设计方案是否合规时"
---

# OmniDesk 设计规范总入口

> 用途：定义当前设计边界、token 方向、布局规则和组件库策略。
> 什么时候更新：设计系统范围、token 分类、组件库接入策略或 UI 约束变化时。
> 不要写什么：前端实现流水、当前交接、与设计无关的工程决策。
> 当前桌面端允许接入 Headless / shadcn-style 组件层；组件视觉必须映射到 OmniDesk tokens。
> 具体 token、布局和组件索引见 `docs/design/*.md`。

---

## 当前状态

OmniDesk 以 `desktop/` 的 Tauri + React 工作台为唯一用户界面。设计 token、组件索引和工作区可视化规范分别由 `docs/design/` 与 `desktop/src/styles.css` 维护；旧静态报告模板已退役。

设计规范的作用是：

- 约束未来 UI 生成时必须先经过 `design-system`
- 明确 Design Tokens 的基础分类和当前 v0.1 数值表
- 防止 AI 在没有规则时自由发挥 UI 风格
- 防止工作台组件和 Runtime 证据页面出现两套不一致的视觉规则

---

## 文档结构

| 文档 | 职责 |
|------|------|
| `docs/DESIGN_STANDARDS.md` | 设计规范总入口 |
| `docs/design/tokens.md` | token 命名、数值表和使用原则 |
| `docs/design/layout.md` | 页面壳、工作台、表单、列表和响应式布局规则 |
| `docs/design/component-index.md` | 组件分层和索引 |
| `docs/design/workbench-visualization.md` | OmniDesk 工作区各菜单工作面的可视化结构、状态和交互规范 |

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

### 4. 组件库策略

桌面端当前采用：

- Radix primitives / Slot 等无头能力
- shadcn-style 本地组件拷贝与改造
- Project OS Desktop token layer 作为视觉 SSOT

规则：

- 不直接套第三方默认主题。
- 不把组件库 token 当作项目 token 的 SSOT。
- 新增组件先落在 `desktop/src/components/ui`，通过 variant / state 复用。
- 组件视觉值必须来自 `docs/design/tokens.md` 和 `desktop/src/styles.css` 的 token layer。
- `ai-components` 暂不作为运行时组件层；后续若接入，只能作为更高层组合或生成协议。

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
- 组件库要接，但必须走 Headless / token-mapped 路线
