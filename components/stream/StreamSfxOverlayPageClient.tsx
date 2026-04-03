"use client";

import { useEffect } from "react";
import { StreamSfxOverlayListener } from "@/components/stream/StreamSfxOverlayListener";

type StreamSfxOverlayPageClientProps = {
  overlayKey: string;
};

/**
 * OBS browser source page: validates `k` query param and mounts the audio listener.
 */
export function StreamSfxOverlayPageClient({ overlayKey }: StreamSfxOverlayPageClientProps) {
  useEffect(() => {
    if (!overlayKey) return;
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
  }, [overlayKey]);

  if (!overlayKey) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-xs">
        Add query <code className="text-slate-300">?k=…</code> from your stream dashboard.
      </div>
    );
  }

  return (
    <div className="box-border flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-transparent">
      <span className="sr-only">SFX listener active — keep this browser source unmuted in OBS.</span>
      <StreamSfxOverlayListener overlayKey={overlayKey} />
    </div>
  );
}
