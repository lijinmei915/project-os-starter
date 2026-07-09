---
layer: knowledge
type: spec
last_verified: 2026-07-09
teaches: "本地开发环境配置、依赖安装、环境变量和外部服务对接"
use_when: "AI 需要帮用户启动项目、排查环境问题、或配置新的外部依赖时"
---

# 环境说明

> 用途：说明本地运行、依赖、环境变量和外部服务。
> 什么时候更新：启动命令、依赖版本、环境变量、外部服务或账号权限变化时。
> 不要写什么：产品路线、交接流水、一次性调试日志。

本文回答：开发者和 AI 在这个项目里怎么把环境跑起来。

## 运行环境

当前源仓库是 Markdown + Bash 脚本项目。

基础依赖：
- `bash`
- `git`
- `find`
- `grep`
- `diff`
- `mktemp`

推荐依赖：
- `rg`：更快的文本搜索
- `node`：运行 `tests/visual-diff.mjs` 做截图像素 diff 自测和对比
- Chrome / Chromium：生成报告页截图和视觉 diff
- Rust / Cargo：运行 `desktop/` Tauri 桌面端壳

## 常用命令

```bash
bash scripts/check-runtime.sh .
bash scripts/check-ai-project.sh . --write-report
bash scripts/check-template-sync.sh .
```

启动桌面端 v0.1：

```bash
cd desktop
npm install
npm run dev
```

桌面端 UI 已使用 Vite + React 组件工程；`npm run dev` 会自动启动 Vite dev server 并打开 Tauri。

如果提示 `cargo: command not found`，先安装 Rust：

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

试装到临时目录：

```bash
tmp_dir="$(mktemp -d)"
mkdir -p "$tmp_dir/target"
bash scripts/install-project-os.sh "$tmp_dir/target" --profile core
bash "$tmp_dir/target/scripts/check-runtime.sh" "$tmp_dir/target"
```

## 环境变量

| 变量 | 用途 |
|------|------|
| `DEEPSEEK_API_KEY` | 可选。接入 DeepSeek 时使用的本地 API key，只能放在本机环境变量或 `.env.local` |
| `PROJECT_OS_SOURCE` | 指定安装源仓库路径；不设置时自动使用脚本所在仓库 |
| `CHROME_BIN` | 指定用于截图回归的 Chrome / Chromium 可执行文件 |
| `ALLOW_LOCAL_BROWSER_SCREENSHOT` | 设置为 `1` 时，允许脚本使用本机 `/Applications/Google Chrome.app` 截图 |
| `UPDATE_VISUAL_BASELINE` | 设置为 `1` 时，刷新 `tests/screenshots/baseline/` 下的视觉基准图 |
| `VISUAL_DIFF_STRICT` | 设置为 `1` 时，缺浏览器、缺 baseline 或视觉差异超阈值都会失败 |
| `VISUAL_DIFF_THRESHOLD` | 视觉 diff 允许的像素变化比例，默认 `0.01` |
| `VISUAL_DIFF_PIXEL_DELTA` | 单像素差异敏感度，默认 `16` |
| `BROWSER_SCREENSHOT_TIMEOUT` | 浏览器截图命令超时时间，默认 `30` 秒 |
| `PROJECT_OS_ALLOW_EMPTY_PROVIDER_KEYS` | 设置为 `1` 时，允许纯本地扫描跳过空 provider key warning |
| `PROJECT_OS_SKIP_SCREENSHOT` | 设置为 `1` 时，截图回归只做 HTML marker 检查，不尝试 bitmap capture |
| `PROJECT_OS_RETENTION_ENTRY_CONTEXTS` | Entry Context 保留数量，默认 `50` |
| `PROJECT_OS_RETENTION_RUNS` | Runner 记录和日志保留数量，默认 `20` |
| `PROJECT_OS_GLOBAL_CONFIG` | 可选。指定用户全局 Project OS 配置文件；不设置时默认读取 `$HOME/.project-os/config.json` |

Project OS 支持两层长期配置：

- 用户全局配置：`$PROJECT_OS_GLOBAL_CONFIG` 指向的文件，或默认 `$HOME/.project-os/config.json`
- 仓库本地配置：当前项目的 `.project-os/config.json`

配置适合放长期稳定的 CLI 默认行为，例如：

- `cli.defaultPersist`: `auto` / `none` / `full`
- `cli.defaultOutput`: `file` / `json` / `both` / `report`
- `cli.lockWrites`: 是否启用 `.project-os/locks/project-os.lock`
- `cli.staleLockSeconds`: 残留锁自动清理阈值，`0` 表示不自动清理
- `retention.entryContexts` / `retention.runs`: 历史产物保留数量

优先级固定为：命令行参数 > 仓库 `.project-os/config.json` > 用户全局 config > `PROJECT_OS_*` 环境变量 > 内置默认值。环境变量仍可用于一次性覆盖或 CI 降噪，但不再作为长期配置的唯一入口。

初始化用户全局配置：

```bash
project-os config init --global
```

也可以显式指定路径：

```bash
project-os config init --global --path "$HOME/.project-os/config.json"
```

CLI 启动时会校验用户全局 config 和仓库 config 的格式；配置错误会立即失败并指出具体字段。结构化输出会包含 `config.values` 和 `config.sources`，用于排查某个参数来自命令行、仓库配置、用户全局配置还是环境变量。

单次覆盖 lock 超时时间：

```bash
bin/project-os report . --stale-lock-seconds 30
```

本地密钥使用方式：

```bash
cp .env.example .env.local
```

然后只在 `.env.local` 中填写真实值。`.env.local`、`.env` 和其他 `.env.*` 文件不能提交到 git。

检查本地密钥是否安全：

```bash
bash scripts/check-secrets.sh .
```

如果只是本地纯扫描，不需要模型 provider，可降噪运行：

```bash
PROJECT_OS_ALLOW_EMPTY_PROVIDER_KEYS=1 bash scripts/check-secrets.sh .
```

## 外部服务

当前源仓库默认不依赖数据库、云服务或第三方 API。
如果后续接入 DeepSeek 或其他模型服务，只允许代码读取环境变量，例如 `DEEPSEEK_API_KEY`，不要把真实 key 写入源码、文档、报告或测试夹具。

## 权限说明

- 安装脚本会写入目标目录。
- 冲突文件会备份到 `.project-os/backups/`。
- 检查报告写入 `.project-os/reports/` 时，应视为生成物。

## 常见问题

### 脚本提示 source and target are the same directory

说明你在源仓库里把源仓库安装到自己。此时不用安装，直接运行：

```bash
bash scripts/check-runtime.sh .
```

### 目标项目已有 README

默认推荐使用 `core` profile，避免覆盖已有 `README.md`。
如果需要治理文档，先运行完整度检查，再决定是否补齐。
