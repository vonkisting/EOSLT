"use client";

import { useQuery } from "convex/react";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import { ScoreboardOverlayView } from "@/components/stream/ScoreboardOverlayView";
import { DEFAULT_SCOREBOARD } from "@/components/stream/streamObsFormDefaults";

type StreamScoreboardOverlayPageClientProps = {
  overlayKey: string;
};

/**
 * Live scoreboard for OBS: subscribes to Convex profile `scoreboardJson` via overlay key.
 */
export function StreamScoreboardOverlayPageClient({ overlayKey }: StreamScoreboardOverlayPageClientProps) {
  const data = useQuery(api.streamObsProfiles.getScoreboardByOverlayKey, {
    key: overlayKey.trim(),
  });

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

  if (!overlayKey.trim()) {
    return (
      <p className="p-4 text-center text-xs text-slate-500">
        Add query <code className="text-slate-300">?k=…</code> from your stream dashboard.
      </p>
    );
  }

  const value =
    data === undefined
      ? DEFAULT_SCOREBOARD
      : data === null
        ? DEFAULT_SCOREBOARD
        : {
            awayName: data.awayName,
            homeName: data.homeName,
            awayScore: data.awayScore,
            homeScore: data.homeScore,
          };

  return (
    <div
      className="flex min-h-screen w-full items-center justify-center bg-transparent p-2"
      style={{ textShadow: "0 2px 8px rgba(0,0,0,0.85)" }}
    >
      <ScoreboardOverlayView value={value} variant="overlay" />
    </div>
  );
}
