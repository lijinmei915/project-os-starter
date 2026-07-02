---
layer: knowledge
type: spec
last_verified: 2026-07-02
depends_on: [docs/PRODUCT_PLAN.md, docs/ARCHITECTURE.md, docs/PROJECT_MEMORY_AND_RUNNER.md]
teaches: "Project OS Desktop 的产品方向、技术选型、本地 Agent Core 和分阶段落地边界"
use_when: "设计桌面端、模型接入、本地 coding、文件权限、命令执行或工作台 runtime 时"
---

# 桌面端方向

> 用途：定义 Project OS 从静态 Console 演进为本地桌面工作台时的产品方向、技术选型和安全边界。
> 什么时候更新：桌面端技术栈、Agent Core 权限、模型接入、执行流程或阶段路线变化时。
> 不要写什么：具体 UI 文案、一次性开发任务流水、完整 IDE 功能清单。

## 核心结论

Project OS Desktop 的方向确定为：

```txt
Tauri 桌面端 + Local Agent Core + Workbench UI
```

Project OS Desktop 不是传统 IDE，也不是单纯给网页套壳。

它是一个本地 AI 项目工作台：

```txt
登记项目 -> 理解项目 -> 生成计划 -> 执行本地工具 -> 展示 diff -> 跑检查 -> 沉淀记忆
```

## 产品定位

桌面端服务的是长期工作，而不是分发一次性模板。

主体验应围绕当前项目持续发生：

- 记住本机项目列表和最近工作状态
- 读取项目结构、文档、脚本、git diff 和检查结果
- 接入用户配置的大模型 provider
- 让 Agent 先计划，再通过受控工具读写文件和运行命令
- 展示变更、日志、检查结果和交接状态
- 把用户选择、失败记录、修复结果沉淀进 `.project-os/`

## 技术选择

首选 Tauri。

原因：

- 比 Electron 更轻，适合长期驻留的本地工作台
- 可以复用现有 Web UI，再逐步迁移到更工程化的前端
- Rust / sidecar 层适合承接文件权限、命令执行、密钥读取和本地存储
- capability 权限模型更适合 Project OS 的受控工具边界

暂不优先选择 Electron。

原因：

- Node 生态强，但应用体积和安全边界更重
- Project OS 当前更需要受控本地执行，而不是完整 IDE 插件生态

## 架构形态

```txt
Project OS Desktop
  Workbench UI
    - projects
    - recommendations
    - task input
    - plan
    - diff review
    - run logs
  Local Agent Core
    - model provider adapter
    - project registry
    - file indexer
    - command runner
    - git diff manager
    - memory writer
  Storage
    - .project-os/
    - local config
    - keychain or local secret store
```

UI 只负责发起任务和展示状态。

文件读写、命令执行、模型密钥和本地项目索引必须经过 Local Agent Core。

## Coding 形态

Project OS Desktop 的 coding 体验不是先做完整 IDE。

第一阶段采用任务式 coding：

```txt
用户输入任务
-> Agent 读取项目上下文
-> Agent 生成计划
-> 用户确认执行范围
-> Local Agent Core 执行受控工具
-> UI 展示 diff 和检查结果
-> 用户接受或继续迭代
-> 更新 HANDOFF / memory / run record
```

第一版只需要：

- 任务输入
- 计划展示
- 文件搜索和只读预览
- 命令日志
- diff 审阅
- 检查结果

完整 Monaco 编辑器、调试器、插件市场和复杂 LSP 集成放到后续评估。

## 模型接入

模型接入必须走本地 core，不在前端直接保存或调用 API key。

最小 provider 抽象：

```txt
provider
model
apiBase
apiKeySource
```

初期只接一个 provider 即可。OpenAI-compatible 接口可以作为第一条实现路径，后续再补 DeepSeek、Claude、Qwen 等适配。

桌面端当前采用单活 provider 配置：

