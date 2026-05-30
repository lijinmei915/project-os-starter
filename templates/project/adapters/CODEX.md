# Codex Adapter

> 用途：把 `AGENTS.md` 的通用规则翻译成 Codex 的读取入口。
> 什么时候更新：Codex 专属行为变化时。
> 不要写什么：新的规则源头、项目状态、交接。

通用规则以 `AGENTS.md` 为准，本文件只放 Codex 专属行为。

## 读取顺序

1. `AGENTS.md`（通用规则）
2. `PROJECT.md`（判断项目状态时）
3. `HANDOFF.md`（接手已有工作时）

## 请求分流

```txt
设计规范 / tokens / UI 规则 -> design-system
具体页面 / 组件实现 -> frontend
```

## Codex 工作方式

- 改动要小、可验证
- 保留已有用户内容
- 有 shell 检查脚本时跑一下
- 改完说明改了什么、还有什么风险
