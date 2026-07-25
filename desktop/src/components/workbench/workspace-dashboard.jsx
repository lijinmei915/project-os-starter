import { ArrowRight, Check, MessageSquare, Plus } from "lucide-react";
import { Button } from "../ui/button";
import { taskWorkflowState, workflowStateIsFailure, workflowStates } from "../../lib/workflow-state";

function isNoiseTask(task) {
  const title = String(task?.title || "").trim().replace(/[。！？!?,，\s]/g, "").toLowerCase();
  return /^\d+$/.test(title) || ["hi", "hello", "hey", "你好", "您好", "哈喽", "嗨", "在吗", "在么"].includes(title);
}

export function WorkspaceDashboard({ onNavigate, onRequestProjectAccess, snapshot, taskStatuses, tasks = [] }) {
  const projects = Array.isArray(snapshot?.projects) ? snapshot.projects : [];
  const currentProject = projects.find((project) => project.isCurrent);
  const indexedActiveTasks = projects.reduce((sum, project) => sum + Number(project.activeTaskCount || 0), 0);
  const indexedFailedTasks = projects.reduce((sum, project) => sum + Number(project.failedTaskCount || 0), 0);
  const currentTasks = tasks.filter((task) => !isNoiseTask(task));
  const stateFor = (task) => taskWorkflowState(task, taskStatuses);
  const currentRunningTasks = currentTasks.filter((task) => [workflowStates.working, workflowStates.verifying].includes(stateFor(task)));
  const currentWaitingTasks = currentTasks.filter((task) => [workflowStates.planned, workflowStates.waitingUser, workflowStates.waitingApproval].includes(stateFor(task)));
  const currentFailedTasks = currentTasks.filter((task) => workflowStateIsFailure(stateFor(task)));
  const attentionItems = [
    ...projects.filter((project) => Number(project.failedTaskCount) > 0).map((project) => ({ action: "处理失败任务", body: `${project.failedTaskCount} 个任务失败，需要检查结果并决定是否生成修复任务。`, project, tone: "danger", title: `${project.name} 有执行失败` })),
    ...projects.filter((project) => project.health === "missing").map((project) => ({ action: "重新定位", body: "项目路径已经失效，需要重新定位后才能继续读取和执行。", project, tone: "danger", title: `${project.name} 无法访问` })),
    ...projects.filter((project) => project.health === "partial").map((project) => ({ action: "查看项目", body: "项目缺少关键治理文件，可以先查看扫描结果再决定是否补齐。", project, tone: "warning", title: `${project.name} 需要补充信息` })),
    ...currentWaitingTasks.slice(0, 2).map((task) => ({ action: "继续任务", body: task.plan?.summary || task.description || "任务已准备好，等待确认后继续。", project: currentProject, target: "execution", tone: "info", title: task.title || "任务等待确认" })),
  ].slice(0, 4);
  const recentActivities = projects.filter((project) => project.latestActivityTitle).sort((a, b) => String(b.latestActivityAt || "").localeCompare(String(a.latestActivityAt || ""))).slice(0, 5);
  const switchAndNavigate = (project, target) => {
    if (!project) return;
    if (!project.isCurrent) {
      onNavigate?.({ type: "project", id: project.id, nextTarget: target });
      return;
    }
    if (target) onNavigate?.(target);
  };

  return (
    <div className="workspaceFacts workbenchDashboard portfolioDashboard">
      <section className="portfolioCommandBar">
        <div><span className="portfolioEyebrow">今日工作</span><strong>{attentionItems.length ? `${attentionItems.length} 件事需要处理` : "当前没有阻塞事项"}</strong><p>{projects.length} 个项目已接入，当前在 {currentProject?.name || snapshot?.projectName || "未选择项目"}。</p></div>
        <div className="portfolioCommandActions"><Button type="button" variant="primary" onClick={() => onNavigate?.("conversation")}><MessageSquare size={15} />发起任务</Button><Button type="button" variant="secondary" onClick={onRequestProjectAccess}><Plus size={15} />添加项目</Button></div>
      </section>
      <section className="portfolioAttention" aria-labelledby="portfolio-attention-title">
        <header className="portfolioSectionHeader"><div><strong id="portfolio-attention-title">需要你处理</strong><span>按影响程度排序</span></div><em>{attentionItems.length || "无"}</em></header>
        {attentionItems.length ? <div className="portfolioAttentionList">{attentionItems.map((item) => <article className={`portfolioAttentionItem tone-${item.tone}`} key={`${item.project?.id}-${item.title}`}><span className="portfolioAttentionMarker" aria-hidden="true" /><div><strong>{item.title}</strong><p>{item.body}</p></div><Button type="button" variant="ghost" onClick={() => switchAndNavigate(item.project, item.target)}>{item.action}<ArrowRight size={14} /></Button></article>)}</div> : <div className="portfolioClearState"><Check size={16} /><span>所有项目当前可继续推进，没有等待处理的失败或确认项。</span></div>}
      </section>
      <section className="portfolioProjects">
        <header className="portfolioSectionHeader"><div><strong>项目</strong><span>状态、当前动作与最近进展</span></div><em>{projects.length}</em></header>
        <div className="portfolioProjectList">{projects.map((project) => {
          const needsAttention = ["missing", "partial"].includes(project.health);
          const failedCount = Number(project.failedTaskCount || 0);
          const activeCount = Number(project.activeTaskCount || 0);
          const statusText = failedCount ? `${failedCount} 个失败` : project.health === "missing" ? "路径失效" : project.health === "partial" ? "信息不完整" : activeCount ? `${activeCount} 项进行中` : "可继续推进";
          return <button className={`portfolioProjectRow${project.isCurrent ? " active" : ""}`} key={project.id} type="button" onClick={() => switchAndNavigate(project)}><span className={`projectStatusDot${needsAttention ? ` projectStatusDot-${project.health === "missing" ? "danger" : "warning"}` : " projectStatusDot-empty"}`} aria-hidden="true" /><div><span className="portfolioProjectTitle"><strong>{project.name}</strong>{project.isCurrent ? <em>当前</em> : null}</span><span>{project.latestActivityTitle || project.phase || "已接入工作台"}</span></div><span className={failedCount || needsAttention ? "portfolioProjectState attention" : "portfolioProjectState"}>{statusText}</span><ArrowRight size={15} aria-hidden="true" /></button>;
        })}</div>
      </section>
      <section className="portfolioLowerGrid">
        <div className="portfolioAgentQueue"><header className="portfolioSectionHeader"><div><strong>AI 工作</strong><span>跨项目执行队列</span></div></header><div className="portfolioQueueMetrics"><button type="button" onClick={() => onNavigate?.("execution")}><strong>{indexedActiveTasks || currentRunningTasks.length}</strong><span>进行中</span></button><button type="button" onClick={() => onNavigate?.("execution")}><strong>{currentWaitingTasks.length}</strong><span>等待确认</span></button><button type="button" onClick={() => onNavigate?.("execution-results")}><strong>{indexedFailedTasks || currentFailedTasks.length}</strong><span>执行失败</span></button></div><Button type="button" variant="secondary" onClick={() => onNavigate?.("conversation")}><MessageSquare size={15} />告诉 AI 下一步做什么</Button></div>
        <div className="portfolioRecent"><header className="portfolioSectionHeader"><div><strong>最近活动</strong><span>只保留关键变化</span></div></header>{recentActivities.length ? <div className="portfolioRecentList">{recentActivities.map((project) => <button type="button" key={project.id} onClick={() => switchAndNavigate(project)}><span className="workbenchActivityDot tone-success" aria-hidden="true" /><div><strong>{project.latestActivityTitle}</strong><p>{project.name}</p></div><time>{project.latestActivityAt ? new Date(project.latestActivityAt).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }) : "最近"}</time></button>)}</div> : <p className="portfolioEmptyText">完成任务或运行检查后，关键结果会出现在这里。</p>}</div>
      </section>
    </div>
  );
}
