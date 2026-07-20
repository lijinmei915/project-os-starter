---
layer: knowledge
type: spec
last_verified: 2026-07-18
depends_on: [docs/ARCHITECTURE.md, docs/DESKTOP_APP.md]
teaches: "OmniDesk 和 Hermes、Claude Projects、Cursor 等成熟工具的关系、借鉴边界和接入策略"
use_when: "评估是否接入成熟治理工程、比较 Hermes 等工具、或决定 OmniDesk 该借鉴什么不借鉴什么时"
---

# 参照系统

> 用途：记录 OmniDesk / Project OS Desktop 与成熟 Agent、IDE、项目治理工具的关系。
> 什么时候更新：新增参照工具、调整接入策略、或产品定位从参照工具中吸收新边界时。
> 不要写什么：具体 UI 微调、一次性竞品截图流水、未经确认的市场宣传结论。

## 核心结论

OmniDesk 不直接复制 Hermes、Cursor、Claude Projects 或 OpenHands。

OmniDesk 的定位是：

```txt
用户入口 + 项目治理中枢 + 本地项目记忆
```

成熟工具的定位是：

```txt
可借鉴的交互参照 + 可接入的执行器 + 可复用的工程经验
```

中文说明：
用户最终只需要在 OmniDesk 里添加项目、对话、确认计划、查看文件、看 diff 和跑检查。Hermes、Codex CLI、Claude Code、脚本 runner 或其他 Agent runtime 可以作为底层能力，但不应该替代 OmniDesk 的产品入口。

## 目标用户差异

OmniDesk 面向“不想先懂工程治理的人”。

用户把任何新老项目接进来后，系统应该负责：

- 识别项目状态
- 显性化研发流程
- 维护项目记忆
- 管理目标和待办
- 约束 AI 行为边界
- 辅助 coding 和 diff review
- 跑检查并沉淀运行记录
- 根据使用过程推荐下一步

因此 OmniDesk 的主体验不能停留在“调用一个 Agent”。

## 对比矩阵

| 维度 | Hermes / 成熟 Agent runtime | OmniDesk / Project OS Desktop |
|------|------------------------------|-------------------------------|
| 核心入口 | Agent 执行环境或工程治理 runtime | 面向小白的超级个人工作台 |
| 用户心智 | 配置 Agent、选择工具、执行任务 | 添加项目、跟着系统工作 |
| 项目治理 | 通常提供规则和执行能力 | 把研发流程显性化为工作区和项目资产 |
| 项目记忆 | 偏会话、任务或工具状态 | 写回 `.project-os/`，成为项目可交接资产 |
| 文件体系 | 工具自身工程结构 | 真实项目文件 + Project OS 治理文件 |
| 自动演进 | 依赖 Agent 能力和工具插件 | 推荐、检查、记忆、规则更新形成产品机制 |
| 最佳关系 | 可接入执行器 / 参照系统 | 上层体验和治理中枢 |

## Hermes 的定位

Hermes 适合作为：

- 长时任务执行器
- Agent 工作流参照
- 治理工程形态参考
- 可选的受控执行器

Hermes 不应该成为：

- OmniDesk 的主 UI
- Project OS 的规则源头
- 用户必须理解的配置前置条件
- 替代 `.project-os/` 项目记忆的唯一状态源

桌面端已完成两层运行时接入：在 `Agent 配置 / 适配器` 中只读探测 `hermes-acp` 优先、`hermes` 次之的本地可用性；`hermes-acp --check` 只证明 ACP 通道可启动，不证明模型凭据可用。OmniDesk 的当前连接是 Hermes 的非敏感运行配置源：保存或切换当前连接后，自动同步 Hermes `config.yaml` 中的 custom provider、网关地址、API mode 和默认模型，保留 Hermes 其他设置。Patch Draft 生成时，OmniDesk 会优先以 ACP stdio 建立一次性 session，并只把当前 provider 的密钥注入子进程内存环境。对于 Hermes 的 custom provider，还会按网关主域临时注入兼容的 `<VENDOR>_API_KEY`，避免 Hermes 的 host-scoped 凭据保护把有效 Key 误判为缺失；密钥不会写入 Hermes 文件或前端。Hermes 只能返回草案，实际写入仍必须走 OmniDesk 的 Diff review 和 Apply 确认。请求提示禁止工具调用，且所有需要 ACP client 支持的工具或权限请求都会被拒绝。未安装、仅 CLI、ACP 健康检查失败、模型调用失败、无有效 diff 或 ACP 调用失败，都必须如实显示或回退到既有 provider/local 草案，不得伪造已执行或已写入。

## 借鉴原则

可以借鉴：

- 工作区树形结构
- 任务执行状态
- 工具调用日志
- 文件和 diff 的独立 tab
- 项目治理对象显性化
- Agent 能力作为可插拔资源

不要照搬：

- 对普通用户暴露过多 Agent 配置
- 把工作流做成只适合工程师理解的控制台
- 把记忆只留在某个工具会话里
- 把工具 runtime 当作产品入口
- 一开始就追求完整 IDE、插件市场或多 Agent 编排

## 对话治理开源参照

OmniDesk 的对话治理优先借鉴“显式状态、可中断、可恢复、人工确认”的工程模式，不直接把第三方 Agent runtime 作为桌面端核心依赖。

| 参照项目 | 主要借鉴点 | 当前边界 |
|----------|------------|----------|
| LangGraph | 状态图、checkpoint、interrupt / resume、节点级事件 | 首选架构参照；先映射到现有 `conversation-runtime`，不立即引入整套运行时 |
| AutoGen | 多角色协作和消息协议 | 仅作未来多 Agent 协作参照，当前单 Agent 治理不需要 |
| Semantic Kernel | Planner、插件和策略编排 | 参考插件/策略分层，不把 Python/.NET runtime 引入桌面壳 |
| OpenHands | coding agent 的任务、终端和补丁体验 | 参考执行体验，文件写入仍归 OmniDesk Apply 边界 |
| Temporal | 长事务、重试、持久化工作流 | 未来服务化或后台任务再评估，桌面本地阶段不引入 |

OmniDesk 当前的等价实现由 `desktop/src/conversation-runtime/`、任务存储、`requestId / taskId` 事件关联和受控执行器组成。任何开源框架接入都必须满足：

- UI、项目事实、任务持久化和治理规则仍由 OmniDesk 拥有。
- 第三方编排器只能调度注册动作，不能直接写文件或绕过 Apply / Verify 确认。
- checkpoint 必须能恢复到明确的 `pendingAction`、任务状态和最后一个可见事件。
- 无模型或编排器不可用时，必须显示不可用并保留本地确定性计划，不得伪造执行成功。

## 接入策略

OmniDesk 应采用分层接入：

```txt
OmniDesk UI
  -> OmniDesk Local Agent Runtime
    -> Workspace / Task / Agent Run evidence
    -> Hermes / Codex CLI / Claude Code / scripts / MCP
```

规则：

- OmniDesk 负责用户体验和项目治理。
- OmniDesk Runtime 负责事实、记忆、规则和检查闭环。
- Hermes 等工具负责执行某些任务。
- 执行结果必须回写到 `.project-os/`，不能只留在外部工具。

## 当前阶段取舍

当前阶段先做：

- 项目接入
- 工作区树
- 对话式 coding
- 文件查看
- diff review
- 受控 runner
- 项目记忆和推荐
- Hermes ACP 可用性探测和状态展示

当前阶段暂不做：

- 完整 IDE
- 多 Agent 编排
- 远程执行
- 插件市场
- 让 Hermes 成为默认必需依赖
