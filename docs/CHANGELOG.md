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

---

## {{YYYY-MM-DD}}

### {{主题分区，例如"登录 / 认证 / 数据隔离"}}

#### {{一句话改动标题}}

改动：
- {{具体做了什么}}
- {{}}

影响：
- {{对后续开发、用户体验、架构的实际影响}}

相关文件：
- `{{路径 1}}`
- `{{路径 2}}`

---

<!-- 更早的日期往下追加，新的在上 -->
