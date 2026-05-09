# 当前交接

## 当前状态

- 当前做到：Project OS v1 路由修复与复测已完成
- 当前阻塞：无
- 是否可继续：可直接继续

## 本次已完成

本轮只做了稳定化：

- 已重写 `README.md` 为人类入口
- 已重写 `AGENTS.md` 为 AI 运行规则
- 已建立根目录 `PROJECT.md` 作为当前状态 SSOT
- 已建立根目录 `HANDOFF.md` 作为交接上下文 SSOT
- 已移动原新项目和老项目流程材料到 project-setup references，并改名为 `init.md` / `audit.md`
- 已添加 `.gitignore`
- 已清理 `.DS_Store`
- 已初始化 git
- 已将语言策略固化到 `AGENTS.md`：调度/硬规则英文优先，日常说明中文为主，用户文案跟随用户语言
- 已补充文件级语言分层：`SKILL.md` 英文硬规则 + 中文解释，`AGENTS.md` 中英混合，`README.md` / `PROJECT.md` / `HANDOFF.md` 中文，`references/` 中文为主但关键约束可用英文
- 已新增 `.claude/skills/project-setup/SKILL.md`，让 project-setup 作为项目级请求入口生效
- 已新增 `.claude/skills/project-setup/references/hybrid.md`，补齐 HYBRID reference
- 已将 INIT 从“硬禁止生成”改为 start mode 分流：Prototype-first / Foundation-first / Full setup
- 已新增 `.claude/skills/tests/cases.md`，记录 v1 收口验证的 7 条测试
- 已新增纯内置 Project OS skill 壳：`REGISTRY.md`、`design-system`、`frontend`、`clarification.md`、skill routing tests 和 skill changelog 规范
- 已修复 `AGENTS.md` / `CLAUDE.md` 根入口规则，让 CLI print 模式也遵守 v1 路由契约
- 已强化 `project-setup` 的 CLARIFICATION / INIT Start Mode / HYBRID 规则
- 已强化 `design-system` 对“设计 tokens / tokens 规范”的触发
- 已强化 `frontend` 对“登录页 / 页面 / 组件”的触发
- 已完成 7 条 CLI 复测：7 条 pass
- 已清理 `docs/` 旧模板残留，删除 `docs/PROJECT.md` / `docs/HANDOFF.md`
- 已将 `docs/PRODUCT_PLAN.md`、`docs/DECISIONS.md`、`docs/DESIGN_STANDARDS.md`、`docs/LESSONS.md` 改为当前 Project OS 真实内容
- 已新增项目级 slash commands：`/os-check`、`/os-test`、`/os-handoff`
- 已新增 `INSTALL FLOW`，支持自然语言识别和 `/os` 显式入口
- 已新增 `/os` 命令作为 Project OS 安装 / 接入 / 检查的统一入口
- 已复测自然语言 INSTALL FLOW：
  - “帮我初始化这个项目” -> `INSTALL / CHECK-UPGRADE`
  - “这个老项目有点乱，帮我接管一下” -> `INSTALL / HYBRID`
  - “帮我检查一下 Project OS 有没有缺文件” -> CHECK-UPGRADE 语义正确
  - “只帮我看看，不要改” -> `AUDIT`
- 已在 Claude Code 交互模式确认 `/os` 命令可被发现；`-p` print 模式不会展开 slash command
- 已新增 `INSTALL.md`，提供给人和 AI 的安装说明
- 已新增 `scripts/install-project-os.sh`，支持把 Project OS 自动安装到目标目录
- 已用临时空目录试装并通过 `check-runtime.sh` 校验：0 warning
- 已新增 `adapters/CLAUDE.md`、`CODEX.md`、`CURSOR.md`、`GEMINI.md`
- 已新增 `scripts/install-adapter.sh`，可按工具写入 `CLAUDE.md` / `CODEX.md` / `.cursor/rules/project-os.md` / `GEMINI.md`
- 已将文案进一步收紧为“AGENTS.md 是通用规则源头，.claude/* 是参考实现，adapters/* 是工具适配层”
- 已新增 `tests/cross-tool-matrix.md`，记录 Codex / Claude Code / 可代码桌面端的验收表
- 已新增 `scripts/create-test-fixtures.sh`，生成 empty / existing / installed 三类测试目录
- 已新增 `docs/DOCUMENTATION.md`，把 README / AGENTS / PROJECT / HANDOFF / CHANGELOG 等文档边界和更新规则收口成 SSOT
- 已在 `AGENTS.md` 增加文档更新规则，避免每次改动默认同步所有核心文档

## 不做事项

- 不新增 skill
- 不扩功能
- 不优化 UI
- 不接外部 skill，Project OS 先保持纯内置闭环

## 风险与待确认

- CLI print 模式不一定显式输出 skill banner，当前以固定第一响应前缀和行为判断路由
- 组件层尚未接入，后续再决定 Radix / shadcn / ai-components
- `/os` 已可被交互式 Claude Code 发现，但自动 TTY 中不方便确认菜单执行，后续可人工手点验证一次

## 下一步

1. 跑 Codex / Claude Code / 可代码桌面端验收
2. 继续验证安装脚本和 adapter 在空目录 / 老项目 / 已安装项目里的表现
3. 后续再进入组件层选型：`ai-components` / Radix / shadcn
