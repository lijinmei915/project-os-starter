# Cross-Tool Project OS Test Matrix

> 用途：记录不同 AI 工具入口的验收矩阵，回答“哪些平台覆盖了、测什么、预期是什么”。
> 什么时候更新：adapter 覆盖范围、验收项目、测试命令或判断标准变化时。
> 不要写什么：产品规划、当前交接流水、与跨工具测试无关的实现细节。

目标：验证 Project OS 的通用规则能通过 Claude / Codex / Cursor / Gemini 四类入口被读取，并且都指向同一个规则源头。

验收重点不是所有工具都原生支持同一个命令，而是所有工具都能理解同一类意图：

```txt
我要把 Project OS 装进 / 接入 / 检查 / 升级当前项目
```

---

## Scope

本矩阵分两层：

| 层级 | 覆盖什么 | 当前状态 |
|------|----------|----------|
| Adapter 分发验收 | 安装脚本能否生成各工具入口文件 | 已由 `tests/run-tests.sh` 自动覆盖 |
| 路由契约验收 | 各工具入口是否把用户意图导向 Project OS 路由 | 已由 adapter 内容和 `AGENTS.md` 契约覆盖 |

当前自动化先验证“文件能正确分发、入口能读到同一规则源头”。
真实模型对话表现仍应在发布前抽样复查，但不作为当前脚本阻断项。

---

## Automated Command

推荐回归入口：

```bash
bash tests/run-tests.sh
```

其中跨工具部分会执行：

```txt
1. 安装 full profile 到临时项目
2. 使用临时项目自己的 scripts/install-adapter.sh 安装 claude / codex / cursor / gemini
3. 检查 CLAUDE.md / CODEX.md / .cursor/rules/project-os.md / GEMINI.md 均已生成
4. 检查四个入口文件都引用 AGENTS.md
```

---

## Adapter Matrix

| Tool | Adapter Source | Installed Entry | SSOT Check | Route Contract | Result |
|------|----------------|-----------------|------------|----------------|--------|
| Claude Code | `adapters/CLAUDE.md` | `CLAUDE.md` | 引用 `AGENTS.md` | `/os` 与自然语言安装意图进入 `INSTALL FLOW` | 通过 |
| Codex | `adapters/CODEX.md` | `CODEX.md` | 引用 `AGENTS.md` | 项目级请求先分类到 `INSTALL` / `INIT` / `AUDIT` / `HYBRID` | 通过 |
| Cursor | `adapters/CURSOR.md` | `.cursor/rules/project-os.md` | 引用 `AGENTS.md` | Cursor 规则要求先路由再写代码 | 通过 |
| Gemini CLI | `adapters/GEMINI.md` | `GEMINI.md` | 引用 `AGENTS.md` | Gemini 入口要求先读规则和当前状态 | 通过 |

---

## Intent Matrix

| 用户输入 | 目标路由 | Claude Code | Codex | Cursor | Gemini |
|----------|----------|-------------|-------|--------|--------|
| `帮我初始化这个项目，接入 Project OS` | `INSTALL / INIT` | 契约覆盖 | 契约覆盖 | 契约覆盖 | 契约覆盖 |
| `这个项目有点乱，帮我接管一下` | `INSTALL / HYBRID` | 契约覆盖 | 契约覆盖 | 契约覆盖 | 契约覆盖 |
| `/os` | `INSTALL FLOW` | 契约覆盖 | 契约覆盖 | 契约覆盖 | 契约覆盖 |
| `帮我检查一下 Project OS 有没有缺文件` | `INSTALL / CHECK-UPGRADE` | 契约覆盖 | 契约覆盖 | 契约覆盖 | 契约覆盖 |
| `只帮我看看，不要改` | `AUDIT` | 契约覆盖 | 契约覆盖 | 契约覆盖 | 契约覆盖 |
| `帮我写一个登录页` | `frontend` | 契约覆盖 | 契约覆盖 | 契约覆盖 | 契约覆盖 |

---

## File Assertions

`tests/run-tests.sh` 对临时 `full` 安装目录执行以下断言：

| Assertion | Expected |
|-----------|----------|
| `CLAUDE.md` exists | pass |
| `CODEX.md` exists | pass |
| `.cursor/rules/project-os.md` exists | pass |
| `GEMINI.md` exists | pass |
| each installed entry mentions `AGENTS.md` | pass |

---

## Route Contract

所有 adapter 必须遵守：

```txt
1. AGENTS.md 是唯一规则源头。
2. adapter 只翻译工具读取方式，不新增规则。
3. 项目级请求先路由，再执行。
4. INSTALL / INIT 完成安装或检查后，必须继续进入 INIT 启动方式选择。
5. 只看不改的请求进入 AUDIT，不创建文件。
```

---

## Latest Result

```txt
Date: 2026-05-20
Command: bash tests/run-tests.sh
Result: pass
Coverage: claude / codex / cursor / gemini adapter install + SSOT reference
```
