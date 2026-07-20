import fs from "node:fs";
import path from "node:path";

export function writeFileAtomicSync(filePath, content) {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, content, { encoding: "utf8", flush: true });
  try {
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    fs.rmSync(tempPath, { force: true });
    throw error;
  }
}

export function recoverDesktopTaskStorage(dir, now = Date.now()) {
  const quarantineDir = path.join(dir, "quarantine");
  const staleBefore = now - 60 * 60 * 1000;
  const result = { quarantined: [], removedTemps: [] };
  let files = [];
  try {
    files = fs.readdirSync(dir);
  } catch {
    return result;
  }
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    if (file.endsWith(".tmp")) {
      try {
        if (fs.statSync(filePath).mtimeMs < staleBefore) {
          fs.rmSync(filePath, { force: true });
          result.removedTemps.push(file);
        }
      } catch {}
      return;
    }
    if (!file.endsWith(".json") || file === "manifest.json") return;
    try {
      JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      fs.mkdirSync(quarantineDir, { recursive: true });
      const target = path.join(quarantineDir, `${file}.${now}.corrupt`);
      try {
        fs.renameSync(filePath, target);
        result.quarantined.push(path.basename(target));
      } catch {}
    }
  });
  return result;
}

export function markTaskPersisted(task, persistedAt, runtime) {
  return {
    ...task,
    requestTrace: task.requestTrace ? {
      ...task.requestTrace,
      outcome: "succeeded",
      persistedAt,
      runtime,
      taskId: task.id,
    } : null,
  };
}
