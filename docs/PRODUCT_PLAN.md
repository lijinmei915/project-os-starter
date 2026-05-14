# Project OS 产品规划

> 用途：回答“这个产品分几阶段演进、当前阶段做什么、下一阶段再做什么”。
> 什么时候更新：阶段定义、阶段目标、成功标准或中长期路线变化时。
> 不要写什么：当前回合交接、具体改了哪些文件、一次性阻塞或临时待办。

## 产品愿景

把 AI 驱动开发流程收口成一个可复制、可验证、可交接的 Project OS。

它的目标不是直接生成某个业务产品，而是先稳定 AI 如何理解项目、分流任务、遵守规则、记录状态和接受测试。

---

## 当前阶段判断

当前处于：

```txt
v1 可安装 runtime 收口期
```

当前策略：

```txt
先把“能稳定安装、能稳定分流、能稳定交接”做扎实，
再优化分发体验，
最后再考虑做成工具原生 package / skill。
```

---

## 阶段路线

### v1：可安装 runtime

目标：

- 让 Project OS 能作为一个仓库安装包稳定给别人用

核心交付物：

- `INSTALL.md`
- `scripts/install-project-os.sh`
- `AGENTS.md`
- `adapters/*`
- `templates/project/*`
- `templates/global/*`
- `scripts/check-runtime.sh`

成功标准：

- 能安装到空目录
- 能接入老项目
- 不复制源仓库自己的历史文档
- 安装后 Claude / Codex / Cursor / Gemini 都能读取规则
- `check-runtime.sh` 在源仓库和目标项目里都通过

本阶段不做：

- 不接 Radix / shadcn / ai-components
- 不做平台原生 skill 发布
- 不做自动自进化
- 不追求空目录一句话让所有模型天然认识 `Project OS`

### v1.5：分发体验优化 + 减少 AI 幻觉

目标：

- 让别人更容易安装、理解和复测 Project OS
- 给 AI 提供机器可读的结构化锚点，减少读 markdown 时的幻觉

核心交付物：

- 更短的 `README.md` / `INSTALL.md` 安装文案
- 发给 AI 的最短安装提示
- GitHub 远端版本验收
- 更轻的 `PROJECT.md` / `HANDOFF.md`
- 给 `project.json`（已有）补 JSON Schema，定义字段契约
- 核心状态文档（`PROJECT.md` / `HANDOFF.md`）有对应 typed schema：markdown 是给人看的展示层，schema 是给 AI 读的数据层

成功标准：

- 拿到 GitHub 地址后，别人能按最短提示完成安装
- 远端安装结果与本地安装结果一致
- 人工验收步骤足够短，不需要反复解释
- AI 填写状态文档时有字段范围约束，不自由发挥
- `check-runtime.sh` 能从 grep 升级为 schema 验证关键字段

本阶段不做：

- 不改核心路由模型
- 不引入组件库
- 不扩更多 skill
- 不替换 markdown（schema 与 markdown 并存，不是替代关系）

### v2：工具原生适配包

目标：

- 让 Project OS 不只是仓库安装包，而是更接近真正的工具适配 package

核心交付物：

- 更正式的版本机制
- 更稳定的 adapter 写入与升级流程
- Claude / Codex / Cursor 的原生接入方案

成功标准：

- 不靠长提示词也能稳定完成安装入口
- 工具能更直接识别 Project OS 的入口约定
- 升级和修复不需要手工重装整包

本阶段不做：

- 不做 marketplace 级分发
- 不追求所有平台一次打通

### v3：可发现 skill / package + 外部系统集成

目标：

- 让 Project OS 逐步从”仓库 + 安装脚本”升级为”更容易被模型和工具发现的能力包”
- 把 `adapters/` 扩展成两类：AI 工具 adapter（现有）+ 外部系统 adapter（新增）
- 支持一条命令从读需求到部署的全流程：AI 读 Jira/Confluence US → 拆 task → 建分支 → 开发 → 自动化测试 → Sonar 安全扫描 → 合并部署

核心交付物：

- package / metadata 设计
- 更正式的安装入口协议
- 可发现的命令 / skill 注册机制
- 外部系统 adapter 框架：Jira / Confluence（需求源）、GitHub Actions / Jenkins（执行层）、SonarQube（质量门禁）
- INIT flow 支持接收 US 作为输入，自动拆解为 task 并进入开发流程

成功标准：

- 纯空目录里也更容易通过短提示进入正确流程
- 平台能先认识 Project OS，再执行安装或接管
- `--with-ci` 安装选项可写入 GitHub Actions workflow 模板
- AI 能根据 US 自主完成从建分支到提 PR 的完整开发闭环

本阶段不做（留到 v4+）：

- 不追求全平台一次打通
- 不做完全无人值守的自动部署（需保留人工审批节点）

---

## 为什么这样排

- 当前最容易出错的是入口理解和路由，而不是组件实现
- 如果太早接组件库，会把问题从入口不稳扩散到 UI、依赖、构建和设计规则
- 先把 runtime 做稳，后面的 package 化才有落点
- 先解决“能不能稳定用”，再解决“用起来是不是足够爽”

---

## 当前优先级

1. 用远端地址重做空目录 / 老项目 / 已安装项目验收
2. 收紧 `README.md` / `INSTALL.md` 的最短安装文案
3. 压瘦根目录 `PROJECT.md` / `HANDOFF.md`

---

## 待确认问题

- 远端安装体验是否已经足够短
- `PROJECT.md` / `HANDOFF.md` 是否还需要继续压缩
- 组件层未来是先接 Radix、shadcn，还是先做更薄的 `ai-components`
