---
layer: knowledge
type: guide
last_verified: 2026-07-21
teaches: "OmniDesk 的本地自检、发布门槛、迁移和常见故障处理"
use_when: "AI 要运行 OmniDesk 自检、排查桌面 Runtime 或指导发布时"
---

# 运行手册

> 用途：记录 OmniDesk 常见操作、发布前检查、迁移恢复和故障处理。
> 什么时候更新：启动方式、检查命令、状态迁移或常见故障变化时。
> 不要写什么：旧安装 profile、模板同步、CLI 评分或跨工具 adapter 操作。

## 本地自检

完整离线回归：

```bash
bash tests/run-tests.sh
```

按改动风险补充：

```bash
npm --prefix desktop test
npm --prefix desktop run web:build
cargo check --manifest-path desktop/src-tauri/Cargo.toml
npm --prefix desktop run test:native
```

`test:native` 是原生窗口 smoke，使用隔离工作区；它不读取密钥、不写入当前工程，也不替代受保护的真实 Provider Eval。

## 发布前检查

1. 运行与风险相称的本地检查，Runtime 或状态变更至少运行 `tests/run-tests.sh`。
2. 运行 `git diff --check`，确认无格式和意外产物。
3. 更新 `PROJECT.md`、`HANDOFF.md`；结构职责变化时运行文档结构与 frontmatter 校验。
4. 真实模型评测只在受保护 `agent-eval` 环境运行，artifact 必须含原始 trace。
5. 经用户确认后再提交或推送。

常规 CI 只验证 Desktop Runtime、文档契约、密钥安全和离线 Eval 基线；不读取 Provider 密钥。

## 状态迁移与恢复

接入外部历史工程时，Runtime 会从 `.project-os` 非破坏性迁移到 `.omnidesk`。迁移会复制、比对、记录 manifest 并激活新命名空间；冲突或符号链接会保留源数据与迁移证据，并阻止 native 状态启用，绝不覆盖源数据或回退为 legacy Runtime 读写。

出现迁移问题时：

1. 保留 `.project-os` 和 `.omnidesk`，不要手工移动或删除目录；只有 Runtime 退役预检全绿且用户明确确认后才允许清理旧目录。
2. 查看 active namespace manifest 和 `.omnidesk/evidence/` 的迁移证据。
3. 重新启动 Desktop Runtime；它会恢复 prepared 事务而不会覆盖冲突文件。
4. 如仍失败，导出最小的无密钥 evidence 后按 Runtime 模块排查。

Agent Run 恢复只会从最近持久化阶段重新请求模型；中断中的 Patch 或检查仍需原审批，Provider 流式 token 不可伪称续传。

## 故障处理

### 桌面端启动失败

```bash
cd desktop
npm install
npm run dev
```

如果端口被占用，停止旧的 Vite 或 Tauri 进程后重试。提示 `cargo` 不存在时，安装 Rust/Cargo 后重新运行。

### 对话或任务停在处理中

查看任务时间线，而不是假设模型已经完成。可取消当前请求；若已有 Patch、审批或检查 checkpoint，恢复会以该 checkpoint 为边界继续。网络中断只能重新发起当前模型阶段，不能恢复到中断前的 token。

### Patch 或检查失败

确认时间线中的授权文件、草稿校验、审批和检查输出。失败检查最多进入两轮修复草稿；每轮 Patch 和检查都需要独立批准。达到上限后保留失败证据，不自动改写工程。

### 真实 Eval 失败

先检查受保护 workflow 的 trace 是否完整；缺 trace 或缺初始失败/授权证据的结果不计入成功率。不要在本机伪造 Provider 成功结果来更新基线。
