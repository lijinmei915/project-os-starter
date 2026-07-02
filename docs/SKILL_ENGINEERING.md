---
layer: knowledge
type: spec
last_verified: 2026-06-13
depends_on: [AGENTS.md, docs/DOCUMENTATION.md, docs/NAMING.md]
teaches: "Agent Skill 工程的证据推导、文件边界、生成策略和分发约束"
use_when: "AI 要生成、评审或收口一个 Agent Skill / Codex Skill / Project OS Skill 工程时"
---

# Skill 工程规范

> 用途：定义 Project OS 生成 Agent Skill 工程时的文件边界、证据推导和验收规则。
> 什么时候更新：skill 目录结构、生成模板、分发策略、schema 或验收方式变化时。
> 不要写什么：具体某个 skill 的业务规则、一次性调研笔记、长期产品路线图。

本文回答一个问题：当用户要做 Agent Skill 时，Project OS 应该如何根据目标产物、已有文件、下一步动作和验收要求推导文件结构。

## 核心判断

Skill 不是一个小型应用工程。

它更像给 AI 的“专业上手说明 + 可按需加载的资源包”：

```txt
metadata 负责触发
SKILL.md 负责核心工作流
references/ 负责按需知识
assets/ 负责输出资产
scripts/ 负责确定性操作
tests/ 或 fixtures/ 负责验收
dist/ 负责分发裁剪
```

根原则：

- `SKILL.md` 要短，优先写触发条件、边界、工作流和收尾检查。
- 大段规则、设计细节、schema、示例和模板不要塞进 `SKILL.md`。
- 不要默认生成 `README.md`、`USAGE.md`、`CHANGELOG.md` 这类辅助文档；只有工程证据显示需要分发或交付给外部使用时才考虑。
- 开发态可以完整，分发态必须裁剪。
- 不要求用户理解 `assets/`、`scripts/`、`schemas/`、`fixtures/` 或 `dist/`；这些目录由系统根据证据自动补齐。

## 内部推导层级

以下不是给用户选择的表单项，而是 Project OS 的内部判断语言。

用户只需要表达目标或继续推进工作。Project OS 应该像 OpenDesign 识别 plugin folder 一样，先看当前工程证据，再决定该暴露什么动作、补什么文件，而不是追问用户要哪种 Skill 类型。

推导信号：

- 目标产物：Skill 最终要产出文本、报告、HTML、设计稿、数据、脚本结果还是安装包。
- 已有文件：目录里是否已经有 `SKILL.md`、`open-design.json`、`assets/`、`scripts/`、`schemas/`、`fixtures/`、`dist/` 等证据。
- 下一步动作：当前最自然的下一步是继续写规则、生成样例、预览输出、运行检查、安装、发布还是分享。
- 验收要求：是否需要可复测输入、确定性检查、版本记录、裁剪分发包或外部安装验证。

### 1. 最小 Skill

推导条件：当前只需要沉淀一个可复用 AI 工作流；没有输出资产、确定性脚本、外部分发或安装验证的证据。

生成：

```txt
.agents/skills/<skill-name>/
  SKILL.md
  examples/example-input.md
```

可选：

```txt
.agents/skills/<skill-name>/agents/openai.yaml
```

规则：
- `SKILL.md` frontmatter 的 `name` 和 `description` 是触发关键。
- 示例只保留 1-2 个典型输入和期望输出。
- 不生成 README / CHANGELOG。

### 2. 参考资料型 Skill

推导条件：Skill 需要稳定引用领域知识、流程规则、客户资料或业务资料；这些资料不适合塞进 `SKILL.md`，但暂时不需要确定性脚本。

生成：

```txt
.agents/skills/<skill-name>/
  SKILL.md
  references/<topic>.md
  examples/example-input.md
```

规则：
- `SKILL.md` 只写何时读取哪个 reference。
- reference 保持一层深度，避免二级引用链。
- 大于 10k words 的 reference 必须在 `SKILL.md` 给搜索关键词或章节索引。

### 3. 资产型 Skill

推导条件：目标产物包含可复用模板、样式、组件、报告、视觉稿、品牌资产或其他输出资产；AI 需要复制或组合资产，而不是只按文字说明工作。

生成：

```txt
.agents/skills/<skill-name>/
  SKILL.md
  assets/templates/<template>
  assets/data/manifest.json
  references/design.md
  examples/example-input.md
```

可选：

```txt
assets/styles/<style-file>
assets/scripts/<runtime-script>
```

规则：
- `assets/data/manifest.json` 是优先读取入口，避免 AI 直接通读大模板。
- 大模板应当复制使用，不要反复读入上下文。
- 视觉规则放 `references/design.md`，不要塞满 `SKILL.md`。

### 4. 工具脚本型 Skill

推导条件：工作需要确定性校验、转换、打包、调用本地工具、结构化输入输出、fixture 或自动测试；仅靠 `SKILL.md` 描述无法稳定复现。

