---
layer: knowledge
type: guide
last_verified: 2026-07-21
teaches: "OmniDesk 的本地自检、发布门槛和运行故障处理"
use_when: "AI 需要执行 OmniDesk 日常自检、排查运行问题或指导发布时"
---

# 运行手册

> 用途：记录常见操作、检查、发布和故障处理步骤。
> 什么时候更新：安装流程、检查命令、发布步骤、恢复方式或常见问题变化时。
> 不要写什么：长期路线图、详细变更历史、没有复用价值的一次性操作。

本文回答：维护者遇到常见场景时该怎么做。

## 本地自检

```bash
bash tests/run-tests.sh
npm --prefix desktop run test:native
```

预期：

```txt
OmniDesk regression passed
```

旧 Project OS 模板同步、临时安装和 AI 工程报告已冻结，不属于 OmniDesk 发布或故障处理流程。

## 同步模板

旧模板、安装 profile 与 adapter 仅作为迁移源保留。它们不再作为常规发布入口、CI 门槛或新项目接入方案；删除前必须先完成状态迁移和依赖审计。

## 发布前检查

1. 运行本地自检
2. 运行原生窗口 smoke（受支持环境）
3. 查看 `git diff --stat`
4. 更新 `PROJECT.md` / `HANDOFF.md`
5. 如有结构性改动，更新 `docs/CHANGELOG.md`

GitHub 上的 CI 会在 push 和 pull request 时自动运行：

```txt
.github/workflows/ci.yml
```

当前 CI 运行 Desktop Runtime 回归，以及 tracked state/manifest JSON、frontmatter、文档结构和密钥安全。受保护 Agent Eval 另外保留真实 trace artifact；常规 CI 不调用模型密钥。

## 恢复方式

安装脚本覆盖已有文件前会备份到：

```txt
.project-os/backups/
```

如果目标项目误装了过多文件：

1. 查看 `.project-os/backups/`
2. 恢复需要的原文件
3. 删除不需要的新增文档
4. 下次使用 `--profile core` 或按需安装

## 故障处理

### 桌面端启动失败

桌面端 v0.1 直接启动 Tauri：

```bash
cd desktop
npm install
npm run dev
```

`npm run dev` 会先启动 Vite dev server，再启动 Tauri。若 1420 端口被占用，先关闭旧的 `vite` 或 `tauri dev` 进程。

如果提示 `cargo: command not found`，说明本机还没有 Rust / Cargo。先安装 Rust，再重新打开终端运行。

### check-runtime 报模板不同步

运行：

```bash
bash scripts/sync-templates.sh .
bash scripts/check-template-sync.sh . --strict
```

### 完整度分数低

先看 `.project-os/reports/ai-project-report.md`。
需要机器读取时看 `.project-os/reports/ai-project-report.json`。
报告里会有两条分数：

- `AI 工程上下文完整度`：缺规则、状态、架构、测试说明、交接资料时会低
- `AI 工程成熟度`：缺可执行测试、fixtures、CI、评分 schema、报告工程化、发布闭环时会低

上下文完整度低时，优先补：

1. `AGENTS.md`
2. `PROJECT.md`
3. `HANDOFF.md`
4. `docs/TESTING.md`
5. `docs/ENVIRONMENT.md`

如果文件已经存在但仍被判为缺口，通常说明它像空模板：

- 只有标题，没有真实内容
- 只有 `TODO` / `TBD`
- 只有 `未记录` / `暂无记录`
- 只有模板表格，没有具体值
- 还残留 `{{placeholder}}`

这时不要新建同名文件，直接把现有文档补成可读内容。

### 生成项目关系图

运行：

```bash
bash scripts/build-project-graph.sh .
```

输出：

```txt
.project-os/graph/project-graph.json
```

用途：
- 看核心文档、脚本、schema、模板和 AI 资产之间的静态关系
- 判断一个文件是否是 SSOT、是否属于模板层、是否被其他文件引用
- 为后续影响分析提供机器可读输入

