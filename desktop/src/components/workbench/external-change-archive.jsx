import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Notice } from "../ui/notice";

function archiveTime(value) {
  const numeric = Number(value);
  const date = Number.isFinite(numeric) ? new Date(numeric) : new Date(value);
  return Number.isNaN(date.getTime()) ? "时间未知" : date.toLocaleString("zh-CN");
}

export function ExternalChangeArchive({ archive, onOpenTask }) {
  const entries = Array.isArray(archive?.entries) ? [...archive.entries].reverse() : [];
  if (!entries.length) return null;

  return (
    <section className="agentPatchItem externalChangeArchive" aria-label="外部工作归档">
      <div className="agentPatchItemHeader">
        <div>
          <strong>外部工作归档</strong>
          <span>其他开发工具造成的项目变动会自动收进这里，不需要审批。</span>
        </div>
        <Badge status="planned">{entries.length} 条</Badge>
      </div>
      <Notice variant="info">归档只代表“项目发生过变动”；运行过检查后，才能显示为已验证。</Notice>
      <div className="agentTopicList">
        {entries.slice(0, 10).map((entry) => (
          <article className="agentTopicStatusLine" key={entry.id || `${entry.detectedAt}-${entry.changedFileCount}`}>
            <strong>{entry.linkedTaskTitle || "未关联任务的外部改动"}</strong>
            <span>{entry.changedFileCount || 0} 个文件 · {archiveTime(entry.detectedAt)}</span>
            <span>{entry.verificationStatus === "verified" ? "已验证" : "已归档，尚未验证"}</span>
            <details>
              <summary>查看变动文件</summary>
              <ul>
                {(entry.changedFiles || []).map((file) => <li key={file}><code>{file}</code></li>)}
              </ul>
              {entry.filesTruncated ? <p>文件较多，这里只显示前 30 个。</p> : null}
            </details>
            {entry.linkedTaskId ? (
              <Button size="sm" type="button" variant="ghost" onClick={() => onOpenTask?.(entry.linkedTaskId)}>
                打开关联任务
              </Button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
