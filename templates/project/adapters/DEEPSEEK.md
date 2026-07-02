# DeepSeek Adapter

This file is a DeepSeek adapter for Project OS.

`AGENTS.md` is the single source of truth. This file only translates the shared Project OS rules into DeepSeek-friendly guidance.

中文说明：
这是 DeepSeek 适配文件，不是新的规则源头。
通用规则以 `AGENTS.md` 为准。本文件只负责把通用规则翻译成 DeepSeek 更容易读取的格式。

---

## Required Reading

For project-level work:

1. Read `AGENTS.md`
2. Read `PROJECT.md`
3. Read `HANDOFF.md` if continuing existing work

中文说明：
DeepSeek 进入项目任务时，必须先读通用规则（AGENTS.md），再读项目状态（PROJECT.md），再读交接记录（HANDOFF.md）。

---

## Routing

Classify intent before execution:

```txt
Project OS install/check/upgrade intent -> project-setup / INSTALL
vague product request -> project-setup / CLARIFICATION
new software/system/app request -> project-setup / INIT
analyze / audit only -> project-setup / AUDIT
existing or messy project takeover -> project-setup / HYBRID
design tokens / UI rules -> design-system
specific page/component implementation -> frontend
```

中文说明：
不要跳过路由直接生成代码。先判断意图，再选路由，再动手。

---

## DeepSeek-Specific Notes

**API Key**：通过环境变量 `DEEPSEEK_API_KEY` 读取，不要把真实 key 写进任何文件（参考 `.ai/safety/write-policy.json` 的 forbidden 规则）。

**模型选择建议**：
- `deepseek-chat`：日常问答、代码生成、文档写作
- `deepseek-reasoner`：复杂推理、架构分析、需要 Chain-of-Thought 的任务

**上下文窗口**：DeepSeek-V3 支持 64K token 上下文。本项目知识库（AGENTS.md + HANDOFF.md + registry）约 8K，有充裕空间加载完整上下文。

**与 Claude Code 的差异**：
- DeepSeek 没有原生工具调用集成，建议通过 `kb-workflow.sh` 手动触发流程
- 建议把 `kb-just-ask` / `kb-workflow` 的输出复制到 DeepSeek 对话框，而不是期望它自动调用脚本

---

## Knowledge Base Access

`.ai/rules/` 目录下的规则文件通过软链接或直接路径提供给 DeepSeek：

```bash
# 给 DeepSeek 提供项目上下文的推荐方式
cat .ai/rules/code_structure.md
cat .ai/rules/naming.md
cat docs/LESSONS.md
```

或者直接跑知识问答：
```bash
bash scripts/kb-just-ask.sh "你的问题"
```
把输出粘贴到 DeepSeek 对话框。
