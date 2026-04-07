"use client";

import type { CSSProperties, ReactNode } from "react";
import { useObsStreamCardOpen } from "@/components/stream/ObsStreamCardOpenContext";
import { useStreamObsLayout } from "@/components/stream/StreamObsLayoutContext";

type StreamObsCardChromeProps = {
  cardId: string;
  children: ReactNode;
};

const DRAG_BLOCK_SELECTOR =
  "button, a, input, textarea, select, label, [role='slider'], [contenteditable='true']";

function shouldBlockCardDrag(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest(DRAG_BLOCK_SELECTOR));
}

/**
 * Draggable stream dashboard card shell; order and optional persisted min sizes come from Convex.
 */
export function StreamObsCardChrome({ cardId, children }: StreamObsCardChromeProps) {
  const { open } = useObsStreamCardOpen(cardId);
  const { getSize, moveCardBefore } = useStreamObsLayout();
  const sz = getSize(cardId);
  const boxStyle: CSSProperties =
    open && (sz?.minHeightPx != null || sz?.minWidthPx != null)
      ? {
          ...(sz?.minHeightPx != null ? { minHeight: sz.minHeightPx } : {}),
          ...(sz?.minWidthPx != null ? { minWidth: sz.minWidthPx } : {}),
        }
      : {};

  return (
    <div
      data-stream-card={cardId}
      className="relative min-w-0 cursor-grab active:cursor-grabbing"
      style={boxStyle}
      draggable
      onDragStart={(e) => {
        if (shouldBlockCardDrag(e.target)) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData("text/plain", cardId);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const from = e.dataTransfer.getData("text/plain");
        if (from && from !== cardId) moveCardBefore(from, cardId);
      }}
    >
      {children}
    </div>
  );
}
