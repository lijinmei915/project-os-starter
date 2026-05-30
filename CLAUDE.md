# Claude 专属配置

> 用途：定义 Claude 专属增强行为，不重复定义通用 Project OS 规则。
> 什么时候更新：Claude 专属输出格式、命令入口或参考实现行为变化时。
> 不要写什么：跨工具通用规则源、产品介绍、当前交接流水。

> 项目级规则在 `AGENTS.md`，本文件只放 Claude 专属内容。

## 强制输出前缀

在 v1 路由测试中，必须先输出路由前缀，再回答问题。

特别是：

```txt
用户输入：帮我写一个登录页
第一行必须输出：Skill: frontend
```

不要省略这个前缀，即使后面要继续询问技术栈、样式或登录方式。

## 当前状态速览（每次收尾更新，保持 5 行以内）

- **上次做到**：impeccable typeset + colorize + polish 三轮视觉优化，统一 teal 品牌色，130+ 硬编码值 token 化，新增 PRODUCT.md
- **上次做到**：新增 AI 工具配置 + PRODUCT.md 模板，四组分类，20 模板互引补齐，写入自动裁剪断链，check-templates.sh + pre-commit hook
- **下一步**：push 验证线上；简化 REGISTRY.md 和 frontend/SKILL.md 模板残留引用
- **线上地址**：https://lijinmei915.github.io/project-os-starter/

---

## Project OS 路由优先级

Claude 在本项目中必须优先遵守 `AGENTS.md` 的 v1 路由契约。

CLI print 模式下也要执行这些第一响应模板，不要因为没有文件工具就回到普通聊天模式。

核心规则：

- `/os` 或 Project OS 安装 / 接入 / 检查意图 -> `project-setup / INSTALL`
- 模糊产品请求 -> `project-setup / CLARIFICATION`
- 新软件 / 系统 / 应用请求 -> `project-setup / INIT`
- 当前项目整理 / 继续做 -> `project-setup / HYBRID`
- 架构查看 / 分析 -> `project-setup / AUDIT`
- 设计 tokens / UI 规范 -> `design-system`
- 具体页面 / 组件实现 -> `frontend`

如果 CLI print 模式没有显式展示 skill，也必须按上述路由输出第一响应。

## v1 验收第一响应

这些输入是当前收口测试，必须按固定路由处理：

```txt
/os
-> INSTALL FLOW
-> 先判断当前目录是空目录、已有项目、已安装 Project OS，还是无法判断
```

```txt
帮我初始化这个项目
-> INSTALL FLOW
-> directory detection
-> 空目录 / 近似空目录时进入 INSTALL / INIT
-> 已安装 Project OS 时进入 INSTALL / CHECK-UPGRADE
-> 已有代码但未安装 Project OS 时进入 INSTALL / HYBRID
```

```txt
这个老项目有点乱，帮我接管一下
-> INSTALL FLOW
-> directory detection
-> 已有项目时进入 INSTALL / HYBRID
```

```txt
帮我检查一下 Project OS 有没有缺文件
-> INSTALL FLOW
-> 已安装 Project OS 时进入 INSTALL / CHECK-UPGRADE
-> 即使没有文件读取工具，也要先输出该路由，再说明需要目录清单或文件访问权限
```

```txt
只帮我看看，不要改
-> AUDIT
-> 不修改文件
-> 如果没有文件读取工具，先说明只能做有限审计
```

```txt
我想做一个产品
-> CLARIFICATION
-> 只问软件系统 vs 产品方案，不问技术栈、平台、已有代码
```

```txt
我想做一个后台管理系统
-> INIT
-> 先问启动方式：快速原型 / 项目治理 / 完整项目
-> 不先问技术栈、功能范围、数据库、权限、部署
```

```txt
我想快速做一个后台管理系统原型
-> INIT / Prototype-first
-> 明确输出 Start mode: Prototype-first
-> 不先问技术栈、数据库、组件库
```

```txt
帮我写一个登录页
-> frontend
-> 第一行输出 Skill: frontend
-> 不切到 project-setup
```

## 文档导航

| 文件 | 内容 | 何时读 |
|------|------|--------|
| `README.md` | 总入口与场景分流 | 开始时先加载 |
| `AGENTS.md` | 多助手共用协作规范 | 进入项目后加载 |
| `PROJECT.md` | 当前项目状态 | 判断阶段与下一步时加载 |
| `HANDOFF.md` | 当前会话与交接状态 | 接手当前回合时加载 |
| `INSTALL.md` | 安装方式、profiles、upgrade | 涉及安装或分发时加载 |
| `docs/PRODUCT_PLAN.md` | 分阶段产品路线图 | 判断当前阶段目标或讨论新方向时加载 |
| `docs/CHANGELOG.md` | 结构性变更记录 | 跨层改动后更新；回溯改了什么时查 |
| `docs/DECISIONS.md` | 关键架构决策及原因 | 有新决策时记录；理解历史选择时查 |
| `docs/LESSONS.md` | 错误复盘与新增约束 | 犯错后立即记录 |
| `docs/DOCUMENTATION.md` | 文档编写规范和更新边界 | 新建或大改文档前加载 |
| `templates/global/MEMORY_RULES.md` | Claude memory 写法与更新时机 | 要改 memory 时加载 |
| `docs/CODE_STRUCTURE.md` | `hooks / utils / lib / scripts` 分层规则 | 新增通用代码时加载 |

## Claude Memory 导航

| 文件 | 内容 | 位置 |
|------|------|------|
| `project_*.md` | 项目指针、关键事实 | `~/.claude/projects/.../memory/` |
| `user_profile.md` | 用户背景与偏好 | `~/.claude/projects/.../memory/` |
| `user_preferences.md` | 用户称呼、回答风格、解释深度 | 全局用户映射位置 |
| `feedback_style.md` | 工作风格偏好 | `~/.claude/projects/.../memory/` |
| `feedback_session_closeout.md` | 收尾 checklist | `~/.claude/projects/.../memory/` |

## 收尾 Checklist

| 文件 | 何时更新 |
|------|---------|
| `CLAUDE.md` 状态速览 | 每次主要任务完成后 |
| `HANDOFF.md` | 当前回合做了跨文件改动时 |
| `docs/CHANGELOG.md` | 有跨层改动时 |
| `docs/DECISIONS.md` | 有明确决策时 |
| `docs/LESSONS.md` | 犯错后 |
| Claude memory | 关键事实、长期偏好变化时 |

备注：
- `CLAUDE.md` 只写 Claude 专属内容，不重复抄 `AGENTS.md`。
- 用户称呼优先级：当前对话 > `HANDOFF.md` / `PROJECT.md` > 全局用户映射 > 默认称呼。
- 如果这个项目不用 Claude，可以删掉本文件。
