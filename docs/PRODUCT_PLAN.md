---
layer: knowledge
type: spec
last_verified: 2026-07-09
depends_on: [PRODUCT.md, docs/DESKTOP_APP.md, docs/REFERENCE_SYSTEMS.md]
teaches: "产品的阶段划分、各阶段目标、成功标准和演进路线"
use_when: "AI 需要判断当前该做哪个阶段的事、或评估某个需求是否在当前阶段范围内时"
---

# Project OS 产品规划

> 用途：回答“这个产品分几阶段演进、当前阶段做什么、下一阶段再做什么”。
> 什么时候更新：阶段定义、阶段目标、成功标准或中长期路线变化时。
> 不要写什么：当前回合交接、具体改了哪些文件、一次性阻塞或临时待办。

## 产品愿景

把 AI 驱动开发流程收口成一个可复制、可验证、可交接的 Project OS Console，并逐步演进为本地优先的 OmniDesk / Project OS Desktop 工作台。

OmniDesk 的目标是让任何新项目或老项目都可以被接入一个统一的本地 AI 工程工作台。用户不用操心项目治理、上下文维护、研发流程、模型配置和工程检查，只需要持续在工作台里对话、决策和执行。系统会跟随 Project OS 的流程认识项目、管理目标、约束协作、辅助实现、验证质量，并在使用过程中沉淀记忆、优化能力、自动演进，让项目越做越清晰，系统越用越好用。

它的目标不是复制 Hermes Studio 这类通用 Agent runtime 工作台，而是把成熟 Agent / 治理工具作为可接入执行器和参照系，自己负责用户入口、项目治理中枢和长期项目记忆：

```txt
添加项目 -> 认识项目 -> 定义目标 -> 约束协作 -> 设计实现 -> 验证质量 -> 记忆沉淀 -> 推荐下一步
```

当前优先级是 Project OS Console 内核和 OmniDesk Desktop v0.1，同时桌面端方向已确定为 `Tauri + Local Agent Core + Workbench UI`。桌面端路线见 `docs/DESKTOP_APP.md`，参照系统取舍见 `docs/REFERENCE_SYSTEMS.md`；多 Agent 编排、远程执行和完整 IDE 仍不进入当前阶段。

---

## 当前阶段判断

当前处于：

```txt
Project OS Console 内核收口期 / Desktop v0.1 方向确认期
```

当前策略：

```txt
先把“固定模板选择”升级为“证据驱动推荐”，
再把推荐接到 UI 和生成动作，
最后再把推荐、检查、记忆和 coding 执行接入桌面端 Local Agent Core。
```

当前阶段成功标准：

- 能扫描项目并输出 evidence / signals / gaps / recommendations / checks
- 推荐项能解释 reason、evidence、confidence、riskIfSkipped 和 check
- 用户能看懂为什么推荐、可以跳过、可以确认生成
- 生成后能跑检查，并把结果写回交接状态

---

## 规划索引目录

当前规划按模块维护，避免把入口、治理、桌面 UI、CLI、模型和长期平台能力堆在一张待办里。

