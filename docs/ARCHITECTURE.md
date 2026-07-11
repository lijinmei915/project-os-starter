---
layer: knowledge
type: spec
last_verified: 2026-07-09
depends_on: [AGENTS.md]
teaches: "系统的模块划分、核心数据流和各层之间的边界"
use_when: "AI 需要理解整体系统结构、判断某个改动影响范围、或向用户解释架构时"
---

# 架构说明

> 用途：说明系统结构、核心模块、数据流和边界。
> 什么时候更新：模块职责、运行路径、数据流、部署结构或跨层边界变化时。
> 不要写什么：当前交接流水、详细变更历史、临时任务计划。

本文是 Project OS / AI Engineering Kit 的架构说明。

## 当前定位

Project OS 正在收敛为通用的 AI Engineering Kit：

```txt
检查 AI 工程完整度
按需补齐工程文档
保留跨工具 AI 规则适配
```

它不是业务 UI 框架，也不是某个平台专属插件。下一阶段桌面端方向已确定为 `Tauri + Local Agent Core + Workbench UI`，详见 `docs/DESKTOP_APP.md`。

## 整体架构分层

OmniDesk / Project OS 的整体架构自下而上分为 6 层。底层解决“接得进来”，上层解决“治得好”。

```txt
入口层：Web / IDE 插件 / CLI / CI / API
工作台应用层：大盘 / 单项目 / 规则 / 知识
治理服务层：质量 / 依赖 / 架构 / 安全 / 文档
核心内核层：规则引擎 + AI 引擎 + 执行引擎
元数据层：项目画像 + 资产建模 + 关系图谱
接入层：Git / 本地目录 / CI / 制品库 / IDE
```

| 层级 | 解决的问题 |
|------|------------|
| 入口层 | 用户在哪，治理能力就在哪 |
| 工作台应用层 | 面向不同角色的功能界面 |
| 治理服务层 | 可插拔的治理能力集 |
| 核心内核层 | 所有项目共用的治理大脑 |
| 元数据层 | 先摸清家底，再谈治理 |
| 接入层 | 零侵入对接所有新老项目 |

## 入口层方案

入口层的原则是“用户在哪，治理能力就在哪”，但所有入口必须汇入同一套标准上下文和同一套执行语义。入口层不承载治理业务逻辑，只负责接收请求、标准化上下文、鉴权、日志、路由和结果回传。

### Entry Context 标准

项目启动第一周先稳定 `Entry Context` JSON 标准。Web / Desktop、IDE 插件、CLI、CI 和 API 都必须产生同一种上下文结构，Gateway 和解析层也只接收标准结构，不再为每个入口写一套分支逻辑。

机器可读 schema 见 `schemas/entry-context.schema.json`。

最小字段：

```json
{
  "schemaVersion": "project-os.entry-context.v0.1",
  "entry": "desktop",
  "mode": "readonly",
  "intent": "check",
  "actor": {
    "type": "user"
  },
  "project": {
    "path": "."
  },
  "request": {
    "id": "local-check-001",
    "createdAt": "2026-07-09T00:00:00Z"
  }
}
```

### Gateway 职责

Gateway 必须补齐完整职责：

- 统一鉴权，识别调用者和入口来源。
- 参数标准化转换，把 Web 表单、CLI flags、CI env、IDE 上下文和 API body 转成 `Entry Context`。
- 日志链路，给每次请求分配 request id，并贯穿 Gateway、CLI 内核、报告和 patch 草案。
- 限流，避免 CI、自动化或外部 API 重复触发高成本治理动作。
- 异常封装，将底层错误归一为可展示、可记录、可复测的错误对象。
- 路由分发，只按标准上下文选择治理动作，不让下层内核感知入口差异。

下层核心只接收标准上下文，不读取 Web / CLI / CI 的私有参数。

### 统一真相源

本地、CI 和 Desktop 的项目治理状态统一以 `.project-os/` 骨架目录为读写唯一真相源。`PROJECT.md`、`HANDOFF.md` 和桌面 UI 是展示层或交互层，不能绕过 CLI 直接写入机器状态。

