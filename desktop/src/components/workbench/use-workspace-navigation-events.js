import { useEffect } from "react";

export function useWorkspaceNavigationEvents({ setActiveWorkspaceTab }) {
  useEffect(() => {
    const handleTerminalShortcut = (event) => {
      if ((!event.metaKey && !event.ctrlKey) || event.key.toLowerCase() !== "j") return;
      event.preventDefault();
      setActiveWorkspaceTab((current) => current === "terminal" ? "plan" : "terminal");
    };
    window.addEventListener("keydown", handleTerminalShortcut);
    return () => window.removeEventListener("keydown", handleTerminalShortcut);
  }, [setActiveWorkspaceTab]);

  useEffect(() => {
    const onOpenConversation = () => setActiveWorkspaceTab("plan");
    const onOpenTerminal = () => setActiveWorkspaceTab("terminal");
    window.addEventListener("omnidesk:open-conversation", onOpenConversation);
    window.addEventListener("omnidesk:open-terminal", onOpenTerminal);
    return () => {
      window.removeEventListener("omnidesk:open-conversation", onOpenConversation);
      window.removeEventListener("omnidesk:open-terminal", onOpenTerminal);
    };
  }, [setActiveWorkspaceTab]);
}
