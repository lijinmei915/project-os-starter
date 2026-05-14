# 当前交接

> 用途：回答“上一轮做了什么、现在能不能继续、风险是什么、下一步具体干什么”。
> 什么时候更新：完成一次连续任务后，或风险、阻塞、下一步发生变化时。
> 不要写什么：长期路线图、完整历史、产品介绍、已经稳定的架构决策全文。

## 当前状态

- 当前做到：Project OS 已完成 v1 收口，并把安装产物改为 `core` / `product` / `full` profile 分发
- 当前阻塞：无
- 是否可继续：可直接继续

## 本次已完成

- 已完成 v1 路由、INSTALL FLOW、安装脚本、adapter、模板分层和文档治理
- 已把 `PROJECT.md` / `HANDOFF.md` / `docs/PRODUCT_PLAN.md` 的职责和语言分层写成正式规则
- 已补 `check-runtime.sh`：能检查文档头部说明、模板字段和明显串边界问题
- 已验证：本地安装到全新目录时，目标项目文档会落成干净模板
- 已验证：已安装目录里，Codex 会继续进入 INIT 启动方式选择，不再停在安装总结
- 已验证：远端 GitHub 安装到老项目时会命中 `INSTALL / HYBRID`，保留原代码并备份旧 `README.md`
- 已记录三条维护线：源仓库线、用户模板线、本地增强线
- 已补目标项目轻量 `AGENTS.md` 模板，并调整安装脚本改用模板版 `AGENTS.md`
- 已停止主安装脚本分发 `.claude/settings.local.json` 和本地 `CLAUDE.md`
- 已补模板同步检查：源仓库运行时改动后，可用 `scripts/sync-templates.sh` 同步到 `templates/project`
- 已明确安装器和测试夹具只属于源仓库，不默认安装到用户项目
- 已实现 profile-based 安装：默认非交互为 `core`，终端无 profile 时进入交互选择
- 已调整 `check-runtime.sh`：轻量安装不再被要求带 `.claude/skills`、adapters 和完整 docs

## 不做事项

- 不新增 skill
- 不扩功能
- 不优化 UI
- 不接外部 skill，Project OS 先保持纯内置闭环

## 风险与待确认

- 纯空目录里，如果没有任何预装入口文件，模型不会天然认识 `Project OS`
- profile-based 安装改动尚未 commit / push

## 下一步

1. commit 本轮 profile-based install 收口
2. push 后用远端地址重跑 `core` / `product` / `full` 安装验收
3. 继续观察目标项目是否还觉得安装产物偏重
