# 错误模式记录

> 用途：记录错误复盘和新增约束，回答“踩过什么坑、以后怎么避免”。
> 什么时候更新：误删、误改、误判、测试跑偏、规则失效时。
> 不要写什么：成功经验、普通进展、重复的 changelog 内容、当前状态摘要。
> 每次犯错后立即记录。
> 格式：犯的错 / 根本原因 / 加了什么规则。

---

## Project OS / 路由

### 2026-05-10 INSTALL / INIT 停在安装总结，没有继续进入启动方式选择

**犯的错**：空目录里用户说“帮我初始化这个项目，接入 Project OS”时，系统完成安装后停在安装总结，没有继续进入 `INIT` 的启动方式选择。

**根本原因**：INSTALL 规则只约束了“先安装和分类”，但没有写死“当结果是 `INSTALL / INIT` 时，安装完成后必须继续进入 INIT”。

**加了什么规则**：
- `AGENTS.md` 增加 `INSTALL / INIT` 的固定第一响应和继续进入 INIT 的要求。
- `project-setup/SKILL.md` 增加 continuation hard rule。
- `references/install.md` 明确安装完成后同一轮继续进入 INIT start mode。
- 各工具 adapter 同步这条行为。

### 2026-05-06 CLI print 模式没有稳定展示 skill banner

**犯的错**：只看语义时，Case 7 “帮我写一个登录页”虽然行为进入 frontend，但输出没有显式 `frontend` 标签，导致测试结果只能记为 `pass-with-issue`。

**根本原因**：Claude CLI print 模式不一定展示 skill 加载信息；只靠隐含行为判断会让验收不稳定。

**加了什么规则**：
- `AGENTS.md` 增加 v1 路由固定第一响应。
- `CLAUDE.md` 增加强制输出前缀。
- `.claude/skills/frontend/SKILL.md` 要求具体页面 / 组件请求第一行输出 `Skill: frontend`。

---

## 前端 / 交互

暂无记录。

---

## API / 后端 / 业务链路

暂无记录。

---

## 数据 / Schema / 引用一致性

暂无记录。

---

## 联调 / 部署 / 环境

暂无记录。
