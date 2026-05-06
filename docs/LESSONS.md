# 错误模式记录

> 每次犯错后立即记录。
> 格式：犯的错 / 根本原因 / 加了什么规则。

---

## Project OS / 路由

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