当前最高优先级状态源：

- `.project-os/state.json`：项目名称、阶段、架构摘要和当前状态的机器主源
- `schemas/project-state.schema.json`：状态结构契约
- `.project-os/state-bundles/*.json`：CI / 本地回流使用的轻量状态包

原生 CLI 提供：

```bash
project-os state sync .
project-os state sync . --set phase=stabilizing --set stage="Console 内核收口"
```

约束：

- 所有端写入 `.project-os/state.json` 必须走 `project-os state sync` 或后续同等 Rust CLI/core API。
- 写入前必须校验 `schemas/project-state.schema.json` 对应约束。
- 写入时复用 `.project-os/locks/project-os.lock`，避免多端并发覆盖。
- 写入完成后生成 `.project-os/state-bundles/*.json`，作为 CI 和本地 Desktop 回流的骨架产物。
- 前端只读渲染本地 JSON；任何变更请求转发给 CLI/Core 作为唯一写入通道。

### Desktop 对话上下文链路

Desktop 对话遵守“前端采集、核心组装、模型回答、工作台执行”的单向数据流：

```txt
chat turns + dialogue context state
-> Tauri chat command
-> local project evidence assembler
-> grounded answer contract
-> message references / existing task actions
```

边界：

- 前端保存最近对话，并提取当前话题、上一轮结论、待回答问题、用户委托和下一预期动作。
- Tauri 核心按当前项目组装阶段、目标、任务、Git 变更、验收报告和治理文件证据；浏览器预览使用同字段的只读降级数据。
- 模型只能基于传入证据回答；证据不足时标记为推断，不能要求用户重复已有上下文。
- 文件和任务引用由本地核心生成并验证，不采信模型凭空生成的路径；点击引用复用现有文件预览和任务工作面。
- 普通问答不展示 Agent 步骤时间线；只有任务执行、进行中或失败事件显示过程状态。
- “那怎么办 / 你判断 / 直接修”等短追问继承当前话题；进入任务时使用完整上下文生成计划，但任务标题保持用户可读的原始话题。

### CLI 复用架构

CLI 是入口层的能力内核，不只是给开发者手敲命令的工具。

```txt
本地离线场景：用户直接调用 CLI 二进制执行
Web / CI 在线场景：调用 Gateway 标准接口，接口内部复用 CLI 内核逻辑
```

当前最小统一入口已经落在 `scripts/ai-project.sh`，但它只是过渡形态：

```bash
bash scripts/ai-project.sh scan .
bash scripts/ai-project.sh check .
bash scripts/ai-project.sh report .
bash scripts/ai-project.sh recommend .
bash scripts/ai-project.sh run .
```

这些命令会先写入 `.project-os/entry-contexts/*.json`，再复用 `check-ai-project.sh`、`recommend-next.sh` 或 `project-runner.sh` 执行治理动作。

Shell 入口的定位：

- 用于快速验证 Entry Context、报告、推荐和 run record 的统一语义。
- 用于保持现有 `core` profile 轻量可分发。
- 不作为长期 Gateway、CI、Desktop 联动的最终底座。
- 每次生成 Entry Context 后立即做基础校验，避免等全量自检才发现上下文字段错误。

Shell 入口的长期限制：

- Windows 原生 `cmd` / PowerShell 兼容性弱，常依赖 Git Bash / WSL。
- 参数、日志、异常错误码缺少全局统一类型系统，容错脆弱。
- 进程间调用接口不足，Desktop / Gateway / CI 只能通过文件和 shell 进程间接协作。
- 复杂路由、鉴权、限流、结构化日志和错误封装会逐渐超出 Shell 适合承担的边界。

长期目标是抽出一层原生 CLI 程序和可复用 library core。Shell 脚本保留为兼容 wrapper，原生 CLI 承担标准上下文解析、命令路由、结构化日志、错误码、跨平台文件操作和执行调度。

当前原生 CLI 起点位于 `cli/`，可用命令：

