import { Badge } from "../ui/badge";
import { Notice } from "../ui/notice";

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "未知大小";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ReadonlyFilePreview({ description = "工程文件只读预览", file }) {
  if (!file) return null;
  return (
    <div className="workspaceGovernancePreview">
      <div className="engineeringFileHeader">
        <div>
          <strong>{file.path}</strong>
          <p>{description}</p>
        </div>
        {file.preview ? <Badge>{file.preview.language}</Badge> : null}
      </div>
      {file.loading ? <Notice variant="info">正在读取文件内容...</Notice> : null}
      {file.error ? <Notice variant="danger">{file.error}</Notice> : null}
      {file.preview ? <><div className="engineeringFileMeta"><span>{formatBytes(file.preview.size)}</span>{file.preview.truncated ? <span>已截断</span> : <span>完整预览</span>}</div><pre className="engineeringFileCode">{file.preview.content || "文件为空。"}</pre></> : null}
    </div>
  );
}
