"use client";

import type { ReactNode } from "react";
import { ObsOverlayCopyUrlBlock } from "@/components/stream/ObsOverlayCopyUrlBlock";

type ObsOverlaySfxUrlRowProps = {
  listenUrl: string | null;
  /** Profile loading or key not yet on document */
  pendingKey: boolean;
  /** Placed inside the URL card below the copy row. */
  footer?: ReactNode;
};

/**
 * SFX overlay row: Export to OBS Scene (URL is applied via API, not shown here).
 */
export function ObsOverlaySfxUrlRow({ listenUrl, pendingKey, footer }: ObsOverlaySfxUrlRowProps) {
  return (
    <ObsOverlayCopyUrlBlock
      url={listenUrl}
      showPendingPlaceholder={pendingKey && !listenUrl}
      footer={footer}
      hideUrlAndCopy
      plain
    />
  );
}
