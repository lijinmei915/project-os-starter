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
- slash commands：已新增 `/os-check`、`/os-test`、`/os-handoff`
- install flow：已新增自然语言 + `/os` 双入口，用于 Project OS 安装 / 接入 / 检查
- install flow 复测：自然语言初始化已能进入 `INSTALL / CHECK-UPGRADE`，自然语言接管已能进入 `INSTALL / HYBRID`
- 分发安装：已新增 `INSTALL.md` 和 `scripts/install-project-os.sh`，支持拿到 GitHub 地址后由 AI 自动安装到目标项目
- 工具适配：已新增 `adapters/` 和 `scripts/install-adapter.sh`，支持按需写入 Claude / Codex / Cursor / Gemini 适配文件

## 已知问题

- 组件运行层 `ai-components` 尚未建立
- CLI print 模式通过固定第一响应前缀判断路由
- 自动校验目前仍以人工/CLI 复测记录为主

## 下一步重点

1. 提交 INSTALL FLOW 和 slash commands 改动
2. 提交 Project OS 安装与 adapter 自动化改动
3. 后续再评估 `ai-components` / Radix / shadcn，不在当前阶段接入

## 重要说明

- 当前阶段是收口期
- HYBRID 模式最重要
- 优先保证稳定，不追求复杂
- 英文做调度，中文做认知
