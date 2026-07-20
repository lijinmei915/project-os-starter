import { Badge } from "../ui/badge";
import { OverviewPageHeader, OverviewSection, OverviewTagList } from "./overview-section";
import { ProjectMemoryPanel } from "./project-memory-panel";

const memorySpecs = {
  "project-facts": { title: "项目事实", description: "集中查看已确认的项目事实、来源与新鲜度。", sources: [".project-os/project-profile.json", ".project-os/workspace-facts.json"], sections: [["事实档案", "项目定位、阶段和技术组成只以已确认事实呈现。"], ["来源依据", "每项事实保留来源文件，推断内容不直接写成项目事实。"], ["新鲜度", "事实变化后需要重新扫描或确认，避免使用过期上下文。"]] },
  "user-preferences": { title: "用户偏好", description: "区分当前项目协作偏好与跨项目长期偏好。", sources: [".project-os/project-profile.json"], sections: [["项目偏好", "记录当前项目的表达方式、协作边界和风险取向。"], ["全局偏好", "跨项目长期有效的偏好不混入当前项目事实。"], ["确认边界", "从对话提取的偏好需要用户确认后才作为稳定偏好使用。"]] },
  "long-term-memory": { title: "长期记忆", description: "沉淀可跨轮次复用的决策、经验和重要上下文。", sources: [".project-os/memory/", "docs/DECISIONS.md", "docs/LESSONS.md"], sections: [["重要决策", "长期有效的取舍归档为决策，不复制当前任务细节。"], ["经验约束", "已经验证的避坑规则沉淀为经验教训。"], ["保留策略", "只有后续工作仍需要的内容进入长期记忆，临时对话不默认沉淀。"]] },
  "conversation-summary": { title: "会话摘要", description: "把对话中的主题、结论和未决事项压缩为可继续的上下文。", sources: [".project-os/conversations/", ".project-os/runs/desktop-tasks/"], sections: [["会话主题", "保留当前讨论的核心主题，短追问可以继承上下文。"], ["已得结论", "已确认的结论、约束和执行结果被归纳，避免重复解释。"], ["未决事项", "尚待确认或尚未执行的事项保留为后续入口，不直接当成已完成。"]] },
};

const assetSpecs = {
  "engineering-files": { title: "工程文件", description: "定位源码入口、目录职责和可只读预览的工程文件。", sources: ["desktop/src/", "desktop/src-tauri/"], sections: [["关键入口", "识别应用、配置和核心模块入口。"], ["目录职责", "按职责理解目录，不把治理文档混入工程代码。"], ["只读预览", "文件内容通过工程文件预览查看，不在资产页直接编辑。"]] },
  "governance-files": { title: "治理文件", description: "查看项目规则、状态和交接文件的健康情况。", sources: ["AGENTS.md", "PROJECT.md", "HANDOFF.md"], sections: [["健康结论", "按正常、变更、缺失和过期识别需要关注的治理文件。"], ["治理文件", "规则、当前状态和交接各自有唯一事实来源。"], ["处理动作", "文件缺口可生成治理任务，进入受控执行与验证链路。"]] },
  "report-artifacts": { title: "报告产物", description: "管理扫描、推荐和验收形成的可追溯报告文件。", sources: [".project-os/reports/", ".project-os/goal-validation-report.json"], sections: [["报告目录", "工程治理报告、文本报告和验收报告分别保存为产物。"], ["证据用途", "报告用于追溯评分、建议和验收，不替代当前验收结论页。"], ["保留边界", "报告是生成产物，长期项目状态和交接仍由对应治理文件维护。"]] },
  "schema-assets": { title: "Schema", description: "管理机器可读结构、版本和校验边界。", sources: ["schemas/", "docs/data/"], sections: [["契约目录", "Schema 与版本化数据定义状态、配置、报告和运行记录的结构。"], ["使用范围", "页面、CLI 与检查脚本复用同一结构化契约，不各自猜测字段。"], ["校验边界", "结构变化需经过 Schema 校验；业务解释仍归对应的治理页面。"]] },
};

