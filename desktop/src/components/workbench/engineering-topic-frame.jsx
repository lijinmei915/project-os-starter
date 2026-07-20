import { Badge } from "../ui/badge";
import { Panel } from "../ui/panel";
import { ReadonlyFilePreview } from "./readonly-file-preview";

export function EngineeringTopicFrame({ children, isCurrentProgressTopic, onPreviewRelatedFile, relatedFilePreview, selectedTopic, selectedTopicGroupLabel, usesDedicatedSurface }) {
  return (
    <Panel className="engineeringFilePreview filePreviewPanel" variant="soft">
      {!usesDedicatedSurface ? <div className={`engineeringFileHeader${isCurrentProgressTopic ? " progressTopicHeader" : ""}`}><div><strong>{selectedTopic.title}</strong><p>{selectedTopic.description}</p></div>{(selectedTopic.routeId || selectedTopic.id) === "workbench-overview" ? null : isCurrentProgressTopic ? <span className="topicBreadcrumb">项目流程 / {selectedTopicGroupLabel}</span> : <Badge>{selectedTopicGroupLabel}</Badge>}</div> : null}
      <div className="topicPreview">
        {children}
        {!usesDedicatedSurface && (selectedTopic.governanceRole || selectedTopic.maturity || selectedTopic.nextAction || selectedTopic.statusSource || selectedTopic.updatesWhen) ? <div className="topicGovernanceMeta">{selectedTopic.governanceRole ? <div><span>治理角色</span><p>{selectedTopic.governanceRole}</p></div> : null}{selectedTopic.maturity ? <div><span>闭环程度</span><p>{selectedTopic.maturity}</p></div> : null}{selectedTopic.statusSource ? <div><span>状态来源</span><code>{selectedTopic.statusSource}</code></div> : null}{selectedTopic.updatesWhen ? <div><span>更新时机</span><p>{selectedTopic.updatesWhen}</p></div> : null}{selectedTopic.nextAction ? <div><span>下一步动作</span><p>{selectedTopic.nextAction}</p></div> : null}</div> : null}
        {!usesDedicatedSurface ? <div className="topicFileList"><strong>关联工程文件</strong><div>{(selectedTopic.relatedFiles || []).map((file) => <button className={`topicFileButton${relatedFilePreview?.path === file ? " active" : ""}`} key={file} type="button" onClick={() => onPreviewRelatedFile(file)}>{file}</button>)}</div></div> : null}
        <ReadonlyFilePreview description="关联工程文件只读预览" file={relatedFilePreview} />
      </div>
    </Panel>
  );
}