```bash
cargo run --manifest-path cli/Cargo.toml -- context .
cargo run --manifest-path cli/Cargo.toml -- report . --runtime-root .
cargo run --manifest-path cli/Cargo.toml -- scan . --runtime-root .
cargo run --manifest-path cli/Cargo.toml -- context . --trigger-source desktop --output json --persist none
cargo run --manifest-path cli/Cargo.toml -- report . --runtime-root . --output report --persist none
```

其中 `context` 完全由原生 CLI 写入 Entry Context；`scan` / `report` / `recommend` / `run` 当前仍委托 legacy shell runner，后续再逐步迁入 core library。原生 CLI 支持 `--trigger-source` 标记执行来源，支持 `--persist auto|none|full` 控制是否落盘，支持 `--output json|report` 输出 `project-os.cli-result.v0.1` 结构化结果，供 Desktop / Gateway / CI 直接捕获；`report` 输出模式会把已生成的机器可读报告内嵌进 stdout，避免调用方再二次读取本地 JSON。

本地运行配置由用户全局 config 和仓库 `.project-os/config.json` 共同承载，schema 位于 `schemas/project-os-config.schema.json`。当前配置包括 CLI 默认输出模式、默认持久化策略、写入锁开关、陈旧锁超时和历史产物保留数量。用户可通过 `project-os config init --global` 初始化全局配置模板。配置优先级固定为：命令行参数 > 仓库 `.project-os/config.json` > 用户全局 config > `PROJECT_OS_*` 环境变量 > 内置默认值。写入型入口会创建 `.project-os/locks/project-os.lock` 防止多个 Project OS 进程并发覆盖产物；启动时会按 `staleLockSeconds` 自动清理超时残留锁，也可用 `--stale-lock-seconds` 做单次覆盖。结构化 stdout 会输出 `config.values` 和 `config.sources`，用于诊断配置覆盖和冲突。

脚本目录开始按用途分层：

```txt
scripts/exec/       执行入口 wrapper
scripts/validate/   校验入口 wrapper
scripts/cleanup/    清理入口 wrapper
```

根 `scripts/*.sh` 旧路径继续保留为兼容入口，新增调用优先走分层目录。

目标形态：

```txt
project-os CLI binary
  -> parse Entry Context / flags
  -> call Project OS core library
  -> emit structured logs / reports / patches / run records

scripts/ai-project.sh
  -> compatibility wrapper
  -> delegates to project-os binary when available
  -> falls back to legacy shell flow during migration
```

约束：

- 命令行语义和 API 语义必须一一对应。
- Web / CI 不另写第二套治理逻辑。
- CLI 能离线本地执行，断连平台时仍能扫描、检查、生成报告和输出修复草案。
- 新增治理能力必须同时实现 CLI 命令、Gateway 标准接口和 CI 自动化适配。
- 新增复杂治理能力不得只落在 Shell 脚本里；新增命令和业务逻辑必须先落在 Rust CLI / core library，Shell 只做参数透传和兼容 wrapper。

### 三端数据闭环

CLI、CI 和 Desktop / Web 必须共享同一批治理产物：

- CLI / CI 生成的 report、patch、修复草案自动同步到 Desktop / Web 可查看区域。
- Desktop / Web 可以统一查看本地、CI 和自动化治理记录。
- CI 产生的修复建议必须支持页面审核，不直接静默写入项目。
- 所有治理记录都要能追溯入口、请求、上下文、执行结果和人工确认状态。

### API 分层

API 拆为两层，避免把内部全量能力直接暴露给外部调用方。

| API | 用途 | 暴露范围 |
|-----|------|----------|
| 内部服务 API | Desktop / Web / CI / IDE 复用完整治理能力 | 全量能力，仅内部三端使用 |
| 对外开放 API | 外部系统稳定集成 | 仅稳定原子能力，严格版本化 |

对外开放 API 不承诺内部编排细节，只提供稳定能力，例如 `scan`、`check`、`recommend`、`report`。

### 零侵入和降级

入口层默认零侵入：

