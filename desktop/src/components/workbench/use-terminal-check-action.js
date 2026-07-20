/** Terminal-owned wrapper for one allowlisted guarded check. */
export function useTerminalCheckAction({
  appendTerminalLog,
  executeGuardedCheckCommand,
  guardedCheckCapability,
  runCheck,
  setRunnerError,
  setTerminalRunningId,
}) {
  const runTerminalCheck = async (checkId) => {
    setRunnerError("");
    setTerminalRunningId(checkId);
    try {
      const check = guardedCheckCapability(checkId);
      const execution = await executeGuardedCheckCommand({ check, runCheck });
      appendTerminalLog(execution.result);
      return !execution.error;
    } finally {
      setTerminalRunningId("");
    }
  };
  return { runTerminalCheck };
}
