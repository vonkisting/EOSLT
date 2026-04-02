"use client";

import { ObsOverlayCopyUrlBlock } from "@/components/stream/ObsOverlayCopyUrlBlock";

type ObsOverlaySfxUrlRowProps = {
  listenUrl: string | null;
  /** Profile loading or key not yet on document */
  pendingKey: boolean;
};

/**
 * Copyable browser-source URL for OBS SFX listener.
 */
export function ObsOverlaySfxUrlRow({ listenUrl, pendingKey }: ObsOverlaySfxUrlRowProps) {
  return (
    <ObsOverlayCopyUrlBlock
      title="OBS browser source (audio)"
      url={listenUrl}
      showPendingPlaceholder={pendingKey && !listenUrl}
    />
  );
}
