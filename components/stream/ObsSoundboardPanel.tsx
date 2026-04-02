"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ObsCollapsibleCard } from "@/components/stream/ObsCollapsibleCard";
import { ObsOverlaySfxUrlRow } from "@/components/stream/ObsOverlaySfxUrlRow";
import { STREAM_OBS_CARD_IDS } from "@/components/stream/streamObsCardIds";
import { useObsStreamCardOpen } from "@/components/stream/ObsStreamCardOpenContext";

const REFRESH_PILL =
  "rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/40 transition hover:bg-blue-500/30 hover:ring-blue-400/55 focus:outline-none focus:ring-2 focus:ring-blue-400/50 disabled:cursor-not-allowed disabled:opacity-50";

export type SoundboardEffect = { id: string; label: string };

type ObsSoundboardPanelProps = {
  /** Requires a saved connection name so Convex can find the profile row. */
  sfxCueEnabled: boolean;
  effects: SoundboardEffect[];
  lastTriggered: string | null;
  onTrigger: (soundId: string) => void;
  overlaySfxListenUrl: string | null;
  overlaySfxKeyPending: boolean;
};

/**
 * Sound effects: cues Convex so a browser source at `/overlay/sfx` can play `/stream-sfx/*.mp3`.
 */
export function ObsSoundboardPanel({
  sfxCueEnabled,
  effects,
  lastTriggered,
  onTrigger,
  overlaySfxListenUrl,
  overlaySfxKeyPending,
}: ObsSoundboardPanelProps) {
  const { open, setOpen } = useObsStreamCardOpen(STREAM_OBS_CARD_IDS.soundEffects);
  const router = useRouter();
  const [refreshPending, startRefresh] = useTransition();

  return (
    <ObsCollapsibleCard
      title="Sound Effects"
      collapseLabel="Sound Effects"
      open={open}
      onOpenChange={setOpen}
    >
      <div className="flex justify-end">
        <button
          type="button"
          disabled={refreshPending}
          onClick={() => startRefresh(() => router.refresh())}
          className={REFRESH_PILL}
        >
          {refreshPending ? "Refreshing…" : "Refresh List"}
        </button>
      </div>
      <ObsOverlaySfxUrlRow listenUrl={overlaySfxListenUrl} pendingKey={overlaySfxKeyPending} />
      {!sfxCueEnabled ? (
        <p className="text-xs text-slate-500">
          Set a connection name and save the profile so sound cues can reach the overlay.
        </p>
      ) : null}
      {effects.length === 0 ? (
        <p className="text-xs text-slate-500">
          No MP3 files in <code className="text-slate-400">public/stream-sfx/</code>. Add{" "}
          <code className="text-slate-400">.mp3</code> files and reload this page.
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
