---
layer: governance
type: spec
last_verified: 2026-07-21
teaches: "OmniDesk 文档的 SSOT、边界和校验规则"
use_when: "AI 要修改 OmniDesk 文档、判断信息归属或调整文档结构时"
---

# 文档编写规范

> 用途：定义 OmniDesk 的文档边界、更新规则和机器校验。
> 什么时候更新：文档职责、状态来源、验证门槛或发布证据变化时。
> 不要写什么：旧 Project OS 的安装说明、模板分发流程或当前回合流水。

## SSOT 原则

同一事实只保留一个主要来源，其他位置只引用，不复制。冲突时按以下来源判断：

| 问题 | SSOT |
|---|---|
| 产品入口与本地启动 | `README.md`、`INSTALL.md` |
| Agent 行为、执行与兼容边界 | `AGENTS.md` |
| 当前产品状态和风险 | `PROJECT.md` |
| 当前接手上下文 | `HANDOFF.md` |
| 系统模块与状态所有权 | `docs/ARCHITECTURE.md` |
| 测试、Eval 和发布证据 | `docs/TESTING.md` |
| 环境与本地依赖 | `docs/ENVIRONMENT.md` |
| 常见操作和故障恢复 | `docs/RUNBOOK.md` |
| 长期路线 | `docs/PRODUCT_PLAN.md` |
| 重要取舍与错误约束 | `docs/DECISIONS.md`、`docs/LESSONS.md` |

`.omnidesk/` 是运行时状态根；兼容期内 `.project-os/` 只作为迁移源。状态变化必须经 Runtime 的 namespace resolver 持久化，不用 Markdown 或手工 JSON 充当运行时真相源。

## 文档结构契约

文档职责由 `docs/data/doc-structure.manifest.json` 登记，机器可读的知识索引由 `docs/data/knowledge-registry.json` 维护。新增或删除 `docs/*.md`、改变职责或必备章节时，必须同步更新这两个登记文件。

文档分层如下：

1. 根目录：入口、行为边界、当前状态和交接。
2. `docs/`：长期架构、运行、测试、安全和决策。
3. `desktop/`：产品代码、原生运行时、Eval 和测试。
4. `.omnidesk/`：本地用户数据、运行事件、缓存和证据，不作为受版本控制的产品文档。

旧 `templates/`、installer、adapter、routing skill 和 CLI 文档不属于新产品结构。它们在依赖审计完成前只能以迁移材料存在，不得作为新能力说明或验收依据。

## 文档治理机器校验

结构变更后运行：

```bash
bash scripts/check-doc-structure.sh .
bash scripts/check-frontmatter.sh .
```

涉及 Desktop Runtime、状态迁移、Agent 执行或 Eval 时，额外运行：

```bash
bash tests/run-tests.sh
```

`check-doc-structure` 验证职责登记、必备章节和职责冲突；`check-frontmatter` 验证可发现文档的元数据。不要用旧模板同步或 AI 工程评分脚本代替这两个门槛。

## 更新规则

- 产品状态变化：同步 `PROJECT.md`、`HANDOFF.md` 与 active `.omnidesk/data/state.json`；兼容层尚在时也同步 `.project-os/state.json`。
- 运行时契约变化：更新 `AGENTS.md`、`docs/ARCHITECTURE.md` 或 `docs/TESTING.md` 中唯一负责的文档。
- 真实 Eval 结果：保留在 `.omnidesk/evidence/` 的 artifact，基线结构更新在 `desktop/evals/`，不把模型输出抄入 Markdown。
- 误改、误判或安全缺陷：在 `docs/LESSONS.md` 记录根因和新增约束。

文档保持短而可验证。当前进度写 `HANDOFF.md`，长期方向写 `PRODUCT_PLAN.md`，不要在多个文件维护相同的待办。
