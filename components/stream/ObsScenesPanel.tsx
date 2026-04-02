"use client";

import { ObsCollapsibleCard } from "@/components/stream/ObsCollapsibleCard";
import { STREAM_OBS_CARD_IDS } from "@/components/stream/streamObsCardIds";
import { useObsStreamCardOpen } from "@/components/stream/ObsStreamCardOpenContext";

type ObsScenesPanelProps = {
  connected: boolean;
  scenes: string[];
  activeScene: string | null;
  onSelectScene: (name: string) => void | Promise<void>;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  switchingScene?: string | null;
};

/**
 * Program scene selection from OBS when connected.
 */
export function ObsScenesPanel({
  connected,
  scenes,
  activeScene,
  onSelectScene,
  loading = false,
  error = null,
  onRefresh,
  switchingScene = null,
}: ObsScenesPanelProps) {
  const { open, setOpen } = useObsStreamCardOpen(STREAM_OBS_CARD_IDS.sceneSelection);

  return (
    <ObsCollapsibleCard
      title="Scene Selection"
      collapseLabel="Scene Selection"
      open={open}
      onOpenChange={setOpen}
    >
      {connected && onRefresh && (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={loading}
            onClick={() => onRefresh()}
            className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/40 transition hover:bg-blue-500/30 hover:ring-blue-400/55 focus:outline-none focus:ring-2 focus:ring-blue-400/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Refresh Scenes"}
          </button>
        </div>
      )}
      {error && (
        <p className="rounded-lg border border-red-500/35 bg-red-950/35 px-3 py-2 text-xs text-red-200" role="alert">
          {error}
        </p>
      )}
      {connected && loading && scenes.length === 0 && (
        <p className="text-xs text-slate-500">Loading Scenes From OBS…</p>
      )}
      {connected && !loading && scenes.length === 0 && !error && (
        <p className="text-xs text-slate-500">No Scenes Returned From OBS.</p>
      )}
      <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
        {scenes.map((name) => {
          const active = activeScene === name;
          const busy = switchingScene === name;
          return (
            <button
              key={name}
              type="button"
              disabled={!connected || busy}
              aria-busy={busy}
              onClick={() => void onSelectScene(name)}
              className={`rounded-lg border px-3 py-3 text-center text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-purple-400/50 disabled:cursor-not-allowed disabled:opacity-40 ${
                active
                  ? "border-purple-400/60 bg-purple-600/30 text-purple-100"
                  : "border-white/10 bg-black/30 text-slate-200 hover:border-white/20 hover:bg-white/5"
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>
    </ObsCollapsibleCard>
  );
}
