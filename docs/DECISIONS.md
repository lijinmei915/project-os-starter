# 架构决策记录

> 记录重要的技术决策和原因，防止重复踩坑。
> 格式：决定 / 放弃 / 原因 / 影响。

---

## 决策列表

### Project OS

#### D001 — Project OS 先做纯内置闭环

**决定**: v1 只包含 `project-setup`、`design-system`、`frontend`、references、tests、registry、changelog。

**放弃**: 暂不依赖外部 `intent-clarifier` 或第三方 skill。

**原因**:
- 先保证自己的入口、路由、测试和交接闭环自洽。
- 外部 skill 会引入不可控分流，影响 v1 验收稳定性。

**影响**:
- 模糊需求由 `project-setup/references/clarification.md` 内部处理。
- `REGISTRY.md` 只登记 Project OS 自己的 skill。

---

#### D002 — 根目录文件作为 SSOT

**决定**: 根目录 `README.md` / `AGENTS.md` / `PROJECT.md` / `HANDOFF.md` 分别承担入口说明、AI 规则、当前状态、交接上下文。

**放弃**: 不再保留 `docs/PROJECT.md` / `docs/HANDOFF.md` 作为核心文档。

**原因**:
- 同名文档分散在 `docs/` 和根目录会造成职责冲突。
- 根目录文件更容易被 AI 和人类入口优先读取。

**影响**:
- `docs/` 只保留长期规范、决策、测试、变更记录和设计参考。
- 当前状态和当前交接只看根目录文件。

---

#### D003 — v1 路由用固定第一响应验收

**决定**: 对核心路由 case 使用固定第一响应或固定前缀，例如 `Skill: frontend`。

**放弃**: 只靠隐含语义判断 skill 是否命中。

**原因**:
- Claude CLI print 模式不一定显式展示 skill banner。
- 固定第一响应能让人工和测试记录都更容易判断。

**影响**:
- Case 7 “帮我写一个登录页”必须先输出 `Skill: frontend`。
- INIT 请求必须先问启动方式，不先问技术栈、数据库、权限或组件库。

---

## 待记录

- [ ] 后续组件层选型：Radix Themes / shadcn/ui / 自定义 ai-components
