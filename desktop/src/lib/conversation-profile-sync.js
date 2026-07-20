export function syncConversationProfilePatches({ isTauri, patches, updateProfile, onProfileUpdated }) {
  if (!isTauri || !patches?.length) return false;
  updateProfile(patches).then((snapshot) => onProfileUpdated?.(snapshot)).catch(() => {});
  return true;
}
