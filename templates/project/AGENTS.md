# AGENTS

> 用途：定义 AI 进入这个项目后的行为规则。
> 什么时候更新：安全边界、文档职责变化时。
> 不要写什么：项目介绍、产品路线、交接流水、个人偏好。

## 体检入口

浏览器打开项目根目录的 `index.html`，选目录或拖 zip，直接看工程完整度报告。

CLI 快速检查：

```bash
bash scripts/check-runtime.sh .
```

## 安全规则

- 不确定意图时，先问再改
- 不覆盖已有文件，除非用户明确确认
- 用户说"只看不改"时，不修改任何文件

## 文档职责

```txt
README.md              -> 项目入口说明
PROJECT.md             -> 当前项目状态
HANDOFF.md             -> 交接上下文
docs/ARCHITECTURE.md   -> 架构和模块职责
docs/ENVIRONMENT.md    -> 环境、依赖、启动
docs/TESTING.md        -> 测试和验收
docs/RUNBOOK.md        -> 常见操作和故障处理
docs/CHANGELOG.md      -> 结构性变更记录
docs/DECISIONS.md      -> 关键决策原因
docs/LESSONS.md        -> 错误复盘
```

写文档前先看 `docs/DOCUMENTATION.md` 确认边界。
