"use client";

import { ObsCollapsibleCard } from "@/components/stream/ObsCollapsibleCard";
import { STREAM_OBS_CARD_IDS } from "@/components/stream/streamObsCardIds";
import { useObsStreamCardOpen } from "@/components/stream/ObsStreamCardOpenContext";

export type SourceToggle = {
  sceneItemId: number;
  sceneName: string;
  sourceName: string;
  sourceKind: string;
  visible: boolean;
};

type ObsSourcesPanelProps = {
  connected: boolean;
  sources: SourceToggle[];
  onToggle: (item: SourceToggle) => void | Promise<void>;
  loading?: boolean;
  error?: string | null;
  togglingKey?: string | null;
};

/**
 * Scene items across OBS scenes: visibility toggles call the server when connected.
 */
export function ObsSourcesPanel({
  connected,
  sources,
  onToggle,
  loading = false,
  error = null,
  togglingKey = null,
}: ObsSourcesPanelProps) {
  const { open, setOpen } = useObsStreamCardOpen(STREAM_OBS_CARD_IDS.camerasSources);

  return (
    <ObsCollapsibleCard
      title="Cameras & Sources"
      collapseLabel="Cameras And Sources"
      open={open}
      onOpenChange={setOpen}
    >
      {connected ? (
        <p className="text-xs text-slate-500">Scene items update when OBS changes.</p>
      ) : null}
      {error && (
        <p className="rounded-lg border border-red-500/35 bg-red-950/35 px-3 py-2 text-xs text-red-200" role="alert">
          {error}
        </p>
      )}
      {!connected && (
        <p className="text-xs text-slate-500">Connect To OBS To Load Scene Items.</p>
      )}
      {connected && loading && sources.length === 0 && (
        <p className="text-xs text-slate-500">Loading Scene Items…</p>
      )}
      {connected && !loading && sources.length === 0 && !error && (
        <p className="text-xs text-slate-500">No Scene Items Found In Any Scene.</p>
      )}
      {sources.length > 0 ? (
        <ul className="flex flex-col gap-2" role="list">
          {sources.map((s) => {
            const rowKey = `${s.sceneName}:${s.sceneItemId}`;
            const busy = togglingKey === rowKey;
            return (
              <li
                key={rowKey}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/25 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-200">{s.sourceName}</span>
                  <span className="block truncate text-xs text-slate-500">
                    Scene: <span className="text-slate-400">{s.sceneName}</span>
                    {s.sourceKind ? (
                      <>
                        {" "}
                        · <span className="text-slate-500">{s.sourceKind}</span>
                      </>
                    ) : null}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={s.visible}
                  aria-busy={busy}
                  disabled={!connected || busy}
                  onClick={() => void onToggle(s)}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition focus:outline-none focus:ring-2 focus:ring-purple-400/50 disabled:cursor-not-allowed disabled:opacity-40 ${
                    s.visible ? "bg-purple-600" : "bg-slate-600"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                      s.visible ? "left-5" : "left-0.5"
                    }`}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </ObsCollapsibleCard>
  );
}
