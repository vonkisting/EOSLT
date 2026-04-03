"use client";

import { useQuery } from "convex/react";
import { useEffect, useLayoutEffect } from "react";
import { api } from "@/convex/_generated/api";
import { ScoreboardOverlayView } from "@/components/stream/ScoreboardOverlayView";
import {
  DEFAULT_SCOREBOARD,
  mergeOverlayScoreboardWithSnapshot,
  scoreboardFromOverlayQuery,
  type ScoreboardState,
} from "@/components/stream/streamObsFormDefaults";

/**
 * Last merged scoreboard per overlay key survives React remounts (Strict Mode, OBS refresh)
 * so we do not fall back to placeholder names when Convex briefly drops the query.
 */
const lastMergedByOverlayKey = new Map<string, ScoreboardState>();

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

  const snapshot = lastMergedByOverlayKey.get(key) ?? DEFAULT_SCOREBOARD;

  const value: ScoreboardState =
    data !== undefined && data !== null
      ? mergeOverlayScoreboardWithSnapshot(scoreboardFromOverlayQuery(data), snapshot)
      : snapshot;

  useLayoutEffect(() => {
    if (data === undefined || data === null) return;
    const snap = lastMergedByOverlayKey.get(key) ?? DEFAULT_SCOREBOARD;
    const merged = mergeOverlayScoreboardWithSnapshot(scoreboardFromOverlayQuery(data), snap);
    lastMergedByOverlayKey.set(key, merged);
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

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-transparent p-2">
      <ScoreboardOverlayView value={value} variant="overlay" />
    </div>
  );
}
