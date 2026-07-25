---
layer: knowledge
type: status
last_verified: 2026-07-24
teaches: "当前接手上下文、运行边界、验证证据和下一步"
use_when: "新的 AI 或工程师需要继续 OmniDesk 工作时"
depends_on: [PROJECT.md, AGENTS.md, docs/ARCHITECTURE.md, docs/TESTING.md]
---

# 当前交接

> 用途：让下一位接手者在不阅读历史流水的前提下，安全继续当前工作。
> 当前状态、架构与长期方向分别以 `PROJECT.md`、`docs/ARCHITECTURE.md`、`docs/PRODUCT_PLAN.md` 为准。

## 接手摘要

- 产品核心：`desktop/` 中的 Tauri + React + Local Agent Runtime。它在用户授权范围内处理项目、对话、Patch、审批、检查、恢复与证据。
- 状态根：`.omnidesk/` 是唯一活动状态根，分为 `data`、`runtime`、`cache`、`evidence`。历史 `.project-os/` 只能通过显式、非破坏性迁移导入，不能作为运行时回退。
- 当前分支：`main`，最近推送提交为 `ed70af4 chore(docs): refresh repository file inventory`；工作树包含已通过回归但尚未提交的普通聊天可靠性改造。
- 受控边界不可放松：Patch 写入与检查各自独立审批；恢复不能自动重放；Provider 成功不等于任务成功；Preview 只读，不执行写入、终端、检查或恢复。

## 最近完成

- `OmniDesk 结构化追问表单闭环 v1` 已完成实现：确认执行的任务先启动 Hermes；Agent 可发起持久化 `ask_user` interaction，对话内渲染 schema 表单，提交或跳过后从 checkpoint 重新请求同一 Run。
- 表单回答与 Patch/Check approval 独立；相同回答幂等、冲突回答拒绝。原生 WebDriver 已覆盖真实窗口提交、无 approval/无工程写入、应用重启恢复待回答表单，以及原 Patch approval 恢复不受影响。
- `OmniDesk 仓库文件治理与架构收敛 v1` 的账本覆盖 542 个受管文件与 14 个 active schema，均已具备 Owner、消费者、决策与验证记录；没有待分类候选。
- 旧 Project OS CLI、installer、模板、adapter、routing skill、评分与报告入口已从生产路径退役；旧命名只保留在迁移、兼容读取、路径隔离或回归夹具中。
- `runtime/app.rs` 已收束为 Tauri command adapter、Provider/Hermes transport 与生命周期编排。Agent Run、Patch Draft、Planning、Execution、Provider、Chat Stream、Terminal、Workspace watcher 与系统集成都各有 Runtime Owner。
- `main.jsx` 只保留 controller 与 surface 装配；Workbench 默认值、Preview 只读投影与 Workspace transport 已下沉。样式入口按 theme、workspace、conversation、terminal、provider rail 分域。
- 最新本地回归已通过：Desktop Node `548/548`、Runtime Rust `147/147`、Patch Normalizer `7/7`、Web build（首屏 `797.45 KiB / 800 KiB`）、离线 Eval 与原生 WebDriver smoke。
- 受保护真实 Eval [30071780488](https://github.com/lijinmei915/project-os-starter/actions/runs/30071780488) 已通过：13/13 case 成功，任务成功率 `100%`、Patch 可应用率 `91.7%`、检查通过率 `100%`、恢复成功率 `100%`。`ask-user-resume` artifact 证明首次模型返回 `ask_user`、checkpoint 持久化、交互审批为 0、回答后同 Run 续接、Patch 独立审批并通过检查。
- `复杂任务执行基础 v1` 已通过受保护真实 Eval [30081697947](https://github.com/lijinmei915/project-os-starter/actions/runs/30081697947)：13/13 标准 case 成功，另有隔离 worktree 证明源工程干净、diff 未变、二次审批合并、源工程验证和 worktree 清理；本地完整回归通过 Node `555/555`、Rust `157/157`、Patch Normalizer `7/7`。
- `普通聊天可靠性 v1` 已移除 Prompt 强制 JSON：Provider 自然文本直接流式显示，本地路由独立决定任务意图；旧 JSON 仅作为带 `responseMode=legacy-json` 的兼容输入并随对话持久化。模拟 Provider SSE、原生 WebDriver 和完整回归通过：Node `556/556`、Rust `158/158`（新增集成测试后为 `159`）、Patch Normalizer `7/7`。
- `普通聊天生命周期可靠性 v2` 已移除前端固定 12 秒假超时：Runtime 统一拥有首响应、流空闲、整体上限与取消，终态后拒绝迟到 delta；中断保留部分正文，单轮超时不修改 Provider 健康状态。终端懒加载失败也已限制在终端区域。完整回归通过 Node `557/557`、Rust `160/160`、Patch Normalizer `7/7` 和原生 WebDriver 终端诊断。
- Provider 健康机制已转为证据驱动：不再每分钟自动探测；首字前网络失败最多自动重试一次，已有正文时不重放；网络类错误不持久改写长期健康状态，认证、额度与模型错误仍保持阻断。
- 刷新启动不再先渲染演示 fallback：Workspace 与 Provider 首次恢复前显示统一启动壳，主题从本地缓存在绘制前恢复。浏览器首帧/稳定帧已实际验收。

## 风险与注意

- 活跃 Provider 请求无法从中断 token 续传；重启后只能从最近持久化阶段重新请求模型，并保留中断证据。
- 终端会话与屏幕输出仍为内存态；Runtime 重启会终止会话，不能伪称可恢复。
- 真实 Provider Eval 仅能在受保护 GitHub Environment `agent-eval` 运行；本地或普通 CI 只能运行离线契约与基线检查，不能伪造真实 trace。
- 真实模型 Eval 存在输出波动：`30071465241` 的 `goal-rebind` 未完成四文件规范化而被门槛拒绝，失败 artifact 已保留；不得通过放宽授权或 trace 校验消除波动。
- 修改 Runtime、状态、Agent 执行或跨入口时，必须运行 `bash tests/run-tests.sh`；原生窗口改动还要运行 `npm --prefix desktop run test:native`。
- 删除、覆盖、提交、推送和发布前必须取得用户确认。不要恢复或清理工作树中不属于当前改动的内容。

## 下一步建议

1. 在受保护环境增加普通聊天 v2 的真实慢速流、长回答与中断验收，确认不同 OpenAI-compatible 服务不会回退到旧 JSON envelope，也不会出现双终态。
2. 根据真实 `ask-user-resume` trace 决定是否扩展字段 widget，并继续降低多文件 Patch 波动；不要放宽授权、独立审批或 trace 门槛。
