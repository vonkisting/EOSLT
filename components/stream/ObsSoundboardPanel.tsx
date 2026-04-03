"use client";

import { ObsCollapsibleCard } from "@/components/stream/ObsCollapsibleCard";
import { STREAM_OBS_CARD_IDS } from "@/components/stream/streamObsCardIds";
import { useObsStreamCardOpen } from "@/components/stream/ObsStreamCardOpenContext";

export type SoundboardEffect = { id: string; label: string };

type ObsSoundboardPanelProps = {
  /** Requires a saved connection name so Convex can find the profile row. */
  sfxCueEnabled: boolean;
  effects: SoundboardEffect[];
  lastTriggered: string | null;
  onTrigger: (soundId: string) => void;
};

/**
 * Sound effects: cues Convex so the OBS SFX browser source (URL in OBS Connection) can play clips.
 */
export function ObsSoundboardPanel({
  sfxCueEnabled,
  effects,
  lastTriggered,
  onTrigger,
}: ObsSoundboardPanelProps) {
  const { open, setOpen } = useObsStreamCardOpen(STREAM_OBS_CARD_IDS.soundEffects);

  return (
    <ObsCollapsibleCard
      title="Sound Effects"
      collapseLabel="Sound Effects"
      open={open}
      onOpenChange={setOpen}
    >
      {!sfxCueEnabled ? (
        <p className="text-xs text-slate-500">
          Set a connection name and save the profile so sound cues can reach the overlay.
        </p>
      ) : null}
      {effects.length === 0 ? (
        <p className="text-xs text-slate-500">
          No MP3 files in <code className="text-slate-400">public/stream-sfx/</code>. Add{" "}
          <code className="text-slate-400">.mp3</code> files and refresh the page (this list is not synced from OBS).
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {effects.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              disabled={!sfxCueEnabled}
              title={!sfxCueEnabled ? "Connection name required" : undefined}
              onClick={() => void onTrigger(id)}
              className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-sm font-medium text-amber-100 transition hover:bg-amber-900/40 focus:outline-none focus:ring-2 focus:ring-amber-400/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {lastTriggered && (
        <p className="text-xs text-slate-500" aria-live="polite">
          Last Triggered: <span className="text-slate-400">{lastTriggered}</span>
        </p>
      )}
    </ObsCollapsibleCard>
  );
}
