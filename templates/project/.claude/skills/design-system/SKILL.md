---
name: design-system
description: >
  负责设计规范、Design Tokens、布局约束和 UI 系统。
  适用请求："帮我设计 tokens 规范"、"设计规范"、"UI 规范"等。
  注意"设计 tokens"指 Design Tokens，不是 Auth Tokens 或 LLM Tokens。
---

# design-system

## 职责

负责设计规则、tokens、布局约束和 UI 规范。

## 边界

- 明确是设计规范、tokens、布局或 UI 规则时直接响应
- 不负责具体页面实现（交给 frontend）
- 不负责项目初始化、架构决策

## 示例

用户：帮我设计 tokens 规范

按 Design Tokens 处理颜色、字号、间距、圆角、阴影、层级等。
不要先问"是 Auth Tokens 还是 Design Tokens"。
