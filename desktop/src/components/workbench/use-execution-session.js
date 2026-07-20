import { useState } from "react";

export function useExecutionSession() {
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState("");
  const [runnerLoadingId, setRunnerLoadingId] = useState("");
  const [runnerError, setRunnerError] = useState("");
  const [patchLoading, setPatchLoading] = useState(false);
  const [patchError, setPatchError] = useState("");
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyError, setApplyError] = useState("");
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [handoffError, setHandoffError] = useState("");
  return { applyError, applyLoading, handoffError, handoffLoading, patchError, patchLoading, planError, planLoading, runnerError, runnerLoadingId, setApplyError, setApplyLoading, setHandoffError, setHandoffLoading, setPatchError, setPatchLoading, setPlanError, setPlanLoading, setRunnerError, setRunnerLoadingId };
}
