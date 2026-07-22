---
layer: knowledge
type: spec
last_verified: 2026-07-21
depends_on: [AGENTS.md, docs/ARCHITECTURE.md, docs/ENVIRONMENT.md, docs/TESTING.md]
teaches: "OmniDesk 本地 Rust Runtime 的服务边界、持久化、Provider、工具执行与安全约束"
use_when: "AI 要修改 Tauri command、Rust Runtime、Provider、状态事务、Patch、终端或受控检查时"
---

# 本地运行时说明

> 用途：说明 OmniDesk 本地 Runtime 的实际服务边界；它不是独立 Web 后端。
> 什么时候更新：Runtime 模块、持久化、Provider、工具执行或安全边界变化时。
> 不要写什么：虚构的 HTTP API、数据库、微服务、云部署方案或单次调试流水。

## 定位与技术栈

OmniDesk 没有独立的远程后端。`desktop/src-tauri/src/runtime/` 是运行在用户设备上的 Rust Local Agent Runtime，通过 Tauri command 服务 React Workbench。

- Rust 2021、Tauri 2 和 Tokio。
- `serde` / `serde_json` 用于版本化状态与契约。
- `reqwest` 处理 Provider 的 HTTP 与 SSE 流。
- `portable-pty` 提供本地终端会话；终端输出默认只保留内存中的有界窗口。
- `notify` 负责工作区文件变更观察。
- Runtime 使用本地文件和 Repository 事务，不依赖外部数据库、HTTP 服务或云队列。

## 调用与事件边界

React 只通过登记的 Tauri command 或事件与 Runtime 交互。Runtime command 负责输入适配、权限边界和领域服务调用；领域服务负责跨实体写入与恢复；Repository 负责 schema、锁、原子事务和审计事件。

浏览器 Preview 是只读 transport。任何工程写入、终端、受控检查、Provider 密钥、Agent Run 恢复或状态变更都必须由 Desktop Runtime 拒绝或显式降级，不能在 Vite middleware 中旁路实现。

## Runtime 模块

| 模块 | 责任 |
|---|---|
| `workspace` | 项目档案、能力、事实、记忆、工程文件预览、树扫描/忽略策略与工作区投影 |
| `conversations` | 对话记录、事件、归档与上下文 |
| `tasks` / `goals` | 任务、目标、授权范围、索引与验收 |
| `agent_runs` | attempt、审批、恢复 checkpoint 与最终态 |
| `provider` | Profile、密钥隔离、OpenAI-compatible transport、响应解析、预检与错误分类 |
| `hermes_protocol` | ACP 程序发现、只读健康探测、协议帧、超时/取消、结构化响应与拒绝响应 |
| `patch` | Patch Draft 语义门槛、上下文文件范围、提示词、占位草稿、unified diff、路径、hunk 与授权校验 |
| `execution` | 受控写入、检查、结果和审计 |
| `repository` | 原子事务、版本校验、锁、事件与异常恢复 |
| `state_namespace` | `.project-os -> .omnidesk` 显式迁移和四分区激活 |

`app.rs` 是 Tauri command 装配层，不应继续吸收新的领域规则。新增行为先进入相应 Runtime 模块，再由 command 适配输入和输出。Provider 的密钥读取、连接切换、失败降级和 Agent 审批/证据仍由命令编排层控制；HTTP endpoint 规范化、请求 transport、非成功响应摘要、聊天内容和模型列表解析统一归 `provider`，防止计划、草稿、流式对话和连接探测形成不同协议语义。

## 状态与安全

Runtime 的唯一激活状态根是 `.omnidesk/`：

```txt
data/      用户与工作区持久化数据
runtime/   request checkpoint、事务、事件和锁
cache/     可重建派生状态
evidence/  Patch、检查、Eval 和发布证据
```

工程文件写入和受控检查必须各自独立审批。Provider 返回成功不是任务成功；任务只有在草稿、授权、应用、检查与最终证据闭环后才可完成。Provider 请求中断不能从 token 流续传，只能从最近的持久化阶段重新请求，并保留中断证据。

Provider Key 不进入普通 JSON、trace、Repository event 或 Git；它只能由本机环境和 Runtime 的受保护配置路径提供。

## 验证

Runtime 或状态边界改动至少运行：

```bash
cargo check --manifest-path desktop/src-tauri/Cargo.toml
bash tests/run-tests.sh
```

涉及原生窗口、审批或恢复交互时额外运行：

```bash
npm --prefix desktop run test:native
```

真实 Provider 任务闭环只以受保护 Agent Eval artifact 作为发布级证据，详见 `docs/TESTING.md`。
