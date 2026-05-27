# 当前交接

> 用途：回答“上一轮做了什么、现在能不能继续、风险是什么、下一步具体干什么”。
> 什么时候更新：完成一次连续任务后，或风险、阻塞、下一步发生变化时。
> 不要写什么：长期路线图、完整历史、产品介绍、已经稳定的架构决策全文。

## 当前状态

- 当前做到：Project OS 正在收敛为 AI Engineering Kit，并开始补齐本仓库自身的工程化闭环
- 当前阻塞：无
- 是否可继续：可直接继续

## 本次已完成

- 已完成 v1 路由、INSTALL FLOW、安装脚本、adapter、模板分层和文档治理
- 已把 `PROJECT.md` / `HANDOFF.md` / `docs/PRODUCT_PLAN.md` 的职责和语言分层写成正式规则
- 已补 `check-runtime.sh`：能检查文档头部说明、模板字段和明显串边界问题
- 已验证：本地安装到全新目录时，目标项目文档会落成干净模板
- 已验证：已安装目录里，Codex 会继续进入 INIT 启动方式选择，不再停在安装总结
- 已验证：远端 GitHub 安装到老项目时会命中 `INSTALL / HYBRID`，保留原代码并备份旧 `README.md`
- 已记录三条维护线：源仓库线、用户模板线、本地增强线
- 已补目标项目轻量 `AGENTS.md` 模板，并调整安装脚本改用模板版 `AGENTS.md`
- 已停止主安装脚本分发 `.claude/settings.local.json` 和本地 `CLAUDE.md`
- 已补模板同步检查：源仓库运行时改动后，可用 `scripts/sync-templates.sh` 同步到 `templates/project`
- 已明确安装器和测试夹具只属于源仓库，不默认安装到用户项目
- 已实现 profile-based 安装：默认非交互为 `core`，终端无 profile 时进入交互选择
- 已调整 `check-runtime.sh`：轻量安装不再被要求带 `.claude/skills`、adapters 和完整 docs
- 已新增 `docs/NAMING.md`、`docs/ARCHITECTURE.md`、`docs/ENVIRONMENT.md`、`docs/RUNBOOK.md`
- 已新增 `scripts/check-ai-project.sh` 和 `scripts/ai-project.sh`，用于完整度评分和报告生成
- 已增强 HTML 完整度报告：默认面向非技术用户，先给人话结论、待处理事项和可复制给 AI 的话术；命令折叠到高级区
- 已把 HTML 页承载为“新项目 / 老项目”双入口：新项目提供初始化向导、必选资料自动勾选、可选项勾选和可复制初始化话术
- 已补新项目文档结构预览：点击必选或可选文档项，可查看对应文件名、栏目结构和适用说明
- 已产出 4 个视觉 / 交互升级方案对比图，放在 `docs/design/proposals/ai-project-assistant-4-schemes.png`
- 已参考 `/Users/heqiao/Downloads/ai-engineering-kit.zip`，将报告页首屏 1:1 复现为紧凑型 AI Engineering Kit 交互壳：顶部 segmented control、新项目协作模式 / 启动策略、老项目代码来源 / 体检项，并补齐对应组件图标
- 已将基础上下文资料勾选控件和自定义增强加号抽成可复用组件化控件：`RequiredMaterialItem` / `AddDocumentButton`，不再使用纯字符假图标
- 已把 `RequiredMaterialItem` 改为 `locked` 禁用语义：浅灰只读样式、`aria-disabled=true`、`data-state=locked`、`data-source` 指向 TS 数据源
- 已新增 `docs/design/ai-project-assistant/components.md`、`components.ts`、`data.ts`，组件不只停留在 Markdown 说明，也有可迁移的数据源和契约
- 已产出“减少线太多”的 8 个视觉方向对比图，放在 `docs/design/proposals/ai-project-assistant-low-line-8-schemes.png`
- 已参考 `/Users/heqiao/Downloads/ai-engineering-kit (1).zip`，把报告页重新对齐为 960px 居中的 1:1 工作台布局：外层单卡片、左右 5/7 分栏、编号步骤、黑底绿勾、横向协作按钮和上下结构添加按钮
- 已补 `SectionHeading` 小标题组件规范和变体：`numbered` / `numbered-with-description` / `plain`，并同步 DOM 标记、TS 数据源和组件契约
- 已同步 `templates/project/scripts/check-ai-project.sh`，模板生成的报告也具备相同说明
- 已按文档命名规范确认：AI Engineering Kit 自身工程化全量路线图归入 `docs/PRODUCT_PLAN.md`，不新增临时待办或临时 backlog 文档
- 已把当前阶段同步为“AI Engineering Kit 自身工程化收口期”，并同步更新 `PROJECT.md` 与 `.project-os/state.json`
- 已将 `scripts/check-ai-project.sh` 升级为双分数模型：`AI 工程上下文完整度` 继续检查 AI 接手资料，`AI 工程成熟度` 检查测试、CI、评分 schema、报告工程化、发布和跨工具验收
- 已调整 `scripts/ai-project.sh report`，默认同时生成 markdown 和 HTML 报告
- 已给 `scripts/check-template-sync.sh` 增加 `--strict`，发现模板不同步时可作为门禁失败
- 已新增 `tests/run-tests.sh`，覆盖 runtime、模板 strict、报告生成和 `core` / `product` / `full` 安装 profile 回归
- 已新增 `schemas/ai-project-score.schema.json` 和 `schemas/ai-project-score.v0.2.json`，让评分维度、分值和检测方式不再只藏在 shell 脚本里
- 已新增 `.github/workflows/ci.yml`，让 GitHub 在 push / pull request 时自动跑 shell 语法检查、JSON 解析、回归测试和报告生成
- 已新增 `tests/screenshot-regression.sh` 和 `tests/screenshots/`，把报告页 HTML 标记检查与可选浏览器截图纳入回归入口
- 已新增 `templates/report/ai-project-report.html`，并让 `scripts/check-ai-project.sh` 改为套模板生成 HTML，报告 UI 不再内联在 shell 主逻辑里
- 已更新 `tests/cross-tool-matrix.md`，并让 `tests/run-tests.sh` 自动验证 claude / codex / cursor / gemini adapter 安装与 `AGENTS.md` 引用
- 已将 `docs/design/tokens.md` 从分类说明升级为 v0.1 可执行 token 表，覆盖颜色、字号、间距、圆角、阴影、布局和组件 token slot
- 已将 `docs/design/layout.md` 从原则说明升级为可执行布局规范，覆盖页面壳、工作台、Header、segmented control、表单、列表、模块网格、预览区和响应式规则
- 已将 AI 项目工程助手组件规范从 3 个局部组件升级为 9 个核心组件：`ProductHeader`、`SegmentedSwitch`、`MetaPanel`、`SectionHeading`、`OptionCard`、`ChecklistItem`、`AddItemCard`、`TextField`、`Button`
- 已新增 2 个页面组合模式：`NewProjectWorkbench` 和 `OldProjectAuditWorkbench`，并在 `docs/design/component-index.md` 登记兼容别名和迁移规则
- 已将 `templates/report/ai-project-report.html` 建立 `:root` token / alias 层，并把当前工作台核心组件的颜色、字号、间距、圆角、阴影优先改为 token 引用
- 已同步更新 `docs/design/tokens.md`，补齐当前模板实际使用的 palette、字号、间距、圆角、阴影和组件 token slot
- 已将 `tests/screenshot-regression.sh` 升级为桌面 / 移动端双视口截图回归，并在存在 baseline 时调用 `tests/visual-diff.mjs` 做真实像素 diff
- 已新增 `tests/visual-diff.mjs --self-test`，不依赖第三方包即可验证 PNG 解码、差异计算和 diff 图输出能力
- 已生成第一版视觉 baseline：`tests/screenshots/baseline/ai-project-report-desktop.png` 和 `tests/screenshots/baseline/ai-project-report-mobile.png`
- 已用 `VISUAL_DIFF_STRICT=1` 严格复跑通过：桌面差异 `0.003%`，移动端差异 `0.000%`，默认阈值 `1.000%`
- 已将 `scripts/check-ai-project.sh` 的上下文完整度检查从“只看文件存在”升级为“先看是否为可用文档”，能识别待办标记、未记录、暂无记录、双花括号占位符等空模板内容
- 已在 `tests/run-tests.sh` 增加老项目占位文档夹具，验证已有但不合格的文档不会被误判为 `100/100`
- 已同步更新评分模型 schema，新增 `substantive_file`、`substantive_file_any`、`substantive_content_any` 检测语义
- 已新增 `schemas/ai-project-report.schema.json` 和 `schemas/ai-project-report.v0.1.json`，将报告模块标题、评分 section 分组和说明文案从 shell 硬编码迁到结构化数据
- 已让 `scripts/check-ai-project.sh` 生成 HTML 报告时读取报告模块数据源，并把该数据源纳入 `core` 安装、回归测试和 CI JSON 解析
- 已产出协作模式选择器 8 个交互 / 样式优化方向，放在 `docs/design/proposals/collaboration-mode-8-schemes.svg`
- 已将报告页“协作模式”从小型双按钮改为和“启动策略”一致的模块卡：图标、标题、正文、右侧选中勾，并同步 `OptionCard` 组件契约和 TS 数据源
- 已将顶部“创建新项目 / 接手老项目”切换器改为反色选中态：深色滑块、白字、品牌色图标，并补齐 `SegmentedSwitch` DOM 状态标记
- 已移除顶部切换器反色滑块投影，保留黑底白字但降低视觉重量
- 已将 `OptionCard` 选中态从整卡反色改为轻量 selected：白底、黑色选中边框、右侧绿色选中图标
- 已统一 `SectionHeading` 编号样式：编号只跟随标题，不再让内容区形成独立左侧序号轨道
- 已将 `SectionHeading` 内部结构组件化为 `kit-step-num` + `kit-section-label`，移除右侧专属编号样式，所有栏位共用同一套小标题样式
- 已补齐 `SectionHeading` 的 DOM 槽位标记：`title` / `step` / `label` / `description`，避免后续各栏位各写各的标题结构
- 已将 `SectionHeading plain` 变体改为标题文字对齐有编号标题的文字线，内容区仍与卡片列表外边缘对齐
- 已将“点击添加更多文档”正式标记为 `AddItemCard[document]`，宽度改为跟随右侧资料卡片，同左边缘、同宽度对齐
- 已降低 `AddItemCard` 的视觉重量：加号控件从 36px 降到 32px，卡片高度降到 88px，文案改为 13px medium
- 已定义 `SectionHeading` 间距 token：标题/说明间距 `4px`，小标题块/内容组件间距 `16px`，替代各处零散 margin
- 已沉淀工作台间距规范：面板上下/左右内边距 `32px`，移动端 `24px/20px`，区块间距 `32px`，列表项间距 `12px`，控件间距 `16px`
- 已修复旧项目左栏 `kit-left kit-card` 的 class 混用问题，避免 `.kit-card { padding: 0 }` 覆盖工作台分栏内边距，并记录到 `docs/LESSONS.md`
- 已规范 `ChecklistItem` 图标槽：固定 `34px / content / 18px` 三列，glyph 统一 `16px`，并补齐 `leadingIcon/content/trailingIcon` slot 标记
- 已统一上传区和添加文档区为同一套 `EmptyAction` / `AddItemCard` 虚线空态操作样式，上传区归入 `AddItemCard[upload]`
- 已给 `EmptyAction` 增加上下/左右 `16px` 内边距 token；带说明的上传区允许自然增高，避免 88px 高度下上下只剩 4px
- 已补齐全页面 `button` 交互状态：禁用浏览器默认外观，主按钮固定最小高度和 padding，卡片按钮 / 复制按钮 / 空态按钮的 `hover/active/focus-visible` 不改变尺寸或 transform，避免点击抖动
- 已调整老项目工作台结构：来源配置（当前工作目录 / Git 地址 / 上传区）跟随“代码来源”放在左栏，右栏只保留“体检将包含以下内容”，与新项目左侧 1/2、右侧 3 的结构一致
- 已补充老项目工作台间距定义：标题说明到内容 `16px`，来源卡片组到来源配置组 `32px`，路径框到按钮 `16px`，并写入 tokens / layout / 组件规范
- 已修正来源配置区双重间距：`SectionHeading margin-bottom` 和父级 `gap` 不再叠加，`当前工作目录` 说明到路径框回到规范的 `16px`
- 已把本地路径框升级为 `TextField[path] + directoryPicker`：右侧文件夹按钮可触发本地目录选择，选中后展示目录名，并在组件规范中记录浏览器不暴露完整本机路径的限制
- 已将顶部 meta 从英文调试表格改为中文 `MetaPanel[status-card]`：展示当前报告、生成时间和双分数；顶部不再重复展示路径，路径只保留在“当前工作目录”等业务字段里；同时将网页未接真实本机执行的功能标记为 `copy` 或 `planned`
- 已新增 `tests/check-report-model.mjs`，并接入 `tests/run-tests.sh`：校验评分模型总分、报告模块引用的 section 和上下文维度覆盖，避免报告数据层与评分模型漂移
- 已新增 `scripts/add-project-docs.sh` 和 `templates/project-docs/`：轻量安装后也能追加工程文档模板，默认跳过已有文档
- 已将“添加更多文档”从 `待接入` 改为复制补齐文档命令：`bash scripts/add-project-docs.sh . --profile product && bash scripts/ai-project.sh report .`
- 已让 `scripts/check-ai-project.sh --write-report` 同步生成 `.project-os/reports/ai-project-report.json`，作为无需 API 的机器可读返回值
- 已补 `.env.example` 的 `DEEPSEEK_API_KEY` 占位，并确认 `.gitignore` 忽略 `.env` / `.env.*`；真实 API key 不写入仓库或模板
- 已新增 `scripts/check-secrets.sh`，检查 `.env.local` 是否被 git 忽略，并扫描 tracked files 中是否误写明显 provider key；已纳入 core 分发、CI 和 `tests/run-tests.sh`
- 当前本仓库自检结果：上下文完整度 `100/100`，工程成熟度 `100/100`

