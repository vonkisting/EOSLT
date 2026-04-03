"use client";

import { useQuery } from "convex/react";
import { useEffect, useLayoutEffect } from "react";
import { api } from "@/convex/_generated/api";
import { TournamentResultsTable } from "@/components/stream/TournamentResultsTable";
import {
  DEFAULT_TOURNAMENT_SETTINGS,
  mergeOverlayTournamentWithSnapshot,
  parseTournamentSettingsJson,
  type TournamentSettingsState,
} from "@/components/stream/tournamentSettingsDefaults";
import {
  RESULTS_PREVIEW_CARD_OUTER_HEIGHT_PX,
  RESULTS_PREVIEW_CARD_OUTER_WIDTH_PX,
} from "@/lib/streamObsResultsPreviewDimensions";

const lastMergedByOverlayKey = new Map<string, TournamentSettingsState>();

type StreamTournamentResultsOverlayPageClientProps = {
  overlayKey: string;
};

/**
 * Live tournament results for OBS: subscribes to `tournamentSettingsJson` via overlay key `k`.
 */
export function StreamTournamentResultsOverlayPageClient({
  overlayKey,
}: StreamTournamentResultsOverlayPageClientProps) {
  const data = useQuery(api.streamObsProfiles.getTournamentResultsByOverlayKey, {
    key: overlayKey.trim(),
  });

  const key = overlayKey.trim();

  const snapshot = lastMergedByOverlayKey.get(key) ?? DEFAULT_TOURNAMENT_SETTINGS;

  const value: TournamentSettingsState =
    data !== undefined && data !== null
      ? mergeOverlayTournamentWithSnapshot(
          parseTournamentSettingsJson(data.tournamentSettingsJson || null),
          snapshot
        )
      : snapshot;

  useLayoutEffect(() => {
    if (data === undefined || data === null) return;
    const snap = lastMergedByOverlayKey.get(key) ?? DEFAULT_TOURNAMENT_SETTINGS;
    const merged = mergeOverlayTournamentWithSnapshot(
      parseTournamentSettingsJson(data.tournamentSettingsJson || null),
      snap
    );
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
    <div
      className="box-border overflow-y-auto overflow-x-hidden rounded-lg border border-white/10 bg-black/50 p-3 text-sm text-slate-200"
      style={{
        width: RESULTS_PREVIEW_CARD_OUTER_WIDTH_PX,
        height: RESULTS_PREVIEW_CARD_OUTER_HEIGHT_PX,
      }}
    >
      <TournamentResultsTable settings={value} variant="dashboard" />
    </div>
  );
}
