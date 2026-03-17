/**
 * Format a date string (YYYY-MM-DD) as MM/DD/YYYY for display.
 */
export function formatLocationDate(isoDate: string): string {
  const s = (isoDate ?? "").trim();
  if (!s) return "";
  const [y, m, d] = s.split("-");
  if (!m || !d) return s;
  const month = m.padStart(2, "0");
  const day = d.padStart(2, "0");
  return `${month}/${day}/${y ?? ""}`;
}

/**
 * Format a time string (HH:mm or HH:mm:ss, 24-hour) as 12-hour with AM/PM.
 */
export function formatLocationTime(isoTime: string): string {
  const s = (isoTime ?? "").trim();
  if (!s) return "";
  const [hPart, mPart] = s.split(":");
  const hours = parseInt(hPart ?? "0", 10);
  const minutes = parseInt(mPart ?? "0", 10);
  if (Number.isNaN(hours)) return s;
  const period = hours < 12 ? "AM" : "PM";
  const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const minStr = Number.isNaN(minutes) ? "00" : String(minutes).padStart(2, "0");
  return `${hour12}:${minStr} ${period}`;
}
