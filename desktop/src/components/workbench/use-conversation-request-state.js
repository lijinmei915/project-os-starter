import { useCallback, useEffect, useRef, useState } from "react";
import { projectExecutionEvent } from "../../conversation-runtime";
import { listenRuntimeConversationEvents } from "../../lib/desktop-conversation-client";
import { isRequestRunning, settleRequest } from "../../lib/request-lifecycle";

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