| 模块 | 负责问题 | 当前状态 | 主要文档 |
|------|----------|----------|----------|
| [M1 接入层](#m1-接入层) | 新老项目如何进入 OmniDesk | 已有基础，继续收口 | `docs/DESKTOP_APP.md`、`docs/ARCHITECTURE.md` |
| [M2 元数据层](#m2-元数据层) | 项目事实、状态和运行产物放在哪里 | 正在统一真相源 | `schemas/*`、`.project-os/*` |
| [M3 核心内核层](#m3-核心内核层) | CLI/Core 如何稳定执行治理动作 | 原生 CLI 起点已落地 | `cli/`、`scripts/exec/` |
| [M4 治理服务层](#m4-治理服务层) | 扫描、推荐、报告、验收和复盘闭环 | 当前重点 | `docs/RECOMMENDATION_ENGINE.md`、`docs/TESTING.md` |
| [M5 工作台应用层](#m5-工作台应用层) | 桌面 UI 如何让用户完成治理动作 | Desktop v0.1 打磨中 | `docs/DESKTOP_APP.md` |
| [M6 入口层 / Gateway](#m6-入口层--gateway) | CLI、Desktop、CI、Web、API 如何统一入口 | Gateway 前置收口 | `docs/ARCHITECTURE.md` |
| [M7 模型与连接](#m7-模型与连接) | 本地模型配置、Provider 和模型健康 | 首版可用 | `.project-os/model-catalog.json` |
| [M8 安全与执行边界](#m8-安全与执行边界) | 哪些动作可执行、怎么确认和回滚 | 白名单优先 | `docs/SECURITY.md`、`docs/AI_SAFETY.md` |
| [M9 分发与对外交付](#m9-分发与对外交付) | 如何安装、升级、打包和跨平台交付 | 后续阶段 | `INSTALL.md`、`docs/RUNBOOK.md` |
| [M10 长期治理平台](#m10-长期治理平台) | 多项目、组织级、远程同步和 Agent 编排 | 长期路线 | `docs/REFERENCE_SYSTEMS.md` |

阅读顺序：

1. 当前要做产品功能时，先看 M1-M6。
2. 涉及执行风险时，同时看 M8。
3. 涉及发布、安装、打包时，看 M9。
4. 长期平台化讨论放到 M10，不挤占当前收口期。

---

## 模块化规划

### M1 接入层

目标：

- 让新项目、老项目和临时项目都能进入 OmniDesk 工作区
- 用户不需要先理解目录、脚本或治理文件，系统先只读识别项目状态

已完成：

- 桌面端 registry 支持添加、切换、移除和重命名工作台显示名
- 老项目默认自动接入工作区，但不直接改写工程文件
- 当前项目 snapshot 已包含项目路径、项目档案、目标、任务和治理文件映射

规划功能：

| 功能 | 阶段 | 状态 | 说明 |
|------|------|------|------|
| 项目添加与切换 | Desktop v0.1 | 已完成首版 | 支持系统目录选择和路径备用添加 |
| 老项目只读扫描 | Desktop v0.1 | 已完成首版 | 只读读取 README、PROJECT、package、git 和 `.project-os` |
| 接入草案确认 | Desktop v0.2 | 待做 | 老项目先生成接入草案，用户确认后再沉淀治理文件 |
| 临时项目模式 | Desktop v0.2 | 待做 | 只读查看，不写 `.project-os` |
| 多项目健康总览 | Desktop v0.3 | 待做 | 首页展示多个项目的治理状态和风险 |

边界：

- 不静默修改用户工程文件
- 本地文件夹重命名必须作为独立高风险动作，二次确认

### M2 元数据层

目标：

- 统一 `.project-os/` 作为本地状态和治理产物目录
- 明确哪些数据是事实源、哪些只是展示层或运行产物

已完成：

- `.project-os/state.json` 作为机器可读项目状态
- `.project-os/workspace-facts.json` 作为工作区事实展示数据
- `.project-os/goals.json`、`.project-os/task-backlog.json`、`.project-os/runs/` 支撑目标、任务和运行记录
- `state sync` 已作为受控状态写入入口

规划功能：

| 功能 | 阶段 | 状态 | 说明 |
|------|------|------|------|
| 统一真相源 | Gateway 前置 | 已完成首版 | `.project-os/state.json` 写入走 `project-os state sync` |
| 状态回流 bundles | Gateway 前置 | 已完成首版 | `.project-os/state-bundles/*.json` 支持 CI / 本地回流骨架 |
| 工作区事实自动刷新 | Desktop v0.1 | 已完成首版 | 页面刷新和治理动作后重新读取 facts |
| 治理骨架监听刷新 | Desktop v0.1 | 已完成首版 | Tauri 监听 `.project-os` 变化后刷新完整 snapshot |
| 运行历史索引 | Desktop v0.2 | 待做 | 从 `.project-os/runs/` 形成可筛选历史列表 |
| 元数据 schema 注册表 | Desktop v0.3 | 待做 | 所有 `.project-os/*.json` 对应 schema 和用途可查 |

边界：

- `PROJECT.md` 是人类可读展示层，和 `state.json` 冲突时以 `state.json` 为准
- 临时运行产物需要进入清理策略，不能无限堆积

### M3 核心内核层

目标：

- 把长期能力迁到原生 CLI / core library
- Shell wrapper 只保留兼容和调度，不继续承载复杂业务逻辑

已完成：

- `cli/` 原生 Rust CLI 起点，二进制名 `project-os`
- 支持 `config` / `state` / `context` / `scan` / `check` / `report` / `recommend` / `run`
- 支持 Entry Context、结构化输出、写入锁、陈旧锁清理和配置优先级

规划功能：

| 功能 | 阶段 | 状态 | 说明 |
|------|------|------|------|
| 原生 CLI 起点 | Gateway 前置 | 已完成首版 | 复杂能力逐步从 shell 迁移 |
| `state sync` | Gateway 前置 | 已完成首版 | 受控写入状态和生成 bundle |
| `config get/set` | Gateway 前置 | 记录，暂不做 | 减少手动编辑 JSON |
| 普通文本配置溯源 | Gateway 前置 | 记录，暂不做 | 非 JSON 模式也能排查配置来源 |
| 多套全局配置切换 | Gateway 前置 | 记录，暂不做 | 支持多仓库、多团队、多环境 |
| Core library 抽取 | Gateway 阶段 | 待做 | Desktop / Gateway / CI 共享执行底座 |

边界：

- 新增治理能力必须优先考虑 CLI/Core，而不是继续堆到 Shell
- 命令执行必须有结构化输出、错误码和离线降级路径

### M4 治理服务层

目标：

- 把扫描、推荐、报告、验收、复盘和记忆沉淀做成闭环
- 用户看到的是下一步动作和风险，系统维护背后的证据链

已完成：

- 推荐引擎输出 evidence / signals / gaps / recommendations / checks
- `check-ai-project.sh`、`recommend-next.sh`、`report`、目标验收报告已接入
- 清理脚本可删除过期 Entry Context、runs 和 state bundles

规划功能：

| 功能 | 阶段 | 状态 | 说明 |
|------|------|------|------|
| 项目扫描 | Desktop v0.1 | 已接入页面动作 | `scan` 写入报告、推荐和 runs |
| 优化建议 | Desktop v0.1 | 已接入页面动作 | `recommend` 写入 recommendations |
| 修复草案报告 | Desktop v0.1 | 已接入页面动作 | `report --output report --persist full` |
| 过期产物清理 | Desktop v0.1 | 已接入页面动作 | `prune-project-os-artifacts` |
| 治理文件风险筛选 | Desktop v0.2 | 待做 | 按风险、状态、来源过滤文件 |
| 变更历史视图 | Desktop v0.2 | 待做 | 从 `.project-os/runs/` 展示历史 |
| 失败验收生成修复任务 | Desktop v0.2 | 待做 | 验收失败后自动生成待办 |
| 定时治理 L2 | Desktop v0.3 | 待做 | 从 `.project-os/config.json` 读取定时策略 |

边界：

- 页面动作只调用白名单 CLI/Core，不拼接任意 shell
- 治理服务可以写 `.project-os/`，写工程文件必须进入明确确认流程

### M5 工作台应用层

目标：

- Desktop UI 不是静态预览，而是项目治理工作台
- 用户能在页面里完成“理解 -> 操作 -> 反馈 -> 验收”的最小闭环

已完成：

- Tauri + React 工作台骨架
- 项目切换、目标栈、任务队列、对话、受控 runner、patch draft、apply patch 和 run summary
- 项目概览页面内治理动作入口：一键扫描、生成优化建议、批量修复草案、清理过期产物

规划功能：

| 功能 | 阶段 | 状态 | 说明 |
|------|------|------|------|
| 工作区事实视图 | Desktop v0.1 | 已完成首版 | 项目概览展示事实、健康分和治理等级 |
| 页面内治理动作 | Desktop v0.1 | 已完成首版 | 项目概览 action bar 已接入 CLI/Core |
| 同步治理状态 | Desktop v0.1 | 已完成首版 | 项目概览可手动触发 `project-os state sync` |
| 轻量轮询刷新 | Desktop v0.1 | 已完成首版 | 浏览器预览每 30s 轻量读取 snapshot，补齐非 Tauri 场景 |
| 治理文件预览 | Desktop v0.1 | 已完成首版 | 工程文件只读预览 |
| 治理文件过滤 | Desktop v0.2 | 待做 | 风险、状态、来源筛选 |
| Patch draft 列表 L3 | Desktop v0.2 | 待做 | 草案列表、确认、apply 和验证 |
| 视觉证据验收 | Desktop v0.2 | 待做 | 关键界面截图或像素检查写入验收报告 |
| 多项目控制台 | Desktop v0.3 | 待做 | 多项目状态、风险和下一步聚合 |

工作区菜单职责：

| 一级菜单 | 二级菜单 | 放什么 | 不放什么 |
|----------|----------|--------|----------|
| 项目流程 | 认识项目 / 定义目标 / 工作规则 / 设计实现 / 验证交付 / 复盘沉淀 | 项目生命周期和治理主线 | 模型配置、工程文件列表、原始运行日志 |
| 任务执行 | 当前任务 / 任务队列 / Patch 草案 / 执行终端 / 执行结果 | 当下行动、执行队列、草案和结果 | 长期知识、产品路线、静态文档目录 |
| 知识记忆 | 项目事实 / 用户偏好 / 长期记忆 / 会话摘要 | 可复用上下文和沉淀记忆 | 当前任务执行状态、报告产物 |
| 工程资产 | 工程文件 / 治理文件 / 报告产物 / Schema / 脚本模板 | 文件、文档、产物和结构化资产 | 工作流阶段、模型连接、执行权限说明 |
| Agent 配置 | 模型连接 / 工具白名单 / Skill 能力 / 适配器 / 安全边界 | Agent 能力、工具、模型和安全配置 | 项目目标、当前进度、交付报告 |

菜单规则：

- 一级菜单表达工作区能力，不表达内部实现模块。
- 二级菜单表达用户可进入的工作面，不暴露字段级表单项。
- 同一信息只能有一个主入口，其他页面只能做摘要、跳转或引用。
- `项目概览` 是总览驾驶舱，只汇总 `当前进度`、`启动方式`、`风险边界`、`本地状态`，不重复承载完整内容。
- 所有菜单工作面必须遵守 `docs/design/workbench-visualization.md`：先状态，再动作，再证据，治理元信息不占据主视觉。

菜单治理矩阵：

| 菜单项 | 治理角色 | 状态来源 | 当前成熟度 | 下一步 |
|--------|----------|----------|------------|--------|
| 项目流程 / 认识项目 | 项目事实入口，回答项目是什么、到哪一步、当前风险是什么 | `.project-os/state.json`、`PROJECT.md`、`HANDOFF.md` | 状态化 | 自动生成工作区事实，并从扫描结果刷新项目概览 |
| 项目流程 / 定义目标 | 目标治理入口，维护目标、范围、验收标准和目标历史 | `.project-os/goals.json`、`.project-os/goal-validation.json` | 状态化 | 接入目标拆解草案和确认拆解 |
| 项目流程 / 工作规则 | 协作治理入口，约束 AI 行为、权限、路由和文档归属 | `AGENTS.md`、`docs/ROUTING.md`、`docs/DOCUMENTATION.md` | 闭环 | 规则变化后同步模板并跑治理检查 |
| 项目流程 / 设计实现 | 方案治理入口，连接架构、契约、界面规范和实现结构 | `docs/ARCHITECTURE.md`、`schemas/*`、`docs/DESIGN_STANDARDS.md`、`docs/CODE_STRUCTURE.md` | 只读 | 补设计实现健康状态，并能生成架构/契约/规范治理任务 |
| 项目流程 / 验证交付 | 质量治理入口，维护检查项、验收报告和运行记录 | `docs/TESTING.md`、`.project-os/runs/*`、`.project-os/goal-validation-report.json` | 状态化 | 验收失败后生成修复任务，并沉淀视觉或命令证据 |
| 项目流程 / 复盘沉淀 | 经验治理入口，沉淀交接、决策、教训和变更历史 | `HANDOFF.md`、`docs/DECISIONS.md`、`docs/LESSONS.md`、`docs/CHANGELOG.md` | 状态化 | 结构化复盘内容，区分当前交接和长期记忆 |
| 任务执行 | 执行治理入口，承载当前任务、队列、Patch 草案、终端和结果 | `.project-os/runs/desktop-tasks/*`、`.project-os/runs/desktop-summary.md` | 可行动 | 继续补失败重试、修复任务和验证回写 |
| 知识记忆 | 上下文治理入口，区分项目事实、用户偏好、长期记忆和会话摘要 | `.project-os/workspace-facts.json`、`.project-os/memory/*`、`.project-os/conversations/*` | 只读 | 明确哪些信息可沉淀、何时沉淀、如何过期 |
| 工程资产 | 资产治理入口，管理工程文件、治理文件、报告产物、Schema 和模板 | 项目文件树、`.project-os/workspace-facts.json`、`schemas/*`、`templates/*` | 可行动 | 复制治理文件健康视图模式到报告产物和 Schema |
| Agent 配置 | 能力治理入口，管理模型、工具、Skill、适配器和安全边界 | `.project-os/desktop-provider.json`、`.agents/skills/*`、`adapters/*`、`docs/AI_SAFETY.md` | 状态化 | 把不可用原因转成配置修复任务 |

Agent 开发优先级：

| 优先级 | 优化点 | 当前落点 | 成功判断 |
|--------|--------|----------|----------|
| P0 | 任务执行闭环 | `任务执行` 工作面展示当前任务、队列、Patch 草案、终端和执行结果状态 | 用户能知道 Agent 当前在做什么、下一步该确认什么 |
| P0 | 项目概览驾驶舱 | `项目概览` 保持摘要、健康分、快捷治理动作和核心文件入口 | 用户第一眼能看到健康状态、风险和推荐动作 |
| P0 | 当前进度可视化 | `当前进度` 展示阶段、目标、任务完成度、最近完成、下一步和进度依据 | 用户能一眼知道项目推进到哪、下一步该点什么 |
| P0 | Agent 配置状态 | `Agent 配置` 工作面展示模型连接、工具白名单、Skill 能力和安全边界 | 用户能判断 Agent 是否可用、能跑什么、为什么不能跑 |
| P1 | 失败反馈机制 | 任务执行和治理动作失败时输出影响、原因和建议下一步 | 用户不用读原始命令也能理解失败 |
| P1 | 记忆沉淀规则 | `知识记忆` 区分项目事实、用户偏好、长期记忆和会话摘要 | 信息沉淀不污染任务执行和工程资产 |

设计实现治理闭环：

| 工作面 | 当前能力 | 后续增强 |
|--------|----------|----------|
| 系统架构 | 展示 `docs/ARCHITECTURE.md` 状态，可生成架构审阅任务 | 增加架构与实际模块依赖一致性检查 |
| 数据契约 | 展示 `schemas/*` / `docs/data/*` 状态，可生成契约审阅任务 | 增加 schema 注册表和示例数据校验 |
| 界面规范 | 展示 `docs/DESIGN_STANDARDS.md` / `desktop/src/styles.css` 状态，可生成规范审阅任务 | 增加 token 使用和组件边界检查 |
| 实现结构 | 展示 `docs/CODE_STRUCTURE.md` / 关键源码入口状态，可生成结构审阅任务 | 增加目录职责和大文件风险检查 |

边界：

- UI 使用现有 token 和组件 primitive，不做营销页式重设计
- 当前工程文件区域仍以预览为主，写入能力必须显式确认

### M6 入口层 / Gateway

目标：

- 在启动 Gateway 开发前，把本地 CLI、CI 和 Desktop 复用的入口语义稳定下来
- 让配置、鉴权、产物、兼容策略都有明确演进位置，避免继续堆到 Shell wrapper
- 当前只规划，不继续扩功能；具体实现等 Gateway 或对外交付阶段再启动

已完成基础：

- 原生 `project-os` CLI 起点
- Entry Context 标准
- `--persist auto|none|full`
- `--output json|report`
- `.project-os/config.json` 与用户全局 config
- config schema 校验和 `config.values` / `config.sources`
- stale lock 清理和 `--stale-lock-seconds`
- Shell fallback 白名单

规划功能：

| 功能 | 阶段 | 状态 | 说明 |
|------|------|------|------|
| Entry Context 标准 | Gateway 前置 | 已完成首版 | CLI / Desktop / CI 统一请求语义 |
| Shell wrapper 白名单 | Gateway 前置 | 已完成首版 | 旧入口继续兼容但不扩业务命令 |
| Desktop 动作入口 | Desktop v0.1 | 已完成首版 | 页面动作进入白名单 `run_project_os_action` |
| Gateway 鉴权和限流 | Gateway 阶段 | 待做 | 统一身份、权限、限流和异常封装 |
| 内外 API 隔离 | Gateway 阶段 | 待做 | 内部 core API 和外部调用协议分层 |
| 标准化产物上报 | 长期治理平台 | 待做 | 本地、CI、Desktop、云端双向同步 |

### Gateway 启动前完成清单

- 统一真相源架构改造
  - 所有本地 / CI / Desktop 操作读写唯一数据源 `.project-os/` 骨架目录
  - `.project-os/state.json` 的写入必须走 `project-os state sync`
  - Desktop 前端只读渲染状态，变更请求转发 CLI/Core
  - CI 产物通过 `.project-os/state-bundles/*.json` 回流到本地骨架目录
- `project-os config get` / `project-os config set`
  - 支持命令行直接读写配置
  - 避免用户手动编辑 JSON
  - 必须继续遵守配置优先级：命令行参数 > 仓库 config > 用户全局 config > 环境变量 > 默认值
- 普通文本配置溯源输出
  - 非 JSON 模式也能显示精简配置来源
  - 用于排查覆盖冲突，不要求用户必须切到 `--output json`
- 多套全局配置环境切换
  - 通过参数快速加载不同全局配置文件
  - 支持多仓库、多团队或多环境复用统一规则
- Desktop 页面内治理闭环
  - 项目概览提供一键扫描、生成优化建议、批量生成修复草案和清理过期骨架产物入口
  - 所有页面动作必须走 CLI/Core 白名单，不允许前端拼接任意 shell 命令
  - 动作完成后刷新当前 snapshot / workspace facts，并把结果落回 `.project-os/`
  - 治理文件视图后续补风险 / 状态 / 来源筛选，并从 `.project-os/runs/` 展示变更历史
  - L2 定时治理读取 `.project-os/config.json`；L3 patch draft 列表通过 CLI/Core 执行确认和 apply

### M7 模型与连接

目标：

- 让用户以低心智成本配置模型连接
- 模型能力可探测、可缓存、可显示当前连接状态

已完成：

- `.project-os/model-catalog.json` 管理服务商、API 地址、Key 变量名和模型列表
- Provider 支持多 profile、启用状态、API Key 保存和模型列表刷新
- 模型健康缓存可记录当前模型可用性

规划功能：

| 功能 | 阶段 | 状态 | 说明 |
|------|------|------|------|
| Provider 多连接 | Desktop v0.1 | 已完成首版 | 支持保存、编辑、删除连接 |
| 模型列表刷新 | Desktop v0.1 | 已完成首版 | 读取 `/models` 并提示当前模型是否可见 |
| 模型健康缓存 | Desktop v0.1 | 已完成首版 | 记录模型可用性和检查时间 |
| 连接诊断向导 | Desktop v0.2 | 待做 | 把 Key、API Base、模型不可用拆成可理解提示 |
| 多模型任务路由 | Desktop v0.3 | 待做 | 不同任务选择不同模型能力 |

边界：

- API Key 只保存在本地 `.env.local` 或用户指定环境变量
- 不把真实 Key 写入仓库、日志或报告

### M8 安全与执行边界

目标：

- 明确 AI 能读什么、写什么、跑什么，以及失败后如何恢复
- 在 P3 操作工程前提前埋好安全契约

已完成：

- `run_guarded_check` 白名单检查
- `run_project_os_action` 白名单治理动作
- `apply_patch_draft` 先 `git apply --check`，再 apply
- 安全检查脚本和 provider key 扫描

规划功能：

| 功能 | 阶段 | 状态 | 说明 |
|------|------|------|------|
| 命令白名单 | Desktop v0.1 | 已完成首版 | 检查和治理动作均不接受任意 shell |
| Patch apply 确认 | Desktop v0.1 | 已完成首版 | unified diff 校验通过后才可 apply |
| 高风险写入二次确认 | Desktop v0.2 | 待做 | 文件夹重命名、批量写入、删除类动作必须二次确认 |
| 回滚记录 | Desktop v0.2 | 待做 | Apply 前后记录可恢复信息 |
| 正式安全契约 | P3 操作工程 | 待做 | 明确生产 DB、远程工具、权限边界和审计 |

边界：

- 不允许页面直接传任意命令给后端执行
- 不允许默认远程执行或接生产资源

### M9 分发与对外交付

目标：

- 让 Project OS 从本仓库自用工具，逐步变成可安装、可升级、可分发的本地产品

规划功能：

| 功能 | 阶段 | 状态 | 说明 |
|------|------|------|------|
| 安装脚本和模板同步 | 当前阶段 | 已完成首版 | `install-project-os.sh`、模板和 adapter 已有回归 |
| macOS 桌面 App 打包 | Desktop v0.1 | 已完成基础 | `.app` 可双击启动，dmg 仍需继续稳定 |
| CLI 多平台预编译包 | 对外交付阶段 | 待做 | Windows / macOS / Linux 压缩包 |
| 版本升级机制 | 对外交付阶段 | 待做 | 升级、备份、兼容和废弃策略 |
| 发布前 checklist | 对外交付阶段 | 待做 | 版本号、CHANGELOG、模板同步、截图验收 |

边界：

- 当前收口期不追求 marketplace 级分发
- 分发前必须保证安装、模板、adapter 和安全检查可复现

### M10 长期治理平台

目标：

- 从单项目本地治理，逐步走向多项目、组织级、远程同步和 Agent 编排
- 先把单项目闭环跑稳，再谈组织级平台

规划功能：

| 功能 | 阶段 | 状态 | 说明 |
|------|------|------|------|
| 标准化产物上报 | 长期治理平台 | 待做 | 本地 CLI、CI、Desktop 和云端双向同步 |
| 旧兼容语法清理 | 长期治理平台 | 待做 | 梳理旧参数并制定版本废弃计划 |
| Skill 标准 I/O | P2 主动专家 | 待做 | 让专家能力可注册、可调用、可观测 |
| 接真实工具 | P3 操作工程 | 待做 | GitHub、Jira、数据库、远程 MCP 等 |
| 多 Agent 编排 | P4 编排成 Agent | 待做 | 多技能、多步骤、多人协作流程 |

边界：

- 组织级是分发和同步问题，不提前侵入当前本地内核
- P3 前必须先完成安全契约

---

## 阶段落地清单

### 对外交付阶段

- CI 自动打包流水线
  - 产出 Windows / macOS / Linux 多平台预编译二进制压缩包
  - 支持免源码安装
- CLI 调用身份和权限校验入参
  - 预留 Gateway 鉴权体系扩展字段
  - 不在当前本地-only 阶段强行接入完整鉴权

### 长期治理平台

- 标准化产物上报协议
  - 打通本地 CLI、CI、OmniDesk Desktop 和云端数据双向同步
  - 对齐报告、推荐、run record、patch draft 和人工确认状态
- 旧兼容语法清理计划
  - 梳理全部兼容参数和旧 Shell fallback
  - 制定版本废弃计划
  - 分阶段清理存量兼容代码，精简分支逻辑

---

## 北极星:组织级 AI 研发中台(2026-06 锁定)

终极目标:把 Project OS 演进成对标 **LLM-Wiki 知识库 + 专家技能包**的组织级 AI 研发中台——接真实代码仓、数据库、CLI、远程 MCP,让 AI Agent 自动跑完整个研发流程。

Project OS 现有的知识地基与治理内核,正是这座中台自下而上的底座:没有结构化知识,上层专家技能就是空中楼阁。所以不是推倒重来,是沿依赖顺序往上盖。

### 四级台阶(必须按序,跳级即塌)

| Phase | 里程碑 | task# | 解锁 |
|-------|--------|-------|------|
| **地基**(✅ 已成) | frontmatter + 知识图谱 + 语义索引 registry | — | 知识结构化,领先参考图 |
| **P1 知识驱动** | kb-just-ask 主动技能 / 治理闭环 / 安全契约种子 | #1·#2·#3 | registry 从孤岛变入口,越用越聪明 |
| **P2 主动专家** | skill 标准 I/O schema / 三个专家技能(评审·排障·改测试) | #4·#5 | 被动检查 → 主动专家 |
| **P3 操作工程** ⚠️ | tree-sitter repo map / 正式安全契约 / 接真实工具 | #6·#7·#8 | 从只读治理到可写操作(估值分水岭+风险悬崖) |
| **P4 编排成 Agent** | 多 skill 流程编排 / 组织级远程同步 | #9·#10 | AI Agent 跑完研发全流程 = 北极星达成 |

当前位置:**地基已成,启动 P1 把地基红利变现**。10 个里程碑的可跟踪拆解在会话任务看板(goal 模式),依赖关系已串联。

### 三条架构硬约束

1. **顺序不能反** —— 先把地基红利变现(P1),别急着跳去接代码仓。优势在地基,先变现。
2. **P3 安全契约是生死线** —— "AI 能写哪些文件、碰不碰生产 DB、怎么回滚"要在 P1 就埋种子(#3),等接工具时不用从零搭安全。
3. **组织级放最后** —— 先在单项目跑通 P1-P2,再谈远程同步与多人。组织级是分发问题,不是能力问题。

> 下方 v3 / v4 / v5 是地基期的历史细化记录,已被本节的四级台阶统一收口。v3=地基(已完成),v4≈P1+P2,v5≈P3+P4。

---

## 阶段路线(地基期历史细化)

### 当前补齐主线：AI Engineering Kit 自身工程化

目标：

- 让本仓库自己也符合 AI 项目工程助手提倡的标准
- 让完整度检查从“文件是否存在”升级为“结构、质量、测试、交接是否闭环”
- 让报告 UI、组件契约、数据源、文档和模板之间有清晰边界

当前判断：

- 已具备 AI 工程文档骨架
- 已具备安装、检查、报告、模板和适配层
- 还缺少可执行测试、CI、真实评分模型、报告 UI 工程化和版本发布闭环

#### P0：工程化定义与真实评分

必须补齐：

- 明确本项目的产品边界：文档规范包、安装器、检查器、AI 工程助手分别承担什么职责
- 定义“真实工程化完整度”的评分口径，不再只按文件存在给分
- 建立评分维度：系统规则、开发者规则、用户意图、项目文件、工具反馈、交接摘要、测试验证、发布记录
- 明确哪些内容是 SSOT：`state.json`、评分模型 schema、Markdown 文档、模板、TS 数据源、报告 HTML 各自负责什么
- 修正过期文档：设计规范、变更日志、决策记录、运行手册与当前实现保持一致
- 明确 `scripts/check-ai-project.sh`、`scripts/ai-project.sh`、报告页面和设计组件文档之间的边界

验收标准：

- `PROJECT.md` 和 `.project-os/state.json` 对当前阶段描述一致
- `docs/PRODUCT_PLAN.md` 能解释为什么当前 100 分不等于真实工程成熟
- `schemas/ai-project-score.v0.2.json` 记录当前评分模型，不让规则只藏在脚本里
- `schemas/ai-project-report.v0.1.json` 记录报告模块分组和说明，不让动态模块只藏在脚本里
- `docs/DECISIONS.md` 记录关键取舍，而不是只在交接里口头说明
- `docs/CHANGELOG.md` 记录报告 UI、组件契约、评分方向这些跨层变化

#### P1：可执行测试与 fixtures

必须补齐：

- 增加可执行测试入口，而不是只保留人工测试文档
- 增加项目夹具：空目录、老项目、已安装项目、缺文档项目、文档冲突项目、完整项目
- 覆盖 `core` / `product` / `full` 三种安装 profile
- 覆盖升级、备份、不覆盖用户已有文档、adapter 写入、模板同步
- 覆盖完整度评分和报告生成，包括 markdown 报告与 HTML 报告
- 让 `check-template-sync.sh` 支持严格模式，作为 CI gate 使用
- 让 `scripts/ai-project.sh report` 能直接生成 HTML 报告

验收标准：

- 一条命令能跑完本地回归测试（已由 `tests/run-tests.sh` 初步覆盖）
- 测试失败时能指出是安装、模板、评分、报告还是 adapter 出问题（当前先覆盖安装、模板、评分、报告）
- `tests/` 不再只记录人工验收，也能指向可执行测试

#### P2：报告 UI 与组件工程化

必须补齐：

- 将报告 UI 从 shell 内联 HTML 逐步拆成数据层、模板层和组件契约，当前已拆出 `templates/report/ai-project-report.html` 和 `schemas/ai-project-report.v0.1.json`
- 让 `docs/design/ai-project-assistant/data.ts` 不只是说明材料，而是能靠近真实渲染数据源
- 明确 `SectionHeading`、`RequiredMaterialItem`、`AddDocumentButton` 的状态矩阵、禁用态、hover、focus-visible 和可访问性语义
- 将当前硬编码颜色、间距、圆角、阴影沉淀到 token 文档或 token 数据源
- 给报告页建立稳定截图验收，当前已接入结构标记检查、桌面 / 移动端截图和可选真实像素 diff；后续在视觉稳定后提交 baseline
- 明确是否继续保持纯静态 HTML，还是引入轻量前端构建层

验收标准：

- 组件文档、TS 契约、页面 DOM 标记和报告模板能互相对应
- 报告模块标题、说明和评分 section 分组能从 `schemas/ai-project-report.v0.1.json` 复查
- 视觉变更有截图或浏览器验收记录，且能在本地回归入口中复现
- 报告页的非技术用户路径清楚：新项目怎么开始，老项目怎么体检

#### P3：老项目接入、跨工具适配与发布

必须补齐：

- 老项目已有 `README.md`、`AGENTS.md`、`docs/` 时的冲突判断和合并策略
- 识别已有文档质量，而不是只提示“缺文件”（已接入空模板 / TODO / 未记录启发式识别，后续用真实老项目继续校准）
- Claude / Codex / Cursor / Gemini adapter 的真实样例和复测记录，当前已覆盖 adapter 安装与 SSOT 引用
- 发布前 checklist：版本号、CHANGELOG、安装回归、报告回归、模板同步
- GitHub Actions 或等价 CI，保证核心检查在提交前可复现
- 安全边界：路径处理、覆盖策略、备份恢复、隐藏目录和可执行权限

验收标准：

- 真实老项目跑报告后，能区分“已有但不合格”和“完全缺失”（当前已由占位文档夹具覆盖基础回归）
- 发布新版本前有稳定命令和 CI 可验证
- 跨工具 adapter 分发可由 `tests/run-tests.sh` 复现，真实模型会话可按需抽样复查
- 用户能按 README / INSTALL 完成安装、体检、补齐和复查

### v1：可安装 runtime

目标：

- 让 Project OS 能作为一个仓库安装包稳定给别人用

核心交付物：

- `INSTALL.md`
- `scripts/install-project-os.sh`
- `AGENTS.md`
- `adapters/*`
- `templates/project/*`
- `templates/global/*`
- `scripts/check-runtime.sh`

成功标准：

- 能安装到空目录
- 能接入老项目
- 不复制源仓库自己的历史文档
- 安装后 Claude / Codex / Cursor / Gemini 都能读取规则
- `check-runtime.sh` 在源仓库和目标项目里都通过

本阶段当时不做：

- 不接 Radix / shadcn / ai-components（历史约束；Desktop 真实产品阶段已改为接 Headless / shadcn-style 本地组件层）
- 不做平台原生 skill 发布
- 不做自动自进化
- 不追求空目录一句话让所有模型天然认识 `Project OS`

### v1.5：分发体验优化 + 减少 AI 幻觉

目标：

- 让别人更容易安装、理解和复测 Project OS
- 给 AI 提供机器可读的结构化锚点，减少读 markdown 时的幻觉

核心交付物：

- 更短的 `README.md` / `INSTALL.md` 安装文案
- 发给 AI 的最短安装提示
- GitHub 远端版本验收
- 更轻的 `PROJECT.md` / `HANDOFF.md`
- 给 `project.json`（已有）补 JSON Schema，定义字段契约
- 核心状态文档（`PROJECT.md` / `HANDOFF.md`）有对应 typed schema：markdown 是给人看的展示层，schema 是给 AI 读的数据层

成功标准：

- 拿到 GitHub 地址后，别人能按最短提示完成安装
- 远端安装结果与本地安装结果一致
- 人工验收步骤足够短，不需要反复解释
- AI 填写状态文档时有字段范围约束，不自由发挥
- `check-runtime.sh` 能从 grep 升级为 schema 验证关键字段

本阶段当时不做：

- 不改核心路由模型
- 不引入组件库（历史约束；Desktop 真实产品阶段已废弃）
- 不扩更多 skill
- 不替换 markdown（schema 与 markdown 并存，不是替代关系）

### v2：工具原生适配包

目标：

- 让 Project OS 不只是仓库安装包，而是更接近真正的工具适配 package

核心交付物：

- 更正式的版本机制
- 更稳定的 adapter 写入与升级流程
- Claude / Codex / Cursor 的原生接入方案

成功标准：

- 不靠长提示词也能稳定完成安装入口
- 工具能更直接识别 Project OS 的入口约定
- 升级和修复不需要手工重装整包

本阶段不做：

- 不做 marketplace 级分发
- 不追求所有平台一次打通

### v3：知识结构化（架构演进第一步）✅ 已完成（= 北极星地基层）

目标：

- 让项目知识从「扁平 .md 文件」升级为「结构化可消费资产」
- 建立 Source → Schema 的知识管线，AI 不再靠全文塞上下文

核心交付物：

- 每个模板文件加 frontmatter 元数据（类型、归属模块、过期时间、依赖关系）
- `build-project-graph.sh` 升级为结构化知识图谱，输出 typed JSON
- 知识过期检测：文档加 `last_verified` 时间戳，超期自动提醒
- `check-ai-project.sh` 从「文件是否存在」升级为「元数据是否完整、是否过期」

成功标准：

- 每个 .md 模板文件都有机器可读的 frontmatter
- 知识图谱能回答「这个文件被谁引用、多久没更新」
- 体检报告能标出过期文档，而不只是缺失文档

### v4：Skill 层（架构演进第二步）

目标：

- 让 Project OS 从「文档工具包」升级为「AI 可调用的能力包」
- 把现有脚本和向导逻辑抽成独立 Skill，每个 Skill 有标准输入输出契约

核心交付物：

- Skill 契约定义：输入 schema、输出 schema、前置条件、副作用声明
- 核心 Skill：初始化、体检、补齐、反思、知识同步
- Skill 注册机制：AI 工具可发现并调用
- 外部系统 adapter 框架：Jira / Confluence（需求源）、GitHub Actions / Jenkins（执行层）

成功标准：

- AI 能通过标准接口调用 Skill，而不是靠提示词描述脚本路径
- 新增 Skill 只需按契约注册，不用改路由逻辑
- 至少一个外部系统 adapter 可用（如 GitHub Actions）

### v5：治理自动化 + 全流程闭环（架构演进第三步）

目标：

- 建立知识治理闭环：过期清理、定时巡检、变更审批
- 支持从需求到部署的 AI 辅助全流程

核心交付物：

- 定时巡检任务：知识过期扫描、规则冲突检测、模板漂移检查
- 变更审批流：关键文档修改需人工确认
- 全流程编排：AI 读需求 → 拆任务 → 建分支 → 开发 → 测试 → 合并
- 可观测性：Skill 调用记录、知识更新频率、工程健康趋势

成功标准：

- 过期文档能自动被发现和提醒
- AI 能根据 US 自主完成从建分支到提 PR 的完整开发闭环
- 有仪表盘展示项目工程健康趋势

---

## 为什么这样排

- 当前最容易出错的是入口理解和路由，而不是组件实现
- 如果太早接组件库，会把问题从入口不稳扩散到 UI、依赖、构建和设计规则
- 先把 runtime 做稳，后面的 package 化才有落点
- 先解决“能不能稳定用”，再解决“用起来是不是足够爽”

---

## 当前优先级

1. 先完成 P0：工程化定义、真实评分口径和过期文档修正
2. 再完成 P1：可执行测试入口、fixtures 和严格模板同步
3. 然后完成 P2：报告 UI 数据源、组件状态和截图验收
4. 最后推进 P3：老项目质量识别、真实工具会话抽样和发布闭环

---

## 待确认问题

- 评分模型先继续用 Bash 实现，还是拆出 JSON / TS 数据源
- 报告 UI 继续保持纯静态 HTML，还是引入轻量构建层
- CI 先覆盖本地脚本回归，还是同步覆盖浏览器截图验收
- 组件层未来是先接 Radix、shadcn，还是先做更薄的 `ai-components`

## 暂记待办（等触发条件再做）

- **AI 可观测性文档**（触发条件：手上有要真正部署上线的 AI 项目时）
  - 背景：通用 DevOps 文档（DOCKER/CI_CD/DEPLOYMENT）不加，已被 RUNBOOK/ENVIRONMENT 覆盖，且偏离 AI 工程定位。
  - 真正值得加的只有 **AI 特有的可观测性**：AI 调用次数、错误率、延迟、token 成本、超时/降级策略。
  - 形态：作为条件生成文档（参考 SECURITY.md 模式），仅在「要上线的 AI 业务项目」场景推荐，不进默认勾选。
  - 当前判断：自用治理阶段用不上，不现在做，避免文档膨胀。
