import { useCallback, useEffect, useRef, useState } from "react";
import { projectExecutionEvent } from "../../conversation-runtime";
import { listenRuntimeConversationEvents } from "../../lib/desktop-conversation-client";
import { isRequestRunning, settleRequest } from "../../lib/request-lifecycle";
import { recordPlanComposition, recordPlanPersistence, recordPlanPhase, recordPlanTool } from "../../lib/conversation-plan-activity";

function planToolLabel(payload = {}, completed = false) {
  const name = String(payload.details?.name || "");
  const path = String(payload.details?.path || "");
  if (name === "read_file") return `${completed ? "已读取" : "正在读取"} ${path || "相关文件"}`;
  if (name === "search_project") return completed ? "已找到相关实现" : "正在查找相关实现";
  if (name === "list_files") return completed ? "已查看项目文件" : "正在查看项目文件";
  if (name === "git_status") return completed ? "已确认项目改动状态" : "正在确认项目改动状态";
  return completed ? "已取得项目上下文" : "正在查看项目上下文";
}

export function useConversationRequestState({ cancelRuntimeRequest, chatTurns, initialLoadingEvents = [], onChatTurnsChange, onStopPlan }) {
  const [pendingTurn, setPendingTurn] = useState(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatStartedAt, setChatStartedAt] = useState(Date.now());
  const [chatLoadingLabel, setChatLoadingLabel] = useState("组织回答");
  const [chatLoadingEvents, setChatLoadingEvents] = useState(() => initialLoadingEvents);
  const [streamingReply, setStreamingReplyState] = useState("");
  const streamingReplyRef = useRef("");
  const activeRequestRef = useRef(null);
  const lastSubmissionRef = useRef({ at: 0, key: "" });

  useEffect(() => {
    let disposed = false;
    let unlisten = () => {};
    let receivedChars = 0;
    void listenRuntimeConversationEvents((event) => {
      const payload = event?.payload || {};
      if (!isRequestRunning(activeRequestRef, payload.requestId)) return;
      if (payload.type === "model.started") {
        receivedChars = 0;
        setChatLoadingLabel("正在连接模型");
      }
      if (payload.type === "request.retrying") {
        setChatLoadingLabel("网络波动，正在重试");
      }
      if (payload.type === "request.queued") {
        const position = Math.max(1, Number(payload.payload?.position || 1));
        setChatLoadingLabel(`任务已排队（第 ${position} 位）`);
      }
      if (payload.type === "request.started") {
        setChatLoadingLabel("正在读取项目");
      }
      if (payload.type === "agent.tool-requested") {
        setChatLoadingLabel(planToolLabel(payload.payload, false));
      }
      if (payload.type === "agent.tool-completed") {
        setChatLoadingLabel(planToolLabel(payload.payload, true));
      }
      if (payload.type === "plan.started") {
        setChatLoadingLabel("正在分析项目");
      }
      if (payload.type === "plan.phase") {
        const vision = payload.payload?.phase === "vision-context";
        setChatLoadingLabel(vision ? (payload.status === "succeeded" ? "已取得图片线索，正在读取源码" : "正在理解图片") : "正在理解任务并准备查看项目");
        if (vision) setPendingTurn((current) => current ? { ...current, events: recordPlanPhase(current.events, { ...payload.payload, status: payload.status }) } : current);
      }
      if (payload.type === "plan.tool-requested") {
        setPendingTurn((current) => current ? { ...current, events: recordPlanTool(current.events, payload.payload, false) } : current);
        setChatLoadingLabel(planToolLabel(payload.payload, false));
      }
      if (payload.type === "plan.tool-completed") {
        setPendingTurn((current) => current ? { ...current, events: recordPlanTool(current.events, payload.payload, true) } : current);
        setChatLoadingLabel(planToolLabel(payload.payload, true));
      }
      if (payload.type === "plan.agent-terminal" && payload.status === "succeeded") {
        setChatLoadingLabel("正在整理具体方案");
        setPendingTurn((current) => current ? { ...current, events: recordPlanComposition(current.events) } : current);
      }
      if (payload.type === "plan.delta") {
        const received = Math.max(0, Number(payload.payload?.receivedChars || payload.payload?.chars || 0));
        const preview = String(payload.payload?.preview || "");
        setChatLoadingLabel(`正在生成只读计划（已接收 ${received} 字）`);
        setPendingTurn((current) => current ? { ...current, events: recordPlanComposition(current.events, `正在接收方案内容，已收到 ${received} 字。`), label: "正在生成只读方案" } : current);
        if (preview) {
          streamingReplyRef.current = preview;
          setStreamingReplyState(preview);
        }
      }
      if (payload.type === "plan.completed") {
        setChatLoadingLabel("正在整理只读计划");
        setPendingTurn((current) => current ? { ...current, events: recordPlanPersistence(current.events), label: "正在保存只读方案" } : current);
      }
      if (payload.type === "model.delta") {
        receivedChars += Number(payload.payload?.chars || 0);
        setChatLoadingLabel(`正在生成回答（已接收 ${receivedChars} 字）`);
        const text = String(payload.payload?.text || "");
        if (text) {
          streamingReplyRef.current += text;
          setStreamingReplyState(streamingReplyRef.current);
        }
      }
    }).then((nextUnlisten) => {
      if (disposed) nextUnlisten();
      else unlisten = nextUnlisten;
    }).catch(() => {});
    return () => { disposed = true; unlisten(); };
  }, []);

  const setStreamingReply = useCallback((value) => {
    const nextValue = typeof value === "function" ? value(streamingReplyRef.current) : value;
    streamingReplyRef.current = String(nextValue || "");
    setStreamingReplyState(streamingReplyRef.current);
  }, []);

  const resetConversationRequest = useCallback(() => {
    setPendingTurn(null);
    setChatLoading(false);
    setStreamingReply("");
    streamingReplyRef.current = "";
    activeRequestRef.current = null;
  }, []);

  const stopCurrentResponse = useCallback(() => {
    const requestId = activeRequestRef.current?.id;
    if (requestId && settleRequest(activeRequestRef, requestId, "cancelled")) {
      const partialReply = streamingReplyRef.current.trim();
      onChatTurnsChange(projectExecutionEvent(chatTurns, {
        id: `${Date.now()}-assistant-cancelled`,
        outcome: "cancelled",
        requestId,
        responseMode: partialReply ? "partial" : "",
        text: partialReply ? `${partialReply}\n\n（已停止生成）` : "已取消当前处理。",
      }));
    }
    setChatLoading(false);
    setPendingTurn(null);
    setStreamingReply("");
    streamingReplyRef.current = "";
    void cancelRuntimeRequest?.(requestId);
    onStopPlan?.();
  }, [cancelRuntimeRequest, chatTurns, onChatTurnsChange, onStopPlan]);

  return {
    activeRequestRef, chatLoading, chatLoadingEvents, chatLoadingLabel, chatStartedAt, lastSubmissionRef, streamingReply,
    pendingTurn, resetConversationRequest, setChatLoading, setChatLoadingEvents, setChatLoadingLabel,
    setChatStartedAt, setPendingTurn, setStreamingReply, stopCurrentResponse,
  };
}
