# 测试与偏离检查

> 用途：定义测试方法、验收重点和偏离检查方式。
> 什么时候更新：测试策略、验收标准、复测命令或测试分层变化时。
> 不要写什么：当前项目状态、当前交接、长期产品路线图。
> 这份文档回答的是：怎样判断项目没有漏填、助手没有跑偏、产品规划没有偏离、设计和代码改动有基本验证。
> 它不是要求所有项目一开始就上完整测试体系，而是给不同阶段一个轻量检查框架。

---

## 测试分层

### 1. Runtime 健康检查

目标：确认 AI Runtime 的核心入口、状态和 reference 没有跑偏。

检查项：
- `README.md` / `AGENTS.md` / `PROJECT.md` / `HANDOFF.md` 是否存在
- `PROJECT.md` 是否写清项目定位、当前架构和当前进度
- `HANDOFF.md` 是否写清当前状态、风险和下一步
- `project-setup` references 是否存在：`init.md` / `audit.md`
- `docs/PRODUCT_PLAN.md` 是否写清近期目标和本阶段不做事项
- 项目特殊用户偏好是否写入 `HANDOFF.md` 或 `PROJECT.md`，而不是散落在旧模板文件里
- 是否还残留大量 `{{...}}`、无解释的 `TODO`、`.DS_Store`

推荐命令：

```bash
bash scripts/check-runtime.sh .
```

### 2. Prompt 行为测试

目标：确认助手按 project-setup 的协作流程工作，而不是凭习惯乱问、乱读、乱改。

检查项：
- 新项目是否先问“项目是什么”，再问阶段、目标、技术栈
- 第 9 组是否先读取全局偏好并复述给用户确认
- 老项目 review 是否判断“职责是否承接”，而不是机械补齐所有模板
- 用户说“跳过”时，助手是否保留 `TODO:`，而不是编造答案
- 用户只是分享信息时，助手是否没有主动扩大成实现任务

参考场景：
- `examples/prompt-simulation.md`

跨工具验收：
- `tests/cross-tool-matrix.md`

推荐准备测试目录：

```bash
bash scripts/create-test-fixtures.sh /tmp/project-os-fixtures
```

### 3. 产品规划偏离检查

目标：确认当前任务仍服务于项目阶段目标。

检查项：
- `HANDOFF.md` 的“下一步”是否能对应 `docs/PRODUCT_PLAN.md` 的近期优先级
- `PROJECT.md` 的“当前范围”是否能覆盖近期规划里的任务
- `docs/PRODUCT_PLAN.md` 的“本阶段不做”是否没有被放进当前下一步
- 如果临时改变优先级，是否在 `HANDOFF.md` 或 `docs/DECISIONS.md` 说明原因
- 如果跨层改动较大，是否更新 `docs/CHANGELOG.md`

### 4. 设计一致性检查

目标：防止 UI 越改越散。

检查项：
- UI 改动前是否读取 `docs/DESIGN_STANDARDS.md`
- 新增组件是否登记到 `docs/design/component-index.md`
- 新增颜色、间距、圆角是否优先复用 token
- 可点击元素是否有 hover 状态
- 链接和按钮是否有 focus-visible 状态
- 是否避免重复造已有 primitive / pattern

### 5. 代码测试策略

目标：让真实业务代码有和风险匹配的验证，而不是只有文档。

建议：
- 纯函数、格式化、解析、权限判断等逻辑优先写单元测试
- React / Vite 项目可用 Vitest + React Testing Library
- 关键用户流程可用 Playwright 或浏览器手测清单
- Supabase / API 请求至少验证成功、失败、loading 三种状态
- UI 改动至少记录手测结果；高风险 UI 流程建议补截图或端到端测试

---

## 收尾时最小检查

每次主要改动完成后，至少确认：

- 本轮改动是否还符合 `docs/PRODUCT_PLAN.md` 的当前阶段目标
- 如果改了 UI，是否符合 `docs/DESIGN_STANDARDS.md`
- 如果改了代码，是否运行了对应测试或说明为什么没跑
- 如果改变了下一步，是否更新 `HANDOFF.md`
- 如果形成新规则或踩坑，是否更新 `docs/LESSONS.md`