- 不强制改目录结构。
- 不强制替换构建工具。
- 不要求必须嵌入配置文件。
- 默认只读扫描；写入必须走 patch / MR / PR / 用户确认。
- CI 默认只检查和报告，不静默修复。

离线和降级能力：

- CLI 支持本地缓存规则包。
- 断连平台时可独立运行检查、推荐和报告。
- CI 支持本地输出离线报告。
- Gateway 不可用时，不影响本地 CLI 的基础治理能力。

### 新能力准入

新增任何治理能力必须同时满足：

```txt
CLI 命令可执行
Gateway 标准接口可调用
CI 自动化可适配
离线本地执行可降级
治理产物可被 Desktop / Web 查看和审核
```

不满足这些条件的能力只能作为实验能力，不进入入口层正式能力集。

## 仓库实现层次

```txt
1. 规则入口层：AGENTS.md / docs/ROUTING.md / adapters
2. 项目状态层：PROJECT.md / HANDOFF.md / .project-os/state.json
3. 工程文档层：docs/*
4. 工具脚本层：scripts/*
5. 模板分发层：templates/project/*
6. 本地生成物层：.project-os/reports/* / .project-os/graph/*
7. 桌面工作台层：desktop/* / Local Agent Core / Workbench UI
```

## 运行路径

### 检查路径

```txt
scripts/check-ai-project.sh
-> 扫描已有文件
-> 按系统规则 / 环境 / 用户意图 / 项目文件 / 工具反馈 / 交接摘要评分
-> 输出完整度报告
```

### 关系图路径

```txt
scripts/build-project-graph.sh
-> 扫描核心文档、脚本、schema、模板和 AI 资产
-> 识别文件节点、层级、SSOT 标记、模板标记、引用关系和 .ai/rules 映射
-> 输出 .project-os/graph/project-graph.json
```

关系图只做静态结构分析，不调用 LLM、不联网、不取代人工 review。

### 安装路径

```txt
scripts/install-project-os.sh
-> 选择 profile
-> 从 templates/project 复制模板
-> 备份冲突文件
-> 写入 .project-os/version 和 state.json
```

### 同步路径

```txt
scripts/sync-templates.sh
-> 将可分发 runtime 同步到 templates/project

scripts/check-template-sync.sh
-> 检查源 runtime 与模板是否漂移
```

### 桌面端路径

```txt
desktop/*
-> Tauri shell 加载 Workbench UI
-> Local Agent Core 读取项目 registry / .project-os / 本地文件
-> 受控调用模型 provider、Project OS 脚本、git diff 和记忆写回
-> UI 展示计划、日志、diff、检查结果和交接状态
```

桌面端不绕过 Project OS 现有脚本和文档治理。模型接入、文件写入和命令执行必须经过 Local Agent Core 的权限边界。

## 模块职责

| 区域 | 职责 |
|------|------|
| `AGENTS.md` | AI 行为规则和文档边界 |
| `docs/ROUTING.md` | Project OS 路由细则和固定第一响应 |
| `PROJECT.md` | 当前项目状态 |
| `HANDOFF.md` | 当前交接摘要 |
| `docs/` | 工程规范、架构、测试、命名、决策 |
| `scripts/` | 安装、检查、同步 |
| `templates/project/` | 安装到目标项目的干净模板 |
| `adapters/` | Claude / Codex / Cursor / Gemini 适配 |
| `.claude/` | Claude Code 参考实现 |
| `.project-os/graph/` | 本地生成的项目关系图 |
| `desktop/` | 后续 Tauri 桌面端壳和 Local Agent Core |

## 边界

- 源仓库可以保留完整能力。
- 目标项目默认只安装必要文档。
- 已有文档默认不覆盖；需要更新时先备份或生成建议。
- AI 规则不依赖单一平台自动触发。
- 桌面端可以读写本地项目，但必须通过受控工具、diff review 和检查闭环。

## 兼容说明

`docs/CODE_STRUCTURE.md` 仍保留，用于描述代码目录职责。
新项目优先阅读本文件理解整体架构。
