export function StatusBar({ snapshot, source }) {
  const preview = source !== "tauri";
  return (
    <footer className="bottombar">
      <span title={preview ? "仅可讨论、查看计划和运行证据；终端、检查与文件写入必须在桌面 App 中执行。" : "本地 Agent Core 可在独立审批后执行检查和受控文件修改。"}>
        {preview ? "浏览器预览 · 不执行终端、检查或文件写入" : "桌面端 · 受控执行"}
      </span>
      <span className="safe">本地安全</span>
      <span>{snapshot.projectName}</span>
    </footer>
  );
}
