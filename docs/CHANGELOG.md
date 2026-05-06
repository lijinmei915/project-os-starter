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