const governanceSpecs = {
  "collaboration-boundary": { title: "协作边界", description: "明确用户、Agent 与受控系统各自负责什么。", sources: ["AGENTS.md", "docs/ROUTING.md"], meta: "规则随协作方式和路由变化更新", sections: [["用户负责", "决定方向和承担最终确认", "确认目标、优先级、范围取舍，以及涉及写入、发布或高风险操作的最终决定。"], ["Agent 负责", "在明确范围内推进工作", "读取项目上下文、梳理影响、实现已确认改动、运行对应检查，并同步必要的交接信息。"], ["协作原则", "当前请求优先，保持范围可控", "先处理当前明确事项；不擅自扩展功能，不把内部流程负担转嫁给用户，也不重复询问已有上下文。"]] },
  "execution-permissions": { title: "执行权限", description: "明确哪些操作可以直接进行，哪些必须由你确认。", sources: ["AGENTS.md", "docs/ROUTING.md"], meta: "规则随权限边界和执行方式变化更新", sections: [["可直接进行", "不改变项目外部状态的常规工作", "读取项目文件、分析现状、运行已有检查，以及在你明确要求的范围内完成常规实现和验证。"], ["需要确认", "会改变内容、范围或外部状态的操作", "删除或覆盖文件、发布或推送、批量重构、执行有副作用命令，以及需求不清时的方向选择，都要先征得你的确认。"], ["受控执行", "命令和写入都应有明确边界", "检查和任务执行通过已有白名单与确认链路完成；终端、Patch 和应用结果分别归任务执行的对应页面管理。"]] },
  "documentation-rules": { title: "文档规则", description: "让每类信息只写在它真正负责的文档里。", sources: ["docs/DOCUMENTATION.md", "docs/NAMING.md"], meta: "规则随文档职责、命名和分发边界变化更新", sections: [["文档归属", "按问题选择唯一的事实来源", "AI 行为归 AGENTS.md，当前状态归 PROJECT.md，交接归 HANDOFF.md，长期工程规则归 docs/ 下对应专题文档。"], ["更新规则", "改到职责变化时才同步", "已有事实来源时只引用或摘要；新增或改变 docs 职责时登记文档结构清单并运行对应检查。"], ["分发检查", "模板与源仓库保持一致", "修改会分发给目标项目的模板、Schema 或 UI 后，同步模板并检查漂移；源仓库历史不进入用户项目模板。"]] },
  "system-architecture": { title: "系统架构", description: "说明 OmniDesk 从项目接入到工作台呈现的分层和运行边界。", sources: ["docs/ARCHITECTURE.md", "docs/DESKTOP_APP.md"], meta: "架构职责变化时更新", sections: [["系统分层", "从接入到工作台的六层结构", <OverviewTagList items={["接入层", "元数据层", "核心内核层", "治理服务层", "工作台应用层", "入口层"]} />], ["统一入口", "各入口共享同一种请求上下文", "Web、桌面端、IDE、CLI、CI 与 API 统一产生 Entry Context；入口只做上下文标准化、路由和结果回传，不承载治理业务逻辑。"], ["运行边界", "界面、核心和状态写入各自分工", "工作台负责呈现和发起受控请求；本地 Core / CLI 负责执行与写入；.project-os 状态由受控写入入口维护，前端不直接改机器状态。"]] },
  "data-contracts": { title: "数据契约", description: "定义项目状态、工作面数据与写入校验可以依赖的稳定结构。", sources: ["schemas/project-state.schema.json", "schemas/entry-context.schema.json", "schemas/workspace-slot.schema.json"], meta: "Schema 或字段语义变化时更新", sections: [["状态与事实", "项目治理的结构化事实来源", <OverviewTagList mono items={["project-state", "project-fact-store", "workspace-facts", "conversation"]} />], ["工作面契约", "事实如何变成稳定的页面内容", "项目概览、当前进度与启动方式分别通过页面契约、Selector 和 Slot 约束读取哪些事实、怎样排序，以及何时渲染。"], ["校验与写入", "结构变化必须经过受控通道", "Schema 负责校验字段与版本；桌面端只读渲染本地事实，状态写入统一经 CLI / Core 入口和锁机制完成，避免多端直接覆盖。"]] },
  "code-structure": { title: "实现结构", description: "说明用户界面、本地核心与治理运行时分别放在哪里、负责什么。", sources: ["docs/CODE_STRUCTURE.md", "desktop/src/main.jsx", "desktop/src-tauri/src/main.rs"], meta: "目录职责或模块边界变化时更新", sections: [["工作台界面", "桌面端页面、组件和呈现逻辑", "desktop/src 负责 React 工作台、路由登记、页面 Pattern 和本地 UI primitives；页面只呈现状态并调用受控能力。"], ["本地核心", "设备上的项目读取与受控命令", "desktop/src-tauri 负责本地项目扫描、文件预览、任务持久化和受控命令；它是桌面端与本地工程之间的安全边界。"], ["治理运行时", "跨入口复用的规则、契约和检查能力", "schemas 定义机器可读契约，scripts 与 cli 提供检查和治理入口，docs 维护规则来源；它们不混入页面组件或 Tauri command。"]] },
  "validation-checks": { title: "检查项", description: "定义项目需要验证什么，以及检查由哪条受控链路执行。", sources: ["docs/TESTING.md", "desktop/package.json", "desktop/src-tauri/Cargo.toml"], meta: "测试策略或检查入口变化时更新", sections: [["检查目录", "按风险选择验证类型", <OverviewTagList items={["Desktop 契约", "Web 构建", "Runtime 编译", "工作流回归", "发布证据"]} />], ["执行边界", "检查从受控入口进入", "检查项在任务执行或受控检查链路中运行；本页只说明可验证范围，不执行命令，也不展示终端输出。"], ["覆盖范围", "验证前端、Runtime 与 Agent 执行契约", "对话、任务和权限回归运行 Desktop Node 测试；前端交付运行 Web 构建；本地 Runtime 变更运行 Cargo 检查。"]] },
  "handoff-records": { title: "交接记录", description: "保留下一位协作者继续推进当前项目所需的最小上下文。", sources: ["HANDOFF.md", "PROJECT.md"], meta: "阶段、风险或下一步变化时更新", sections: [["当前接手", "先理解项目处于什么状态", "交接记录集中说明当前阶段、已完成事项、已知风险和继续工作的前置阅读，不重复完整项目介绍。"], ["继续重点", "把下一位协作者带到正确的起点", "只保留近期应继续推进的事项、不可回退的约束和必要验证；长期路线仍归项目规划。"], ["待处理风险", "明确哪些问题仍需留意", "未解决风险、环境限制和待确认点在这里作为接手提示；具体风险详情仍归风险边界。"]] },
  "decision-records": { title: "决策记录", description: "保留影响项目方向或实现边界的重要取舍及其依据。", sources: ["docs/DECISIONS.md", "docs/CHANGELOG.md"], meta: "出现重要取舍或架构决定时更新", sections: [["已做取舍", "记录选择了什么，而不是完整流水", "决策记录只沉淀会影响项目方向、架构边界、分发策略或长期维护方式的选择。"], ["决策原因", "让后来者理解当时为何这样做", "每条重要决策说明问题、备选方案和选择理由，避免后续在缺少上下文时重复讨论同一件事。"], ["影响追溯", "结构变化与决策分别归档", "决策解释为什么；结构性变更记录在 CHANGELOG。任务执行细节和运行日志不进入本页。"]] },
  "lessons-learned": { title: "经验教训", description: "把已经发生的错误转成下一次操作前可以遵守的约束。", sources: ["docs/LESSONS.md"], meta: "出现误删、误改、误判或规则失效时更新", sections: [["错误模式", "记录发生过的具体问题", "只收录造成 bug、误删、误配、误改或验证偏差的真实错误，不把普通进展写成经验教训。"], ["根本原因", "解释错误为什么会发生", "明确是上下文误判、边界不清、工具限制还是测试缺口，避免只记录表面现象。"], ["新增约束", "把复盘变成下一次的可执行规则", "每条教训都要留下可执行的新约束，并在相近操作前主动检查；长期有效规则回归对应治理文档。"]] },
};

