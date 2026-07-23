import { FileText } from "lucide-react";
import { resolveWorkspaceGoal } from "../../lib/workspace-context";
import { displayStateRelativePath } from "../../lib/state-namespace";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Notice } from "../ui/notice";
import { OverviewPageHeader, OverviewSection, OverviewTagList } from "./overview-section";

function validationStatusLabel(status) {
  return {
    passed: "已通过",
    failed: "未通过",
    running: "验收中",
    missing: "尚未验收",
  }[status] || "尚未验收";
}

function updatedAtLabel(value, fallback) {
  return value
    ? `更新于 ${new Date(value).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
    : fallback;
}

export function RuleSourceButtons({ onOpenSource, sources }) {
  return (
    <div className="overviewSourceButtons">
      {sources.map((source) => <button key={source} type="button" onClick={() => onOpenSource?.(source)}><FileText aria-hidden="true" size={12} /><span>{displayStateRelativePath(source)}</span></button>)}
    </div>
  );
}

export function AcceptanceCriteriaPanel({ onNavigate, onOpenSource, snapshot }) {
  const validation = snapshot?.goalValidation || {};
  const report = snapshot?.goalValidationReport || {};
  const criteria = Array.isArray(validation.criteria) ? validation.criteria : [];
  const activeGoal = resolveWorkspaceGoal(snapshot || {});
  const goal = validation.goal || activeGoal;
  const criteriaMatchCurrentGoal = Boolean(activeGoal?.id && validation.goal?.id === activeGoal.id);
  const criteriaNeedRelinking = Boolean(criteria.length && activeGoal?.id && !criteriaMatchCurrentGoal);
  const reportStatus = validationStatusLabel(report.status || "missing");
  const sources = [".omnidesk/data/goal-validation.json", "docs/TESTING.md"];
  return (
    <section className="overviewSurface acceptanceCriteriaSurface">
      <OverviewPageHeader title="验收标准" description="集中定义当前目标完成时必须满足的判断条件。" meta={<span>{updatedAtLabel(validation.updatedAt || report.generatedAt, "尚未记录验收时间")}</span>} sources={<RuleSourceButtons onOpenSource={onOpenSource} sources={sources} />} status={<Badge variant={criteriaNeedRelinking ? "warning" : criteria.length ? "success" : "neutral"}>{criteriaNeedRelinking ? "需处理" : criteria.length ? "已登记" : "待确认"}</Badge>} />
      <OverviewSection title="关联目标" subtitle="这些条件判断哪个目标是否完成" actions={<Button size="sm" type="button" variant="ghost" onClick={() => onNavigate?.("current-goal")}>查看当前目标</Button>} items={[{ id: "validation-goal", label: "目标", content: goal?.title || "尚未关联目标" }]} />
      <OverviewSection title="完成判断" subtitle={criteria.length ? `${criteria.length} 项必须满足的条件` : "尚未登记完成判断"} items={[{ id: "criteria", content: criteria.length ? <div className="acceptanceCriteriaList">{criteriaNeedRelinking ? <Notice variant="warning">现有标准关联的是“{goal?.title || "其他目标"}”，当前目标“{activeGoal?.title || "未命名目标"}”仍缺少验收标准。</Notice> : null}{criteria.map((criterion) => <article key={criterion.id || criterion.title}><div><strong>{criterion.title || "未命名条件"}</strong>{criterion.required ? <Badge>必需</Badge> : null}</div><p>{criterion.body || "未填写判断说明。"}</p></article>)}</div> : <Notice variant="info">尚未为当前目标登记验收标准。</Notice> }]} />
      <OverviewSection title="当前结论" subtitle="执行证据和检查详情归验收报告" actions={<Button size="sm" type="button" variant="ghost" onClick={() => onNavigate?.("validation-report")}>查看验收报告</Button>} items={[{ id: "report-status", label: "验收状态", content: <Badge>{reportStatus}</Badge> }]} />
    </section>
  );
}

export function GoalHistoryPanel({ onOpenSource, snapshot }) {
  const goals = Array.isArray(snapshot?.goals?.goals) ? snapshot.goals.goals : [];
  const completedGoals = goals.filter((goal) => goal.status === "done");
  const signoffHistory = Array.isArray(snapshot?.goalSignoffHistory?.entries) ? snapshot.goalSignoffHistory.entries : [];
  const sources = [".omnidesk/data/goals.json", ".omnidesk/data/goal-signoff-history.json"];
  return (
    <section className="overviewSurface goalHistorySurface">
      <OverviewPageHeader title="目标历史" description="保留已经完成目标及其完成确认记录，便于回看和追溯。" meta={<span>{updatedAtLabel(snapshot?.goalSignoffHistory?.updatedAt || snapshot?.goals?.updatedAt, "尚未记录完成时间")}</span>} sources={<RuleSourceButtons onOpenSource={onOpenSource} sources={sources} />} status={<Badge status={completedGoals.length ? "done" : "waiting"}>{completedGoals.length ? "已完成" : "尚未记录"}</Badge>} />
      <OverviewSection title="已完成目标" subtitle={completedGoals.length ? `${completedGoals.length} 个已完成目标` : "尚无已完成目标"} items={[{ id: "completed-goals", content: completedGoals.length ? <div className="goalHistoryList">{completedGoals.map((goal) => <article key={goal.id}><div><strong>{goal.title || "未命名目标"}</strong><Badge>已完成</Badge></div><p>{goal.summary || "未记录目标说明。"}</p></article>)}</div> : <Notice variant="info">完成后的目标会在这里保留历史记录。</Notice> }]} />
      <OverviewSection title="完成确认" subtitle="确认结果来自验收完成记录" items={[{ id: "signoff-history", content: signoffHistory.length ? <div className="goalHistoryList">{signoffHistory.map((entry, index) => <article key={`${entry.goalId || entry.goalTitle}-${entry.signedOffAt || index}`}><div><strong>{entry.goalTitle || "未命名目标"}</strong><Badge>{validationStatusLabel(entry.reportStatus)}</Badge></div><p>{entry.signedOffAt ? `确认于 ${new Date(entry.signedOffAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : "未记录确认时间"}</p></article>)}</div> : <Notice variant="info">完成确认后会在这里沉淀可追溯记录。</Notice> }]} />
    </section>
  );
}

