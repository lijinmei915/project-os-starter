export function formatConversationUpdatedAt(value, now = Date.now()) {
  const raw = String(value || "").trim();
  if (!raw) return "未记录时间";
  if (/^\d{1,2}:\d{2}$/.test(raw)) return raw;
  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp)) return raw.slice(0, 16);
  const date = new Date(timestamp);
  const current = new Date(now);
  const pad = (number) => String(number).padStart(2, "0");
  const isToday = date.getFullYear() === current.getFullYear()
    && date.getMonth() === current.getMonth()
    && date.getDate() === current.getDate();
  return isToday
    ? `${pad(date.getHours())}:${pad(date.getMinutes())}`
    : `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