关系图是本地生成物，不替代 `docs/ARCHITECTURE.md`、`PROJECT.md` 或人工 review。

### 清理 Project OS 历史产物

多次运行 `scan` / `report` 后，`.project-os/entry-contexts/`、`.project-os/runs/` 和 run logs 会持续增长。
入口脚本和 runner 会自动按默认策略清理，也可以手动执行：

```bash
bash scripts/prune-project-os-artifacts.sh .
```

也可以使用分层清理入口：

```bash
bash scripts/cleanup/prune-project-os-artifacts.sh .
```

调整保留数量：

```bash
PROJECT_OS_RETENTION_ENTRY_CONTEXTS=20 \
PROJECT_OS_RETENTION_RUNS=10 \
bash scripts/prune-project-os-artifacts.sh .
```

如果要给 CI / Gateway / Desktop 捕获一次完整报告而不生成新的 Entry Context，可使用：

```bash
bash scripts/build-project-os-cli.sh
bin/project-os report . --runtime-root . --output report --persist none
```

如果看到 `.project-os/locks/project-os.lock` 存在，说明另一个 Project OS 写入流程正在运行，或上一次进程异常退出。CLI 启动时会按配置里的 `cli.staleLockSeconds` 自动清理超时残留锁，也可以单次覆盖：

```bash
bin/project-os report . --stale-lock-seconds 30
```

如果仍被拒绝，先确认没有 Project OS 进程仍在运行，再删除该 lock 文件重试。

### 初始化全局配置

多仓库复用统一 Project OS 规则时，可以先初始化用户全局配置：

```bash
project-os config init --global
```

如果 CLI 启动时报 `invalid Project OS config`，先检查错误里指出的字段，例如 `cli.defaultPersist`、`cli.defaultOutput` 或 `cli.staleLockSeconds`。需要排查覆盖来源时，用结构化输出查看：

```bash
bin/project-os context . --output json --persist none
```

返回里的 `config.sources` 会标明参数来自 `command-line`、`project-config`、`global-config`、`environment` 或 `default`。

工程成熟度低时，优先补：

1. 可执行测试入口
2. `fixtures/` 或夹具生成脚本
3. 报告 UI 数据源和截图回归
4. 老项目质量识别
5. 更完整的发布版本检查

### 截图回归没有生成图片

`tests/screenshot-regression.sh` 会先做 HTML 报告和组件标记检查。
如果本机或 CI 没有可用浏览器，它会跳过 bitmap 截图和视觉 diff，但仍然验证报告结构。

需要强制本机截图时，可显式指定浏览器：

```bash
CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ALLOW_LOCAL_BROWSER_SCREENSHOT=1 bash tests/screenshot-regression.sh
```

### 更新报告页视觉 baseline

当报告页视觉已经确认可接受后，更新基准图：

```bash
CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
ALLOW_LOCAL_BROWSER_SCREENSHOT=1 \
UPDATE_VISUAL_BASELINE=1 \
bash tests/screenshot-regression.sh
```

会生成：

```txt
tests/screenshots/baseline/ai-project-report-desktop.png
tests/screenshots/baseline/ai-project-report-mobile.png
```

之后再运行：

```bash
CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
ALLOW_LOCAL_BROWSER_SCREENSHOT=1 \
VISUAL_DIFF_STRICT=1 \
bash tests/screenshot-regression.sh
```

如果视觉变化超过 `VISUAL_DIFF_THRESHOLD`，会生成差异图到：

```txt
tests/screenshots/diff/
```

如果 Chrome 截图偶发卡住，可缩短超时时间复跑：

```bash
BROWSER_SCREENSHOT_TIMEOUT=10 \
CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
ALLOW_LOCAL_BROWSER_SCREENSHOT=1 \
bash tests/screenshot-regression.sh
```

### 已有项目文档很多

不要直接覆盖。
先运行：

```bash
bash scripts/check-ai-project.sh . --write-report
```

再按报告决定补哪些文件。
