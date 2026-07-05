---
layer: knowledge
type: spec
last_verified: 2026-07-03
depends_on: [docs/PRODUCT_PLAN.md, docs/DESKTOP_APP.md, adapters/HERMES.md]
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
- Project OS adapter 目标之一

Hermes 不应该成为：

- OmniDesk 的主 UI
- Project OS 的规则源头
- 用户必须理解的配置前置条件
- 替代 `.project-os/` 项目记忆的唯一状态源

当前适配策略见 `adapters/HERMES.md`。

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

## 接入策略

OmniDesk 应采用分层接入：

```txt
OmniDesk UI
  -> Project OS Local Agent Core
    -> Project OS memory / runs / recommendations
    -> Hermes / Codex CLI / Claude Code / scripts / MCP
```

规则：

- OmniDesk 负责用户体验和项目治理。
- Project OS 负责事实、记忆、规则和检查闭环。
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
- Hermes adapter 规则说明

当前阶段暂不做：

- 完整 IDE
- 多 Agent 编排
- 远程执行
- 插件市场
- 让 Hermes 成为默认必需依赖

