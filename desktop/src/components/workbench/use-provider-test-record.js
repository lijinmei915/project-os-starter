import { useCallback } from "react";

export function useProviderTestRecord({ setComposerModelTests }) {
  return useCallback(({ apiBase, apiKeyEnv, checkedAt, message, model, status }) => {
    const key = [apiBase || "", apiKeyEnv || "", model || ""].join("|");
    setComposerModelTests((current) => ({
      ...current,
      [key]: { checkedAt, message, status },
    }));
  }, [setComposerModelTests]);
}
