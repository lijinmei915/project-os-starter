---
layer: knowledge
type: status
last_verified: 2026-07-26
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
- 当前分支：`main`，最新远端提交为 `ce881b6 docs: mark agent platform v1 complete`；平台稳定化改动仍在工作树，尚未提交或推送。
- 受控边界不可放松：Patch 写入与检查各自独立审批；恢复不能自动重放；Provider 成功不等于任务成功；Preview 只读，不执行写入、终端、检查或恢复。

## 最近完成

- `OmniDesk 结构化追问表单闭环 v1` 已完成实现：确认执行的任务先启动 Hermes；Agent 可发起持久化 `ask_user` interaction，对话内渲染 schema 表单，提交或跳过后从 checkpoint 重新请求同一 Run。
- 表单回答与 Patch/Check approval 独立；相同回答幂等、冲突回答拒绝。原生 WebDriver 已覆盖真实窗口提交、无 approval/无工程写入、应用重启恢复待回答表单，以及原 Patch approval 恢复不受影响。
- `OmniDesk 仓库文件治理与架构收敛 v1` 的账本覆盖 573 个受管文件与 15 个 active schema，均已具备 Owner、消费者、决策与验证记录；没有待分类候选。
- 旧 Project OS CLI、installer、模板、adapter、routing skill、评分与报告入口已从生产路径退役；旧命名只保留在迁移、兼容读取、路径隔离或回归夹具中。
- `runtime/app.rs` 已收束为 Tauri command adapter、Provider/Hermes transport 与生命周期编排。Agent Run、Patch Draft、Planning、Execution、Provider、Chat Stream、Terminal、Workspace watcher 与系统集成都各有 Runtime Owner。
- `main.jsx` 只保留 controller 与 surface 装配；Workbench 默认值、Preview 只读投影与 Workspace transport 已下沉。样式入口按 theme、workspace、conversation、terminal、provider rail 分域。
- 平台稳定化本地回归已通过：Desktop Node `600/600`、Runtime Rust `206/206`、Patch Normalizer `7/7`、Web build、离线 Eval 与原生 WebDriver smoke 均成功。模型设置与工程文件改为按需加载，首屏入口从 `813.34 KiB` 降至 `623.45 KiB / 800 KiB`，未提高阈值。
- 受保护 Eval 已拆为可单独选择和重跑的 `p1 / p3 / p4 / suite` 矩阵切片；每项上传独立 artifact，汇总 job 生成正式 `omnidesk.agent-eval-artifact-index.v0.1` 索引，记录 commit、切片、文件大小与 SHA-256。该工作流仍需推送后完成首次受保护运行。
- 原生复杂任务组合验收已让同一 MCP Run 经历 Scheduler 占用、待审批、桌面重启、零自动重放、显式恢复、原审批、工具成功和 metadata-only Timeline 导出；过程中发现并修复 `resume-approval` 未重新领取 Scheduler 租约的问题。
- 受保护真实 Eval [30071780488](https://github.com/lijinmei915/project-os-starter/actions/runs/30071780488) 已通过：13/13 case 成功，任务成功率 `100%`、Patch 可应用率 `91.7%`、检查通过率 `100%`、恢复成功率 `100%`。`ask-user-resume` artifact 证明首次模型返回 `ask_user`、checkpoint 持久化、交互审批为 0、回答后同 Run 续接、Patch 独立审批并通过检查。
- `复杂任务执行基础 v1` 已通过受保护真实 Eval [30081697947](https://github.com/lijinmei915/project-os-starter/actions/runs/30081697947)：13/13 标准 case 成功，另有隔离 worktree 证明源工程干净、diff 未变、二次审批合并、源工程验证和 worktree 清理；本地完整回归通过 Node `555/555`、Rust `157/157`、Patch Normalizer `7/7`。
- `普通聊天可靠性 v1` 已移除 Prompt 强制 JSON：Provider 自然文本直接流式显示，本地路由独立决定任务意图；旧 JSON 仅作为带 `responseMode=legacy-json` 的兼容输入并随对话持久化。模拟 Provider SSE、原生 WebDriver 和完整回归通过：Node `556/556`、Rust `158/158`（新增集成测试后为 `159`）、Patch Normalizer `7/7`。
- `普通聊天生命周期可靠性 v2` 已移除前端固定 12 秒假超时：Runtime 统一拥有首响应、流空闲、整体上限与取消，终态后拒绝迟到 delta；中断保留部分正文，单轮超时不修改 Provider 健康状态。终端懒加载失败也已限制在终端区域。完整回归通过 Node `557/557`、Rust `160/160`、Patch Normalizer `7/7` 和原生 WebDriver 终端诊断。
- Provider 健康机制已转为证据驱动：不再每分钟自动探测；首字前网络失败最多自动重试一次，已有正文时不重放；网络类错误不持久改写长期健康状态，认证、额度与模型错误仍保持阻断。
- 刷新启动不再先渲染演示 fallback：Workspace 与 Provider 首次恢复前显示统一启动壳，主题从本地缓存在绘制前恢复。浏览器首帧/稳定帧已实际验收。
- 对话状态机已增加待确认闸门：计划待确认时，补充要求不会直接触发 Patch；不可应用草稿不再显示验收通过；确认词任务标题和非计划轮次重复计划卡已修复。
- Agent 平台化 P0 已建立共享 workflow 状态投影，任务卡、对话结果和 Agent Run 展示不再各自解释 `succeeded`；无检查证据时显示“处理完成”，仅成功检查证据显示“验证通过”。
- P0 已扩展到任务筛选、项目/目标统计、Preview、追问表单和结果弹窗，并通过完整本地与原生回归；P1 已新增 Provider Function Calling 能力 Owner、标准工具 schema、SSE/非流式完整调用解析和按 API Base + 模型持久化的能力证据。没有能力证据的 OpenAI-compatible 服务会先尝试原生 tools；生产路径会校验工具名与完整 arguments，被接受会记录 `request-accepted-tools`，明确拒绝会记录 `explicit-tool-rejection` 并只无工具重试一次。
- 受保护 Agent Eval [30168898557](https://github.com/lijinmei915/project-os-starter/actions/runs/30168898557) 已完整通过：P1 原生 `start_engineering_task` Function Call 返回合法参数与真实 token usage；兼容 relay 证明明确拒绝后只降级一次、19.5 秒慢流成功且断流保留部分正文。
- P2 已完成本地与原生验收：首次 Hermes 任务在入队前保存完整 Agent Run；持久化 scheduler 按 FIFO 领取、全局上限 2、同项目一个占用。工作台显示稳定队列位置，并可继续或取消 queued/interrupted Run。取消同步封口 Run 与 Scheduler、释放项目，迟到模型与租约不能覆盖终态。原生 WebDriver 已验证两个跨项目占用、并发上限与同项目排队、重启不自动执行 queued，以及重启后显式取消。
- P3 已完成本地、原生和受保护验收：生产 Scheduler、Agent Run、Hermes ACP 与 Timeline 聚合真实 `10742 / 63 / 10805` token，项目租约正常释放、Scheduler 零残留、导出为 `metadata-only`；Provider 未报告 cost，Runtime 保持未知而未估算。
- P4 已完成 Tool Registry 与 MCP 本地/原生闭环：内置读取工具与 MCP 工具均使用版本化描述符、封闭 schema、风险和审批声明；MCP stdio 配置只保存环境变量引用，发现与调用分别取得 Scheduler 项目互斥和独立 approval token。
- 批准后的发现结果以 `omnidesk.mcp-discovery-evidence.v0.1` 绑定当前项目与无密钥 Server 配置快照；跨项目、配置变化、未知工具和非法参数在启动进程前拒绝。`tools/call` 有界结果写回同 Run Timeline，通用工具状态为 `running-tool`。
- `Agent 配置 / 受控工具` 已提供最小可见 MCP 管理：Server 配置、发现审批、当前有效工具、schema 参数表单、调用审批、取消和证据导出均复用现有 Workbench/Agent Run 边界。调用审批失败不会误收起表单，Server 删除失败不会误关确认框，项目切换或页面卸载后迟到刷新不会覆盖当前状态。页面不会直接启动 transport，Preview 明确只读拒绝。
- 原生 WebDriver 已从真实页面完成 `Native Callable / lookup` 流程；P4 的受保护官方 Filesystem MCP Eval 也已通过，证明固定版本/integrity、两次独立审批、审批前零执行、项目互斥、有界结果、成功 Timeline 和零 Scheduler 残留。
- 同一受保护运行的 13/13 标准 case 与 isolated-worktree 均通过；artifact 含相对 trace、真实 Provider Function Call、Runtime Timeline、慢流/断流和第三方 MCP 证据。`OmniDesk Agent 平台化 v1` 的 P0-P4 验收已闭环。

## 风险与注意

- 活跃 Provider 请求无法从中断 token 续传；重启后只能从最近持久化阶段重新请求模型，并保留中断证据。
- 终端会话与屏幕输出仍为内存态；Runtime 重启会终止会话，不能伪称可恢复。
- 真实 Provider Eval 仅能在受保护 GitHub Environment `agent-eval` 运行；本地或普通 CI 只能运行离线契约与基线检查，不能伪造真实 trace。
- 真实模型 Eval 存在输出波动：`30071465241` 的 `goal-rebind` 未完成四文件规范化而被门槛拒绝，失败 artifact 已保留；不得通过放宽授权或 trace 校验消除波动。
- 修改 Runtime、状态、Agent 执行或跨入口时，必须运行 `bash tests/run-tests.sh`；原生窗口改动还要运行 `npm --prefix desktop run test:native`。
- 删除、覆盖、提交、推送和发布前必须取得用户确认。不要恢复或清理工作树中不属于当前改动的内容。

## 下一步建议

1. 提交并推送平台稳定化工作树，手动运行 `all` 目标，确认 P1/P3/P4/suite 四个矩阵 job 与 artifact index 全部成功。
2. 用真实 Provider 从桌面对话触发一次 Function Call，并把它与已通过的同 Run 重启恢复、审批和 Timeline 证据共同验收。
3. 继续降低多文件 Patch 波动；不要放宽授权、独立审批、规范化或 trace 门槛。
