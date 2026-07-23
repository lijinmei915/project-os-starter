import { useState } from "react";
import { ArrowRight, FileText } from "lucide-react";
import { goalStatusLabelText } from "../../lib/goal-presentation";
import { resolveWorkspaceGoal } from "../../lib/workspace-context";
import { OverviewPageHeader, OverviewSection } from "./overview-section";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Dialog, DialogClose, DialogContent } from "../ui/dialog";
import { Notice } from "../ui/notice";

function currentGoalNextAction(goal) {
  if (!goal) return { detail: "先建立一个可验收的当前目标。", routeId: "current-goal", title: "建立当前目标" };
  if (goal.status === "draft") return { detail: "确认范围后，才能进入任务拆解。", routeId: "current-goal", title: "确认当前目标" };
  if (goal.status === "planned") return { detail: "先生成并确认任务拆解草案，再进入任务执行。", routeId: "current-goal", title: "生成任务拆解" };
  if (goal.status === "pending-confirm") return { detail: "验收已结束，确认完成前请先核对验收标准。", routeId: "acceptance-criteria", title: "核对验收标准" };
  if (goal.status === "failed") return { detail: "先处理验收失败项，再重新判断目标状态。", routeId: "validation-report", title: "处理验收失败项" };
  if (goal.status === "done") return { detail: "当前目标已完成，后续记录归入目标历史。", routeId: "goal-history", title: "查看目标历史" };
  return { detail: "在任务中推进关联任务，完成后进入验收标准判断。", routeId: "task-list", title: "继续推进关联任务" };
}

export function CurrentGoalPanel({ decomposingGoal, onConfirmDecomposition, onGenerateDecomposition, onNavigate, onOpenSource, snapshot }) {
  const [decompositionOpen, setDecompositionOpen] = useState(false);
  const [draftItems, setDraftItems] = useState([]);
  const [draftError, setDraftError] = useState("");
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const goal = resolveWorkspaceGoal(snapshot || {});
  const updatedAt = goal?.updatedAt || goal?.confirmedAt || goal?.createdAt;
  const updatedLabel = updatedAt
    ? `更新于 ${new Date(updatedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
    : "尚未记录更新时间";
  const status = goal ? goalStatusLabelText(goal.status) : "待建立";
  const nextAction = currentGoalNextAction(goal);
  const sources = [".omnidesk/data/goals.json", "PROJECT.md", "HANDOFF.md"];

  return (
    <section className="overviewSurface currentGoalSurface">
      <OverviewPageHeader
        title="当前阶段目标"
        description="集中查看当前项目目标下的阶段目标、范围边界与唯一下一步。"
        meta={<span>{updatedLabel}</span>}
        sources={<div className="overviewSourceButtons">{sources.map((source) => <button key={source} type="button" onClick={() => onOpenSource?.(source)}><FileText aria-hidden="true" size={12} /><span>{source}</span></button>)}</div>}
        status={<Badge>{status}</Badge>}
      />
      <OverviewSection
        title="目标定义"
        subtitle="本阶段要达成什么"
        actions={<Button size="sm" type="button" variant="ghost" onClick={() => onNavigate?.("acceptance-criteria")}>查看验收标准</Button>}
        items={[{ id: "goal-title", label: "目标", content: goal?.title || "尚未建立当前目标" }]}
      />
      <OverviewSection title="范围边界" subtitle="本目标覆盖什么" items={[{ id: "goal-scope", content: goal?.summary || "尚未填写目标范围说明。" }]} />
      <OverviewSection
        title="下一步"
        subtitle="由当前目标状态决定"
        items={[{
          id: "goal-next-action",
          content: <div className="currentProgressOverviewItem"><strong>{nextAction.title}</strong><span>{nextAction.detail}</span>{goal?.status === "planned" ? <Button size="sm" type="button" variant="ghost" onClick={() => setDecompositionOpen(true)}>查看拆解草案<ArrowRight aria-hidden="true" size={14} /></Button> : null}</div>,
          onClick: goal?.status === "planned" ? undefined : () => onNavigate?.(nextAction.routeId),
        }]}
      />
      <Dialog open={decompositionOpen} onOpenChange={setDecompositionOpen}>
        <DialogContent title="任务拆解" description="只有模型成功生成草案后，才能确认并写入任务。">
          {draftItems.length ? <div className="goalHistoryList">{draftItems.map((item) => <article key={item.id}><strong>{item.title}</strong><p>{item.detail}</p></article>)}</div> : <Notice variant="info">尚未生成草案。模型不可用或调用失败时不会创建任务。</Notice>}
          {draftError ? <Notice variant="danger">{draftError}</Notice> : null}
          <div className="goalConfirmActions">
            <DialogClose asChild><Button size="sm" type="button" variant="default">取消</Button></DialogClose>
            {!draftItems.length ? <Button size="sm" type="button" variant="primary" disabled={generatingDraft} onClick={async () => {
              setGeneratingDraft(true); setDraftError("");
              try { setDraftItems(await onGenerateDecomposition?.(goal) || []); } catch (error) { setDraftError(error instanceof Error ? error.message : String(error)); } finally { setGeneratingDraft(false); }
            }}>{generatingDraft ? "生成中" : "生成模型草案"}</Button> : <Button size="sm" type="button" variant="primary" disabled={decomposingGoal} onClick={async () => {
              const completed = await onConfirmDecomposition?.(goal, draftItems);
              if (completed) setDecompositionOpen(false);
            }}>{decomposingGoal ? "确认中" : "确认拆解"}</Button>}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
