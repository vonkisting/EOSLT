"use client";

import { StreamSfxOverlayListener } from "@/components/stream/StreamSfxOverlayListener";

type StreamSfxOverlayPageClientProps = {
  overlayKey: string;
};

/**
 * OBS browser source page: validates `k` query param and mounts the audio listener.
 */
export function StreamSfxOverlayPageClient({ overlayKey }: StreamSfxOverlayPageClientProps) {
  if (!overlayKey) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-xs">
        Add query <code className="text-slate-300">?k=…</code> from your stream dashboard.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center p-4">
      <p className="max-w-sm text-center text-[10px] text-slate-600">
        SFX listener active — keep this source unmuted in OBS
      </p>
      <StreamSfxOverlayListener overlayKey={overlayKey} />
    </div>
  );
}
