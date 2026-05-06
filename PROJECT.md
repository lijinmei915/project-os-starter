# 项目状态

## 项目定位

这是一个 AI Runtime / Project OS。

它用于把 AI 驱动开发流程收口成稳定内核，包括：

- 项目自动初始化
- 项目接管与审计
- 可控 UI 生成
- 结构化开发流程

## 当前架构

入口层：

- `project-setup`：负责路由和阶段判断

规则层：

- `design-system`：负责设计规范

执行层：

- `frontend`：负责代码实现

## 当前进度

- 路由系统：v1 收口测试 7/7 通过
- 入口控制：`project-setup` 已覆盖 CLARIFICATION / INIT / AUDIT / HYBRID
- 设计系统：`design-system` 已能承接 Design Tokens 请求
- 前端实现：`frontend` 已能承接具体页面请求
- 根入口分层：`AGENTS.md` / `CLAUDE.md` 已同步 v1 路由契约
- docs 清理：已删除 `docs/PROJECT.md` / `docs/HANDOFF.md`，根目录文件作为 SSOT

## 已知问题

- 组件运行层 `ai-components` 尚未建立
- CLI print 模式通过固定第一响应前缀判断路由
- 自动校验目前仍以人工/CLI 复测记录为主

## 下一步重点

1. 提交 docs 清理结果
2. 提高自动校验稳定性
3. 后续再评估 `ai-components` / Radix / shadcn，不在当前阶段接入

## 重要说明

- 当前阶段是收口期
- HYBRID 模式最重要
- 优先保证稳定，不追求复杂
- 英文做调度，中文做认知
