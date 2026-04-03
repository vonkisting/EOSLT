"use client";

import { ObsCollapsibleCard } from "@/components/stream/ObsCollapsibleCard";
import { STREAM_OBS_CARD_IDS } from "@/components/stream/streamObsCardIds";
import { useObsStreamCardOpen } from "@/components/stream/ObsStreamCardOpenContext";

export type AudioChannel = { id: string; label: string; volume: number; muted: boolean };

type ObsAudioPanelProps = {
  connected: boolean;
  channels: AudioChannel[];
  loading?: boolean;
  error?: string | null;
  onVolumeChange: (id: string, volume: number) => void;
  /** Desired mute state after click (OBS `SetInputMute`). */
  onMuteToggle: (id: string, nextMuted: boolean) => void;
};

/**
 * OBS audio inputs: volume and mute via WebSocket (when connected).
 */
export function ObsAudioPanel({
  connected,
  channels,
  loading = false,
  error = null,
  onVolumeChange,
  onMuteToggle,
}: ObsAudioPanelProps) {
  const { open, setOpen } = useObsStreamCardOpen(STREAM_OBS_CARD_IDS.audio);

  return (
    <ObsCollapsibleCard
      title="Audio"
      collapseLabel="Audio Mixer"
      open={open}
      onOpenChange={setOpen}
    >
      <p className="text-xs text-slate-500">
        Volumes and mute follow OBS audio inputs (sources with a mixer fader). Lists update when OBS changes.
      </p>
      {error ? (
        <p className="rounded-lg border border-red-500/35 bg-red-950/35 px-3 py-2 text-xs text-red-200" role="alert">
          {error}
        </p>
      ) : null}
      {connected && !loading && channels.length === 0 && !error ? (
        <p className="text-xs text-slate-500">No audio inputs found (add desktop/mic or media sources in OBS).</p>
      ) : null}
      <ul className="flex flex-col gap-4" role="list">
        {channels.map((ch) => (
          <li key={ch.id} className="rounded-lg border border-white/10 bg-black/25 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-200">{ch.label}</span>
              <button
                type="button"
                disabled={!connected}
                onClick={() => onMuteToggle(ch.id, !ch.muted)}
                className={`rounded-md px-2 py-1 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-purple-400/50 disabled:opacity-40 ${
                  ch.muted
                    ? "bg-red-500/20 text-red-300 ring-1 ring-red-500/30"
                    : "bg-white/5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10"
                }`}
              >
                {ch.muted ? "Unmute" : "Mute"}
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span className="w-8 text-right text-xs tabular-nums text-slate-500">0</span>
              <input
                type="range"
                min={0}
                max={100}
                value={ch.volume}
                disabled={!connected || ch.muted}
                onChange={(e) => onVolumeChange(ch.id, Number(e.target.value))}
                className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-slate-700 accent-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={`${ch.label} Volume`}
              />
              <span className="w-8 text-xs tabular-nums text-slate-400">{ch.volume}</span>
            </div>
          </li>
        ))}
      </ul>
    </ObsCollapsibleCard>
  );
}
