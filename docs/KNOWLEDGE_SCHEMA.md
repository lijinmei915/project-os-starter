---
layer: governance
type: spec
last_verified: 2026-06-04
depends_on: [docs/DOCUMENTATION.md, scripts/build-project-graph.sh]
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
| `scripts/build-project-graph.sh` | 解析 frontmatter，输出结构化图谱 |
| `scripts/check-ai-project.sh` | 按元数据完整度和新鲜度评分 |
| `docs/architecture-diagram.html` | 读图谱 JSON 自动渲染架构层 |
| `docs/DOCUMENTATION.md` | 文档编写规范和更新边界 |
