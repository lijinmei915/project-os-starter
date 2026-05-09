# 代码变更日志

> 只记录高价值改动，用于回溯"改了什么 / 为什么改 / 影响到哪里"。
> 不记录零碎样式微调；方案原因看 `DECISIONS.md`，踩坑复盘看 `LESSONS.md`。

维护规则：
- 只记录跨层改动（前端 / API / 数据库 / 文档 / 环境变量中至少两层）
- 每条固定写"改动 / 影响 / 相关文件"
- 纯样式微调、文案调整、无结构影响的小修不记录
- 一次连续任务合并成一条，不拆碎
- 组织方式优先按日期，再在日期内按主题分组

---

## 2026-05-08

### Project OS / distribution

#### 增加可自动安装的分发入口

改动：
- 新增 `INSTALL.md`，提供给人和 AI 的安装说明
- 新增 `scripts/install-project-os.sh`，支持把 Project OS 安装到目标目录
- 新增 `adapters/`，提供 Claude / Codex / Cursor / Gemini 适配模板
- 新增 `scripts/install-adapter.sh`，支持按工具写入对应模型/工具入口文件
- 在 `README.md` 增加“给别人使用”的自然语言安装提示
- 在 `check-runtime.sh` 中检查安装说明和安装脚本
- 使用临时空目录完成试装，并通过目标目录内的 `check-runtime.sh` 校验

影响：
- 使用者拿到 GitHub 地址后，可以直接让 AI clone 源仓库并运行安装脚本
- 安装脚本会复制 Project OS 核心文件，并把冲突文件备份到 `.project-os/backups/`
- adapter 让 Claude / Codex / Cursor / Gemini 读取各自入口文件，但规则源头仍然是 `AGENTS.md`
- Project OS 从“可 clone 的 starter”升级为“可安装到已有项目的 runtime”

相关文件：
- `INSTALL.md`
- `README.md`
- `scripts/install-project-os.sh`
- `scripts/install-adapter.sh`
- `adapters/`
- `scripts/check-runtime.sh`
- `PROJECT.md`
- `HANDOFF.md`
- `docs/CHANGELOG.md`

---

## 2026-05-09

### Project OS / platform-neutral wording

#### 将系统定位收紧为“通用内核 + 工具适配层”

改动：
- 在 `AGENTS.md` 明确 `AGENTS.md` 是规则源头
- 把 `.claude/*` 标注为当前参考实现，而不是唯一宿主
- 在 `README.md` 和 `INSTALL.md` 中强调 `adapters/*` 负责各工具入口文件
- 在 `PROJECT.md` / `HANDOFF.md` 同步当前定位

影响：
- 使用者更容易理解 Project OS 本体不依赖 Claude
- Claude、Codex、Cursor、Gemini 现在都被表述为同一套核心规则的不同适配入口
- 后续继续扩展别的工具时，不需要重写系统本体

相关文件：
- `AGENTS.md`
- `README.md`
- `INSTALL.md`
- `PROJECT.md`
- `HANDOFF.md`

---

## 2026-05-06

### Project OS / install flow

#### 增加自然语言 + `/os` 双入口安装流程

改动：
- 新增 `references/install.md`
- 在 `project-setup/SKILL.md` 中加入 Project OS Installation Entry
- 支持自然语言触发 INSTALL FLOW
- 支持显式 `/os` 兜底入口
- 新增 `.claude/commands/os.md`
- 在测试用例中补充 INSTALL FLOW 相关 case

影响：
- 普通用户不用记命令，可以直接说“帮我初始化这个项目”
- 高级用户可以用 `/os` 明确触发安装 / 接入 / 检查
- INSTALL FLOW 会先判断目录状态，再决定 INIT / HYBRID / CHECK-UPGRADE / AUDIT
- 已复测自然语言入口：初始化已安装目录进入 `INSTALL / CHECK-UPGRADE`，接管老项目进入 `INSTALL / HYBRID`
- 已确认 `/os` 在 Claude Code 交互模式中可被发现；`-p` print 模式不展开 slash commands

