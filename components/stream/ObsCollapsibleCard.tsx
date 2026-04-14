"use client";

import { useId, type ReactNode } from "react";
import { labelTitleCase } from "@/lib/labelTitleCase";

type ObsCollapsibleCardProps = {
  title: string;
  /** Merged onto the default card surface classes (e.g. connected glow). */
  className?: string;
  /** @deprecated Ignored — cards are always expanded. */
  defaultOpen?: boolean;
  /** @deprecated Ignored — collapse is disabled. */
  open?: boolean;
  /** @deprecated Ignored — collapse is disabled. */
  onOpenChange?: (open: boolean) => void;
  /** Shown in the header row (e.g. status pill). */
  headerExtra?: ReactNode;
  /** @deprecated Unused (no collapse control). */
  collapseLabel?: string;
  /** When false, omit the rule between the title row and body (default true). */
  bodyTopDivider?: boolean;
  children: ReactNode;
};

const CARD_BASE =
  "w-full rounded-xl border border-white/10 bg-[#2A204A]/35 p-4 shadow-lg backdrop-blur-sm";

/**
 * Stream dashboard card: title row with optional trailing slot; body always visible (collapse disabled).
 */
export function ObsCollapsibleCard({
  title,
  className = "",
  headerExtra,
  bodyTopDivider = true,
  children,
}: ObsCollapsibleCardProps) {
  const uid = useId().replace(/:/g, "");
  const headingId = `obs-stream-card-${uid}-title`;
  const panelId = `obs-stream-card-${uid}-body`;
  const displayTitle = labelTitleCase(title);

  return (
    <section className={`${CARD_BASE} ${className}`.trim()} aria-labelledby={headingId}>
      <div className="w-full">
        <div className="flex items-center gap-3 pb-1.5">
          <h2 id={headingId} className="text-sm font-semibold text-blue-300">
            {displayTitle}
          </h2>
          {headerExtra ? <div className="ml-auto flex items-center gap-2">{headerExtra}</div> : null}
        </div>
        <div id={panelId} className="space-y-4 pt-3">
          {bodyTopDivider ? (
            <div className="border-b border-white/10" role="presentation" />
          ) : null}
          {children}
        </div>
      </div>
    </section>
  );
}
