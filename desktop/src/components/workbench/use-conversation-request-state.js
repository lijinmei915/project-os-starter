import { useCallback, useEffect, useRef, useState } from "react";
import { projectExecutionEvent } from "../../conversation-runtime";
import { listenRuntimeConversationEvents } from "../../lib/desktop-conversation-client";
import { settleRequest } from "../../lib/request-lifecycle";

export function useConversationRequestState({ cancelRuntimeRequest, chatTurns, initialLoadingEvents = [], onChatTurnsChange, onStopPlan }) {
  const [pendingTurn, setPendingTurn] = useState(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatStartedAt, setChatStartedAt] = useState(Date.now());
  const [chatLoadingLabel, setChatLoadingLabel] = useState("组织回答");
  const [chatLoadingEvents, setChatLoadingEvents] = useState(() => initialLoadingEvents);
  const activeRequestRef = useRef(null);
  const lastSubmissionRef = useRef({ at: 0, key: "" });

  useEffect(() => {
    let disposed = false;
    let unlisten = () => {};
    let receivedChars = 0;
    void listenRuntimeConversationEvents((event) => {
      const payload = event?.payload || {};
      if (payload.requestId !== activeRequestRef.current?.id) return;
      if (payload.type === "model.started") setChatLoadingLabel("正在连接模型");
      if (payload.type === "model.delta") {
        receivedChars += Number(payload.payload?.chars || 0);
        setChatLoadingLabel(`正在生成回答（已接收 ${receivedChars} 字）`);
      }
    }).then((nextUnlisten) => {
      if (disposed) nextUnlisten();
      else unlisten = nextUnlisten;
    }).catch(() => {});
    return () => { disposed = true; unlisten(); };
  }, []);

  const resetConversationRequest = useCallback(() => {
    setPendingTurn(null);
    setChatLoading(false);
    activeRequestRef.current = null;
  }, []);

  const stopCurrentResponse = useCallback(() => {
    const requestId = activeRequestRef.current?.id;
    if (requestId && settleRequest(activeRequestRef, requestId, "cancelled")) {
      onChatTurnsChange(projectExecutionEvent(chatTurns, {
        id: `${Date.now()}-assistant-cancelled`, outcome: "cancelled", requestId, text: "已取消当前处理。",
      }));
    }
    setChatLoading(false);
    setPendingTurn(null);
    void cancelRuntimeRequest?.(requestId);
    onStopPlan?.();
  }, [cancelRuntimeRequest, chatTurns, onChatTurnsChange, onStopPlan]);

  return {
    activeRequestRef, chatLoading, chatLoadingEvents, chatLoadingLabel, chatStartedAt, lastSubmissionRef,
    pendingTurn, resetConversationRequest, setChatLoading, setChatLoadingEvents, setChatLoadingLabel,
    setChatStartedAt, setPendingTurn, stopCurrentResponse,
  };
}