相关文件：
- `.claude/skills/project-setup/SKILL.md`
- `.claude/skills/project-setup/references/install.md`
- `.claude/commands/os.md`
- `.claude/skills/tests/cases.md`
- `tests/cases.md`
- `README.md`
- `scripts/check-runtime.sh`

---

## 2026-05-06

### Project OS / slash commands

#### 增加显式 `/` 操作入口

改动：
- 新增 `/os-check`：运行 Project OS 体检并汇总工作区状态
- 新增 `/os-test`：运行或引导 v1 路由测试
- 新增 `/os-handoff`：汇总当前状态、提交情况和下一步
- 在 `README.md` 增加常用 slash commands 说明
- 在 `check-runtime.sh` 中检查这些 slash command 文件是否存在

影响：
- 使用者不需要记住所有 shell / CLI 命令
- `/` 命令作为显式操作按钮，不做强制自动门禁
- 自动化仍保持轻量，避免 CLI 登录态或模型输出不稳定导致误伤

相关文件：
- `.claude/commands/os-check.md`
- `.claude/commands/os-test.md`
- `.claude/commands/os-handoff.md`
- `README.md`
- `PROJECT.md`
- `HANDOFF.md`
- `scripts/check-runtime.sh`

---

## 2026-05-06

### Project OS / docs 收口

#### 清理旧模板文档并统一 SSOT

改动：
- 删除 `docs/PROJECT.md` 和 `docs/HANDOFF.md`
- 将当前状态和交接上下文统一到根目录 `PROJECT.md` / `HANDOFF.md`
- 将 `docs/PRODUCT_PLAN.md` 改成 Project OS 当前路线图
- 将 `docs/DECISIONS.md` 改成真实架构决策记录
- 将 `docs/DESIGN_STANDARDS.md` 改成当前阶段的设计规则边界
- 将 `docs/LESSONS.md` 改成真实错误模式记录
- 将 `docs/design/component-index.md` 改成当前无组件状态说明
- 将 `tests/cases.md` 改成 v1 测试索引，详细记录仍在 `.claude/skills/tests/cases.md`

影响：
- `docs/` 不再保留和根目录冲突的项目状态 / 交接文档
- 后续查当前状态只看 `PROJECT.md`
- 后续查当前交接只看 `HANDOFF.md`
- `docs/` 只承接长期规范、决策、测试和设计参考

相关文件：
- `PROJECT.md`
- `HANDOFF.md`
- `docs/PRODUCT_PLAN.md`
- `docs/DECISIONS.md`
- `docs/DESIGN_STANDARDS.md`
- `docs/LESSONS.md`
- `docs/TESTING.md`
- `docs/design/component-index.md`
- `tests/cases.md`

---

## 2026-05-06

### Project OS / 路由收口

#### 修复 v1 路由契约与 CLI print 模式入口偏移

改动：
- 在 `AGENTS.md` 增加 v1 路由契约和固定第一响应模板
- 在 `CLAUDE.md` 同步 Claude 专属的 v1 验收第一响应
- 强化 `project-setup` 的 CLARIFICATION / INIT Start Mode / HYBRID 规则
- 强化 `design-system` 对 Design Tokens 请求的触发
- 强化 `frontend` 对具体页面 / 组件请求的触发
- 记录 7 条 CLI 复测结果：7 条 pass

影响：
- 项目级请求不再优先滑向泛澄清或直接技术选型
- INIT 请求会先确认启动方式，再进入技术栈 / 功能范围讨论
- `设计 tokens` 能稳定进入 `design-system`
- 登录页请求会先输出 `Skill: frontend`，再进入技术栈 / 样式 / 登录方式确认

相关文件：
- `AGENTS.md`
- `CLAUDE.md`
- `PROJECT.md`
- `HANDOFF.md`
- `.claude/skills/project-setup/SKILL.md`
- `.claude/skills/project-setup/references/clarification.md`
- `.claude/skills/project-setup/references/init.md`
- `.claude/skills/project-setup/references/hybrid.md`
- `.claude/skills/design-system/SKILL.md`
- `.claude/skills/frontend/SKILL.md`
- `.claude/skills/tests/cases.md`

<!-- 更早的日期往下追加，新的在上 -->
