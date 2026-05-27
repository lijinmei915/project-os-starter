# Project OS 产品规划

> 用途：回答“这个产品分几阶段演进、当前阶段做什么、下一阶段再做什么”。
> 什么时候更新：阶段定义、阶段目标、成功标准或中长期路线变化时。
> 不要写什么：当前回合交接、具体改了哪些文件、一次性阻塞或临时待办。

## 产品愿景

把 AI 驱动开发流程收口成一个可复制、可验证、可交接的 Project OS。

它的目标不是直接生成某个业务产品，而是先稳定 AI 如何理解项目、分流任务、遵守规则、记录状态和接受测试。

---

## 当前阶段判断

当前处于：

```txt
AI Engineering Kit 自身工程化收口期
```

当前策略：

```txt
先把“文件完整”升级为“工程闭环完整”，
再继续优化分发体验，
最后再考虑工具原生 package / skill。
```

---

## 阶段路线

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

本阶段不做：

- 不接 Radix / shadcn / ai-components
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

本阶段不做：

- 不改核心路由模型
- 不引入组件库
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

### v3：可发现 skill / package + 外部系统集成

目标：

- 让 Project OS 逐步从”仓库 + 安装脚本”升级为”更容易被模型和工具发现的能力包”
- 把 `adapters/` 扩展成两类：AI 工具 adapter（现有）+ 外部系统 adapter（新增）
- 支持一条命令从读需求到部署的全流程：AI 读 Jira/Confluence US → 拆 task → 建分支 → 开发 → 自动化测试 → Sonar 安全扫描 → 合并部署

核心交付物：

- package / metadata 设计
- 更正式的安装入口协议
- 可发现的命令 / skill 注册机制
- 外部系统 adapter 框架：Jira / Confluence（需求源）、GitHub Actions / Jenkins（执行层）、SonarQube（质量门禁）
- INIT flow 支持接收 US 作为输入，自动拆解为 task 并进入开发流程

成功标准：

- 纯空目录里也更容易通过短提示进入正确流程
- 平台能先认识 Project OS，再执行安装或接管
- `--with-ci` 安装选项可写入 GitHub Actions workflow 模板
- AI 能根据 US 自主完成从建分支到提 PR 的完整开发闭环

本阶段不做（留到 v4+）：

- 不追求全平台一次打通
- 不做完全无人值守的自动部署（需保留人工审批节点）

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
