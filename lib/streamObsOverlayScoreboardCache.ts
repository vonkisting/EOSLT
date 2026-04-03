import type { ScoreboardState } from "@/components/stream/streamObsFormDefaults";

const prefix = "eoslt.streamObs.scoreboard:";

/**
 * Persists the last non-empty scoreboard for an overlay key across OBS “refresh browser”
 * (full reload), which clears in-memory module state.
 */
export function readOverlayScoreboardCache(overlayKey: string): ScoreboardState | null {
  if (typeof window === "undefined" || !overlayKey) return null;
  try {
    const raw = window.sessionStorage.getItem(`${prefix}${overlayKey}`);
    if (!raw) return null;
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return null;
    const rec = o as { homeName?: unknown; awayName?: unknown };
    if (typeof rec.homeName !== "string" || typeof rec.awayName !== "string") return null;
    return { homeName: rec.homeName, awayName: rec.awayName };
  } catch {
    return null;
  }
}

/** Writes only when at least one name is non-empty (avoids caching placeholder state). */
export function writeOverlayScoreboardCache(overlayKey: string, state: ScoreboardState): void {
  if (typeof window === "undefined" || !overlayKey) return;
  if (!state.homeName.trim() && !state.awayName.trim()) return;
  try {
    window.sessionStorage.setItem(`${prefix}${overlayKey}`, JSON.stringify(state));
  } catch {
    /* quota / private mode */
  }
}
