# Gemini Adapter

> 用途：把 `AGENTS.md` 的通用规则翻译成 Gemini 的读取入口。
> 什么时候更新：Gemini 专属行为变化时。

通用规则以 `AGENTS.md` 为准。

## 读取顺序

1. `AGENTS.md`（通用规则）
2. `PROJECT.md`（判断项目状态时）
3. `HANDOFF.md`（接手已有工作时）

## 请求分流

```txt
设计规范 / tokens / UI 规则 -> design-system
具体页面 / 组件实现 -> frontend
```

不要跳过意图确认直接生成代码。
