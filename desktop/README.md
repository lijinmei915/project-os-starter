---
layer: knowledge
type: guide
last_verified: 2026-07-01
depends_on: [../docs/DESKTOP_APP.md]
teaches: "OmniDesk Desktop v0.1 的启动方式、依赖和当前边界"
use_when: "需要运行、调试或继续实现桌面端 Tauri 壳时"
---

# OmniDesk Desktop

> 用途：记录桌面端 v0.1 壳的运行方式和当前边界。
> 什么时候更新：桌面端启动方式、依赖、Tauri 配置或 Local Agent Core 接入方式变化时。
> 不要写什么：产品路线全文、一次性调试日志、模型密钥。

## 当前状态

v0.1 只做桌面壳和组件化工作台 UI：

```txt
Tauri shell -> Vite + React components -> 后续再接 Local Agent Core
```

当前不接模型、不写文件、不执行项目命令。

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

## 边界

- 桌面端 dev 模式读取 Vite dev server `http://127.0.0.1:1420`
- UI 入口在 `src/main.jsx`
- 样式入口在 `src/styles.css`
- 桌面端 build 暂不作为交付目标
- 模型配置、项目 registry、runner、diff review 后续接入 Local Agent Core
