import React from "react";
import { Button } from "../ui/button";
import { Dialog, DialogClose, DialogContent } from "../ui/dialog";
import { Field } from "../ui/field";
import { Input } from "../ui/input";
import { Notice } from "../ui/notice";
import { projectAccessChoices, projectAccessPresentation } from "../../lib/project-access-presentation";

export function ProjectAccessDialogs({ state, onSelectEngineeringFile }) {
  const {
    accessDialogOpen, accessSettingsProject, changeProjectAccess, confirmControlledProjectAccess,
    confirmProjectAccess, connectedProjectAccess, controlledConfirmOpen, openExistingProject,
    projectScan, renameName, renameProject, selectedProjectAccessMode, setAccessSettingsProject,
    setControlledConfirmOpen, setName, setProjectAccessDialogOpen, setRenameProject,
    setSelectedProjectAccessMode, submitRename,
  } = state;
  const access = (mode) => projectAccessPresentation(mode);
  const existingAccess = projectScan?.existingProject ? access(projectScan.existingProject.accessMode) : null;
  return <>
    <Dialog open={Boolean(renameProject)} onOpenChange={(open) => { if (!open) { setRenameProject(null); setName(""); } }}>
      <DialogContent title="修改显示名称" description="这里只修改 OmniDesk 工作台里的显示名称，不会重命名本地文件夹。">
        <form className="projectRenameForm" onSubmit={submitRename}><Field label="项目名称" htmlFor="project-rename-input"><Input autoFocus id="project-rename-input" maxLength={60} onChange={(event) => setName(event.target.value)} placeholder="输入项目名称" value={renameName} /></Field><div className="projectRenameActions"><DialogClose asChild><Button type="button" variant="ghost">取消</Button></DialogClose><Button disabled={!renameName.trim()} type="submit" variant="primary">保存</Button></div></form>
      </DialogContent>
    </Dialog>
    <Dialog open={accessDialogOpen} onOpenChange={setProjectAccessDialogOpen}>
      <DialogContent title={connectedProjectAccess ? "项目已接入" : projectScan?.existingProject ? `“${projectScan.project?.name || "项目"}”已接入` : projectScan?.project?.name ? `接入“${projectScan.project.name}”` : "接入项目"} description={connectedProjectAccess ? `“${connectedProjectAccess.name}”已成为当前项目。` : existingAccess ? `当前权限：${existingAccess.label}。` : "请选择接入权限。"}>
        {connectedProjectAccess ? <div className="projectConnectedResult"><div className="projectAccessSettingsSummary"><strong>{access(connectedProjectAccess.accessMode).label}</strong><span>{access(connectedProjectAccess.accessMode).description}</span></div><div className="projectConnectedActions"><Button onClick={() => { setProjectAccessDialogOpen(false); onSelectEngineeringFile?.({ description: "项目名称、用途和阶段。", group: "项目流程", id: "project-identity", path: "project-identity", title: "项目概览", virtual: true }); }} type="button" variant="primary">查看项目概览</Button><Button onClick={() => { setProjectAccessDialogOpen(false); window.dispatchEvent(new Event("omnidesk:open-conversation")); }} type="button" variant="outline">发起项目讨论</Button></div></div> : <>
          {projectScan?.loading ? <Notice variant="muted">正在检查项目。</Notice> : projectScan?.error ? <Notice variant="danger">{projectScan.error}</Notice> : projectScan ? <div className="projectScanResult"><div className="projectScanConclusion"><strong>检查完成</strong><span>请选择接入权限。</span></div></div> : null}
          {!projectScan?.existingProject ? <fieldset className="projectAccessFieldset" disabled={projectScan?.loading || Boolean(projectScan?.error) || !projectScan}><legend>选择接入权限</legend><div className="projectAccessChoices" role="group" aria-label="选择接入权限">{projectAccessChoices.map(({ description, label, mode }) => <button aria-pressed={selectedProjectAccessMode === mode} className={`projectAccessChoice${selectedProjectAccessMode === mode ? " selected" : ""}`} key={mode} onClick={() => setSelectedProjectAccessMode(mode)} type="button"><span className="projectAccessChoiceTitle">{label}</span><small>{description}</small></button>)}</div></fieldset> : null}
          <div className="projectAccessActions"><DialogClose asChild><Button type="button" variant="ghost">取消</Button></DialogClose>{projectScan?.existingProject ? <Button onClick={openExistingProject} type="button" variant="primary">{projectScan.existingProject.isCurrent ? "继续使用此项目" : "切换到此项目"}</Button> : <Button disabled={projectScan?.loading || Boolean(projectScan?.error) || !projectScan} onClick={() => selectedProjectAccessMode === "controlled" ? setControlledConfirmOpen(true) : confirmProjectAccess(selectedProjectAccessMode)} type="button" variant="primary">{selectedProjectAccessMode === "browse" ? "以仅浏览方式接入" : selectedProjectAccessMode === "governed" ? "接入并管理记录" : "接入并允许受控修改"}</Button>}</div>
        </>}
      </DialogContent>
    </Dialog>
    <Dialog open={controlledConfirmOpen} onOpenChange={setControlledConfirmOpen}><DialogContent title="允许受控修改？" description="之后每次修改工程文件前都会展示变更，并等待你的确认。"><Notice variant="info">这项权限允许应用已确认的文件修改并运行验证；不会自动提交或发布。</Notice><div className="projectRenameActions"><DialogClose asChild><Button type="button" variant="ghost">返回</Button></DialogClose><Button onClick={confirmControlledProjectAccess} type="button" variant="primary">确认并接入</Button></div></DialogContent></Dialog>
    <Dialog open={Boolean(accessSettingsProject)} onOpenChange={(open) => { if (!open) setAccessSettingsProject(null); }}><DialogContent title="接入权限" description={accessSettingsProject ? `“${accessSettingsProject.name}”当前允许的操作范围。` : "查看项目接入权限。"}>{accessSettingsProject ? <div className="projectAccessSettingsSummary"><strong>{access(accessSettingsProject.accessMode).label}</strong><span>{access(accessSettingsProject.accessMode).description}</span></div> : null}<div className="projectRenameActions"><DialogClose asChild><Button type="button" variant="ghost">关闭</Button></DialogClose>{accessSettingsProject ? projectAccessChoices.filter(({ mode }) => mode !== accessSettingsProject.accessMode).map(({ label, mode }) => <Button key={mode} onClick={() => changeProjectAccess(mode)} type="button" variant="outline">改为{label}</Button>) : null}</div></DialogContent></Dialog>
  </>;
}