- `provider` 是接入协议，当前固定支持 `openai-compatible`
- `model` 填具体模型名
- `apiBase` 填兼容 `/chat/completions` 的 base URL
- `apiKeyEnv` 只填环境变量名，例如 `OPENAI_API_KEY` / `DEEPSEEK_API_KEY` / `QWEN_API_KEY`
- 真实 key 只放本机环境变量或项目 `.env.local`，不写入前端、文档、报告或 provider 配置

UI 对普通用户使用三层命名：

- 服务商：OpenAI / DeepSeek / Qwen / Gateway
- 接入方式：OpenAI-compatible，属于高级设置
- 模型：各服务商自己的 model id，应按官方文档或企业网关配置更新

多 API 采用 provider profiles：

```txt
profiles[]
  id
  name
  provider
  model
  apiBase
  apiKeyEnv
activeProfileId
```

同一时间只激活一个 profile；任务可记录当时使用的 profile id，便于复现和审计。

v0.1 已支持在 `desktop-provider.json` 中保存多个 profiles，并用 `activeProfileId` 指向当前启用配置。真实 key 仍只写入 `.env.local`，profile 只保存变量名。

模型列表由 `.project-os/model-catalog.json` 提供，管理员可以维护：

```json
{
  "schemaVersion": "project-os.model-catalog.v0.1",
  "providers": [
    {
      "id": "company-gateway",
      "label": "Company Gateway",
      "provider": "openai-compatible",
      "apiBase": "https://llm.example.com/v1",
      "apiKeyEnv": "COMPANY_LLM_API_KEY",
      "models": ["company-coder", "company-fast"]
    }
  ]
}
```

桌面端启动时读取该文件；文件不存在时由本地 core 生成默认 catalog。普通用户只在 UI 中选择服务商和模型，管理员负责更新 catalog 中的模型 ID、网关地址和环境变量名。

模型列表有两种来源：

- 管理员维护的 `.project-os/model-catalog.json`
- 桌面端使用当前 API Key 调用网关 `/models` 后返回的真实模型池

`/models` 只能说明当前 Key 能看到这些模型，不等于每个模型一定能完成对话调用。因此桌面端还提供“测试当前”动作，用当前 `apiBase`、`apiKeyEnv` 和 `model` 发起最小 `/chat/completions` 请求；只有该请求成功返回内容，才认为当前模型可用于 Project OS Desktop 的 coding / planner 链路。

## 工具权限

初期只开放内置白名单工具：

- `read_project`
- `search_files`
- `read_file`
- `run_check`
- `git_diff`
- `write_patch`
- `update_handoff`
- `save_memory`

默认不开放任意 shell。

需要执行命令时，先限制在项目目录内，并优先走 Project OS 已有脚本：

```txt
bash scripts/check-runtime.sh .
bash scripts/recommend-next.sh . --write-report
bash scripts/check-ai-project.sh . --write-report
bash tests/run-tests.sh
```

## 阶段路线

### v0.1 桌面壳

- 新增 `desktop/`
- 用 Tauri 加载 Vite + React 组件化工作台
- 建立项目目录选择和项目 registry
- 不接模型，不写文件

### v0.2 本地扫描

- 通过 Local Agent Core 扫描项目
- 读取 `.project-os/`、核心文档和脚本结果
- 在 UI 中展示项目画像、推荐和历史 runs

### v0.3 模型计划

- 接入一个模型 provider
- 支持输入任务并生成执行计划
- 计划只读，不自动改文件

### v0.4 受控执行

- 接入白名单命令 runner
- 支持运行检查、推荐和报告生成
- 展示日志和结果文件

### v0.5 Coding 闭环

- 支持生成 patch
- 展示 diff review
- 用户确认后写入
- 跑检查并更新交接状态

## 非目标

当前不做：

- 完整 IDE
- 云同步
- 多 Agent 编排
- 插件市场
- 开放 skill 安装器
- 任意命令自动执行
- 自动无限循环改代码

这些能力只有在 Local Agent Core、权限模型、diff review 和检查闭环稳定后再评估。