生成：

```txt
.agents/skills/<skill-name>/
  SKILL.md
  scripts/<command>
  schemas/input.schema.json
  fixtures/example.json
  tests/example.test.md
```

规则：
- 脚本承担确定性逻辑，`SKILL.md` 只说明何时运行、输入输出和失败处理。
- `schemas/` 只在脚本需要结构化输入时生成。
- `fixtures/` 和 `tests/` 必须能说明如何复测，不要只是空壳文件。

### 5. 分发型 Skill

推导条件：下一步动作出现安装、发布、分享、marketplace、OpenDesign、跨项目复用或外部交付；需要 manifest、打包和分发裁剪。

开发态可包含：

```txt
CHANGELOG.md
USAGE.md
scripts/build-dist.*
manifest.json 或 open-design.json
dist/
```

分发态应裁剪为：

```txt
SKILL.md
agents/openai.yaml
assets/
references/
scripts/
```

规则：
- `dist/` 由脚本生成，不作为默认手写内容。
- 分发包应记录版本、commit、更新时间和下载地址。
- `CHANGELOG.md` / `USAGE.md` 是分发辅助，不是最小 skill 必需项。

## FxUI Skill 给我们的启发

`fx-ui-report-skill` 是资产型 + 分发型 skill：

- `SKILL.md` 保持工作流、读取策略、组件映射和收尾自检。
- 大 CSS、组件 HTML、starter 模板都放在 `assets/`。
- 视觉细则放在 `references/design.md`。
- `components.manifest.json` 作为机器可读组件入口，避免通读大模板。
- `scripts/build-dist.py` 把开发目录裁剪成可分发目录，并给 `SKILL.md` 打版本戳。
- `dist/` 中仍包含 `CHANGELOG.md`，但这是发布包取舍，不是所有 skill 的默认要求。

这个模式说明：Project OS 不应该默认给所有 Agent Skill 生成“完整包”。应该先生成最小结构，再根据工程证据和下一步动作逐步补齐资产、脚本或分发文件。

## OpenDesign 给我们的启发

OpenDesign 的 Design Files 不是让用户选择“插件类型”，而是扫描文件结构：

- 发现某个目录同时存在 `open-design.json` 和 `SKILL.md`，就识别为 plugin folder。
- 识别成功后，UI 才暴露 `Add to My plugins`、`Publish repo`、`Open Design PR` 等动作。
- 每个动作背后都有确定性 agent prompt，负责读 manifest、跑 CLI、验证结果和报告失败。
- 打包社区插件时，prompt 要求先读项目已有 artifacts、`DESIGN.md`、生成物，再推导 manifest；不要问用户项目文件已经能回答的字段。

Project OS 应该学习这个方式：先根据现有工程和目标产物识别“现在需要什么能力”，再自动补文件和动作。用户不需要知道内部目录该叫什么。

## 与 Project OS schema 的关系

`schemas/skill.schema.v0.1.json` 描述 Project OS 中 skill 的标准 I/O 契约，适合工具脚本型或可编排 skill。

使用方式：

- 最小 Skill 不强制生成 schema。
- 工具脚本型 Skill 推荐生成 `schemas/input.schema.json`。
- 可编排 Skill 可额外生成 `.ai/skills/<skill>.json`，声明 `trigger`、`knowledge`、`input`、`output`、`sideEffects` 和 `action`。

不要把 Project OS 的 `.ai/skills/*.json` 和 Codex / Claude 的 `SKILL.md` 混为一类：

- `SKILL.md` 是 AI 运行时阅读的能力说明。
- `.ai/skills/*.json` 是 Project OS 自身的能力注册和编排契约。

## 生成策略

当用户要做 Agent Skill 时，应先默认：

```txt
最小 Skill + 可选参考资料
```

如果目标产物或已有文件显示需要模板、报告、视觉资产或可复用输出，按需补：

```txt
资产型 Skill
```

如果验收方式显示需要确定性运行、校验、转换、打包或结构化输入输出，按需补：

```txt
工具脚本型 Skill
```

如果下一步动作显示需要安装、发布、分享、marketplace、OpenDesign 或跨项目分发，按需补：

```txt
分发型 Skill
```

## 验收清单

- `SKILL.md` 是否能在 1 分钟内让 AI 明白何时触发、怎么做、何时收尾。
- frontmatter `name` / `description` 是否足够触发，不依赖正文才能判断。
- 是否避免把大段 reference 或 CSS 塞进 `SKILL.md`。
- 是否按需生成 `references/`、`assets/`、`scripts/`、`schemas/`、`fixtures/`。
- 是否没有默认生成 README / USAGE / CHANGELOG 等辅助文档。
- 如果有分发需求，是否存在明确的 `build-dist` 和裁剪清单。
- 如果有脚本，是否有可复测 fixture 或测试说明。
