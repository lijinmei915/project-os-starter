import { FileText } from "lucide-react";
import { buildProjectFactStore } from "../../fact-store";
import { compileCurrentProgressSlots } from "../../current-progress-slot-runtime";
import projectProgressContract from "../../../../schemas/project-progress-contract.v0.1.json";
import { Badge } from "../ui/badge";
import { OverviewPageHeader, OverviewSection } from "./overview-section";

function CurrentProgressSlot({ model, onNavigate, onOpenSource }) {
  const updatedAt = model.evidence.updatedAt
    ? new Date(model.evidence.updatedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;
  const validationMeta = model.validation.meta && model.validation.meta !== "--"
    ? `更新于 ${new Date(model.validation.meta).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
    : model.validation.meta;
  const acceptanceValue = model.acceptance.kind === "missing-required"
    ? <Badge variant="warning">{model.acceptance.label}</Badge>
    : <strong>{model.acceptance.label}</strong>;
  const acceptanceContent = <div className="currentProgressOverviewItem">{acceptanceValue}<span>{model.acceptance.meta}</span></div>;
  const validationValue = model.validation.kind === "empty"
    ? <strong>{model.validation.label}</strong>
    : <Badge>{model.validation.label}</Badge>;
  const nextActionItems = [
    {
      id: `next-${model.nextAction.id}`,
      content: (
        <div className="currentProgressOverviewItem">
          <strong>{model.nextAction.title}</strong>
          <span>{model.nextAction.meta}</span>
        </div>
      ),
      onClick: () => onNavigate?.(model.nextAction.routeId),
    },
  ];
  return (
    <section className="workspaceFacts projectOverviewSurface currentProgressBoard">
      <OverviewPageHeader
        title="项目进展"
        description={model.summary}
        meta={<span>{updatedAt ? `更新于 ${updatedAt}` : "随项目事实自动更新"}</span>}
        sources={<div className="overviewSourceButtons">{model.evidence.files.slice(0, 5).map((source) => <button key={source} type="button" onClick={() => onOpenSource?.(source)}><FileText aria-hidden="true" size={12} /><span>{source}</span></button>)}</div>}
      />
      <OverviewSection
        title="项目位置"
        subtitle="项目目标与当前阶段目标"
        items={[
          { id: "project-goal", label: "项目目标", content: model.projectGoal },
          { id: "milestone", label: "当前里程碑", content: model.milestone },
          {
            id: "goal",
            label: "当前阶段目标",
            content: <div className="currentProgressOverviewItem"><strong>{model.goal.title}</strong><Badge>{model.goal.status}</Badge></div>,
            onClick: () => onNavigate?.(model.goal.routeId),
          },
        ]}
      />
      <OverviewSection
        title="目标阶段"
        subtitle={model.stage.label}
        items={[{
          id: "stage",
          content: <div className="projectProgressStages" aria-label={`当前项目目标阶段：${model.stage.label}`}>{model.stage.steps.map((step) => <div className="projectProgressStage" data-state={step.state} key={step.id}><span aria-hidden="true" /><strong>{step.label}</strong></div>)}</div>,
        }]}
      />
      <OverviewSection
        title="验收与风险"
        subtitle="项目级判断依据"
        items={[
          { id: "acceptance", label: "验收标准", content: acceptanceContent, onClick: model.acceptance.kind === "ready" ? () => onNavigate?.(model.acceptance.routeId) : undefined },
          { id: "validation", label: "最近验收", content: <div className="currentProgressOverviewItem">{validationValue}<span>{validationMeta}</span></div>, onClick: () => onNavigate?.(model.validation.routeId) },
          { id: "risks", label: "项目风险", content: <div className="currentProgressOverviewItem"><strong>{model.risks.count} 项</strong><span>{model.risks.meta}</span></div>, onClick: () => onNavigate?.(model.risks.routeId) },
        ]}
      />
      <OverviewSection title="下一步" subtitle="项目级唯一建议" items={nextActionItems} />
    </section>
  );
}

export function CurrentProgressPanel({ onNavigate, onOpenSource, report, snapshot, tasks = [] }) {
  const store = buildProjectFactStore({ report, snapshot, tasks });
  const descriptors = compileCurrentProgressSlots({
    capabilityManifest: snapshot?.projectCapabilities,
    components: { CurrentProgressSlot },
    contract: projectProgressContract,
    store,
  });
  return descriptors.map((descriptor) => <descriptor.component key={descriptor.id} model={descriptor.props} onNavigate={onNavigate} onOpenSource={onOpenSource} />);
}