export function ValidationReportPanel({ onOpenSource, snapshot }) {
  const report = snapshot?.goalValidationReport || {};
  const checks = Array.isArray(report.checks) ? report.checks : [];
  const passed = checks.filter((check) => check?.success).length;
  const status = validationStatusLabel(report.status || "missing");
  return (
    <section className="overviewSurface validationReportSurface">
      <OverviewPageHeader title="验收报告" description="给出当前目标最近一次验收的结论、检查结果和后续处理方向。" meta={<span>{updatedAtLabel(report.generatedAt, "尚未生成验收报告")}</span>} sources={<RuleSourceButtons onOpenSource={onOpenSource} sources={[".omnidesk/evidence/goal-validation-report.json"]} />} status={<Badge>{status}</Badge>} />
      <OverviewSection title="当前结论" subtitle="只呈现当前目标的验收判断" items={[{ id: "validation-conclusion", content: report.summary || (checks.length ? `最近验收 ${status}。` : "尚未运行当前目标的验收。") }]} />
      <OverviewSection title="检查结果" subtitle={checks.length ? `${passed}/${checks.length} 项通过` : "尚无检查结果"} items={[{ id: "validation-check-results", content: checks.length ? <OverviewTagList items={checks.map((check) => `${check.success ? "通过" : "失败"} · ${check.label || check.id || "未命名检查"}`)} /> : <Notice variant="info">运行验收后，这里会显示每项检查的结论。</Notice> }]} />
      <OverviewSection title="后续处理" subtitle="失败与运行细节由对应页面承接" items={[{ id: "validation-follow-up", content: report.status === "failed" ? "存在未通过检查。请在任务执行中处理失败项，再重新验收。" : "完整报告产物归工程资产，单次运行过程归运行记录。" }]} />
    </section>
  );
}

