# 运行手册

> 用途：记录常见操作、检查、发布和故障处理步骤。
> 什么时候更新：安装流程、检查命令、发布步骤、恢复方式或常见问题变化时。
> 不要写什么：长期路线图、详细变更历史、没有复用价值的一次性操作。

本文回答：维护者遇到常见场景时该怎么做。

## 本地自检

```bash
bash tests/run-tests.sh
bash scripts/check-runtime.sh .
bash scripts/ai-project.sh report .
bash scripts/check-template-sync.sh . --strict
bash tests/screenshot-regression.sh
```

预期：

```txt
Result: completed with 0 warning(s).
AI 工程上下文完整度：.../100
AI 工程成熟度：.../100
```

## 同步模板

源仓库 runtime 变化后：

```bash
bash scripts/sync-templates.sh .
bash scripts/check-template-sync.sh . --strict
```

说明：
只同步目标项目需要的 runtime 模板，不同步源仓库自己的交接历史。

## 安装到临时项目验收

优先运行完整回归入口：

```bash
bash tests/run-tests.sh
```

需要手动拆开排查时，再运行：

```bash
tmp_dir="$(mktemp -d)"
mkdir -p "$tmp_dir/core" "$tmp_dir/product" "$tmp_dir/full"

bash scripts/install-project-os.sh "$tmp_dir/core" --profile core
bash "$tmp_dir/core/scripts/check-runtime.sh" "$tmp_dir/core"

bash scripts/install-project-os.sh "$tmp_dir/product" --profile product
bash "$tmp_dir/product/scripts/check-runtime.sh" "$tmp_dir/product"

bash scripts/install-project-os.sh "$tmp_dir/full" --profile full
bash "$tmp_dir/full/scripts/check-runtime.sh" "$tmp_dir/full"
```

## 发布前检查

1. 运行本地自检
2. 试装 `core` / `product` / `full`
3. 查看 `git diff --stat`
4. 更新 `PROJECT.md` / `HANDOFF.md`
5. 如有结构性改动，更新 `docs/CHANGELOG.md`

GitHub 上的 CI 会在 push 和 pull request 时自动运行：

```txt
.github/workflows/ci.yml
```

当前 CI 会执行 shell 语法检查、JSON 解析、`tests/run-tests.sh`、报告生成和 tracked files 变更检查。
如果运行环境提供可用浏览器，截图回归会额外生成报告页截图。
如果仓库存在截图 baseline，截图回归会继续做真实像素 diff。
报告页模板位于 `templates/report/ai-project-report.html`，如果 HTML 报告生成失败，优先检查该模板是否随 `core` profile 一起安装。
跨工具 adapter 分发由 `tests/run-tests.sh` 里的 adapter install 段覆盖。

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