function StaticSurface({ className, meta, onOpenSource, renderSourceButtons, spec, type, subtitles }) {
  return <section className={`overviewSurface ${className}`}><OverviewPageHeader title={spec.title} description={spec.description} meta={<span>{meta}</span>} sources={renderSourceButtons(onOpenSource, spec.sources)} status={<Badge>已登记</Badge>} />{spec.sections.map(([title, content], index) => <OverviewSection key={title} title={title} subtitle={subtitles[index]} items={[{ id: `${type}-${index}`, content }]} />)}</section>;
}

export function MemorySurfacePanel({ onOpenSource, renderSourceButtons, type }) {
  if (type === "long-term-memory") return <ProjectMemoryPanel onOpenSource={onOpenSource} renderSourceButtons={renderSourceButtons} />;
  return <StaticSurface className="memorySurface" meta="记忆内容或来源变化时更新" onOpenSource={onOpenSource} renderSourceButtons={renderSourceButtons} spec={memorySpecs[type]} subtitles={["当前可用内容", "来源与边界", "后续使用规则"]} type={type} />;
}

export function AssetSurfacePanel({ onOpenSource, renderSourceButtons, type }) {
  return <StaticSurface className="assetSurface" meta="资产变化或扫描完成时更新" onOpenSource={onOpenSource} renderSourceButtons={renderSourceButtons} spec={assetSpecs[type]} subtitles={["当前资产范围", "职责边界", "后续处理"]} type={type} />;
}

export function GovernanceSurfacePanel({ onOpenSource, renderSourceButtons, type }) {
  const spec = governanceSpecs[type];
  return <section className="overviewSurface"><OverviewPageHeader title={spec.title} description={spec.description} meta={<span>{spec.meta}</span>} sources={renderSourceButtons(onOpenSource, spec.sources)} status={<Badge>{type === "collaboration-boundary" || type === "execution-permissions" || type === "documentation-rules" ? "规则已接入" : "已登记"}</Badge>} />{spec.sections.map(([title, subtitle, content], index) => <OverviewSection key={title} title={title} subtitle={subtitle} items={[{ id: `${type}-${index}`, content }]} />)}</section>;
}