## 不做事项

- 不新增 skill
- 不扩功能
- 不优化 UI
- 不接外部 skill，Project OS 先保持纯内置闭环

## 风险与待确认

- 纯空目录里，如果没有任何预装入口文件，模型不会天然认识 `Project OS`
- 上下文完整度评分仍是启发式，需要后续用真实老项目校准
- 工程成熟度 v0.2 已能暴露真实缺口，但评分权重仍需要后续校准
- HTML 报告目前仍由 shell 脚本生成静态文件，交互已覆盖首屏切换和选项切换；模块分组已迁到结构化数据，但还不是 React 组件工程
- 当前 v0.2 成熟度 `100/100` 说明本模型覆盖的测试、发布、数据源、UI 模板和 adapter 回归已闭环，不代表真实业务项目无需人工 review
- 当前已有第一条可执行回归入口、评分模型数据源、报告模块数据源、JSON 报告返回值、追加工程文档工具、评分/报告模型一致性检查、CI、截图视觉 diff 入口、报告模板层、空模板文档识别和 adapter 安装回归；下一轮重点应转向真实老项目样本校准
- 视觉 diff 已具备能力，第一版 baseline 已生成；后续每次明确改视觉时，需由维护者确认是否更新 baseline

## 下一步

1. 用真实老项目样本继续校准文档质量阈值
2. 继续校准报告数据层和评分模型之间的对应关系
3. 用真实 Claude / Codex / Cursor / Gemini 会话抽样复查路由表现
