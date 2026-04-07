"use client";

import { useCallback, useRef, useState, type ChangeEvent } from "react";
import { ObsCollapsibleCard } from "@/components/stream/ObsCollapsibleCard";
import { STREAM_OBS_CARD_IDS } from "@/components/stream/streamObsCardIds";
import { useObsStreamCardOpen } from "@/components/stream/ObsStreamCardOpenContext";

export type GraphicsEffect = { id: string; label: string };

type ObsGraphicsEffectsPanelProps = {
  /** Requires OBS WebSocket connection to create scenes and media sources. */
  graphicsObsReady: boolean;
  effects: GraphicsEffect[];
  onTrigger: (graphicId: string) => void;
  onGraphicsListRefresh?: () => void;
  /** Last OBS error from playing a graphic (cleared by parent on success or new attempt). */
  triggerError?: string | null;
};

/**
 * Graphics / video effects: creates an OBS scene per clip (scene name = button label) and plays via FFmpeg URL.
 */
export function ObsGraphicsEffectsPanel({
  graphicsObsReady,
  effects,
  onTrigger,
  onGraphicsListRefresh,
  triggerError,
}: ObsGraphicsEffectsPanelProps) {
  const { open, setOpen } = useObsStreamCardOpen(STREAM_OBS_CARD_IDS.graphicsEffects);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const openFilePicker = useCallback(() => {
    setUploadError(null);
    fileInputRef.current?.click();
  }, []);

  const onFileSelected = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const file = input.files?.[0];
      input.value = "";
      if (!file) return;

      setUploadError(null);
      setUploading(true);
      try {
        const body = new FormData();
        body.set("file", file);
        const res = await fetch("/api/stream/graphics/upload", { method: "POST", body });
        const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (!res.ok || !data?.ok) {
          setUploadError(data?.error ?? `Upload failed (${res.status})`);
          return;
        }
        onGraphicsListRefresh?.();
      } catch {
        setUploadError("Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [onGraphicsListRefresh],
  );

  const addButton = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="*/*"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(ev) => void onFileSelected(ev)}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={openFilePicker}
        className="rounded-lg border border-amber-500/40 bg-amber-950/40 px-2 py-1 text-base font-semibold leading-none text-amber-100 transition hover:bg-amber-900/50 focus:outline-none focus:ring-2 focus:ring-amber-400/40 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={uploading ? "Uploading video" : "Add graphics video file"}
        title="Add graphics video file"
      >
        +
      </button>
    </>
  );

  return (
    <ObsCollapsibleCard
      title="Graphics Effects"
      collapseLabel="Graphics Effects"
      open={open}
      onOpenChange={setOpen}
      bodyTopDivider={false}
      headerExtra={addButton}
    >
      {uploadError ? (
        <p className="mb-2 text-xs text-red-400" role="alert">
          {uploadError}
        </p>
      ) : null}
      {triggerError ? (
        <p className="mb-2 text-xs text-red-400" role="alert">
          {triggerError}
        </p>
      ) : null}
      {!graphicsObsReady ? (
        <p className="text-xs text-slate-500">
          Connect to OBS so graphics can create scenes and FFmpeg media sources on your machine.
        </p>
      ) : null}
      {effects.length === 0 ? (
        <p className="text-xs text-slate-500">
          No videos in <code className="text-slate-400">public/stream-graphics/</code>. Use + to upload (mp4,
          webm, mov, mkv, m4v) or add files there and refresh.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {effects.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              disabled={!graphicsObsReady}
              title={!graphicsObsReady ? "Connect to OBS first" : `Create scene “${label}” and play video`}
              onClick={() => void onTrigger(id)}
              className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-sm font-medium text-amber-100 transition hover:bg-amber-900/40 focus:outline-none focus:ring-2 focus:ring-amber-400/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </ObsCollapsibleCard>
  );
}
