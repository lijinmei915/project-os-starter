# AI Engineering Kit 安装说明

> 用途：回答“怎样把 Project OS 安装到当前项目、会装进什么、安装后怎么用”。
> 什么时候更新：安装步骤、安装脚本、适配器写入方式、安装产物或安装入口变化时。
> 不要写什么：当前项目交接、长期产品路线、无关的业务实现细节。

这个仓库可以作为 AI Engineering Kit 源仓库，被安装到空目录或已有项目里。

目标是让使用者只需要拿到 GitHub 地址，就能检查 AI 工程完整度，并按需补齐文档结构。

源仓库：

```txt
https://github.com/lijinmei915/project-os-starter.git
```

---

## 给 AI 的一句话

```txt
请把 AI Engineering Kit 以 core profile 安装到当前项目：
git clone https://github.com/lijinmei915/project-os-starter.git /tmp/pos && bash /tmp/pos/scripts/install-project-os.sh . --profile core && bash scripts/check-runtime.sh .
```

---

---

## 安装 profiles

AI Engineering Kit 按 profile 分发，源仓库保留完整能力，目标项目只安装需要的部分。

| profile | 适合场景 | 默认安装内容 |
|---------|----------|--------------|
| `core` | 纯工具库、小项目、老项目轻量接入 | `AGENTS.md` / `PROJECT.md` / `HANDOFF.md` / check scripts / score schemas / report template / add docs helper |
| `product` | 需要 AI 工程治理文档 | `core` + README / INSTALL / DOCUMENTATION / NAMING / ARCHITECTURE / ENVIRONMENT / TESTING / RUNBOOK / CHANGELOG / DECISIONS / LESSONS |
| `full` | 需要完整 Project OS runtime | `product` + 设计文档 + `.claude/skills` / commands / hooks + `adapters/` |

常用命令：

```bash
tmp_dir="$(mktemp -d)"
git clone https://github.com/lijinmei915/project-os-starter.git "$tmp_dir/project-os-starter"
bash "$tmp_dir/project-os-starter/scripts/install-project-os.sh" . --profile core
```

把最后一行的 `core` 换成 `product` 或 `full` 即可选择不同 profile。
需要额外能力时，在最后一行追加 `--with-design` / `--with-skills` / `--with-adapters`。

如果在真实终端里不传 `--profile`，脚本会交互式询问项目类型和可选能力。
如果在 AI / CI / 非交互环境里不传 `--profile`，默认使用 `core`，避免卡住。
如果你已经在 `project-os-starter` 源仓库根目录，也可以把脚本路径简写成 `bash scripts/install-project-os.sh`。

---

## 安装到已有项目

如果当前目录已经有项目文件，安装脚本会先备份冲突文件到：

```txt
.project-os/backups/
```

然后再写入 Project OS 文件。

默认 `core` 会安装：

```txt
AGENTS.md
PROJECT.md
HANDOFF.md
.ai/                         (统一 AI 资产目录与规则映射)
scripts/check-runtime.sh
scripts/check-secrets.sh
scripts/check-ai-project.sh
scripts/ai-project.sh
scripts/add-project-docs.sh
scripts/build-project-graph.sh (项目关系图生成)
scripts/check-frontend.sh    (前端规范检查)
scripts/check-backend.sh     (后端规范检查)
scripts/check-testing.sh     (测试/CI 检查)
scripts/check-design.sh      (设计/UI 检查)
scripts/sync-ai-rules.sh     (自动规则映射引擎)
scripts/auto-reflect.sh      (自动反思引擎)
scripts/optimize-rules.sh    (规则修剪引擎)
schemas/ai-project-score.schema.json
schemas/ai-project-score.v0.2.json
schemas/ai-project-report.schema.json
schemas/ai-project-report.v0.1.json
templates/report/ai-project-report.html
templates/project-docs/
```

安装完成后，系统会自动运行 `bash scripts/sync-ai-rules.sh .` 建立初始 AI 规则映射。

中文说明：
核心规则源头是 `AGENTS.md`。
`.ai/` 目录是 Project OS 推荐的跨工具 AI 资产存放点。
`.claude/*` 是当前仓库自带的参考实现，只有 `full` 或 `--with-skills` 才会安装。
`adapters/*` 是面向不同工具的适配层，只有 `full` 或 `--with-adapters` 才会安装。
`.claude/settings.local.json` 是本地增强配置，不作为公开运行时文件安装到目标项目。
`CLAUDE.md` 不由主安装脚本默认写入；如需 Claude 专属入口，请运行 `scripts/install-adapter.sh claude .`。
`README.md` / `PROJECT.md` / `HANDOFF.md` / `docs/CHANGELOG.md` 等会使用干净模板，不会把源仓库自己的状态历史直接带进目标项目。
`scripts/install-project-os.sh` 和 `scripts/create-test-fixtures.sh` 是源仓库维护工具，不会默认安装到目标项目。
轻量安装后如需追加工程文档模板，运行 `bash scripts/add-project-docs.sh . --profile product`，默认不会覆盖已有文档。

---

## 升级已有安装

如果目标项目已经安装过 Project OS，想拉取最新版本：

```bash
git clone https://github.com/lijinmei915/project-os-starter.git /tmp/pos
bash /tmp/pos/scripts/install-project-os.sh . --profile core --upgrade
```

`--upgrade` 模式的行为：

- 目标文件**被用户修改过**（MD5 与安装时不同）→ 跳过，打印 `skip (modified)`
- 目标文件**未修改**或**不存在** → 正常更新

如果想强制覆盖某个文件，先删掉它再跑一次不带 `--upgrade` 的安装。

---

## 安装模型 / 工具适配

Project OS 的通用规则源头是：

```txt
AGENTS.md
```

如果安装时使用了 `--profile full` 或 `--with-adapters`，可以继续安装具体工具入口。

不同工具的专属入口由 adapter 生成：

```txt
adapters/CLAUDE.md -> CLAUDE.md
adapters/CODEX.md  -> CODEX.md
adapters/CURSOR.md -> .cursor/rules/project-os.md
adapters/GEMINI.md -> GEMINI.md
```

安装方式：

```bash
bash scripts/install-adapter.sh claude .
bash scripts/install-adapter.sh codex .
bash scripts/install-adapter.sh cursor .
bash scripts/install-adapter.sh gemini .
```

中文说明：
adapter 不是新的规则源头，只是把 `AGENTS.md` 的职责翻译成对应工具更容易自动读取的文件。
需要哪个工具，就安装哪个 adapter。

---

## 安装后怎么用

检查 AI 工程完整度：

```bash
bash scripts/ai-project.sh report .
```

补齐更多工程文档模板：

```bash
bash scripts/add-project-docs.sh . --profile product
```

只打印分数，不写报告：

```bash
bash scripts/ai-project.sh check .
```

普通用户直接说：

```txt
帮我初始化这个项目
```

或：

```txt
这个老项目有点乱，帮我接管一下
```

高级用户可以输入：

```txt
/os
```

Project OS 会先进入 `INSTALL FLOW`，判断当前目录状态，再决定走：

```txt
INSTALL / INIT
INSTALL / HYBRID
INSTALL / CHECK-UPGRADE
AUDIT
```

---

## 手动安装

如果不想运行脚本，也可以手动复制 core 内容到目标项目：

```txt
AGENTS.md
PROJECT.md
HANDOFF.md
scripts/check-runtime.sh
```

然后执行：

```bash
bash scripts/check-runtime.sh .
```
