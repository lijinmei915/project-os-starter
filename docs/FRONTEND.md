---
layer: knowledge
type: spec
last_verified: 2026-07-21
depends_on: [PRODUCT.md, docs/ARCHITECTURE.md, docs/DESIGN_STANDARDS.md]
teaches: "OmniDesk React Workbench 的技术栈、领域组织、状态边界和样式约定"
use_when: "AI 要修改 OmniDesk 前端、组件、领域 hook、Runtime client 或样式时"
---

# 前端技术说明

> 用途：说明 OmniDesk Workbench 的实际技术栈、目录职责和前端边界。
> 什么时候更新：前端运行时、领域组织、状态边界或核心 UI 依赖变化时。
> 不要写什么：通用框架候选清单、单个组件 API、临时 bug 记录或服务端实现细节。

## 技术栈

- React 19 与 JSX。
- Vite 7 构建；Tauri Desktop 通过同一前端产物加载 Workbench。
- `@tauri-apps/api` 与 plugin-dialog 负责 Desktop command、事件和原生目录选择。
- Radix UI 提供弹窗、菜单、Tabs、Tooltip 等可访问性基础组件；Lucide 提供工具图标。
- xterm 与 fit addon 承担终端渲染；终端生命周期仍由 Runtime 管理。
- 样式使用仓库原生 CSS，`desktop/src/styles.css` 只保持有序组合；`styles/theme.css`、`workspace.css`、`conversation.css`、`terminal.css` 与 `provider-rail.css` 分别拥有领域规则。设计原则和 token 语义见 `docs/DESIGN_STANDARDS.md` 与 `docs/design/tokens.md`。

## 运行边界

Frontend 有两种明确模式：

- **Desktop Runtime**：通过 Tauri command 和事件调用本地 Runtime；可以请求受控任务、Provider、终端和审批操作。
- **浏览器 Preview**：只调用显式登记的读取接口；不得伪造工程写入、终端、Provider 密钥或任务恢复能力。

`desktop/src/lib/runtime-api.js` 是两种模式的基础分流点。领域 client 必须经它或同等受注入的边界访问 Runtime，组件不能直接访问项目文件、密钥或任意 Tauri command。

## 状态与领域组织

前端不使用全局 Redux、远程缓存层或数据库状态复制。状态分为三层：

1. Runtime 是任务、对话、目标、授权、审批和执行证据的唯一业务状态 owner。
2. `desktop/src/lib/` 保存纯投影、client、controller、状态归一化和领域决策；它们必须可独立测试。
3. `desktop/src/components/workbench/` 保存 Workbench surface 与领域 hooks，负责请求生命周期、局部交互状态和渲染，不补偿跨实体事务。

当前主要领域包括 Conversation、Task、Goal、Workspace、Provider、Execution、Terminal 与 Agent Run。一个新增功能应先归属现有领域；只有出现稳定独立的状态、操作和测试边界时才新增目录。

## 目录职责

```txt
desktop/src/
  main.jsx                 # 应用装配、依赖注入和顶层生命周期
  styles.css               # 有序组合的样式入口
  styles/                  # base、theme、workspace、conversation、terminal、provider-rail
  components/ui/           # 无业务状态的基础 UI 原语
  components/workbench/    # 领域 surface、展示组件与领域 hooks
  lib/                     # Runtime client、controller、view model、纯状态逻辑
  conversation-runtime/    # 对话 action、投影和执行衔接
  agent-runtime/           # Node Eval 支撑：受控工具、恢复与 Hermes 契约；不参与产品 Runtime
```

`main.jsx` 只装配领域 controller、生命周期和应用外壳。新增业务状态机、直接 Tauri 调用或大段领域视图不应继续堆入该文件；应先提取到对应 `lib/` 或 `components/workbench/` 领域边界。

`agent-runtime/` 仅被 `desktop/scripts/run-agent-eval-*` 与 Node 回归使用，用来验证受控 Agent 契约、恢复与 Hermes 工具环。生产执行的唯一 owner 是 `desktop/src-tauri/src/runtime/`；不得从 React Workbench 导入或以该目录替代原生 Runtime。

## 组件与样式约定

- 展示组件接收数据与回调，不在内部读取 Runtime 状态。
- 领域 hooks 管理请求、取消、刷新和临时交互；可跨组件复用的决策放入 `lib/`。
- 对工程写入、检查和终端执行，UI 只能呈现 Runtime 返回的阶段和证据，不能自行把 Provider 成功映射为完成。
- 新视觉值优先使用现有 CSS custom properties 与设计 token；避免在业务组件中扩散硬编码色值、间距和阴影。
- 跨领域规则要放入语义最接近的 `styles/` 文件，不能把新的大段规则重新写回 `styles.css`；入口顺序由领域边界测试保护。
- 访问性保持键盘可达、焦点可见、Dialog/Tooltip 使用语义组件，异步状态提供可读文本。

## 验证

前端改动至少运行：

```bash
npm --prefix desktop test
npm --prefix desktop run web:build
```

涉及桌面特有状态、审批或恢复时，补充：

```bash
npm --prefix desktop run test:native
```

完整质量门槛见 `docs/TESTING.md`。
