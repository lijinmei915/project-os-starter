---
layer: governance
type: spec
last_verified: 2026-06-04
depends_on: [docs/DOCUMENTATION.md, scripts/build-project-graph.sh]
teaches: "文档 frontmatter 元数据的字段定义、取值规则和新文件接入流程"
use_when: "AI 要给新文件加 frontmatter、检查元数据是否合规、或理解图谱数据来源时"
---

# 知识结构化规范

> 用途：定义文档 frontmatter 元数据字段、取值枚举和新增文件接入规则。
> 什么时候更新：frontmatter 字段、层枚举、过期阈值或图谱消费方式变化时。
> 不要写什么：具体文档内容、向导预设、安装流程。

本文定义 Project OS / AI Engineering Kit 的「知识结构化」约定。目标是让每个文档不只给人读，也带上机器可读的元数据，供 `scripts/build-project-graph.sh` 生成结构化知识图谱，供 `scripts/check-ai-project.sh` 评估知识完整度和新鲜度。

## 两层元数据并存

每个文档头部有两套元数据，各管一摊：

| 元数据 | 形式 | 给谁看 | 例子 |
|--------|------|--------|------|
| Frontmatter | 文件最顶部 YAML（`---` 包裹）| 机器（图谱、评分、架构图）| `layer: knowledge` |
| 用途引用块 | 标题下方 `> 用途/什么时候更新/不要写什么` | 人 | `> 用途：说明系统结构` |

两者并存，不互相替代。frontmatter 在最顶部，YAML frontmatter 是 AI 工具标准约定（Cursor `.mdc` 同款），AI 读 `.ai/rules/` 软链接时能正常识别并跳过。

## Frontmatter 字段

```yaml
---
layer: knowledge        # 架构归属层（必填）
type: spec              # 文档类型（必填）
last_verified: 2026-06-04   # 最后人工核实日期 ISO（必填）
depends_on: [AGENTS.md, docs/DOCUMENTATION.md]  # 声明式依赖（可选，无则省略）
teaches: "项目的技术栈选型与运行环境约定"  # 语义摘要：这个文件教会 AI 什么（可选）
use_when: "AI 需要了解项目用了什么框架、怎么启动时"  # 语义触发：什么场景下该查这个文件（可选）
---
```

### layer — 架构归属层

对齐架构全景图的四层。一个文件只归一层。

| 值 | 含义 | 典型文件 |
|----|------|---------|
| `entry` | 用户入口层 | README.md, INSTALL.md |
| `skills` | 研发能力层 | scripts/*.sh, .ai/skills/*.json |
| `knowledge` | 知识与资产层 | 多数 docs/*.md, schemas/* |
| `governance` | 基础治理层 | AGENTS.md, DOCUMENTATION.md, NAMING.md |

### type — 文档类型

| 值 | 含义 |
|----|------|
| `spec` | 规范类：定义规则、边界、约定 |
| `status` | 状态类：当前进度、交接（PROJECT.md, HANDOFF.md）|
| `log` | 流水类：追加记录（CHANGELOG.md, DECISIONS.md, LESSONS.md）|
| `guide` | 指南类：操作手册、教程（README.md, RUNBOOK.md）|
| `schema` | 结构定义：JSON Schema 等 |

### last_verified — 最后人工核实日期

ISO 日期（`YYYY-MM-DD`）。每次人工确认该文档内容仍准确时更新。距今超过**过期阈值（默认 90 天）**会被图谱标记 `stale: true`，在体检报告里列出。

### depends_on — 声明式依赖

该文档逻辑上依赖/必须配合阅读的其他文件路径数组。区别于 `build-project-graph.sh` 自动 grep 出的 `references` 边，`depends_on` 是**人工声明的强依赖**，生成 `declares_dependency` 边。无依赖时省略此字段。

### teaches — 语义摘要（v0.3 新增）

一句话描述这个文件**教会 AI 什么知识**。不是文件标题的复述，而是它对 AI 的价值。好的写法回答"读完这个文件，AI 能做到什么？"

| 写法 | 评价 |
|------|------|
| `teaches: "前端规范"` | ❌ 太笼统，和标题重复 |
| `teaches: "项目的组件目录结构、命名约定和样式隔离规则"` | ✅ AI 读完知道怎么写组件 |

可选字段，无则省略。`build-project-graph.sh` 会解析此字段并输出到 `knowledge-registry.json`。

### use_when — 语义触发（v0.3 新增）

一句话描述**什么场景下 AI 应该来查这个文件**。好的写法描述触发条件，不是文件内容。

| 写法 | 评价 |
|------|------|
| `use_when: "需要时"` | ❌ 等于没说 |
| `use_when: "AI 要新建组件、调整目录结构或排查样式冲突时"` | ✅ 明确触发场景 |

可选字段，无则省略。与 `teaches` 搭配，构成知识注册表的语义索引。

## 新增文件接入规则

新增一个文档时：

1. **加 frontmatter**：在文件最顶部加 YAML 块，至少填 `layer` / `type` / `last_verified`
2. **归层**：从四层中选一个，参照上表
3. **定类型**：从五种 type 中选一个
4. **声明依赖**：如果该文档必须配合其他文件读，填 `depends_on`
5. **跑图谱**：`bash scripts/build-project-graph.sh .` 确认节点带上新元数据
6. **模板同步**：如果是模板文件，同步 `templates/` 镜像

## 相关文件

| 文件 | 说明 |
|------|------|
| `scripts/build-project-graph.sh` | 解析 frontmatter，输出结构化图谱和知识注册表 |
| `.project-os/graph/knowledge-registry.json` | 语义索引：teaches + useWhen，供 AI 按问题域查文件 |
| `.project-os/graph/project-graph.json` | 完整文件图谱（含 teaches/useWhen 属性） |
| `scripts/check-ai-project.sh` | 按元数据完整度和新鲜度评分 |
| `docs/architecture-diagram.html` | 读图谱 JSON 自动渲染架构层 |
| `docs/DOCUMENTATION.md` | 文档编写规范和更新边界 |