export function RunRecordsPanel({ onOpenSource, snapshot }) {
  const runCount = Number(snapshot?.runCount || 0);
  const report = snapshot?.goalValidationReport || {};
  const sources = [".omnidesk/evidence/desktop-summary.md", ".omnidesk/evidence/goal-validation-report.json"];
  return (
    <section className="overviewSurface runRecordsSurface">
      <OverviewPageHeader title="运行记录" description="保留检查、扫描和受控执行的历史证据，供后续追溯。" meta={<span>{report.generatedAt ? `最近验收于 ${new Date(report.generatedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : "尚未记录最近运行"}</span>} sources={<RuleSourceButtons onOpenSource={onOpenSource} sources={sources} />} status={<Badge>{runCount ? "已登记" : "待确认"}</Badge>} />
      <OverviewSection title="执行历史" subtitle="已沉淀的本地运行次数" items={[{ id: "run-history", content: runCount ? `当前项目已记录 ${runCount} 次运行。` : "尚未发现可展示的本地运行记录。" }]} />
      <OverviewSection title="可追溯证据" subtitle="每次运行关联结果和上下文" items={[{ id: "run-evidence", content: "运行记录保留目标、检查命令、输出摘要和最终状态；验收结论仍以验收报告为准。" }]} />
      <OverviewSection title="保留边界" subtitle="历史产物按本地策略自动清理" items={[{ id: "run-retention", content: "运行历史属于本地治理产物；清理策略由 OmniDesk Runtime 维护，交接只沉淀仍与当前项目决策相关的结果。" }]} />
    </section>
  );
}

export function LocalProjectStatePanel({ onOpenSource, report, snapshot }) {
  const summary = report?.summary?.localState || {};
  const domain = (report?.governanceDomains || []).find((item) => item.id === "local-state") || {};
  const statuses = Array.isArray(domain.fileStatuses) ? domain.fileStatuses : [];
  const statusFor = (path) => statuses.find((item) => item.path === path)?.status || "unknown";
  const sources = [...new Set((summary.sources || domain.files || []).filter((path) => path && !path.endsWith("/")))].slice(0, 5);
  const selectedProject = (snapshot?.projects || []).find((project) => project.isCurrent);
  const stateChanged = statusFor(".omnidesk/data/state.json") === "changed";
  return (
    <section className="localStateSurface">
      <OverviewPageHeader description={summary.body || "确认 OmniDesk 是否已认识、登记并可以继续治理当前项目。"} meta={<span>接入信息随项目登记和治理文件变化更新</span>} sources={sources.length ? <RuleSourceButtons onOpenSource={onOpenSource} sources={sources} /> : null} status={<Badge status="done">已接入</Badge>} title="项目接入" />
      <OverviewSection title="接入状态" subtitle="当前工作区是否已登记并可继续使用" items={[{ id: "project", label: "当前项目", content: selectedProject?.name || snapshot?.projectName || "尚未选择" }, { id: "registry", label: "工作区登记", content: <Badge>{statusFor(".omnidesk/data/desktop-registry.json") === "found" ? "已登记" : "待确认"}</Badge> }]} />
      <OverviewSection title="治理准备" subtitle="继续使用 OmniDesk 所需的基础信息" items={[{ id: "state", label: "状态文件", content: stateChanged ? "检测到本地变化，已纳入当前状态" : <Badge>可用</Badge> }, { id: "profile", label: "项目档案", content: <Badge>{snapshot?.projectProfile ? "已识别" : "待识别"}</Badge> }]} />
    </section>
  );
}
