---
layer: governance
type: spec
last_verified: 2026-07-21
depends_on: [docs/DOCUMENTATION.md]
teaches: "OmniDesk 文件、目录、状态分区和契约的命名规则"
use_when: "AI 要新增、重命名或退役 OmniDesk 文件与目录时"
---

# 文档命名规范

> 用途：定义 OmniDesk 的文件和目录命名、放置与兼容规则。
> 什么时候更新：状态分区、模块命名或文档结构变化时。
> 不要写什么：旧 Project OS 模板、adapter 或 installer 的命名约定。

## 总原则

- 平台约定名称不改：`README.md`、`AGENTS.md`、`package.json`、`Cargo.toml`。
- 根目录放入口、规则、状态和交接；长期专题放 `docs/`；代码和测试留在 `desktop/`。
- 文件名使用稳定英文；顶层 Markdown 使用大写主题名，子目录专题使用小写短横线。
- 新的运行时数据只能进入 `.omnidesk/` 的明确分区，不能新增 `.project-os/` 写入。

## 根目录主流文件

| 文件 | 用途 |
|---|---|
| `README.md` | 用户入口和产品说明 |
| `INSTALL.md` | 桌面端启动和接入说明 |
| `AGENTS.md` | Agent 行为、执行和迁移边界 |
| `PROJECT.md` | 当前产品状态 |
| `HANDOFF.md` | 当前交接摘要 |

可选的贡献、安全和许可文件遵循社区约定。不要再新增 `CLAUDE.md`、`.claude/`、`.agents/` 或跨工具规则副本；通用规则只维护在 `AGENTS.md`。

## docs/ 工程文档

`docs/` 顶层采用稳定的大写主题名，例如：

```txt
ARCHITECTURE.md  ENVIRONMENT.md  TESTING.md  RUNBOOK.md
PRODUCT_PLAN.md  DECISIONS.md   LESSONS.md  DOCUMENTATION.md
```

顶层文档的职责以 `docs/data/doc-structure.manifest.json` 为准。新增专题应先确认没有现有 SSOT；设计或实现细节放入对应子目录，使用 `lowercase-kebab-case.md`。

## 状态与证据目录

```txt
.omnidesk/
  data/      # 用户与工作区持久化数据
  runtime/   # checkpoint、事务、事件和锁
  cache/     # 可重建缓存和派生数据
  evidence/  # Eval、Patch、检查和发布证据
```

`.omnidesk` 的目录名固定小写。运行时数据文件由 Rust Runtime owner 决定，不手工创建兼容文件。`.project-os` 仅接受迁移读取路径，直到迁移验收后整体退役。

## 代码与测试命名

- React 组件和前端模块遵循现有 `desktop/src/` 命名；不要为了统一改动成熟模块。
- Runtime 领域模块使用 snake_case Rust 文件名，如 `agent_runs.rs`、`state_namespace.rs`。
- Node 测试使用 `*.test.mjs`；Eval 数据放入 `desktop/evals/`，trace 用 run id 分目录保存。
- JSON schema 使用 `<topic>.schema.json`；版本化基线使用 `<topic>.v<major>.<minor>.json`。

不再创建 Project OS 评分、模板、安装 profile 或跨工具适配器命名空间。
