/**
 * Week 1 live scorecard JSON (`liveScoreGames{n}` on dashboard settings): true if any game cell has a value.
 */
export function hasAnyLiveScoreGameInput(raw: string | null | undefined): boolean {
  if (raw == null || typeof raw !== "string" || !raw.trim()) return false;
  try {
    const o = JSON.parse(raw) as { p1?: unknown[]; p2?: unknown[] };
    const rowHasValue = (arr: unknown[] | undefined) =>
      Array.isArray(arr) && arr.some((c) => String(c ?? "").trim() !== "");
    return rowHasValue(o.p1) || rowHasValue(o.p2);
  } catch {
    return false;
  }
}

/**
 * Status string for bracket race-cell styling (match-status-in-progress / paused / completed).
 * Green (in progress) only when at least one game score exists — not when the scorecard is merely
 * opened (empty `liveScoreGames` rows) or status is only "In Progress..." with no scores yet.
 */
export function deriveMatchStatusForRaceCellStyle(
  rawStatus: string | null | undefined,
  liveScoreGamesJson: string | null | undefined
): string | null {
  const st = (rawStatus ?? "").trim();
  const lower = st.toLowerCase();

  if (lower === "completed") return "Completed";
  if (lower === "paused" || lower === "paused...") return st;

  if (hasAnyLiveScoreGameInput(liveScoreGamesJson)) {
    return "In Progress...";
  }

  return null;
}
