"use client";

import { ObsCollapsibleCard } from "@/components/stream/ObsCollapsibleCard";
import { ObsOverlayCopyUrlBlock } from "@/components/stream/ObsOverlayCopyUrlBlock";
import { ScoreboardOverlayView } from "@/components/stream/ScoreboardOverlayView";
import { STREAM_OBS_CARD_IDS } from "@/components/stream/streamObsCardIds";
import { useObsStreamCardOpen } from "@/components/stream/ObsStreamCardOpenContext";
import type { ScoreboardState } from "@/components/stream/streamObsFormDefaults";

export type { ScoreboardState };

type ObsScoreboardPanelProps = {
  value: ScoreboardState;
  onChange: (next: ScoreboardState) => void;
  scoreboardOverlayUrl: string | null;
  overlayKeyPending: boolean;
  browserSourceName: string;
  onBrowserSourceNameChange: (name: string) => void;
  onWireToObs: () => void | Promise<void>;
  wirePending: boolean;
  wireError: string | null;
  wireSuccessAt: string | null;
};

/**
 * Scoreboard fields: live overlay URL + OBS Browser Source wiring (same data as preview).
 */
export function ObsScoreboardPanel({
  value,
  onChange,
  scoreboardOverlayUrl,
  overlayKeyPending,
  browserSourceName,
  onBrowserSourceNameChange,
  onWireToObs,
  wirePending,
  wireError,
  wireSuccessAt,
}: ObsScoreboardPanelProps) {
  const { open, setOpen } = useObsStreamCardOpen(STREAM_OBS_CARD_IDS.scoreboard);
  const set = (patch: Partial<ScoreboardState>) => onChange({ ...value, ...patch });

  return (
    <ObsCollapsibleCard
      title="Scoreboard Overlay"
      collapseLabel="Scoreboard Overlay"
      open={open}
      onOpenChange={setOpen}
    >
      <ObsOverlayCopyUrlBlock
        url={scoreboardOverlayUrl}
        showPendingPlaceholder={overlayKeyPending && !scoreboardOverlayUrl}
      />
      <label className="block text-xs font-medium text-slate-400">
        OBS browser source name
        <input
          type="text"
          value={browserSourceName}
          onChange={(e) => onBrowserSourceNameChange(e.target.value)}
          placeholder="EOSLT Scoreboard"
          className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/40"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-400">
          Away Name
          <input
            type="text"
            value={value.awayName}
            onChange={(e) => set({ awayName: e.target.value })}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/40"
          />
        </label>
        <label className="block text-xs font-medium text-slate-400">
          Home Name
          <input
            type="text"
            value={value.homeName}
            onChange={(e) => set({ homeName: e.target.value })}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/40"
          />
        </label>
        <label className="block text-xs font-medium text-slate-400">
          Away Score
          <input
            type="number"
            min={0}
            value={value.awayScore}
            onChange={(e) => set({ awayScore: Math.max(0, Number(e.target.value) || 0) })}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/40"
          />
        </label>
        <label className="block text-xs font-medium text-slate-400">
          Home Score
          <input
            type="number"
            min={0}
            value={value.homeScore}
            onChange={(e) => set({ homeScore: Math.max(0, Number(e.target.value) || 0) })}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/40"
          />
        </label>
      </div>
      <div className="rounded-lg border border-white/10 bg-black/40 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Preview</p>
        <ScoreboardOverlayView value={value} variant="dashboard" />
      </div>
      <button
        type="button"
        disabled={wirePending}
        onClick={() => void onWireToObs()}
        className="w-full rounded-lg bg-gradient-to-r from-purple-700 to-purple-500 py-2.5 text-sm font-medium text-white shadow-md shadow-purple-900/40 transition hover:from-purple-600 hover:to-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400/60 disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto sm:px-6"
      >
        {wirePending ? "Updating OBS…" : "Set URL In OBS Browser Source"}
      </button>
      {wireError ? (
        <p className="text-xs text-red-300" role="alert">
          {wireError}
        </p>
      ) : null}
      {wireSuccessAt ? (
        <p className="text-xs text-slate-500" aria-live="polite">
          Browser source URL updated at {wireSuccessAt}. Edits here sync to the overlay after save (about
          half a second).
        </p>
      ) : null}
    </ObsCollapsibleCard>
  );
}
