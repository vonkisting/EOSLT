"use client";

import { useQuery } from "convex/react";
import { useEffect, useLayoutEffect } from "react";
import { api } from "@/convex/_generated/api";
import { ScoreboardOverlayView } from "@/components/stream/ScoreboardOverlayView";
import {
  DEFAULT_SCOREBOARD,
  mergeOverlayScoreboardWithSnapshot,
  scoreboardFromOverlayQuery,
  stabilizeOverlayScoreboardDisplay,
  type ScoreboardState,
} from "@/components/stream/streamObsFormDefaults";
import {
  readOverlayScoreboardCache,
  writeOverlayScoreboardCache,
} from "@/lib/streamObsOverlayScoreboardCache";
/**
 * Last merged scoreboard per overlay key survives React remounts (Strict Mode).
 * OBS “refresh browser” reloads this page and clears these maps — use sessionStorage too.
 */
const lastMergedByOverlayKey = new Map<string, ScoreboardState>();
/** Per-key last stable display (partial Convex rows + post-refresh hydrate). */
const lastStableDisplayByOverlayKey = new Map<string, ScoreboardState>();

type StreamScoreboardOverlayPageClientProps = {
  overlayKey: string;
};

/**
 * Live scoreboard for OBS: subscribes to Convex profile `scoreboardJson` via overlay key.
 * When `data` is missing briefly, reuse the last merged row for this key.
 */
export function StreamScoreboardOverlayPageClient({ overlayKey }: StreamScoreboardOverlayPageClientProps) {
  const data = useQuery(api.streamObsProfiles.getScoreboardByOverlayKey, {
    key: overlayKey.trim(),
  });

  const key = overlayKey.trim();

  const cached = readOverlayScoreboardCache(key);
  const snapshot =
    lastMergedByOverlayKey.get(key) ?? cached ?? DEFAULT_SCOREBOARD;

  const merged: ScoreboardState =
    data !== undefined && data !== null
      ? mergeOverlayScoreboardWithSnapshot(scoreboardFromOverlayQuery(data), snapshot)
      : snapshot;

  const prevStable =
    lastStableDisplayByOverlayKey.get(key) ?? cached ?? null;
  const value = stabilizeOverlayScoreboardDisplay(merged, prevStable);

  useLayoutEffect(() => {
    if (data === undefined || data === null) return;
    const snap =
      lastMergedByOverlayKey.get(key) ??
      readOverlayScoreboardCache(key) ??
      DEFAULT_SCOREBOARD;
    const nextMerged = mergeOverlayScoreboardWithSnapshot(scoreboardFromOverlayQuery(data), snap);
    lastMergedByOverlayKey.set(key, nextMerged);
    const nextDisplay = stabilizeOverlayScoreboardDisplay(
      nextMerged,
      lastStableDisplayByOverlayKey.get(key) ?? readOverlayScoreboardCache(key) ?? null
    );
    if (nextDisplay.homeName.trim() || nextDisplay.awayName.trim()) {
      lastStableDisplayByOverlayKey.set(key, nextDisplay);
      writeOverlayScoreboardCache(key, nextDisplay);
    }
  }, [data, key]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.background;
    const prevBody = body.style.background;
    html.style.background = "transparent";
    body.style.background = "transparent";
    return () => {
      html.style.background = prevHtml;
      body.style.background = prevBody;
    };
  }, []);

  if (!key) {
    return (
      <p className="p-4 text-center text-xs text-slate-500">
        Add query <code className="text-slate-300">?k=…</code> from your stream dashboard.
      </p>
    );
  }

  // Fill the OBS browser source (dimensions set in OBS); compact variant matches dashboard preview.
  return (
    <div className="box-border flex h-full min-h-0 w-full items-center justify-center overflow-auto bg-transparent p-3">
      <ScoreboardOverlayView value={value} variant="dashboard" />
    </div>
  );
}
