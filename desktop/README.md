---
layer: knowledge
type: guide
last_verified: 2026-07-21
depends_on: [../docs/ARCHITECTURE.md, ../docs/ENVIRONMENT.md]
teaches: "OmniDesk Desktop Runtime 的启动方式、依赖和执行边界"
use_when: "需要运行、调试或继续实现桌面端 Runtime 时"
---

# OmniDesk Desktop

> 用途：记录桌面端 Runtime 的运行方式和当前边界。
> 什么时候更新：桌面端启动方式、依赖、Tauri 配置或 Local Agent Core 接入方式变化时。
> 不要写什么：产品路线全文、一次性调试日志、模型密钥。

## 当前状态

OmniDesk Desktop 是唯一产品 Runtime：

```txt
Tauri shell -> React Workbench -> Local Agent Runtime
```

模型、工程写入和检查全部经 Runtime 的授权、审批与证据边界执行；浏览器 Preview 只读。

## 依赖

- Node.js
- npm
- Rust / Cargo
- Tauri 系统依赖

macOS 上通常先安装 Rust：

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

## 启动

进入桌面端目录：

```bash
cd desktop
npm install
npm run dev
```

## 重新生成应用图标

`APP_ICON.svg` 是跨平台 bundle 图标的唯一源文件。修改它后运行：

```bash
npm run icons:generate
git diff -- src-tauri/icons
```

该命令会生成 macOS、Windows、iOS 和 Android 所需的图标资源；提交前应审阅生成 diff。`src-tauri/gen/schemas/` 由 Tauri 根据当前 capability 和配置生成，不能手工编辑。

## 边界

- 桌面端 dev 模式读取 Vite dev server `http://127.0.0.1:1420`
- UI 入口在 `src/main.jsx`
- 样式入口在 `src/styles.css`
- `desktop/src-tauri/src/runtime/` 是状态、权限、Provider、Patch、检查与恢复的唯一 owner
- `desktop/evals/` 保存发布基线；真实 Provider Eval 只在受保护环境运行
